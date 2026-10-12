import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isHardSafetyViolation,
  validateStepResult,
  validateCandidateDispatch,
  evaluateProposedStep,
  HARD_SAFETY_RULES,
} from './safetyValidator.ts';
import {
  createDefaultResourceState,
  DEFAULT_SAFETY_CONSTRAINTS,
  DEFAULT_BATTERY_CONFIG,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import type { FlexibleTask, StepResult } from './types.ts';
import { stepResourceModel } from './resourceModel.ts';

test('Safety Validator - Hard vs soft violation classification', () => {
  // Hard rules
  assert.strictEqual(isHardSafetyViolation('ESSENTIAL_LOAD_UNMET'), true);
  assert.strictEqual(isHardSafetyViolation('BATTERY_MIN_RESERVE_VIOLATED'), true);
  assert.strictEqual(isHardSafetyViolation('WATER_MIN_RESERVE_VIOLATED'), true);
  assert.strictEqual(isHardSafetyViolation('BATTERY_CHARGE_RATE_EXCEEDED'), true);
  assert.strictEqual(isHardSafetyViolation('BATTERY_DISCHARGE_RATE_EXCEEDED'), true);

  // Soft rules
  assert.strictEqual(isHardSafetyViolation('TASK_DEADLINE_BREACHED'), false);
  assert.strictEqual(HARD_SAFETY_RULES.length, 5);
});

test('Safety Validator - Unmet essential load triggers catastrophic hard violation and rejects plan', () => {
  const state = createDefaultResourceState({ batteryStoredKWh: 0, batterySocPct: 0 });
  const step = stepResourceModel({
    currentState: state,
    solarGenerationKW: 0,
    backupGenerationKW: 30.0,
    essentialDemandKW: 40.1, // 10.1 kW deficit
  });

  const validation = validateStepResult(step);
  assert.strictEqual(validation.isSafe, false, 'Plan must be rejected when essential load is unmet');
  assert.ok(validation.violations.some((v) => v.rule === 'ESSENTIAL_LOAD_UNMET'));
  assert.ok(validation.violations.some((v) => v.severity === 'catastrophic'));
});

test('Safety Validator - Battery emergency reserve breach triggers critical hard violation', () => {
  const lowState = createDefaultResourceState({
    batteryStoredKWh: 95.0, // 19.0% SoC, below 20.0% floor
    batterySocPct: 19.0,
  });

  const step = stepResourceModel({
    currentState: lowState,
    solarGenerationKW: 0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
  });

  const validation = validateStepResult(step);
  assert.strictEqual(validation.isSafe, false);
  assert.ok(validation.violations.some((v) => v.rule === 'BATTERY_MIN_RESERVE_VIOLATED'));
});

test('Safety Validator - Candidate dispatch prevents early start and completed task dispatch', () => {
  const tasks: FlexibleTask[] = [
    {
      id: 'task_future',
      name: 'Future Task',
      taskType: 'rover_recharge',
      durationHours: 3,
      powerKW: 8.0,
      priority: 2,
      earliestStartHour: 10,
      deadlineHour: 20,
      progressHours: 0,
      remainingHours: 3,
      isPreemptible: true,
    },
    {
      id: 'task_done',
      name: 'Completed Task',
      taskType: 'science_electrolysis',
      durationHours: 2,
      powerKW: 10.0,
      priority: 2,
      earliestStartHour: 0,
      deadlineHour: 10,
      progressHours: 2,
      remainingHours: 0,
      isPreemptible: true,
    },
  ];

  // At hour 5, task_future cannot run
  const earlyCheck = validateCandidateDispatch(5, ['task_future'], tasks);
  assert.strictEqual(earlyCheck.isValid, false);
  assert.ok(earlyCheck.errors.some((e) => e.includes('before earliest start')));

  // task_done cannot run
  const doneCheck = validateCandidateDispatch(5, ['task_done'], tasks);
  assert.strictEqual(doneCheck.isValid, false);
  assert.ok(doneCheck.errors.some((e) => e.includes('already completed')));

  // Non-existent task
  const unknownCheck = validateCandidateDispatch(5, ['ghost_task'], tasks);
  assert.strictEqual(unknownCheck.isValid, false);
  assert.ok(unknownCheck.errors.some((e) => e.includes('does not exist')));
});

test('Safety Validator - evaluateProposedStep performs dry-run without mutating state', () => {
  const initial = createDefaultResourceState({ batteryStoredKWh: 300.0, batterySocPct: 60.0 });
  const tasks: FlexibleTask[] = [
    {
      id: 't1',
      name: 'Task 1',
      taskType: 'science_electrolysis',
      durationHours: 2,
      powerKW: 10.0,
      priority: 2,
      earliestStartHour: 0,
      deadlineHour: 10,
      progressHours: 0,
      remainingHours: 2,
      isPreemptible: true,
    },
  ];

  const evalResult = evaluateProposedStep(
    initial,
    {
      hour: 0,
      sunElevationDeg: 20,
      solarFluxW_m2: 500,
      solarGenerationKW: 50.0,
      nuclearGenerationKW: 40.0,
      essentialDemandKW: TOTAL_ESSENTIAL_LOAD_KW,
      dustOcclusionPct: 0,
      isEclipse: false,
    },
    ['t1'],
    tasks
  );

  assert.strictEqual(evalResult.isSafe, true);
  assert.strictEqual(evalResult.stepResult.demandServedKW, Number((TOTAL_ESSENTIAL_LOAD_KW + 10.0).toFixed(3)));
  assert.strictEqual(initial.batteryStoredKWh, 300.0, 'Initial state must remain unmutated');
  assert.strictEqual(tasks[0].remainingHours, 2, 'Original tasks must remain unmutated');
});
