import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';

export const LunarSky: React.FC = () => {
  const earthRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <>
      {/* High-density starfield */}
      <Stars
        radius={380}
        depth={160}
        count={8500}
        factor={5}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* Distant Earth hanging in the black lunar sky */}
      <group position={[140, 95, -190]}>
        <group ref={earthRef}>
          {/* Earth sphere */}
          <mesh>
            <sphereGeometry args={[14.5, 32, 32]} />
            <meshStandardMaterial
              color="#1e40af"
              roughness={0.7}
              metalness={0.1}
              emissive="#1d4ed8"
              emissiveIntensity={0.15}
            />
          </mesh>

          {/* Continents overlay */}
          <mesh>
            <sphereGeometry args={[7.55, 24, 24]} />
            <meshStandardMaterial
              color="#15803d"
              roughness={0.8}
              wireframe={false}
              transparent
              opacity={0.35}
            />
          </mesh>

          {/* Earth Atmosphere glow */}
          <mesh>
            <sphereGeometry args={[8.2, 32, 32]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.18}
              side={THREE.BackSide}
            />
          </mesh>
        </group>

        {/* Earthshine point light */}
        <pointLight color="#38bdf8" intensity={1.5} distance={150} decay={2} />
      </group>
    </>
  );
};
