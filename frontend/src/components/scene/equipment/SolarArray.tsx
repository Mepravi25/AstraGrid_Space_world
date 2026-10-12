import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface SolarArrayProps {
  id: string;
}

export const SolarArray: React.FC<SolarArrayProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [-22, 0, -18];

  useFrame((state) => {
    // Subtle tracking adjustment if nominal
    if (panelRef.current && status !== 'offline' && status !== 'critical') {
      const sunTrack = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      panelRef.current.rotation.x = -0.35 + sunTrack;
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
      {/* Selection & status ground indicator */}
      <EquipmentStatusIndicator
        status={status}
        isSelected={isSelected}
        isHovered={hovered}
        radius={5.5}
      />

      {/* Regolith anchor stanchions / Foundation pad */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.8, 3.2, 0.25, 8]} />
        <meshStandardMaterial color="#3a3d47" roughness={0.9} />
      </mesh>

      {/* Vertical Mast Column */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.45, 5, 16]} />
        <meshStandardMaterial
          color={hovered ? '#60a5fa' : '#94a3b8'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Gimbal Elevation Actuator Hub */}
      <mesh position={[0, 4.8, 0]} castShadow>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Horizontal Cross-Beam */}
      <mesh position={[0, 4.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 8.5, 12]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Articulated Solar Panel Wings */}
      <group ref={panelRef} position={[0, 4.8, 0]} rotation={[-0.35, 0, 0]}>
        {/* Left Wing Panel */}
        <group position={[-3.8, 0, 0]}>
          {/* Panel Frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4.2, 0.12, 3.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Photovoltaic Active Cell Surface */}
          <mesh position={[0, 0.07, 0]}>
            <planeGeometry args={[4.0, 3.0]} />
            <meshStandardMaterial
              color="#0c2340"
              metalness={0.85}
              roughness={0.15}
              emissive={status === 'nominal' ? '#0284c7' : '#000000'}
              emissiveIntensity={status === 'nominal' ? 0.15 : 0}
            />
          </mesh>
          {/* Gold Thermal Blanket Backing */}
          <mesh position={[0, -0.07, 0]} rotation={[Math.PI, 0, 0]}>
            <planeGeometry args={[4.0, 3.0]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>

        {/* Right Wing Panel */}
        <group position={[3.8, 0, 0]}>
          {/* Panel Frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[4.2, 0.12, 3.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Photovoltaic Active Cell Surface */}
          <mesh position={[0, 0.07, 0]}>
            <planeGeometry args={[4.0, 3.0]} />
            <meshStandardMaterial
              color="#0c2340"
              metalness={0.85}
              roughness={0.15}
              emissive={status === 'nominal' ? '#0284c7' : '#000000'}
              emissiveIntensity={status === 'nominal' ? 0.15 : 0}
            />
          </mesh>
          {/* Gold Thermal Blanket Backing */}
          <mesh position={[0, -0.07, 0]} rotation={[Math.PI, 0, 0]}>
            <planeGeometry args={[4.0, 3.0]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Status Warning / Active Strobe on Mast */}
      <mesh position={[0, 5.5, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial
          color={
            status === 'critical'
              ? '#ef4444'
              : status === 'warning'
              ? '#f59e0b'
              : status === 'offline'
              ? '#64748b'
              : '#00e5ff'
          }
        />
      </mesh>
    </group>
  );
};
