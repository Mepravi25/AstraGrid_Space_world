import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';
import { getLunarHeight } from '../../../utils/terrainMath';

interface LunarLanderProps {
  id: string;
}

export const LunarLander: React.FC<LunarLanderProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const rawPos = equipment?.position || [85, 0, -75];
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
        radius={7.5}
      />

      {/* Octagonal Descent Stage Core with Gold Foil MLI Thermal Blanket */}
      <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.8, 4.2, 2.4, 8]} />
        <meshStandardMaterial
          color={hovered ? '#fbbf24' : '#d97706'}
          roughness={0.35}
          metalness={0.85}
        />
      </mesh>

      {/* Main Rocket Engine Nozzle (Bell) */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.2, 1.6, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Quad Lander Legs & Footpads */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => {
        const legX = Math.cos(angle) * 4.8;
        const legZ = Math.sin(angle) * 4.8;
        return (
          <group key={idx}>
            {/* Diagonal Strut */}
            <mesh position={[legX * 0.55, 1.4, legZ * 0.55]} rotation={[0, -angle, 0.45]} castShadow receiveShadow>
              <cylinderGeometry args={[0.12, 0.12, 4.2, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Circular Regolith Footpad */}
            <mesh position={[legX, 0.08, legZ]} receiveShadow>
              <cylinderGeometry args={[0.9, 0.95, 0.16, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        );
      })}

      {/* Cylindrical Pressurized Payload / Habitation Module Upper Section */}
      <mesh position={[0, 4.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.8, 3.2, 2.6, 16]} />
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.25}
          metalness={0.75}
        />
      </mesh>

      {/* Top Docking Adapter Dome */}
      <mesh position={[0, 6.2, 0]} castShadow>
        <sphereGeometry args={[1.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Autonomous Navigation Radar & High-Gain Dish */}
      <mesh position={[1.8, 5.8, 1.2]} rotation={[0.4, 0.6, 0]}>
        <cylinderGeometry args={[0.7, 0.1, 0.3, 16]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Green Navigation Beacon */}
      <pointLight position={[0, 6.5, 0]} color="#10b981" intensity={1.2} distance={20} />
    </group>
  );
};
