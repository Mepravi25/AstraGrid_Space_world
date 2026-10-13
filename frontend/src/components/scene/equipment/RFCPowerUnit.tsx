import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';
import { getLunarHeight } from '../../../utils/terrainMath';

// ============================================================================
// SHARED STATIC GEOMETRIES (Reused across renders for optimal WebGL performance)
// ============================================================================
const skidBaseGeo = new THREE.BoxGeometry(6.2, 0.28, 4.0);
const footpadGeo = new THREE.BoxGeometry(0.6, 0.16, 0.6);

// Central Fuel Cell Power Enclosure
const fcCabinetGeo = new THREE.BoxGeometry(2.0, 1.9, 1.6);
const fcServiceDoorGeo = new THREE.BoxGeometry(1.6, 1.5, 0.05);
const fcRadiatorBaseGeo = new THREE.BoxGeometry(1.8, 0.12, 1.4);
const fcCoolingFinGeo = new THREE.BoxGeometry(0.06, 0.26, 1.2);
const fcJunctionBoxGeo = new THREE.BoxGeometry(0.35, 0.7, 0.6);
const fcConduitGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
const statusBeaconBaseGeo = new THREE.BoxGeometry(0.7, 0.16, 0.06);
const statusBeaconLedGeo = new THREE.BoxGeometry(0.62, 0.1, 0.02);
const fcCoreStackSlotGeo = new THREE.BoxGeometry(1.2, 0.18, 0.04);

// Electrolyzer Enclosure
const elyCabinetGeo = new THREE.BoxGeometry(1.5, 1.25, 1.1);
const elyPanelGeo = new THREE.BoxGeometry(1.2, 0.95, 0.05);
const elyPumpGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.45, 16);
const elySeparatorGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.45, 12);
const elyLedGeo = new THREE.BoxGeometry(0.4, 0.08, 0.02);

// Cryogenic Tanks
const cradleGeo = new THREE.BoxGeometry(1.4, 0.35, 0.3);
const h2CylinderGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.0, 24);
const h2DomeGeo = new THREE.SphereGeometry(0.55, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const h2RingGeo = new THREE.TorusGeometry(0.56, 0.03, 8, 24);
const h2BandGeo = new THREE.CylinderGeometry(0.555, 0.555, 0.55, 24);
const h2PlacardGeo = new THREE.PlaneGeometry(0.72, 0.38);

const o2CylinderGeo = new THREE.CylinderGeometry(0.62, 0.62, 2.0, 24);
const o2DomeGeo = new THREE.SphereGeometry(0.62, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const o2RingGeo = new THREE.TorusGeometry(0.63, 0.03, 8, 24);
const o2BandGeo = new THREE.CylinderGeometry(0.625, 0.625, 0.55, 24);
const o2PlacardGeo = new THREE.PlaneGeometry(0.8, 0.42);

// Level Meter Segments
const meterSegmentGeo = new THREE.BoxGeometry(0.06, 0.14, 0.02);

// Piping & Conduits
const pipeHorizontalGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.45, 12);
const pipeZLeadGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12);
const pipeJointGeo = new THREE.SphereGeometry(0.055, 10, 10);
const feedPipeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 12);
const valveWheelGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
const waterLoopPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 12);

// ============================================================================
// PROCEDURAL PLACARD TEXTURE GENERATORS (Zero external network dependencies)
// ============================================================================
function createCryoTankPlacard(
  formula: 'H₂' | 'O₂',
  gasName: string,
  accentColor: string,
  hazardSpec: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Dark aerospace composite background
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border with gas identification accent
  ctx.lineWidth = 12;
  ctx.strokeStyle = accentColor;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // Top header bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(10, 10, canvas.width - 20, 38);

  // Header banner text
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CRYO GAS PRESSURE VESSEL', canvas.width / 2, 36);

  // Prominent chemical formula (e.g. H₂ or O₂)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 105px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(formula, canvas.width / 2, 142);

  // Gas title
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(gasName, canvas.width / 2, 188);

  // Hazard / pressure spec
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(hazardSpec, canvas.width / 2, 226);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface RFCPowerUnitProps {
  id?: string;
  position?: [number, number, number];
}

export const RFCPowerUnit: React.FC<RFCPowerUnitProps> = ({
  id = 'rfc-power-unit',
  position = [-16, 0, 10]
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const beaconLightRef = useRef<THREE.PointLight>(null);
  const [hovered, setHovered] = useState(false);

  // Connect strictly to existing Zustand RFC simulation state with narrow selectors
  const isRFCEnabled = useHabitatStore((state) => state.rfcState.isEnabled);
  const rfcMode = useHabitatStore((state) => state.rfcState.mode);
  // Quantized fill bars (0-5) to avoid per-tick re-renders during continuous gas transfer
  const h2Bars = useHabitatStore((state) => Math.min(5, Math.floor((state.rfcState.h2FillPct ?? 0) / 20)));
  const o2Bars = useHabitatStore((state) => Math.min(5, Math.floor((state.rfcState.o2FillPct ?? 0) / 20)));
  const isRFCPanelOpen = useHabitatStore((state) => state.isRFCPanelOpen);
  const toggleRFCPanel = useHabitatStore((state) => state.toggleRFCPanel);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);

  // Position anchored safely to lunar terrain height
  const rawX = position[0];
  const rawZ = position[2];
  const groundY = getLunarHeight(rawX, rawZ);

  const isSelected = selectedEquipmentId === id || isRFCPanelOpen;

  // Derive visual status indicator state strictly from existing RFC simulation
  const indicatorState = useMemo(() => {
    if (!isRFCEnabled || rfcMode === 'unavailable') {
      return {
        type: 'inactive' as const,
        color: '#ef4444',
        name: 'INACTIVE',
        equipmentStatus: 'offline' as const,
      };
    }
    if (rfcMode === 'generating') {
      return {
        type: 'generating' as const,
        color: '#10b981',
        name: 'GENERATING',
        equipmentStatus: 'nominal' as const,
      };
    }
    if (rfcMode === 'electrolyzing') {
      return {
        type: 'electrolyzing' as const,
        color: '#00e5ff',
        name: 'ELECTROLYZING',
        equipmentStatus: 'nominal' as const,
      };
    }
    // 'idle' / standby
    return {
      type: 'standby' as const,
      color: '#38bdf8',
      name: 'STANDBY',
      equipmentStatus: 'nominal' as const,
    };
  }, [isRFCEnabled, rfcMode]);

  // Procedural Placards (Memoized once)
  const h2Texture = useMemo(
    () => createCryoTankPlacard('H₂', 'HYDROGEN', '#00e5ff', '350 BAR • FUEL GAS'),
    []
  );
  const o2Texture = useMemo(
    () => createCryoTankPlacard('O₂', 'OXYGEN', '#38bdf8', '350 BAR • OXIDIZER'),
    []
  );

  // Micro-animation for dynamic indicators in scene
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (beaconLightRef.current) {
      if (indicatorState.type === 'generating') {
        beaconLightRef.current.intensity = 1.0 + Math.sin(t * 5.0) * 0.65;
      } else if (indicatorState.type === 'electrolyzing') {
        beaconLightRef.current.intensity = 0.9 + Math.sin(t * 4.0) * 0.55;
      } else if (indicatorState.type === 'standby') {
        beaconLightRef.current.intensity = 0.5;
      } else {
        // Inactive / disabled
        beaconLightRef.current.intensity = 0.2;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[rawX, groundY, rawZ]}
      onClick={(e) => {
        e.stopPropagation();
        toggleRFCPanel();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* 0. Ground Equipment Status Ring */}
      <EquipmentStatusIndicator
        status={indicatorState.equipmentStatus}
        isSelected={isSelected}
        isHovered={hovered}
        radius={4.2}
      />

      {/* 1. Structural Foundation Skid / Pallet Base */}
      <mesh geometry={skidBaseGeo} position={[0, 0.14, 0]} receiveShadow>
        <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* Heavy Corner Regolith Anchor Footpads */}
      {[
        [-2.8, -1.7],
        [2.8, -1.7],
        [-2.8, 1.7],
        [2.8, 1.7]
      ].map(([fx, fz], idx) => (
        <mesh key={idx} geometry={footpadGeo} position={[fx, 0.08, fz]} receiveShadow>
          <meshStandardMaterial color="#334155" roughness={0.9} />
        </mesh>
      ))}

      {/* 2. Compact Central Fuel-Cell Power Enclosure */}
      <group position={[0, 1.25, -0.4]}>
        {/* Main Cabinet Shell */}
        <mesh geometry={fcCabinetGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#e2e8f0' : '#cbd5e1'}
            metalness={0.75}
            roughness={0.25}
          />
        </mesh>

        {/* Front Service Door / Access Hatch Panel */}
        <mesh geometry={fcServiceDoorGeo} position={[0, -0.05, 0.82]}>
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Stack Core Visual Slot Indicator */}
        <mesh geometry={fcCoreStackSlotGeo} position={[0, -0.2, 0.85]}>
          <meshBasicMaterial
            color={indicatorState.type === 'generating' ? '#10b981' : '#1e293b'}
          />
        </mesh>

        {/* Roof Heat Rejection Radiators */}
        <group position={[0, 1.0, 0]}>
          <mesh geometry={fcRadiatorBaseGeo} castShadow>
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          {[-0.65, -0.32, 0, 0.32, 0.65].map((finX, i) => (
            <mesh key={i} geometry={fcCoolingFinGeo} position={[finX, 0.18, 0]}>
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
          ))}
        </group>

        {/* High-Voltage Microgrid Terminal Junction Box */}
        <group position={[-1.15, -0.2, 0]}>
          <mesh geometry={fcJunctionBoxGeo}>
            <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh geometry={fcConduitGeo} position={[0, -0.45, 0]}>
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>

        {/* Prominent Operational Status Beacon / Light Bar */}
        <group position={[0, 0.72, 0.82]}>
          <mesh geometry={statusBeaconBaseGeo}>
            <meshStandardMaterial color="#090d16" metalness={0.8} />
          </mesh>
          <mesh geometry={statusBeaconLedGeo} position={[0, 0, 0.04]}>
            <meshBasicMaterial color={indicatorState.color} />
          </mesh>
        </group>

        {/* Active PointLight Illuminating the Installation based on state */}
        <pointLight
          ref={beaconLightRef}
          position={[0, 0.95, 0.95]}
          color={indicatorState.color}
          distance={6.0}
          decay={2}
          intensity={0.6}
        />
      </group>

      {/* 3. Smaller Electrolyzer Enclosure */}
      <group position={[0, 0.8, 1.0]}>
        {/* Electrolyzer Cabinet Shell */}
        <mesh geometry={elyCabinetGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Inspection Face Panel */}
        <mesh geometry={elyPanelGeo} position={[0, 0, 0.56]}>
          <meshStandardMaterial color="#0f172a" metalness={0.7} />
        </mesh>

        {/* Electrolyzer Status Telemetry LED */}
        <mesh geometry={elyLedGeo} position={[0, 0.38, 0.59]}>
          <meshBasicMaterial
            color={indicatorState.type === 'electrolyzing' ? '#00e5ff' : '#0284c7'}
          />
        </mesh>

        {/* Process Water Feedstock Pump Manifold */}
        <mesh geometry={elyPumpGeo} position={[0.55, -0.35, 0.56]} rotation={[0, 0, Math.PI / 2]}>
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>

        {/* Dual Gas Separator Columns on Enclosure Roof */}
        {[-0.38, 0.38].map((sepX, i) => (
          <mesh key={i} geometry={elySeparatorGeo} position={[sepX, 0.85, 0]} castShadow>
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* 4. Hydrogen Storage Tank Marked H₂ */}
      <group position={[-1.9, 1.6, 0.2]}>
        {/* Support Saddles */}
        {[-0.55, 0.55].map((sz, i) => (
          <mesh key={i} geometry={cradleGeo} position={[0, -1.35, sz]} receiveShadow>
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
        ))}

        {/* Cylindrical Pressure Body */}
        <mesh geometry={h2CylinderGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#ffffff' : '#f1f5f9'}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>

        {/* Hemispherical Dome End Caps */}
        <mesh geometry={h2DomeGeo} position={[0, 1.0, 0]}>
          <meshStandardMaterial color="#06b6d4" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh geometry={h2DomeGeo} position={[0, -1.0, 0]} rotation={[Math.PI, 0, 0]}>
          <meshStandardMaterial color="#06b6d4" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Reinforcing Structural Girth Rings */}
        {[-0.5, 0.5].map((ry, i) => (
          <mesh key={i} geometry={h2RingGeo} position={[0, ry, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
        ))}

        {/* Teal / Cyan Identification Band */}
        <mesh geometry={h2BandGeo} position={[0, 0.1, 0]}>
          <meshBasicMaterial color="#06b6d4" />
        </mesh>

        {/* Front H₂ Placard */}
        <mesh geometry={h2PlacardGeo} position={[0, 0.12, 0.57]}>
          <meshBasicMaterial map={h2Texture} side={THREE.DoubleSide} />
        </mesh>
        {/* Rear H₂ Placard */}
        <mesh geometry={h2PlacardGeo} position={[0, 0.12, -0.57]} rotation={[0, Math.PI, 0]}>
          <meshBasicMaterial map={h2Texture} side={THREE.DoubleSide} />
        </mesh>

        {/* Vertical H₂ Fill Level Gauge (Visualizing actual simulation inventory) */}
        {[-0.32, -0.16, 0, 0.16, 0.32].map((segY, idx) => {
          const isLit = idx < h2Bars;
          return (
            <mesh key={idx} geometry={meterSegmentGeo} position={[0.57, segY, 0]}>
              <meshBasicMaterial color={isLit ? '#00e5ff' : '#1e293b'} />
            </mesh>
          );
        })}
      </group>

      {/* 5. Oxygen Storage Tank Marked O₂ */}
      <group position={[1.9, 1.6, 0.2]}>
        {/* Support Saddles */}
        {[-0.55, 0.55].map((sz, i) => (
          <mesh key={i} geometry={cradleGeo} position={[0, -1.35, sz]} receiveShadow>
            <meshStandardMaterial color="#334155" roughness={0.8} />
          </mesh>
        ))}

        {/* Cylindrical Pressure Body */}
        <mesh geometry={o2CylinderGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#ffffff' : '#f1f5f9'}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>

        {/* Hemispherical Dome End Caps */}
        <mesh geometry={o2DomeGeo} position={[0, 1.0, 0]}>
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh geometry={o2DomeGeo} position={[0, -1.0, 0]} rotation={[Math.PI, 0, 0]}>
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Reinforcing Structural Girth Rings */}
        {[-0.5, 0.5].map((ry, i) => (
          <mesh key={i} geometry={o2RingGeo} position={[0, ry, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
        ))}

        {/* Royal Oxygen Blue Identification Band */}
        <mesh geometry={o2BandGeo} position={[0, 0.1, 0]}>
          <meshBasicMaterial color="#0284c7" />
        </mesh>

        {/* Front O₂ Placard */}
        <mesh geometry={o2PlacardGeo} position={[0, 0.12, 0.64]}>
          <meshBasicMaterial map={o2Texture} side={THREE.DoubleSide} />
        </mesh>
        {/* Rear O₂ Placard */}
        <mesh geometry={o2PlacardGeo} position={[0, 0.12, -0.64]} rotation={[0, Math.PI, 0]}>
          <meshBasicMaterial map={o2Texture} side={THREE.DoubleSide} />
        </mesh>

        {/* Vertical O₂ Fill Level Gauge (Visualizing actual simulation inventory) */}
        {[-0.32, -0.16, 0, 0.16, 0.32].map((segY, idx) => {
          const isLit = idx < o2Bars;
          return (
            <mesh key={idx} geometry={meterSegmentGeo} position={[-0.64, segY, 0]}>
              <meshBasicMaterial color={isLit ? '#38bdf8' : '#1e293b'} />
            </mesh>
          );
        })}
      </group>

      {/* 6. Short Connecting Pipes and Manifold Conduits */}
      <group position={[0, 0, 0]}>
        {/* Electrolyzer to H₂ Tank Pipe Line */}
        <mesh
          geometry={pipeHorizontalGeo}
          position={[-1.15, 1.65, 1.0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh geometry={pipeJointGeo} position={[-1.9, 1.65, 1.0]}>
          <meshStandardMaterial color="#06b6d4" />
        </mesh>
        <mesh
          geometry={pipeZLeadGeo}
          position={[-1.9, 1.65, 0.6]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#94a3b8" metalness={0.85} />
        </mesh>

        {/* Electrolyzer to O₂ Tank Pipe Line */}
        <mesh
          geometry={pipeHorizontalGeo}
          position={[1.15, 1.65, 1.0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh geometry={pipeJointGeo} position={[1.9, 1.65, 1.0]}>
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        <mesh
          geometry={pipeZLeadGeo}
          position={[1.9, 1.65, 0.6]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#94a3b8" metalness={0.85} />
        </mesh>

        {/* H₂ Reactant Supply Line to Fuel Cell Cabinet */}
        <mesh
          geometry={feedPipeGeo}
          position={[-1.4, 1.3, -0.4]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
        <mesh geometry={valveWheelGeo} position={[-1.4, 1.3, -0.4]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>

        {/* O₂ Reactant Supply Line to Fuel Cell Cabinet */}
        <mesh
          geometry={feedPipeGeo}
          position={[1.4, 1.3, -0.4]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
        <mesh geometry={valveWheelGeo} position={[1.4, 1.3, -0.4]} rotation={[0, Math.PI / 2, 0]}>
          <meshStandardMaterial color="#0284c7" roughness={0.5} />
        </mesh>

        {/* Water Loop Conduit (Fuel Cell product water return to electrolyzer) */}
        <mesh
          geometry={waterLoopPipeGeo}
          position={[0, 0.35, 0.3]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#38bdf8" metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
};
