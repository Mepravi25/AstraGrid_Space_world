import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

import { getLunarHeight } from '../../../utils/terrainMath';

// Shared static geometries
const hexPadGeo = new THREE.CylinderGeometry(3.8, 4.2, 0.3, 6);
const legAGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.0, 8);
const legBGeo = new THREE.CylinderGeometry(0.08, 0.12, 1.8, 8);
const tankAGeo = new THREE.SphereGeometry(1.5, 20, 20);
const tankBGeo = new THREE.SphereGeometry(1.3, 20, 20);
const ringAGeo = new THREE.TorusGeometry(1.52, 0.08, 8, 24);
const ringBGeo = new THREE.TorusGeometry(1.32, 0.07, 8, 24);
const glassGeo = new THREE.BoxGeometry(0.08, 1.6, 0.03);
const pipeGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.6, 10);
const valveGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.35, 10);

interface WaterStorageProps {
  id: string;
}

export const WaterStorage: React.FC<WaterStorageProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  // Subscribe strictly to waterReservePct to eliminate per-sol re-renders
  const waterPct = useHabitatStore((state) => state.telemetry.waterReservePct);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [28, 0, -24];
  const groundY = getLunarHeight(rawPos[0], rawPos[2]);

  return (
    <group
      ref={groupRef}
      position={[rawPos[0], groundY, rawPos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        selectEquipment(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <EquipmentStatusIndicator
        status={status}
        isSelected={isSelected}
        isHovered={hovered}
        radius={4.6}
      />

      {/* Hexagonal Foundation Stanchion Pad */}
      <mesh geometry={hexPadGeo} position={[0, 0.15, 0]} receiveShadow>
        <meshStandardMaterial color="#334155" roughness={0.85} />
      </mesh>

      {/* Tank A: Primary Potable Water Pressure Sphere */}
      <group position={[-1.4, 2.2, 0]}>
        {/* Support Tripod Legs */}
        {[-0.8, 0.8].map((x, i) => (
          <mesh key={i} geometry={legAGeo} position={[x, -1.0, 0]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
        ))}

        {/* Spherical Tank Outer Shell with MLI Multi-Layer Gold/Silver Sheen */}
        <mesh geometry={tankAGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#f8fafc' : '#e2e8f0'}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>

        {/* Equatorial Reinforcement Belly Band */}
        <mesh geometry={ringAGeo} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#0284c7" metalness={0.8} />
        </mesh>

        {/* Vertical Liquid Level Sight Glass Indicator */}
        <mesh geometry={glassGeo} position={[0, 0, 1.52]}>
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Glowing Water Level Strip */}
        <mesh position={[0, -0.8 + (1.6 * (waterPct / 100)) / 2, 1.54]}>
          <boxGeometry args={[0.04, Math.max(0.01, 1.6 * (waterPct / 100)), 0.02]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Tank B: Secondary Reserve Potable Water Sphere */}
      <group position={[1.4, 2.0, 0.2]}>
        {/* Support Tripod Legs */}
        {[-0.7, 0.7].map((x, i) => (
          <mesh key={i} geometry={legBGeo} position={[x, -0.9, 0]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
        ))}

        {/* Spherical Tank */}
        <mesh geometry={tankBGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#fef08a' : '#eab308'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Equatorial Band */}
        <mesh geometry={ringBGeo} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#0284c7" metalness={0.8} />
        </mesh>
      </group>

      {/* Fluid Transfer Manifold & Valve Pipe connecting tanks */}
      <mesh geometry={pipeGeo} position={[0, 2.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Central Flow Meter & Pressure Relief Actuator */}
      <mesh geometry={valveGeo} position={[0, 2.1, 0]}>
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>
    </group>
  );
};
