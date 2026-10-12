import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useHabitatStore } from '../../store/useHabitatStore';
import { getLunarHeight } from '../../utils/terrainMath';
import { resolveHorizontalCollisions } from '../../utils/collisionSystem';

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraTarget = useHabitatStore((state) => state.cameraTarget);
  const orbitCameraPos = useHabitatStore((state) => state.orbitCameraPos);
  const orbitTarget = useHabitatStore((state) => state.orbitTarget);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const equipment = useHabitatStore((state) => state.equipment);

  // Desired target for smooth lerp when focusing equipment
  const targetPosRef = useRef(new THREE.Vector3(...orbitTarget));
  const isTransitioningRef = useRef(false);

  // Sync initial camera position and orbit target from store on mount
  useEffect(() => {
    camera.position.set(orbitCameraPos[0], orbitCameraPos[1], orbitCameraPos[2]);
    if (controlsRef.current) {
      controlsRef.current.target.set(orbitTarget[0], orbitTarget[1], orbitTarget[2]);
      controlsRef.current.update();
    }
  }, []);

  // When focusing equipment or resetting camera target
  useEffect(() => {
    if (cameraTarget) {
      targetPosRef.current.set(cameraTarget[0], cameraTarget[1] + 1.2, cameraTarget[2]);
      isTransitioningRef.current = true;
    } else if (selectedEquipmentId) {
      const item = equipment.find((e) => e.id === selectedEquipmentId);
      if (item) {
        targetPosRef.current.set(item.position[0], item.position[1] + 1.2, item.position[2]);
        isTransitioningRef.current = true;
      }
    }
  }, [cameraTarget, selectedEquipmentId, equipment]);

  // Synchronize navigation state on unmount (when switching back to Astronaut or Control)
  useEffect(() => {
    return () => {
      const camPos = camera.position;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      // Derive first-person viewing angles from orbit camera orientation
      const yaw = Math.atan2(-dir.x, -dir.z);
      const maxPitch = (Math.PI / 2) * 0.94;
      const pitch = Math.max(-maxPitch, Math.min(maxPitch, Math.asin(Math.max(-0.999, Math.min(0.999, dir.y)))));

      // Resolve player position against obstacle collisions and lunar ground height
      const [safeX, safeZ] = resolveHorizontalCollisions(camPos.x, camPos.z, camPos.x, camPos.z, 0.55);
      const terrainH = getLunarHeight(safeX, safeZ);
      const safeY = terrainH + 1.75; // EYE_HEIGHT

      const headingDeg = Math.round(((-yaw * 180) / Math.PI + 360) % 360);

      const targetPos: [number, number, number] = controlsRef.current
        ? [controlsRef.current.target.x, controlsRef.current.target.y, controlsRef.current.target.z]
        : [camPos.x + dir.x * 12, camPos.y + dir.y * 12, camPos.z + dir.z * 12];

      useHabitatStore.getState().setOrbitState([camPos.x, camPos.y, camPos.z], targetPos);
      useHabitatStore.getState().setPlayerTransform([safeX, safeY, safeZ], headingDeg, yaw, pitch);
    };
  }, [camera]);

  useFrame(() => {
    if (controlsRef.current && isTransitioningRef.current) {
      controlsRef.current.target.lerp(targetPosRef.current, 0.08);
      controlsRef.current.update();

      if (controlsRef.current.target.distanceTo(targetPosRef.current) < 0.05) {
        isTransitioningRef.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={4}
      maxDistance={280}
      maxPolarAngle={Math.PI / 2.05} // Prevent camera going below lunar terrain
      target={orbitTarget}
    />
  );
};
