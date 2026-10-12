import React from 'react';
import {
  X,
  Target,
  Zap,
  Thermometer,
  Percent,
  HeartPulse,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  PowerOff
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';
import { EquipmentStatus } from '../../types/equipment';

export const EquipmentInspector: React.FC = () => {
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const equipmentList = useHabitatStore((state) => state.equipment);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const focusEquipment = useHabitatStore((state) => state.focusEquipment);
  const setEquipmentStatus = useHabitatStore((state) => state.setEquipmentStatus);

  const equipment = equipmentList.find((e) => e.id === selectedEquipmentId);

  if (!equipment) return null;

  const statusOptions: Array<{ status: EquipmentStatus; label: string; icon: any; color: string }> = [
    { status: 'nominal', label: 'Nominal', icon: CheckCircle2, color: 'hover:border-emerald-500 hover:text-emerald-400' },
    { status: 'warning', label: 'Warning', icon: AlertTriangle, color: 'hover:border-amber-500 hover:text-amber-400' },
    { status: 'critical', label: 'Critical', icon: AlertOctagon, color: 'hover:border-red-500 hover:text-red-400' },
    { status: 'offline', label: 'Offline', icon: PowerOff, color: 'hover:border-slate-500 hover:text-slate-400' },
  ];

  return (
    <div className="absolute top-20 right-3 bottom-20 z-20 w-80 sm:w-96 glass-panel flex flex-col overflow-hidden pointer-events-auto border-cyan-500/30">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-400 font-bold">
              {equipment.code}
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              {equipment.category.replace('_', ' ')}
            </span>
          </div>
          <h2 className="font-hud text-sm font-bold text-slate-100 mt-1 leading-snug">
            {equipment.name}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => focusEquipment(equipment.id)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Focus Camera in 3D"
          >
            <Target className="w-4 h-4" />
          </button>
          <button
            onClick={() => selectEquipment(null)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Status Switcher & Demo Control */}
        <div className="bg-slate-900/70 rounded border border-slate-800 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              OPERATIONAL STATE (DEMO)
            </span>
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                equipment.status === 'nominal'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : equipment.status === 'warning'
                  ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                  : equipment.status === 'critical'
                  ? 'bg-red-950 text-red-400 border border-red-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-600'
              }`}
            >
              {equipment.status}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {statusOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = equipment.status === opt.status;
              return (
                <button
                  key={opt.status}
                  onClick={() => setEquipmentStatus(equipment.id, opt.status)}
                  className={`flex flex-col items-center justify-center p-1.5 rounded border text-[10px] font-mono transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : `bg-slate-950/60 border-slate-800 text-slate-400 ${opt.color}`
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 mb-0.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Subsystem Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Power Flow */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>POWER FLOW</span>
            </div>
            <div className="font-hud text-base font-bold text-slate-100 mt-1">
              {equipment.powerKW > 0 ? `+${equipment.powerKW}` : equipment.powerKW}{' '}
              <span className="text-[10px] font-mono text-slate-400">kW</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500">
              Rating: {equipment.maxPowerKW} kW max
            </span>
          </div>

          {/* Temperature */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Thermometer className="w-3 h-3 text-amber-400" />
              <span>THERMAL STATE</span>
            </div>
            <div className="font-hud text-base font-bold text-amber-200 mt-1">
              {equipment.temperatureK} <span className="text-[10px] font-mono text-slate-400">K</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500">
              {(equipment.temperatureK - 273.15).toFixed(1)} °C
            </span>
          </div>

          {/* Operating Efficiency */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Percent className="w-3 h-3 text-emerald-400" />
              <span>EFFICIENCY</span>
            </div>
            <div className="font-hud text-base font-bold text-emerald-300 mt-1">
              {equipment.efficiencyPct}%
            </div>
            <span className="text-[9px] font-mono text-slate-500">Nominal design</span>
          </div>

          {/* Hardware Health */}
          <div className="bg-slate-900/60 border border-slate-800 rounded p-2 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <HeartPulse className="w-3 h-3 text-sky-400" />
              <span>INTEGRITY</span>
            </div>
            <div className="font-hud text-base font-bold text-sky-300 mt-1">
              {equipment.healthPct}%
            </div>
            <span className="text-[9px] font-mono text-slate-500">Sensor validation</span>
          </div>
        </div>

        {/* Subsystem Telemetry Parameters Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>LIVE TELEMETRY STREAM</span>
            <span className="text-cyan-400 text-[9px]">DEMO READY</span>
          </div>

          <div className="space-y-1.5">
            {Object.entries(equipment.metrics).map(([key, metric]) => (
              <div
                key={key}
                className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-950/40 border border-slate-800/60 text-xs font-mono"
              >
                <span className="text-slate-400 text-[11px]">{metric.label}</span>
                <span className="font-semibold text-slate-200">
                  {metric.value} {metric.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Function & Engineering Description */}
        <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <Info className="w-3 h-3 text-cyan-400" />
            <span>SUBSYSTEM FUNCTION</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {equipment.functionSummary}
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-1.5">
            {equipment.description}
          </p>
        </div>
      </div>
    </div>
  );
};
