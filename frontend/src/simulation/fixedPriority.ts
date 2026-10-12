/**
 * Astra Grid / HabitatOS — Fixed-Priority Baseline Controller
 * 
 * Baseline controller allocating electrical power to flexible tasks strictly
 * according to static configured priority (1 to 4) without predictive lookahead.
 * 
 * Operational Logic:
 * 1. Essential life-support loads (~40.1 kW) have absolute priority.
 * 2. Feasible power in the current hour (generation + safe battery discharge)
 *    is allocated to candidate tasks sorted by priority (1 = highest).
 * 3. Candidate tasks must satisfy earliest-start constraints and have remaining hours > 0.
 * 4. Dry-run evaluations through the shared resource model prevent task dispatches
 *    that would cause battery SoC to fall below the hard emergency reserve (20%)
 *    or curtail essential life-support loads.
 * 5. Uses zero horizon lookahead (purely reactive/myopic).
 */

import type {
  HabitatResourceState,
  ForecastHorizon,
  FlexibleTask,
  SafetyConstraints,
  ControllerDecision,
  SimulationController,
  HourlyForecast,
} from './types.ts';
import {
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import { evaluateProposedStep } from './safetyValidator.ts';

export class FixedPriorityController implements SimulationController {
  readonly id = 'fixed_priority' as const;
  readonly name = 'Fixed-Priority Controller';
  readonly description =
    'Myopic baseline allocating available power to flexible tasks strictly by static priority without horizon lookahead.';

  /**
   * Evaluates the current hour and selects flexible tasks strictly by static priority.
   */
  decideNextHour(
    currentState: HabitatResourceState,
    forecast: ForecastHorizon,
    pendingTasks: FlexibleTask[],
    constraints: SafetyConstraints = DEFAULT_SAFETY_CONSTRAINTS
  ): ControllerDecision {
    const currentHour = currentState.timestampHour;

    // Retrieve current hour's environmental conditions
    const currentForecast: HourlyForecast =
      forecast.hourlyForecasts.find((f) => f.hour === currentHour) ??
      forecast.hourlyForecasts[0] ?? {
        hour: currentHour,
        sunElevationDeg: 0,
        solarFluxW_m2: 0,
        solarGenerationKW: 0,
        nuclearGenerationKW: 40.0,
        essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW,
        dustOcclusionPct: 0,
        isEclipse: false,
      };

    // 1. Identify eligible tasks: started, not completed
    const eligibleTasks = pendingTasks.filter(
      (t) => t.remainingHours > 0.001 && currentHour >= t.earliestStartHour
    );

    // 2. Sort candidate tasks strictly by static priority (1 = highest, 4 = lowest)
    // Secondary sort: earliest deadline, then ID for determinism
    eligibleTasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.deadlineHour !== b.deadlineHour) {
        return a.deadlineHour - b.deadlineHour;
      }
      return a.id.localeCompare(b.id);
    });

    // 3. Greedily dispatch tasks in priority order using single-hour physical feasibility
    const activeTaskIds: string[] = [];
    const skippedReasons: string[] = [];

    for (const candidate of eligibleTasks) {
      const candidateDispatch = [...activeTaskIds, candidate.id];

      // Evaluate candidate dispatch against physical resource model
      const { isSafe, stepResult } = evaluateProposedStep(
        currentState,
        currentForecast,
        candidateDispatch,
        pendingTasks,
        constraints
      );

      // Verify that adding this task preserves essential loads and reserve floor
      const protectsEssential = stepResult.unmetEssentialLoadKW <= 0.001;
      const preservesReserve = stepResult.nextState.batterySocPct >= constraints.minBatterySocPct;

      if (isSafe && protectsEssential && preservesReserve) {
        activeTaskIds.push(candidate.id);
      } else {
        const reason = !protectsEssential
          ? 'curtails essential load'
          : !preservesReserve
          ? `breaches battery reserve (${stepResult.nextState.batterySocPct.toFixed(1)}% < ${constraints.minBatterySocPct}%)`
          : 'violates safety constraints';
        skippedReasons.push(`${candidate.name} (P${candidate.priority}): skipped (${reason})`);
      }
    }

    // 4. Compute final step projection with selected tasks
    const { stepResult: finalResult } = evaluateProposedStep(
      currentState,
      currentForecast,
      activeTaskIds,
      pendingTasks,
      constraints
    );

    const activeTasks = pendingTasks.filter((t) => activeTaskIds.includes(t.id));
    const flexibleLoadKW = activeTasks.reduce((sum, t) => sum + t.powerKW, 0);

    // Build rationale
    const rationaleParts: string[] = [
      `Hour ${currentHour}: Dispatched ${activeTaskIds.length}/${eligibleTasks.length} candidate tasks (${flexibleLoadKW.toFixed(1)} kW flexible load).`,
    ];
    if (activeTaskIds.length > 0) {
      rationaleParts.push(`Active: [${activeTaskIds.join(', ')}].`);
    }
    if (skippedReasons.length > 0) {
      rationaleParts.push(`Constrained: ${skippedReasons.join('; ')}.`);
    }
    if (finalResult.unmetEssentialLoadKW > 0.001) {
      rationaleParts.push(`CRITICAL: Essential life-support curtailed by ${finalResult.unmetEssentialLoadKW.toFixed(1)} kW.`);
    }

    return {
      hour: currentHour,
      controllerId: this.id,
      activeTaskIds,
      solarTrackingMode: currentForecast.isEclipse ? 'stow' : 'auto',
      flexibleLoadKW: Number(flexibleLoadKW.toFixed(2)),
      sheddedEssentialLoadKW: Number(finalResult.unmetEssentialLoadKW.toFixed(2)),
      projectedBatterySocPct: Number(finalResult.nextState.batterySocPct.toFixed(2)),
      projectedWaterLiters: Number(finalResult.nextState.potableWaterLiters.toFixed(2)),
      rationale: rationaleParts.join(' '),
    };
  }
}

/**
 * Creates an instance of the Fixed-Priority baseline controller.
 */
export function createFixedPriorityController(): FixedPriorityController {
  return new FixedPriorityController();
}
