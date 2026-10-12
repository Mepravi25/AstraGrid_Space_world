import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { LunarSky } from './LunarSky';
import { LunarTerrain } from './LunarTerrain';
import { HabitatComplex } from './HabitatComplex';
import { CameraController } from './CameraController';
import { useHabitatStore } from '../../store/useHabitatStore';

export const LunarScene: React.FC = () => {
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
      onPointerDown={(e) => {
        // If clicking on root background (not on 3D mesh), deselect
        if ((e.target as HTMLElement).tagName === 'CANVAS') {
          // Canvas will handle stopPropagation for meshes
        }
      }}
    >
      <Canvas
        shadows
        camera={{ position: [30, 22, 38], fov: 46, near: 0.5, far: 500 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => selectEquipment(null)}
      >
        <color attach="background" args={['#06070b']} />
        <fog attach="fog" args={['#06070b', 75, 220]} />

        {/* Harsh Lunar Sunlight (Low-angle grazing polar sunlight) */}
        <directionalLight
          position={[-60, 28, -50]}
          intensity={2.4}
          color="#fffdf0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={10}
          shadow-camera-far={180}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
          shadow-bias={-0.0004}
        />

        {/* Minimal ambient light (Moon has no atmospheric diffusion) */}
        <ambientLight intensity={0.16} color="#475569" />

        {/* Earthshine indirect illumination */}
        <directionalLight position={[40, 30, -60]} intensity={0.4} color="#38bdf8" />

        <Suspense fallback={null}>
          <LunarSky />
          <LunarTerrain />
          <HabitatComplex />
          <CameraController />
        </Suspense>
      </Canvas>
    </div>
  );
};
