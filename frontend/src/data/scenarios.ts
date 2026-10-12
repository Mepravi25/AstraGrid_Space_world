import { ScenarioDefinition } from '../types/simulation';

export const PREDEFINED_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'nominal_daytime',
    name: 'Nominal High-Sun Noon',
    shortDescription: '100% Solar insolation with net positive energy storage.',
    detailedDescription: 'Full solar irradiation at Lunar South Pole ridge. The dual-axis solar array generates 120 kW, easily powering all habitat subsystems while fast-charging the BESS battery bank at +28.5 kW.',
    solarModifier: 1.0,
    demandModifier: 1.0,
    initialBatterySoc: 88.5,
    initialWaterReservePct: 89.3,
    equipmentOverrides: {
      'solar-array-alpha': { status: 'nominal', powerKW: 120.0 },
      'nuclear-kilopower': { status: 'nominal', powerKW: 40.0 },
      'solid-waste-pyro': { status: 'nominal', powerKW: -11.8 },
      'battery-bank-bess': { status: 'nominal', powerKW: 28.5 }
    }
  },
  {
    id: 'lunar_dusk',
    name: 'Lunar Dusk & Topographic Eclipse',
    shortDescription: 'Solar generation falls to 10%; Battery discharge transitions.',
    detailedDescription: 'Low crater rim topography creates a prolonged solar shadow. Solar generation drops sharply to 12 kW. Nuclear Kilopower sustains baseload while the BESS switches to active discharge (-35 kW) to keep life support nominal.',
    solarModifier: 0.1,
    demandModifier: 0.95,
    initialBatterySoc: 74.0,
    initialWaterReservePct: 87.1,
    equipmentOverrides: {
      'solar-array-alpha': { status: 'warning', powerKW: 12.0 },
      'battery-bank-bess': { status: 'nominal', powerKW: -34.8 },
      'solid-waste-pyro': { status: 'nominal', powerKW: -6.0 }
    }
  },
  {
    id: 'eclss_stress_surge',
    name: 'ECLSS Resource Spike Surge',
    shortDescription: 'Intense water recovery & O2 electrolysis load spike.',
    detailedDescription: 'Simultaneous post-EVA cabin depressurization, extravehicular oxygen canister recharging, and dirty greywater batch filtration create a major power demand spike (+32 kW above average). Battery discharge accelerates.',
    solarModifier: 0.75,
    demandModifier: 1.45,
    initialBatterySoc: 62.0,
    initialWaterReservePct: 78.5,
    equipmentOverrides: {
      'water-recycling-vcd': { status: 'warning', powerKW: -11.5 },
      'oxygen-gen-eclss': { status: 'warning', powerKW: -19.5 },
      'battery-bank-bess': { status: 'nominal', powerKW: -48.2 }
    }
  },
  {
    id: 'critical_anomaly',
    name: 'Solar Jam & Battery Depletion Alert',
    shortDescription: 'Array tracker failure + critical battery reserve warning.',
    detailedDescription: 'Severe solar tracking drive motor freeze combined with elevated lunar regolith dust occlusion forces solar output to 0 kW. Battery state of charge drops to 24.8%. Autonomous load shedding deactivates the solid-waste unit to protect critical life support.',
    solarModifier: 0.0,
    demandModifier: 0.65,
    initialBatterySoc: 24.8,
    initialWaterReservePct: 69.0,
    equipmentOverrides: {
      'solar-array-alpha': { status: 'critical', powerKW: 0.0 },
      'battery-bank-bess': { status: 'warning', powerKW: -18.2 },
      'solid-waste-pyro': { status: 'offline', powerKW: 0.0 },
      'power-distribution-hub': { status: 'warning', powerKW: -1.2 }
    }
  }
];
