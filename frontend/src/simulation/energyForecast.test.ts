import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateEnergyForecast,
  resolveForecastHorizonForScenario,
} from './energyForecast.ts';
import { generateCraterEclipseForecast } from './forecast.ts';

test('Energy Forecast — Adequate solar generation maintains NORMAL status and preserves battery', () => {
  const assessment = estimateEnergyForecast({
    scenarioId: 'nominal_daytime',
    batteryStoredKWh: 442.5, // 88.5% SoC
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 120.0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 61.6,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
  });

  assert.equal(assessment.status, 'NORMAL');
  assert.equal(assessment.isUnknown, false);
  assert.equal(assessment.horizonHours, 24);
  assert.ok(assessment.expectedSolarAvgKW > 30.0, 'Average solar generation should be substantial');
  assert.ok(assessment.expectedSolarPeakKW >= 80.0, 'Peak solar generation should be high');
  assert.ok(assessment.predictedNetPowerKW > 0, 'Net power balance should be positive on average');
  assert.equal(assessment.hoursToBatteryReserve, null, 'Battery should not hit reserve floor');
  assert.match(assessment.timeToReserveFormatted, /Net Positive|Preserved/);
  assert.equal(assessment.isEssentialShortfallPredicted, false);
  assert.equal(assessment.maxUnmetEssentialKW, 0);
  assert.equal(assessment.rfcFuelCanSupport, true);
  assert.ok(assessment.riskExplanation.includes('NORMAL'));
});

test('Energy Forecast — Falling solar generation / eclipse detects trend and warns of deficit', () => {
  const assessment = estimateEnergyForecast({
    scenarioId: 'lunar_dusk',
    batteryStoredKWh: 370.0, // 74% SoC
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 12.0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 55.8,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
  });

  assert.ok(
    assessment.solarTrend === 'eclipsed' || assessment.solarTrend === 'falling',
    `Expected eclipsed or falling trend, got ${assessment.solarTrend}`
  );
  assert.ok(
    assessment.status === 'WATCH' || assessment.status === 'WARNING',
    `Expected WATCH or WARNING status, got ${assessment.status}`
  );
  assert.equal(assessment.isUnknown, false);
});

test('Energy Forecast — Battery reserve prediction computes exact depletion timeline to 20% floor', () => {
  // Scenario with 0 kW solar, 40 kW nuclear, 60 kW total demand, and 35 kW essential demand (sustainable by nuclear)
  // Battery starting at 400.0 kWh. 20% floor = 100.0 kWh -> Usable energy above floor = 300.0 kWh
  // Chemical drain per hour = 20.0 kW / 0.95 = 21.0526 kWh/h
  // Expected time to reserve floor = 300.0 / 21.0526 = 14.25 hours
  const zeroSolarHorizon = generateCraterEclipseForecast({
    startHour: 0,
    eclipseStartHour: 0,
    eclipseDurationHours: 24,
    nuclearGenerationKW: 40.0,
  });

  const assessment = estimateEnergyForecast({
    batteryStoredKWh: 400.0,
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 60.0,
    essentialDemandKW: 35.0, // Nuclear 40 kW covers essential demand after battery reaches reserve
    rfcUsableElectricalEnergyKWh: 144.0,
    customHorizon: zeroSolarHorizon,
  });

  assert.notEqual(assessment.hoursToBatteryReserve, null);
  // Expected ~14.2h to 14.3h
  assert.ok(
    assessment.hoursToBatteryReserve! >= 14.0 && assessment.hoursToBatteryReserve! <= 14.5,
    `Expected ~14.25h to battery reserve, got ${assessment.hoursToBatteryReserve}`
  );
  assert.equal(assessment.timeToReserveFormatted, `${assessment.hoursToBatteryReserve!.toFixed(1)}h`);
  assert.equal(assessment.status, 'WARNING');
  assert.equal(assessment.isEssentialShortfallPredicted, false);
});

test('Energy Forecast — Battery already at 20% reserve floor reports 0.0h immediately without fake countdown', () => {
  const zeroSolarHorizon = generateCraterEclipseForecast({
    startHour: 0,
    eclipseStartHour: 0,
    eclipseDurationHours: 24,
    nuclearGenerationKW: 40.0,
  });

  const assessment = estimateEnergyForecast({
    batteryStoredKWh: 100.0, // Exactly at 20% floor
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 60.0,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
    customHorizon: zeroSolarHorizon,
  });

  assert.equal(assessment.hoursToBatteryReserve, 0.0);
  assert.match(assessment.timeToReserveFormatted, /0\.0h/);
});

test('Energy Forecast — Existing nuclear contribution: 40 kW continuous baseload prevents immediate collapse', () => {
  const zeroSolarHorizon = generateCraterEclipseForecast({
    startHour: 0,
    eclipseStartHour: 0,
    eclipseDurationHours: 24,
    nuclearGenerationKW: 40.0,
  });

  // With 40.0 kW nuclear and 40.1 kW essential load, net deficit is only 0.1 kW
  const withNuclear = estimateEnergyForecast({
    batteryStoredKWh: 105.0, // Only 5 kWh above reserve floor
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 40.1,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
    customHorizon: zeroSolarHorizon,
  });

  // Usable energy = 5 kWh. Deficit = 0.1 kW -> Drain = 0.105 kWh/h. 5 / 0.105 = 47.5h > 24h
  assert.equal(withNuclear.isEssentialShortfallPredicted, false);
  assert.equal(withNuclear.hoursToBatteryReserve, null); // Survives the 24h horizon due to nuclear baseload!

  // Now simulate reactor scram (0 kW nuclear baseload) with 40.1 kW essential load
  const noNuclearHorizon = generateCraterEclipseForecast({
    startHour: 0,
    eclipseStartHour: 0,
    eclipseDurationHours: 24,
    nuclearGenerationKW: 0.0,
  });

  const withoutNuclear = estimateEnergyForecast({
    batteryStoredKWh: 105.0,
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 0.0,
    totalDemandKW: 40.1,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
    customHorizon: noNuclearHorizon,
  });

  // Without nuclear, 40.1 kW deficit depletes 5 kWh in under 0.2 hours and triggers CRITICAL shortfall!
  assert.ok(withoutNuclear.hoursToBatteryReserve! < 1.0);
  assert.equal(withoutNuclear.isEssentialShortfallPredicted, true);
  assert.equal(withoutNuclear.status, 'CRITICAL');
  assert.ok(withoutNuclear.maxUnmetEssentialKW >= 39.0);
});

test('Energy Forecast — Passive RFC fuel support evaluation accounts for reactant reserve without activating', () => {
  const zeroSolarHorizon = generateCraterEclipseForecast({
    startHour: 0,
    eclipseStartHour: 0,
    eclipseDurationHours: 24,
    nuclearGenerationKW: 40.0,
  });

  // Shortfall occurs: Battery at reserve (100 kWh), generation = 40 kW, essential = 40.1 kW -> 0.1 kW shortfall for 24h = 2.4 kWh total deficit
  // If RFC has 144 kWh usable electrical energy, it CAN support
  const canSupport = estimateEnergyForecast({
    batteryStoredKWh: 100.0,
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 40.1,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 144.0,
    customHorizon: zeroSolarHorizon,
  });

  assert.equal(canSupport.isEssentialShortfallPredicted, true);
  assert.equal(canSupport.rfcFuelCanSupport, true);
  assert.ok(canSupport.rfcSupportHoursAvailable > 0);

  // If RFC is empty (0 kWh usable), it CANNOT support
  const cannotSupport = estimateEnergyForecast({
    batteryStoredKWh: 100.0,
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 40.1,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 0.0,
    customHorizon: zeroSolarHorizon,
  });

  assert.equal(cannotSupport.isEssentialShortfallPredicted, true);
  assert.equal(cannotSupport.rfcFuelCanSupport, false);
});

test('Energy Forecast — Unknown inputs gracefully report limitations instead of inventing a countdown', () => {
  const unknownAssessment = estimateEnergyForecast({
    scenarioId: 'unmodeled_alien_eclipse',
    batteryStoredKWh: 300.0,
    currentSolarKW: 10.0,
    totalDemandKW: 60.0,
  });

  assert.equal(unknownAssessment.isUnknown, true);
  assert.equal(unknownAssessment.hoursToBatteryReserve, null);
  assert.match(unknownAssessment.timeToReserveFormatted, /Cannot estimate/i);
  assert.match(unknownAssessment.riskExplanation, /unknown/i);
  assert.equal(unknownAssessment.status, 'WATCH');

  // Also test null horizon
  const nullHorizonAssessment = estimateEnergyForecast({
    batteryStoredKWh: 300.0,
    customHorizon: null,
  });
  assert.equal(nullHorizonAssessment.isUnknown, true);
  assert.match(nullHorizonAssessment.timeToReserveFormatted, /Cannot estimate/i);
});

test('Energy Forecast — Determinism: Repeated invocations yield bit-exact identical metrics', () => {
  const input = {
    scenarioId: 'crater_eclipse',
    batteryStoredKWh: 250.0,
    batteryCapacityKWh: 500.0,
    batteryMinReservePct: 20.0,
    currentSolarKW: 15.0,
    nuclearGenerationKW: 40.0,
    totalDemandKW: 50.0,
    essentialDemandKW: 40.1,
    rfcUsableElectricalEnergyKWh: 120.0,
  };

  const run1 = estimateEnergyForecast(input);
  const run2 = estimateEnergyForecast(input);

  assert.deepEqual(run1, run2);
});
