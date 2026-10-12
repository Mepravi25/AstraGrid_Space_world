/**
 * Astra Grid / HabitatOS — Solar-Aware Heuristic Scheduler
 * 
 * Baseline controller utilizing the 24-hour environmental solar forecast to align
 * flexible loads with periods of elevated solar generation, avoiding battery
 * depletion during eclipse or low-irradiance conditions.
 * 
 * Operational Logic:
 * 1. Essential life-support loads (~40.1 kW) have absolute priority.
 * 2. Uses the 24-hour solar generation forecast across each task's valid window
 *    [currentHour, deadlineHour] to determine scheduling suitability.
 * 3. Tasks with deadline slack (slack = (deadline - hour) - remainingHours > 0)
 *    are deferred during eclipse or low-solar hours if sufficient higher-irradiance
 *    hours exist before the deadline.
 * 4. Tasks with zero or negative slack (slack <= 0) are treated as critical and
 *    attempted immediately to minimize deadline breaches.
 * 5. Respects identical hard safety constraints as the fixed-priority controller:
 *    never curtails essential load or draws battery below 20% SoC.
 * 6. Avoids joint multi-resource mathematical optimization (reserved for Astra Grid Phase 3B).
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

export class SolarAwareScheduler implements SimulationController {
  readonly id = 'solar_aware' as const;
  readonly name = 'Solar-Aware Heuristic Scheduler';
  readonly description =
    'Heuristic scheduler utilizing 24h solar forecasts to align flexible loads with anticipated solar availability while enforcing deadlines and safety limits.';

  /**
   * Evaluates solar forecasts across the horizon and dispatches flexible tasks.
   */
  decideNextHour(
    currentState: HabitatResourceState,
    forecast: ForecastHorizon,
    pendingTasks: FlexibleTask[],
    constraints: SafetyConstraints = DEFAULT_SAFETY_CONSTRAINTS
  ): ControllerDecision {
    const currentHour = currentState.timestampHour;

    // Retrieve current hour's forecast
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

    // Build forecast lookup by hour
    const forecastMap = new Map<number, HourlyForecast>();
    for (const entry of forecast.hourlyForecasts) {
      forecastMap.set(entry.hour, entry);
    }

    // 1. Identify eligible tasks: started, remaining > 0
    const eligibleTasks = pendingTasks.filter(
      (t) => t.remainingHours > 0.001 && currentHour >= t.earliestStartHour
    );

    // 2. Classify tasks based on deadline slack and solar opportunity
    interface ScoredTask {
      task: FlexibleTask;
      slackHours: number;
      isUrgent: boolean;
      shouldRunInCurrentSolar: boolean;
      reason: string;
    }

    const evaluatedTasks: ScoredTask[] = [];
    const infeasibleNotes: string[] = [];

    const currentSolarKW = currentForecast.solarGenerationKW;
    const isCurrentEclipse = currentForecast.isEclipse || currentSolarKW <= 0.1;

    for (const task of eligibleTasks) {
      const windowHours = Math.max(1, task.deadlineHour - currentHour);
      const slackHours = windowHours - task.remainingHours;
      const isUrgent = slackHours <= 0;

      // Collect future solar generation values within the task's remaining window
      const futureHours: number[] = [];
      for (let h = currentHour; h < task.deadlineHour; h++) {
        futureHours.push(h);
      }

      // Count hours in the remaining window with strictly higher solar generation
      const higherSolarHoursCount = futureHours.filter((h) => {
        const f = forecastMap.get(h);
        return f && f.solarGenerationKW > currentSolarKW + 1.0;
      }).length;

      let shouldRun = false;
      let reason = '';

      if (isUrgent) {
        // Zero slack: task must run now to prevent or minimize deadline failure
        shouldRun = true;
        reason = `Urgent (slack: ${slackHours.toFixed(1)}h <= 0)`;
      } else if (isCurrentEclipse) {
        // In shadow/eclipse, and task has slack to wait for daylight
        shouldRun = false;
        reason = `Deferred (in eclipse; slack: ${slackHours.toFixed(1)}h)`;
      } else if (higherSolarHoursCount >= task.remainingHours) {
        // Sufficient future hours have superior solar generation: defer to peak solar
        shouldRun = false;
        reason = `Deferred to future solar peaks (${higherSolarHoursCount} better hours remaining)`;
      } else {
        // Current hour is a prime solar opportunity or needed to meet schedule
        shouldRun = true;
        reason = `Favorable solar (${currentSolarKW.toFixed(1)} kW; ${higherSolarHoursCount} peak hours left)`;
      }

      // Check if task is already past deadline or physically infeasible
      if (currentHour > task.deadlineHour) {
        infeasibleNotes.push(`Task "${task.name}" is past deadline (${task.deadlineHour}h)`);
      } else if (futureHours.length < task.remainingHours) {
        infeasibleNotes.push(
          `Task "${task.name}" has ${task.remainingHours.toFixed(1)}h remaining but only ${futureHours.length}h left before deadline`
        );
      }

      evaluatedTasks.push({
        task,
        slackHours,
        isUrgent,
        shouldRunInCurrentSolar: shouldRun,
        reason,
      });
    }

    // 3. Filter candidates that want to run now, and sort them
    // Sorting order:
    // a) Urgent tasks first (slack <= 0)
    // b) Priority (1 = highest)
    // c) Deadline hour
    // d) ID for determinism
    const candidatesToSchedule = evaluatedTasks
      .filter((et) => et.shouldRunInCurrentSolar)
      .sort((a, b) => {
        if (a.isUrgent !== b.isUrgent) {
          return a.isUrgent ? -1 : 1;
        }
        if (a.task.priority !== b.task.priority) {
          return a.task.priority - b.task.priority;
        }
        if (a.task.deadlineHour !== b.task.deadlineHour) {
          return a.task.deadlineHour - b.task.deadlineHour;
        }
        return a.task.id.localeCompare(b.task.id);
      });

    // 4. Feasibility check: Greedily dispatch candidate tasks while respecting hard safety limits
    const activeTaskIds: string[] = [];
    const skippedReasons: string[] = [];

    for (const item of candidatesToSchedule) {
      const candidateDispatch = [...activeTaskIds, item.task.id];

      const { isSafe, stepResult } = evaluateProposedStep(
        currentState,
        currentForecast,
        candidateDispatch,
        pendingTasks,
        constraints
      );

      const protectsEssential = stepResult.unmetEssentialLoadKW <= 0.001;
      const preservesReserve = stepResult.nextState.batterySocPct >= constraints.minBatterySocPct;

      if (isSafe && protectsEssential && preservesReserve) {
        activeTaskIds.push(item.task.id);
      } else {
        const limitReason = !protectsEssential
          ? 'curtails essential load'
          : !preservesReserve
          ? `breaches battery reserve (${stepResult.nextState.batterySocPct.toFixed(1)}% < ${constraints.minBatterySocPct}%)`
          : 'violates safety limits';
        skippedReasons.push(`${item.task.name}: skipped (${limitReason})`);
      }
    }

    // 5. Compute final step projection with selected tasks
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
      `Hour ${currentHour}: Solar-aware scheduled ${activeTaskIds.length}/${eligibleTasks.length} tasks (${flexibleLoadKW.toFixed(1)} kW flexible).`,
      `Solar: ${currentSolarKW.toFixed(1)} kW (${isCurrentEclipse ? 'ECLIPSE' : 'SUNLIT'}).`,
    ];
    if (activeTaskIds.length > 0) {
      rationaleParts.push(`Dispatched: [${activeTaskIds.join(', ')}].`);
    }
    const deferredList = evaluatedTasks.filter((et) => !et.shouldRunInCurrentSolar);
    if (deferredList.length > 0) {
      rationaleParts.push(
        `Solar-deferred: [${deferredList.map((d) => `${d.task.name} (${d.reason})`).join('; ')}].`
      );
    }
    if (skippedReasons.length > 0) {
      rationaleParts.push(`Safety-constrained: ${skippedReasons.join('; ')}.`);
    }
    if (infeasibleNotes.length > 0) {
      rationaleParts.push(`Infeasible warnings: ${infeasibleNotes.join('; ')}.`);
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
 * Creates an instance of the Solar-Aware heuristic scheduler.
 */
export function createSolarAwareScheduler(): SolarAwareScheduler {
  return new SolarAwareScheduler();
}
