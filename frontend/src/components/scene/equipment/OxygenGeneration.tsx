import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

import { getLunarHeight } from '../../../utils/terrainMath';

interface OxygenGenerationProps {
  id: string;
}

export const OxygenGeneration: React.FC<OxygenGenerationProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [18, 0, 32];
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
        radius={4.0}
      />

      {/* Ground Skid Foundation */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[3.8, 0.24, 3.4]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>

      {/* High-Pressure Cryogenic Liquid O2 Cylinders (Twin Vertical Tanks) */}
      <group position={[-0.9, 1.8, 0]}>
        {[-0.55, 0.55].map((z, idx) => (
          <group key={idx} position={[0, 0, z]}>
            {/* Cylinder Body */}
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.42, 0.42, 2.6, 20]} />
              <meshStandardMaterial
                color={hovered ? '#e0f2fe' : '#bae6fd'}
                metalness={0.75}
                roughness={0.25}
              />
            </mesh>
            {/* Rounded End Caps */}
            <mesh position={[0, 1.3, 0]}>
              <sphereGeometry args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#0284c7" metalness={0.8} />
            </mesh>
            <mesh position={[0, -1.3, 0]} rotation={[Math.PI, 0, 0]}>
              <sphereGeometry args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#0284c7" metalness={0.8} />
            </mesh>
            {/* Blue Oxygen Identification Band */}
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.43, 0.43, 0.35, 20]} />
              <meshBasicMaterial color="#0284c7" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Sabatier CO2 Reduction & Methanation Reactor Tower */}
      <group position={[0.9, 1.9, -0.5]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.48, 0.52, 3.2, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* Reactor Heating Core Jacket */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 1.2, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.6} />
        </mesh>
      </group>

      {/* Solid Polymer Electrolyte (SPE) Cell Stack Cabinet */}
      <group position={[0.9, 1.1, 0.8]}>
        <mesh castShadow>
          <boxGeometry args={[1.2, 1.6, 1.1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Electrolysis status telemetry light */}
        <mesh position={[0, 0.4, 0.56]}>
          <boxGeometry args={[0.5, 0.1, 0.02]} />
          <meshBasicMaterial color={status === 'nominal' ? '#00e5ff' : '#ef4444'} />
        </mesh>
      </group>

      {/* High-Pressure Cryo Oxygen Piping Line to Main Habitat */}
      <mesh position={[-0.9, 3.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 8]} />
        <meshStandardMaterial color="#0284c7" metalness={0.9} />
      </mesh>
    </group>
  );
};
