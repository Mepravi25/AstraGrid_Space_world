import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface WaterRecyclingProps {
  id: string;
}

export const WaterRecycling: React.FC<WaterRecyclingProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const centrifugeRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [16, 0, 4];

  useFrame((_, delta) => {
    if (centrifugeRef.current && status !== 'offline') {
      const speed = status === 'warning' ? 5.0 : status === 'critical' ? 8.0 : 2.5;
      centrifugeRef.current.rotation.y += delta * speed;
    }
  });

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
        radius={4.2}
      />

      {/* Skid Base Plate */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.24, 3.2]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>

      {/* Primary VCD Vacuum Centrifuge Distiller Drum */}
      <group position={[-0.8, 1.4, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.2, 2.2, 24]} />
          <meshStandardMaterial
            color={hovered ? '#e2e8f0' : '#cbd5e1'}
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>

        {/* Observation Porch / Rotor Window */}
        <mesh position={[0, 0.2, 1.21]}>
          <circleGeometry args={[0.4, 16]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0ea5e9"
            emissiveIntensity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Spinning Internal Centrifuge Impeller (visible through porthole) */}
        <mesh ref={centrifugeRef} position={[0, 0.2, 1.15]}>
          <boxGeometry args={[0.65, 0.08, 0.02]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Vacuum Sealing Ring Flanges */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[1.26, 1.26, 0.1, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
      </group>

      {/* Dual Catalytic Post-Treatment & Microbial Check Columns */}
      <group position={[1.1, 1.3, -0.6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.32, 2.1, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.33, 12, 12]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} />
        </mesh>
      </group>

      <group position={[1.1, 1.3, 0.6]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.32, 2.1, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <sphereGeometry args={[0.33, 12, 12]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} />
        </mesh>
      </group>

      {/* Condensing Heat Exchanger Radiator Fins at Back */}
      <group position={[0, 1.8, -1.3]}>
        {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.04, 1.4, 0.4]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Interconnecting Process Fluid Conduits */}
      <mesh position={[0.1, 1.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 1.8, 8]} />
        <meshStandardMaterial color="#06b6d4" metalness={0.8} />
      </mesh>
    </group>
  );
};
