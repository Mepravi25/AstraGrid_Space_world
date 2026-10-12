import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { LunarSky } from './LunarSky';
import { LunarTerrain } from './LunarTerrain';
import { HabitatComplex } from './HabitatComplex';
import { CameraController } from './CameraController';
import { FirstPersonPlayerController } from './FirstPersonPlayerController';
import { useHabitatStore } from '../../store/useHabitatStore';

const AstronautOrbitFlashlight: React.FC = () => {
  const isFlashlightOn = useHabitatStore((state) => state.isFlashlightOn);
  const playerPosition = useHabitatStore((state) => state.playerPosition);
  const playerYaw = useHabitatStore((state) => state.playerYaw);
  const playerPitch = useHabitatStore((state) => state.playerPitch);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const lightRef = useRef<THREE.SpotLight>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      const forwardX = -Math.sin(playerYaw) * Math.cos(playerPitch);
      const forwardY = Math.sin(playerPitch);
      const forwardZ = -Math.cos(playerYaw) * Math.cos(playerPitch);
      targetRef.current.position.set(
        playerPosition[0] + forwardX * 15,
        playerPosition[1] + forwardY * 15,
        playerPosition[2] + forwardZ * 15
      );
      targetRef.current.updateMatrixWorld();
      lightRef.current.target = targetRef.current;
    }
  }, [playerPosition, playerYaw, playerPitch]);

  if (!isFlashlightOn) return null;

  return (
    <>
      <primitive object={targetRef.current} />
      <spotLight
        ref={lightRef}
        position={[playerPosition[0], playerPosition[1], playerPosition[2]]}
        color="#e0f2fe"
        intensity={6.5}
        distance={48}
        angle={Math.PI / 5}
        penumbra={0.42}
        decay={1.8}
        castShadow
        shadow-bias={-0.001}
      />
      <pointLight
        position={[playerPosition[0], playerPosition[1] - 0.5, playerPosition[2]]}
        color="#bae6fd"
        intensity={0.8}
        distance={5}
        decay={2}
      />
    </>
  );
};

export const LunarScene: React.FC = () => {
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const explorationMode = useHabitatStore((state) => state.explorationMode);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.75, 18], fov: 68, near: 0.1, far: 850 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onPointerMissed={() => selectEquipment(null)}
      >
        <color attach="background" args={['#06070b']} />
        <fog attach="fog" args={['#06070b', 140, 520]} />

        {/* Harsh Lunar Sunlight (Low-angle grazing polar sunlight) */}
        <directionalLight
          position={[-120, 55, -100]}
          intensity={2.8}
          color="#fffdf0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={10}
          shadow-camera-far={350}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
          shadow-bias={-0.0004}
        />

        {/* Minimal ambient light (Moon has no atmospheric diffusion) */}
        <ambientLight intensity={0.18} color="#475569" />

        {/* Earthshine indirect illumination */}
        <directionalLight position={[100, 45, -120]} intensity={0.45} color="#38bdf8" />

        <Suspense fallback={null}>
          <LunarSky />
          <LunarTerrain />
          <HabitatComplex />
          {explorationMode === 'first_person' ? (
            <FirstPersonPlayerController />
          ) : (
            <>
              <CameraController />
              <AstronautOrbitFlashlight />
            </>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
};
