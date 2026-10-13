import type { EquipmentStatus } from './equipment.ts';

export type HabitatSystemStatus = 'nominal' | 'warning' | 'critical' | 'standby';

export interface HabitatTelemetry {
  timestamp: number;
  missionElapsedSol: number;
  missionTimeStr: string;
  sunElevationDeg: number;
  solarFluxW_m2: number;
  
  // Power metrics (kW)
  solarGenerationKW: number;
  nuclearGenerationKW: number;
  totalGenerationKW: number;
  totalDemandKW: number;
  netPowerKW: number;
  
  // Storage & Resources
  batterySocPct: number;
  batteryCapacityKWh: number;
  batteryStoredKWh: number;
  batteryNetFlowKW: number;
  batteryMinReservePct?: number;
  batteryMinReserveKWh?: number;
  
  potableWaterLiters: number;
  potableWaterCapacityL: number;
  waterReservePct: number;
  waterDailyConsumptionL: number;
  waterDailyRecoveryL: number;
  
  oxygenReserveKg: number;
  oxygenCapacityKg: number;
  oxygenPressureKPa: number;
  
  solidWasteKg: number;
  recycledMaterialKg: number;
  
  activeEquipmentCount: number;
  totalEquipmentCount: number;
  overallStatus: HabitatSystemStatus;

  // Energy Resilience & Emergency Telemetry
  essentialDemandKW?: number;
  flexibleDemandKW?: number;
  flexibleLoadsDeferredKW?: number;
  unmetEssentialLoadKW?: number;
  cumulativeUnmetEssentialKWh?: number;
  energyManagementState?:
    | 'NORMAL'
    | 'SOLAR_SHORTAGE'
    | 'BATTERY_SUPPORT'
    | 'RFC_SUPPORT'
    | 'ENERGY_CONSERVATION'
    | 'CRITICAL_POWER_SHORTAGE'
    | 'RECOVERY';
  shortageDurationHours?: number;
}

export interface SimulationEventLogItem {
  id: string;
  timestampStr: string;
  eventType:
    | 'solar_decreased'
    | 'battery_support'
    | 'battery_reserve_reached'
    | 'rfc_activated'
    | 'rfc_fuel_exhausted'
    | 'flexible_deferred'
    | 'critical_power_shortage'
    | 'solar_recovered'
    | 'info';
  title: string;
  details: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  solarModifier: number; // 0.0 to 1.0+
  demandModifier: number;
  initialBatterySoc: number;
  initialWaterReservePct: number;
  equipmentOverrides: Record<string, Partial<{ status: EquipmentStatus; powerKW: number }>>;
}
