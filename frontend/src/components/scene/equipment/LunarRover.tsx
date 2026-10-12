import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';
import { getLunarHeight } from '../../../utils/terrainMath';

interface LunarRoverProps {
  id: string;
}

export const LunarRover: React.FC<LunarRoverProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [70, 0, 50];
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
        radius={4.5}
      />

      {/* Main Pressurized Rover Cabin Chassis */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[3.2, 1.6, 2.2]} />
        <meshStandardMaterial
          color={hovered ? '#e2e8f0' : '#cbd5e1'}
          roughness={0.4}
          metalness={0.7}
        />
      </mesh>

      {/* Cockpit Canopy Bubble */}
      <mesh position={[1.0, 1.7, 0]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[1.0, 16, 16, 0, Math.PI, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.1}
          metalness={0.9}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* 4 Compliant Wire-Mesh Lunar Wheels */}
      {[
        [-1.3, 0.55, 1.4],
        [1.3, 0.55, 1.4],
        [-1.3, 0.55, -1.4],
        [1.3, 0.55, -1.4]
      ].map((wheelPos, idx) => (
        <group key={idx} position={wheelPos as [number, number, number]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.45, 16]} />
            <meshStandardMaterial
              color="#334155"
              roughness={0.8}
              metalness={0.8}
              wireframe={false}
            />
          </mesh>
          {/* Wheel Hubcap */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.48, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      ))}

      {/* Rear High-Gain Communications Mast & Camera Boom */}
      <mesh position={[-1.3, 2.6, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 1.6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-1.3, 3.4, 0]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.05, 0.15, 12]} />
        <meshStandardMaterial color="#00e5ff" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Robotic Science Sampling Arm on Front */}
      <group position={[1.6, 0.9, 0.6]} rotation={[0.2, 0.3, -0.4]}>
        <mesh position={[0.4, 0, 0]}>
          <boxGeometry args={[0.8, 0.12, 0.12]} />
          <meshStandardMaterial color="#475569" metalness={0.8} />
        </mesh>
        <mesh position={[0.8, 0, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#00e5ff" />
        </mesh>
      </group>

      {/* Rover Headlights */}
      <pointLight position={[1.7, 1.3, 0.7]} color="#fef08a" intensity={0.9} distance={15} />
      <pointLight position={[1.7, 1.3, -0.7]} color="#fef08a" intensity={0.9} distance={15} />
    </group>
  );
};
