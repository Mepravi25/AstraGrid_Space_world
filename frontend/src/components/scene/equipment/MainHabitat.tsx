import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface MainHabitatProps {
  id: string;
}

export const MainHabitat: React.FC<MainHabitatProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [0, 0, 0];

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
      {/* Ground status indicator ring */}
      <EquipmentStatusIndicator
        status={status}
        isSelected={isSelected}
        isHovered={hovered}
        radius={7.5}
      />

      {/* Regolith Berm Foundation Base */}
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <cylinderGeometry args={[5.8, 6.4, 0.4, 32]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>

      {/* Primary Command Geodesic Dome */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <sphereGeometry args={[4.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={hovered ? '#e2e8f0' : '#f8fafc'}
          roughness={0.35}
          metalness={0.25}
          wireframe={false}
        />
      </mesh>

      {/* Hexagonal Surface Structural Ribs (Geodesic look) */}
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[4.52, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.2}
          wireframe={true}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Top Observatory Cupola */}
      <mesh position={[0, 4.8, 0]} castShadow>
        <sphereGeometry args={[0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Cupola Window Frame Ring */}
      <mesh position={[0, 4.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.08, 8, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>

      {/* High-Gain Deep Space Earth Comm Dish */}
      <group position={[1.8, 4.7, -1.2]} rotation={[0.4, 0.7, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0]} castShadow>
          <sphereGeometry args={[0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 3]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Secondary Crew Quarters Dome (East side) */}
      <group position={[5.2, 0, 2.2]}>
        {/* Foundation */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[3.0, 3.3, 0.3, 24]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        {/* Habitat shell */}
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <sphereGeometry args={[2.8, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Porthole windows with warm interior glow */}
        <mesh position={[1.8, 1.4, 1.2]} rotation={[0, 0.8, 0]}>
          <circleGeometry args={[0.3, 16]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Pressurized Transit Corridor between Central & Crew Dome */}
      <mesh position={[2.6, 1.2, 1.1]} rotation={[0, -0.4, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 3.2, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Main Egress Airlock Module (Front / South side) */}
      <group position={[0, 0, 4.4]}>
        <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 1.8, 2.2]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Outer Airlock Hatch Door */}
        <mesh position={[0, 1.0, 1.11]}>
          <boxGeometry args={[1.2, 1.4, 0.08]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        {/* Status indicator LED over hatch */}
        <mesh position={[0, 1.85, 1.12]}>
          <boxGeometry args={[0.4, 0.08, 0.04]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>

      {/* Interior Habitat Illumination Glow leaking out */}
      <pointLight color="#38bdf8" intensity={0.8} distance={8} position={[0, 3, 0]} />
    </group>
  );
};
