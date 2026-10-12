import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  TOTAL_ESSENTIAL_LOAD_KW,
  ESSENTIAL_LOAD_RATINGS,
  createDefaultResourceState,
  validateStateInvariants,
  SIMULATION_TIMESTEP_HOURS,
  KILOPOWER_BASELOAD_KW,
  SOLAR_ARRAY_PEAK_KW,
} from './types.ts';

test('Types Contract - Physical constants and units are consistent', () => {
  assert.strictEqual(SIMULATION_TIMESTEP_HOURS, 1.0, 'Timestep must be 1.0 hour');
  assert.strictEqual(KILOPOWER_BASELOAD_KW, 40.0, 'Nuclear baseload must be 40 kW');
  assert.strictEqual(SOLAR_ARRAY_PEAK_KW, 120.0, 'Solar peak must be 120 kW');
  assert.ok(TOTAL_ESSENTIAL_LOAD_KW > 40.0 && TOTAL_ESSENTIAL_LOAD_KW < 41.0, 'Essential load must sum to ~40.1 kW');
  assert.strictEqual(
    TOTAL_ESSENTIAL_LOAD_KW,
    ESSENTIAL_LOAD_RATINGS.mainHabitatLifeSupport +
      ESSENTIAL_LOAD_RATINGS.oxygenElectrolysisMin +
      ESSENTIAL_LOAD_RATINGS.potableWaterThermal +
      ESSENTIAL_LOAD_RATINGS.powerDistributionBus +
      ESSENTIAL_LOAD_RATINGS.lunarLanderStandby
  );
});

test('Types Contract - Default battery limits and constraints satisfy physical bounds', () => {
  assert.strictEqual(DEFAULT_BATTERY_CONFIG.capacityKWh, 500.0);
  assert.ok(DEFAULT_BATTERY_CONFIG.minReserveSocPct < DEFAULT_BATTERY_CONFIG.criticalReserveSocPct);
  assert.ok(DEFAULT_BATTERY_CONFIG.criticalReserveSocPct < DEFAULT_BATTERY_CONFIG.nominalMaxSocPct);
  assert.ok(DEFAULT_BATTERY_CONFIG.chargeEfficiency > 0.9 && DEFAULT_BATTERY_CONFIG.chargeEfficiency <= 1.0);
  assert.ok(DEFAULT_BATTERY_CONFIG.dischargeEfficiency > 0.9 && DEFAULT_BATTERY_CONFIG.dischargeEfficiency <= 1.0);
  assert.strictEqual(DEFAULT_SAFETY_CONSTRAINTS.minBatterySocPct, 20.0);
  assert.strictEqual(DEFAULT_SAFETY_CONSTRAINTS.allowEssentialShedding, false);
});

test('Types Contract - Default water limits satisfy conservation bounds', () => {
  assert.strictEqual(DEFAULT_WATER_CONFIG.capacityL, 3000.0);
  assert.strictEqual(DEFAULT_WATER_CONFIG.minReserveL, 500.0);
  assert.ok(DEFAULT_WATER_CONFIG.recoveryEfficiency > 0.95 && DEFAULT_WATER_CONFIG.recoveryEfficiency <= 1.0);
  assert.ok(DEFAULT_WATER_CONFIG.baselineConsumptionLPerHour > 0);
  assert.ok(DEFAULT_WATER_CONFIG.recyclingThroughputLPerHour > 0);
});

test('Types Contract - createDefaultResourceState produces deterministic, valid state', () => {
  const state1 = createDefaultResourceState();
  const state2 = createDefaultResourceState();

  assert.deepStrictEqual(state1, state2, 'Default resource states must be completely deterministic');
  assert.strictEqual(state1.batterySocPct, 88.5);
  assert.strictEqual(state1.potableWaterLiters, 2680.0);
  assert.strictEqual(state1.isEmergencyReserveBreached, false);
  assert.strictEqual(state1.isLifeSupportCompromised, false);

  const validation = validateStateInvariants(state1);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(validation.errors.length, 0);
});

test('Types Contract - validateStateInvariants detects out-of-bound states', () => {
  const invalidNegativeBattery = createDefaultResourceState({ batteryStoredKWh: -10 });
  const checkNegativeBattery = validateStateInvariants(invalidNegativeBattery);
  assert.strictEqual(checkNegativeBattery.isValid, false);
  assert.ok(checkNegativeBattery.errors.some((e) => e.includes('negative')));

  const invalidOvercharge = createDefaultResourceState({ batteryStoredKWh: 600 });
  const checkOvercharge = validateStateInvariants(invalidOvercharge);
  assert.strictEqual(checkOvercharge.isValid, false);
  assert.ok(checkOvercharge.errors.some((e) => e.includes('exceeds capacity')));

  const invalidNegativeWater = createDefaultResourceState({ potableWaterLiters: -50 });
  const checkNegativeWater = validateStateInvariants(invalidNegativeWater);
  assert.strictEqual(checkNegativeWater.isValid, false);
  assert.ok(checkNegativeWater.errors.some((e) => e.includes('Potable water')));
});
