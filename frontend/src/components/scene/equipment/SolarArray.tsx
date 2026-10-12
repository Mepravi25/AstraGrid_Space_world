import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';
import { getLunarHeight } from '../../../utils/terrainMath';
import { getPhotovoltaicTexture } from '../../../utils/lunarTextures';

interface SolarArrayProps {
  id: string;
}

// Shared geometries across all solar masts
const mastPadGeo = new THREE.CylinderGeometry(2.8, 3.2, 0.25, 8);
const mastColGeo = new THREE.CylinderGeometry(0.3, 0.45, 5, 12);
const mastHubGeo = new THREE.SphereGeometry(0.65, 12, 12);
const mastBeamGeo = new THREE.CylinderGeometry(0.2, 0.2, 8.5, 10);
const panelFrameGeo = new THREE.BoxGeometry(4.2, 0.12, 3.2);
const panelFaceGeo = new THREE.PlaneGeometry(4.0, 3.0);
const beaconGeo = new THREE.SphereGeometry(0.15, 8, 8);

// Shared base materials
const padMat = new THREE.MeshStandardMaterial({ color: '#3a3d47', roughness: 0.9 });
const mastHubMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.2 });
const mastBeamMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.7, roughness: 0.3 });
const panelFrameMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.6, roughness: 0.4 });
const panelUndersideMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.92, roughness: 0.25 });

const SingleArrayMast: React.FC<{
  panelRef?: React.RefObject<THREE.Group>;
  status: string;
  hovered: boolean;
}> = ({ panelRef, status, hovered }) => {
  const pvTexture = useMemo(() => getPhotovoltaicTexture(), []);

  const pvMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: pvTexture,
        color: '#172554',
        metalness: 0.85,
        roughness: 0.16,
        emissive: status === 'nominal' ? '#0369a1' : '#000000',
        emissiveIntensity: status === 'nominal' ? 0.08 : 0
      }),
    [pvTexture, status]
  );

  return (
    <group>
      {/* Foundation Pad */}
      <mesh geometry={mastPadGeo} material={padMat} position={[0, 0.1, 0]} receiveShadow />

      {/* Vertical Mast Column */}
      <mesh geometry={mastColGeo} position={[0, 2.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={hovered ? '#60a5fa' : '#94a3b8'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Gimbal Elevation Actuator Hub */}
      <mesh geometry={mastHubGeo} material={mastHubMat} position={[0, 4.8, 0]} castShadow receiveShadow />

      {/* Horizontal Cross-Beam */}
      <mesh
        geometry={mastBeamGeo}
        material={mastBeamMat}
        position={[0, 4.8, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      />

      {/* Articulated Solar Panel Wings (Tilted to track the Sun) */}
      <group ref={panelRef} position={[0, 4.8, 0]} rotation={[-0.42, 0.55, 0]}>
        {/* Left Wing Panel */}
        <group position={[-3.8, 0, 0]}>
          <mesh geometry={panelFrameGeo} material={panelFrameMat} castShadow receiveShadow />
          {/* Top Photovoltaic Silicon Grid Surface */}
          <mesh
            geometry={panelFaceGeo}
            material={pvMat}
            position={[0, 0.065, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          />
          {/* Underside Gold MLI Thermal Insulation */}
          <mesh
            geometry={panelFaceGeo}
            material={panelUndersideMat}
            position={[0, -0.065, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>

        {/* Right Wing Panel */}
        <group position={[3.8, 0, 0]}>
          <mesh geometry={panelFrameGeo} material={panelFrameMat} castShadow receiveShadow />
          {/* Top Photovoltaic Silicon Grid Surface */}
          <mesh
            geometry={panelFaceGeo}
            material={pvMat}
            position={[0, 0.065, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          />
          {/* Underside Gold MLI Thermal Insulation */}
          <mesh
            geometry={panelFaceGeo}
            material={panelUndersideMat}
            position={[0, -0.065, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>

      {/* Status Strobe Beacon */}
      <mesh geometry={beaconGeo} position={[0, 5.5, 0]}>
        <meshBasicMaterial
          color={
            status === 'critical'
              ? '#ef4444'
              : status === 'warning'
              ? '#f59e0b'
              : status === 'offline'
              ? '#64748b'
              : '#00e5ff'
          }
        />
      </mesh>
    </group>
  );
};

export const SolarArray: React.FC<SolarArrayProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [-65, 0, -55];
  const groundY = getLunarHeight(rawPos[0], rawPos[2]);

  useFrame((state) => {
    if (panelRef.current && status !== 'offline' && status !== 'critical') {
      const sunTrack = Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      panelRef.current.rotation.x = -0.42 + sunTrack;
      panelRef.current.rotation.y = 0.55;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[rawPos[0], groundY, rawPos[2]]}
      onClick={(e) => {
        e.stopPropagation();
        selectEquipment(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <EquipmentStatusIndicator
        status={status}
        isSelected={isSelected}
        isHovered={hovered}
        radius={7.0}
      />

      {/* Primary tracking array */}
      <SingleArrayMast panelRef={panelRef} status={status} hovered={hovered} />

      {/* Adjacent field arrays forming the solar farm */}
      <group position={[-14, 0, 0]}>
        <SingleArrayMast status={status} hovered={hovered} />
      </group>
      <group position={[0, 0, -14]}>
        <SingleArrayMast status={status} hovered={hovered} />
      </group>
    </group>
  );
};
