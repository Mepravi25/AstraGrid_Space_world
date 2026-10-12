import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useHabitatStore } from '../../store/useHabitatStore';
import { getLunarHeight } from '../../utils/terrainMath';
import { resolveHorizontalCollisions } from '../../utils/collisionSystem';

export const FirstPersonPlayerController: React.FC = () => {
  const { camera, gl } = useThree();

  const isFlashlightOn = useHabitatStore((state) => state.isFlashlightOn);
  const setPointerLocked = useHabitatStore((state) => state.setPointerLocked);
  const setTargetedEquipmentId = useHabitatStore((state) => state.setTargetedEquipmentId);
  const setPlayerTransform = useHabitatStore((state) => state.setPlayerTransform);
  const equipment = useHabitatStore((state) => state.equipment);

  const initialPos = useHabitatStore((state) => state.playerPosition);
  const initialYaw = useHabitatStore((state) => state.playerYaw);
  const initialPitch = useHabitatStore((state) => state.playerPitch);

  // Astronaut physical constants
  const EYE_HEIGHT = 1.75;
  const WALK_SPEED = 4.8;
  const SPRINT_SPEED = 8.5;
  const JUMP_IMPULSE = 5.2;
  const GRAVITY = -11.5; // Tuned for responsive lunar bounding

  // Player physics state - initialized from store authoritative navigation state
  const posRef = useRef(new THREE.Vector3(initialPos[0], initialPos[1], initialPos[2]));
  const velRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);

  // Camera orientation angles (Euler YXZ) - initialized from store
  const yawRef = useRef(initialYaw);
  const pitchRef = useRef(initialPitch);

  // Key tracking
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Flashlight and target refs
  const flashlightRef = useRef<THREE.SpotLight>(null);
  const flashlightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  // Reusable vectors to avoid garbage collection
  const forwardVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const moveDir = useRef(new THREE.Vector3());
  const camDir = useRef(new THREE.Vector3());
  const objVec = useRef(new THREE.Vector3());

  // Setup input listeners and pointer lock management
  useEffect(() => {
    // Ensure initial vertical position respects lunar terrain
    const initialH = getLunarHeight(posRef.current.x, posRef.current.z);
    posRef.current.y = Math.max(posRef.current.y, initialH + EYE_HEIGHT);

    // Apply immediate camera transform
    camera.position.copy(posRef.current);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitchRef.current, yawRef.current, 0);

    let isMouseDown = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      keysRef.current[e.code] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      }
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      const isLocked =
        document.pointerLockElement === gl.domElement ||
        document.pointerLockElement === document.body ||
        document.pointerLockElement !== null;

      let dx = 0;
      let dy = 0;

      if (isLocked) {
        dx = e.movementX ?? (e as any).mozMovementX ?? (e as any).webkitMovementX ?? 0;
        dy = e.movementY ?? (e as any).mozMovementY ?? (e as any).webkitMovementY ?? 0;
      } else if (isMouseDown) {
        // Smooth drag-look fallback if pointer lock is not yet engaged
        dx = e.clientX - lastMouseX;
        dy = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      } else {
        return;
      }

      const SENSITIVITY = 0.0022;
      yawRef.current -= dx * SENSITIVITY;
      pitchRef.current -= dy * SENSITIVITY;

      // Clamp vertical look between -85° and +85°
      const maxPitch = (Math.PI / 2) * 0.94;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    const handleCanvasClick = () => {
      if (document.pointerLockElement !== gl.domElement) {
        try {
          window.focus();
          if (typeof gl.domElement.focus === 'function') {
            gl.domElement.focus();
          }
          const p = gl.domElement.requestPointerLock?.();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {});
          }
        } catch (e) {
          console.warn('Pointer lock request error:', e);
        }
      }
    };

    const onPointerLockChange = () => {
      const isLocked =
        document.pointerLockElement === gl.domElement ||
        document.pointerLockElement === document.body ||
        Boolean(document.pointerLockElement);
      setPointerLocked(isLocked);
    };

    const onPointerLockError = () => {
      setPointerLocked(false);
    };

    const onWindowBlur = () => {
      // Clear key state when losing focus
      keysRef.current = {};
      isMouseDown = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onWindowBlur);
    gl.domElement.addEventListener('click', handleCanvasClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);

    return () => {
      // Synchronize player orientation and position to authoritative store on unmount
      const pos = posRef.current;
      const yaw = yawRef.current;
      const pitch = pitchRef.current;

      const forwardX = -Math.sin(yaw) * Math.cos(pitch);
      const forwardY = Math.sin(pitch);
      const forwardZ = -Math.cos(yaw) * Math.cos(pitch);
      const targetDist = 14.0;

      const orbitTarget: [number, number, number] = [
        pos.x + forwardX * targetDist,
        pos.y + forwardY * targetDist,
        pos.z + forwardZ * targetDist
      ];

      useHabitatStore.getState().setOrbitState([pos.x, pos.y, pos.z], orbitTarget);
      const headingDeg = ((-yaw * 180) / Math.PI + 360) % 360;
      useHabitatStore.getState().setPlayerTransform(
        [pos.x, pos.y, pos.z],
        Math.round(headingDeg),
        yaw,
        pitch
      );

      // Release pointer lock if still held
      if (document.pointerLockElement === gl.domElement) {
        try {
          document.exitPointerLock();
        } catch (e) {}
      }

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onWindowBlur);
      gl.domElement.removeEventListener('click', handleCanvasClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
    };
  }, [camera, gl.domElement, setPointerLocked]);

  useFrame((_, delta) => {
    // Clamp delta to prevent physics blowup on tab unfocus
    const dt = Math.min(delta, 0.08);

    // Compute camera direction vectors from yaw
    forwardVec.current.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)).normalize();
    rightVec.current.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current)).normalize();

    // Determine horizontal movement intention
    moveDir.current.set(0, 0, 0);
    if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) moveDir.current.add(forwardVec.current);
    if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) moveDir.current.sub(forwardVec.current);
    if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) moveDir.current.sub(rightVec.current);
    if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) moveDir.current.add(rightVec.current);

    const isMoving = moveDir.current.lengthSq() > 0.001;
    if (isMoving) moveDir.current.normalize();

    const isSprinting = keysRef.current['ShiftLeft'] || keysRef.current['ShiftRight'];
    const targetSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

    // Horizontal acceleration & damping
    const accelRate = isGroundedRef.current ? 18.0 : 6.0;
    if (isMoving) {
      velRef.current.x = THREE.MathUtils.lerp(
        velRef.current.x,
        moveDir.current.x * targetSpeed,
        dt * accelRate
      );
      velRef.current.z = THREE.MathUtils.lerp(
        velRef.current.z,
        moveDir.current.z * targetSpeed,
        dt * accelRate
      );
    } else {
      const dampRate = isGroundedRef.current ? 14.0 : 2.5;
      velRef.current.x = THREE.MathUtils.lerp(velRef.current.x, 0, dt * dampRate);
      velRef.current.z = THREE.MathUtils.lerp(velRef.current.z, 0, dt * dampRate);
    }

    // Jump handling
    if (keysRef.current['Space'] && isGroundedRef.current) {
      velRef.current.y = JUMP_IMPULSE;
      isGroundedRef.current = false;
    }

    // Apply gravity
    velRef.current.y += GRAVITY * dt;

    // Calculate prospective position
    const prospectiveX = posRef.current.x + velRef.current.x * dt;
    const prospectiveZ = posRef.current.z + velRef.current.z * dt;

    // Resolve obstacle collisions (walls, domes, equipment)
    const [resolvedX, resolvedZ] = resolveHorizontalCollisions(
      posRef.current.x,
      posRef.current.z,
      prospectiveX,
      prospectiveZ,
      0.55
    );

    posRef.current.x = resolvedX;
    posRef.current.z = resolvedZ;

    // Apply vertical motion & terrain ground collision
    posRef.current.y += velRef.current.y * dt;

    const terrainH = getLunarHeight(posRef.current.x, posRef.current.z);
    const minHeight = terrainH + EYE_HEIGHT;

    if (posRef.current.y <= minHeight) {
      posRef.current.y = minHeight;
      velRef.current.y = 0;
      isGroundedRef.current = true;
    } else {
      isGroundedRef.current = false;
    }

    // Update Three.js camera transform
    camera.position.copy(posRef.current);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitchRef.current, yawRef.current, 0);

    // Update helmet flashlight orientation
    if (flashlightRef.current && flashlightTargetRef.current) {
      flashlightRef.current.position.copy(posRef.current);
      camera.getWorldDirection(camDir.current);
      flashlightTargetRef.current.position
        .copy(posRef.current)
        .addScaledVector(camDir.current, 15);
      flashlightTargetRef.current.updateMatrixWorld();
      flashlightRef.current.target = flashlightTargetRef.current;
    }

    // Periodic store sync for compass heading, coordinates, yaw, and pitch
    const headingDeg = ((-yawRef.current * 180) / Math.PI + 360) % 360;
    setPlayerTransform(
      [posRef.current.x, posRef.current.y, posRef.current.z],
      Math.round(headingDeg),
      yawRef.current,
      pitchRef.current
    );

    // Contextual Equipment Reticle Raycast Detection (within 12m)
    camera.getWorldDirection(camDir.current);
    let closestId: string | null = null;
    let closestDist = 12.0; // Max interact reach in meters

    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i];
      objVec.current.set(eq.position[0], eq.position[1] + 1.2, eq.position[2]);
      const dist = posRef.current.distanceTo(objVec.current);

      if (dist < closestDist) {
        // Calculate angle between camera gaze direction and object vector
        const toObject = objVec.current.clone().sub(posRef.current).normalize();
        const dot = camDir.current.dot(toObject);
        // dot > 0.82 corresponds to within ~35 degrees cone of view
        if (dot > 0.82) {
          closestDist = dist;
          closestId = eq.id;
        }
      }
    }

    setTargetedEquipmentId(closestId);
  });

  return (
    <>
      <primitive object={flashlightTargetRef.current} />
      {/* Astronaut Suit Helmet Spotlight */}
      <spotLight
        ref={flashlightRef}
        color="#e0f2fe"
        intensity={isFlashlightOn ? 6.5 : 0}
        distance={48}
        angle={Math.PI / 5}
        penumbra={0.42}
        decay={1.8}
        castShadow
        shadow-bias={-0.001}
      />
      {/* Astronaut Suit Ambient Foot Beam: illuminates immediate foreground around boots */}
      {isFlashlightOn && (
        <pointLight
          position={[posRef.current.x, posRef.current.y - 0.5, posRef.current.z]}
          color="#bae6fd"
          intensity={0.8}
          distance={5}
          decay={2}
        />
      )}
    </>
  );
};
