import React from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useHabitatStore } from '../../store/useHabitatStore';
import { getLunarHeight } from '../../utils/terrainMath';

export interface EquipmentLabelDef {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly isVirtual?: boolean;
  readonly defaultPos: [number, number, number];
  readonly yOffset: number;
}

export const EQUIPMENT_LABEL_CONFIGS: EquipmentLabelDef[] = [
  {
    id: 'solar-array-alpha',
    code: 'PV-TRK-01',
    label: 'SOLAR ARRAY',
    defaultPos: [-65, 0, -55],
    yOffset: 8.5,
  },
  {
    id: 'main-habitat-core',
    code: 'HAB-CORE-ALPHA',
    label: 'LUNAR HABITAT',
    defaultPos: [0, 0, 0],
    yOffset: 6.8,
  },
  {
    id: 'battery-bank-bess',
    code: 'BESS-LUNAR-01',
    label: 'BATTERY',
    defaultPos: [-32, 0, 22],
    yOffset: 4.2,
  },
  {
    id: 'potable-water-tank',
    code: 'H2O-TANK-SYS',
    label: 'WATER STORAGE',
    defaultPos: [28, 0, -24],
    yOffset: 5.2,
  },
  {
    id: 'water-recycling-vcd',
    code: 'ECLSS-VCD-01',
    label: 'LIFE SUPPORT',
    defaultPos: [38, 0, 10],
    yOffset: 4.5,
  },
  {
    id: 'oxygen-gen-eclss',
    code: 'O2-SPE-GEN',
    label: 'OXYGEN GENERATOR',
    defaultPos: [18, 0, 32],
    yOffset: 4.8,
  },
  {
    id: 'rfc-power-unit',
    code: 'RFC-SYS-01',
    label: 'RFC POWER',
    defaultPos: [-16, 0, 10],
    yOffset: 4.0,
  },
];

interface SingleLabelProps {
  def: EquipmentLabelDef;
}

const SingleEquipmentLabel: React.FC<SingleLabelProps> = ({ def }) => {
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const toggleRFCPanel = useHabitatStore((state) => state.toggleRFCPanel);
  const isRFCPanelOpen = useHabitatStore((state) => state.isRFCPanelOpen);

  // Equipment data for real items
  const equipment = useHabitatStore((state) =>
    state.equipment.find((e) => e.id === def.id)
  );

  const isSelected =
    selectedEquipmentId === def.id ||
    (isRFCPanelOpen && (def.id === 'rfc-power-unit' || def.id === 'rfc-virtual-unit'));

  // Compute 3D position anchored above terrain
  const rawPos = equipment?.position || def.defaultPos;
  const groundY = getLunarHeight(rawPos[0], rawPos[2]);
  const anchorY = groundY + def.yOffset;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (def.isVirtual || def.id === 'rfc-power-unit' || def.id === 'rfc-virtual-unit') {
      toggleRFCPanel();
    } else {
      selectEquipment(def.id);
    }
  };

  return (
    <group position={[rawPos[0], anchorY, rawPos[2]]}>
      <Html
        center
        pointerEvents="auto"
        zIndexRange={[40, 0]}
        style={{ pointerEvents: 'auto' }}
      >
        <button
          type="button"
          onClick={handleClick}
          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold tracking-wider uppercase transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
            isSelected
              ? 'bg-slate-900/90 text-cyan-300 ring-1 ring-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.45)] scale-105'
              : 'bg-black/60 text-slate-100 border border-white/10 hover:bg-black/80 hover:text-white hover:border-cyan-400/50 hover:scale-105 shadow-sm'
          }`}
          style={{
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)',
          }}
          title={
            def.id === 'rfc-power-unit' || def.isVirtual
              ? 'RFC Power — Click to open RFC Panel'
              : `Inspect ${def.label}`
          }
        >
          {def.label}
        </button>
      </Html>
    </group>
  );
};

/**
 * Floating Resource Labels Manager in 3D Lunar Scene.
 * Anchors compact, readable Google Maps-style screen-space labels above equipment.
 */
export const FloatingResourceLabels: React.FC = () => {
  const showResourceLabels = useHabitatStore((state) => state.showResourceLabels);

  if (!showResourceLabels) {
    return null;
  }

  return (
    <group>
      {/* Floating 3D Equipment Labels */}
      {EQUIPMENT_LABEL_CONFIGS.map((def) => (
        <SingleEquipmentLabel key={def.id} def={def} />
      ))}
    </group>
  );
};
