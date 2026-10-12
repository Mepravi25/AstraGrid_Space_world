/**
 * Astra Grid / HabitatOS — Predictive Mission-Continuity Optimizer
 * 
 * Predictive, cross-resource controller evaluating downstream consequences
 * of electrical and fluid resource-allocation decisions across a rolling horizon.
 * 
 * Methodological Framework:
 * 1. Rolling-Horizon Discrete Beam Search:
 *    Explores feasible candidate action combinations over a lookahead horizon.
 * 2. Model-Based Projection:
 *    Simulates state transitions strictly through stepResourceModel() in isolation.
 * 3. Cross-Resource Coupling:
 *    Jointly accounts for electrical storage (BESS), fluid distillation (VCD),
 *    waste inventories, and task progress/deadlines.
 * 4. Multi-Objective Scoring:
 *    Ranks safe candidate plans on essential continuity, reserve margins,
 *    task completion, and waste minimization. Hard safety constraints are
 *    strictly enforced prior to scoring.
 * 5. Receding-Horizon Control:
 *    Returns the immediate action required for the current timestep (hour h),
 *    recalculating each hour to incorporate updated forecasts and state telemetry.
 */

import type {
  HabitatResourceState,
  ForecastHorizon,
  FlexibleTask,
  SafetyConstraints,
  ControllerDecision,
  SimulationController,
  StepResult,
  BatteryConfig,
  WaterConfig,
} from './types.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import { stepResourceModel } from './resourceModel.ts';
import { validateStepResult, isHardSafetyViolation } from './safetyValidator.ts';

export interface ObjectiveWeights {
  /** Reward weight for battery SoC margin above safety floor (0 to 1 normalized) */
  batterySocMargin: number;
  /** Reward weight for potable water reserve margin above safety floor (0 to 1 normalized) */
  waterReserveMargin: number;
  /** Reward weight per completed flexible task */
  taskCompletion: number;
  /** Incremental progress weight for active tasks (scaled by priority) */
  taskProgress: number;
  /** Penalty weight per hour of delay past task deadline */
  taskDelayPenalty: number;
  /** Severe penalty weight per kWh of emergency reserve drawn */
  backupEnergyPenalty: number;
  /** Penalty weight for unabsorbed / curtailed solar generation */
  curtailmentPenalty: number;
}

export const DEFAULT_OBJECTIVE_WEIGHTS: ObjectiveWeights = {
  batterySocMargin: 25.0,
  waterReserveMargin: 20.0,
  taskCompletion: 40.0,
  taskProgress: 4.0,
  taskDelayPenalty: 15.0,
  backupEnergyPenalty: 100.0,
  curtailmentPenalty: 1.5,
};

export interface MissionOptimizerConfig {
  /** Lookahead depth in hours (default: 12, clamped to available forecast length) */
  lookaheadHours?: number;
  /** Maximum number of candidate paths retained per search depth (default: 4) */
  beamWidth?: number;
  /** Hard computation budget capping total simulated state evaluations (default: 400) */
  maxEvaluations?: number;
  /** Objective function weights */
  weights?: Partial<ObjectiveWeights>;
  /** Battery subsystem configuration */
  batteryConfig?: BatteryConfig;
  /** Water subsystem configuration */
  waterConfig?: WaterConfig;
}

export interface OptimizerDiagnostics {
  nodesEvaluated: number;
  searchDepthReached: number;
  bestPlanScore: number;
  executionTimeMs: number;
  candidateBranchesExplored: number;
  infeasibilityFlag: boolean;
  selectedHorizonAction: string[];
}

interface SearchNode {
  state: HabitatResourceState;
  tasks: FlexibleTask[];
  accumulatedScore: number;
  firstStepAction: string[];
  depth: number;
}

export class MissionOptimizer implements SimulationController {
  readonly id = 'mission_optimizer' as const;
  readonly name = 'Astra Grid Mission Optimizer';
  readonly description =
    'Predictive cross-resource controller using rolling-horizon beam search to optimize mission continuity, reserve margins, and task completion.';

  private config: Required<Omit<MissionOptimizerConfig, 'weights'>> & {
    weights: ObjectiveWeights;
  };
  private lastDiagnostics?: OptimizerDiagnostics;

  constructor(config?: MissionOptimizerConfig) {
    this.config = {
      lookaheadHours: config?.lookaheadHours ?? 12,
      beamWidth: config?.beamWidth ?? 4,
      maxEvaluations: config?.maxEvaluations ?? 400,
      batteryConfig: config?.batteryConfig ?? DEFAULT_BATTERY_CONFIG,
      waterConfig: config?.waterConfig ?? DEFAULT_WATER_CONFIG,
      weights: {
        ...DEFAULT_OBJECTIVE_WEIGHTS,
        ...(config?.weights ?? {}),
      },
    };
  }

  /**
   * Returns diagnostic telemetry from the most recent optimization cycle.
   */
  getDiagnostics(): OptimizerDiagnostics | undefined {
    return this.lastDiagnostics;
  }

  /**
   * Generates discrete candidate task combinations for the current search step.
   * Prunes combinations exceeding distribution bus limits.
   */
  private generateCandidateActions(
    currentHour: number,
    tasks: FlexibleTask[],
    availableGenKW: number
  ): string[][] {
    // 1. Identify eligible tasks: started, remaining > 0
    const eligibleTasks = tasks.filter(
      (t) => t.remainingHours > 0.001 && currentHour >= t.earliestStartHour
    );

    if (eligibleTasks.length === 0) {
      return [[]]; // Only idle action possible
    }

    // Sort by priority (1 = highest)
    eligibleTasks.sort((a, b) => a.priority - b.priority);

    const candidates: string[][] = [[]]; // Always evaluate idle / conservation option

    // Generate single-task candidate actions
    for (const t of eligibleTasks) {
      candidates.push([t.id]);
    }

    // Generate pairs of tasks if total power is plausible
    const maxFeasibleBusPower = availableGenKW + this.config.batteryConfig.maxDischargeRateKW;
    const essentialKW = TOTAL_ESSENTIAL_LOAD_KW;
    const maxFlexPower = Math.max(0, maxFeasibleBusPower - essentialKW);

    for (let i = 0; i < eligibleTasks.length; i++) {
      for (let j = i + 1; j < eligibleTasks.length; j++) {
        const combinedPower = eligibleTasks[i].powerKW + eligibleTasks[j].powerKW;
        if (combinedPower <= maxFlexPower) {
          candidates.push([eligibleTasks[i].id, eligibleTasks[j].id]);
        }
      }
    }

    // Generate triple containing water_recycling (P1) if feasible
    const waterTask = eligibleTasks.find((t) => t.taskType === 'water_recycling');
    if (waterTask && eligibleTasks.length >= 3) {
      for (let i = 0; i < eligibleTasks.length; i++) {
        for (let j = i + 1; j < eligibleTasks.length; j++) {
          if (eligibleTasks[i].id !== waterTask.id && eligibleTasks[j].id !== waterTask.id) {
            const triplePower = waterTask.powerKW + eligibleTasks[i].powerKW + eligibleTasks[j].powerKW;
            if (triplePower <= maxFlexPower) {
              candidates.push([waterTask.id, eligibleTasks[i].id, eligibleTasks[j].id]);
            }
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Computes incremental objective score for a single-hour simulated transition.
   */
  private scoreStepTransition(
    stepResult: StepResult,
    previousState: HabitatResourceState,
    constraints: SafetyConstraints
  ): number {
    const weights = this.config.weights;
    const nextState = stepResult.nextState;
    let score = 0;

    // 1. Battery Reserve Margin Score
    const battMin = constraints.minBatterySocPct;
    const battSpan = Math.max(1, 100 - battMin);
    const battMarginNormalized = Math.max(0, nextState.batterySocPct - battMin) / battSpan;
    score += weights.batterySocMargin * Math.min(1.0, battMarginNormalized);

    // 2. Potable Water Reserve Margin Score
    const waterMin = constraints.minWaterReserveL;
    const waterSpan = Math.max(1, this.config.waterConfig.capacityL - waterMin);
    const waterMarginNormalized = Math.max(0, nextState.potableWaterLiters - waterMin) / waterSpan;
    score += weights.waterReserveMargin * Math.min(1.0, waterMarginNormalized);

    // 3. Task Completion Reward
    const completedCount = stepResult.completedTaskIds.length;
    score += weights.taskCompletion * completedCount;

    // 4. Task Progress Reward (scaled by task priority)
    for (const activeId of stepResult.activeTaskIds) {
      const task = stepResult.updatedTasks.find((t) => t.id === activeId);
      if (task) {
        const priorityWeight = (5 - task.priority) / 4.0; // P1 = 1.0, P4 = 0.25
        score += weights.taskProgress * priorityWeight;
      }
    }

    // 5. Task Deadline Delay Penalty
    for (const task of stepResult.updatedTasks) {
      if (task.remainingHours > 0.001 && nextState.timestampHour > task.deadlineHour) {
        const delay = nextState.timestampHour - task.deadlineHour;
        score -= weights.taskDelayPenalty * delay;
      }
    }

    // 6. Backup Energy Penalty
    const deltaBackup = nextState.backupEnergyUsedKWh - previousState.backupEnergyUsedKWh;
    if (deltaBackup > 0) {
      score -= weights.backupEnergyPenalty * deltaBackup;
    }

    // 7. Curtailment Waste Penalty (minimize wasted solar generation)
    if (stepResult.curtailedGenerationKW > 0.1) {
      score -= weights.curtailmentPenalty * (stepResult.curtailedGenerationKW / 10.0);
    }

    return score;
  }

  /**
   * Generates a compact state signature for duplicate branch detection.
   */
  private makeStateSignature(state: HabitatResourceState, tasks: FlexibleTask[]): string {
    const battBucket = Math.round(state.batteryStoredKWh / 10.0); // 10 kWh resolution
    const waterBucket = Math.round(state.potableWaterLiters / 25.0); // 25 L resolution
    const taskStatus = tasks
      .map((t) => `${t.id}:${Math.round(t.remainingHours)}`)
      .sort()
      .join('|');
    return `${state.timestampHour}_${battBucket}_${waterBucket}_${taskStatus}`;
  }

  /**
   * Evaluates the current hour and optimizes future trajectory using beam search.
   */
  decideNextHour(
    currentState: HabitatResourceState,
    forecast: ForecastHorizon,
    pendingTasks: FlexibleTask[],
    constraints: SafetyConstraints = DEFAULT_SAFETY_CONSTRAINTS
  ): ControllerDecision {
    const startTime = Date.now();
    const currentHour = currentState.timestampHour;
    const availableLookahead = forecast.hourlyForecasts.length;
    const horizonSpan = Math.min(this.config.lookaheadHours, availableLookahead);

    // Deep clone initial entities to prevent caller mutation
    const initialTasks: FlexibleTask[] = pendingTasks.map((t) => ({ ...t }));
    const rootState: HabitatResourceState = { ...currentState };

    let currentBeam: SearchNode[] = [
      {
        state: rootState,
        tasks: initialTasks,
        accumulatedScore: 0,
        firstStepAction: [],
        depth: 0,
      },
    ];

    let totalEvaluations = 0;
    let bestTerminalNode: SearchNode | undefined;
    let bestTerminalScore = -Infinity;

    // Rolling Horizon Discrete Beam Search
    for (let d = 0; d < horizonSpan; d++) {
      const stepHour = currentHour + d;
      const hourlyForecast =
        forecast.hourlyForecasts.find((f) => f.hour === stepHour) ??
        forecast.hourlyForecasts[d] ??
        forecast.hourlyForecasts[0];

      const availableGenKW =
        hourlyForecast.solarGenerationKW + hourlyForecast.nuclearGenerationKW;

      const nextLevelCandidates: SearchNode[] = [];
      const visitedSignatures = new Map<string, number>();

      for (const node of currentBeam) {
        if (totalEvaluations >= this.config.maxEvaluations) {
          break;
        }

        const candidateActions = this.generateCandidateActions(
          stepHour,
          node.tasks,
          availableGenKW
        );

        for (const action of candidateActions) {
          totalEvaluations++;

          // Simulate step in complete physical isolation
          const stepResult = stepResourceModel({
            currentState: node.state,
            solarGenerationKW: hourlyForecast.solarGenerationKW,
            backupGenerationKW: hourlyForecast.nuclearGenerationKW,
            essentialDemandKW: hourlyForecast.essentialDemandKW,
            batteryConfig: this.config.batteryConfig,
            waterConfig: this.config.waterConfig,
            safetyConstraints: constraints,
            tasks: node.tasks,
            dispatchedTaskIds: action,
          });

          // Validate safety: reject hard safety violations immediately
          const validation = validateStepResult(
            stepResult,
            constraints,
            this.config.batteryConfig,
            this.config.waterConfig
          );

          if (!validation.isSafe) {
            continue; // Prune unsafe candidate branch
          }

          // Score feasible transition
          const stepScore = this.scoreStepTransition(stepResult, node.state, constraints);
          const totalScore = node.accumulatedScore + stepScore;

          const childNode: SearchNode = {
            state: stepResult.nextState,
            tasks: stepResult.updatedTasks,
            accumulatedScore: totalScore,
            firstStepAction: d === 0 ? action : node.firstStepAction,
            depth: d + 1,
          };

          // Duplicate detection via signature hash
          const signature = this.makeStateSignature(childNode.state, childNode.tasks);
          const existingScore = visitedSignatures.get(signature);

          if (existingScore === undefined || totalScore > existingScore) {
            visitedSignatures.set(signature, totalScore);
            nextLevelCandidates.push(childNode);
          }

          if (totalScore > bestTerminalScore) {
            bestTerminalScore = totalScore;
            bestTerminalNode = childNode;
          }
        }
      }

      if (nextLevelCandidates.length === 0) {
        // No safe paths forward from this depth
        break;
      }

      // Sort candidate nodes by cumulative score descending and retain top beamWidth
      nextLevelCandidates.sort((a, b) => b.accumulatedScore - a.accumulatedScore);
      currentBeam = nextLevelCandidates.slice(0, this.config.beamWidth);
    }

    // Determine chosen immediate action
    let chosenAction: string[] = [];
    let isInfeasible = false;
    let rationale = '';

    if (bestTerminalNode) {
      chosenAction = bestTerminalNode.firstStepAction;
      rationale = `Astra Grid Optimizer selected [${chosenAction.join(', ')}] across ${horizonSpan}h lookahead (score: ${bestTerminalScore.toFixed(1)}, evaluated: ${totalEvaluations} states).`;
    } else {
      // Infeasibility: no candidate plan passed safety validation across lookahead
      isInfeasible = true;
      chosenAction = []; // Emergency action: shed all flexible load to protect life support
      rationale = `EMERGENCY: Zero fully safe candidate paths found across ${horizonSpan}h horizon. Shedding all flexible tasks to conserve life support.`;
    }

    // Evaluate immediate step result for projection telemetry
    const currentForecast =
      forecast.hourlyForecasts.find((f) => f.hour === currentHour) ??
      forecast.hourlyForecasts[0];

    const immediateResult = stepResourceModel({
      currentState,
      solarGenerationKW: currentForecast.solarGenerationKW,
      backupGenerationKW: currentForecast.nuclearGenerationKW,
      essentialDemandKW: currentForecast.essentialDemandKW,
      batteryConfig: this.config.batteryConfig,
      waterConfig: this.config.waterConfig,
      safetyConstraints: constraints,
      tasks: pendingTasks,
      dispatchedTaskIds: chosenAction,
    });

    const activeTasks = pendingTasks.filter((t) => chosenAction.includes(t.id));
    const flexibleLoadKW = activeTasks.reduce((sum, t) => sum + t.powerKW, 0);

    const executionTimeMs = Date.now() - startTime;
    this.lastDiagnostics = {
      nodesEvaluated: totalEvaluations,
      searchDepthReached: bestTerminalNode ? bestTerminalNode.depth : 0,
      bestPlanScore: bestTerminalScore,
      executionTimeMs,
      candidateBranchesExplored: totalEvaluations,
      infeasibilityFlag: isInfeasible,
      selectedHorizonAction: chosenAction,
    };

    return {
      hour: currentHour,
      controllerId: this.id,
      activeTaskIds: chosenAction,
      solarTrackingMode: currentForecast.isEclipse ? 'stow' : 'auto',
      flexibleLoadKW: Number(flexibleLoadKW.toFixed(2)),
      sheddedEssentialLoadKW: Number(immediateResult.unmetEssentialLoadKW.toFixed(2)),
      projectedBatterySocPct: Number(immediateResult.nextState.batterySocPct.toFixed(2)),
      projectedWaterLiters: Number(immediateResult.nextState.potableWaterLiters.toFixed(2)),
      rationale,
    };
  }
}

/**
 * Creates an instance of the Astra Grid Mission Optimizer.
 */
export function createMissionOptimizer(
  config?: MissionOptimizerConfig
): MissionOptimizer {
  return new MissionOptimizer(config);
}
