import React, { useRef, useMemo } from 'react';
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

// Status colors
const colorMap: Record<EquipmentStatus, string> = {
  nominal: '#10b981',  // Emerald Green
  warning: '#f59e0b',  // Amber Caution
  critical: '#ef4444', // Crimson Alert
  offline: '#64748b'   // Slate Gray
};

export const EquipmentStatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  isSelected,
  isHovered,
  radius = 2.5,
  heightOffset = 0.05
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.PointLight>(null);

  const statusColor = colorMap[status] || '#10b981';
  const showBeaconLight = isSelected || isHovered || status === 'critical' || status === 'warning';

  const ringGeo = useMemo(() => new THREE.RingGeometry(radius * 0.9, radius, 32), [radius]);
  const bracketGeo = useMemo(() => new THREE.RingGeometry(radius * 1.15, radius * 1.22, 6), [radius]);

  useFrame((state) => {
    if (ringRef.current) {
      if (isSelected || isHovered) {
        ringRef.current.rotation.z += 0.015;
      }
      if (isSelected) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.08;
        ringRef.current.scale.set(scale, scale, scale);
      } else if (ringRef.current.scale.x !== 1) {
        ringRef.current.scale.set(1, 1, 1);
      }
    }
    if (beaconRef.current && showBeaconLight) {
      if (status === 'critical') {
        beaconRef.current.intensity = 1.2 + Math.sin(state.clock.elapsedTime * 8) * 1.0;
      } else if (status === 'warning') {
        beaconRef.current.intensity = 0.8 + Math.sin(state.clock.elapsedTime * 3) * 0.5;
      } else {
        beaconRef.current.intensity = 0.6;
      }
    }
  });

  return (
    <group position={[0, heightOffset, 0]}>
      {/* Ground projection ring */}
      <mesh ref={ringRef} geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={isSelected ? '#00e5ff' : statusColor}
          transparent
          opacity={isSelected ? 0.9 : isHovered ? 0.6 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer selection brackets if selected */}
      {isSelected && (
        <mesh geometry={bracketGeo} rotation={[-Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Point light beacon - active only when equipment is focused, selected, or alerting */}
      {showBeaconLight && (
        <pointLight
          ref={beaconRef}
          color={isSelected ? '#00e5ff' : statusColor}
          distance={radius * 2.8}
          decay={2}
          position={[0, 1.2, 0]}
        />
      )}
    </group>
  );
};
