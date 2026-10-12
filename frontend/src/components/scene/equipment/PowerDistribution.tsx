import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface PowerDistributionProps {
  id: string;
}

export const PowerDistribution: React.FC<PowerDistributionProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [-8, 0, -6];

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
        radius={3.8}
      />

      {/* Substation Base Pad */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.24, 3.2]} />
        <meshStandardMaterial color="#334155" roughness={0.85} />
      </mesh>

      {/* Primary Switchgear Cabinet Enclosure */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 1.8, 2.4]} />
        <meshStandardMaterial
          color={hovered ? '#e2e8f0' : '#cbd5e1'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Front Breaker & Bus Meter Panels */}
      <group position={[0, 1.1, 1.21]}>
        {[-0.9, 0, 0.9].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.7, 1.4, 0.04]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </mesh>
            {/* Live Voltage Indicator Bar */}
            <mesh position={[0, 0.35, 0.03]}>
              <boxGeometry args={[0.4, 0.08, 0.02]} />
              <meshBasicMaterial color={status === 'nominal' ? '#00e5ff' : '#ef4444'} />
            </mesh>
          </group>
        ))}
      </group>

      {/* High-Voltage Transformer Ceramic Bushings on Roof */}
      <group position={[0, 2.0, 0]}>
        {[-0.8, 0, 0.8].map((x, i) => (
          <group key={i} position={[x, 0.4, 0]}>
            {/* Ribbed Ceramic Insulator */}
            <mesh castShadow>
              <cylinderGeometry args={[0.12, 0.16, 0.8, 12]} />
              <meshStandardMaterial color="#e0e7ff" roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Copper Terminal Cap */}
            <mesh position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.1, 10, 10]} />
              <meshStandardMaterial color="#d97706" metalness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Surface Umbilical Power Cable Runs radiating out */}
      {/* Cable toward Habitat Dome [8, 0, 6] vector */}
      <mesh position={[4, 0.04, 3]} rotation={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 8.5, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Cable toward Battery Bank [-6, 0, 16] vector */}
      <mesh position={[-3, 0.04, 8]} rotation={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 16.5, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* Cable toward Solar Array [-14, 0, -12] vector */}
      <mesh position={[-7, 0.04, -6]} rotation={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 18, 6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Substation Warning Beacon on corner */}
      <mesh position={[1.4, 2.1, 1.0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[1.4, 2.35, 1.0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#00e5ff" />
      </mesh>
    </group>
  );
};
