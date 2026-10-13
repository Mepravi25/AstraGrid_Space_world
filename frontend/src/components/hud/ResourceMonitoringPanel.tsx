import React from 'react';
import {
  Sun,
  Battery,
  BatteryCharging,
  Zap,
  Flame,
  Droplets,
  Activity,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Radio,
  X,
  Gauge,
  Layers,
  Power,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';
import { estimateEnergyForecast } from '../../simulation/energyForecast';

const ResourceMonitoringContent: React.FC = () => {
  const telemetry = useHabitatStore((state) => state.telemetry);
  const rfcState = useHabitatStore((state) => state.rfcState);
  const currentScenarioId = useHabitatStore((state) => state.currentScenarioId);
  const toggleResourceMonitoring = useHabitatStore((state) => state.toggleResourceMonitoring);

  // 1. SOLAR POWER CALCULATIONS
  const solarGenKW = telemetry.solarGenerationKW;
  const habitatDemandKW = telemetry.totalDemandKW;
  const solarContributionPct = habitatDemandKW > 0
    ? ((solarGenKW / habitatDemandKW) * 100).toFixed(1)
    : '100.0';
  const solarNetDiffKW = solarGenKW - habitatDemandKW;

  // 2. BATTERY CALCULATIONS
  const batterySoc = telemetry.batterySocPct;
  const batteryStoredKWh = telemetry.batteryStoredKWh;
  const batteryCapacityKWh = telemetry.batteryCapacityKWh;
  const minReservePct = telemetry.batteryMinReservePct ?? 20.0;
  const minReserveKWh = telemetry.batteryMinReserveKWh ?? (batteryCapacityKWh * (minReservePct / 100));
  const netPowerKW = telemetry.netPowerKW;

  const getBatteryStatusInfo = () => {
    if (batterySoc <= minReservePct && netPowerKW < 0) {
      return {
        label: 'DISCHARGE HALTED (RESERVE)',
        desc: 'Holding 20% floor for life-support',
        badgeColor: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
        icon: ShieldAlert,
      };
    }
    if (batteryStoredKWh >= batteryCapacityKWh - 0.5 && netPowerKW > 0) {
      return {
        label: 'FLOAT / FULLY CHARGED',
        desc: 'At maximum storage capacity',
        badgeColor: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
        icon: Battery,
      };
    }
    if (netPowerKW > 0.05) {
      return {
        label: `CHARGING (+${netPowerKW.toFixed(1)} kW)`,
        desc: 'Absorbing surplus generation',
        badgeColor: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
        icon: BatteryCharging,
      };
    }
    if (netPowerKW < -0.05) {
      return {
        label: `DISCHARGING (${netPowerKW.toFixed(1)} kW)`,
        desc: 'Supplying microgrid deficit',
        badgeColor: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
        icon: Battery,
      };
    }
    return {
      label: 'STANDBY / IDLE (0.0 kW)',
      desc: 'Balanced grid flow',
      badgeColor: 'bg-slate-900 border-slate-700 text-slate-300',
      icon: Battery,
    };
  };

  const batteryInfo = getBatteryStatusInfo();
  const BatteryStatusIcon = batteryInfo.icon;

  // 3. RFC ALTERNATIVE POWER
  const rfcEnabled = rfcState.isEnabled;
  const rfcMode = rfcState.mode;
  const fuelCellOutputKW = rfcMode === 'generating'
    ? (rfcState.currentElectricalOutputKW ?? 0)
    : 0;

  const getRFCModeBadge = () => {
    switch (rfcMode) {
      case 'electrolyzing':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/60 text-blue-300 font-mono text-[10px] font-bold">
            <Zap className="w-3 h-3 text-blue-400 animate-pulse" />
            ELECTROLYZING
          </span>
        );
      case 'generating':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono text-[10px] font-bold">
            <Flame className="w-3 h-3 text-emerald-400 animate-pulse" />
            GENERATING
          </span>
        );
      case 'idle':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold">
            <Activity className="w-3 h-3 text-cyan-400" />
            STANDBY
          </span>
        );
      case 'unavailable':
      default:
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/60 border border-red-500/50 text-red-300 font-mono text-[10px] font-bold">
            <Power className="w-3 h-3 text-red-400" />
            DISABLED
          </span>
        );
    }
  };

  // 4. WATER DATA
  const potableWaterLiters = telemetry.potableWaterLiters;
  const potableCapacityL = telemetry.potableWaterCapacityL;
  const waterReservePct = telemetry.waterReservePct;
  const dailyConsumptionRateL = telemetry.waterDailyConsumptionL;
  const rfcCumulativeWaterConsumedL = rfcState.cumulativeWaterConsumedL;
  const rfcCumulativeWaterProducedL = rfcState.cumulativeWaterProducedL;

  // 5. POWER STATUS
  const totalGenKW = telemetry.totalGenerationKW;
  const essentialDemandKW = telemetry.essentialDemandKW ?? 40.1;
  const unmetEssentialKW = telemetry.unmetEssentialLoadKW ?? 0;
  const energyMgmtState = telemetry.energyManagementState ?? 'NORMAL';

  const getEnergyMgmtBadge = () => {
    switch (energyMgmtState) {
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            NORMAL
          </span>
        );
      case 'SOLAR_SHORTAGE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 font-mono text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            SOLAR SHORTAGE
          </span>
        );
      case 'BATTERY_SUPPORT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/60 text-blue-300 font-mono text-[10px] font-bold animate-pulse">
            <Zap className="w-3 h-3 text-blue-400" />
            BATTERY SUPPORT
          </span>
        );
      case 'RFC_SUPPORT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/60 text-purple-300 font-mono text-[10px] font-bold animate-pulse">
            <Flame className="w-3 h-3 text-purple-400" />
            RFC SUPPORT
          </span>
        );
      case 'ENERGY_CONSERVATION':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 font-mono text-[10px] font-bold">
            <Layers className="w-3 h-3 text-indigo-400" />
            CONSERVATION
          </span>
        );
      case 'CRITICAL_POWER_SHORTAGE':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/90 border border-red-500 text-red-200 font-mono text-[10px] font-bold animate-pulse">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            CRITICAL SHORTAGE
          </span>
        );
      case 'RECOVERY':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-teal-950/80 border border-teal-500/60 text-teal-300 font-mono text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3 text-teal-400" />
            RECOVERY
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px]">
            {energyMgmtState}
          </span>
        );
    }
  };

  // 6. ENERGY FORECAST ASSESSMENT (MODULE B)
  const forecastAssessment = React.useMemo(() => {
    return estimateEnergyForecast({
      scenarioId: currentScenarioId,
      batteryStoredKWh: telemetry.batteryStoredKWh,
      batteryCapacityKWh: telemetry.batteryCapacityKWh,
      batteryMinReservePct: telemetry.batteryMinReservePct,
      currentSolarKW: telemetry.solarGenerationKW,
      nuclearGenerationKW: telemetry.nuclearGenerationKW,
      totalDemandKW: telemetry.totalDemandKW,
      essentialDemandKW: telemetry.essentialDemandKW,
      rfcUsableElectricalEnergyKWh: rfcState.usableElectricalEnergyKWh,
    });
  }, [
    currentScenarioId,
    Math.round(telemetry.batteryStoredKWh),
    Math.round(telemetry.solarGenerationKW),
    Math.round(telemetry.totalDemandKW),
    Math.round(telemetry.nuclearGenerationKW),
    Math.round(rfcState.usableElectricalEnergyKWh),
  ]);

  const getForecastStatusBadge = (status: 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL') => {
    switch (status) {
      case 'NORMAL':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-mono text-[10px] font-bold">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            NORMAL
          </span>
        );
      case 'WATCH':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/60 text-sky-300 font-mono text-[10px] font-bold">
            <Activity className="w-3 h-3 text-sky-400" />
            WATCH
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 font-mono text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            WARNING
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/90 border border-red-500 text-red-200 font-mono text-[10px] font-bold animate-pulse">
            <ShieldAlert className="w-3 h-3 text-red-400" />
            CRITICAL
          </span>
        );
    }
  };

  return (
    <div
      id="resource-monitoring-dashboard"
      className="absolute top-14 left-3 bottom-14 z-30 w-84 sm:w-92 max-w-[95vw] glass-panel flex flex-col overflow-hidden pointer-events-auto border-cyan-500/40 shadow-[0_16px_50px_rgba(0,0,0,0.85)] animate-fade-in"
      style={{
        maxHeight: 'calc(100dvh - 32px)',
      }}
      role="region"
      aria-label="Live Resource Monitoring Dashboard"
    >
      {/* Top Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-2 shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-400 font-bold">
              ASTRA-GRID-MONITOR
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              MODULE 1 • LIVE
            </span>
          </div>
          <h2 className="font-hud text-sm font-bold text-slate-100 mt-1 leading-snug">
            Resource Monitoring Dashboard
          </h2>
        </div>

        <button
          onClick={toggleResourceMonitoring}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Close Resource Monitoring Dashboard"
          aria-label="Close Resource Monitoring Dashboard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Metric Cards Stream */}
      <div
        className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 custom-scrollbar text-xs"
        style={{
          minHeight: 0,
          overflowY: 'auto',
        }}
      >
        {/* 1. SOLAR POWER CARD */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Sun className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                1. SOLAR POWER
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {solarNetDiffKW >= 0 ? `+${solarNetDiffKW.toFixed(1)} kW surplus` : `${solarNetDiffKW.toFixed(1)} kW deficit`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">CURRENT GENERATION</span>
              <span className="text-amber-300 font-bold text-xs">
                {solarGenKW.toFixed(1)} <span className="text-[10px] text-slate-400">kW</span>
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">HABITAT DEMAND</span>
              <span className="text-sky-300 font-bold text-xs">
                {habitatDemandKW.toFixed(1)} <span className="text-[10px] text-slate-400">kW</span>
              </span>
            </div>
          </div>

          <div className="space-y-1 font-mono">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-400">Solar Contribution to Demand:</span>
              <span className="text-amber-300 font-bold">{solarContributionPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, Number(solarContributionPct)))}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. BATTERY CARD */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Battery className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                2. BATTERY (BESS)
              </span>
            </div>
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border ${batteryInfo.badgeColor}`}>
              <BatteryStatusIcon className="w-3 h-3" />
              {batteryInfo.label}
            </span>
          </div>

          {/* SoC Progress Bar with 20% Floor Indicator */}
          <div className="space-y-1 font-mono">
            <div className="flex justify-between items-baseline text-[10px]">
              <span className="text-slate-400">State of Charge (SoC):</span>
              <span className="text-emerald-300 font-bold text-xs">{batterySoc.toFixed(1)}%</span>
            </div>
            <div className="relative w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  batterySoc > 40 ? 'bg-emerald-400' : batterySoc > 20 ? 'bg-amber-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, batterySoc))}%` }}
              />
              {/* 20% reserve line marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: `${minReservePct}%` }}
                title="Configured minimum reserve floor (20%)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">STORED ENERGY</span>
              <span className="text-slate-200 font-bold">
                {batteryStoredKWh.toFixed(1)} <span className="text-[9px] text-slate-400">kWh</span>
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">TOTAL CAPACITY</span>
              <span className="text-slate-200 font-bold">
                {batteryCapacityKWh} <span className="text-[9px] text-slate-400">kWh</span>
              </span>
            </div>
          </div>

          <div className="p-1.5 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">Configured Minimum Reserve:</span>
            <span className="text-red-300 font-bold">
              {minReservePct.toFixed(1)}% ({minReserveKWh.toFixed(1)} kWh)
            </span>
          </div>
        </section>

        {/* 3. RFC ALTERNATIVE POWER CARD */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Flame className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                3. RFC ALTERNATIVE POWER
              </span>
            </div>
            {getRFCModeBadge()}
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">RFC STATUS</span>
              <span className={`font-bold ${rfcEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                {rfcEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">FUEL CELL OUTPUT</span>
              <span className="text-emerald-300 font-bold">
                {fuelCellOutputKW.toFixed(1)} <span className="text-[9px] text-slate-400">kW</span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-850">
              <span className="text-slate-400">Hydrogen (H₂) Inventory:</span>
              <span className="text-cyan-300 font-bold">
                {rfcState.h2StoredKg.toFixed(2)} / {rfcState.h2CapacityKg} kg ({rfcState.h2FillPct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-850">
              <span className="text-slate-400">Oxygen (O₂) Inventory:</span>
              <span className="text-cyan-300 font-bold">
                {rfcState.o2StoredKg.toFixed(2)} / {rfcState.o2CapacityKg} kg ({rfcState.o2FillPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </section>

        {/* 4. WATER CARD */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-sky-400">
              <Droplets className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                4. WATER
              </span>
            </div>
            <span className="font-mono text-[10px] text-sky-300 font-bold">
              {waterReservePct.toFixed(1)}% RESERVE
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[10px]">
            {/* Potable water stock */}
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-slate-400">Potable Water Inventory:</span>
              <span className="text-sky-300 font-bold">
                {potableWaterLiters} / {potableCapacityL} L
              </span>
            </div>

            {/* Baseline consumption rate */}
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-850">
              <span className="text-slate-400">Water Consumption Rate:</span>
              <span className="text-slate-200 font-bold">
                {dailyConsumptionRateL.toFixed(1)} L/day
              </span>
            </div>

            {/* RFC Electrolyzer Water Consumed */}
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-850">
              <span className="text-slate-400">RFC Electrolyzer Water Consumed:</span>
              <span className="text-slate-200 font-bold">
                {rfcCumulativeWaterConsumedL.toFixed(2)} L
              </span>
            </div>

            {/* RFC Fuel-Cell Water Produced */}
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/40 border border-slate-850">
              <span className="text-slate-400">RFC Fuel-Cell Water Produced:</span>
              <span className="text-slate-200 font-bold">
                {rfcCumulativeWaterProducedL.toFixed(2)} L
              </span>
            </div>

            {/* Untracked field with honest label */}
            <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/30 border border-slate-850/60">
              <span className="text-slate-500">Instantaneous Water Rate:</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700/60 text-slate-400 text-[9px] italic">
                Not yet tracked
              </span>
            </div>
          </div>
        </section>

        {/* 5. POWER STATUS CARD */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Activity className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                5. POWER STATUS
              </span>
            </div>
            {getEnergyMgmtBadge()}
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">TOTAL GENERATION</span>
              <span className="text-cyan-300 font-bold text-xs">
                {totalGenKW.toFixed(1)} <span className="text-[9px] text-slate-400">kW</span>
              </span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">ESSENTIAL DEMAND</span>
              <span className="text-slate-200 font-bold text-xs">
                {essentialDemandKW.toFixed(1)} <span className="text-[9px] text-slate-400">kW</span>
              </span>
            </div>
          </div>

          <div className="p-1.5 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">Unmet Essential Power:</span>
            <span
              className={`font-bold ${
                unmetEssentialKW > 0.001 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {unmetEssentialKW > 0.001 ? `${unmetEssentialKW.toFixed(2)} kW` : '0.00 kW (None)'}
            </span>
          </div>

          <div className="p-1.5 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">Energy-Management State:</span>
            <span className="text-cyan-300 font-bold">{energyMgmtState}</span>
          </div>
        </section>

        {/* 6. ENERGY FORECAST CARD (MODULE B) */}
        <section className="p-2.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-hud font-bold text-[11px] tracking-wide text-slate-200">
                6. ENERGY FORECAST
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 font-mono text-[9px] text-slate-400">
                {forecastAssessment.horizonHours}H HORIZON
              </span>
              {getForecastStatusBadge(forecastAssessment.status)}
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">EXPECTED SOLAR</span>
              <span className="text-amber-300 font-bold text-xs flex items-center gap-1">
                {forecastAssessment.expectedSolarAvgKW.toFixed(1)} <span className="text-[9px] text-slate-400">kW avg</span>
                {forecastAssessment.solarTrend === 'rising' ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : forecastAssessment.solarTrend === 'falling' || forecastAssessment.solarTrend === 'eclipsed' ? (
                  <TrendingDown className="w-3 h-3 text-amber-400" />
                ) : null}
              </span>
              <span className="text-[8px] text-slate-500 block uppercase">
                Trend: {forecastAssessment.solarTrend} (Peak {forecastAssessment.expectedSolarPeakKW} kW)
              </span>
            </div>

            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
              <span className="text-[9px] text-slate-400 block">PREDICTED NET BALANCE</span>
              <span
                className={`font-bold text-xs ${
                  forecastAssessment.predictedNetPowerKW >= 0 ? 'text-cyan-300' : 'text-amber-300'
                }`}
              >
                {forecastAssessment.predictedNetPowerKW >= 0 ? '+' : ''}
                {forecastAssessment.predictedNetPowerKW.toFixed(1)}{' '}
                <span className="text-[9px] text-slate-400">kW</span>
              </span>
              <span className="text-[8px] text-slate-500 block">
                {forecastAssessment.netPowerBalanceDescription}
              </span>
            </div>
          </div>

          <div className="p-1.5 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between font-mono text-[10px]">
            <span className="text-slate-400">Time to Battery 20% Reserve:</span>
            <span
              className={`font-bold ${
                forecastAssessment.hoursToBatteryReserve !== null && forecastAssessment.hoursToBatteryReserve <= 4.0
                  ? 'text-red-400 animate-pulse'
                  : forecastAssessment.hoursToBatteryReserve !== null
                  ? 'text-amber-300'
                  : 'text-emerald-400'
              }`}
            >
              {forecastAssessment.timeToReserveFormatted}
            </span>
          </div>

          {/* RFC Passive Buffer Support */}
          <div className="p-1.5 rounded bg-slate-950/40 border border-slate-850 flex items-center justify-between font-mono text-[9px]">
            <span className="text-slate-400">RFC Reactant Buffer:</span>
            <span className="text-cyan-300 font-bold">
              {forecastAssessment.rfcUsableElectricalEnergyKWh.toFixed(1)} kWh (~{forecastAssessment.rfcSupportHoursAvailable.toFixed(1)}h support)
            </span>
          </div>

          {/* Explanation Banner */}
          <div
            className={`p-1.5 rounded border text-[10px] font-mono leading-tight ${
              forecastAssessment.status === 'CRITICAL'
                ? 'bg-red-950/40 border-red-500/50 text-red-200'
                : forecastAssessment.status === 'WARNING'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : forecastAssessment.status === 'WATCH'
                ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}
          >
            {forecastAssessment.riskExplanation}
          </div>
        </section>
      </div>
    </div>
  );
};

export const ResourceMonitoringPanel: React.FC = () => {
  const isResourceMonitoringOpen = useHabitatStore((state) => state.isResourceMonitoringOpen);
  if (!isResourceMonitoringOpen) return null;
  return <ResourceMonitoringContent />;
};
