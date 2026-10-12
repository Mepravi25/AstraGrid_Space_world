import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useHabitatStore } from '../../store/useHabitatStore';

export const CameraController: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const cameraTarget = useHabitatStore((state) => state.cameraTarget);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const equipment = useHabitatStore((state) => state.equipment);

  // Desired target for smooth lerp
  const targetPosRef = useRef(new THREE.Vector3(0, 1.5, 0));
  const isTransitioningRef = useRef(false);

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
      target={[0, 1.5, 0]}
    />
  );
};
