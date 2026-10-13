/**
 * Astra Grid / HabitatOS — Energy Resilience & RFC Benchmark Scenarios (A through H)
 * 
 * Deterministic test scenarios and comparative harness evaluating:
 * 1. Baseline controller without RFC dispatch (battery only)
 * 2. RFC-enabled controller under identical physical constraints
 * 
 * Scenarios:
 * A. Normal sunlight (Surplus charges battery then RFC electrolyzer)
 * B. Short solar interruption (Battery supplies power safely)
 * C. Extended solar shortage (Battery hits reserve -> RFC fuel cell takes over -> load shedding)
 * D. Battery depleted, RFC charged (RFC fuel cell powers load within rating)
 * E. Battery depleted, RFC partially charged (Partial generation then honest deficit reporting)
 * F. Battery depleted, RFC depleted (Both empty -> 0 credit -> honest deficit reported)
 * G. Insufficient reactant (O₂ or H₂ scarce -> output clamped by limiting reactant)
 * H. Recovery after sunlight returns (Resumes essential loads, restores battery, then RFC charging)
 */

import type {
  HabitatResourceState,
  FlexibleTask,
  StepResult,
  RFCConfig,
  BatteryConfig,
  SafetyConstraints,
} from './types.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  DEFAULT_RFC_CONFIG,
  TOTAL_ESSENTIAL_LOAD_KW,
  createDefaultResourceState,
} from './types.ts';
import { stepResourceModel } from './resourceModel.ts';
import { createDefaultRFCState } from './rfcModel.ts';

export type ResilienceScenarioId =
  | 'SCENARIO_A_NORMAL_SUNLIGHT'
  | 'SCENARIO_B_SHORT_INTERRUPTION'
  | 'SCENARIO_C_EXTENDED_SHORTAGE'
  | 'SCENARIO_D_BATTERY_DEPLETED_RFC_CHARGED'
  | 'SCENARIO_E_BATTERY_DEPLETED_RFC_PARTIAL'
  | 'SCENARIO_F_BOTH_DEPLETED'
  | 'SCENARIO_G_INSUFFICIENT_REACTANT'
  | 'SCENARIO_H_RECOVERY';

export interface HourlyScenarioCondition {
  solarGenerationKW: number;
  backupGenerationKW: number;
  essentialDemandKW?: number;
  tasks?: FlexibleTask[];
  dispatchedTaskIds?: string[];
}

export interface ResilienceScenarioDefinition {
  id: ResilienceScenarioId;
  name: string;
  description: string;
  createInitialState: () => HabitatResourceState;
  steps: HourlyScenarioCondition[];
}

export interface ResilienceRunMetrics {
  totalHours: number;
  timeUntilFirstEssentialDeficitHours: number | null;
  cumulativeUnmetEssentialEnergyKWh: number;
  batteryMinSocPct: number;
  batteryFinalSocPct: number;
  rfcElectricityDeliveredKWh: number;
  totalRFCEnergyConsumedKWh: number;
  flexibleTaskDelayHours: number;
  criticalShortagesCount: number;
  criticalShortageDurationHours: number;
  finalEnergyManagementState: string;
  finalDeficitType: string;
}

export interface ScenarioComparisonReport {
  scenarioId: ResilienceScenarioId;
  scenarioName: string;
  description: string;
  baseline: ResilienceRunMetrics;
  rfcEnabled: ResilienceRunMetrics;
  summary: {
    essentialDeficitDelayedByHours: number;
    essentialEnergySavedKWh: number;
    rfcDeliveredNetKWh: number;
    explanation: string;
  };
}

/**
 * Builds the 8 deterministic benchmark scenarios according to Module 10 specification.
 */
export function getResilienceScenarios(): Record<ResilienceScenarioId, ResilienceScenarioDefinition> {
  return {
    SCENARIO_A_NORMAL_SUNLIGHT: {
      id: 'SCENARIO_A_NORMAL_SUNLIGHT',
      name: 'Scenario A: Normal Sunlight & Surplus Storage',
      description:
        'Continuous high solar irradiance. Solar generation meets essential and flexible demand, charges battery to nominal ceiling, and uses permitted surplus for RFC electrolysis.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 400.0, // 80% SoC
          batterySocPct: 80.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 2.0,
            o2StoredKg: 16.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 100.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 110.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 120.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 115.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
      ],
    },

    SCENARIO_B_SHORT_INTERRUPTION: {
      id: 'SCENARIO_B_SHORT_INTERRUPTION',
      name: 'Scenario B: Short Solar Interruption',
      description:
        'Solar generation drops to 0 kW for 3 hours. Battery at 70% supplies power within safety limits without breaching reserve or requiring emergency fuel cell.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 350.0, // 70% SoC
          batterySocPct: 70.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 10.0,
            o2StoredKg: 80.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
      ],
    },

    SCENARIO_C_EXTENDED_SHORTAGE: {
      id: 'SCENARIO_C_EXTENDED_SHORTAGE',
      name: 'Scenario C: Extended Solar Shortage',
      description:
        'Multi-hour total eclipse. Battery starts near reserve (22% = 110 kWh). Battery quickly hits 20% reserve floor; RFC fuel cell activates from stored fuel to protect essential life support.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 110.0, // 22% SoC, only 10 kWh above 20% (100 kWh) reserve
          batterySocPct: 22.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 12.0,
            o2StoredKg: 96.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 50.0 }, // 10 kW deficit (10 kWh drained from battery)
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 50.0 }, // Battery hits reserve floor -> RFC supplies remaining 10 kW
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 50.0 }, // RFC continues supplying 10 kW
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 50.0 }, // RFC continues supplying 10 kW
      ],
    },

    SCENARIO_D_BATTERY_DEPLETED_RFC_CHARGED: {
      id: 'SCENARIO_D_BATTERY_DEPLETED_RFC_CHARGED',
      name: 'Scenario D: Battery Depleted, RFC Fully Charged',
      description:
        'Battery is at its 20% hard reserve floor (zero safe discharge available). Full RFC reactant storage supplies power up to its 15 kW rating.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 100.0, // 20.0% SoC
          batterySocPct: 20.0,
          isEmergencyReserveBreached: false,
          rfcState: createDefaultRFCState({
            h2StoredKg: 15.0,
            o2StoredKg: 120.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 52.0 }, // 12 kW net deficit covered by RFC
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 52.0 },
      ],
    },

    SCENARIO_E_BATTERY_DEPLETED_RFC_PARTIAL: {
      id: 'SCENARIO_E_BATTERY_DEPLETED_RFC_PARTIAL',
      name: 'Scenario E: Battery Depleted, RFC Partially Charged',
      description:
        'Battery at 20% reserve. RFC has scarce hydrogen (0.2 kg H2 ≈ 4.0 kWh deliverable). Fuel cell delivers available energy then stops; remaining deficit is reported honestly.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 100.0,
          batterySocPct: 20.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 0.2, // Small amount of reactant
            o2StoredKg: 5.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 55.0 }, // 15 kW requested deficit -> RFC can only deliver ~4 kW, rest unmet
      ],
    },

    SCENARIO_F_BOTH_DEPLETED: {
      id: 'SCENARIO_F_BOTH_DEPLETED',
      name: 'Scenario F: Battery Depleted, RFC Depleted',
      description:
        'Battery at 20% reserve floor and RFC reactants completely exhausted. No electricity fabricated. Nuclear baseload 40 kW supplies life support up to rating; 0.1 kW essential deficit reported honestly.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 100.0,
          batterySocPct: 20.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 0.0,
            o2StoredKg: 0.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 40.1 },
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 40.1 },
      ],
    },

    SCENARIO_G_INSUFFICIENT_REACTANT: {
      id: 'SCENARIO_G_INSUFFICIENT_REACTANT',
      name: 'Scenario G: Insufficient Reactants (Stoichiometric Asymmetry)',
      description:
        'Battery at 20% reserve floor. RFC has 10 kg of H₂ but 0.0 kg of O₂. Generation is clamped to 0 kW by the limiting reactant. Deficit reported honestly.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 100.0,
          batterySocPct: 20.0,
          rfcState: createDefaultRFCState({
            h2StoredKg: 10.0,
            o2StoredKg: 0.0, // Zero oxygen available
          }),
        }),
      steps: [
        { solarGenerationKW: 0.0, backupGenerationKW: 40.0, essentialDemandKW: 50.0 },
      ],
    },

    SCENARIO_H_RECOVERY: {
      id: 'SCENARIO_H_RECOVERY',
      name: 'Scenario H: Recovery After Sunlight Returns',
      description:
        'Starts following a power shortage. Sun rises again (solar array produces 120 kW). System enters RECOVERY state, satisfies essential loads, restores battery reserves, then resumes RFC electrolysis.',
      createInitialState: () =>
        createDefaultResourceState({
          batteryStoredKWh: 100.0,
          batterySocPct: 20.0,
          energyManagementState: 'CRITICAL_POWER_SHORTAGE',
          shortageDurationHours: 4,
          rfcState: createDefaultRFCState({
            h2StoredKg: 0.5,
            o2StoredKg: 4.0,
          }),
        }),
      steps: [
        { solarGenerationKW: 120.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
        { solarGenerationKW: 120.0, backupGenerationKW: 40.0, essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW },
      ],
    },
  };
}

/**
 * Runs a deterministic simulation on a resilience scenario.
 */
export function runResilienceScenario(
  scenario: ResilienceScenarioDefinition,
  options?: {
    enableRFC?: boolean;
    rfcConfig?: RFCConfig;
    batteryConfig?: BatteryConfig;
    safetyConstraints?: SafetyConstraints;
  }
): {
  metrics: ResilienceRunMetrics;
  history: StepResult[];
} {
  const enableRFC = options?.enableRFC ?? true;
  const rfcConfig = options?.rfcConfig ?? DEFAULT_RFC_CONFIG;
  const batteryConfig = options?.batteryConfig ?? DEFAULT_BATTERY_CONFIG;
  const safetyConstraints = options?.safetyConstraints ?? DEFAULT_SAFETY_CONSTRAINTS;

  let currentState = scenario.createInitialState();
  const history: StepResult[] = [];

  let timeUntilFirstEssentialDeficitHours: number | null = null;
  let minSoc = currentState.batterySocPct;
  let rfcDeliveredKWh = 0;
  let rfcConsumedKWh = 0;
  let criticalShortagesCount = 0;
  let criticalShortageHours = 0;

  for (let i = 0; i < scenario.steps.length; i++) {
    const stepDef = scenario.steps[i];

    // Enforce battery safety reserve floor: only discharge energy safely available above minSoc (20%)
    const minReserveKWh = batteryConfig.capacityKWh * (safetyConstraints.minBatterySocPct / 100.0);
    const safeDischargeKW = Math.max(
      0,
      ((currentState.batteryStoredKWh - minReserveKWh) * batteryConfig.dischargeEfficiency) / 1.0
    );

    const stepRes = stepResourceModel({
      currentState,
      solarGenerationKW: stepDef.solarGenerationKW,
      backupGenerationKW: stepDef.backupGenerationKW,
      essentialDemandKW: stepDef.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW,
      batteryConfig,
      safetyConstraints,
      batteryDischargeLimitKW: safeDischargeKW,
      enableRFC,
      rfcConfig: { ...rfcConfig, enabled: enableRFC },
      tasks: stepDef.tasks,
      dispatchedTaskIds: stepDef.dispatchedTaskIds,
    });

    history.push(stepRes);

    if (stepRes.nextState.batterySocPct < minSoc) {
      minSoc = stepRes.nextState.batterySocPct;
    }

    if (stepRes.rfcGenerationKW) {
      rfcDeliveredKWh += stepRes.rfcGenerationKW * 1.0;
    }
    if (stepRes.rfcChargeKW) {
      rfcConsumedKWh += stepRes.rfcChargeKW * 1.0;
    }

    if (stepRes.unmetEssentialLoadKW > 0.001) {
      if (timeUntilFirstEssentialDeficitHours === null) {
        timeUntilFirstEssentialDeficitHours = i;
      }
      criticalShortagesCount++;
      criticalShortageHours += 1.0;
    }

    currentState = stepRes.nextState;
  }

  const finalStep = history[history.length - 1];

  const metrics: ResilienceRunMetrics = {
    totalHours: scenario.steps.length,
    timeUntilFirstEssentialDeficitHours,
    cumulativeUnmetEssentialEnergyKWh: finalStep?.cumulativeUnmetEssentialEnergyKWh ?? 0,
    batteryMinSocPct: Number(minSoc.toFixed(2)),
    batteryFinalSocPct: Number(currentState.batterySocPct.toFixed(2)),
    rfcElectricityDeliveredKWh: Number(rfcDeliveredKWh.toFixed(2)),
    totalRFCEnergyConsumedKWh: Number(rfcConsumedKWh.toFixed(2)),
    flexibleTaskDelayHours: 0,
    criticalShortagesCount,
    criticalShortageDurationHours: criticalShortageHours,
    finalEnergyManagementState: currentState.energyManagementState ?? 'NORMAL',
    finalDeficitType: currentState.deficitType ?? 'NONE',
  };

  return { metrics, history };
}

/**
 * Runs identical comparative evaluation between Baseline (no RFC) and RFC-Enabled systems.
 */
export function compareBaselineVsRFC(
  scenarioId: ResilienceScenarioId,
  rfcConfig?: RFCConfig
): ScenarioComparisonReport {
  const scenarios = getResilienceScenarios();
  const scenario = scenarios[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown scenario ID: ${scenarioId}`);
  }

  const baselineRun = runResilienceScenario(scenario, { enableRFC: false });
  const rfcRun = runResilienceScenario(scenario, { enableRFC: true, rfcConfig });

  const deficitDelayedBy =
    baselineRun.metrics.timeUntilFirstEssentialDeficitHours !== null &&
    rfcRun.metrics.timeUntilFirstEssentialDeficitHours === null
      ? scenario.steps.length - baselineRun.metrics.timeUntilFirstEssentialDeficitHours
      : (rfcRun.metrics.timeUntilFirstEssentialDeficitHours ?? scenario.steps.length) -
        (baselineRun.metrics.timeUntilFirstEssentialDeficitHours ?? scenario.steps.length);

  const energySaved = Math.max(
    0,
    baselineRun.metrics.cumulativeUnmetEssentialEnergyKWh -
      rfcRun.metrics.cumulativeUnmetEssentialEnergyKWh
  );

  let explanation = '';
  if (energySaved > 0) {
    explanation = `RFC provided ${rfcRun.metrics.rfcElectricityDeliveredKWh.toFixed(
      1
    )} kWh of electricity from stored chemical energy, preventing ${energySaved.toFixed(
      1
    )} kWh of essential life-support curtailment.`;
  } else if (rfcRun.metrics.totalRFCEnergyConsumedKWh > 0) {
    explanation = `RFC electrolyzer safely absorbed ${rfcRun.metrics.totalRFCEnergyConsumedKWh.toFixed(
      1
    )} kWh of surplus solar power, creating chemical fuel without compromising battery charging.`;
  } else {
    explanation = `Identical outcome under physical constraints: RFC operated strictly within reactant mass and power bounds.`;
  }

  return {
    scenarioId,
    scenarioName: scenario.name,
    description: scenario.description,
    baseline: baselineRun.metrics,
    rfcEnabled: rfcRun.metrics,
    summary: {
      essentialDeficitDelayedByHours: Math.max(0, deficitDelayedBy),
      essentialEnergySavedKWh: Number(energySaved.toFixed(2)),
      rfcDeliveredNetKWh: rfcRun.metrics.rfcElectricityDeliveredKWh,
      explanation,
    },
  };
}
