import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EquipmentStatus } from '../../types/equipment';

interface StatusIndicatorProps {
  status: EquipmentStatus;
  isSelected: boolean;
  isHovered: boolean;
  radius?: number;
  heightOffset?: number;
}

export const EquipmentStatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  isSelected,
  isHovered,
  radius = 2.5,
  heightOffset = 0.05
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.PointLight>(null);

  // Status colors
  const colorMap = {
    nominal: '#10b981',  // Emerald Green
    warning: '#f59e0b',  // Amber Caution
    critical: '#ef4444', // Crimson Alert
    offline: '#64748b'   // Slate Gray
  };

  const statusColor = colorMap[status] || '#10b981';

  useFrame((state) => {
    if (ringRef.current) {
      if (isSelected || isHovered) {
        ringRef.current.rotation.z += 0.015;
      }
      const scale = isSelected ? 1 + Math.sin(state.clock.elapsedTime * 4) * 0.08 : 1;
      ringRef.current.scale.set(scale, scale, scale);
    }
    if (beaconRef.current) {
      if (status === 'critical') {
        beaconRef.current.intensity = 1.2 + Math.sin(state.clock.elapsedTime * 8) * 1.0;
      } else if (status === 'warning') {
        beaconRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.5;
      } else if (status === 'offline') {
        beaconRef.current.intensity = 0;
      } else {
        beaconRef.current.intensity = 0.6;
      }
    }
  });

  return (
    <group position={[0, heightOffset, 0]}>
      {/* Ground projection ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.9, radius, 32]} />
        <meshBasicMaterial
          color={isSelected ? '#00e5ff' : statusColor}
          transparent
          opacity={isSelected ? 0.9 : isHovered ? 0.6 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer selection brackets if selected */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.15, radius * 1.22, 6]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Point light beacon */}
      <pointLight
        ref={beaconRef}
        color={isSelected ? '#00e5ff' : statusColor}
        distance={radius * 3.5}
        decay={2}
        position={[0, 1.2, 0]}
      />
    </group>
  );
};
