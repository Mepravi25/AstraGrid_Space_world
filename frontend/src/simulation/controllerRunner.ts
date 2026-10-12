/**
 * Astra Grid / HabitatOS — Controller Simulation Runner
 * 
 * Execution harness advancing discrete-event simulation across defined
 * scenario horizons. Applies controller decisions strictly through the
 * shared physical resource model and safety validator.
 * 
 * Guarantees:
 * 1. Identical initial states and task pools across controllers.
 * 2. Absolute immutability: controllers cannot bypass physics or safety checks.
 * 3. Complete audit history of hourly energy, water, and task states.
 * 4. Standardized benchmark metrics adhering to data contracts in types.ts.
 */

import type {
  SimulationController,
  ControllerBenchmarkRun,
  BenchmarkMetrics,
  HourlyLogEntry,
  ComparativeBenchmarkReport,
  BatteryConfig,
  WaterConfig,
  SafetyConstraints,
  SafetyViolation,
  FlexibleTask,
} from './types.ts';
import type { ScenarioForecast } from './forecast.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
} from './types.ts';
import { stepResourceModel } from './resourceModel.ts';
import { validateStepResult, isHardSafetyViolation } from './safetyValidator.ts';

export interface ControllerRunnerOptions {
  batteryConfig?: BatteryConfig;
  waterConfig?: WaterConfig;
  safetyConstraints?: SafetyConstraints;
  /** Stop simulation early if catastrophic life-support curtailment occurs */
  stopOnCatastrophicFailure?: boolean;
}

/**
 * Executes a deterministic benchmark simulation of a controller on a given scenario.
 */
export function runControllerSimulation(
  scenario: ScenarioForecast,
  controller: SimulationController,
  options?: ControllerRunnerOptions
): ControllerBenchmarkRun {
  const batteryConfig = options?.batteryConfig ?? DEFAULT_BATTERY_CONFIG;
  const waterConfig = options?.waterConfig ?? DEFAULT_WATER_CONFIG;
  const constraints = options?.safetyConstraints ?? DEFAULT_SAFETY_CONSTRAINTS;
  const horizonHours = scenario.horizon.horizonHours;

  // Deep clone initial state and task pool to ensure identical baseline
  let currentState = { ...scenario.initialState };
  let tasks: FlexibleTask[] = scenario.defaultTasks.map((t) => ({ ...t }));

  const hourlyHistory: HourlyLogEntry[] = [];
  const allViolations: SafetyViolation[] = [];
  let safeOperatingTimeHours = horizonHours;
  let firstViolationRecorded = false;
  let essentialServiceInterruptionsHours = 0;

  // Track task completion hours: taskId -> completionHour
  const taskCompletionHours = new Map<string, number>();

  for (let h = 0; h < horizonHours; h++) {
    const currentForecast = scenario.horizon.hourlyForecasts[h];

    // Build lookahead horizon slice starting at current hour
    const lookaheadHorizon = {
      startHour: h,
      horizonHours: horizonHours - h,
      hourlyForecasts: scenario.horizon.hourlyForecasts.slice(h),
    };

    // 1. Controller produces decision
    const decision = controller.decideNextHour(
      currentState,
      lookaheadHorizon,
      tasks,
      constraints
    );

    // 2. Physical state transition strictly through shared resource model
    const stepResult = stepResourceModel({
      currentState,
      solarGenerationKW: currentForecast.solarGenerationKW,
      backupGenerationKW: currentForecast.nuclearGenerationKW,
      essentialDemandKW: currentForecast.essentialDemandKW,
      batteryConfig,
      waterConfig,
      safetyConstraints: constraints,
      tasks,
      dispatchedTaskIds: decision.activeTaskIds,
    });

    // 3. Safety validation audit
    const validation = validateStepResult(stepResult, constraints, batteryConfig, waterConfig);
    const stepViolations = validation.violations;

    if (stepViolations.length > 0) {
      allViolations.push(...stepViolations);
      const hasHard = stepViolations.some((v) => isHardSafetyViolation(v));
      if (hasHard && !firstViolationRecorded) {
        safeOperatingTimeHours = h;
        firstViolationRecorded = true;
      }
    }

    if (stepResult.unmetEssentialLoadKW > 0.001) {
      essentialServiceInterruptionsHours++;
    }

    // 4. Track task completions
    for (const completedId of stepResult.completedTaskIds) {
      if (!taskCompletionHours.has(completedId)) {
        taskCompletionHours.set(completedId, h + 1);
      }
    }

    // 5. Record hourly history
    hourlyHistory.push({
      hour: h,
      generationKW: stepResult.generationKW,
      demandKW: stepResult.demandKW,
      netPowerKW: stepResult.netPowerKW,
      batterySocPct: stepResult.nextState.batterySocPct,
      batteryStoredKWh: stepResult.nextState.batteryStoredKWh,
      waterLiters: stepResult.nextState.potableWaterLiters,
      activeTasks: stepResult.activeTaskIds,
      safetyViolationCount: stepViolations.length,
    });

    // Advance state and task definitions
    currentState = stepResult.nextState;
    tasks = stepResult.updatedTasks;

    // Optional early exit on catastrophic collapse
    if (options?.stopOnCatastrophicFailure && stepResult.nextState.isLifeSupportCompromised) {
      break;
    }
  }

  // 6. Compute aggregate benchmark metrics
  const totalTaskCount = scenario.defaultTasks.length;
  let completedTaskCount = 0;
  let accumulatedTaskDelayHours = 0;

  for (const initialTask of scenario.defaultTasks) {
    const finishHour = taskCompletionHours.get(initialTask.id);
    const finalTaskState = tasks.find((t) => t.id === initialTask.id);
    const isFinished = finalTaskState ? finalTaskState.remainingHours <= 0.001 : false;

    if (isFinished && finishHour !== undefined) {
      if (finishHour <= initialTask.deadlineHour) {
        completedTaskCount++;
      } else {
        // Completed but late
        accumulatedTaskDelayHours += finishHour - initialTask.deadlineHour;
      }
    } else {
      // Unfinished task: accumulated delay relative to deadline
      const delayPastDeadline = Math.max(0, horizonHours - initialTask.deadlineHour);
      accumulatedTaskDelayHours += delayPastDeadline;
    }
  }

  const taskCompletionRatePct =
    totalTaskCount > 0 ? Number(((completedTaskCount / totalTaskCount) * 100.0).toFixed(1)) : 100.0;

  const hardViolationsCount = allViolations.filter((v) => isHardSafetyViolation(v)).length;
  const survivedFullScenario = !firstViolationRecorded && hardViolationsCount === 0;

  const metrics: BenchmarkMetrics = {
    safeOperatingTimeHours,
    essentialServiceInterruptionsHours,
    waterDeficitLiters: currentState.cumulativeUnmetWaterL ?? 0,
    backupEnergyConsumedKWh: currentState.backupEnergyUsedKWh,
    completedTaskCount,
    totalTaskCount,
    taskCompletionRatePct,
    accumulatedTaskDelayHours,
    survivedFullScenario,
  };

  return {
    controllerId: controller.id,
    controllerName: controller.name,
    scenarioId: scenario.scenarioId,
    scenarioName: scenario.scenarioName,
    totalDurationHours: horizonHours,
    metrics,
    hourlyHistory,
  };
}

/**
 * Runs a comparative benchmark across multiple controllers on the exact same scenario.
 */
export function runComparativeSimulation(
  scenario: ScenarioForecast,
  controllers: SimulationController[],
  options?: ControllerRunnerOptions
): ComparativeBenchmarkReport {
  const runs: Record<string, ControllerBenchmarkRun> = {};

  for (const controller of controllers) {
    runs[controller.id] = runControllerSimulation(scenario, controller, options);
  }

  return {
    scenarioId: scenario.scenarioId,
    scenarioName: scenario.scenarioName,
    scenarioDescription: scenario.detailedDescription,
    horizonHours: scenario.horizon.horizonHours,
    runs: runs as Record<any, ControllerBenchmarkRun>,
    timestampIso: new Date().toISOString(),
  };
}
