import React from 'react';
import { Eye, Compass } from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';

export const EquipmentFleetBar: React.FC = () => {
  const equipmentList = useHabitatStore((state) => state.equipment);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const focusEquipment = useHabitatStore((state) => state.focusEquipment);
  const resetCameraTarget = useHabitatStore((state) => state.resetCameraTarget);

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'nominal':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
      case 'warning':
        return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
      case 'critical':
        return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-ping';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex items-center justify-between gap-3">
      {/* Fleet quick strip */}
      <div className="glass-panel p-1.5 flex items-center gap-1.5 overflow-x-auto max-w-full pointer-events-auto">
        <div className="px-2 py-1 text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1 shrink-0 border-r border-slate-800">
          <Eye className="w-3 h-3 text-cyan-400" />
          <span className="hidden sm:inline">EQUIPMENT FLEET</span>
        </div>

        {equipmentList.map((item) => {
          const isSelected = selectedEquipmentId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                selectEquipment(item.id);
                focusEquipment(item.id);
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono transition-all shrink-0 border ${
                isSelected
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDot(item.status)}`} />
              <span className="font-semibold">{item.code}</span>
              <span className="text-[10px] text-slate-400 hidden md:inline">
                {item.powerKW > 0 ? `+${item.powerKW}` : item.powerKW}kW
              </span>
            </button>
          );
        })}
      </div>

      {/* Reset Camera button */}
      <button
        onClick={resetCameraTarget}
        className="hud-btn pointer-events-auto shrink-0 hidden lg:inline-flex"
        title="Reset Orbit Camera to Habitat Center"
      >
        <Compass className="w-3.5 h-3.5 text-cyan-400" />
        <span>RESET CAMERA</span>
      </button>
    </div>
  );
};
