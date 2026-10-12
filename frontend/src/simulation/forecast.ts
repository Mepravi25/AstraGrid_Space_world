/**
 * Astra Grid / HabitatOS — Deterministic 24-Hour Environmental & Resource Forecast Engine
 * 
 * Generates reproducible, parameter-configured 24-hour lookahead horizons
 * for lunar surface operations across three benchmark operating scenarios:
 * 
 * 1. Nominal Solar Operation:
 *    Continuous sun availability with standard diurnal elevation trajectory,
 *    nominal solar flux (~1361 W/m²), 0% dust occlusion, and steady 40 kW nuclear baseload.
 * 
 * 2. Reduced Solar Availability (Crater-Related Eclipse):
 *    Topographic ridge / crater rim shadow blocking solar illumination for an 8-hour window
 *    (hours 8 to 15). Generation collapses to 40.0 kW nuclear baseload while essential load
 *    remains at 40.1 kW, inducing an immediate 0.1 kW electrical shortfall.
 * 
 * 3. Prolonged Solar Reduction (Dust-Storm Conditions):
 *    Severe regolith dust lofting attenuating incident solar radiation by 80% across the full sol.
 *    Peak solar array generation is crippled to ~24 kW (vs 120 kW nameplate), demanding
 *    heavy load shedding and task rationing.
 * 
 * Note: These are illustrative simulation models engineered for controller benchmarking,
 * not actual lunar ephemerides. All profiles are purely deterministic (zero random numbers).
 */

import type {
  HourlyForecast,
  ForecastHorizon,
  FlexibleTask,
  HabitatResourceState,
} from './types.ts';
import {
  SOLAR_ARRAY_PEAK_KW,
  KILOPOWER_BASELOAD_KW,
  TOTAL_ESSENTIAL_LOAD_KW,
  SOLAR_FLUX_NOMINAL_W_M2,
  DEFAULT_WATER_CONFIG,
  createDefaultResourceState,
} from './types.ts';

export type ForecastScenarioId = 'nominal_solar' | 'crater_eclipse' | 'dust_storm';

export interface ForecastScenarioConfig {
  /** Lookahead horizon length in hours (default: 24) */
  horizonHours?: number;
  /** Starting hour index relative to mission Sol (default: 0) */
  startHour?: number;
  /** Continuous nuclear power generation (kW) (default: 40.0 kW) */
  nuclearGenerationKW?: number;
  /** Continuous life-critical essential electricity demand (kW) (default: 40.1 kW) */
  essentialDemandKW?: number;
  /** Nameplate peak solar array power rating (kW) (default: 120.0 kW) */
  solarPeakKW?: number;
  /** Nominal exo-atmospheric solar constant (W/m²) (default: 1361.0 W/m²) */
  solarFluxNominalW_m2?: number;
  /** Regolith dust occlusion percentage (0 to 100%) (default depends on scenario) */
  dustOcclusionPct?: number;
  /** Starting hour of crater topographic eclipse shadow (default: 8) */
  eclipseStartHour?: number;
  /** Duration of eclipse in hours (default: 8) */
  eclipseDurationHours?: number;
}

export interface ScenarioForecast {
  scenarioId: ForecastScenarioId;
  scenarioName: string;
  shortDescription: string;
  detailedDescription: string;
  horizon: ForecastHorizon;
  defaultTasks: FlexibleTask[];
  initialState: HabitatResourceState;
  assumptions: {
    solarPeakKW: number;
    nuclearBaseloadKW: number;
    essentialDemandKW: number;
    waterBaselineConsumptionLPerHour: number;
    waterRecyclingThroughputLPerHour: number;
    notes: string[];
  };
}

/**
 * Creates standard benchmark set of flexible tasks.
 * 
 * Task inventory spans priority 1 (near-essential life support / fluid recovery)
 * to priority 4 (discretionary regolith 3D sintering).
 */
export function createDefaultFlexibleTasks(): FlexibleTask[] {
  return [
    {
      id: 'task_vcd_recycling',
      name: 'VCD Potable Water Distillation Batch',
      taskType: 'water_recycling',
      durationHours: 4,
      powerKW: 7.5,
      priority: 1,
      earliestStartHour: 2,
      deadlineHour: 18,
      progressHours: 0,
      remainingHours: 4,
      isPreemptible: true,
      waterYieldLPerHour: 3.136, // 3.2 L/h * 0.98 recovery efficiency
    },
    {
      id: 'task_o2_compression',
      name: 'EVA Oxygen Revitalization & Compression',
      taskType: 'science_electrolysis',
      durationHours: 4,
      powerKW: 10.0,
      priority: 2,
      earliestStartHour: 4,
      deadlineHour: 18,
      progressHours: 0,
      remainingHours: 4,
      isPreemptible: true,
    },
    {
      id: 'task_rover_charge',
      name: 'Pressurized Lunar Rover Traction Recharge',
      taskType: 'rover_recharge',
      durationHours: 5,
      powerKW: 8.0,
      priority: 2,
      earliestStartHour: 6,
      deadlineHour: 20,
      progressHours: 0,
      remainingHours: 5,
      isPreemptible: true,
    },
    {
      id: 'task_pyrolysis',
      name: 'Solid Waste Autoclave Pyrolysis Batch',
      taskType: 'waste_pyrolysis',
      durationHours: 3,
      powerKW: 11.8,
      priority: 3,
      earliestStartHour: 6,
      deadlineHour: 22,
      progressHours: 0,
      remainingHours: 3,
      isPreemptible: true,
      wasteConsumedKgPerHour: 5.0,
    },
    {
      id: 'task_regolith_3d',
      name: 'Habitat Berm Regolith Microwave Sintering',
      taskType: 'regolith_sintering',
      durationHours: 6,
      powerKW: 15.0,
      priority: 4,
      earliestStartHour: 8,
      deadlineHour: 24,
      progressHours: 0,
      remainingHours: 6,
      isPreemptible: true,
    },
  ];
}

/**
 * Calculates deterministic hourly solar conditions using a smooth diurnal curve.
 */
function computeHourlySolarProfile(
  hourInSol: number,
  solarPeakKW: number,
  fluxNominal: number,
  dustOcclusionPct: number,
  isEclipse: boolean
): {
  sunElevationDeg: number;
  solarFluxW_m2: number;
  solarGenerationKW: number;
} {
  if (isEclipse) {
    return {
      sunElevationDeg: 0.0,
      solarFluxW_m2: 0.0,
      solarGenerationKW: 0.0,
    };
  }

  // Smooth sinusoidal sun elevation curve across 24h cycle
  // Elevation reaches maximum of 42.0 degrees at hour 12
  const normalizedPhase = (hourInSol + 0.5) / 24.0;
  const sinArc = Math.sin(Math.PI * normalizedPhase);
  const sunElevationDeg = Math.max(0, Number((42.0 * sinArc).toFixed(2)));

  // Incident flux proportional to elevation angle
  const opticalFactor = Math.max(0, Math.sin((sunElevationDeg * Math.PI) / 180.0));
  const cleanFlux = fluxNominal * opticalFactor;
  const dustFactor = Math.max(0, 1.0 - dustOcclusionPct / 100.0);
  const effectiveFlux = Number((cleanFlux * dustFactor).toFixed(1));

  // Solar array power generation
  const generationKW = Number((solarPeakKW * opticalFactor * dustFactor).toFixed(2));

  return {
    sunElevationDeg,
    solarFluxW_m2: effectiveFlux,
    solarGenerationKW: generationKW,
  };
}

/**
 * Generates a 24-hour forecast for Nominal Solar Operation.
 */
export function generateNominalForecast(
  config?: ForecastScenarioConfig
): ForecastHorizon {
  const horizonHours = config?.horizonHours ?? 24;
  const startHour = config?.startHour ?? 0;
  const nuclearKW = config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW;
  const essentialKW = config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW;
  const solarPeakKW = config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW;
  const fluxNominal = config?.solarFluxNominalW_m2 ?? SOLAR_FLUX_NOMINAL_W_M2;
  const dustPct = config?.dustOcclusionPct ?? 0.0;

  const hourlyForecasts: HourlyForecast[] = [];

  for (let i = 0; i < horizonHours; i++) {
    const hour = startHour + i;
    const solar = computeHourlySolarProfile(hour % 24, solarPeakKW, fluxNominal, dustPct, false);

    hourlyForecasts.push({
      hour,
      sunElevationDeg: solar.sunElevationDeg,
      solarFluxW_m2: solar.solarFluxW_m2,
      solarGenerationKW: solar.solarGenerationKW,
      nuclearGenerationKW: nuclearKW,
      essentialDemandKW: essentialKW,
      dustOcclusionPct: dustPct,
      isEclipse: false,
    });
  }

  return {
    startHour,
    horizonHours,
    hourlyForecasts,
  };
}

/**
 * Generates a 24-hour forecast for Reduced Solar Availability (Crater Eclipse).
 */
export function generateCraterEclipseForecast(
  config?: ForecastScenarioConfig
): ForecastHorizon {
  const horizonHours = config?.horizonHours ?? 24;
  const startHour = config?.startHour ?? 0;
  const nuclearKW = config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW;
  const essentialKW = config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW;
  const solarPeakKW = config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW;
  const fluxNominal = config?.solarFluxNominalW_m2 ?? SOLAR_FLUX_NOMINAL_W_M2;
  const dustPct = config?.dustOcclusionPct ?? 0.0;
  const eclipseStart = config?.eclipseStartHour ?? 8;
  const eclipseDuration = config?.eclipseDurationHours ?? 8;
  const eclipseEnd = eclipseStart + eclipseDuration;

  const hourlyForecasts: HourlyForecast[] = [];

  for (let i = 0; i < horizonHours; i++) {
    const hour = startHour + i;
    const hourInDay = hour % 24;
    const isEclipse = hourInDay >= eclipseStart && hourInDay < eclipseEnd;
    const solar = computeHourlySolarProfile(hourInDay, solarPeakKW, fluxNominal, dustPct, isEclipse);

    hourlyForecasts.push({
      hour,
      sunElevationDeg: solar.sunElevationDeg,
      solarFluxW_m2: solar.solarFluxW_m2,
      solarGenerationKW: solar.solarGenerationKW,
      nuclearGenerationKW: nuclearKW,
      essentialDemandKW: essentialKW,
      dustOcclusionPct: dustPct,
      isEclipse,
    });
  }

  return {
    startHour,
    horizonHours,
    hourlyForecasts,
  };
}

/**
 * Generates a 24-hour forecast for Prolonged Solar Reduction (Dust-Storm Conditions).
 */
export function generateDustStormForecast(
  config?: ForecastScenarioConfig
): ForecastHorizon {
  const horizonHours = config?.horizonHours ?? 24;
  const startHour = config?.startHour ?? 0;
  const nuclearKW = config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW;
  const essentialKW = config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW;
  const solarPeakKW = config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW;
  const fluxNominal = config?.solarFluxNominalW_m2 ?? SOLAR_FLUX_NOMINAL_W_M2;
  const dustPct = config?.dustOcclusionPct ?? 80.0; // 80% heavy dust occlusion

  const hourlyForecasts: HourlyForecast[] = [];

  for (let i = 0; i < horizonHours; i++) {
    const hour = startHour + i;
    const solar = computeHourlySolarProfile(hour % 24, solarPeakKW, fluxNominal, dustPct, false);

    hourlyForecasts.push({
      hour,
      sunElevationDeg: solar.sunElevationDeg,
      solarFluxW_m2: solar.solarFluxW_m2,
      solarGenerationKW: solar.solarGenerationKW,
      nuclearGenerationKW: nuclearKW,
      essentialDemandKW: essentialKW,
      dustOcclusionPct: dustPct,
      isEclipse: false,
    });
  }

  return {
    startHour,
    horizonHours,
    hourlyForecasts,
  };
}

/**
 * Retrieves the complete scenario bundle (horizon, tasks, state, engineering assumptions).
 */
export function getScenarioForecast(
  scenarioId: ForecastScenarioId,
  config?: ForecastScenarioConfig
): ScenarioForecast {
  const tasks = createDefaultFlexibleTasks();
  const initialState = createDefaultResourceState();

  switch (scenarioId) {
    case 'nominal_solar':
      return {
        scenarioId: 'nominal_solar',
        scenarioName: 'Nominal Solar Operation',
        shortDescription: 'Unobstructed 24-hour daytime solar cycle with full microgrid power headroom.',
        detailedDescription:
          'Clear sky lunar sol conditions. High solar generation during midday peak (~80-100 kW) combined with 40 kW nuclear baseload comfortably powers all 40.1 kW essential life-support loads while fully charging battery storage and accommodating all flexible tasks.',
        horizon: generateNominalForecast(config),
        defaultTasks: tasks,
        initialState,
        assumptions: {
          solarPeakKW: config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW,
          nuclearBaseloadKW: config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW,
          essentialDemandKW: config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW,
          waterBaselineConsumptionLPerHour: DEFAULT_WATER_CONFIG.baselineConsumptionLPerHour,
          waterRecyclingThroughputLPerHour: DEFAULT_WATER_CONFIG.recyclingThroughputLPerHour,
          notes: [
            'Solar array follows clean diurnal sine curve peaking at hour 12.',
            'Nuclear Stirling generator delivers steady 40.0 kW baseload.',
            'Essential loads total 40.1 kW; solar surplus easily offsets the 0.1 kW baseload deficit during daytime.',
          ],
        },
      };

    case 'crater_eclipse':
      return {
        scenarioId: 'crater_eclipse',
        scenarioName: 'Reduced Solar Availability (Crater-Related Eclipse)',
        shortDescription: '8-hour topographic crater rim eclipse shadow dropping solar generation to zero.',
        detailedDescription:
          'Habitat microgrid experiences an 8-hour shadow from hours 8 to 15 as the sun dips behind the crater rim. Total generation drops to the 40.0 kW Kilopower baseload, which is 0.1 kW below the 40.1 kW essential load. Flexible loads must be curtailed and battery storage must supply the deficit.',
        horizon: generateCraterEclipseForecast(config),
        defaultTasks: tasks,
        initialState: {
          ...initialState,
          batteryStoredKWh: 380.0, // Initial SoC 76.0%
          batterySocPct: 76.0,
        },
        assumptions: {
          solarPeakKW: config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW,
          nuclearBaseloadKW: config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW,
          essentialDemandKW: config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW,
          waterBaselineConsumptionLPerHour: DEFAULT_WATER_CONFIG.baselineConsumptionLPerHour,
          waterRecyclingThroughputLPerHour: DEFAULT_WATER_CONFIG.recyclingThroughputLPerHour,
          notes: [
            'Eclipse occurs from hour 8 to 15 (8 consecutive hours of 0 kW solar).',
            'Kilopower continuous generation (40.0 kW) is below essential load (40.1 kW).',
            'Battery must discharge at least 0.1 kW / 0.95 = 0.105 kWh per hour during eclipse to avoid life-support compromise.',
            'Uncontrolled flexible task execution during eclipse will rapidly deplete battery reserves.',
          ],
        },
      };

    case 'dust_storm':
      return {
        scenarioId: 'dust_storm',
        scenarioName: 'Prolonged Solar Reduction (Dust-Storm Conditions)',
        shortDescription: '80% optical depth dust occlusion suppressing solar array output across the 24h horizon.',
        detailedDescription:
          'High regolith electrostatic dust lofting reduces direct solar irradiance by 80% for the entire 24-hour horizon. Solar output peaks at only ~24 kW (vs 120 kW normal). Total generation (solar + nuclear) struggles to reach 64 kW at midday, requiring strict load management to prevent battery exhaustion.',
        horizon: generateDustStormForecast(config),
        defaultTasks: tasks,
        initialState: {
          ...initialState,
          batteryStoredKWh: 300.0, // Initial SoC 60.0%
          batterySocPct: 60.0,
        },
        assumptions: {
          solarPeakKW: config?.solarPeakKW ?? SOLAR_ARRAY_PEAK_KW,
          nuclearBaseloadKW: config?.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW,
          essentialDemandKW: config?.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW,
          waterBaselineConsumptionLPerHour: DEFAULT_WATER_CONFIG.baselineConsumptionLPerHour,
          waterRecyclingThroughputLPerHour: DEFAULT_WATER_CONFIG.recyclingThroughputLPerHour,
          notes: [
            'Optical depth attenuation factor is 80% (dustOcclusionPct = 80%).',
            'Combined solar and nuclear power barely leaves a 10-20 kW margin over essential loads during daytime.',
            'Simultaneous execution of multiple flexible tasks is physically infeasible without causing battery depletion.',
          ],
        },
      };
  }
}

/**
 * Returns a dictionary containing all three benchmark scenarios.
 */
export function getAllScenarioForecasts(
  config?: ForecastScenarioConfig
): Record<ForecastScenarioId, ScenarioForecast> {
  return {
    nominal_solar: getScenarioForecast('nominal_solar', config),
    crater_eclipse: getScenarioForecast('crater_eclipse', config),
    dust_storm: getScenarioForecast('dust_storm', config),
  };
}
