import React, { useMemo } from 'react';
import * as THREE from 'three';

interface CraterProps {
  position: [number, number, number];
  radius: number;
  depth: number;
}

const Crater: React.FC<CraterProps> = ({ position, radius, depth }) => {
  return (
    <group position={position}>
      {/* Crater rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <torusGeometry args={[radius, radius * 0.18, 12, 32]} />
        <meshStandardMaterial
          color="#42454e"
          roughness={0.92}
          metalness={0.08}
        />
      </mesh>
      {/* Depressed crater floor */}
      <mesh position={[0, -depth * 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.9, 24]} />
        <meshStandardMaterial
          color="#202228"
          roughness={0.98}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
};

export const LunarTerrain: React.FC = () => {
  // Pre-generate static craters
  const craters = useMemo(() => [
    { position: [-30, 0, -35] as [number, number, number], radius: 9.0, depth: 1.8 },
    { position: [36, 0, -28] as [number, number, number], radius: 11.5, depth: 2.2 },
    { position: [40, 0, 32] as [number, number, number], radius: 7.2, depth: 1.5 },
    { position: [-42, 0, 38] as [number, number, number], radius: 12.0, depth: 2.5 },
    { position: [5, 0, -42] as [number, number, number], radius: 5.5, depth: 1.2 },
    { position: [-20, 0, 35] as [number, number, number], radius: 4.8, depth: 1.0 },
    { position: [28, 0, -5] as [number, number, number], radius: 3.5, depth: 0.8 },
    { position: [-15, 0, -28] as [number, number, number], radius: 4.2, depth: 0.9 },
  ], []);

  // Pre-generate scattered lunar rocks / boulders
  const rocks = useMemo(() => {
    const list: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      rotation: [number, number, number];
    }> = [];
    const seed = 42;
    for (let i = 0; i < 45; i++) {
      const angle = (i / 45) * Math.PI * 2 + (Math.sin(i * seed) * 0.5);
      const dist = 12 + ((i * 17) % 55);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      // Don't place on exact center pad
      if (Math.hypot(x, z) > 6) {
        const s = 0.35 + ((i % 5) * 0.25);
        list.push({
          position: [x, s * 0.4, z],
          scale: [s, s * 0.7, s * 1.1],
          rotation: [i * 0.5, i * 0.8, i * 0.3],
        });
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* Primary Lunar Ground Surface */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[260, 260, 64, 64]} />
        <meshStandardMaterial
          color="#2b2d35"
          roughness={0.95}
          metalness={0.06}
        />
      </mesh>

      {/* Leveled Habitat Foundation Pad */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[11, 48]} />
        <meshStandardMaterial
          color="#333742"
          roughness={0.88}
          metalness={0.15}
        />
      </mesh>

      {/* Outer foundation perimeter marker ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[10.8, 11.2, 48]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.25} />
      </mesh>

      {/* Procedural Craters */}
      {craters.map((c, idx) => (
        <Crater key={idx} position={c.position} radius={c.radius} depth={c.depth} />
      ))}

      {/* Lunar Boulders */}
      {rocks.map((rock, idx) => (
        <mesh
          key={idx}
          position={rock.position}
          scale={rock.scale}
          rotation={rock.rotation}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#3a3d47"
            roughness={0.95}
            metalness={0.08}
          />
        </mesh>
      ))}

      {/* Distant rim mountains for horizon depth */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 15, -125]} rotation={[0, 0, 0]}>
          <coneGeometry args={[120, 32, 16]} />
          <meshStandardMaterial color="#1a1c22" roughness={0.99} />
        </mesh>
        <mesh position={[-125, 12, 10]} rotation={[0, 0, 0]}>
          <coneGeometry args={[100, 25, 16]} />
          <meshStandardMaterial color="#191b20" roughness={0.99} />
        </mesh>
      </group>
    </group>
  );
};
