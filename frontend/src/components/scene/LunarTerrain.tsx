import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getLunarHeight } from '../../utils/terrainMath';
import { getLunarRegolithTextures } from '../../utils/lunarTextures';

export const LunarTerrain: React.FC = () => {
  const regolithTextures = useMemo(() => getLunarRegolithTextures(), []);

  // Generate procedurally elevated continuous lunar terrain geometry (optimized 120 segments)
  const terrainGeometry = useMemo(() => {
    const size = 600;
    const segments = 120;
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

  // Shared geometry, material, and instanced mesh ref for boulders (1 draw call vs 75)
  const boulderGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);
  const boulderMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4e515d', roughness: 0.92, metalness: 0.08 }),
    []
  );
  const instancedBouldersRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (instancedBouldersRef.current && boulders.length > 0) {
      const dummy = new THREE.Object3D();
      boulders.forEach((b, i) => {
        dummy.position.set(b.position[0], b.position[1], b.position[2]);
        dummy.scale.set(b.scale[0], b.scale[1], b.scale[2]);
        dummy.rotation.set(b.rotation[0], b.rotation[1], b.rotation[2]);
        dummy.updateMatrix();
        instancedBouldersRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instancedBouldersRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [boulders]);

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

  // Shared geometry, material, and instanced mesh ref for trail beacons (1 draw call vs 24)
  const markerGeo = useMemo(() => new THREE.CircleGeometry(0.35, 12), []);
  const markerMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.6 }),
    []
  );
  const instancedMarkersRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (instancedMarkersRef.current && trailMarkers.length > 0) {
      const dummy = new THREE.Object3D();
      trailMarkers.forEach((pos, i) => {
        dummy.position.set(pos[0], pos[1], pos[2]);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        instancedMarkersRef.current!.setMatrixAt(i, dummy.matrix);
      });
      instancedMarkersRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [trailMarkers]);

  return (
    <group>
      {/* 1. Large Procedurally Displaced Continuous Lunar Regolith Surface */}
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          color="#626672"
          map={regolithTextures.map}
          bumpMap={regolithTextures.bumpMap}
          bumpScale={0.05}
          roughness={0.90}
          metalness={0.04}
          flatShading={false}
        />
      </mesh>

      {/* 2. Leveled Habitat Central Foundation Pad */}
      <group position={[0, 0.03, 0]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[14, 64]} />
          <meshStandardMaterial color="#3d424e" roughness={0.85} metalness={0.2} />
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
        <meshStandardMaterial color="#383c47" roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Landing Pad Blast Shield Area */}
      <group position={[85, getLunarHeight(85, -75) + 0.05, -75]}>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[16, 48]} />
          <meshStandardMaterial color="#2d313c" roughness={0.88} metalness={0.25} />
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
        <meshStandardMaterial color="#363a45" roughness={0.9} metalness={0.15} />
      </mesh>

      {/* Nuclear Berm Shield Barrier Perimeter Ring */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-110, getLunarHeight(-110, 75) + 0.08, 75]}
      >
        <ringGeometry args={[13.5, 14.5, 36]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
      </mesh>

      {/* 4. Surface Boulders (Unified into a single high-performance instanced draw call) */}
      <instancedMesh
        ref={instancedBouldersRef}
        args={[boulderGeo, boulderMat, boulders.length]}
        castShadow
        receiveShadow
      />

      {/* 5. Trail Ground Beacons along Surface Roads (1 draw call instanced mesh) */}
      <instancedMesh
        ref={instancedMarkersRef}
        args={[markerGeo, markerMat, trailMarkers.length]}
      />
    </group>
  );
};
