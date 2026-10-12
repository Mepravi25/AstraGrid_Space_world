import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNominalForecast,
  generateCraterEclipseForecast,
  generateDustStormForecast,
  getScenarioForecast,
  getAllScenarioForecasts,
  createDefaultFlexibleTasks,
} from './forecast.ts';
import { TOTAL_ESSENTIAL_LOAD_KW } from './types.ts';

test('Forecast Engine - All three scenarios generate exactly 24 hourly forecasts by default', () => {
  const nominal = generateNominalForecast();
  const eclipse = generateCraterEclipseForecast();
  const dustStorm = generateDustStormForecast();

  assert.strictEqual(nominal.horizonHours, 24);
  assert.strictEqual(nominal.hourlyForecasts.length, 24);

  assert.strictEqual(eclipse.horizonHours, 24);
  assert.strictEqual(eclipse.hourlyForecasts.length, 24);

  assert.strictEqual(dustStorm.horizonHours, 24);
  assert.strictEqual(dustStorm.hourlyForecasts.length, 24);

  // Hour sequences must be strictly sequential (0..23)
  for (let h = 0; h < 24; h++) {
    assert.strictEqual(nominal.hourlyForecasts[h].hour, h);
    assert.strictEqual(eclipse.hourlyForecasts[h].hour, h);
    assert.strictEqual(dustStorm.hourlyForecasts[h].hour, h);
  }
});

test('Forecast Engine - Determinism: Multiple invocations return identical results', () => {
  const nominalA = generateNominalForecast();
  const nominalB = generateNominalForecast();
  assert.deepStrictEqual(nominalA, nominalB, 'Nominal forecast must be completely deterministic');

  const eclipseA = generateCraterEclipseForecast();
  const eclipseB = generateCraterEclipseForecast();
  assert.deepStrictEqual(eclipseA, eclipseB, 'Eclipse forecast must be completely deterministic');

  const dustA = generateDustStormForecast();
  const dustB = generateDustStormForecast();
  assert.deepStrictEqual(dustA, dustB, 'Dust storm forecast must be completely deterministic');
});

test('Forecast Engine - Nominal Solar Scenario has smooth daytime generation and zero occlusion', () => {
  const forecast = generateNominalForecast();

  for (const h of forecast.hourlyForecasts) {
    assert.strictEqual(h.nuclearGenerationKW, 40.0, 'Nuclear generation must be continuous 40 kW');
    assert.strictEqual(h.essentialDemandKW, TOTAL_ESSENTIAL_LOAD_KW, 'Essential demand must match TOTAL_ESSENTIAL_LOAD_KW');
    assert.strictEqual(h.isEclipse, false, 'No eclipse in nominal scenario');
    assert.strictEqual(h.dustOcclusionPct, 0.0, 'Zero dust occlusion in nominal scenario');
    assert.ok(h.sunElevationDeg >= 0, 'Sun elevation must be non-negative');
    assert.ok(h.solarFluxW_m2 >= 0, 'Solar flux must be non-negative');
    assert.ok(h.solarGenerationKW >= 0, 'Solar generation must be non-negative');
  }

  // Midday peak check (hours 11-13)
  const midday = forecast.hourlyForecasts[12];
  assert.ok(midday.solarGenerationKW > 70.0, 'Midday solar generation must exceed 70 kW');
  assert.ok(midday.sunElevationDeg > 35.0, 'Midday sun elevation must peak above 35 deg');
});

test('Forecast Engine - Crater Eclipse drops solar generation to zero during shadow window', () => {
  const forecast = generateCraterEclipseForecast({
    eclipseStartHour: 8,
    eclipseDurationHours: 8,
  });

  // Hours 0 to 7: Before eclipse -> positive solar generation during day
  const hour4 = forecast.hourlyForecasts[4];
  assert.strictEqual(hour4.isEclipse, false);
  assert.ok(hour4.solarGenerationKW > 0);

  // Hours 8 to 15: 8-hour crater shadow eclipse
  for (let h = 8; h <= 15; h++) {
    const entry = forecast.hourlyForecasts[h];
    assert.strictEqual(entry.isEclipse, true, `Hour ${h} must be marked as isEclipse`);
    assert.strictEqual(entry.solarGenerationKW, 0.0, `Hour ${h} solar generation must be 0 kW`);
    assert.strictEqual(entry.solarFluxW_m2, 0.0, `Hour ${h} solar flux must be 0 W/m²`);
    assert.strictEqual(entry.sunElevationDeg, 0.0, `Hour ${h} sun elevation must be 0 deg`);
    assert.strictEqual(entry.nuclearGenerationKW, 40.0);
    assert.strictEqual(entry.essentialDemandKW, TOTAL_ESSENTIAL_LOAD_KW);
  }

  // Hours 16 to 23: Sun reappears past rim
  const hour18 = forecast.hourlyForecasts[18];
  assert.strictEqual(hour18.isEclipse, false);
  assert.ok(hour18.solarGenerationKW > 0);
});

test('Forecast Engine - Dust Storm heavily attenuates solar irradiance and array power', () => {
  const nominal = generateNominalForecast();
  const dust = generateDustStormForecast({ dustOcclusionPct: 80.0 });

  for (let h = 0; h < 24; h++) {
    const nom = nominal.hourlyForecasts[h];
    const dst = dust.hourlyForecasts[h];

    assert.strictEqual(dst.dustOcclusionPct, 80.0);
    // Dust generation must be at most ~20% of nominal generation
    if (nom.solarGenerationKW > 1.0) {
      assert.ok(
        dst.solarGenerationKW < nom.solarGenerationKW * 0.25,
        `Dust solar power (${dst.solarGenerationKW} kW) must be heavily attenuated compared to nominal (${nom.solarGenerationKW} kW)`
      );
    }
  }

  // Midday peak under dust storm must not exceed 25 kW (vs 120 kW rating)
  const dustMidday = dust.hourlyForecasts[12];
  assert.ok(dustMidday.solarGenerationKW <= 25.0, 'Dust storm midday peak must be severely capped');
});

test('Forecast Engine - Configurable profiles allow custom parameters', () => {
  const custom = generateCraterEclipseForecast({
    horizonHours: 48,
    startHour: 10,
    nuclearGenerationKW: 50.0,
    essentialDemandKW: 42.0,
    eclipseStartHour: 14,
    eclipseDurationHours: 6,
  });

  assert.strictEqual(custom.horizonHours, 48);
  assert.strictEqual(custom.startHour, 10);
  assert.strictEqual(custom.hourlyForecasts.length, 48);
  assert.strictEqual(custom.hourlyForecasts[0].hour, 10);
  assert.strictEqual(custom.hourlyForecasts[0].nuclearGenerationKW, 50.0);
  assert.strictEqual(custom.hourlyForecasts[0].essentialDemandKW, 42.0);

  // Hour 14 relative to Sol: 14 % 24 = 14 -> isEclipse = true
  const hour14Entry = custom.hourlyForecasts.find((e) => e.hour === 14)!;
  assert.strictEqual(hour14Entry.isEclipse, true);
  assert.strictEqual(hour14Entry.solarGenerationKW, 0.0);
});

test('Forecast Engine - Scenario bundles provide coherent tasks, initial state, and engineering notes', () => {
  const scenarios = getAllScenarioForecasts();
  assert.ok(scenarios.nominal_solar);
  assert.ok(scenarios.crater_eclipse);
  assert.ok(scenarios.dust_storm);

  for (const [id, sc] of Object.entries(scenarios)) {
    assert.strictEqual(sc.scenarioId, id);
    assert.ok(sc.scenarioName.length > 0);
    assert.ok(sc.shortDescription.length > 0);
    assert.strictEqual(sc.horizon.hourlyForecasts.length, 24);
    assert.strictEqual(sc.defaultTasks.length, 5);
    assert.ok(sc.initialState.batteryStoredKWh > 0);
    assert.ok(sc.initialState.potableWaterLiters > 0);
    assert.ok(sc.assumptions.notes.length >= 3);
  }

  const tasks = createDefaultFlexibleTasks();
  assert.strictEqual(tasks.length, 5);
  assert.ok(tasks.some((t) => t.taskType === 'water_recycling'));
  assert.ok(tasks.some((t) => t.taskType === 'waste_pyrolysis'));
  assert.ok(tasks.some((t) => t.taskType === 'rover_recharge'));
  assert.ok(tasks.some((t) => t.taskType === 'science_electrolysis'));
  assert.ok(tasks.some((t) => t.taskType === 'regolith_sintering'));
});
