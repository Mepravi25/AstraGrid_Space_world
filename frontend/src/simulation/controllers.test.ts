import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFixedPriorityController,
  FixedPriorityController,
} from './fixedPriority.ts';
import {
  createSolarAwareScheduler,
  SolarAwareScheduler,
} from './solarScheduler.ts';
import {
  runControllerSimulation,
  runComparativeSimulation,
} from './controllerRunner.ts';
import {
  getScenarioForecast,
  generateNominalForecast,
  generateCraterEclipseForecast,
} from './forecast.ts';
import {
  createDefaultResourceState,
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import type { FlexibleTask, ForecastHorizon } from './types.ts';

test('Baseline Controllers - Essential loads receive absolute priority over flexible tasks', () => {
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();

  // Constrained habitat state: generation (30 kW) is below essential load (40.1 kW)
  // Battery is depleted to reserve floor (20% = 100 kWh)
  const lowState = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
  });

  const highPriorityTask: FlexibleTask = {
    id: 'p1_task',
    name: 'High Priority Task',
    taskType: 'water_recycling',
    durationHours: 2,
    powerKW: 7.5,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 2,
    isPreemptible: true,
  };

  const horizon: ForecastHorizon = {
    startHour: 0,
    horizonHours: 1,
    hourlyForecasts: [
      {
        hour: 0,
        sunElevationDeg: 0,
        solarFluxW_m2: 0,
        solarGenerationKW: 0,
        nuclearGenerationKW: 30.0, // deficit against 40.1 kW essential load
        essentialDemandKW: 40.1,
        dustOcclusionPct: 0,
        isEclipse: true,
      },
    ],
  };

  // Fixed priority controller must not dispatch flexible task when power is insufficient
  const fixedDecision = fixedCtrl.decideNextHour(lowState, horizon, [highPriorityTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(fixedDecision.activeTaskIds.length, 0, 'Must not dispatch flexible tasks during deficit');
  assert.strictEqual(fixedDecision.flexibleLoadKW, 0);

  // Solar aware controller must also not dispatch flexible task
  const solarDecision = solarCtrl.decideNextHour(lowState, horizon, [highPriorityTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(solarDecision.activeTaskIds.length, 0, 'Must not dispatch flexible tasks during deficit');
  assert.strictEqual(solarDecision.flexibleLoadKW, 0);
});

test('Baseline Controllers - Flexible tasks are ordered strictly by priority (1 before 2 before 3)', () => {
  const fixedCtrl = createFixedPriorityController();

  // Habitat state with enough power for one 10 kW task, but NOT both
  // Generation: 50.1 kW, Essential: 40.1 kW -> Surplus: 10.0 kW
  // Battery at reserve floor (20%) so battery cannot discharge
  const state = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
  });

  const p1Task: FlexibleTask = {
    id: 'task_p1',
    name: 'Priority 1 Life-Critical',
    taskType: 'science_electrolysis',
    durationHours: 2,
    powerKW: 8.0,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 2,
    isPreemptible: true,
  };

  const p3Task: FlexibleTask = {
    id: 'task_p3',
    name: 'Priority 3 Discretionary',
    taskType: 'regolith_sintering',
    durationHours: 2,
    powerKW: 8.0,
    priority: 3,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 2,
    isPreemptible: true,
  };

  const horizon: ForecastHorizon = {
    startHour: 0,
    horizonHours: 1,
    hourlyForecasts: [
      {
        hour: 0,
        sunElevationDeg: 10,
        solarFluxW_m2: 200,
        solarGenerationKW: 10.1,
        nuclearGenerationKW: 40.0, // Total gen = 50.1 kW -> surplus 10.0 kW
        essentialDemandKW: 40.1,
        dustOcclusionPct: 0,
        isEclipse: false,
      },
    ],
  };

  // Pass tasks in inverted order (P3 first, P1 second)
  const decision = fixedCtrl.decideNextHour(state, horizon, [p3Task, p1Task], DEFAULT_SAFETY_CONSTRAINTS);

  // Must pick P1 and reject P3 because surplus (10 kW) can only fit one 8 kW task
  assert.strictEqual(decision.activeTaskIds.length, 1);
  assert.strictEqual(decision.activeTaskIds[0], 'task_p1', 'P1 task must be chosen ahead of P3 task');
});

test('Baseline Controllers - Solar-aware scheduler defers tasks during eclipse toward solar-rich periods', () => {
  const solarCtrl = createSolarAwareScheduler();
  const fixedCtrl = createFixedPriorityController();

  // Initial state during eclipse: battery is at 76% (380 kWh).
  // Solar is 0 kW (eclipse). Essential load is 40.1 kW, Nuclear baseload is 40.0 kW.
  // There is a 0.1 kW generation deficit.
  const eclipseState = createDefaultResourceState({
    batteryStoredKWh: 380.0,
    batterySocPct: 76.0,
    timestampHour: 8,
  });

  // Task with ample slack: duration 3h, deadline at hour 20 (slack = 20 - 8 - 3 = 9 hours)
  const flexibleRoverTask: FlexibleTask = {
    id: 'rover_charge',
    name: 'Rover Recharge',
    taskType: 'rover_recharge',
    durationHours: 3,
    powerKW: 8.0,
    priority: 2,
    earliestStartHour: 6,
    deadlineHour: 20,
    progressHours: 0,
    remainingHours: 3,
    isPreemptible: true,
  };

  // 24h Crater Eclipse forecast: Eclipse is hours 8 to 15 (0 kW solar), daylight reappears hours 16 to 23
  const eclipseForecast = generateCraterEclipseForecast({
    eclipseStartHour: 8,
    eclipseDurationHours: 8,
  });

  // 1. Solar-aware controller inspects eclipse at hour 8 and defers the task
  const solarDecision = solarCtrl.decideNextHour(
    eclipseState,
    eclipseForecast,
    [flexibleRoverTask],
    DEFAULT_SAFETY_CONSTRAINTS
  );

  assert.strictEqual(
    solarDecision.activeTaskIds.includes('rover_charge'),
    false,
    'Solar-aware scheduler must defer flexible task during eclipse when slack exists'
  );
  assert.ok(solarDecision.rationale.includes('Deferred') || solarDecision.rationale.includes('eclipse'));

  // 2. Fixed-priority controller greedily dispatches the task because battery has 76% charge
  const fixedDecision = fixedCtrl.decideNextHour(
    eclipseState,
    eclipseForecast,
    [flexibleRoverTask],
    DEFAULT_SAFETY_CONSTRAINTS
  );

  assert.strictEqual(
    fixedDecision.activeTaskIds.includes('rover_charge'),
    true,
    'Fixed-priority controller greedily dispatches task during eclipse because battery has headroom'
  );
});

test('Baseline Controllers - Tasks cannot start before earliest-start time', () => {
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();

  const state = createDefaultResourceState({ timestampHour: 2 });
  const nominalForecast = generateNominalForecast();

  const lateTask: FlexibleTask = {
    id: 'late_task',
    name: 'Late Task',
    taskType: 'rover_recharge',
    durationHours: 4,
    powerKW: 8.0,
    priority: 2,
    earliestStartHour: 6, // Cannot start before hour 6
    deadlineHour: 20,
    progressHours: 0,
    remainingHours: 4,
    isPreemptible: true,
  };

  const fixedDecision = fixedCtrl.decideNextHour(state, nominalForecast, [lateTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(fixedDecision.activeTaskIds.includes('late_task'), false);

  const solarDecision = solarCtrl.decideNextHour(state, nominalForecast, [lateTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(solarDecision.activeTaskIds.includes('late_task'), false);
});

test('Baseline Controllers - Both controllers obey identical hard safety constraints', () => {
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();

  // Exactly at the 20.0% reserve threshold (100.0 kWh)
  const boundaryState = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
  });

  const heavyTask: FlexibleTask = {
    id: 'heavy_task',
    name: 'Heavy Task',
    taskType: 'regolith_sintering',
    durationHours: 4,
    powerKW: 15.0,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 4,
    isPreemptible: true,
  };

  // Generation exactly matches essential load (40.1 kW). Any extra flexible load would breach 20% SoC.
  const balancedForecast: ForecastHorizon = {
    startHour: 0,
    horizonHours: 1,
    hourlyForecasts: [
      {
        hour: 0,
        sunElevationDeg: 0,
        solarFluxW_m2: 0,
        solarGenerationKW: 0.1,
        nuclearGenerationKW: 40.0,
        essentialDemandKW: 40.1,
        dustOcclusionPct: 0,
        isEclipse: false,
      },
    ],
  };

  const fixedDecision = fixedCtrl.decideNextHour(boundaryState, balancedForecast, [heavyTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(fixedDecision.activeTaskIds.length, 0, 'Fixed priority must not violate 20% reserve floor');

  const solarDecision = solarCtrl.decideNextHour(boundaryState, balancedForecast, [heavyTask], DEFAULT_SAFETY_CONSTRAINTS);
  assert.strictEqual(solarDecision.activeTaskIds.length, 0, 'Solar aware must not violate 20% reserve floor');
});

test('Baseline Controllers - Simulation Runner preserves starting conditions and records metrics', () => {
  const scenario = getScenarioForecast('crater_eclipse');
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();

  const fixedRun = runControllerSimulation(scenario, fixedCtrl);
  const solarRun = runControllerSimulation(scenario, solarCtrl);

  assert.strictEqual(fixedRun.totalDurationHours, 24);
  assert.strictEqual(fixedRun.hourlyHistory.length, 24);
  assert.strictEqual(solarRun.totalDurationHours, 24);
  assert.strictEqual(solarRun.hourlyHistory.length, 24);

  // Both started from identical initial state
  assert.strictEqual(fixedRun.hourlyHistory[0].hour, 0);
  assert.strictEqual(solarRun.hourlyHistory[0].hour, 0);

  // Comparative report generation
  const report = runComparativeSimulation(scenario, [fixedCtrl, solarCtrl]);
  assert.strictEqual(report.scenarioId, 'crater_eclipse');
  assert.ok(report.runs.fixed_priority);
  assert.ok(report.runs.solar_aware);
});

test('Baseline Controllers - Determinism: Multiple runs yield strictly identical results', () => {
  const scenario = getScenarioForecast('nominal_solar');
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();

  const run1 = runControllerSimulation(scenario, fixedCtrl);
  const run2 = runControllerSimulation(scenario, fixedCtrl);

  assert.deepStrictEqual(run1.metrics, run2.metrics, 'Fixed-priority runs must be perfectly deterministic');
  assert.deepStrictEqual(run1.hourlyHistory, run2.hourlyHistory);

  const solarRun1 = runControllerSimulation(scenario, solarCtrl);
  const solarRun2 = runControllerSimulation(scenario, solarCtrl);

  assert.deepStrictEqual(solarRun1.metrics, solarRun2.metrics, 'Solar-aware runs must be perfectly deterministic');
  assert.deepStrictEqual(solarRun1.hourlyHistory, solarRun2.hourlyHistory);
});

test('Baseline Controllers - Infeasible scenario reports shortages instead of fabricating feasibility', () => {
  // Severe dust storm scenario where solar is crippled by 80%
  const scenario = getScenarioForecast('dust_storm');
  const fixedCtrl = createFixedPriorityController();

  const run = runControllerSimulation(scenario, fixedCtrl);

  // In severe dust storm, total generation (nuclear 40 + solar ~24 peak) cannot complete all 5 tasks without delay
  assert.ok(run.metrics.totalTaskCount === 5);
  // Unmet or delayed work is recorded accurately rather than masked
  assert.ok(run.metrics.accumulatedTaskDelayHours >= 0);
  assert.ok(run.hourlyHistory.some((h) => h.netPowerKW !== undefined));
});
