import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useHabitatStore } from '../../../store/useHabitatStore';
import { EquipmentStatusIndicator } from '../EquipmentStatusIndicator';

interface BatteryBankProps {
  id: string;
}

export const BatteryBank: React.FC<BatteryBankProps> = ({ id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const equipment = useHabitatStore((state) => state.equipment.find((e) => e.id === id));
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const telemetry = useHabitatStore((state) => state.telemetry);

  const isSelected = selectedEquipmentId === id;
  const status = equipment?.status || 'nominal';
  const position = equipment?.position || [-14, 0, 10];
  const soc = telemetry.batterySocPct;

  // LED bar color based on SoC
  const ledColor = soc > 50 ? '#10b981' : soc > 25 ? '#f59e0b' : '#ef4444';

  return (
    <group
      ref={groupRef}
      position={position}
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
        radius={4.2}
      />

      {/* Concrete / Regolith Foundation Base */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[5.4, 0.3, 3.4]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>

      {/* Main Container Shell */}
      <mesh position={[0, 1.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 2.3, 2.8]} />
        <meshStandardMaterial
          color={hovered ? '#e2e8f0' : '#cbd5e1'}
          metalness={0.75}
          roughness={0.25}
        />
      </mesh>

      {/* Roof Heat Rejection Radiators */}
      <group position={[0, 2.65, 0]}>
        <mesh castShadow>
          <boxGeometry args={[4.2, 0.1, 2.2]} />
          <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Radiator cooling fin array */}
        {[-1.5, -0.75, 0, 0.75, 1.5].map((x, i) => (
          <mesh key={i} position={[x, 0.15, 0]}>
            <boxGeometry args={[0.08, 0.2, 2.0]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Front Face: Battery Module Bay Racks */}
      {[-1.4, 0, 1.4].map((xOffset, colIdx) => (
        <group key={colIdx} position={[xOffset, 1.45, 1.41]}>
          {/* Bay Frame */}
          <mesh>
            <boxGeometry args={[1.0, 1.8, 0.05]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Vertical LED Battery SoC Meter Bar */}
          <mesh position={[0.35, 0, 0.04]}>
            <boxGeometry args={[0.08, 1.4, 0.02]} />
            <meshBasicMaterial color={ledColor} />
          </mesh>

          {/* Module Rack Slot Lines */}
          {[-0.6, -0.3, 0, 0.3, 0.6].map((y, slotIdx) => (
            <mesh key={slotIdx} position={[-0.1, y, 0.04]}>
              <boxGeometry args={[0.6, 0.15, 0.02]} />
              <meshStandardMaterial color="#1e293b" metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* High-Voltage Conduit Terminal Junction Box on side */}
      <group position={[2.45, 0.7, 0]}>
        <mesh>
          <boxGeometry args={[0.3, 0.8, 0.8]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.2, -0.4, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  );
};
