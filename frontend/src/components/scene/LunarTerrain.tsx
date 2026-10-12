import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getLunarHeight, LUNAR_CRATERS } from '../../utils/terrainMath';

export const LunarTerrain: React.FC = () => {
  // Generate procedurally elevated lunar terrain geometry
  const terrainGeometry = useMemo(() => {
    const size = 600;
    const segments = 160;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getLunarHeight(x, z);
      pos.setY(i, y);
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  // Scattered lunar rocks and boulders positioned directly on terrain surface
  const boulders = useMemo(() => {
    const list: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      rotation: [number, number, number];
    }> = [];
    const count = 75;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.sin(i * 3.7) * 0.4;
      const dist = 18 + ((i * 29) % 180);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Don't place rocks on immediate habitat walkways
      if (Math.hypot(x, z) > 12) {
        const y = getLunarHeight(x, z);
        const s = 0.45 + ((i % 7) * 0.35);
        list.push({
          position: [x, y + s * 0.4, z],
          scale: [s, s * 0.75, s * 1.1],
          rotation: [i * 0.6, i * 0.9, i * 0.4]
        });
      }
    }
    return list;
  }, []);

  // Pathway waymarkers / lights along main trails
  const trailMarkers = useMemo(() => {
    const markers: Array<[number, number, number]> = [];
    // Trail: Habitat to Solar Array Alpha [-65, -55]
    for (let t = 0.15; t <= 0.85; t += 0.12) {
      const x = -65 * t;
      const z = -55 * t;
      markers.push([x, getLunarHeight(x, z) + 0.05, z]);
    }
    // Trail: Habitat to Landing Pad [85, -75]
    for (let t = 0.15; t <= 0.85; t += 0.12) {
      const x = 85 * t;
      const z = -75 * t;
      markers.push([x, getLunarHeight(x, z) + 0.05, z]);
    }
    // Trail: Habitat to Kilopower Berm [-110, 75]
    for (let t = 0.15; t <= 0.85; t += 0.12) {
      const x = -110 * t;
      const z = 75 * t;
      markers.push([x, getLunarHeight(x, z) + 0.05, z]);
    }
    // Trail: Habitat to Rover Station [70, 50]
    for (let t = 0.15; t <= 0.85; t += 0.12) {
      const x = 70 * t;
      const z = 50 * t;
      markers.push([x, getLunarHeight(x, z) + 0.05, z]);
    }
    return markers;
  }, []);

  return (
    <group>
      {/* 1. Large Procedurally Displaced Lunar Regolith Surface */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          color="#292c35"
          roughness={0.94}
          metalness={0.06}
          flatShading={false}
        />
      </mesh>

      {/* 2. Leveled Habitat Central Foundation Pad */}
      <group position={[0, 0.03, 0]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[14, 64]} />
          <meshStandardMaterial color="#333742" roughness={0.85} metalness={0.2} />
        </mesh>

        {/* Outer glowing perimeter safety ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[13.7, 14.2, 64]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.35} />
        </mesh>
      </group>

      {/* 3. Foundation Pads for Outlying Installations */}
      {/* Solar Farm Regolith Pad */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-65, getLunarHeight(-65, -55) + 0.04, -55]}
      >
        <circleGeometry args={[18, 36]} />
        <meshStandardMaterial color="#2d3039" roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Landing Pad Blast Shield Area */}
      <group position={[85, getLunarHeight(85, -75) + 0.05, -75]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[16, 48]} />
          <meshStandardMaterial color="#22252d" roughness={0.88} metalness={0.25} />
        </mesh>
        {/* Landing Target Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[11.5, 12.2, 48]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.65} />
        </mesh>
        {/* Landing Center Cross */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[18, 0.8]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[0.8, 18]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* Rover Depot Service Pad */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[70, getLunarHeight(70, 50) + 0.04, 50]}
      >
        <circleGeometry args={[10, 32]} />
        <meshStandardMaterial color="#2c2f38" roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Nuclear Berm Shield Barrier Perimeter Ring */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-110, getLunarHeight(-110, 75) + 0.08, 75]}
      >
        <ringGeometry args={[13.5, 14.5, 36]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
      </mesh>

      {/* 4. Visual Crater Rim Toruses for Identified Craters */}
      {LUNAR_CRATERS.map((c, idx) => {
        const rimY = getLunarHeight(c.cx, c.cz);
        return (
          <group key={idx} position={[c.cx, rimY, c.cz]}>
            {/* Crater rim torus */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, c.rimHeight * 0.4, 0]}>
              <torusGeometry args={[c.radius * 0.96, c.radius * 0.16, 12, 36]} />
              <meshStandardMaterial color="#383b45" roughness={0.96} metalness={0.06} />
            </mesh>
          </group>
        );
      })}

      {/* 5. Surface Boulders */}
      {boulders.map((b, idx) => (
        <mesh
          key={idx}
          position={b.position}
          scale={b.scale}
          rotation={b.rotation}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#3d404c" roughness={0.96} metalness={0.08} />
        </mesh>
      ))}

      {/* 6. Trail Ground Beacons along Surface Roads */}
      {trailMarkers.map((pos, idx) => (
        <group key={idx} position={pos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.35, 12]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* 7. Distant Mountain Horizons encasing the crater basin */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 32, -260]}>
          <coneGeometry args={[220, 65, 24]} />
          <meshStandardMaterial color="#181a20" roughness={0.99} />
        </mesh>
        <mesh position={[-250, 28, 40]}>
          <coneGeometry args={[190, 58, 20]} />
          <meshStandardMaterial color="#16181e" roughness={0.99} />
        </mesh>
        <mesh position={[230, 30, 80]}>
          <coneGeometry args={[200, 62, 22]} />
          <meshStandardMaterial color="#17191f" roughness={0.99} />
        </mesh>
        <mesh position={[60, 35, 250]}>
          <coneGeometry args={[210, 68, 24]} />
          <meshStandardMaterial color="#15171d" roughness={0.99} />
        </mesh>
      </group>
    </group>
  );
};
