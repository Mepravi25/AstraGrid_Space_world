import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

import { getLunarHeight } from '../../../utils/terrainMath';

// Shared static geometries & materials
const bermTorusGeo = new THREE.TorusGeometry(4.2, 1.2, 8, 20);
const pitCylGeo = new THREE.CylinderGeometry(3.2, 3.6, 0.3, 16);
const coreVesselGeo = new THREE.CylinderGeometry(0.9, 0.9, 1.8, 16);
const coreBandGeo = new THREE.CylinderGeometry(0.94, 0.94, 0.12, 16);
const sodiumPipeGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.5, 12);
const stirlingRingGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.3, 16);
const stirlingCylGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 8);
const radiatorConeGeo = new THREE.ConeGeometry(3.8, 2.8, 16, 1, true);
const ribBoxGeo = new THREE.BoxGeometry(0.06, 3.2, 0.08);
const postCylGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8);
const postSphGeo = new THREE.SphereGeometry(0.1, 8, 8);

const stirlingMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9 });
const ribMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.9 });
const postMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.7 });
const strobeMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });

interface NuclearPowerUnitProps {
  id: string;
}

export const NuclearPowerUnit: React.FC<NuclearPowerUnitProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [-110, 0, 75];
  const groundY = getLunarHeight(rawPos[0], rawPos[2]);

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
        radius={6.5}
      />

      {/* Regolith Radiation Shield Excavation Berm Ring */}
      <mesh geometry={bermTorusGeo} position={[0, 0.4, 0]}>
        <meshStandardMaterial color="#2d3039" roughness={0.95} />
      </mesh>

      {/* Central Excavation Pit Base */}
      <mesh geometry={pitCylGeo} position={[0, 0.15, 0]}>
        <meshStandardMaterial color="#1e222a" roughness={0.9} />
      </mesh>

      {/* Reactor Core Vessel (U-235 Solid Block in BeO Reflector) */}
      <group position={[0, 1.2, 0]}>
        <mesh geometry={coreVesselGeo} castShadow receiveShadow>
          <meshStandardMaterial
            color={hovered ? '#cbd5e1' : '#64748b'}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        {/* Core Shield Containment Bands */}
        {[-0.6, 0, 0.6].map((y, i) => (
          <mesh key={i} geometry={coreBandGeo} position={[0, y, 0]}>
            <meshStandardMaterial color="#f59e0b" metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Sodium Heat-Pipe Manifold Column */}
      <mesh geometry={sodiumPipeGeo} position={[0, 2.8, 0]} castShadow>
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* 8-Stirling Engine Power Conversion Ring */}
      <group position={[0, 3.6, 0]}>
        <mesh geometry={stirlingRingGeo}>
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
        {/* Stirling Engine Cylinders */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.cos(angle) * 1.1;
          const z = Math.sin(angle) * 1.1;
          return (
            <mesh
              key={i}
              geometry={stirlingCylGeo}
              material={stirlingMat}
              position={[x, 0, z]}
              rotation={[0, -angle, 0]}
              castShadow
            />
          );
        })}
      </group>

      {/* Distinctive Kilopower Umbrella Conical Heat Radiator Array */}
      <group position={[0, 5.2, 0]}>
        {/* Conical Radiator Fins (inverted umbrella) */}
        <mesh geometry={radiatorConeGeo} castShadow>
          <meshStandardMaterial
            color="#1e293b"
            metalness={0.85}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Radiator Rib Struts */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              geometry={ribBoxGeo}
              material={ribMat}
              position={[Math.cos(angle) * 1.8, -0.2, Math.sin(angle) * 1.8]}
              rotation={[0, -angle, 0.7]}
            />
          );
        })}
      </group>

      {/* 4 Perimeter Radiation Hazard Warning Posts */}
      {[
        [-4.5, -4.5],
        [4.5, -4.5],
        [4.5, 4.5],
        [-4.5, 4.5],
      ].map(([px, pz], idx) => (
        <group key={idx} position={[px, 0, pz]}>
          <mesh geometry={postCylGeo} material={postMat} position={[0, 0.8, 0]} />
          {/* Amber warning flashing strobe */}
          <mesh geometry={postSphGeo} material={strobeMat} position={[0, 1.65, 0]} />
        </group>
      ))}

      {/* High-Temperature Core Thermal Glow (active when online) */}
      {status !== 'offline' && (
        <pointLight color="#f59e0b" intensity={0.7} distance={6} position={[0, 1.5, 0]} />
      )}
    </group>
  );
};
