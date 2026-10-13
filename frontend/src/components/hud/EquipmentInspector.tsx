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
  PowerOff,
  Sun,
  Battery,
  Droplets,
  RotateCcw,
  Flame,
  Radio,
  Sparkles,
  Lock,
  Unlock,
  Play,
  Pause,
  Compass
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';
import { EquipmentStatus } from '../../types/equipment';

export const EquipmentInspector: React.FC = () => {
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const equipmentList = useHabitatStore((state) => state.equipment);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const focusEquipment = useHabitatStore((state) => state.focusEquipment);
  const setEquipmentStatus = useHabitatStore((state) => state.setEquipmentStatus);

  // Subsystem operational actions
  const setSolarTrackingMode = useHabitatStore((state) => state.setSolarTrackingMode);
  const cleanSolarArrayPanels = useHabitatStore((state) => state.cleanSolarArrayPanels);
  const toggleBatteryReserveLock = useHabitatStore((state) => state.toggleBatteryReserveLock);
  const toggleWaterRecyclingVCD = useHabitatStore((state) => state.toggleWaterRecyclingVCD);
  const toggleSolidWastePyrolysis = useHabitatStore((state) => state.toggleSolidWastePyrolysis);
  const toggleNuclearReactorPower = useHabitatStore((state) => state.toggleNuclearReactorPower);
  const toggleAirlockSeal = useHabitatStore((state) => state.toggleAirlockSeal);
  const runWaterSterilization = useHabitatStore((state) => state.runWaterSterilization);
  const toggleRFCPanel = useHabitatStore((state) => state.toggleRFCPanel);
  const isRFCPanelOpen = useHabitatStore((state) => state.isRFCPanelOpen);
  const rfcState = useHabitatStore((state) => state.rfcState);
  const hudMode = useHabitatStore((state) => state.hudMode);

  const equipment = equipmentList.find((e) => e.id === selectedEquipmentId);

  if (!equipment) return null;

  const statusOptions: Array<{ status: EquipmentStatus; label: string; icon: any; color: string }> = [
    { status: 'nominal', label: 'Nominal', icon: CheckCircle2, color: 'hover:border-emerald-500 hover:text-emerald-400' },
    { status: 'warning', label: 'Warning', icon: AlertTriangle, color: 'hover:border-amber-500 hover:text-amber-400' },
    { status: 'critical', label: 'Critical', icon: AlertOctagon, color: 'hover:border-red-500 hover:text-red-400' },
    { status: 'offline', label: 'Offline', icon: PowerOff, color: 'hover:border-slate-500 hover:text-slate-400' },
  ];

  const isMissionControl = hudMode === 'mission_control';

  return (
    <div
      className={`absolute z-30 w-80 sm:w-96 max-w-[95vw] glass-panel flex flex-col overflow-hidden pointer-events-auto border-cyan-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] animate-fade-in ${
        isMissionControl ? 'top-20 right-3 bottom-20' : 'top-14 right-3 bottom-3'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex items-start justify-between gap-2">
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
            title="Close Inspector (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Subsystem Feedback Banner */}
        {equipment.customState?.lastActionMessage && (
          <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-mono text-cyan-200 flex items-start gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
            <p className="leading-snug">{equipment.customState.lastActionMessage}</p>
          </div>
        )}

        {/* EQUIPMENT-SPECIFIC OPERATIONAL ACTIONS (PHASE 5) */}
        <div className="bg-slate-900/80 rounded border border-cyan-500/30 p-2.5">
          <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1 font-bold">
              <Sliders className="w-3 h-3 text-cyan-400" />
              SUBSYSTEM CONTROL INTERFACE
            </span>
            <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300">ACTIVE</span>
          </div>

          {/* 1. Solar Array Actions */}
          {equipment.type === 'solar_array' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Gimbal Tracking Mode:</div>
              <div className="grid grid-cols-3 gap-1">
                {(['auto', 'manual', 'stow'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSolarTrackingMode(equipment.id, m)}
                    className={`py-1 px-2 rounded text-[10px] font-mono border transition-all ${
                      equipment.customState?.trackingMode === m
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={() => cleanSolarArrayPanels(equipment.id)}
                className="w-full mt-1.5 py-1.5 px-2.5 rounded bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>PULSE DUST REMOVAL (OCCLUSION -1.7%)</span>
              </button>
            </div>
          )}

          {/* 2. Battery Bank Actions & RFC Integration */}
          {equipment.type === 'battery_bank' && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-slate-300">Reserve Protection Protocol:</div>
              <button
                onClick={() => toggleBatteryReserveLock(equipment.id)}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-mono flex items-center justify-center gap-2 border transition-all ${
                  equipment.customState?.reserveLocked
                    ? 'bg-red-500/20 border-red-500 text-red-300 font-bold'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}
              >
                {equipment.customState?.reserveLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-red-400" />
                    <span>EMERGENCY RESERVE LOCKED (LIFE SUPPORT ONLY)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>STANDARD CYCLING (LOCK TO RESERVE)</span>
                  </>
                )}
              </button>

              {/* RFC Subsystem Integration Card */}
              <div className="p-2 rounded bg-slate-950/80 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-cyan-300 font-bold">REGENERATIVE FUEL CELL (RFC)</span>
                  <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-bold text-[9px]">
                    {rfcState.mode.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-300">
                  <div className="p-1 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">H₂ Stored: </span>
                    <span className="text-cyan-300 font-bold">{rfcState.h2StoredKg.toFixed(2)} kg</span>
                  </div>
                  <div className="p-1 rounded bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">O₂ Stored: </span>
                    <span className="text-teal-300 font-bold">{rfcState.o2StoredKg.toFixed(2)} kg</span>
                  </div>
                </div>
                <button
                  onClick={toggleRFCPanel}
                  className="w-full py-1 px-2 rounded bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30 text-cyan-200 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span>{isRFCPanelOpen ? 'HIDE RFC DASHBOARD' : 'OPEN FULL RFC DASHBOARD'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Potable Water Tank Actions */}
          {equipment.type === 'potable_water' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Purity & Reservoir Health:</div>
              <button
                onClick={() => runWaterSterilization(equipment.id)}
                className="w-full py-1.5 px-2.5 rounded bg-cyan-500/20 border border-cyan-400 hover:bg-cyan-500/30 text-cyan-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
              >
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>RUN UV STERILIZATION LOOP (100% PURITY)</span>
              </button>
            </div>
          )}

          {/* 4. Water Recovery VCD Actions */}
          {equipment.type === 'water_recycling' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">VCD Distillation Centrifuge:</div>
              <button
                onClick={() => toggleWaterRecyclingVCD(equipment.id)}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-mono flex items-center justify-center gap-2 border transition-all ${
                  equipment.customState?.vcdActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}
              >
                {equipment.customState?.vcdActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>PAUSE VCD RECOVERY CYCLE (-7.5 kW)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>RESUME VCD RECOVERY (+3.2 L/hr)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 5. Solid Waste Pyrolysis Unit Actions */}
          {equipment.type === 'solid_waste_unit' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Pyrolysis Autoclave Furnace:</div>
              <button
                onClick={() => toggleSolidWastePyrolysis(equipment.id)}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-mono flex items-center justify-center gap-2 border transition-all ${
                  equipment.customState?.pyroActive
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}
              >
                {equipment.customState?.pyroActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>STOP PYROLYSIS HEATING (-11.8 kW)</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>START BATCH PYROLYSIS (380°C)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 6. Nuclear Kilopower Actions */}
          {equipment.type === 'nuclear_power' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Kilopower 40 kWe Baseload:</div>
              <button
                onClick={() => toggleNuclearReactorPower(equipment.id)}
                className={`w-full py-1.5 px-2.5 rounded text-xs font-mono flex items-center justify-center gap-2 border transition-all ${
                  equipment.customState?.nuclearOnline
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                }`}
              >
                {equipment.customState?.nuclearOnline ? (
                  <>
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>SCRAM / STANDBY REACTOR (0 kW BASELOAD)</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SYNCHRONIZE STIRLING LOOP (+40 kW BASELOAD)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 7. Command & Crew Habitat Actions */}
          {equipment.type === 'main_habitat' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Crew Cabin ECLSS Status:</div>
              <button
                onClick={() => toggleAirlockSeal(equipment.id)}
                className="w-full py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono flex items-center justify-center gap-2 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {equipment.customState?.airlockSealed
                    ? 'CYCLE AIRLOCK HATCH'
                    : 'SEAL AIRLOCK INNER HATCH'}
                </span>
              </button>
            </div>
          )}

          {/* 8. Lander & Rover Actions */}
          {equipment.type === 'lunar_lander' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Descent Stage Interface:</div>
              <div className="py-1 px-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400">
                Berth 1 Secure • LOX/Methane Sealed • Transponder 437.2 MHz Nominal
              </div>
            </div>
          )}

          {equipment.type === 'lunar_rover' && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-300">Robotic Rover Diagnostics:</div>
              <div className="py-1 px-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300">
                Lidar Nav Active • Traverse Range 40 km • Arm Drill Calibrated
              </div>
            </div>
          )}
        </div>

        {/* Status Switcher & Demo Control */}
        <div className="bg-slate-900/70 rounded border border-slate-800 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              OPERATIONAL HEALTH STATE
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
            <span className="text-cyan-400 text-[9px]">ENGINEERING BUS</span>
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
