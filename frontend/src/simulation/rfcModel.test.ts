import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HYDROGEN_LHV_KWH_PER_KG,
  DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO,
  DEFAULT_STOICHIOMETRIC_WATER_PER_H2_RATIO,
  DEFAULT_RFC_CONFIG,
  createDefaultRFCConfig,
  createDefaultRFCState,
  calculateUsableStoredEnergy,
  calculateElectrolysisMasses,
  litersToKgWater,
  kgWaterToLiters,
  stepElectrolyzer,
  stepFuelCell,
  stepRFC,
} from './rfcModel.ts';
import { stepResourceModel } from './resourceModel.ts';
import { createDefaultResourceState } from './types.ts';
import { getWaterManagementStatus, createRFCWaterFlowRecord } from './waterManagement.ts';

// ============================================================================
// 1. PHYSICAL CONSTANTS, MASS BALANCE & STOICHIOMETRY
// ============================================================================

test('RFC Physical Model — Stoichiometric mass balance and water density', () => {
  // 2 H2O -> 2 H2 + O2
  assert.ok(
    Math.abs(DEFAULT_STOICHIOMETRIC_O2_PER_H2_RATIO - 7.9365) < 0.001,
    'O2/H2 stoichiometric ratio must be approximately 8.0 (~7.9365 kg O2 per kg H2)'
  );
  assert.ok(
    Math.abs(DEFAULT_STOICHIOMETRIC_WATER_PER_H2_RATIO - 8.9365) < 0.001,
    'H2O/H2 stoichiometric ratio must be approximately 9.0 (~8.9365 kg H2O per kg H2)'
  );

  // Conversion helpers
  assert.strictEqual(litersToKgWater(100.0), 100.0, '1 L liquid water = 1 kg liquid water at standard density');
  assert.strictEqual(kgWaterToLiters(50.0), 50.0, '50 kg water = 50 L water');

  // Verify reaction masses
  const reaction = calculateElectrolysisMasses(2.0);
  assert.strictEqual(reaction.h2Kg, 2.0);
  assert.ok(Math.abs(reaction.o2Kg - 2.0 * 7.9365) < 1e-6);
  assert.ok(Math.abs(reaction.waterKg - (reaction.h2Kg + reaction.o2Kg)) < 1e-6, 'Mass conservation must hold exactly');
  assert.strictEqual(reaction.waterLiters, reaction.waterKg);
});

test('RFC Physical Model — Hydrogen LHV specific energy basis', () => {
  // LHV: 120.0 MJ/kg / 3.6 = 33.3333... kWh/kg
  assert.ok(
    Math.abs(HYDROGEN_LHV_KWH_PER_KG - 33.333333333333336) < 1e-6,
    'Hydrogen LHV must be defined as 120 MJ/kg (33.333 kWh/kg)'
  );
});

test('RFC Physical Model — Stored energy calculated strictly from limiting reactant', () => {
  const config = createDefaultRFCConfig({
    h2CapacityKg: 15.0,
    o2CapacityKg: 120.0,
    minH2InventoryKg: 0.1,
    minO2InventoryKg: 0.8,
    fuelCellEfficiency: 0.60,
  });

  // Balanced: 1.0 kg usable H2, 7.9365 kg usable O2
  const balanced = calculateUsableStoredEnergy(1.1, 7.9365 + 0.8, config);
  assert.strictEqual(balanced.limitingReactant, 'hydrogen');
  assert.strictEqual(balanced.usableH2Kg, 1.0);
  const expectedChemKWh = Number((1.0 * HYDROGEN_LHV_KWH_PER_KG).toFixed(3));
  assert.strictEqual(balanced.chemicalEnergyKWh, expectedChemKWh);
  const expectedElecKWh = Number((expectedChemKWh * 0.60).toFixed(3));
  assert.strictEqual(balanced.electricalEnergyKWh, expectedElecKWh);

  // Oxygen-limited: Plenty of H2 (5.0 kg), but only 0.8 kg O2 (at min floor)
  const o2Depleted = calculateUsableStoredEnergy(5.1, 0.8, config);
  assert.strictEqual(o2Depleted.usableH2Kg, 0, 'No usable H2 if usable O2 is zero');
  assert.strictEqual(o2Depleted.chemicalEnergyKWh, 0);
  assert.strictEqual(o2Depleted.electricalEnergyKWh, 0);

  // Partial oxygen: 5.0 kg H2, but only 7.9365 kg usable O2 (enough for only 1.0 kg H2)
  const o2Constrained = calculateUsableStoredEnergy(5.1, 7.9365 + 0.8, config);
  assert.strictEqual(o2Constrained.limitingReactant, 'oxygen');
  assert.strictEqual(o2Constrained.usableH2Kg, 1.0, 'Usable H2 must clamp to O2 equivalent, ignoring surplus H2');
});

// ============================================================================
// 2. ELECTROLYZER CHARGING TESTS
// ============================================================================

test('Electrolyzer — Mass balance, power bounds and conversion losses', () => {
  const state = createDefaultRFCState({
    h2StoredKg: 0.0,
    o2StoredKg: 0.0,
    waterInventoryL: 500.0,
  });
  const config = createDefaultRFCConfig({
    electrolyzerRatedPowerKW: 20.0,
    electrolyzerEfficiency: 0.72,
  });

  // Power budget 20 kW for 1 hour = 20 kWh
  const result = stepElectrolyzer({
    currentState: state,
    availablePowerBudgetKW: 20.0,
    availableWaterL: 500.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(result.powerConsumedKW, 20.0);
  assert.strictEqual(result.energyConsumedKWh, 20.0);
  // Chemical energy = 20 * 0.72 = 14.4 kWh
  assert.strictEqual(result.chemicalEnergyStoredKWh, 14.4);
  // Conversion loss = 20 * (1 - 0.72) = 5.6 kWh
  assert.strictEqual(result.conversionLossKWh, 5.6);

  // Mass of H2 = 14.4 / 33.3333333 = 0.432 kg
  const expectedH2 = 14.4 / HYDROGEN_LHV_KWH_PER_KG;
  assert.ok(Math.abs(result.h2ProducedKg - expectedH2) < 0.001);

  // Mass of O2 = H2 * 7.9365
  assert.ok(Math.abs(result.o2ProducedKg - result.h2ProducedKg * 7.9365) < 0.001);

  // Water consumed = H2 + O2
  const expectedWater = result.h2ProducedKg + result.o2ProducedKg;
  assert.ok(Math.abs(result.waterConsumedL - expectedWater) < 0.001);
  assert.strictEqual(result.unusedPowerBudgetKW, 0);
  assert.strictEqual(result.limitingFactor, 'rated_power');
});

test('Electrolyzer — Clamped by available power budget', () => {
  const state = createDefaultRFCState({ h2StoredKg: 0.0, o2StoredKg: 0.0, waterInventoryL: 100.0 });
  const result = stepElectrolyzer({
    currentState: state,
    availablePowerBudgetKW: 8.5, // Less than 20 kW rated
    availableWaterL: 100.0,
    dtHours: 1.0,
  });

  assert.strictEqual(result.powerConsumedKW, 8.5);
  assert.strictEqual(result.unusedPowerBudgetKW, 0);
  assert.strictEqual(result.limitingFactor, 'power_budget');
});

test('Electrolyzer — Clamped by hydrogen storage capacity (no overfill)', () => {
  const config = createDefaultRFCConfig({ h2CapacityKg: 10.0 });
  const state = createDefaultRFCState({
    h2StoredKg: 9.95, // Headroom is only 0.05 kg
    o2StoredKg: 20.0,
    waterInventoryL: 100.0,
  }, config);

  const result = stepElectrolyzer({
    currentState: state,
    availablePowerBudgetKW: 50.0, // High power budget
    availableWaterL: 100.0,
    dtHours: 1.0,
    config,
  });

  // H2 production must not exceed 0.05 kg
  assert.ok(result.h2ProducedKg <= 0.05001);
  assert.strictEqual(result.limitingFactor, 'h2_capacity');
  assert.ok(result.unusedPowerBudgetKW > 0, 'Excess power budget must be left unused');
});

test('Electrolyzer — Clamped by oxygen storage capacity', () => {
  const config = createDefaultRFCConfig({ o2CapacityKg: 50.0 });
  const state = createDefaultRFCState({
    h2StoredKg: 1.0,
    o2StoredKg: 49.6, // Only 0.40 kg headroom
    waterInventoryL: 100.0,
  }, config);

  const result = stepElectrolyzer({
    currentState: state,
    availablePowerBudgetKW: 50.0,
    availableWaterL: 100.0,
    dtHours: 1.0,
    config,
  });

  assert.ok(result.o2ProducedKg <= 0.4001);
  assert.strictEqual(result.limitingFactor, 'o2_capacity');
});

test('Electrolyzer — Scenario G: Insufficient water halts or limits electrolysis', () => {
  const state = createDefaultRFCState({ h2StoredKg: 0.0, o2StoredKg: 0.0, waterInventoryL: 0.0 });
  const result = stepElectrolyzer({
    currentState: state,
    availablePowerBudgetKW: 20.0,
    availableWaterL: 0.0, // Zero water available
    dtHours: 1.0,
  });

  assert.strictEqual(result.powerConsumedKW, 0.0);
  assert.strictEqual(result.h2ProducedKg, 0.0);
  assert.strictEqual(result.waterConsumedL, 0.0);
  assert.strictEqual(result.limitingFactor, 'water_shortage');
  assert.strictEqual(result.unusedPowerBudgetKW, 20.0);
});

// ============================================================================
// 3. FUEL CELL DISCHARGING TESTS
// ============================================================================

test('Fuel Cell — Reaction mass balance, power rating and conversion losses', () => {
  const config = createDefaultRFCConfig({
    fuelCellRatedPowerKW: 15.0,
    fuelCellEfficiency: 0.60,
    waterRecoveryFraction: 0.98,
  });
  const state = createDefaultRFCState({
    h2StoredKg: 10.0,
    o2StoredKg: 80.0,
  }, config);

  // Request 15 kW for 1 hour = 15 kWh electrical output
  const result = stepFuelCell({
    currentState: state,
    requestedPowerKW: 15.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(result.powerDeliveredKW, 15.0);
  assert.strictEqual(result.energyDeliveredKWh, 15.0);
  // Chemical energy drawn = 15 / 0.60 = 25.0 kWh
  assert.strictEqual(result.chemicalEnergyConsumedKWh, 25.0);
  // Thermal loss = 25 - 15 = 10.0 kWh
  assert.strictEqual(result.conversionLossKWh, 10.0);

  // Reactants consumed: H2 = 25 / 33.3333333 = 0.75 kg
  const expectedH2 = 25.0 / HYDROGEN_LHV_KWH_PER_KG;
  assert.ok(Math.abs(result.h2ConsumedKg - expectedH2) < 0.001);
  assert.ok(Math.abs(result.o2ConsumedKg - result.h2ConsumedKg * 7.9365) < 0.001);

  // Water produced = H2 + O2
  const expectedWater = result.h2ConsumedKg + result.o2ConsumedKg;
  assert.ok(Math.abs(result.waterProducedL - expectedWater) < 0.001);
  assert.ok(Math.abs(result.waterRecoveredL - result.waterProducedL * 0.98) < 0.001);
  assert.strictEqual(result.unmetPowerKW, 0.0);
  assert.strictEqual(result.limitingFactor, 'rated_power');
});

test('Fuel Cell — Scenario D: Empty hydrogen tank yields zero generation', () => {
  const config = createDefaultRFCConfig({ minH2InventoryKg: 0.1 });
  const state = createDefaultRFCState({
    h2StoredKg: 0.05, // Below minimum floor 0.1 kg
    o2StoredKg: 50.0,
  }, config);

  const result = stepFuelCell({
    currentState: state,
    requestedPowerKW: 10.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(result.powerDeliveredKW, 0.0);
  assert.strictEqual(result.h2ConsumedKg, 0.0);
  assert.strictEqual(result.waterProducedL, 0.0);
  assert.strictEqual(result.unmetPowerKW, 10.0);
  assert.strictEqual(result.limitingFactor, 'h2_depleted');
});

test('Fuel Cell — Scenario E: Empty oxygen tank yields zero generation', () => {
  const config = createDefaultRFCConfig({ minO2InventoryKg: 0.8 });
  const state = createDefaultRFCState({
    h2StoredKg: 10.0,
    o2StoredKg: 0.5, // Below minimum floor 0.8 kg
  }, config);

  const result = stepFuelCell({
    currentState: state,
    requestedPowerKW: 10.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(result.powerDeliveredKW, 0.0);
  assert.strictEqual(result.h2ConsumedKg, 0.0);
  assert.strictEqual(result.waterProducedL, 0.0);
  assert.strictEqual(result.unmetPowerKW, 10.0);
  assert.strictEqual(result.limitingFactor, 'o2_depleted');
});

test('Fuel Cell — Partial load when fuel is scarce', () => {
  const config = createDefaultRFCConfig({
    fuelCellRatedPowerKW: 15.0,
    fuelCellEfficiency: 0.60,
    minH2InventoryKg: 0.0,
    minO2InventoryKg: 0.0,
  });

  // Exactly 0.1 kg of H2 available (holds 3.333 kWh chemical -> 2.0 kWh electricity)
  const state = createDefaultRFCState({
    h2StoredKg: 0.1,
    o2StoredKg: 10.0,
  }, config);

  const result = stepFuelCell({
    currentState: state,
    requestedPowerKW: 15.0, // Requested 15 kW, but fuel only allows 2.0 kW for 1 hour
    dtHours: 1.0,
    config,
  });

  assert.ok(Math.abs(result.powerDeliveredKW - 2.0) < 0.01);
  assert.ok(result.unmetPowerKW > 12.9);
  assert.strictEqual(result.limitingFactor, 'h2_depleted');
});

// ============================================================================
// 4. COMPOSITE RFC STEP & MUTUAL EXCLUSIVITY
// ============================================================================

test('RFC Composite Step — Mutual exclusivity prevents simultaneous charge and discharge in default mode', () => {
  const state = createDefaultRFCState({
    h2StoredKg: 5.0,
    o2StoredKg: 40.0,
    waterInventoryL: 200.0,
  });

  // Pass both surplus power AND discharge request simultaneously
  const result = stepRFC({
    currentState: state,
    availableSurplusPowerKW: 20.0,
    requestedDischargeKW: 10.0,
    modeOverride: 'auto',
    dtHours: 1.0,
  });

  assert.strictEqual(result.isSimultaneousOperationPrevented, true);
  // Auto mode prioritizes discharge to protect load
  assert.strictEqual(result.operatingMode, 'generating');
  assert.strictEqual(result.electricalOutputKW, 10.0);
  assert.strictEqual(result.electricalInputKW, 0.0, 'Electrolyzer must remain zero when generating');
});

test('RFC Composite Step — Gas inventory conservation across charge and discharge', () => {
  const config = createDefaultRFCConfig({
    electrolyzerRatedPowerKW: 20.0,
    fuelCellRatedPowerKW: 15.0,
    electrolyzerEfficiency: 0.72,
    fuelCellEfficiency: 0.60,
  });
  let state = createDefaultRFCState({
    h2StoredKg: 2.0,
    o2StoredKg: 20.0,
    waterInventoryL: 300.0,
  }, config);

  // 1. Charge for 1 hour with 10 kW surplus
  const chargeStep = stepRFC({
    currentState: state,
    availableSurplusPowerKW: 10.0,
    requestedDischargeKW: 0.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(chargeStep.operatingMode, 'electrolyzing');
  assert.ok(chargeStep.nextState.h2StoredKg > state.h2StoredKg);
  assert.ok(chargeStep.nextState.o2StoredKg > state.o2StoredKg);
  assert.ok(chargeStep.nextState.waterInventoryL < state.waterInventoryL);

  state = chargeStep.nextState;

  // 2. Discharge for 1 hour with 5 kW deficit
  const dischargeStep = stepRFC({
    currentState: state,
    availableSurplusPowerKW: 0.0,
    requestedDischargeKW: 5.0,
    dtHours: 1.0,
    config,
  });

  assert.strictEqual(dischargeStep.operatingMode, 'generating');
  assert.ok(dischargeStep.nextState.h2StoredKg < state.h2StoredKg);
  assert.ok(dischargeStep.nextState.o2StoredKg < state.o2StoredKg);
  assert.ok(dischargeStep.nextState.waterInventoryL > state.waterInventoryL); // Water recovered
});

// ============================================================================
// 5. RESOURCE MODEL INTEGRATION (SCENARIOS A - H)
// ============================================================================

test('Resource Model Integration — Scenario A: Surplus solar charges battery then RFC electrolyzer', () => {
  // Empty battery and empty RFC tanks
  const initial = createDefaultResourceState({
    batteryStoredKWh: 0.0,
    batterySocPct: 0.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 0.0,
      o2StoredKg: 0.0,
      waterInventoryL: 300.0,
    }),
  });

  // Massive solar generation: 140 kW solar + 40 kW nuclear = 180 kW total gen
  // Essential demand: 40.1 kW.
  // Surplus: 180 - 40.1 = 139.9 kW.
  // Max battery charge rate: 80 kW.
  // Surplus after battery: 139.9 - 80 = 59.9 kW.
  // RFC electrolyzer absorbs up to rated 20 kW.
  // Curtailment: 59.9 - 20 = 39.9 kW.
  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 140.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  assert.strictEqual(step.batteryChargeKW, 80.0, 'Battery absorbs up to max charge rate 80 kW');
  assert.strictEqual(step.rfcChargeKW, 20.0, 'RFC electrolyzer absorbs up to rated 20 kW from remaining surplus');
  assert.ok(Math.abs(step.curtailedGenerationKW - 39.9) < 0.01, 'Remaining surplus is curtailed');
  assert.ok(step.nextState.rfcState!.h2StoredKg > 0, 'Hydrogen inventory must increase');
  assert.ok(step.nextState.rfcState!.o2StoredKg > 0, 'Oxygen inventory must increase');

  // Exact Bus Power Balance: Gen == DemandServed + BatteryCharge + RFCCharge + Curtailment
  const totalBusIn = Number((step.generationKW + step.batteryDischargeKW + (step.rfcGenerationKW ?? 0)).toFixed(2));
  const totalBusOut = Number((step.demandServedKW + step.batteryChargeKW + (step.rfcChargeKW ?? 0) + step.curtailedGenerationKW).toFixed(2));
  assert.strictEqual(totalBusIn, totalBusOut, 'Bus balance must hold exactly during RFC charging');
});

test('Resource Model Integration — Scenario B: Solar shortage uses battery then RFC fuel cell', () => {
  // Battery with limited discharge capacity (only 10 kWh remaining, max discharge 10 kW)
  const initial = createDefaultResourceState({
    batteryStoredKWh: 10.0,
    batterySocPct: 2.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 8.0,
      o2StoredKg: 64.0,
    }),
  });

  // Nuclear = 40.0 kW, Solar = 0 kW. Total gen = 40.0 kW.
  // Essential demand: 40.1 kW. Plus flexible task 15 kW -> Total demand 55.1 kW.
  // Deficit = 15.1 kW.
  // Battery discharge caps at available energy: 10 kWh * 0.95 = 9.5 kW.
  // Remaining deficit after battery: 15.1 - 9.5 = 5.6 kW.
  // RFC fuel cell generates 5.6 kW!
  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
    tasks: [
      {
        id: 'flex1',
        name: 'Flex Load',
        taskType: 'science_electrolysis',
        durationHours: 1,
        powerKW: 15.0,
        priority: 2,
        earliestStartHour: 0,
        deadlineHour: 10,
        progressHours: 0,
        remainingHours: 1,
        isPreemptible: true,
      },
    ],
    dispatchedTaskIds: ['flex1'],
  });

  assert.strictEqual(step.rfcGenerationKW, 5.6, 'RFC fuel cell delivers remaining deficit 5.6 kW');
  assert.strictEqual(step.demandServedKW, 55.1, 'All loads served without shedding');
  assert.strictEqual(step.unmetEssentialLoadKW, 0.0);
  assert.ok(step.nextState.rfcState!.h2StoredKg < 8.0, 'Hydrogen must decline as electricity is delivered');

  // Exact Bus Power Balance
  const totalBusIn = Number((step.generationKW + step.batteryDischargeKW + (step.rfcGenerationKW ?? 0)).toFixed(2));
  const totalBusOut = Number((step.demandServedKW + step.batteryChargeKW + (step.rfcChargeKW ?? 0) + step.curtailedGenerationKW).toFixed(2));
  assert.strictEqual(totalBusIn, totalBusOut, 'Bus balance must hold exactly during RFC discharging');
});

test('Resource Model Integration — Scenario C: Extended shortage reports honest deficit when both depleted', () => {
  // Completely empty battery and empty RFC
  const initial = createDefaultResourceState({
    batteryStoredKWh: 0.0,
    batterySocPct: 0.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 0.0,
      o2StoredKg: 0.0,
    }),
  });

  // Generation = 40.0 kW. Essential demand = 40.1 kW. Deficit = 0.1 kW.
  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 0.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  assert.strictEqual(step.rfcGenerationKW, 0.0, 'Depleted RFC cannot generate power');
  assert.strictEqual(step.batteryDischargeKW, 0.0, 'Depleted battery cannot discharge');
  assert.strictEqual(step.unmetEssentialLoadKW, 0.1, 'Deficit must be reported honestly without fabrication');
  assert.strictEqual(step.isInfeasible, true);
  assert.strictEqual(step.nextState.isLifeSupportCompromised, true);
});

test('Resource Model Integration — Scenario F: Full gas storage stops electrolyzer without overfill', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 400.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 15.0, // 100% full
      o2StoredKg: 120.0, // 100% full
    }),
  });

  const step = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 120.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  assert.strictEqual(step.rfcChargeKW, 0.0, 'Full RFC tanks must not absorb power');
  assert.strictEqual(step.nextState.rfcState!.h2StoredKg, 15.0, 'Capacity ceiling must never be breached');
});

test('Resource Model Integration — Scenario H: Sunlight return enables normal charging resumption', () => {
  // Depleted night state
  const nightState = createDefaultResourceState({
    batteryStoredKWh: 100.0,
    batterySocPct: 20.0,
    rfcState: createDefaultRFCState({
      h2StoredKg: 1.0,
      o2StoredKg: 8.0,
    }),
  });

  // Morning arrives: 90 kW solar
  const morningStep = stepResourceModel({
    currentState: nightState,
    solarGenerationKW: 90.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  assert.ok(morningStep.batteryChargeKW > 0, 'Battery resumes charging');
  assert.ok((morningStep.rfcChargeKW ?? 0) > 0, 'RFC resumes charging once surplus allows');
  assert.ok(morningStep.nextState.rfcState!.h2StoredKg > 1.0, 'H2 inventory begins recovering');
});

// ============================================================================
// 6. WATER MANAGEMENT INTERFACE CONTRACT
// ============================================================================

test('Water Interface — Product water is non-potable process water and scope is documented', () => {
  const status = getWaterManagementStatus();
  assert.strictEqual(status.isImplemented, false, 'Complete water optimizer must NOT be claimed as implemented');
  assert.ok(status.scopeItems.includes('Potable-water inventory'));
  assert.ok(status.scopeItems.includes('Water recycling and treatment'));

  const flowRecord = createRFCWaterFlowRecord(5, 10.0, 10.0, 0.0, 50.0, 12.0, 11.76, 0.24, 60.0);
  assert.strictEqual(flowRecord.isPotableCertified, false, 'Fuel cell product water must NEVER be marked as potable certified in this phase');
  assert.strictEqual(flowRecord.fuelCellWaterProducedL, 12.0);
  assert.strictEqual(flowRecord.fuelCellWaterRecoveredL, 11.76);
});

// ============================================================================
// 7. DETERMINISM & STATE IMMUTABILITY
// ============================================================================

test('Determinism & Immutability — Zero mutation of prior state and bit-exact reproducibility', () => {
  const initial = createDefaultResourceState({
    batteryStoredKWh: 200.0,
    rfcState: createDefaultRFCState({ h2StoredKg: 4.5, o2StoredKg: 36.0 }),
  });
  const snapshot = JSON.stringify(initial);

  const run1 = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 70.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  const run2 = stepResourceModel({
    currentState: initial,
    solarGenerationKW: 70.0,
    backupGenerationKW: 40.0,
    essentialDemandKW: 40.1,
    enableRFC: true,
  });

  assert.strictEqual(JSON.stringify(initial), snapshot, 'Input state must remain strictly immutable');
  assert.deepStrictEqual(run1, run2, 'Identical simulation inputs must yield identical outputs');
});
