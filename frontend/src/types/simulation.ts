import { EquipmentStatus } from './equipment';

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
