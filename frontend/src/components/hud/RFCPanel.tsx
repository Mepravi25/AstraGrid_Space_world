import React from 'react';
import {
  Zap,
  Flame,
  Droplets,
  Activity,
  Layers,
  Power,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ListFilter,
  Trash2,
  X
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';

const RFCPanelContent: React.FC = () => {
  const rfcState = useHabitatStore((state) => state.rfcState);
  const rfcConfig = useHabitatStore((state) => state.rfcConfig);
  const rfcModeOverride = useHabitatStore((state) => state.rfcModeOverride);
  const activeRFCTab = useHabitatStore((state) => state.activeRFCTab);
  const telemetry = useHabitatStore((state) => state.telemetry);
  const eventLog = useHabitatStore((state) => state.eventLog);

  const toggleRFCPanel = useHabitatStore((state) => state.toggleRFCPanel);
  const setActiveRFCTab = useHabitatStore((state) => state.setActiveRFCTab);
  const setRFCEnabled = useHabitatStore((state) => state.setRFCEnabled);
  const setRFCModeOverride = useHabitatStore((state) => state.setRFCModeOverride);
  const clearEventLog = useHabitatStore((state) => state.clearEventLog);

  // Derive surplus solar relative to essential & nominal load
  const surplusSolarKW = Math.max(0, telemetry.solarGenerationKW - (telemetry.essentialDemandKW ?? 40.1));

  // Status badge styling
  const getModeBadge = () => {
    switch (rfcState.mode) {
      case 'electrolyzing':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/60 text-blue-400 font-mono text-[10px] font-bold animate-pulse">
            <Zap className="w-3 h-3" />
            ELECTROLYZING (CHARGING)
          </span>
        );
      case 'generating':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-400 font-mono text-[10px] font-bold animate-pulse">
            <Flame className="w-3 h-3 text-emerald-400" />
            GENERATING (DISCHARGING)
          </span>
        );
      case 'idle':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
            <Activity className="w-3 h-3 text-cyan-400" />
            STANDBY / IDLE
          </span>
        );
      case 'unavailable':
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 border border-red-500/50 text-red-400 font-mono text-[10px] font-bold">
            <Power className="w-3 h-3" />
            OFFLINE / DISABLED
          </span>
        );
    }
  };

  const getResilienceBadge = () => {
    const state = telemetry.energyManagementState ?? 'NORMAL';
    switch (state) {
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 font-mono text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3" />
            NORMAL SOLAR
          </span>
        );
      case 'SOLAR_SHORTAGE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-amber-400 font-mono text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            SOLAR SHORTAGE
          </span>
        );
      case 'BATTERY_SUPPORT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/70 border border-blue-500/50 text-blue-400 font-mono text-[10px] font-bold animate-pulse">
            <Zap className="w-3 h-3" />
            BATTERY SUPPORT
          </span>
        );
      case 'RFC_SUPPORT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold animate-pulse">
            <Flame className="w-3 h-3" />
            RFC SUPPORT
          </span>
        );
      case 'ENERGY_CONSERVATION':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/50 text-purple-300 font-mono text-[10px] font-bold">
            <Layers className="w-3 h-3" />
            ENERGY CONSERVATION
          </span>
        );
      case 'CRITICAL_POWER_SHORTAGE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/80 border border-red-500 text-red-300 font-mono text-[10px] font-bold animate-ping">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            CRITICAL POWER SHORTAGE
          </span>
        );
      case 'RECOVERY':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-teal-950/70 border border-teal-500/50 text-teal-300 font-mono text-[10px] font-bold">
            <RotateCcw className="w-3 h-3" />
            SOLAR RECOVERY
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="absolute top-20 right-3 bottom-20 z-40 w-96 max-w-[95vw] glass-panel flex flex-col overflow-hidden pointer-events-auto border-cyan-500/40 shadow-[0_16px_50px_rgba(0,0,0,0.85)] animate-fade-in">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-2 shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-400 font-bold">
              ASTRA-ENERGY-01
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              RESILIENCE & RFC
            </span>
          </div>
          <h2 className="font-hud text-sm font-bold text-slate-100 mt-1 leading-snug">
            Energy Management Subsystem
          </h2>
        </div>

        <button
          onClick={toggleRFCPanel}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Close Energy Resilience Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/80 shrink-0">
        <button
          onClick={() => setActiveRFCTab('rfc')}
          className={`flex-1 py-2 text-[10px] font-hud font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeRFCTab === 'rfc'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          RFC Simulation
        </button>
        <button
          onClick={() => setActiveRFCTab('events')}
          className={`flex-1 py-2 text-[10px] font-hud font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeRFCTab === 'events'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Event Log ({eventLog.length})
        </button>
        <button
          onClick={() => setActiveRFCTab('water_planned')}
          className={`flex-1 py-2 text-[10px] font-hud font-bold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeRFCTab === 'water_planned'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Water — Planned
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs">
        {activeRFCTab === 'rfc' && (
          <>
            {/* Energy Resilience Operating State Banner */}
            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">Dispatch Resilience State:</span>
                {getResilienceBadge()}
              </div>

              {/* Deficit / Shortage telemetry if applicable */}
              {(telemetry.unmetEssentialLoadKW ?? 0) > 0.001 ? (
                <div className="p-2 rounded bg-red-950/50 border border-red-500/60 text-[10px] font-mono text-red-300 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>CRITICAL ESSENTIAL DEFICIT:</span>
                    <span>{(telemetry.unmetEssentialLoadKW ?? 0).toFixed(1)} kW</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Shortage Duration:</span>
                    <span>{(telemetry.shortageDurationHours ?? 0).toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Cumulative Unmet Energy:</span>
                    <span>{(telemetry.cumulativeUnmetEssentialKWh ?? 0).toFixed(1)} kWh</span>
                  </div>
                </div>
              ) : (telemetry.flexibleLoadsDeferredKW ?? 0) > 0 ? (
                <div className="p-1.5 rounded bg-purple-950/40 border border-purple-500/40 text-[10px] font-mono text-purple-300 flex justify-between">
                  <span>Flexible Loads Deferred:</span>
                  <span className="font-bold">{(telemetry.flexibleLoadsDeferredKW ?? 0).toFixed(1)} kW</span>
                </div>
              ) : null}
            </div>

            {/* Operating Mode and Master Control */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[11px]">RFC Operating Mode:</span>
                {getModeBadge()}
              </div>

              {/* Master Enabled Switch */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-300 font-mono text-[11px]">Subsystem Active:</span>
                <button
                  onClick={() => setRFCEnabled(!rfcState.isEnabled)}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                    rfcState.isEnabled
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-red-500/20 border-red-500 text-red-300'
                  }`}
                >
                  {rfcState.isEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Mode Target Override */}
              <div className="pt-1.5 border-t border-slate-800/60 space-y-1">
                <div className="text-[10px] font-mono text-slate-400">Dispatch Policy Override:</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['auto', 'electrolyzing', 'generating', 'idle'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setRFCModeOverride(mode)}
                      className={`py-1 text-[9px] font-mono rounded border transition-all cursor-pointer ${
                        rfcModeOverride === mode
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generation & Power Demand Distribution */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-300">
                <span>HABITAT POWER TRANSFERS</span>
                <span className="text-slate-500">kW</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Solar Gen:</span>
                  <span className="text-amber-300 font-bold">{telemetry.solarGenerationKW.toFixed(1)} kW</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Nuclear Baseload:</span>
                  <span className="text-cyan-300 font-bold">{telemetry.nuclearGenerationKW.toFixed(1)} kW</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Essential Demand:</span>
                  <span className="text-emerald-300 font-bold">{(telemetry.essentialDemandKW ?? 40.1).toFixed(1)} kW</span>
                </div>
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                  <span className="text-slate-400">Flexible Demand:</span>
                  <span className="text-slate-200 font-bold">{(telemetry.flexibleDemandKW ?? 0.0).toFixed(1)} kW</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-slate-800">
                {/* Surplus Solar Available */}
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">SOLAR SURPLUS</div>
                  <div className="text-xs font-hud font-bold text-amber-300 mt-0.5">
                    {surplusSolarKW.toFixed(1)} kW
                  </div>
                </div>

                {/* Electrolyzer Input */}
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">ELECTROLYZER</div>
                  <div className="text-xs font-hud font-bold text-blue-400 mt-0.5">
                    {`${(rfcState.currentElectricalInputKW ?? 0).toFixed(1)} kW`}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">max {rfcConfig.electrolyzerRatedPowerKW} kW</div>
                </div>

                {/* Fuel Cell Output */}
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">FUEL CELL</div>
                  <div className="text-xs font-hud font-bold text-emerald-400 mt-0.5">
                    {`${(rfcState.currentElectricalOutputKW ?? 0).toFixed(1)} kW`}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">max {rfcConfig.fuelCellRatedPowerKW} kW</div>
                </div>
              </div>
            </div>

            {/* Battery SoC & Safe Discharge Reserve */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-300">
                <span>BATTERY STORAGE & SAFETY RESERVE</span>
                <span className="text-[10px] text-slate-400">Floor: 20.0%</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-300">BESS State of Charge:</span>
                  <span className={`font-bold ${telemetry.batterySocPct <= 20 ? 'text-red-400' : telemetry.batterySocPct <= 25 ? 'text-amber-400' : 'text-cyan-300'}`}>
                    {telemetry.batterySocPct.toFixed(1)}% ({telemetry.batteryStoredKWh.toFixed(1)} kWh)
                  </span>
                </div>
                <div className="w-full h-2 rounded bg-slate-950 overflow-hidden border border-slate-800 relative">
                  {/* 20% Reserve threshold marker */}
                  <div className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-red-500 z-10" title="20% Hard Reserve Floor" />
                  <div
                    className={`h-full transition-all duration-300 ${
                      telemetry.batterySocPct <= 20
                        ? 'bg-red-500'
                        : telemetry.batterySocPct <= 25
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, telemetry.batterySocPct))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>Safe Available Energy: {Math.max(0, telemetry.batteryStoredKWh - 100).toFixed(1)} kWh</span>
                  <span>Max Discharge: 100 kW</span>
                </div>
              </div>
            </div>

            {/* Reactant Gas Inventories */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-300">
                <span>GAS REACTANT INVENTORIES</span>
                <span className="text-[10px] text-cyan-400">
                  {rfcState.limitingReactant !== 'none'
                    ? `Limiting: ${rfcState.limitingReactant.toUpperCase()}`
                    : 'Balanced'}
                </span>
              </div>

              {/* Hydrogen (H2) Tank */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-cyan-300 font-bold">HYDROGEN (H₂)</span>
                  <span className="text-slate-300">
                    {rfcState.h2StoredKg.toFixed(2)} / {rfcConfig.h2CapacityKg.toFixed(1)} kg ({rfcState.h2FillPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, rfcState.h2FillPct))}%` }}
                  />
                </div>
              </div>

              {/* Oxygen (O2) Tank */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-teal-300 font-bold">OXYGEN (O₂)</span>
                  <span className="text-slate-300">
                    {rfcState.o2StoredKg.toFixed(2)} / {rfcConfig.o2CapacityKg.toFixed(1)} kg ({rfcState.o2FillPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, rfcState.o2FillPct))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Stored Energy Metrics */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="text-[11px] font-mono font-semibold text-slate-300">
                STORED CHEMICAL & USABLE ELECTRICITY
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">CHEMICAL ENERGY (LHV)</div>
                  <div className="text-sm font-hud font-bold text-cyan-300 mt-0.5">
                    {rfcState.storedChemicalEnergyKWh.toFixed(1)} <span className="text-[10px] font-mono text-slate-400">kWh</span>
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">33.33 kWh/kg H₂ basis</div>
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">EST. DELIVERABLE POWER</div>
                  <div className="text-sm font-hud font-bold text-emerald-300 mt-0.5">
                    {rfcState.usableElectricalEnergyKWh.toFixed(1)} <span className="text-[10px] font-mono text-slate-400">kWh</span>
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">at {(rfcConfig.fuelCellEfficiency * 100).toFixed(0)}% FC efficiency</div>
                </div>
              </div>
            </div>

            {/* Water Interface Telemetry */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-slate-300">
                <span>WATER FEEDSTOCK & RECOVERY</span>
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">CONSUMED (ELY)</div>
                  <div className="text-xs font-hud font-bold text-blue-300 mt-0.5">
                    {rfcState.cumulativeWaterConsumedL.toFixed(1)} L
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">8.94 L/kg H₂</div>
                </div>

                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">PRODUCED (FC)</div>
                  <div className="text-xs font-hud font-bold text-teal-300 mt-0.5">
                    {rfcState.cumulativeWaterProducedL.toFixed(1)} L
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">reaction fluid</div>
                </div>

                <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400">RECOVERED</div>
                  <div className="text-xs font-hud font-bold text-emerald-300 mt-0.5">
                    {rfcState.cumulativeWaterRecoveredL.toFixed(1)} L
                  </div>
                  <div className="text-[8px] font-mono text-slate-500">98% recovery</div>
                </div>
              </div>
              <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-[9px] font-mono text-amber-300/80 flex items-center gap-1.5">
                <Info className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Product water is process fluid; non-potable pending downstream treatment.</span>
              </div>
            </div>

            {/* Performance, Losses & Operating Telemetry */}
            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1.5 text-[10px] font-mono text-slate-300">
              <div className="text-[11px] font-semibold text-slate-200">LIFETIME OPERATING METRICS</div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Cumulative Charged:</span>
                <span className="text-blue-300 font-bold">{rfcState.cumulativeEnergyChargedKWh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Cumulative Discharged:</span>
                <span className="text-emerald-300 font-bold">{rfcState.cumulativeEnergyDischargedKWh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Thermal Conversion Losses:</span>
                <span className="text-amber-300 font-bold">{rfcState.cumulativeLossesKWh.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-800">
                <span className="text-slate-400">Operating Hours:</span>
                <span>{rfcState.operatingHours.toFixed(1)} h</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Current Limiting Factor:</span>
                <span className="text-cyan-300 font-bold truncate max-w-[180px]">
                  {rfcState.limitingReactant !== 'none'
                    ? `Reactant limit (${rfcState.limitingReactant})`
                    : 'Nominal'}
                </span>
              </div>
            </div>
          </>
        )}

        {activeRFCTab === 'events' && (
          /* Tab 2: Event Log */
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Microgrid Transition Events
              </span>
              <button
                onClick={clearEventLog}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Clear Event Log"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>

            {eventLog.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 text-center text-slate-500 font-mono text-[11px]">
                No transition events recorded yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {eventLog.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-2 rounded border text-[10px] font-mono space-y-0.5 transition-all ${
                      evt.severity === 'critical'
                        ? 'bg-red-950/40 border-red-500/50 text-red-200'
                        : evt.severity === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                        : evt.severity === 'success'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate">{evt.title}</span>
                      <span className="text-[9px] text-slate-400 shrink-0">{evt.timestampStr}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 leading-relaxed">{evt.details}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeRFCTab === 'water_planned' && (
          /* Tab 3: Water Management — Planned Placeholder */
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span className="font-hud text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  Water Management — Planned (Phase 4)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Comprehensive closed-loop water allocation, VCD optimization, microbiological quality
                monitoring, catalytic post-treatment, and dynamic crew demand arbitration will be implemented in a future phase.
              </p>
              <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-cyan-200">
                Status: Architecture reserved in <code className="text-cyan-300">src/simulation/waterManagement.ts</code>.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="text-[11px] font-mono font-semibold text-slate-200 uppercase">
                Subsystem Scope Roadmap
              </div>
              <div className="space-y-1.5 text-[10px] font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>RFC Electrolyzer Feedstock Interface (Active)</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fuel Cell Water Recovery Record (Active)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Multi-Tier Potable Water Purity Certification (Planned)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Process Water / Graywater Multi-Buffer Tracking (Planned)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dynamic Crew Metabolic Water Demand Arbitration (Planned)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Catalytic Post-Treatment & Mineralization Loop (Planned)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Predictive 24-Hour Lookahead Fluid Optimization (Planned)</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-900/50 border border-slate-800 text-[10px] font-mono text-slate-400 leading-relaxed">
              * Note: Fuel cell product water is strictly categorized as uncertified process water in this release, preventing premature assumption of drinkable purity prior to downstream validation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const RFCPanel: React.FC = () => {
  const isRFCPanelOpen = useHabitatStore((state) => state.isRFCPanelOpen);
  if (!isRFCPanelOpen) return null;
  return <RFCPanelContent />;
};
