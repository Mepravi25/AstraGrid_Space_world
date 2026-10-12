import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stepResourceModel,
  simulateResourceStep,
} from './resourceModel.ts';
import type { FlexibleTask } from './types.ts';
import {
  createDefaultResourceState,
  validateStateInvariants,
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';

test('Resource Model - Battery charging absorbs surplus power with efficiency loss', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 400.0,
    potableWaterLiters: 2500.0,
    recoverableWaterLiters: 50.0,
  });

  // Generation: 60.1 kW (solar 20.1 + nuclear 40.0)
  // Essential load: 40.1 kW -> Net surplus: 20.0 kW
  const result = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 20.1,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
  });

  assert.strictEqual(result.generationKW, 60.1);
  assert.strictEqual(result.demandKW, 40.1);
  assert.strictEqual(result.netPowerKW, 20.0);
  assert.strictEqual(result.batteryChargeKW, 20.0);
  assert.strictEqual(result.batteryDischargeKW, 0.0);
  assert.strictEqual(result.batteryFlowKW, 20.0);

  // Charging efficiency is 0.95: 20 kW * 1h * 0.95 = 19.0 kWh stored
  assert.strictEqual(result.batteryStoredDeltaKWh, 19.0);
  assert.strictEqual(result.batteryLossKWh, 1.0);
  assert.strictEqual(result.nextState.batteryStoredKWh, 419.0);
  assert.strictEqual(result.nextState.batterySocPct, 83.8);
  assert.strictEqual(result.curtailedGenerationKW, 0.0);
  assert.strictEqual(result.unmetDemandKW, 0.0);
  assert.strictEqual(result.isSafe, true);
});

test('Resource Model - Battery discharging covers generation deficit with efficiency loss', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 400.0,
  });

  // Generation: 30.1 kW (solar 0 + nuclear 30.1)
  // Essential load: 40.1 kW -> Net deficit: 10.0 kW
  const result = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 0.0,
    backupGenerationKW: 30.1,
    essentialDemandKW: 40.1,
  });

  assert.strictEqual(result.generationKW, 30.1);
  assert.strictEqual(result.demandKW, 40.1);
  assert.strictEqual(result.netPowerKW, -10.0);
  assert.strictEqual(result.batteryChargeKW, 0.0);
  assert.strictEqual(result.batteryDischargeKW, 10.0);
  assert.strictEqual(result.batteryFlowKW, -10.0);

  // Discharging efficiency is 0.95: 10 kW bus power requires 10 / 0.95 ≈ 10.5263 kWh chem drain
  const expectedChemDrawn = Number((10.0 / 0.95).toFixed(4));
  assert.strictEqual(result.batteryStoredDeltaKWh, -expectedChemDrawn);
  assert.strictEqual(result.batteryLossKWh, Number((expectedChemDrawn - 10.0).toFixed(4)));
  assert.strictEqual(result.nextState.batteryStoredKWh, Number((400.0 - expectedChemDrawn).toFixed(4)));
  assert.strictEqual(result.unmetDemandKW, 0.0);
  assert.strictEqual(result.demandServedKW, 40.1);
  assert.strictEqual(result.isSafe, true);
});

test('Resource Model - Battery capacity headroom clamps stored energy and curtails excess', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 495.0, // Only 5.0 kWh headroom up to 500.0 kWh capacity
  });

  // Large generation surplus of 50.0 kW
  const result = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 50.0,
    backupGenerationKW: 40.1,
    essentialDemandKW: 40.1, // Net surplus: 50.0 kW
  });

  // To store 5.0 kWh at 0.95 efficiency: 5.0 / 0.95 ≈ 5.263 kW bus power absorbed
  assert.strictEqual(result.nextState.batteryStoredKWh, 500.0);
  assert.strictEqual(result.nextState.batterySocPct, 100.0);
  assert.ok(result.batteryChargeKW < 6.0, 'Charge rate must be capped by battery headroom');
  assert.ok(result.curtailedGenerationKW > 44.0, 'Excess generation must be curtailed');
  assert.strictEqual(
    Number((result.batteryChargeKW + result.curtailedGenerationKW).toFixed(2)),
    50.0,
    'Surplus must equal charge plus curtailment'
  );
});

test('Resource Model - Battery max charge and discharge rate limits are enforced', () => {
  const emptyBatt = createDefaultResourceState({
    batteryStoredKWh: 100.0,
  });

  // Huge surplus of 150 kW: max charge rate is 80 kW
  const chargeLimited = stepResourceModel({
    currentState: emptyBatt,
    solarGenerationKW: 150.0,
    backupGenerationKW: 40.1,
    essentialDemandKW: 40.1,
  });

  assert.strictEqual(chargeLimited.batteryChargeKW, 80.0, 'Battery charge must cap at maxChargeRateKW (80 kW)');
  assert.strictEqual(chargeLimited.curtailedGenerationKW, 70.0, 'Remaining 70 kW must be curtailed');

  // Huge deficit: essential load 160 kW, gen 40 kW -> 120 kW deficit
  // Max discharge rate is 100 kW. Battery has 300 kWh stored so rate (not energy) is the constraint.
  const dischargeLimited = stepResourceModel({
    currentState: createDefaultResourceState({ batteryStoredKWh: 300.0 }),
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 160.0,
  });

  assert.strictEqual(
    dischargeLimited.batteryDischargeKW,
    100.0,
    'Battery discharge must cap at maxDischargeRateKW (100 kW)'
  );
  assert.strictEqual(dischargeLimited.unmetDemandKW, 20.0, 'Remaining 20 kW deficit must be reported as unmet');
  assert.strictEqual(dischargeLimited.demandServedKW, 140.0);
  assert.strictEqual(dischargeLimited.isInfeasible, true);
});

test('Resource Model - Power balance holds exactly in all states', () => {
  const testCases = [
    { solar: 80.0, backup: 40.0, essential: 40.1, flex: 20.0, stored: 300.0 },
    { solar: 10.0, backup: 40.0, essential: 40.1, flex: 15.0, stored: 300.0 },
    { solar: 0.0, backup: 40.0, essential: 40.1, flex: 0.0, stored: 50.0 },
    { solar: 100.0, backup: 40.0, essential: 40.1, flex: 0.0, stored: 498.0 },
  ];

  for (const tc of testCases) {
    const state = createDefaultResourceState({ batteryStoredKWh: tc.stored });
    const dummyTask: FlexibleTask = {
      id: 'dummy',
      name: 'Dummy',
      taskType: 'science_electrolysis',
      durationHours: 2,
      powerKW: tc.flex,
      priority: 2,
      earliestStartHour: 0,
      deadlineHour: 10,
      progressHours: 0,
      remainingHours: 2,
      isPreemptible: true,
    };

    const res = stepResourceModel({
      currentState: state,
      solarGenerationKW: tc.solar,
      backupGenerationKW: tc.backup,
      essentialDemandKW: tc.essential,
      tasks: tc.flex > 0 ? [dummyTask] : [],
      dispatchedTaskIds: tc.flex > 0 ? ['dummy'] : [],
    });

    // Electrical Bus Balance: Gen + Battery Discharge == Demand Served + Battery Charge + Curtailment
    const busIn = Number((res.generationKW + res.batteryDischargeKW).toFixed(2));
    const busOut = Number((res.demandServedKW + res.batteryChargeKW + res.curtailedGenerationKW).toFixed(2));
    assert.strictEqual(busIn, busOut, `Power balance violated: ${busIn} !== ${busOut}`);

    // Demand Balance: Total Demand == Demand Served + Unmet Demand
    const demandTotal = Number(res.demandKW.toFixed(2));
    const demandSum = Number((res.demandServedKW + res.unmetDemandKW).toFixed(2));
    assert.strictEqual(demandTotal, demandSum, `Demand balance violated: ${demandTotal} !== ${demandSum}`);
  }
});

test('Resource Model - Essential load curtailment causes catastrophic violation and compromise flag', () => {
  // Empty battery and generation below essential load
  const depletedState = createDefaultResourceState({
    batteryStoredKWh: 0.0,
    batterySocPct: 0.0,
  });

  const result = stepResourceModel({
    currentState: depletedState,
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1, // 0.1 kW continuous deficit
  });

  assert.strictEqual(result.batteryDischargeKW, 0.0, 'Depleted battery cannot discharge');
  assert.strictEqual(result.essentialServedKW, 40.0);
  assert.strictEqual(result.unmetEssentialLoadKW, 0.1);
  assert.strictEqual(result.nextState.isLifeSupportCompromised, true);
  assert.strictEqual(result.isInfeasible, true);
  assert.strictEqual(result.isSafe, false);

  const essentialViolation = result.violations.find((v) => v.rule === 'ESSENTIAL_LOAD_UNMET');
  assert.ok(essentialViolation, 'Must emit ESSENTIAL_LOAD_UNMET safety violation');
  assert.strictEqual(essentialViolation.severity, 'catastrophic');
});

test('Resource Model - Water mass conservation across consumption, buffer, and recycling yield', () => {
  const initial = createDefaultResourceState({
    potableWaterLiters: 2000.0,
    recoverableWaterLiters: 20.0,
  });

  const recyclingTask: FlexibleTask = {
    id: 'vcd_rec',
    name: 'VCD Recycling',
    taskType: 'water_recycling',
    durationHours: 1,
    powerKW: 7.5,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 1,
    isPreemptible: true,
  };

  // Step with recycling active and surplus power
  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 60.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    tasks: [recyclingTask],
    dispatchedTaskIds: ['vcd_rec'],
    crewWaterConsumptionL: 1.0, // 1.0 L consumed
  });

  assert.strictEqual(step.waterConsumedL, 1.0);
  // Throughput is 3.2 L/h. Available buffer: 20 + 1 = 21 L.
  // Raw processed = 3.2 L. Clean yield = 3.2 * 0.98 = 3.136 L.
  assert.strictEqual(step.waterRecoveredL, 3.136);
  assert.strictEqual(step.waterDeltaL, Number((3.136 - 1.0).toFixed(3))); // +2.136 L

  // Wastewater buffer: 21 - 3.2 = 17.8 L
  assert.strictEqual(step.recoverableWaterRemainingL, 17.8);
  assert.strictEqual(step.nextState.potableWaterLiters, Number((2000.0 + 2.136).toFixed(3)));

  // Total mass check:
  // initial (potable 2000 + buffer 20) = 2020 L
  // final (potable 2002.136 + buffer 17.8 + brine loss (3.2 * 0.02 = 0.064)) = 2020.0 L
  const totalWaterEnd =
    step.nextState.potableWaterLiters +
    step.recoverableWaterRemainingL +
    Number((3.2 * 0.02).toFixed(3));
  assert.strictEqual(Number(totalWaterEnd.toFixed(2)), 2020.0, 'Water mass must balance exactly');
});

test('Resource Model - Water recycling cannot produce water from zero recoverable buffer', () => {
  const initial = createDefaultResourceState({
    potableWaterLiters: 1000.0,
    recoverableWaterLiters: 0.0,
  });

  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 50.0,
    backupGenerationKW: 40.0,
    enableWaterRecovery: true,
    crewWaterConsumptionL: 0.0, // zero consumption, zero buffer
  });

  assert.strictEqual(step.waterRecoveredL, 0.0, 'Cannot recover water when recoverable buffer is zero');
  assert.strictEqual(step.waterDeltaL, 0.0);
  assert.strictEqual(step.nextState.potableWaterLiters, 1000.0);
});

test('Resource Model - Depleted and zero resource conditions are safely handled', () => {
  const dryAndDrained = createDefaultResourceState({
    batteryStoredKWh: 0.0,
    batterySocPct: 0.0,
    potableWaterLiters: 0.0,
    waterReservePct: 0.0,
    recoverableWaterLiters: 0.0,
  });

  const step = stepResourceModel({
    currentState: dryAndDrained,
    solarGenerationKW: 0.0,
    backupGenerationKW: 30.0,
    essentialDemandKW: 40.1,
    crewWaterConsumptionL: 1.5,
  });

  // Strict non-negative guarantees
  assert.strictEqual(step.nextState.batteryStoredKWh, 0.0);
  assert.strictEqual(step.nextState.potableWaterLiters, 0.0);
  assert.strictEqual(step.unmetWaterDemandL, 1.5);
  assert.strictEqual(step.nextState.cumulativeUnmetWaterL, 1.5);
  assert.strictEqual(step.nextState.isEmergencyReserveBreached, true);
  assert.strictEqual(step.nextState.isLifeSupportCompromised, true);

  // Both battery and water floor violations raised
  assert.ok(step.violations.some((v) => v.rule === 'BATTERY_MIN_RESERVE_VIOLATED'));
  assert.ok(step.violations.some((v) => v.rule === 'WATER_MIN_RESERVE_VIOLATED'));
  assert.ok(step.violations.some((v) => v.rule === 'ESSENTIAL_LOAD_UNMET'));

  const validation = validateStateInvariants(step.nextState);
  assert.strictEqual(validation.isValid, true, 'Resulting state must remain a valid state representation');
});

test('Resource Model - Flexible tasks advance progress, complete, pre-empt on deficit, and catch deadlines', () => {
  const task1: FlexibleTask = {
    id: 't1',
    name: 'High Priority Task',
    taskType: 'science_electrolysis',
    durationHours: 2,
    powerKW: 10.0,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 3,
    progressHours: 1,
    remainingHours: 1,
    isPreemptible: true,
  };

  const task2: FlexibleTask = {
    id: 't2',
    name: 'Low Priority Sintering',
    taskType: 'regolith_sintering',
    durationHours: 4,
    powerKW: 15.0,
    priority: 4,
    earliestStartHour: 0,
    deadlineHour: 1, // Will breach deadline after this hour (nextHour = 1 + 1 = 2 > 1)
    progressHours: 0,
    remainingHours: 4,
    isPreemptible: true,
  };

  const initial = createDefaultResourceState({
    timestampHour: 1,
    batteryStoredKWh: 100.0, // Reserve floor: 100 kWh
  });

  // Only 10 kW available for flexible loads (nuclear 50.1, essential 40.1, battery discharge locked)
  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 0.0,
    backupGenerationKW: 50.1,
    essentialDemandKW: 40.1,
    batteryDischargeLimitKW: 0.0, // Protect reserve by forbidding battery discharge for flexible loads
    tasks: [task1, task2],
    dispatchedTaskIds: ['t1', 't2'],
  });

  // task1 (priority 1, 10 kW) gets power and completes
  assert.ok(step.activeTaskIds.includes('t1'));
  assert.ok(step.completedTaskIds.includes('t1'));
  const updatedT1 = step.updatedTasks.find((t) => t.id === 't1')!;
  assert.strictEqual(updatedT1.progressHours, 2);
  assert.strictEqual(updatedT1.remainingHours, 0);

  // task2 (priority 4, 15 kW) could not get power and was preempted
  assert.ok(step.preemptedTaskIds.includes('t2'));
  const updatedT2 = step.updatedTasks.find((t) => t.id === 't2')!;
  assert.strictEqual(updatedT2.progressHours, 0);
  assert.strictEqual(updatedT2.remainingHours, 4);

  // task2 deadline was hour 1, next hour is 2 -> missed deadline!
  const deadlineViolation = step.violations.find((v) => v.rule === 'TASK_DEADLINE_BREACHED');
  assert.ok(deadlineViolation);
  assert.ok(deadlineViolation.message.includes('Low Priority Sintering'));
});

test('Resource Model - Identical inputs yield identical outputs (Determinism)', () => {
  const state = createDefaultResourceState();
  const input = {
    currentState: state,
    solarGenerationKW: 45.5,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
  };

  const run1 = stepResourceModel(input);
  const run2 = stepResourceModel(input);
  const run3 = simulateResourceStep(input);

  assert.deepStrictEqual(run1, run2, 'Step must be strictly deterministic across calls');
  assert.deepStrictEqual(run1, run3, 'simulateResourceStep alias must produce identical output');
});

test('Resource Model - Boundary Case: Crossing below 20% reserve calculates exact backup energy used', () => {
  // Start at 105 kWh (SoC = 21%, above 100 kWh reserve floor)
  const state = createDefaultResourceState({
    batteryStoredKWh: 105.0,
    backupEnergyUsedKWh: 0.0,
  });

  // Deficit of 10.0 kW -> requires 10 / 0.95 ≈ 10.5263 kWh
  // Stored drops to 105 - 10.5263 = 94.4737 kWh
  // Portion below 100 kWh reserve = 100 - 94.4737 = 5.5263 kWh
  const step = stepResourceModel({
    currentState: state,
    solarGenerationKW: 0.0,
    backupGenerationKW: 30.1,
    essentialDemandKW: 40.1,
  });

  assert.strictEqual(step.nextState.isEmergencyReserveBreached, true);
  assert.strictEqual(step.nextState.batteryStoredKWh, 94.4737);
  assert.strictEqual(step.nextState.backupEnergyUsedKWh, 5.5263);
  assert.ok(step.violations.some((v) => v.rule === 'BATTERY_MIN_RESERVE_VIOLATED'));
});

test('Resource Model - Boundary Case: Potable water tank headroom limits recycling', () => {
  // Tank capacity is 3000 L. Start at 2999.0 L (headroom = 1.0 L)
  const state = createDefaultResourceState({
    potableWaterLiters: 2999.0,
    recoverableWaterLiters: 50.0,
  });

  const step = stepResourceModel({
    currentState: state,
    solarGenerationKW: 60.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableWaterRecovery: true,
    crewWaterConsumptionL: 0.0, // no consumption to test pure tank ceiling
  });

  // Tank must not exceed 3000 L
  assert.strictEqual(step.nextState.potableWaterLiters, 3000.0);
  assert.strictEqual(step.waterDeltaL, 1.0);
  assert.strictEqual(step.waterRecoveredL, 1.0);
  // Raw wastewater processed: 1.0 / 0.98 ≈ 1.020 L
  const rawDrawn = Number((1.0 / 0.98).toFixed(3));
  assert.strictEqual(step.recoverableWaterRemainingL, Number((50.0 - rawDrawn).toFixed(3)));
});

test('Resource Model - Conservation Invariants reject corrupted states', () => {
  // Ensure that state invariant checks fail when conservation is violated
  const negativeBufferState = createDefaultResourceState({
    recoverableWaterLiters: -10.0,
  });
  const checkNegativeBuffer = validateStateInvariants(negativeBufferState);
  assert.strictEqual(checkNegativeBuffer.isValid, false);
  assert.ok(checkNegativeBuffer.errors.some((e) => e.includes('Recoverable wastewater')));

  const overfilledState = createDefaultResourceState({
    potableWaterLiters: 3500.0,
  });
  const checkOverfill = validateStateInvariants(overfilledState);
  assert.strictEqual(checkOverfill.isValid, false);
  assert.ok(checkOverfill.errors.some((e) => e.includes('exceeds capacity')));
});

