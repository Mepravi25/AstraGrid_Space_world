import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface WaterStorageProps {
  id: string;
}

export const WaterStorage: React.FC<WaterStorageProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const telemetry = useHabitatStore((state) => state.telemetry);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [12, 0, -12];

  // Water level ratio
  const waterPct = telemetry.waterReservePct;

  return (
    <group
      ref={groupRef}
      position={position}
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
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[3.8, 4.2, 0.3, 6]} />
        <meshStandardMaterial color="#334155" roughness={0.85} />
      </mesh>

      {/* Tank A: Primary Potable Water Pressure Sphere */}
      <group position={[-1.4, 2.2, 0]}>
        {/* Support Tripod Legs */}
        {[-0.8, 0.8].map((x, i) => (
          <mesh key={i} position={[x, -1.0, 0]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <cylinderGeometry args={[0.08, 0.12, 2.0, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
        ))}

        {/* Spherical Tank Outer Shell with MLI Multi-Layer Gold/Silver Sheen */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.5, 24, 24]} />
          <meshStandardMaterial
            color={hovered ? '#f8fafc' : '#e2e8f0'}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>

        {/* Equatorial Reinforcement Belly Band */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.52, 0.08, 8, 32]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} />
        </mesh>

        {/* Vertical Liquid Level Sight Glass Indicator */}
        <mesh position={[0, 0, 1.52]}>
          <boxGeometry args={[0.08, 1.6, 0.03]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Glowing Water Level Strip */}
        <mesh position={[0, -0.8 + (1.6 * (waterPct / 100)) / 2, 1.54]}>
          <boxGeometry args={[0.04, 1.6 * (waterPct / 100), 0.02]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Tank B: Secondary Reserve Potable Water Sphere */}
      <group position={[1.4, 2.0, 0.2]}>
        {/* Support Tripod Legs */}
        {[-0.7, 0.7].map((x, i) => (
          <mesh key={i} position={[x, -0.9, 0]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]}>
            <cylinderGeometry args={[0.08, 0.12, 1.8, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
        ))}

        {/* Spherical Tank */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.3, 24, 24]} />
          <meshStandardMaterial
            color={hovered ? '#fef08a' : '#eab308'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>

        {/* Equatorial Band */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.32, 0.07, 8, 32]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} />
        </mesh>
      </group>

      {/* Fluid Transfer Manifold & Valve Pipe connecting tanks */}
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 2.6, 12]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Central Flow Meter & Pressure Relief Actuator */}
      <mesh position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.35, 12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} />
      </mesh>
    </group>
  );
};
