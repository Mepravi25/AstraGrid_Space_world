import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SUN_SKY_POSITION, SUN_DIRECTION } from '../../utils/celestialConstants';
import { getSunCoronaTexture } from '../../utils/lunarTextures';

/**
 * SunDisc Component
 * Renders the visible Sun in the lunar sky in the exact direction of the directional sunlight.
 * Features:
 * - High-luminance white solar core with sharp limb
 * - Restrained optical glare / corona billboard with faint 4-point diffraction spikes
 * - Pure black surrounding space
 * - Fully synchronized with the directional sunlight vector
 */
export const SunDisc: React.FC = () => {
  const coronaRef = useRef<THREE.Mesh>(null);
  const coronaTexture = useMemo(() => getSunCoronaTexture(), []);

  // Ensure corona billboard always directly faces the active camera
  useFrame(({ camera }) => {
    if (coronaRef.current) {
      coronaRef.current.quaternion.copy(camera.quaternion);
    }
  });

  return (
    <group position={SUN_SKY_POSITION}>
      {/* 1. Core Solar Disc (Prominent, intense unlit solar core) */}
      <mesh>
        <sphereGeometry args={[11.5, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* 2. Solar Photosphere Limb Ring (Natural solar limb softening) */}
      <mesh>
        <sphereGeometry args={[13.2, 32, 32]} />
        <meshBasicMaterial
          color="#fffbe8"
          transparent
          opacity={0.75}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 3. Radiant Solar Corona & Optical Glare Billboard */}
      <mesh ref={coronaRef}>
        <planeGeometry args={[95, 95]} />
        <meshBasicMaterial
          map={coronaTexture}
          transparent
          opacity={0.62}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
