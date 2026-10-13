/**
 * Astra Grid / HabitatOS — Regenerative Fuel Cell (RFC) Simulation Engine
 * 
 * Physically consistent, deterministic electrochemical energy-storage model
 * for a lunar surface habitat microgrid.
 * 
 * First-Principles Electrochemical & Thermodynamic Basis:
 * 1. Electrolysis Reaction (Charging):
 *      2 H₂O (l) → 2 H₂ (g) + O₂ (g)
 *    Consumes surplus electrical power and process water to produce hydrogen and oxygen.
 *    Mass balance: 1.0 kg H₂ requires 7.9365 kg O₂ (≈ 8.0 kg) and consumes 8.9365 kg H₂O (≈ 9.0 kg).
 * 
 * 2. Fuel Cell Reaction (Discharging):
 *      2 H₂ (g) + O₂ (g) → 2 H₂O (l) + Electrical Energy + Heat
 *    Combines stored hydrogen and oxygen to produce DC electricity and process water.
 * 
 * 3. Energy Convention (LHV Basis):
 *    Hydrogen Lower Heating Value (LHV) = 120.0 MJ/kg = 33.3333 kWh/kg.
 *    Specific chemical energy: 33.3333 kWh per kg H₂.
 *    - Electrolyzer: E_chem_stored = E_electrical_in * eta_electrolyzer
 *    - Fuel Cell:    E_electrical_out = E_chem_consumed * eta_fuel_cell
 * 
 * 4. Reactant Mass Conservation:
 *    Usable fuel is determined strictly by the stoichiometrically limiting reactant:
 *      m_H2_usable = min(m_H2_available, m_O2_available / r_O2_H2)
 *    Neither gas may exceed storage capacity or drop below 0.0 kg.
 * 
 * 5. Water Interface:
 *    Water density = 1.0 kg/L. 1.0 kg H₂O = 1.0 L H₂O.
 *    Product water is considered non-potable process water until downstream ECLSS treatment.
 * 
 * Simulation Timestep: Standardized dt in hours (default 1.0 h).
 * Standard Units: kW (power), kWh (energy), kg (gas mass), L (fluid volume).
 */

// ============================================================================
// 1. PHYSICAL CONSTANTS & CONVERSION FACTORS
// ============================================================================

/**
 * Hydrogen Lower Heating Value (LHV) in kWh per kg of H₂.
 * 120.0 MJ/kg / 3.6 MJ/kWh = 33.333333... kWh/kg.
 */
export const HYDROGEN_LHV_KWH_PER_KG = 120.0 / 3.6; // 33.333333333333336

/**
 * Stoichiometric mass ratio of oxygen to hydrogen for water (O₂ / H₂).
 * Molar mass of O₂ (31.9988 g/mol) / (2 * 2.01588 g/mol H₂) ≈ 7.93664.
 * Default illustrative engineering constant ≈ 7.9365 (approx 8.0 kg O₂ per 1 kg H₂).
 */
export const DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO = 7.9365;

/**
 * Stoichiometric mass ratio of water consumed per kg of hydrogen produced (H₂O / H₂).
 * 1.0 kg H₂ + 7.9365 kg O₂ = 8.9365 kg H₂O (approx 9.0 kg H₂O per 1 kg H₂).
 */
export const DEFAULT_STOICHIOMETRIC_WATER_PER_H2_RATIO =
  1.0 + DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO;

/**
 * Density of liquid water under nominal habitat temperature and pressure (kg/L).
 */
export const WATER_DENSITY_KG_PER_L = 1.0;

// ============================================================================
// 2. DATA CONTRACTS & CONFIGURATION
// ============================================================================

export type RFCOperatingMode = 'idle' | 'electrolyzing' | 'generating' | 'unavailable';

export interface RFCConfig {
  /** Master switch enabling or bypassing RFC operations */
  readonly enabled: boolean;
  /** Electrolyzer rated electrical input power (kW) - Default: 20.0 kW */
  readonly electrolyzerRatedPowerKW: number;
  /** Fuel cell rated electrical output power (kW) - Default: 15.0 kW */
  readonly fuelCellRatedPowerKW: number;
  /** Electrolyzer one-way electrical-to-chemical efficiency (0.0 to 1.0, LHV basis) - Default: 0.72 */
  readonly electrolyzerEfficiency: number;
  /** Fuel cell one-way chemical-to-electrical efficiency (0.0 to 1.0, LHV basis) - Default: 0.60 */
  readonly fuelCellEfficiency: number;
  /** Maximum hydrogen gas storage tank capacity (kg) - Default: 15.0 kg (~500 kWh chem) */
  readonly h2CapacityKg: number;
  /** Maximum oxygen gas storage tank capacity (kg) - Default: 120.0 kg (~15 * 8 kg) */
  readonly o2CapacityKg: number;
  /** Minimum operating hydrogen reserve floor (kg) - Default: 0.05 kg */
  readonly minH2InventoryKg: number;
  /** Minimum operating oxygen reserve floor (kg) - Default: 0.40 kg */
  readonly minO2InventoryKg: number;
  /** Fraction of fuel-cell product water captured into recovery buffer (0.0 to 1.0) - Default: 0.98 */
  readonly waterRecoveryFraction: number;
  /** Stoichiometric mass ratio of O₂ per kg H₂ (kg O₂ / kg H₂) - Default: 7.9365 */
  readonly stoichiometricO2PerH2Ratio: number;
  /** Stoichiometric mass ratio of H₂O per kg H₂ (kg H₂O / kg H₂) - Default: 8.9365 */
  readonly stoichiometricWaterPerH2Ratio: number;
  /** Liquid water density helper (kg/L) - Default: 1.0 kg/L */
  readonly waterDensityKgPerL: number;
}

export const DEFAULT_RFC_CONFIG: RFCConfig = {
  enabled: true,
  electrolyzerRatedPowerKW: 20.0,
  fuelCellRatedPowerKW: 15.0,
  electrolyzerEfficiency: 0.72,
  fuelCellEfficiency: 0.60,
  h2CapacityKg: 15.0,
  o2CapacityKg: 120.0,
  minH2InventoryKg: 0.05,
  minO2InventoryKg: 0.40,
  waterRecoveryFraction: 0.98,
  stoichiometricO2PerH2Ratio: DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO,
  stoichiometricWaterPerH2Ratio: DEFAULT_STOICHIOMETRIC_WATER_PER_H2_RATIO,
  waterDensityKgPerL: WATER_DENSITY_KG_PER_L,
};

export interface RFCState {
  /** Current operating state */
  mode: RFCOperatingMode;
  /** Whether the RFC subsystem is operational */
  isEnabled: boolean;
  /** Current mass of hydrogen stored in high-pressure / cryo tank (kg) */
  h2StoredKg: number;
  /** Current mass of oxygen stored in high-pressure / cryo tank (kg) */
  o2StoredKg: number;
  /** Maximum hydrogen tank capacity (kg) */
  h2CapacityKg: number;
  /** Maximum oxygen tank capacity (kg) */
  o2CapacityKg: number;
  /** Hydrogen inventory fill percentage (0.0 to 100.0%) */
  h2FillPct: number;
  /** Oxygen inventory fill percentage (0.0 to 100.0%) */
  o2FillPct: number;
  /** Usable hydrogen mass limited by oxygen availability (kg) */
  usableH2Kg: number;
  /** Usable stored chemical energy based on limiting reactant (kWh LHV) */
  storedChemicalEnergyKWh: number;
  /** Estimated remaining electrical energy deliverable at fuel cell terminals (kWh) */
  usableElectricalEnergyKWh: number;
  /** Gas reactant that currently constrains generation ('none' | 'hydrogen' | 'oxygen') */
  limitingReactant: 'none' | 'hydrogen' | 'oxygen';
  /** Available dedicated process water feedstock buffer (L) */
  waterInventoryL: number;
  /** Cumulative electrical energy supplied to electrolyzer (kWh) */
  cumulativeEnergyChargedKWh: number;
  /** Cumulative electrical energy delivered from fuel cell (kWh) */
  cumulativeEnergyDischargedKWh: number;
  /** Cumulative thermal conversion losses dissipated by electrolyzer & fuel cell (kWh) */
  cumulativeLossesKWh: number;
  /** Cumulative water consumed by electrolysis (Liters) */
  cumulativeWaterConsumedL: number;
  /** Cumulative water produced by fuel cell reaction (Liters) */
  cumulativeWaterProducedL: number;
  /** Cumulative product water captured into recovery buffer (Liters) */
  cumulativeWaterRecoveredL: number;
  /** Total operating hours where electrolyzer or fuel cell ran (h) */
  operatingHours: number;
  /** Unmet power generation requests count due to fuel exhaustion or power limits */
  unmetGenerationRequestsCount: number;
  /** Active electrical power drawn by electrolyzer during current step (kW) */
  currentElectricalInputKW?: number;
  /** Active electrical power delivered by fuel cell during current step (kW) */
  currentElectricalOutputKW?: number;
}

// ============================================================================
// 3. STEP INPUTS & TRANSITION RESULTS
// ============================================================================

export interface ElectrolyzerStepInput {
  currentState: RFCState;
  /** Available surplus electrical power budget explicitly allocated to RFC (kW) */
  availablePowerBudgetKW: number;
  /** Process water volume available for electrolysis feedstock (Liters) */
  availableWaterL: number;
  /** Simulation timestep in hours (default: 1.0 h) */
  dtHours?: number;
  /** Optional subsystem configuration override */
  config?: RFCConfig;
}

export interface ElectrolyzerStepResult {
  /** Actual electrical power drawn by electrolyzer (kW) */
  powerConsumedKW: number;
  /** Total electrical energy consumed over the timestep (kWh) */
  energyConsumedKWh: number;
  /** Chemical energy generated and stored in hydrogen (kWh LHV) */
  chemicalEnergyStoredKWh: number;
  /** Conversion thermal loss dissipated (kWh) */
  conversionLossKWh: number;
  /** Hydrogen gas produced (kg) */
  h2ProducedKg: number;
  /** Oxygen gas produced (kg) */
  o2ProducedKg: number;
  /** Water requested by target power (Liters) */
  waterRequestedL: number;
  /** Water actually consumed from feedstock (Liters) */
  waterConsumedL: number;
  /** Water deficit that prevented full electrolysis (Liters) */
  waterUnavailableL: number;
  /** Unused surplus power budget not absorbed (kW) */
  unusedPowerBudgetKW: number;
  /** Primary factor limiting electrolyzer operation */
  limitingFactor:
    | 'none'
    | 'power_budget'
    | 'rated_power'
    | 'h2_capacity'
    | 'o2_capacity'
    | 'water_shortage'
    | 'disabled';
}

export interface FuelCellStepInput {
  currentState: RFCState;
  /** Electrical power requested by power-management controller (kW) */
  requestedPowerKW: number;
  /** Simulation timestep in hours (default: 1.0 h) */
  dtHours?: number;
  /** Optional subsystem configuration override */
  config?: RFCConfig;
}

export interface FuelCellStepResult {
  /** Actual DC electrical power delivered to the habitat bus (kW) */
  powerDeliveredKW: number;
  /** Total electrical energy delivered to the bus over the timestep (kWh) */
  energyDeliveredKWh: number;
  /** Chemical energy drawn from stored hydrogen (kWh LHV) */
  chemicalEnergyConsumedKWh: number;
  /** Conversion thermal loss dissipated (kWh) */
  conversionLossKWh: number;
  /** Hydrogen gas consumed (kg) */
  h2ConsumedKg: number;
  /** Oxygen gas consumed (kg) */
  o2ConsumedKg: number;
  /** Process water produced by reaction (Liters) */
  waterProducedL: number;
  /** Potentially recoverable product water (Liters) */
  waterRecoverableL: number;
  /** Product water captured into recovery buffer (Liters) */
  waterRecoveredL: number;
  /** Unrecovered water lost to humidity / process exhaust (Liters) */
  waterLossL: number;
  /** Requested power that could not be served due to fuel shortage or rating (kW) */
  unmetPowerKW: number;
  /** Primary factor limiting fuel cell generation */
  limitingFactor:
    | 'none'
    | 'zero_request'
    | 'rated_power'
    | 'h2_depleted'
    | 'o2_depleted'
    | 'disabled';
}

export interface RFCStepInput {
  currentState: RFCState;
  /** Surplus electrical power made available for charging (kW) */
  availableSurplusPowerKW: number;
  /** Electrical power deficit requested from RFC for discharging (kW) */
  requestedDischargeKW: number;
  /** Available water feedstock for electrolysis (Liters) */
  availableWaterL?: number;
  /** Target operating mode override */
  modeOverride?: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled';
  /** Timestep in hours (default: 1.0 h) */
  dtHours?: number;
  /** Configuration override */
  config?: RFCConfig;
}

export interface RFCStepResult {
  /** Next resulting RFC state */
  nextState: RFCState;
  /** Operating mode actively executed during the step */
  operatingMode: RFCOperatingMode;
  /** Electrical power consumed by electrolyzer from the bus (kW) */
  electricalInputKW: number;
  /** Electrical power delivered by fuel cell to the bus (kW) */
  electricalOutputKW: number;
  /** Net electrical bus flow (+ generating, - charging) (kW) */
  netPowerFlowKW: number;
  /** Total conversion thermal losses (kWh) */
  conversionLossKWh: number;
  /** Water consumed by electrolysis (Liters) */
  waterConsumedL: number;
  /** Water produced by fuel cell (Liters) */
  waterProducedL: number;
  /** Water recovered from fuel cell product (Liters) */
  waterRecoveredL: number;
  /** Detailed electrolyzer step telemetry */
  electrolyzerResult: ElectrolyzerStepResult;
  /** Detailed fuel cell step telemetry */
  fuelCellResult: FuelCellStepResult;
  /** Primary limiting factor across RFC */
  limitingFactor: string;
  /** Guard flag confirming simultaneous charge/discharge was avoided */
  isSimultaneousOperationPrevented: boolean;
}

// ============================================================================
// 4. UNIT CONVERSIONS & CORE MATHEMATICAL HELPERS
// ============================================================================

/**
 * Converts liquid water volume in Liters to mass in kg using configured density.
 */
export function litersToKgWater(liters: number, densityKgPerL = WATER_DENSITY_KG_PER_L): number {
  return Math.max(0, liters) * densityKgPerL;
}

/**
 * Converts liquid water mass in kg to volume in Liters using configured density.
 */
export function kgWaterToLiters(kg: number, densityKgPerL = WATER_DENSITY_KG_PER_L): number {
  return densityKgPerL > 0 ? Math.max(0, kg) / densityKgPerL : 0;
}

/**
 * Calculates stoichiometric mass relationships for electrolysis:
 * 2 H₂O → 2 H₂ + O₂
 */
export function calculateElectrolysisMasses(
  h2Kg: number,
  stoichRatio = DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO
): { h2Kg: number; o2Kg: number; waterKg: number; waterLiters: number } {
  const safeH2 = Math.max(0, h2Kg);
  const o2Kg = safeH2 * stoichRatio;
  const waterKg = safeH2 + o2Kg;
  const waterLiters = kgWaterToLiters(waterKg);
  return { h2Kg: safeH2, o2Kg, waterKg, waterLiters };
}

/**
 * Calculates usable stored chemical and electrical energy based strictly on the limiting reactant.
 * Ensures usable electricity is never inferred from hydrogen alone while ignoring oxygen.
 */
export function calculateUsableStoredEnergy(
  h2Kg: number,
  o2Kg: number,
  config: RFCConfig = DEFAULT_RFC_CONFIG
): {
  usableH2Kg: number;
  usableO2Kg: number;
  chemicalEnergyKWh: number;
  electricalEnergyKWh: number;
  limitingReactant: 'none' | 'hydrogen' | 'oxygen';
} {
  const availH2 = Math.max(0, h2Kg - config.minH2InventoryKg);
  const availO2 = Math.max(0, o2Kg - config.minO2InventoryKg);

  if (availH2 <= 0.00001 && availO2 <= 0.00001) {
    return {
      usableH2Kg: 0,
      usableO2Kg: 0,
      chemicalEnergyKWh: 0,
      electricalEnergyKWh: 0,
      limitingReactant: 'none',
    };
  }

  const o2EquivH2 = availO2 / config.stoichiometricO2PerH2Ratio;

  let usableH2Kg = 0;
  let limitingReactant: 'none' | 'hydrogen' | 'oxygen' = 'none';

  if (availH2 <= o2EquivH2) {
    usableH2Kg = availH2;
    limitingReactant = 'hydrogen';
  } else {
    usableH2Kg = o2EquivH2;
    limitingReactant = 'oxygen';
  }

  const usableO2Kg = usableH2Kg * config.stoichiometricO2PerH2Ratio;
  const chemicalEnergyKWh = usableH2Kg * HYDROGEN_LHV_KWH_PER_KG;
  const electricalEnergyKWh = chemicalEnergyKWh * config.fuelCellEfficiency;

  return {
    usableH2Kg: Number(usableH2Kg.toFixed(5)),
    usableO2Kg: Number(usableO2Kg.toFixed(5)),
    chemicalEnergyKWh: Number(chemicalEnergyKWh.toFixed(3)),
    electricalEnergyKWh: Number(electricalEnergyKWh.toFixed(3)),
    limitingReactant,
  };
}

/**
 * Creates a default RFC subsystem configuration.
 */
export function createDefaultRFCConfig(overrides?: Partial<RFCConfig>): RFCConfig {
  return {
    ...DEFAULT_RFC_CONFIG,
    ...overrides,
  };
}

/**
 * Creates an initialized, deterministic RFC subsystem state.
 */
export function createDefaultRFCState(
  overrides?: Partial<RFCState>,
  config: RFCConfig = DEFAULT_RFC_CONFIG
): RFCState {
  // Default: nominal half-charge buffer (7.5 kg H2 = 250 kWh chem, 60 kg O2)
  const h2StoredKg = overrides?.h2StoredKg ?? 7.5;
  const o2StoredKg = overrides?.o2StoredKg ?? 60.0;
  const h2CapacityKg = overrides?.h2CapacityKg ?? config.h2CapacityKg;
  const o2CapacityKg = overrides?.o2CapacityKg ?? config.o2CapacityKg;
  const waterInventoryL = overrides?.waterInventoryL ?? 250.0;

  const energy = calculateUsableStoredEnergy(h2StoredKg, o2StoredKg, config);

  const h2FillPct = Number(((h2StoredKg / h2CapacityKg) * 100.0).toFixed(2));
  const o2FillPct = Number(((o2StoredKg / o2CapacityKg) * 100.0).toFixed(2));

  return {
    mode: 'idle',
    isEnabled: overrides?.isEnabled ?? config.enabled,
    h2StoredKg,
    o2StoredKg,
    h2CapacityKg,
    o2CapacityKg,
    h2FillPct,
    o2FillPct,
    usableH2Kg: energy.usableH2Kg,
    storedChemicalEnergyKWh: energy.chemicalEnergyKWh,
    usableElectricalEnergyKWh: energy.electricalEnergyKWh,
    limitingReactant: energy.limitingReactant,
    waterInventoryL,
    cumulativeEnergyChargedKWh: 0.0,
    cumulativeEnergyDischargedKWh: 0.0,
    cumulativeLossesKWh: 0.0,
    cumulativeWaterConsumedL: 0.0,
    cumulativeWaterProducedL: 0.0,
    cumulativeWaterRecoveredL: 0.0,
    operatingHours: 0,
    unmetGenerationRequestsCount: 0,
    currentElectricalInputKW: 0.0,
    currentElectricalOutputKW: 0.0,
    ...overrides,
  };
}

// ============================================================================
// 5. ELECTROLYZER TRANSITION ENGINE (CHARGING)
// ============================================================================

/**
 * Executes a deterministic electrolyzer simulation step.
 * 
 * Consumes available electrical power and feedstock water to synthesize H₂ and O₂.
 * Enforces rated power limits, storage tank headroom, water availability, and conversion efficiency.
 */
export function stepElectrolyzer(input: ElectrolyzerStepInput): ElectrolyzerStepResult {
  const config = input.config ?? DEFAULT_RFC_CONFIG;
  const dt = input.dtHours ?? 1.0;
  const state = input.currentState;

  const availablePowerBudgetKW = Math.max(0, input.availablePowerBudgetKW);
  const availableWaterL = Math.max(0, input.availableWaterL);

  if (!state.isEnabled || !config.enabled || availablePowerBudgetKW <= 0.00001 || dt <= 0) {
    return {
      powerConsumedKW: 0,
      energyConsumedKWh: 0,
      chemicalEnergyStoredKWh: 0,
      conversionLossKWh: 0,
      h2ProducedKg: 0,
      o2ProducedKg: 0,
      waterRequestedL: 0,
      waterConsumedL: 0,
      waterUnavailableL: 0,
      unusedPowerBudgetKW: availablePowerBudgetKW,
      limitingFactor: !state.isEnabled || !config.enabled ? 'disabled' : 'power_budget',
    };
  }

  // 1. Calculate physical headroom in gas storage tanks
  const h2HeadroomKg = Math.max(0, config.h2CapacityKg - state.h2StoredKg);
  const o2HeadroomKg = Math.max(0, config.o2CapacityKg - state.o2StoredKg);

  if (h2HeadroomKg <= 0.00001) {
    return {
      powerConsumedKW: 0,
      energyConsumedKWh: 0,
      chemicalEnergyStoredKWh: 0,
      conversionLossKWh: 0,
      h2ProducedKg: 0,
      o2ProducedKg: 0,
      waterRequestedL: 0,
      waterConsumedL: 0,
      waterUnavailableL: 0,
      unusedPowerBudgetKW: availablePowerBudgetKW,
      limitingFactor: 'h2_capacity',
    };
  }

  if (o2HeadroomKg <= 0.00001) {
    return {
      powerConsumedKW: 0,
      energyConsumedKWh: 0,
      chemicalEnergyStoredKWh: 0,
      conversionLossKWh: 0,
      h2ProducedKg: 0,
      o2ProducedKg: 0,
      waterRequestedL: 0,
      waterConsumedL: 0,
      waterUnavailableL: 0,
      unusedPowerBudgetKW: availablePowerBudgetKW,
      limitingFactor: 'o2_capacity',
    };
  }

  // Maximum H2 that could be accommodated considering O2 tank headroom
  const maxH2ByO2TankKg = o2HeadroomKg / config.stoichiometricO2PerH2Ratio;

  // Maximum H2 producible from available feedstock water
  const maxH2ByWaterKg =
    litersToKgWater(availableWaterL, config.waterDensityKgPerL) /
    config.stoichiometricWaterPerH2Ratio;

  if (maxH2ByWaterKg <= 0.00001) {
    return {
      powerConsumedKW: 0,
      energyConsumedKWh: 0,
      chemicalEnergyStoredKWh: 0,
      conversionLossKWh: 0,
      h2ProducedKg: 0,
      o2ProducedKg: 0,
      waterRequestedL: 0,
      waterConsumedL: 0,
      waterUnavailableL: 0,
      unusedPowerBudgetKW: availablePowerBudgetKW,
      limitingFactor: 'water_shortage',
    };
  }

  // 2. Headroom-limited H2 production ceiling
  const allowedH2ProductionKg = Math.min(h2HeadroomKg, maxH2ByO2TankKg, maxH2ByWaterKg);

  // Maximum electrical energy required to produce allowedH2ProductionKg
  // E_chem = m_H2 * LHV. E_elec = E_chem / eta_ely.
  const maxElectrolyzerEnergyAllowedKWh =
    (allowedH2ProductionKg * HYDROGEN_LHV_KWH_PER_KG) / config.electrolyzerEfficiency;
  const maxElectrolyzerPowerAllowedKW = maxElectrolyzerEnergyAllowedKWh / dt;

  // 3. Determine actual operating power: Clamped by budget, rated power, and headroom limits
  const powerByBudgetKW = Math.min(availablePowerBudgetKW, config.electrolyzerRatedPowerKW);
  const actualPowerKW = Math.min(powerByBudgetKW, maxElectrolyzerPowerAllowedKW);

  if (actualPowerKW <= 0.00001) {
    return {
      powerConsumedKW: 0,
      energyConsumedKWh: 0,
      chemicalEnergyStoredKWh: 0,
      conversionLossKWh: 0,
      h2ProducedKg: 0,
      o2ProducedKg: 0,
      waterRequestedL: 0,
      waterConsumedL: 0,
      waterUnavailableL: 0,
      unusedPowerBudgetKW: availablePowerBudgetKW,
      limitingFactor:
        allowedH2ProductionKg === maxH2ByWaterKg
          ? 'water_shortage'
          : allowedH2ProductionKg === h2HeadroomKg
          ? 'h2_capacity'
          : 'o2_capacity',
    };
  }

  // 4. Energy and Chemical Synthesis Calculations
  const energyConsumedKWh = actualPowerKW * dt;
  const chemicalEnergyStoredKWh = energyConsumedKWh * config.electrolyzerEfficiency;
  const conversionLossKWh = energyConsumedKWh - chemicalEnergyStoredKWh;

  const h2ProducedKg = chemicalEnergyStoredKWh / HYDROGEN_LHV_KWH_PER_KG;
  const o2ProducedKg = h2ProducedKg * config.stoichiometricO2PerH2Ratio;
  const waterConsumedKg = h2ProducedKg + o2ProducedKg;
  const waterConsumedL = kgWaterToLiters(waterConsumedKg, config.waterDensityKgPerL);

  // Water requested if running at full powerByBudgetKW
  const fullRequestedEnergyKWh = powerByBudgetKW * dt;
  const fullH2Kg = (fullRequestedEnergyKWh * config.electrolyzerEfficiency) / HYDROGEN_LHV_KWH_PER_KG;
  const waterRequestedL = kgWaterToLiters(
    fullH2Kg * config.stoichiometricWaterPerH2Ratio,
    config.waterDensityKgPerL
  );
  const waterUnavailableL = Math.max(0, waterRequestedL - availableWaterL);

  const unusedPowerBudgetKW = Math.max(0, availablePowerBudgetKW - actualPowerKW);

  // Determine limiting factor
  let limitingFactor: ElectrolyzerStepResult['limitingFactor'] = 'none';
  if (Math.abs(actualPowerKW - config.electrolyzerRatedPowerKW) < 0.001) {
    limitingFactor = 'rated_power';
  } else if (Math.abs(actualPowerKW - availablePowerBudgetKW) < 0.001) {
    limitingFactor = 'power_budget';
  } else if (allowedH2ProductionKg === maxH2ByWaterKg) {
    limitingFactor = 'water_shortage';
  } else if (allowedH2ProductionKg === h2HeadroomKg) {
    limitingFactor = 'h2_capacity';
  } else if (allowedH2ProductionKg === maxH2ByO2TankKg) {
    limitingFactor = 'o2_capacity';
  }

  return {
    powerConsumedKW: Number(actualPowerKW.toFixed(4)),
    energyConsumedKWh: Number(energyConsumedKWh.toFixed(4)),
    chemicalEnergyStoredKWh: Number(chemicalEnergyStoredKWh.toFixed(4)),
    conversionLossKWh: Number(conversionLossKWh.toFixed(4)),
    h2ProducedKg: Number(h2ProducedKg.toFixed(5)),
    o2ProducedKg: Number(o2ProducedKg.toFixed(5)),
    waterRequestedL: Number(waterRequestedL.toFixed(4)),
    waterConsumedL: Number(waterConsumedL.toFixed(4)),
    waterUnavailableL: Number(waterUnavailableL.toFixed(4)),
    unusedPowerBudgetKW: Number(unusedPowerBudgetKW.toFixed(4)),
    limitingFactor,
  };
}

// ============================================================================
// 6. FUEL CELL TRANSITION ENGINE (DISCHARGING)
// ============================================================================

/**
 * Executes a deterministic fuel cell simulation step.
 * 
 * Consumes stored H₂ and O₂ to deliver DC electrical power to the habitat grid.
 * Enforces rated power limits, reactant stoichiometry, partial-load boundaries,
 * water production, and conversion efficiency.
 */
export function stepFuelCell(input: FuelCellStepInput): FuelCellStepResult {
  const config = input.config ?? DEFAULT_RFC_CONFIG;
  const dt = input.dtHours ?? 1.0;
  const state = input.currentState;

  const requestedPowerKW = Math.max(0, input.requestedPowerKW);

  if (!state.isEnabled || !config.enabled || requestedPowerKW <= 0.00001 || dt <= 0) {
    return {
      powerDeliveredKW: 0,
      energyDeliveredKWh: 0,
      chemicalEnergyConsumedKWh: 0,
      conversionLossKWh: 0,
      h2ConsumedKg: 0,
      o2ConsumedKg: 0,
      waterProducedL: 0,
      waterRecoverableL: 0,
      waterRecoveredL: 0,
      waterLossL: 0,
      unmetPowerKW: 0,
      limitingFactor: !state.isEnabled || !config.enabled ? 'disabled' : 'zero_request',
    };
  }

  // 1. Usable reactants strictly constrained by the limiting reactant
  const usableH2AvailableKg = Math.max(0, state.h2StoredKg - config.minH2InventoryKg);
  const usableO2AvailableKg = Math.max(0, state.o2StoredKg - config.minO2InventoryKg);

  if (usableH2AvailableKg <= 0.00001) {
    return {
      powerDeliveredKW: 0,
      energyDeliveredKWh: 0,
      chemicalEnergyConsumedKWh: 0,
      conversionLossKWh: 0,
      h2ConsumedKg: 0,
      o2ConsumedKg: 0,
      waterProducedL: 0,
      waterRecoverableL: 0,
      waterRecoveredL: 0,
      waterLossL: 0,
      unmetPowerKW: requestedPowerKW,
      limitingFactor: 'h2_depleted',
    };
  }

  if (usableO2AvailableKg <= 0.00001) {
    return {
      powerDeliveredKW: 0,
      energyDeliveredKWh: 0,
      chemicalEnergyConsumedKWh: 0,
      conversionLossKWh: 0,
      h2ConsumedKg: 0,
      o2ConsumedKg: 0,
      waterProducedL: 0,
      waterRecoverableL: 0,
      waterRecoveredL: 0,
      waterLossL: 0,
      unmetPowerKW: requestedPowerKW,
      limitingFactor: 'o2_depleted',
    };
  }

  // Limiting reactant check
  const o2EquivH2 = usableO2AvailableKg / config.stoichiometricO2PerH2Ratio;
  const usableH2Kg = Math.min(usableH2AvailableKg, o2EquivH2);

  // Maximum electrical energy deliverable given usable reactants
  // E_elec = m_H2 * LHV * eta_fc
  const maxDeliverableEnergyKWh =
    usableH2Kg * HYDROGEN_LHV_KWH_PER_KG * config.fuelCellEfficiency;
  const maxDeliverablePowerKW = maxDeliverableEnergyKWh / dt;

  // 2. Clamped operating power
  const powerClampedByRatingKW = Math.min(requestedPowerKW, config.fuelCellRatedPowerKW);
  const actualPowerKW = Math.min(powerClampedByRatingKW, maxDeliverablePowerKW);

  if (actualPowerKW <= 0.00001) {
    return {
      powerDeliveredKW: 0,
      energyDeliveredKWh: 0,
      chemicalEnergyConsumedKWh: 0,
      conversionLossKWh: 0,
      h2ConsumedKg: 0,
      o2ConsumedKg: 0,
      waterProducedL: 0,
      waterRecoverableL: 0,
      waterRecoveredL: 0,
      waterLossL: 0,
      unmetPowerKW: requestedPowerKW,
      limitingFactor: usableH2AvailableKg <= o2EquivH2 ? 'h2_depleted' : 'o2_depleted',
    };
  }

  // 3. Reactant Consumption & Water Production
  const energyDeliveredKWh = actualPowerKW * dt;
  const chemicalEnergyConsumedKWh = energyDeliveredKWh / config.fuelCellEfficiency;
  const conversionLossKWh = chemicalEnergyConsumedKWh - energyDeliveredKWh;

  const h2ConsumedKg = chemicalEnergyConsumedKWh / HYDROGEN_LHV_KWH_PER_KG;
  const o2ConsumedKg = h2ConsumedKg * config.stoichiometricO2PerH2Ratio;

  // Chemical reaction produces pure water: 1 kg H2 + r kg O2 = (1 + r) kg H2O
  const waterProducedKg = h2ConsumedKg + o2ConsumedKg;
  const waterProducedL = kgWaterToLiters(waterProducedKg, config.waterDensityKgPerL);

  const waterRecoverableL = waterProducedL;
  const waterRecoveredL = waterRecoverableL * config.waterRecoveryFraction;
  const waterLossL = waterRecoverableL - waterRecoveredL;

  const unmetPowerKW = Math.max(0, requestedPowerKW - actualPowerKW);

  // Determine limiting factor
  let limitingFactor: FuelCellStepResult['limitingFactor'] = 'none';
  if (unmetPowerKW > 0.001) {
    if (requestedPowerKW > config.fuelCellRatedPowerKW && actualPowerKW >= config.fuelCellRatedPowerKW - 0.001) {
      limitingFactor = 'rated_power';
    } else if (usableH2AvailableKg <= o2EquivH2) {
      limitingFactor = 'h2_depleted';
    } else {
      limitingFactor = 'o2_depleted';
    }
  } else if (Math.abs(actualPowerKW - config.fuelCellRatedPowerKW) < 0.001) {
    limitingFactor = 'rated_power';
  }

  return {
    powerDeliveredKW: Number(actualPowerKW.toFixed(4)),
    energyDeliveredKWh: Number(energyDeliveredKWh.toFixed(4)),
    chemicalEnergyConsumedKWh: Number(chemicalEnergyConsumedKWh.toFixed(4)),
    conversionLossKWh: Number(conversionLossKWh.toFixed(4)),
    h2ConsumedKg: Number(h2ConsumedKg.toFixed(5)),
    o2ConsumedKg: Number(o2ConsumedKg.toFixed(5)),
    waterProducedL: Number(waterProducedL.toFixed(4)),
    waterRecoverableL: Number(waterRecoverableL.toFixed(4)),
    waterRecoveredL: Number(waterRecoveredL.toFixed(4)),
    waterLossL: Number(waterLossL.toFixed(4)),
    unmetPowerKW: Number(unmetPowerKW.toFixed(4)),
    limitingFactor,
  };
}

// ============================================================================
// 7. COMPOSITE RFC SUBSYSTEM STEP
// ============================================================================

/**
 * Executes a complete, atomic RFC step.
 * 
 * Enforces:
 * 1. Mutual exclusivity: Electrolyzer and fuel cell do not run simultaneously in default mode.
 * 2. Gas inventory conservation with strict zero and capacity bounds.
 * 3. Water mass accounting and recovery tracking.
 * 4. Stored chemical energy recalculation based on the limiting gas.
 */
export function stepRFC(input: RFCStepInput): RFCStepResult {
  const config = input.config ?? DEFAULT_RFC_CONFIG;
  const dt = input.dtHours ?? 1.0;
  const state = input.currentState;

  // Determine dispatch intent
  const modeOverride = input.modeOverride ?? 'auto';

  let shouldElectrolyze = false;
  let shouldGenerate = false;

  if (state.isEnabled && config.enabled && modeOverride !== 'disabled') {
    if (modeOverride === 'electrolyzing') {
      shouldElectrolyze = input.availableSurplusPowerKW > 0.001;
    } else if (modeOverride === 'generating') {
      shouldGenerate = input.requestedDischargeKW > 0.001;
    } else if (modeOverride === 'auto') {
      // Automatic dispatch prioritizes generation if there is an active deficit,
      // or electrolysis if there is surplus power. Mutual exclusivity enforced.
      if (input.requestedDischargeKW > 0.001) {
        shouldGenerate = true;
      } else if (input.availableSurplusPowerKW > 0.001) {
        shouldElectrolyze = true;
      }
    }
  }

  // Enforce zero simultaneous operation in default mode
  const isSimultaneousOperationPrevented = !(shouldElectrolyze && shouldGenerate);
  if (shouldElectrolyze && shouldGenerate) {
    // If both are somehow requested simultaneously, prioritize generation to protect life support
    shouldElectrolyze = false;
  }

  // Execute electrolyzer if selected
  const availableWater = input.availableWaterL ?? state.waterInventoryL;
  const electrolyzerResult = shouldElectrolyze
    ? stepElectrolyzer({
        currentState: state,
        availablePowerBudgetKW: input.availableSurplusPowerKW,
        availableWaterL: availableWater,
        dtHours: dt,
        config,
      })
    : {
        powerConsumedKW: 0,
        energyConsumedKWh: 0,
        chemicalEnergyStoredKWh: 0,
        conversionLossKWh: 0,
        h2ProducedKg: 0,
        o2ProducedKg: 0,
        waterRequestedL: 0,
        waterConsumedL: 0,
        waterUnavailableL: 0,
        unusedPowerBudgetKW: input.availableSurplusPowerKW,
        limitingFactor: (!state.isEnabled || !config.enabled ? 'disabled' : 'none') as ElectrolyzerStepResult['limitingFactor'],
      };

  // Execute fuel cell if selected
  const fuelCellResult = shouldGenerate
    ? stepFuelCell({
        currentState: state,
        requestedPowerKW: input.requestedDischargeKW,
        dtHours: dt,
        config,
      })
    : {
        powerDeliveredKW: 0,
        energyDeliveredKWh: 0,
        chemicalEnergyConsumedKWh: 0,
        conversionLossKWh: 0,
        h2ConsumedKg: 0,
        o2ConsumedKg: 0,
        waterProducedL: 0,
        waterRecoverableL: 0,
        waterRecoveredL: 0,
        waterLossL: 0,
        unmetPowerKW: 0,
        limitingFactor: (!state.isEnabled || !config.enabled ? 'disabled' : 'none') as FuelCellStepResult['limitingFactor'],
      };

  // Update inventories with strict boundary clamping
  const nextH2 = Math.min(
    config.h2CapacityKg,
    Math.max(0, state.h2StoredKg + electrolyzerResult.h2ProducedKg - fuelCellResult.h2ConsumedKg)
  );
  const nextO2 = Math.min(
    config.o2CapacityKg,
    Math.max(0, state.o2StoredKg + electrolyzerResult.o2ProducedKg - fuelCellResult.o2ConsumedKg)
  );

  // Update water feedstock inventory: consumed by electrolysis, augmented by recovered product
  const nextWaterInventoryL = Math.max(
    0,
    state.waterInventoryL - electrolyzerResult.waterConsumedL + fuelCellResult.waterRecoveredL
  );

  // Recalculate usable stored energy based on updated inventories
  const energyMetrics = calculateUsableStoredEnergy(nextH2, nextO2, config);

  const h2FillPct = Number(((nextH2 / config.h2CapacityKg) * 100.0).toFixed(2));
  const o2FillPct = Number(((nextO2 / config.o2CapacityKg) * 100.0).toFixed(2));

  // Determine operating mode
  let operatingMode: RFCOperatingMode = 'idle';
  if (!state.isEnabled || !config.enabled || modeOverride === 'disabled') {
    operatingMode = 'unavailable';
  } else if (fuelCellResult.powerDeliveredKW > 0.001) {
    operatingMode = 'generating';
  } else if (electrolyzerResult.powerConsumedKW > 0.001) {
    operatingMode = 'electrolyzing';
  }

  const operatingHoursInc = operatingMode === 'electrolyzing' || operatingMode === 'generating' ? dt : 0;
  const unmetRequestsInc = fuelCellResult.unmetPowerKW > 0.001 ? 1 : 0;

  const totalLossKWh = electrolyzerResult.conversionLossKWh + fuelCellResult.conversionLossKWh;

  const nextState: RFCState = {
    mode: operatingMode,
    isEnabled: state.isEnabled && config.enabled && modeOverride !== 'disabled',
    h2StoredKg: Number(nextH2.toFixed(5)),
    o2StoredKg: Number(nextO2.toFixed(5)),
    h2CapacityKg: config.h2CapacityKg,
    o2CapacityKg: config.o2CapacityKg,
    h2FillPct,
    o2FillPct,
    usableH2Kg: energyMetrics.usableH2Kg,
    storedChemicalEnergyKWh: energyMetrics.chemicalEnergyKWh,
    usableElectricalEnergyKWh: energyMetrics.electricalEnergyKWh,
    limitingReactant: energyMetrics.limitingReactant,
    waterInventoryL: Number(nextWaterInventoryL.toFixed(4)),
    cumulativeEnergyChargedKWh: Number(
      (state.cumulativeEnergyChargedKWh + electrolyzerResult.energyConsumedKWh).toFixed(4)
    ),
    cumulativeEnergyDischargedKWh: Number(
      (state.cumulativeEnergyDischargedKWh + fuelCellResult.energyDeliveredKWh).toFixed(4)
    ),
    cumulativeLossesKWh: Number((state.cumulativeLossesKWh + totalLossKWh).toFixed(4)),
    cumulativeWaterConsumedL: Number(
      (state.cumulativeWaterConsumedL + electrolyzerResult.waterConsumedL).toFixed(4)
    ),
    cumulativeWaterProducedL: Number(
      (state.cumulativeWaterProducedL + fuelCellResult.waterProducedL).toFixed(4)
    ),
    cumulativeWaterRecoveredL: Number(
      (state.cumulativeWaterRecoveredL + fuelCellResult.waterRecoveredL).toFixed(4)
    ),
    operatingHours: Number((state.operatingHours + operatingHoursInc).toFixed(2)),
    unmetGenerationRequestsCount: state.unmetGenerationRequestsCount + unmetRequestsInc,
    currentElectricalInputKW: Number(electrolyzerResult.powerConsumedKW.toFixed(2)),
    currentElectricalOutputKW: Number(fuelCellResult.powerDeliveredKW.toFixed(2)),
  };

  const electricalInputKW = electrolyzerResult.powerConsumedKW;
  const electricalOutputKW = fuelCellResult.powerDeliveredKW;
  const netPowerFlowKW = electricalOutputKW - electricalInputKW;

  let limitingFactor = 'Nominal';
  if (operatingMode === 'electrolyzing' && electrolyzerResult.limitingFactor !== 'none') {
    limitingFactor = `Electrolyzer: ${electrolyzerResult.limitingFactor}`;
  } else if (operatingMode === 'generating' && fuelCellResult.limitingFactor !== 'none') {
    limitingFactor = `Fuel Cell: ${fuelCellResult.limitingFactor}`;
  } else if (energyMetrics.limitingReactant !== 'none') {
    limitingFactor = `Stored energy limited by ${energyMetrics.limitingReactant}`;
  }

  return {
    nextState,
    operatingMode,
    electricalInputKW,
    electricalOutputKW,
    netPowerFlowKW: Number(netPowerFlowKW.toFixed(4)),
    conversionLossKWh: Number(totalLossKWh.toFixed(4)),
    waterConsumedL: electrolyzerResult.waterConsumedL,
    waterProducedL: fuelCellResult.waterProducedL,
    waterRecoveredL: fuelCellResult.waterRecoveredL,
    electrolyzerResult,
    fuelCellResult,
    limitingFactor,
    isSimultaneousOperationPrevented,
  };
}
