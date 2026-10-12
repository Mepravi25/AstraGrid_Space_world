export type EquipmentType =
  | 'solar_array'
  | 'main_habitat'
  | 'battery_bank'
  | 'potable_water'
  | 'water_recycling'
  | 'oxygen_generation'
  | 'solid_waste_unit'
  | 'nuclear_power'
  | 'power_distribution'
  | 'lunar_lander'
  | 'lunar_rover';

export type EquipmentStatus = 'nominal' | 'warning' | 'critical' | 'offline';

export type CriticalityLevel = 'life_critical' | 'mission_critical' | 'deferrable' | 'discretionary';

export type EquipmentCategory =
  | 'energy_generation'
  | 'energy_storage'
  | 'life_support'
  | 'resource_recovery'
  | 'command_crew'
  | 'infrastructure';

export interface TelemetryMetric {
  label: string;
  value: number | string;
  unit: string;
  min?: number;
  max?: number;
  status?: 'nominal' | 'warning' | 'critical';
}

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  type: EquipmentType;
  category: EquipmentCategory;
  status: EquipmentStatus;
  criticality: CriticalityLevel;
  position: [number, number, number];
  rotation?: [number, number, number];
  description: string;
  functionSummary: string;
  
  // Power metrics (kW) - Positive is generation, negative is load
  powerKW: number;
  maxPowerKW: number;
  
  // Thermodynamic & health
  temperatureK: number;
  efficiencyPct: number;
  healthPct: number;
  
  // Detailed telemetry metrics dictionary
  metrics: Record<string, TelemetryMetric>;

  // Subsystem specific operational states
  customState?: {
    trackingMode?: 'auto' | 'stow' | 'manual';
    dustCleanCycles?: number;
    reserveLocked?: boolean;
    vcdActive?: boolean;
    pyroActive?: boolean;
    nuclearOnline?: boolean;
    airlockSealed?: boolean;
    sterilizationActive?: boolean;
    lastActionMessage?: string;
  };
}
