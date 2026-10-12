import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

import { getLunarHeight } from '../../../utils/terrainMath';

interface SolidWasteUnitProps {
  id: string;
}

export const SolidWasteUnit: React.FC<SolidWasteUnitProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [50, 0, 32];
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
        radius={4.4}
      />

      {/* Skid Base */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.24, 3.4]} />
        <meshStandardMaterial color="#334155" roughness={0.85} />
      </mesh>

      {/* Main Pyrolysis Vacuum Autoclave Horizontal Vessel */}
      <group position={[-0.4, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.0, 1.0, 2.6, 20]} />
          <meshStandardMaterial
            color={hovered ? '#cbd5e1' : '#94a3b8'}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
        {/* Rear Rounded Dome */}
        <mesh position={[0, -1.3, 0]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} />
        </mesh>
      </group>

      {/* Front Autoclave Heavy Pressure Hatch with Locking Wheel */}
      <group position={[0.9, 1.4, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 0.2, 20]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>
        {/* Locking Spokes Wheel */}
        <mesh position={[0.15, 0, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.45, 0.06, 8, 16]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.7} />
        </mesh>
      </group>

      {/* Feedstock Input Hopper Chute */}
      <group position={[-0.4, 2.7, 0]}>
        <mesh castShadow>
          <coneGeometry args={[0.7, 0.8, 4]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} />
        </mesh>
      </group>

      {/* Recycled Polymer 3D Print Feedstock Spool Storage Bin on right */}
      <group position={[1.4, 0.9, 1.0]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 1.2, 0.9]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Filament Spools visible on shelf */}
        <mesh position={[0, 0.2, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.1, 16]} />
          <meshStandardMaterial color="#10b981" />
        </mesh>
      </group>

      {/* High-Temperature Core Heating Element Indicator Glow */}
      {status !== 'offline' && (
        <pointLight
          color="#f97316"
          intensity={status === 'nominal' ? 0.8 : 0.2}
          distance={4}
          position={[-0.4, 1.4, 0]}
        />
      )}
    </group>
  );
};
