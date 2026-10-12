import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

// Shared static geometries for MainHabitat
const bermCylGeo = new THREE.CylinderGeometry(5.8, 6.4, 0.4, 24);
const mainDomeGeo = new THREE.SphereGeometry(4.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const ribDomeGeo = new THREE.SphereGeometry(4.52, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const cupolaGeo = new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const cupolaRingGeo = new THREE.TorusGeometry(0.95, 0.08, 8, 20);
const crewBaseGeo = new THREE.CylinderGeometry(3.0, 3.3, 0.3, 20);
const crewDomeGeo = new THREE.SphereGeometry(2.8, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const windowCircleGeo = new THREE.CircleGeometry(0.3, 12);
const corridorCylGeo = new THREE.CylinderGeometry(1.0, 1.0, 3.2, 14);
const airlockBoxGeo = new THREE.BoxGeometry(1.8, 1.8, 2.2);
const hatchBoxGeo = new THREE.BoxGeometry(1.2, 1.4, 0.08);
const ledBoxGeo = new THREE.BoxGeometry(0.4, 0.08, 0.04);

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
      <mesh geometry={bermCylGeo} position={[0, 0.2, 0]} receiveShadow>
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>

      {/* Primary Command Geodesic Dome */}
      <mesh geometry={mainDomeGeo} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={hovered ? '#e2e8f0' : '#f8fafc'}
          roughness={0.35}
          metalness={0.25}
          wireframe={false}
        />
      </mesh>

      {/* Hexagonal Surface Structural Ribs (Geodesic look) */}
      <mesh geometry={ribDomeGeo} position={[0, 0.42, 0]}>
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.2}
          wireframe={true}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Top Observatory Cupola */}
      <mesh geometry={cupolaGeo} position={[0, 4.8, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Cupola Window Frame Ring */}
      <mesh geometry={cupolaRingGeo} position={[0, 4.8, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>

      {/* High-Gain Deep Space Earth Comm Dish */}
      <group position={[1.8, 4.7, -1.2]} rotation={[0.4, 0.7, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
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
        <mesh geometry={crewBaseGeo} position={[0, 0.15, 0]} receiveShadow>
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
        {/* Habitat shell */}
        <mesh geometry={crewDomeGeo} position={[0, 0.3, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Porthole windows with warm interior glow */}
        <mesh geometry={windowCircleGeo} position={[1.8, 1.4, 1.2]} rotation={[0, 0.8, 0]}>
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Pressurized Transit Corridor between Central & Crew Dome */}
      <mesh geometry={corridorCylGeo} position={[2.6, 1.2, 1.1]} rotation={[0, -0.4, Math.PI / 2]} castShadow receiveShadow>
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Main Egress Airlock Module (Front / South side) */}
      <group position={[0, 0, 4.4]}>
        <mesh geometry={airlockBoxGeo} position={[0, 1.0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Outer Airlock Hatch Door */}
        <mesh geometry={hatchBoxGeo} position={[0, 1.0, 1.11]}>
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        {/* Status indicator LED over hatch */}
        <mesh geometry={ledBoxGeo} position={[0, 1.85, 1.12]}>
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>

      {/* Interior Habitat Illumination Glow leaking out */}
      <pointLight color="#38bdf8" intensity={0.6} distance={5} position={[0, 3, 0]} />
    </group>
  );
};
