/**
 * Astra Grid / HabitatOS - Core Simulation & Predictive Optimization Data Contracts
 * 
 * Shared TypeScript data contracts for:
 * - Habitat resource state (battery energy, water, life support)
 * - Power generation, storage and load classification
 * - Essential (non-deferrable) vs flexible (deferrable) tasks
 * - 24-hour environmental and resource forecasts
 * - Safety constraints and validation violations
 * - Controller decisions across baseline and predictive optimizers
 * - Benchmark metrics and comparative evaluation reports
 * 
 * Simulation Timestep: 1.0 hour (hourly prototype)
 * Standard Units: kW (power), kWh (energy), L (water), kg (mass), % (SoC / health)
 */

// ============================================================================
// 1. PHYSICAL & OPERATIONAL CONSTANTS
// ============================================================================

export const SIMULATION_TIMESTEP_HOURS = 1.0;
export const LUNAR_SOL_HOURS = 24.0; // Standardized prototype sol length in simulation hours
export const SOLAR_FLUX_NOMINAL_W_M2 = 1361.0;

// Standard Habitat Equipment baseload ratings (kW)
export const KILOPOWER_BASELOAD_KW = 40.0;
export const SOLAR_ARRAY_PEAK_KW = 120.0;

// Re-export RFC and Water Management Contracts
export type {
  RFCOperatingMode,
  RFCConfig,
  RFCState,
  ElectrolyzerStepInput,
  ElectrolyzerStepResult,
  FuelCellStepInput,
  FuelCellStepResult,
  RFCStepInput,
  RFCStepResult,
} from './rfcModel.ts';
export {
  DEFAULT_RFC_CONFIG,
  HYDROGEN_LHV_KWH_PER_KG,
  DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO,
  DEFAULT_STOICHIOMETRIC_WATER_PER_H2_RATIO,
  WATER_DENSITY_KG_PER_L,
  createDefaultRFCConfig,
  createDefaultRFCState,
  calculateUsableStoredEnergy,
} from './rfcModel.ts';
export type { RFCWaterFlowRecord } from './waterManagement.ts';
import type { RFCState, RFCStepResult } from './rfcModel.ts';
import { createDefaultRFCState } from './rfcModel.ts';
import type { RFCWaterFlowRecord } from './waterManagement.ts';

// ============================================================================
// Energy Resilience & Emergency Operating States (Modules 5 & 6)
// ============================================================================

export type EnergyManagementState =
  | 'NORMAL'
  | 'SOLAR_SHORTAGE'
  | 'BATTERY_SUPPORT'
  | 'RFC_SUPPORT'
  | 'ENERGY_CONSERVATION'
  | 'CRITICAL_POWER_SHORTAGE'
  | 'RECOVERY';

export type PowerDeficitType =
  | 'NONE'
  | 'FLEXIBLE_CURTAILMENT'
  | 'PARTIAL_ESSENTIAL_DEFICIT'
  | 'COMPLETE_LOSS_OF_GENERATION';


// Non-deferrable Essential Loads (Total ~40.1 kW)
export const ESSENTIAL_LOAD_RATINGS = {
  mainHabitatLifeSupport: 22.5,  // Pressurization, crew cabin, avionics
  oxygenElectrolysisMin: 14.2,   // Minimum continuous O2 revitalization
  potableWaterThermal: 1.2,      // Tank heating & freeze protection
  powerDistributionBus: 1.6,     // HVDC solid-state switchgear & telemetry
  lunarLanderStandby: 0.8,       // Critical descent stage avionics keep-alive
} as const;

export const TOTAL_ESSENTIAL_LOAD_KW = Object.values(ESSENTIAL_LOAD_RATINGS).reduce(
  (sum, val) => sum + val,
  0
);

// ============================================================================
// 2. SUBSYSTEM CONFIGURATIONS & OPERATING LIMITS
// ============================================================================

export interface BatteryConfig {
  /** Nominal nameplate storage capacity (kWh) - Default: 500 kWh */
  readonly capacityKWh: number;
  /** Maximum safe charging rate (kW) - Default: 80.0 kW (0.16 C) */
  readonly maxChargeRateKW: number;
  /** Maximum safe discharge rate (kW) - Default: 100.0 kW (0.2 C) */
  readonly maxDischargeRateKW: number;
  /** One-way Coulombic/inverter charging efficiency (0.0 to 1.0) - Default: 0.95 */
  readonly chargeEfficiency: number;
  /** One-way discharge inverter efficiency (0.0 to 1.0) - Default: 0.95 */
  readonly dischargeEfficiency: number;
  /** Hard safety reserve limit below which operation is unsafe (%) - Default: 20.0% */
  readonly minReserveSocPct: number;
  /** Warning caution threshold (%) - Default: 25.0% */
  readonly criticalReserveSocPct: number;
  /** Maximum charge ceiling to protect cell longevity (%) - Default: 98.0% */
  readonly nominalMaxSocPct: number;
}

export const DEFAULT_BATTERY_CONFIG: BatteryConfig = {
  capacityKWh: 500.0,
  maxChargeRateKW: 80.0,
  maxDischargeRateKW: 100.0,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  minReserveSocPct: 20.0,
  criticalReserveSocPct: 25.0,
  nominalMaxSocPct: 98.0,
};

export interface WaterConfig {
  /** Total potable water tank volume (L) - Default: 3000 L */
  readonly capacityL: number;
  /** Minimum emergency reserve floor (L) - Default: 500 L */
  readonly minReserveL: number;
  /** Hourly baseline crew consumption rate (L/h) - Default: 10.4 L / 24h ≈ 0.433 L/h */
  readonly baselineConsumptionLPerHour: number;
  /** Maximum VCD distillation throughput (L/h) - Default: 3.2 L/h */
  readonly recyclingThroughputLPerHour: number;
  /** VCD fluid recovery yield factor (0.0 to 1.0) - Default: 0.98 */
  readonly recoveryEfficiency: number;
  /** Electrical power required to run the VCD water recycler (kW) - Default: 7.5 kW */
  readonly recyclingPowerDemandKW: number;
}

export const DEFAULT_WATER_CONFIG: WaterConfig = {
  capacityL: 3000.0,
  minReserveL: 500.0,
  baselineConsumptionLPerHour: 10.4 / 24.0,
  recyclingThroughputLPerHour: 3.2,
  recoveryEfficiency: 0.98,
  recyclingPowerDemandKW: 7.5,
};

// ============================================================================
// 3. HABITAT RESOURCE STATE
// ============================================================================

export interface HabitatResourceState {
  /** Elapsed simulation time in integer or fractional hours */
  timestampHour: number;
  /** Mission elapsed sol (e.g. 14.5) */
  sol: number;

  // Energy & Storage State
  /** Current energy physically stored in the BESS (kWh) */
  batteryStoredKWh: number;
  /** Battery state of charge (0.0 - 100.0%) */
  batterySocPct: number;
  /** Battery health / cell capacity degradation factor (0.0 - 100.0%) */
  batteryHealthPct: number;

  // Fluid & Atmospheric Reserves
  /** Current volume of potable water in storage (Liters) */
  potableWaterLiters: number;
  /** Water reserve fill percentage (0.0 - 100.0%) */
  waterReservePct: number;
  /** Current breathing oxygen reserve (kg) */
  oxygenReserveKg: number;
  /** Accumulated unprocessed solid waste awaiting pyrolysis (kg) */
  wasteAccumulatedKg: number;
  /** Recoverable wastewater buffer awaiting distillation recycling (Liters) */
  recoverableWaterLiters?: number;
  /** Cumulative water deficit where crew water consumption was unmet (Liters) */
  cumulativeUnmetWaterL?: number;

  // Mission Continuity & Safety Tracking
  /** Cumulative energy drawn from emergency backup / reserve under minSoc (kWh) */
  backupEnergyUsedKWh: number;
  /** Flag raised if battery drops below the hard reserve limit (minReserveSocPct) */
  isEmergencyReserveBreached: boolean;
  /** Flag raised if life-critical essential load had to be curtailed */
  isLifeSupportCompromised: boolean;
  /** Regenerative Fuel Cell (RFC) energy storage subsystem state */
  rfcState?: RFCState;
  /** Current energy management & resilience state */
  energyManagementState?: EnergyManagementState;
  /** Deficit classification */
  deficitType?: PowerDeficitType;
  /** Duration of active electrical shortage (hours) */
  shortageDurationHours?: number;
  /** Cumulative electrical energy deficit of essential life support (kWh) */
  cumulativeUnmetEssentialEnergyKWh?: number;
  /** Battery energy safely dischargeable above emergency reserve floor (kWh) */
  safeBatteryEnergyAvailableKWh?: number;
  /** Maximum safe battery power deliverable to the bus without reserve breach (kW) */
  safeBatteryPowerAvailableKW?: number;
}

// ============================================================================
// 4. FLEXIBLE & DEFERRABLE TASKS
// ============================================================================

export type FlexibleTaskType =
  | 'water_recycling'        // VCD distillation batch run (reclaims water, consumes 7.5 kW)
  | 'waste_pyrolysis'        // Autoclave solid waste batch (consumes 11.8 kW)
  | 'rover_recharge'         // Pressurized rover traction battery charge (consumes 8.0 kW)
  | 'science_electrolysis'   // Extra EVA canister oxygen compression (consumes 10.0 kW)
  | 'regolith_sintering';    // Habitat expansion 3D printer (consumes 15.0 kW)

export interface FlexibleTask {
  id: string;
  name: string;
  taskType: FlexibleTaskType;
  /** Total required run duration in hours to complete */
  durationHours: number;
  /** Power drawn when actively running (kW) */
  powerKW: number;
  /** Scheduling priority: 1 (Highest / Near-Essential) to 4 (Lowest / Discretionary) */
  priority: 1 | 2 | 3 | 4;
  /** Simulation hour at which task becomes available to run */
  earliestStartHour: number;
  /** Simulation hour by which task should complete to avoid penalty */
  deadlineHour: number;
  /** Hours already completed */
  progressHours: number;
  /** Hours remaining to finish */
  remainingHours: number;
  /** Whether execution can be paused and resumed across non-consecutive hours */
  isPreemptible: boolean;
  /** Net potable water produced per active hour (L/h), if applicable */
  waterYieldLPerHour?: number;
  /** Solid waste mass consumed per active hour (kg/h), if applicable */
  wasteConsumedKgPerHour?: number;
}

// ============================================================================
// 5. FORECASTS & ENVIRONMENTAL HORIZONS
// ============================================================================

export interface HourlyForecast {
  /** Simulation hour relative to scenario start (0, 1, ..., 23) */
  hour: number;
  /** Sun elevation angle above local horizon (degrees) */
  sunElevationDeg: number;
  /** Incident solar flux (W/m²) */
  solarFluxW_m2: number;
  /** Expected solar array power output (kW) */
  solarGenerationKW: number;
  /** Expected continuous nuclear power generation (kW) - typically 40 kW */
  nuclearGenerationKW: number;
  /** Expected continuous essential load demand (kW) - typically ~40.1 kW */
  essentialDemandKW: number;
  /** Surface regolith dust or optical depth occlusion factor (0.0 to 1.0) */
  dustOcclusionPct: number;
  /** Whether the habitat is in topographic or orbital eclipse shadow */
  isEclipse: boolean;
}

export interface ForecastHorizon {
  /** Starting hour index of this forecast */
  startHour: number;
  /** Horizon lookahead span in hours (e.g. 24) */
  horizonHours: number;
  /** Hourly forecasted conditions across the horizon */
  hourlyForecasts: HourlyForecast[];
}

// ============================================================================
// 6. SAFETY CONSTRAINTS & VIOLATION REPORTING
// ============================================================================

export interface SafetyConstraints {
  /** Hard minimum battery state of charge (default 20.0%) */
  minBatterySocPct: number;
  /** Hard minimum potable water reserve (default 500.0 L) */
  minWaterReserveL: number;
  /** Maximum battery charging flow rate (kW) */
  maxBatteryChargeRateKW: number;
  /** Maximum battery discharge flow rate (kW) */
  maxBatteryDischargeRateKW: number;
  /** Whether essential loads can ever be shed (always false for nominal safety) */
  allowEssentialShedding: boolean;
}

export const DEFAULT_SAFETY_CONSTRAINTS: SafetyConstraints = {
  minBatterySocPct: DEFAULT_BATTERY_CONFIG.minReserveSocPct,
  minWaterReserveL: DEFAULT_WATER_CONFIG.minReserveL,
  maxBatteryChargeRateKW: DEFAULT_BATTERY_CONFIG.maxChargeRateKW,
  maxBatteryDischargeRateKW: DEFAULT_BATTERY_CONFIG.maxDischargeRateKW,
  allowEssentialShedding: false,
};

export type SafetyViolationRule =
  | 'BATTERY_MIN_RESERVE_VIOLATED'
  | 'BATTERY_CHARGE_RATE_EXCEEDED'
  | 'BATTERY_DISCHARGE_RATE_EXCEEDED'
  | 'WATER_MIN_RESERVE_VIOLATED'
  | 'ESSENTIAL_LOAD_UNMET'
  | 'TASK_DEADLINE_BREACHED';

export interface SafetyViolation {
  rule: SafetyViolationRule;
  hour: number;
  currentValue: number;
  limitValue: number;
  severity: 'warning' | 'critical' | 'catastrophic';
  message: string;
}

export interface SafetyValidationResult {
  isSafe: boolean;
  violations: SafetyViolation[];
  warnings: string[];
}

// ============================================================================
// 7. CONTROLLER DECISION & SCHEDULING INTERFACES
// ============================================================================

export type ControllerId = 'fixed_priority' | 'solar_aware' | 'mission_optimizer';

export interface ControllerDecision {
  /** The simulation hour for which this decision applies */
  hour: number;
  /** Unique ID of the deciding controller */
  controllerId: ControllerId;
  /** IDs of flexible tasks dispatched to run during this hour */
  activeTaskIds: string[];
  /** Recommended solar tracking orientation */
  solarTrackingMode: 'auto' | 'stow' | 'manual';
  /** Total flexible power scheduled for this hour (kW) */
  flexibleLoadKW: number;
  /** Unavoidable essential load curtailment (0.0 kW in safe operations) */
  sheddedEssentialLoadKW: number;
  /** Model-projected battery SoC at the end of this hour (%) */
  projectedBatterySocPct: number;
  /** Model-projected water reserve at the end of this hour (L) */
  projectedWaterLiters: number;
  /** Explanatory justification from the controller logic */
  rationale: string;
}

export interface SimulationController {
  readonly id: ControllerId;
  readonly name: string;
  readonly description: string;

  /**
   * Evaluates current habitat state, horizon forecasts, pending flexible tasks,
   * and safety constraints to decide the operational plan for the next hour.
   */
  decideNextHour(
    currentState: HabitatResourceState,
    forecast: ForecastHorizon,
    pendingTasks: FlexibleTask[],
    constraints: SafetyConstraints
  ): ControllerDecision;
}

// ============================================================================
// 8. SIMULATION STEP RESULT (RESOURCE MODEL DYNAMICS)
// ============================================================================

export interface StepResult {
  /** The resulting habitat state after advancing by 1 hour */
  nextState: HabitatResourceState;
  /** Total generation produced during the hour (kW) */
  generationKW: number;
  /** Solar power generation produced during the hour (kW) */
  solarGenerationKW: number;
  /** Backup / nuclear power generation produced during the hour (kW) */
  backupGenerationKW: number;
  /** Total electrical demand attempted / requested during the hour (kW) */
  demandKW: number;
  /** Essential electricity demand required during the hour (kW) */
  essentialDemandKW: number;
  /** Flexible task electricity demand requested during the hour (kW) */
  flexibleDemandKW: number;
  /** Actual total electrical demand served during the hour (kW) */
  demandServedKW: number;
  /** Actual essential load served during the hour (kW) */
  essentialServedKW: number;
  /** Actual flexible load served during the hour (kW) */
  flexibleServedKW: number;
  /** Total unmet electrical demand (kW) */
  unmetDemandKW: number;
  /** Unmet essential life-support demand (kW) */
  unmetEssentialLoadKW: number;
  /** Unmet flexible task demand (kW) */
  unmetFlexibleLoadKW: number;
  /** Net electrical balance before storage (generation - demand) (kW) */
  netPowerKW: number;
  /** Actual net battery power flow at the bus (+ charging, - discharging) (kW) */
  batteryFlowKW: number;
  /** Power delivered into battery charging from the bus (kW) */
  batteryChargeKW: number;
  /** Power delivered from battery discharging to the bus (kW) */
  batteryDischargeKW: number;
  /** Net chemical energy change in battery storage (kWh) */
  batteryStoredDeltaKWh: number;
  /** Energy dissipated as heat due to charging and discharging conversion losses (kWh) */
  batteryLossKWh: number;
  /** Curtailed excess generation that could not be stored or used (kW) */
  curtailedGenerationKW: number;
  /** Net potable water volume change during the hour (L) */
  waterDeltaL: number;
  /** Potable water consumed by crew during the hour (L) */
  waterConsumedL: number;
  /** Potable water recovered from wastewater distillation during the hour (L) */
  waterRecoveredL: number;
  /** Unmet crew water demand during the hour (L) */
  unmetWaterDemandL: number;
  /** Recoverable wastewater remaining in the recycling buffer (L) */
  recoverableWaterRemainingL: number;
  /** Updated task definitions reflecting progress and remaining hours */
  updatedTasks: FlexibleTask[];
  /** IDs of flexible tasks that actively ran during this hour */
  activeTaskIds: string[];
  /** IDs of flexible tasks that were requested/dispatched but could not run or were preempted */
  preemptedTaskIds: string[];
  /** Task IDs that finished during this hour */
  completedTaskIds: string[];
  /** Any safety violations incurred during the transition */
  violations: SafetyViolation[];
  /** True if no safety violations occurred during the step */
  isSafe: boolean;
  /** True if generation + storage could not satisfy demand, leading to unmet load */
  isInfeasible: boolean;
  /** Power delivered from regenerative fuel cell discharging to the bus (kW) */
  rfcGenerationKW?: number;
  /** Power delivered into regenerative fuel cell electrolyzer from the bus (kW) */
  rfcChargeKW?: number;
  /** Detailed RFC step telemetry, if RFC is active */
  rfcStep?: RFCStepResult;
  /** RFC water interface flow record for the step */
  rfcWaterFlow?: RFCWaterFlowRecord;
  /** Current energy dispatch and resilience state */
  energyManagementState?: EnergyManagementState;
  /** Classification of power deficit, if any */
  deficitType?: PowerDeficitType;
  /** Consecutive hours of current power shortage */
  shortageDurationHours?: number;
  /** Cumulative energy shortfall of essential loads (kWh) */
  cumulativeUnmetEssentialEnergyKWh?: number;
  /** Safe battery discharge energy available above emergency reserve (kWh) */
  safeBatteryEnergyAvailableKWh?: number;
  /** Battery power safely available at bus without breaching reserve (kW) */
  safeBatteryPowerAvailableKW?: number;
  /** Net available surplus power after serving essential and flexible loads (kW) */
  availableSurplusPowerKW?: number;
}

// ============================================================================
// 9. BENCHMARK METRICS & COMPARATIVE REPORTS
// ============================================================================

export interface BenchmarkMetrics {
  /** Hours the habitat operated before any safety violation occurred (up to full horizon) */
  safeOperatingTimeHours: number;
  /** Total cumulative hours during which essential life-support was curtailed */
  essentialServiceInterruptionsHours: number;
  /** Total cumulative water deficit below minimum safety reserve (L-hours or L) */
  waterDeficitLiters: number;
  /** Cumulative energy drawn from emergency reserves while SoC < 20% (kWh) */
  backupEnergyConsumedKWh: number;
  /** Number of flexible tasks successfully completed within their deadlines */
  completedTaskCount: number;
  /** Total flexible tasks submitted to the scenario */
  totalTaskCount: number;
  /** Task completion percentage (%) */
  taskCompletionRatePct: number;
  /** Total cumulative delay past deadline for all tasks (hours) */
  accumulatedTaskDelayHours: number;
  /** Whether the habitat survived the full scenario without a single safety breach */
  survivedFullScenario: boolean;
}

export interface HourlyLogEntry {
  hour: number;
  generationKW: number;
  demandKW: number;
  netPowerKW: number;
  batterySocPct: number;
  batteryStoredKWh: number;
  waterLiters: number;
  activeTasks: string[];
  safetyViolationCount: number;
}

export interface ControllerBenchmarkRun {
  controllerId: ControllerId;
  controllerName: string;
  scenarioId: string;
  scenarioName: string;
  totalDurationHours: number;
  metrics: BenchmarkMetrics;
  hourlyHistory: HourlyLogEntry[];
}

export interface ComparativeBenchmarkReport {
  scenarioId: string;
  scenarioName: string;
  scenarioDescription: string;
  horizonHours: number;
  runs: Record<ControllerId, ControllerBenchmarkRun>;
  timestampIso: string;
}

// ============================================================================
// 10. INITIAL CONSTRUCTORS & INVARIANT VALIDATORS
// ============================================================================

export function createDefaultResourceState(
  overrides?: Partial<HabitatResourceState>
): HabitatResourceState {
  const batteryStoredKWh = overrides?.batteryStoredKWh ?? 442.5; // 88.5% of 500 kWh
  const batterySocPct = overrides?.batterySocPct ?? (batteryStoredKWh / DEFAULT_BATTERY_CONFIG.capacityKWh) * 100.0;
  const potableWaterLiters = overrides?.potableWaterLiters ?? 2680.0;
  const waterReservePct = (potableWaterLiters / DEFAULT_WATER_CONFIG.capacityL) * 100.0;
  const recoverableWaterLiters = overrides?.recoverableWaterLiters ?? 120.0;
  const cumulativeUnmetWaterL = overrides?.cumulativeUnmetWaterL ?? 0.0;

  const minReserveKWh = DEFAULT_BATTERY_CONFIG.capacityKWh * (DEFAULT_BATTERY_CONFIG.minReserveSocPct / 100.0);
  const safeBatteryEnergyAvailableKWh = Math.max(0, batteryStoredKWh - minReserveKWh);
  const safeBatteryPowerAvailableKW = (safeBatteryEnergyAvailableKWh * DEFAULT_BATTERY_CONFIG.dischargeEfficiency) / SIMULATION_TIMESTEP_HOURS;

  return {
    timestampHour: 0,
    sol: 14.48,
    batteryStoredKWh,
    batterySocPct,
    batteryHealthPct: 98.0,
    potableWaterLiters,
    waterReservePct,
    oxygenReserveKg: 242.0,
    wasteAccumulatedKg: 46.5,
    backupEnergyUsedKWh: 0.0,
    isEmergencyReserveBreached: batterySocPct < DEFAULT_BATTERY_CONFIG.minReserveSocPct,
    isLifeSupportCompromised: false,
    recoverableWaterLiters,
    cumulativeUnmetWaterL,
    energyManagementState: 'NORMAL',
    deficitType: 'NONE',
    shortageDurationHours: 0,
    cumulativeUnmetEssentialEnergyKWh: 0.0,
    safeBatteryEnergyAvailableKWh,
    safeBatteryPowerAvailableKW,
    rfcState: overrides?.rfcState ?? createDefaultRFCState(),
    ...overrides,
  };
}

export function validateStateInvariants(
  state: HabitatResourceState,
  batteryConfig: BatteryConfig = DEFAULT_BATTERY_CONFIG,
  waterConfig: WaterConfig = DEFAULT_WATER_CONFIG
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (state.batteryStoredKWh < 0) {
    errors.push(`Battery stored energy cannot be negative: ${state.batteryStoredKWh} kWh`);
  }
  if (state.batteryStoredKWh > batteryConfig.capacityKWh * 1.05) {
    errors.push(
      `Battery stored energy (${state.batteryStoredKWh} kWh) exceeds capacity (${batteryConfig.capacityKWh} kWh)`
    );
  }
  if (state.batterySocPct < 0 || state.batterySocPct > 100) {
    errors.push(`Battery SoC percentage must be between 0 and 100: ${state.batterySocPct}%`);
  }
  if (state.potableWaterLiters < 0) {
    errors.push(`Potable water liters cannot be negative: ${state.potableWaterLiters} L`);
  }
  if (state.potableWaterLiters > waterConfig.capacityL * 1.05) {
    errors.push(
      `Potable water liters (${state.potableWaterLiters} L) exceeds capacity (${waterConfig.capacityL} L)`
    );
  }
  if (state.recoverableWaterLiters !== undefined && state.recoverableWaterLiters < 0) {
    errors.push(`Recoverable wastewater liters cannot be negative: ${state.recoverableWaterLiters} L`);
  }
  if (state.rfcState) {
    if (state.rfcState.h2StoredKg < 0) {
      errors.push(`RFC hydrogen inventory cannot be negative: ${state.rfcState.h2StoredKg} kg`);
    }
    if (state.rfcState.h2StoredKg > state.rfcState.h2CapacityKg * 1.05) {
      errors.push(
        `RFC hydrogen inventory (${state.rfcState.h2StoredKg} kg) exceeds capacity (${state.rfcState.h2CapacityKg} kg)`
      );
    }
    if (state.rfcState.o2StoredKg < 0) {
      errors.push(`RFC oxygen inventory cannot be negative: ${state.rfcState.o2StoredKg} kg`);
    }
    if (state.rfcState.o2StoredKg > state.rfcState.o2CapacityKg * 1.05) {
      errors.push(
        `RFC oxygen inventory (${state.rfcState.o2StoredKg} kg) exceeds capacity (${state.rfcState.o2CapacityKg} kg)`
      );
    }
    if (state.rfcState.waterInventoryL !== undefined && state.rfcState.waterInventoryL < 0) {
      errors.push(`RFC water feedstock cannot be negative: ${state.rfcState.waterInventoryL} L`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
