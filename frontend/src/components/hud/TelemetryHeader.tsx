import React from 'react';
import {
  Sun,
  Zap,
  Battery,
  Droplets,
  Activity,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Radio,
  Clock,
  X
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';

export const TelemetryHeader: React.FC = () => {
  const telemetry = useHabitatStore((state) => state.telemetry);
  const setHudMode = useHabitatStore((state) => state.setHudMode);

  const getStatusBadge = () => {
    switch (telemetry.overallStatus) {
      case 'nominal':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 font-mono text-xs font-semibold tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
            <span>SYS NOMINAL</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-950/80 border border-amber-500/60 text-amber-400 font-mono text-xs font-semibold tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 animate-bounce" />
            <span>CAUTION ALERT</span>
          </div>
        );
      case 'critical':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-950/90 border border-red-500 text-red-400 font-mono text-xs font-semibold tracking-wider animate-pulse">
            <ShieldX className="w-3.5 h-3.5" />
            <span>CRITICAL FAULT</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-950/80 border border-blue-500/50 text-blue-400 font-mono text-xs font-semibold">
            <Radio className="w-3.5 h-3.5" />
            <span>STANDBY</span>
          </div>
        );
    }
  };

  return (
    <header className="absolute top-3 left-3 right-3 z-20 pointer-events-none">
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 glass-panel pointer-events-auto">
        {/* Brand & Mission Elapsed Time */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <div className="flex flex-col">
              <span className="font-hud text-sm font-black tracking-widest text-cyan-400">
                HABITAT<span className="text-white">OS</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                LUNAR MISSION CONTROL • BASE ALPHA
              </span>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-slate-700/60 hidden sm:block" />

          {/* Clock */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-700/50 font-mono text-xs text-slate-200">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tracking-wide font-semibold">{telemetry.missionTimeStr}</span>
          </div>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Solar Generation */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800">
            <Sun className="w-4 h-4 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-400 leading-tight">SOLAR GEN</span>
              <span className="font-hud text-xs font-bold text-amber-300">
                {telemetry.solarGenerationKW} <span className="text-[10px] font-mono text-slate-400">kW</span>
              </span>
            </div>
          </div>

          {/* Total Demand */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800">
            <Zap className="w-4 h-4 text-sky-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-400 leading-tight">GRID DEMAND</span>
              <span className="font-hud text-xs font-bold text-sky-300">
                {telemetry.totalDemandKW} <span className="text-[10px] font-mono text-slate-400">kW</span>
              </span>
            </div>
          </div>

          {/* Battery State of Charge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 min-w-[125px]">
            <Battery
              className={`w-4 h-4 ${
                telemetry.batterySocPct > 50
                  ? 'text-emerald-400'
                  : telemetry.batterySocPct > 25
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            />
            <div className="flex flex-col flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-slate-400 leading-tight">BESS SoC</span>
                <span className="font-hud text-xs font-bold text-slate-100">
                  {telemetry.batterySocPct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className={`h-full transition-all duration-300 ${
                    telemetry.batterySocPct > 50
                      ? 'bg-emerald-400'
                      : telemetry.batterySocPct > 25
                      ? 'bg-amber-400'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${telemetry.batterySocPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Water Inventory */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800 min-w-[125px]">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono text-slate-400 leading-tight">H2O STOCK</span>
                <span className="font-hud text-xs font-bold text-cyan-300">
                  {telemetry.potableWaterLiters} <span className="text-[9px] font-mono text-slate-400">L</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${telemetry.waterReservePct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Equipment */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/60 border border-slate-800">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-400 leading-tight">ONLINE UNITS</span>
              <span className="font-hud text-xs font-bold text-emerald-300">
                {telemetry.activeEquipmentCount} / {telemetry.totalEquipmentCount}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          {getStatusBadge()}

          {/* Close Mission Control Dashboard */}
          <button
            onClick={() => setHudMode('explore')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/60 ml-1"
            title="Return to Moon Exploration View (Esc/Tab)"
          >
            <X className="w-4 h-4 text-cyan-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
