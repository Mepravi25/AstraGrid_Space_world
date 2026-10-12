/**
 * Astra Grid / HabitatOS — Safety Constraint Validator
 * 
 * Independent validator evaluating proposed dispatch decisions and simulation
 * step results against hard physical constraints and operational safety bounds.
 * 
 * Safety Categorization:
 * - Hard Safety Constraints (Failure / Violation):
 *   1. Essential life-support electricity curtailment (ESSENTIAL_LOAD_UNMET)
 *   2. Battery SoC below hard emergency reserve floor (BATTERY_MIN_RESERVE_VIOLATED)
 *   3. Battery charge/discharge flow rates exceeding inverter thermal limits
 *   4. Potable water reserve below emergency reserve floor (WATER_MIN_RESERVE_VIOLATED)
 * 
 * - Soft Objectives & Operational Warnings:
 *   1. Task deadline delays or preemption
 *   2. Battery operating in the caution band (20% to 25% SoC)
 *   3. Excess solar energy curtailment
 *   4. Emergency reserve energy drawn
 */

import type {
  HabitatResourceState,
  BatteryConfig,
  WaterConfig,
  SafetyConstraints,
  FlexibleTask,
  StepResult,
  SafetyViolation,
  SafetyViolationRule,
  SafetyValidationResult,
  HourlyForecast,
} from './types.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import { stepResourceModel } from './resourceModel.ts';

export const HARD_SAFETY_RULES: readonly SafetyViolationRule[] = [
  'ESSENTIAL_LOAD_UNMET',
  'BATTERY_MIN_RESERVE_VIOLATED',
  'BATTERY_CHARGE_RATE_EXCEEDED',
  'BATTERY_DISCHARGE_RATE_EXCEEDED',
  'WATER_MIN_RESERVE_VIOLATED',
] as const;

/**
 * Determines whether a violation rule represents an inviolable hard constraint.
 */
export function isHardSafetyViolation(ruleOrViolation: SafetyViolationRule | SafetyViolation): boolean {
  const rule = typeof ruleOrViolation === 'string' ? ruleOrViolation : ruleOrViolation.rule;
  return HARD_SAFETY_RULES.includes(rule);
}

/**
 * Validates a completed or simulated StepResult against safety constraints.
 * 
 * Preserves all violations reported by the resource model and audits for
 * boundary breaches, ensuring no failure is silently discarded.
 */
export function validateStepResult(
  result: StepResult,
  constraints: SafetyConstraints = DEFAULT_SAFETY_CONSTRAINTS,
  batteryConfig: BatteryConfig = DEFAULT_BATTERY_CONFIG,
  waterConfig: WaterConfig = DEFAULT_WATER_CONFIG
): SafetyValidationResult {
  const violations: SafetyViolation[] = [...result.violations];
  const warnings: string[] = [];
  const hour = result.nextState.timestampHour;

  // 1. Audit Essential Life-Support Demand
  if (result.unmetEssentialLoadKW > 0.001) {
    const existing = violations.find((v) => v.rule === 'ESSENTIAL_LOAD_UNMET');
    if (!existing) {
      violations.push({
        rule: 'ESSENTIAL_LOAD_UNMET',
        hour,
        currentValue: Number(result.essentialServedKW.toFixed(2)),
        limitValue: Number(result.essentialDemandKW.toFixed(2)),
        severity: 'catastrophic',
        message: `Unmet essential life-support load: ${result.unmetEssentialLoadKW.toFixed(2)} kW.`,
      });
    }
  }

  // 2. Audit Battery Minimum Reserve Floor (Hard constraint)
  if (result.nextState.batterySocPct < constraints.minBatterySocPct) {
    const existing = violations.find((v) => v.rule === 'BATTERY_MIN_RESERVE_VIOLATED');
    if (!existing) {
      violations.push({
        rule: 'BATTERY_MIN_RESERVE_VIOLATED',
        hour,
        currentValue: Number(result.nextState.batterySocPct.toFixed(2)),
        limitValue: constraints.minBatterySocPct,
        severity: result.nextState.batteryStoredKWh <= 0.001 ? 'catastrophic' : 'critical',
        message: `Battery SoC (${result.nextState.batterySocPct.toFixed(1)}%) breached hard safety floor (${constraints.minBatterySocPct}%).`,
      });
    }
  }

  // 3. Audit Battery Flow Rate Limits
  if (result.batteryChargeKW > constraints.maxBatteryChargeRateKW + 0.01) {
    const existing = violations.find((v) => v.rule === 'BATTERY_CHARGE_RATE_EXCEEDED');
    if (!existing) {
      violations.push({
        rule: 'BATTERY_CHARGE_RATE_EXCEEDED',
        hour,
        currentValue: Number(result.batteryChargeKW.toFixed(2)),
        limitValue: constraints.maxBatteryChargeRateKW,
        severity: 'warning',
        message: `Battery charge rate (${result.batteryChargeKW.toFixed(2)} kW) exceeded limit (${constraints.maxBatteryChargeRateKW} kW).`,
      });
    }
  }

  if (result.batteryDischargeKW > constraints.maxBatteryDischargeRateKW + 0.01) {
    const existing = violations.find((v) => v.rule === 'BATTERY_DISCHARGE_RATE_EXCEEDED');
    if (!existing) {
      violations.push({
        rule: 'BATTERY_DISCHARGE_RATE_EXCEEDED',
        hour,
        currentValue: Number(result.batteryDischargeKW.toFixed(2)),
        limitValue: constraints.maxBatteryDischargeRateKW,
        severity: 'warning',
        message: `Battery discharge rate (${result.batteryDischargeKW.toFixed(2)} kW) exceeded limit (${constraints.maxBatteryDischargeRateKW} kW).`,
      });
    }
  }

  // 4. Audit Potable Water Reserve Floor
  if (result.nextState.potableWaterLiters < constraints.minWaterReserveL) {
    const existing = violations.find((v) => v.rule === 'WATER_MIN_RESERVE_VIOLATED');
    if (!existing) {
      violations.push({
        rule: 'WATER_MIN_RESERVE_VIOLATED',
        hour,
        currentValue: Number(result.nextState.potableWaterLiters.toFixed(2)),
        limitValue: constraints.minWaterReserveL,
        severity: result.nextState.potableWaterLiters <= 0.001 ? 'catastrophic' : 'critical',
        message: `Potable water reserve (${result.nextState.potableWaterLiters.toFixed(1)} L) breached safety reserve floor (${constraints.minWaterReserveL} L).`,
      });
    }
  }

  // 5. Audit Soft Objectives & Caution Warnings
  if (
    result.nextState.batterySocPct >= constraints.minBatterySocPct &&
    result.nextState.batterySocPct < batteryConfig.criticalReserveSocPct
  ) {
    warnings.push(
      `Caution: Battery SoC (${result.nextState.batterySocPct.toFixed(1)}%) in cautionary reserve zone (${constraints.minBatterySocPct}% - ${batteryConfig.criticalReserveSocPct}%).`
    );
  }

  if (result.nextState.backupEnergyUsedKWh > 0) {
    warnings.push(
      `Emergency battery reserve drawn: cumulative backup energy is ${result.nextState.backupEnergyUsedKWh.toFixed(2)} kWh.`
    );
  }

  if (result.preemptedTaskIds.length > 0) {
    warnings.push(
      `Flexible tasks preempted during hour ${hour}: ${result.preemptedTaskIds.join(', ')}.`
    );
  }

  if (result.curtailedGenerationKW > 0.1) {
    warnings.push(
      `Generation curtailed: ${result.curtailedGenerationKW.toFixed(2)} kW excess power unabsorbed.`
    );
  }

  const hasHardViolation = violations.some((v) => isHardSafetyViolation(v));

  return {
    isSafe: !hasHardViolation,
    violations,
    warnings,
  };
}

/**
 * Validates candidate task dispatches before execution.
 * Ensures tasks are not dispatched before their earliest start or after completion.
 */
export function validateCandidateDispatch(
  currentHour: number,
  candidateTaskIds: string[],
  tasks: FlexibleTask[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  for (const id of candidateTaskIds) {
    const task = taskMap.get(id);
    if (!task) {
      errors.push(`Dispatched task id "${id}" does not exist in pending tasks.`);
      continue;
    }
    if (currentHour < task.earliestStartHour) {
      errors.push(
        `Task "${task.name}" (${id}) dispatched at hour ${currentHour} before earliest start hour ${task.earliestStartHour}.`
      );
    }
    if (task.remainingHours <= 0.001) {
      errors.push(`Task "${task.name}" (${id}) is already completed and cannot be dispatched.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Evaluates a proposed action via a single-hour dry-run simulation step
 * to determine whether the proposed dispatch is safe to execute.
 */
export function evaluateProposedStep(
  currentState: HabitatResourceState,
  forecast: HourlyForecast,
  dispatchedTaskIds: string[],
  tasks: FlexibleTask[],
  constraints: SafetyConstraints = DEFAULT_SAFETY_CONSTRAINTS,
  configs?: {
    batteryConfig?: BatteryConfig;
    waterConfig?: WaterConfig;
  }
): {
  isSafe: boolean;
  stepResult: StepResult;
  validation: SafetyValidationResult;
} {
  const stepResult = stepResourceModel({
    currentState,
    solarGenerationKW: forecast.solarGenerationKW,
    backupGenerationKW: forecast.nuclearGenerationKW,
    essentialDemandKW: forecast.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW,
    tasks,
    dispatchedTaskIds,
    batteryConfig: configs?.batteryConfig,
    waterConfig: configs?.waterConfig,
    safetyConstraints: constraints,
  });

  const validation = validateStepResult(
    stepResult,
    constraints,
    configs?.batteryConfig,
    configs?.waterConfig
  );

  return {
    isSafe: validation.isSafe,
    stepResult,
    validation,
  };
}
