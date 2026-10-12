import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { LunarSky } from './LunarSky';
import { LunarTerrain } from './LunarTerrain';
import { HabitatComplex } from './HabitatComplex';
import { CameraController } from './CameraController';
import { FirstPersonPlayerController } from './FirstPersonPlayerController';
import { useHabitatStore } from '../../store/useHabitatStore';
import {
  SUN_LIGHT_POSITION,
  SUN_LIGHT_COLOR,
  SUN_LIGHT_INTENSITY,
  LUNAR_FILL_SKY_COLOR,
  LUNAR_FILL_GROUND_COLOR,
  LUNAR_FILL_INTENSITY
} from '../../utils/celestialConstants';

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
        camera={{ position: [0, 1.75, 14], fov: 68, near: 0.1, far: 950 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.25;
        }}
        onPointerMissed={() => selectEquipment(null)}
      >
        {/* Pure pitch-black deep space void (no atmospheric scattering) */}
        <color attach="background" args={['#010204']} />

        {/* 1. Principal Direct Sunlight (Physically unified with Sun disc direction) */}
        <directionalLight
          position={SUN_LIGHT_POSITION}
          intensity={SUN_LIGHT_INTENSITY}
          color={SUN_LIGHT_COLOR}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={100}
          shadow-camera-far={420}
          shadow-camera-left={-125}
          shadow-camera-right={125}
          shadow-camera-top={125}
          shadow-camera-bottom={-125}
          shadow-bias={-0.00025}
          shadow-normalBias={0.015}
        />

        {/* 2. Restrained Secondary Regolith / Earthshine Bounce (Preserves shadow visibility without haze) */}
        <hemisphereLight
          args={[LUNAR_FILL_SKY_COLOR, LUNAR_FILL_GROUND_COLOR, LUNAR_FILL_INTENSITY]}
        />

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
