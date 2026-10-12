import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMissionOptimizer,
  MissionOptimizer,
} from './missionOptimizer.ts';
import {
  createFixedPriorityController,
} from './fixedPriority.ts';
import {
  createSolarAwareScheduler,
} from './solarScheduler.ts';
import {
  runControllerSimulation,
  runComparativeSimulation,
} from './controllerRunner.ts';
import {
  getScenarioForecast,
  generateNominalForecast,
  generateCraterEclipseForecast,
  generateDustStormForecast,
} from './forecast.ts';
import {
  createDefaultResourceState,
  DEFAULT_SAFETY_CONSTRAINTS,
  DEFAULT_WATER_CONFIG,
  DEFAULT_BATTERY_CONFIG,
  TOTAL_ESSENTIAL_LOAD_KW,
} from './types.ts';
import type { FlexibleTask, ForecastHorizon } from './types.ts';

test('Mission Optimizer - Input immutability during rolling search', () => {
  const optimizer = createMissionOptimizer({ lookaheadHours: 6, beamWidth: 3 });
  const initialState = createDefaultResourceState({
    batteryStoredKWh: 350.0,
    potableWaterLiters: 2000.0,
    recoverableWaterLiters: 100.0,
    timestampHour: 0,
  });

  const originalStateSnapshot = JSON.stringify(initialState);
  const tasks: FlexibleTask[] = [
    {
      id: 't_rec',
      name: 'Water Distillation',
      taskType: 'water_recycling',
      durationHours: 3,
      powerKW: 7.5,
      priority: 1,
      earliestStartHour: 0,
      deadlineHour: 10,
      progressHours: 0,
      remainingHours: 3,
      isPreemptible: true,
    },
  ];
  const originalTasksSnapshot = JSON.stringify(tasks);

  const forecast = generateNominalForecast();
  const decision = optimizer.decideNextHour(
    initialState,
    forecast,
    tasks,
    DEFAULT_SAFETY_CONSTRAINTS
  );

  assert.ok(decision, 'Optimizer must return a decision');
  assert.strictEqual(
    JSON.stringify(initialState),
    originalStateSnapshot,
    'Optimizer must never mutate caller currentState'
  );
  assert.strictEqual(
    JSON.stringify(tasks),
    originalTasksSnapshot,
    'Optimizer must never mutate caller tasks'
  );
});

test('Mission Optimizer - Determinism across multiple executions', () => {
  const optimizer1 = createMissionOptimizer({ lookaheadHours: 8, beamWidth: 3 });
  const optimizer2 = createMissionOptimizer({ lookaheadHours: 8, beamWidth: 3 });

  const state = createDefaultResourceState({ batteryStoredKWh: 400.0, timestampHour: 2 });
  const scenario = getScenarioForecast('crater_eclipse');

  const dec1 = optimizer1.decideNextHour(
    state,
    scenario.horizon,
    scenario.defaultTasks,
    DEFAULT_SAFETY_CONSTRAINTS
  );
  const dec2 = optimizer2.decideNextHour(
    state,
    scenario.horizon,
    scenario.defaultTasks,
    DEFAULT_SAFETY_CONSTRAINTS
  );

  assert.deepStrictEqual(dec1.activeTaskIds, dec2.activeTaskIds);
  assert.strictEqual(dec1.flexibleLoadKW, dec2.flexibleLoadKW);
  assert.strictEqual(dec1.projectedBatterySocPct, dec2.projectedBatterySocPct);
});

test('Mission Optimizer - Hard safety constraints reject unsafe candidate plans', () => {
  const optimizer = createMissionOptimizer({ lookaheadHours: 4, beamWidth: 3 });

  // State right at the 20% battery floor (100 kWh) with 0 kW solar and 40 kW nuclear vs 40.1 kW essential load
  const depletedState = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
    timestampHour: 0,
  });

  const heavyTask: FlexibleTask = {
    id: 'heavy_t',
    name: 'Heavy Sintering',
    taskType: 'regolith_sintering',
    durationHours: 2,
    powerKW: 15.0,
    priority: 1,
    earliestStartHour: 0,
    deadlineHour: 10,
    progressHours: 0,
    remainingHours: 2,
    isPreemptible: true,
  };

  const deficitHorizon: ForecastHorizon = {
    startHour: 0,
    horizonHours: 2,
    hourlyForecasts: [
      {
        hour: 0,
        sunElevationDeg: 0,
        solarFluxW_m2: 0,
        solarGenerationKW: 0,
        nuclearGenerationKW: 40.0,
        essentialDemandKW: 40.1,
        dustOcclusionPct: 0,
        isEclipse: true,
      },
      {
        hour: 1,
        sunElevationDeg: 0,
        solarFluxW_m2: 0,
        solarGenerationKW: 0,
        nuclearGenerationKW: 40.0,
        essentialDemandKW: 40.1,
        dustOcclusionPct: 0,
        isEclipse: true,
      },
    ],
  };

  const decision = optimizer.decideNextHour(
    depletedState,
    deficitHorizon,
    [heavyTask],
    DEFAULT_SAFETY_CONSTRAINTS
  );

  assert.strictEqual(
    decision.activeTaskIds.length,
    0,
    'Must reject candidate plans that would breach the hard 20% battery reserve floor'
  );
  assert.strictEqual(decision.flexibleLoadKW, 0);
});

test('Mission Optimizer - Respects search limits and captures diagnostics', () => {
  const maxBudget = 50;
  const optimizer = createMissionOptimizer({
    lookaheadHours: 12,
    beamWidth: 4,
    maxEvaluations: maxBudget,
  });

  const state = createDefaultResourceState({ timestampHour: 0 });
  const scenario = getScenarioForecast('nominal_solar');

  optimizer.decideNextHour(state, scenario.horizon, scenario.defaultTasks, DEFAULT_SAFETY_CONSTRAINTS);

  const diag = optimizer.getDiagnostics();
  assert.ok(diag, 'Diagnostics must be captured');
  assert.ok(
    diag.nodesEvaluated <= maxBudget + 5,
    `Evaluated nodes (${diag.nodesEvaluated}) must respect max budget (${maxBudget})`
  );
  assert.ok(diag.executionTimeMs >= 0);
  assert.ok(diag.searchDepthReached > 0);
});

test('Mission Optimizer - Genuine cross-resource reasoning: Water recovery vs battery preservation trade-off', () => {
  // Targeted scenario:
  // Water reserve is moderate (700 L, min is 500 L).
  // Wastewater buffer has 30 L ready for recycling.
  // There is a task for water distillation (P1, 7.5 kW) and rover charge (P2, 8.0 kW).
  // Current hour is solar-rich (surplus power > 15 kW).
  // Future hours (hours 8-15) enter an eclipse shadow.
  // The optimizer should schedule water recycling during the solar-rich hour,
  // replenishing potable water BEFORE the eclipse arrives, rather than waiting until the eclipse.
  const optimizer = createMissionOptimizer({ lookaheadHours: 10, beamWidth: 4 });

  const state = createDefaultResourceState({
    potableWaterLiters: 700.0,
    recoverableWaterLiters: 30.0,
    batteryStoredKWh: 350.0,
    batterySocPct: 70.0,
    timestampHour: 6,
  });

  const tasks: FlexibleTask[] = [
    {
      id: 'water_distill',
      name: 'VCD Recycling',
      taskType: 'water_recycling',
      durationHours: 2,
      powerKW: 7.5,
      priority: 1,
      earliestStartHour: 6,
      deadlineHour: 18,
      progressHours: 0,
      remainingHours: 2,
      isPreemptible: true,
      waterYieldLPerHour: 3.136,
    },
    {
      id: 'rover_run',
      name: 'Rover Charge',
      taskType: 'rover_recharge',
      durationHours: 3,
      powerKW: 8.0,
      priority: 2,
      earliestStartHour: 6,
      deadlineHour: 20,
      progressHours: 0,
      remainingHours: 3,
      isPreemptible: true,
    },
  ];

  // Eclipse starts at hour 8 (2 hours of solar left: hours 6 and 7)
  const eclipseForecast = generateCraterEclipseForecast({
    eclipseStartHour: 8,
    eclipseDurationHours: 8,
  });

  const decision = optimizer.decideNextHour(state, eclipseForecast, tasks, DEFAULT_SAFETY_CONSTRAINTS);

  // Cross-resource outcome: water_distill should be dispatched in the current solar-rich hour (hour 6)
  assert.ok(
    decision.activeTaskIds.includes('water_distill'),
    'Optimizer must anticipate upcoming eclipse and schedule water distillation during solar availability'
  );
});

test('Mission Optimizer - Integrates with controllerRunner across all three scenarios', () => {
  const optimizer = createMissionOptimizer({ lookaheadHours: 6, beamWidth: 3 });

  // 1. Nominal Solar Run
  const nominalScenario = getScenarioForecast('nominal_solar');
  const nominalRun = runControllerSimulation(nominalScenario, optimizer);
  assert.strictEqual(nominalRun.totalDurationHours, 24);
  assert.strictEqual(nominalRun.hourlyHistory.length, 24);
  assert.ok(nominalRun.metrics.completedTaskCount >= 0);

  // 2. Crater Eclipse Run
  const eclipseScenario = getScenarioForecast('crater_eclipse');
  const eclipseRun = runControllerSimulation(eclipseScenario, optimizer);
  assert.strictEqual(eclipseRun.totalDurationHours, 24);
  assert.strictEqual(eclipseRun.hourlyHistory.length, 24);

  // 3. Dust Storm Run
  const dustScenario = getScenarioForecast('dust_storm');
  const dustRun = runControllerSimulation(dustScenario, optimizer);
  assert.strictEqual(dustRun.totalDurationHours, 24);
  assert.strictEqual(dustRun.hourlyHistory.length, 24);
});

test('Mission Optimizer - Comparative benchmark with Fixed Priority and Solar Aware', () => {
  const fixedCtrl = createFixedPriorityController();
  const solarCtrl = createSolarAwareScheduler();
  const optimizer = createMissionOptimizer({ lookaheadHours: 8, beamWidth: 3 });

  const scenario = getScenarioForecast('nominal_solar');
  const comparativeReport = runComparativeSimulation(scenario, [fixedCtrl, solarCtrl, optimizer]);

  assert.strictEqual(comparativeReport.scenarioId, 'nominal_solar');
  assert.ok(comparativeReport.runs.fixed_priority);
  assert.ok(comparativeReport.runs.solar_aware);
  assert.ok(comparativeReport.runs.mission_optimizer);

  const optRun = comparativeReport.runs.mission_optimizer;
  assert.strictEqual(optRun.controllerId, 'mission_optimizer');
  assert.strictEqual(optRun.hourlyHistory.length, 24);
});
