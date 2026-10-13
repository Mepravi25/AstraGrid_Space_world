import React, { Suspense, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LunarSky } from './LunarSky';
import { LunarTerrain } from './LunarTerrain';
import { HabitatComplex } from './HabitatComplex';
import { FloatingResourceLabels } from './FloatingResourceLabels';
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

const AstronautOrbitFlashlightMesh: React.FC = () => {
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

const AstronautOrbitFlashlight: React.FC = () => {
  const isFlashlightOn = useHabitatStore((state) => state.isFlashlightOn);
  if (!isFlashlightOn) return null;
  return <AstronautOrbitFlashlightMesh />;
};

const PROFILER_BUFFER_SIZE = 120;

const SceneProfiler: React.FC = () => {
  const { gl, scene } = useThree();
  const frameTimes = useRef<number[]>([]);
  const callsHistory = useRef<number[]>([]);
  const trianglesHistory = useRef<number[]>([]);
  const bufferIndex = useRef(0);
  const lastTime = useRef<number>(performance.now());

  useFrame(() => {
    const now = performance.now();
    const dt = now - lastTime.current;
    lastTime.current = now;
    if (dt > 0 && dt < 1000) {
      const idx = bufferIndex.current % PROFILER_BUFFER_SIZE;
      frameTimes.current[idx] = dt;
      callsHistory.current[idx] = gl.info.render.calls;
      trianglesHistory.current[idx] = gl.info.render.triangles;
      bufferIndex.current++;
    }
  });

  useEffect(() => {
    (window as any).__HABITAT_METRICS__ = {
      getReport: () => {
        const samples = frameTimes.current.filter((n) => typeof n === 'number' && n > 0);
        const count = samples.length;
        if (count === 0) return null;
        const sorted = [...samples].sort((a, b) => a - b);
        const avgDt = sorted.reduce((a, b) => a + b, 0) / count;
        const medianDt = sorted[Math.floor(count * 0.5)];
        const p95Dt = sorted[Math.floor(count * 0.95)];
        const minDt = sorted[0];
        const maxDt = sorted[count - 1];
        const calls = callsHistory.current.filter((n) => typeof n === 'number');
        const triangles = trianglesHistory.current.filter((n) => typeof n === 'number');
        const avgCalls = calls.length ? calls.reduce((a, b) => a + b, 0) / calls.length : 0;
        const avgTriangles = triangles.length ? triangles.reduce((a, b) => a + b, 0) / triangles.length : 0;

        let meshCount = 0;
        let lightCount = 0;
        let objectCount = 0;
        scene.traverse((obj) => {
          objectCount++;
          if ((obj as THREE.Mesh).isMesh) meshCount++;
          if ((obj as THREE.Light).isLight) lightCount++;
        });

        return {
          fps: Math.round(1000 / avgDt),
          avgFrameTimeMs: Number(avgDt.toFixed(2)),
          medianFrameTimeMs: Number(medianDt.toFixed(2)),
          p95FrameTimeMs: Number(p95Dt.toFixed(2)),
          minFrameTimeMs: Number(minDt.toFixed(2)),
          maxFrameTimeMs: Number(maxDt.toFixed(2)),
          drawCalls: Math.round(avgCalls),
          triangles: Math.round(avgTriangles),
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          dpr: gl.getPixelRatio(),
          viewport: { width: gl.domElement.width, height: gl.domElement.height },
          objectsTotal: objectCount,
          meshesTotal: meshCount,
          lightsTotal: lightCount
        };
      }
    };
  }, [gl, scene]);

  return null;
};

const ShadowAndQualityManager: React.FC = () => {
  const { gl } = useThree();
  const performanceProfile = useHabitatStore((state) => state.performanceProfile);
  const shadowFrameCount = useRef(0);

  useEffect(() => {
    if (performanceProfile === 'quality') {
      gl.shadowMap.autoUpdate = true;
      gl.shadowMap.needsUpdate = true;
    } else {
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = true;
    }
  }, [performanceProfile, gl]);

  useFrame(() => {
    if (performanceProfile === 'balanced') {
      shadowFrameCount.current++;
      // In balanced mode, refresh shadows every 4 frames (75% shadow-pass reduction)
      if (shadowFrameCount.current % 4 === 0) {
        gl.shadowMap.needsUpdate = true;
      }
    }
  });

  return null;
};

export const LunarScene: React.FC = React.memo(() => {
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const explorationMode = useHabitatStore((state) => state.explorationMode);
  const performanceProfile = useHabitatStore((state) => state.performanceProfile);

  const dpr =
    performanceProfile === 'quality'
      ? 1.5
      : performanceProfile === 'balanced'
      ? 1.2
      : 1.0;

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
    >
      <Canvas
        shadows
        dpr={dpr}
        performance={{ min: 0.5 }}
        camera={{ position: [0, 1.75, 14], fov: 68, near: 0.1, far: 950 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
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
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={100}
          shadow-camera-far={420}
          shadow-camera-left={-125}
          shadow-camera-right={125}
          shadow-camera-top={125}
          shadow-camera-bottom={-125}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
        />

        {/* 2. Restrained Secondary Regolith / Earthshine Bounce (Preserves shadow visibility without haze) */}
        <hemisphereLight
          args={[LUNAR_FILL_SKY_COLOR, LUNAR_FILL_GROUND_COLOR, LUNAR_FILL_INTENSITY]}
        />

        <Suspense fallback={null}>
          <SceneProfiler />
          <ShadowAndQualityManager />
          <LunarSky />
          <LunarTerrain />
          <HabitatComplex />
          <FloatingResourceLabels />
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
});
