import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stepResourceModel,
  simulateResourceStep,
} from './resourceModel.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  DEFAULT_RFC_CONFIG,
  TOTAL_ESSENTIAL_LOAD_KW,
  createDefaultResourceState,
} from './types.ts';
import {
  stepRFC,
  createDefaultRFCState,
  HYDROGEN_LHV_KWH_PER_KG,
  DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO,
} from './rfcModel.ts';
import {
  getResilienceScenarios,
  runResilienceScenario,
  compareBaselineVsRFC,
} from './resilienceScenarios.ts';
import { useHabitatStore } from '../store/useHabitatStore.ts';

test('Energy Resilience — Power balance conservation with solar, battery, and RFC', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 400.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 5.0,
      o2StoredKg: 40.0,
    }),
  });

  // Solar surplus: Generation = 110 kW (Solar 70 + Nuclear 40). Essential demand = 40.1 kW.
  // Surplus = 69.9 kW.
  const result = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 70.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  // Generation = 110 kW
  // Essential served = 40.1 kW
  // Battery charging + RFC electrolyzer charging + curtailment = 69.9 kW
  const totalIn = result.generationKW;
  const totalOut = result.demandServedKW + result.batteryChargeKW + (result.rfcChargeKW ?? 0) + result.curtailedGenerationKW;
  assert.ok(Math.abs(totalIn - totalOut) < 0.001, `Power balance must hold: In ${totalIn} vs Out ${totalOut}`);
  assert.equal(result.unmetEssentialLoadKW, 0);
  assert.equal(result.isSafe, true);
});

test('Energy Resilience — Battery reserve enforcement: zero discharge below 20% floor', () => {
  // Battery exactly at 20% (100 kWh)
  const initial = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 0.0,
      o2StoredKg: 0.0,
    }),
  });

  // Shortage: Solar 0 kW, Nuclear 40 kW, Essential 45 kW -> 5 kW deficit
  const result = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 45.0,
    batteryDischargeLimitKW: initial.safeBatteryPowerAvailableKW ?? 0,
    enableRFC: true,
  });

  // Battery should not discharge into the deficit because it is at 20% reserve floor
  assert.equal(result.batteryDischargeKW, 0);
  assert.equal(result.safeBatteryEnergyAvailableKWh, 0);
  assert.equal(result.safeBatteryPowerAvailableKW, 0);
  // Deficit is reported honestly
  assert.equal(result.unmetEssentialLoadKW, 5.0);
  assert.equal(result.deficitType, 'PARTIAL_ESSENTIAL_DEFICIT');
  assert.equal(result.energyManagementState, 'CRITICAL_POWER_SHORTAGE');
});

test('Energy Resilience — RFC electrolysis and fuel cell mass balance conservation', () => {
  const initialRFC = createDefaultRFCState({
    h2StoredKg: 2.0,
    o2StoredKg: 16.0,
    waterInventoryL: 50.0,
  });

  // 1. Electrolysis step with 15 kW surplus
  const elyStep = stepRFC({
    currentState: initialRFC,
    availableSurplusPowerKW: 15.0,
    requestedDischargeKW: 0,
    dtHours: 1.0,
  });

  assert.equal(elyStep.operatingMode, 'electrolyzing');
  assert.ok(elyStep.electrolyzerResult.h2ProducedKg > 0);
  assert.ok(elyStep.electrolyzerResult.o2ProducedKg > 0);
  assert.ok(elyStep.electrolyzerResult.waterConsumedL > 0);

  // Stoichiometric mass balance: O2 / H2 ≈ 7.9365
  const o2H2Ratio = elyStep.electrolyzerResult.o2ProducedKg / elyStep.electrolyzerResult.h2ProducedKg;
  assert.ok(Math.abs(o2H2Ratio - DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO) < 0.01);

  // 2. Fuel cell step consuming gas
  const fcStep = stepRFC({
    currentState: elyStep.nextState,
    availableSurplusPowerKW: 0,
    requestedDischargeKW: 10.0,
    dtHours: 1.0,
  });

  assert.equal(fcStep.operatingMode, 'generating');
  assert.ok(fcStep.fuelCellResult.powerDeliveredKW > 0);
  assert.ok(fcStep.fuelCellResult.waterProducedL > 0);
  assert.ok(fcStep.fuelCellResult.conversionLossKWh > 0);

  // Water produced should equal sum of H2 + O2 consumed
  const totalReactantConsumedKg = fcStep.fuelCellResult.h2ConsumedKg + fcStep.fuelCellResult.o2ConsumedKg;
  assert.ok(Math.abs(fcStep.fuelCellResult.waterProducedL - totalReactantConsumedKg) < 0.01);
});

test('Energy Resilience — Insufficient reactant limits or halts fuel cell generation', () => {
  // RFC with 5 kg H2 but 0 kg O2
  const zeroO2State = createDefaultRFCState({
    h2StoredKg: 5.0,
    o2StoredKg: 0.0,
  });

  const fcStep = stepRFC({
    currentState: zeroO2State,
    availableSurplusPowerKW: 0,
    requestedDischargeKW: 10.0,
    dtHours: 1.0,
  });

  assert.equal(fcStep.operatingMode, 'idle');
  assert.equal(fcStep.electricalOutputKW, 0);
  assert.equal(fcStep.fuelCellResult.limitingFactor, 'o2_depleted');
});

test('Energy Resilience — Insufficient water halts or limits electrolysis', () => {
  // RFC with 0 L water
  const zeroWaterState = createDefaultRFCState({
    h2StoredKg: 1.0,
    o2StoredKg: 8.0,
    waterInventoryL: 0.0,
  });

  const elyStep = stepRFC({
    currentState: zeroWaterState,
    availableSurplusPowerKW: 20.0,
    requestedDischargeKW: 0,
    availableWaterL: 0.0,
    dtHours: 1.0,
  });

  assert.equal(elyStep.electricalInputKW, 0);
  assert.equal(elyStep.electrolyzerResult.limitingFactor, 'water_shortage');
});

test('Energy Resilience — Scenario A: Normal sunlight charges battery and RFC', () => {
  const report = compareBaselineVsRFC('SCENARIO_A_NORMAL_SUNLIGHT');
  assert.equal(report.rfcEnabled.criticalShortagesCount, 0);
  assert.equal(report.rfcEnabled.cumulativeUnmetEssentialEnergyKWh, 0);
  assert.ok(report.rfcEnabled.totalRFCEnergyConsumedKWh > 0, 'RFC should absorb surplus power');
});

test('Energy Resilience — Scenario B: Short solar interruption handled safely by battery', () => {
  const report = compareBaselineVsRFC('SCENARIO_B_SHORT_INTERRUPTION');
  assert.equal(report.baseline.criticalShortagesCount, 0);
  assert.equal(report.rfcEnabled.criticalShortagesCount, 0);
  assert.ok(report.rfcEnabled.batteryMinSocPct >= 20.0);
});

test('Energy Resilience — Scenario C: Extended shortage where RFC prevents deficit', () => {
  const report = compareBaselineVsRFC('SCENARIO_C_EXTENDED_SHORTAGE');
  // Baseline without RFC suffers an essential deficit when battery hits reserve
  assert.ok(report.baseline.cumulativeUnmetEssentialEnergyKWh > 0, 'Baseline must show deficit');
  // RFC provides electricity to cover the deficit
  assert.ok(report.rfcEnabled.rfcElectricityDeliveredKWh > 0);
  assert.ok(report.summary.essentialEnergySavedKWh > 0);
});

test('Energy Resilience — Scenario D: Battery depleted, RFC fully charged supplies power within rating', () => {
  const scenarios = getResilienceScenarios();
  const run = runResilienceScenario(scenarios.SCENARIO_D_BATTERY_DEPLETED_RFC_CHARGED, { enableRFC: true });
  assert.equal(run.metrics.criticalShortagesCount, 0);
  assert.ok(run.metrics.rfcElectricityDeliveredKWh > 0);
  assert.equal(run.metrics.finalEnergyManagementState, 'RFC_SUPPORT');
});

test('Energy Resilience — Scenario E: Battery depleted, partial RFC fuel delivers energy then reports honest deficit', () => {
  const scenarios = getResilienceScenarios();
  const run = runResilienceScenario(scenarios.SCENARIO_E_BATTERY_DEPLETED_RFC_PARTIAL, { enableRFC: true });
  assert.ok(run.metrics.rfcElectricityDeliveredKWh > 0);
  assert.ok(run.metrics.cumulativeUnmetEssentialEnergyKWh > 0, 'Remaining deficit must be reported honestly');
  assert.equal(run.metrics.finalDeficitType, 'PARTIAL_ESSENTIAL_DEFICIT');
});

test('Energy Resilience — Scenario F: Battery depleted and RFC depleted reports honest deficit', () => {
  const scenarios = getResilienceScenarios();
  const run = runResilienceScenario(scenarios.SCENARIO_F_BOTH_DEPLETED, { enableRFC: true });
  assert.equal(run.metrics.rfcElectricityDeliveredKWh, 0);
  assert.ok(run.metrics.cumulativeUnmetEssentialEnergyKWh > 0);
  assert.equal(run.metrics.finalDeficitType, 'PARTIAL_ESSENTIAL_DEFICIT');
});

test('Energy Resilience — Scenario G: Insufficient reactant prevents unphysical fuel cell generation', () => {
  const scenarios = getResilienceScenarios();
  const run = runResilienceScenario(scenarios.SCENARIO_G_INSUFFICIENT_REACTANT, { enableRFC: true });
  assert.equal(run.metrics.rfcElectricityDeliveredKWh, 0);
  assert.ok(run.metrics.cumulativeUnmetEssentialEnergyKWh > 0);
});

test('Energy Resilience — Scenario H: Sunlight recovery resumes normal charging priorities', () => {
  const scenarios = getResilienceScenarios();
  const run = runResilienceScenario(scenarios.SCENARIO_H_RECOVERY, { enableRFC: true });
  assert.equal(run.metrics.finalEnergyManagementState, 'RECOVERY');
  assert.ok(run.metrics.batteryFinalSocPct > 20.0, 'Battery must recover above reserve');
});

test('Energy Resilience — Determinism: Repeated benchmark runs return identical metrics', () => {
  const report1 = compareBaselineVsRFC('SCENARIO_C_EXTENDED_SHORTAGE');
  const report2 = compareBaselineVsRFC('SCENARIO_C_EXTENDED_SHORTAGE');
  assert.deepEqual(report1.baseline, report2.baseline);
  assert.deepEqual(report1.rfcEnabled, report2.rfcEnabled);
  assert.deepEqual(report1.summary, report2.summary);
});

test('Energy Resilience — Exact 0.1 kW deficit verification (40.0 kW Nuclear vs 40.1 kW Essential)', () => {
  const depletedState = createDefaultResourceState({
    batteryStoredKWh: 100.0, // exactly at 20% hard reserve floor
    rfcState: createDefaultRFCState({ h2StoredKg: 0.0, o2StoredKg: 0.0 }),
  });

  const stepResult = stepResourceModel({
    currentState: depletedState,
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    batteryDischargeLimitKW: 0.0, // reserve floor locked
    enableRFC: true,
  });

  // Verify bus generation and deficit
  assert.equal(stepResult.solarGenerationKW, 0.0);
  assert.equal(stepResult.backupGenerationKW, 40.0);
  assert.equal(stepResult.batteryDischargeKW, 0.0);
  assert.equal(stepResult.rfcGenerationKW, 0.0);
  assert.equal(stepResult.essentialServedKW, 40.0);
  assert.equal(stepResult.unmetEssentialLoadKW, 0.1);
  assert.equal(stepResult.nextState.cumulativeUnmetEssentialEnergyKWh, 0.1);
  assert.equal(stepResult.nextState.shortageDurationHours, 1);
  assert.equal(stepResult.nextState.isLifeSupportCompromised, true);
  assert.equal(stepResult.nextState.energyManagementState, 'CRITICAL_POWER_SHORTAGE');
  assert.equal(stepResult.nextState.deficitType, 'PARTIAL_ESSENTIAL_DEFICIT');
  assert.equal(stepResult.nextState.batteryStoredKWh, 100.0, 'Battery must not discharge below 20% floor');
});

test('Energy Resilience — Step-by-step reproduction of Scenarios C, D, E, and F', () => {
  const scenarios = getResilienceScenarios();

  // Scenario C: Extended shortage
  const runC_base = runResilienceScenario(scenarios.SCENARIO_C_EXTENDED_SHORTAGE, { enableRFC: false });
  const runC_rfc = runResilienceScenario(scenarios.SCENARIO_C_EXTENDED_SHORTAGE, { enableRFC: true });
  assert.ok(runC_base.metrics.cumulativeUnmetEssentialEnergyKWh > 0, 'Baseline must encounter deficit');
  assert.equal(runC_rfc.metrics.cumulativeUnmetEssentialEnergyKWh, 0, 'RFC must eliminate deficit in Scenario C');
  assert.ok(runC_rfc.metrics.rfcElectricityDeliveredKWh > 0);

  // Scenario D: Battery depleted, RFC fully charged
  const runD = runResilienceScenario(scenarios.SCENARIO_D_BATTERY_DEPLETED_RFC_CHARGED, { enableRFC: true });
  assert.equal(runD.metrics.cumulativeUnmetEssentialEnergyKWh, 0);
  assert.equal(runD.metrics.finalEnergyManagementState, 'RFC_SUPPORT');

  // Scenario E: Partial RFC fuel runs out, honest remaining deficit reported
  const runE = runResilienceScenario(scenarios.SCENARIO_E_BATTERY_DEPLETED_RFC_PARTIAL, { enableRFC: true });
  assert.ok(runE.metrics.rfcElectricityDeliveredKWh > 0);
  assert.ok(runE.metrics.cumulativeUnmetEssentialEnergyKWh > 0);
  assert.equal(runE.metrics.finalDeficitType, 'PARTIAL_ESSENTIAL_DEFICIT');

  // Scenario F: Both depleted, immediate honest deficit
  const runF = runResilienceScenario(scenarios.SCENARIO_F_BOTH_DEPLETED, { enableRFC: true });
  assert.equal(runF.metrics.rfcElectricityDeliveredKWh, 0);
  assert.ok(runF.metrics.cumulativeUnmetEssentialEnergyKWh > 0);
  assert.equal(runF.metrics.finalDeficitType, 'PARTIAL_ESSENTIAL_DEFICIT');
});

test('Energy Resilience — Live Store: Non-oscillating solar surplus charges battery then RFC electrolyzer', () => {
  useHabitatStore.getState().resetSimulation();
  const store = useHabitatStore.getState();

  // Initial nominal conditions: 120 kW solar, 40 kW nuclear, battery 88.5%
  assert.equal(store.telemetry.solarGenerationKW, 120.0);
  assert.equal(store.telemetry.nuclearGenerationKW, 40.0);

  // Run consecutive ticks and verify stability (no alternating on/off oscillations)
  for (let i = 0; i < 4; i++) {
    useHabitatStore.getState().tickSimulation(0.25);
    const state = useHabitatStore.getState();
    assert.equal(state.rfcState.mode, 'electrolyzing');
    assert.ok(state.rfcState.currentElectricalInputKW! > 0);
    assert.equal(state.rfcState.currentElectricalOutputKW, 0);
  }
});

test('Energy Resilience — Live Store: Controls affect simulation behavior (Enable switch & Mode override)', () => {
  useHabitatStore.getState().resetSimulation();
  
  // 1. Toggling RFC disabled halts electrolysis even with solar surplus
  useHabitatStore.getState().setRFCEnabled(false);
  useHabitatStore.getState().tickSimulation(0.25);
  let state = useHabitatStore.getState();
  assert.equal(state.rfcState.isEnabled, false);
  assert.equal(state.rfcState.mode, 'unavailable');
  assert.equal(state.rfcState.currentElectricalInputKW, 0);

  // 2. Re-enabling restores active electrolysis
  useHabitatStore.getState().setRFCEnabled(true);
  useHabitatStore.getState().tickSimulation(0.25);
  state = useHabitatStore.getState();
  assert.equal(state.rfcState.isEnabled, true);
  assert.equal(state.rfcState.mode, 'electrolyzing');

  // 3. Mode override 'idle' forces RFC to standby despite available solar surplus
  useHabitatStore.getState().setRFCModeOverride('idle');
  useHabitatStore.getState().tickSimulation(0.25);
  state = useHabitatStore.getState();
  assert.equal(state.rfcState.mode, 'idle');
  assert.equal(state.rfcState.currentElectricalInputKW, 0);
});

test('Energy Resilience — Live Store: Solar shortage respects 20% floor, uses RFC fuel cell, and logs events', () => {
  useHabitatStore.getState().resetSimulation();
  
  // Set solar to 0, battery at 20% floor (100 kWh), RFC charged
  useHabitatStore.setState({
    equipment: useHabitatStore.getState().equipment.map((e) =>
      e.type === 'solar_array' ? { ...e, powerKW: 0 } : e
    ),
    telemetry: {
      ...useHabitatStore.getState().telemetry,
      solarGenerationKW: 0,
      batterySocPct: 20.0,
      batteryStoredKWh: 100.0,
    },
    rfcState: createDefaultRFCState({ h2StoredKg: 10.0, o2StoredKg: 80.0, isEnabled: true }),
    rfcModeOverride: 'auto',
  });

  useHabitatStore.getState().tickSimulation(0.25);
  const state = useHabitatStore.getState();

  // Battery must not breach 20% reserve floor
  assert.equal(state.telemetry.batterySocPct, 20.0);
  assert.equal(state.telemetry.batteryStoredKWh, 100.0);

  // RFC fuel cell must deliver power up to rated 15 kW
  assert.equal(state.rfcState.mode, 'generating');
  assert.equal(state.rfcState.currentElectricalOutputKW, 15.0);
  assert.equal(state.telemetry.energyManagementState, 'RFC_SUPPORT');
  assert.equal(state.telemetry.unmetEssentialLoadKW, 0.0);

  // Event log must contain RFC activation event
  const hasRFCGenEvent = state.eventLog.some((e) => e.eventType === 'rfc_activated');
  assert.ok(hasRFCGenEvent, 'Must record RFC activation event in event log');
});
