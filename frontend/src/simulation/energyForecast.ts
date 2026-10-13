/**
 * Astra Grid / HabitatOS — Energy Forecast Assessment Engine
 * 
 * Module B: Integrates the deterministic 24-hour lookahead environmental
 * and solar forecast model into live telemetry monitoring.
 * 
 * Reuses the authoritative forecast engine from `forecast.ts`.
 * Calculates lookahead power balance, battery reserve timeline,
 * essential load shortfall risk, and passive RFC reactant readiness
 * WITHOUT dispatching or activating equipment.
 */

import type { ForecastHorizon } from './types.ts';
import {
  TOTAL_ESSENTIAL_LOAD_KW,
  KILOPOWER_BASELOAD_KW,
} from './types.ts';
import {
  generateNominalForecast,
  generateCraterEclipseForecast,
  generateDustStormForecast,
} from './forecast.ts';

export type ForecastStatus = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';

export interface EnergyForecastInput {
  scenarioId?: string;
  batteryStoredKWh: number;
  batteryCapacityKWh?: number; // default: 500.0 kWh
  batteryMinReservePct?: number; // default: 20.0% (100.0 kWh)
  currentSolarKW?: number;
  nuclearGenerationKW?: number; // default: 40.0 kW
  totalDemandKW?: number;
  essentialDemandKW?: number; // default: 40.1 kW
  rfcUsableElectricalEnergyKWh?: number;
  customHorizon?: ForecastHorizon | null;
}

export interface EnergyForecastAssessment {
  /** Forecast horizon length in hours (default: 24h) */
  horizonHours: number;
  /** Scenario ID or classification */
  forecastScenarioId: string;
  /** Expected average solar array output across the horizon (kW) */
  expectedSolarAvgKW: number;
  /** Expected peak solar array output across the horizon (kW) */
  expectedSolarPeakKW: number;
  /** Directional solar trend across the lookahead window */
  solarTrend: 'rising' | 'falling' | 'stable' | 'suppressed' | 'eclipsed';
  /** Mean predicted net microgrid power balance across the horizon (kW) */
  predictedNetPowerKW: number;
  /** Concise text summary of the power balance */
  netPowerBalanceDescription: string;
  /** Estimated hours until battery hits the 20% reserve floor. Null if not reached or unknown */
  hoursToBatteryReserve: number | null;
  /** Formatted human-readable display string */
  timeToReserveFormatted: string;
  /** Whether essential life-support load (40.1 kW) is predicted to experience a shortfall */
  isEssentialShortfallPredicted: boolean;
  /** Earliest lookahead hour at which essential load would be curtailed, if any */
  earliestEssentialShortfallHour: number | null;
  /** Maximum unmet essential power deficit (kW) */
  maxUnmetEssentialKW: number;
  /** Whether stored RFC chemical energy could cover predicted deficits without activating */
  rfcFuelCanSupport: boolean;
  /** Estimated hours of full support the stored RFC fuel could provide if dispatched */
  rfcSupportHoursAvailable: number;
  /** Usable electrical energy in RFC tanks (kWh) */
  rfcUsableElectricalEnergyKWh: number;
  /** High-level operational risk classification */
  status: ForecastStatus;
  /** Short concise engineering explanation of predicted risk */
  riskExplanation: string;
  /** Flag indicating future conditions are unknown / unmodeled */
  isUnknown: boolean;
}

/**
 * Maps runtime scenario IDs to the deterministic forecast generator from forecast.ts.
 */
export function resolveForecastHorizonForScenario(
  scenarioId?: string
): ForecastHorizon | null {
  if (!scenarioId) return null;

  switch (scenarioId) {
    case 'nominal_daytime':
    case 'nominal_solar':
      return generateNominalForecast();

    case 'lunar_dusk':
    case 'crater_eclipse':
      return generateCraterEclipseForecast({
        startHour: 8,
        eclipseStartHour: 8,
        eclipseDurationHours: 12,
      });

    case 'eclss_stress_surge':
      // Moderate dust attenuation with nominal solar trajectory
      return generateNominalForecast({
        dustOcclusionPct: 25.0,
      });

    case 'critical_anomaly':
    case 'dust_storm':
      // Severe suppression: heavy dust storm / array failure
      return generateDustStormForecast({
        dustOcclusionPct: 95.0,
        solarPeakKW: 12.0,
      });

    default:
      return null;
  }
}

/**
 * Estimates energy availability and reserve depletion across the forecast horizon.
 * Pure deterministic function with zero side-effects.
 */
export function estimateEnergyForecast(
  input: EnergyForecastInput
): EnergyForecastAssessment {
  const capacityKWh = input.batteryCapacityKWh ?? 500.0;
  const reservePct = input.batteryMinReservePct ?? 20.0;
  const reserveFloorKWh = capacityKWh * (reservePct / 100.0); // 100.0 kWh
  const nuclearKW = input.nuclearGenerationKW ?? KILOPOWER_BASELOAD_KW;
  const essentialKW = input.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW;
  const demandKW = Math.max(essentialKW, input.totalDemandKW ?? essentialKW);
  const rfcUsableKWh = input.rfcUsableElectricalEnergyKWh ?? 0;

  // Resolve horizon from existing forecast engine or custom override
  const horizon = input.customHorizon !== undefined
    ? input.customHorizon
    : resolveForecastHorizonForScenario(input.scenarioId);

  // Handle unknown scenario or missing forecast gracefully without fabricating countdowns
  if (!horizon || !horizon.hourlyForecasts || horizon.hourlyForecasts.length === 0) {
    return {
      horizonHours: 24,
      forecastScenarioId: input.scenarioId ?? 'unknown',
      expectedSolarAvgKW: 0,
      expectedSolarPeakKW: 0,
      solarTrend: 'suppressed',
      predictedNetPowerKW: Number((nuclearKW - demandKW).toFixed(1)),
      netPowerBalanceDescription: 'Unknown Horizon',
      hoursToBatteryReserve: null,
      timeToReserveFormatted: 'Cannot estimate (Unknown horizon)',
      isEssentialShortfallPredicted: false,
      earliestEssentialShortfallHour: null,
      maxUnmetEssentialKW: 0,
      rfcFuelCanSupport: rfcUsableKWh > 0,
      rfcSupportHoursAvailable: Number((rfcUsableKWh / 15.0).toFixed(1)),
      rfcUsableElectricalEnergyKWh: rfcUsableKWh,
      status: 'WATCH',
      riskExplanation:
        'Future solar conditions unknown for this scenario. Time to reserve cannot be reliably predicted; monitoring real-time telemetry.',
      isUnknown: true,
    };
  }

  const hours = horizon.hourlyForecasts;
  const horizonHours = hours.length;

  // 1. Solar Statistics & Trend
  let totalSolar = 0;
  let peakSolar = 0;
  let eclipseHoursCount = 0;
  const solarValues: number[] = [];

  for (const h of hours) {
    const s = Math.max(0, h.solarGenerationKW);
    totalSolar += s;
    if (s > peakSolar) peakSolar = s;
    if (h.isEclipse || s <= 0.5) eclipseHoursCount++;
    solarValues.push(s);
  }

  const expectedSolarAvgKW = Number((totalSolar / horizonHours).toFixed(1));
  const expectedSolarPeakKW = Number(peakSolar.toFixed(1));

  // Determine trend
  let solarTrend: 'rising' | 'falling' | 'stable' | 'suppressed' | 'eclipsed' = 'stable';
  if (eclipseHoursCount >= horizonHours / 2) {
    solarTrend = 'eclipsed';
  } else if (expectedSolarPeakKW <= 10.0) {
    solarTrend = 'suppressed';
  } else {
    const earlyAvg = solarValues.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const midAvg = solarValues.slice(6, 12).reduce((a, b) => a + b, 0) / 6;
    const lateAvg = solarValues.slice(18).reduce((a, b) => a + b, 0) / Math.max(1, solarValues.length - 18);

    if (earlyAvg > midAvg + 15.0) {
      solarTrend = 'falling';
    } else if (midAvg > earlyAvg + 15.0 || lateAvg > earlyAvg + 15.0) {
      solarTrend = 'rising';
    } else if (eclipseHoursCount > 0) {
      solarTrend = 'eclipsed';
    } else {
      solarTrend = 'stable';
    }
  }

  // 2. Net Electrical Balance Simulation Hour-by-Hour
  let simulatedStoredKWh = Math.min(capacityKWh, Math.max(0, input.batteryStoredKWh));
  let netPowerSum = 0;
  let minNetPower = Infinity;
  let maxNetPower = -Infinity;
  let hoursToReserve: number | null = null;

  let isShortfallPredicted = false;
  let earliestShortfallHour: number | null = null;
  let maxUnmetEssential = 0;
  let totalCumulativeUnmetDeficitKWh = 0;

  // Check if current battery is already at or below reserve floor
  const isAlreadyAtReserve = simulatedStoredKWh <= reserveFloorKWh + 0.05;

  for (let i = 0; i < horizonHours; i++) {
    const h = hours[i];
    const solarKW = Math.max(0, h.solarGenerationKW);
    const nucKW = h.nuclearGenerationKW ?? nuclearKW;
    const totalGenKW = solarKW + nucKW;
    const netKW = totalGenKW - demandKW;

    netPowerSum += netKW;
    if (netKW < minNetPower) minNetPower = netKW;
    if (netKW > maxNetPower) maxNetPower = netKW;

    if (netKW >= 0) {
      // Generation surplus charges battery
      const headroomKWh = Math.max(0, capacityKWh - simulatedStoredKWh);
      const chargeEnergyKWh = Math.min(headroomKWh, netKW * 0.95 * 1.0);
      simulatedStoredKWh = Math.min(capacityKWh, simulatedStoredKWh + chargeEnergyKWh);
    } else {
      // Generation deficit requires battery discharge
      const deficitKW = -netKW;
      const energyNeededFromBatteryKWh = (deficitKW * 1.0) / 0.95;
      const safeEnergyAvailableKWh = Math.max(0, simulatedStoredKWh - reserveFloorKWh);

      if (hoursToReserve === null) {
        if (isAlreadyAtReserve) {
          hoursToReserve = 0.0;
        } else if (safeEnergyAvailableKWh <= 0.01) {
          hoursToReserve = i;
        } else if (energyNeededFromBatteryKWh >= safeEnergyAvailableKWh) {
          // Reaches reserve floor during this hour
          const fraction = safeEnergyAvailableKWh / Math.max(0.001, energyNeededFromBatteryKWh);
          hoursToReserve = Number((i + fraction).toFixed(1));
        }
      }

      if (simulatedStoredKWh - energyNeededFromBatteryKWh >= reserveFloorKWh) {
        // Battery covers deficit without breaching 20% floor
        simulatedStoredKWh -= energyNeededFromBatteryKWh;
      } else {
        // Battery clamped at 20% reserve floor; remaining deficit falls on bus
        const batteryEnergyUsedKWh = Math.max(0, simulatedStoredKWh - reserveFloorKWh);
        const batteryDeliveredKW = batteryEnergyUsedKWh * 0.95;
        simulatedStoredKWh = reserveFloorKWh;

        const remainingBusDeficitKW = Math.max(0, deficitKW - batteryDeliveredKW);
        totalCumulativeUnmetDeficitKWh += remainingBusDeficitKW * 1.0;

        // Check if essential load (~40.1 kW) is unmet
        const totalBusAvailableKW = totalGenKW + batteryDeliveredKW;
        if (totalBusAvailableKW < essentialKW) {
          const essentialDeficitKW = essentialKW - totalBusAvailableKW;
          if (essentialDeficitKW > maxUnmetEssential) {
            maxUnmetEssential = essentialDeficitKW;
          }
          if (!isShortfallPredicted) {
            isShortfallPredicted = true;
            earliestShortfallHour = i;
          }
        }
      }
    }
  }

  const predictedNetPowerKW = Number((netPowerSum / horizonHours).toFixed(1));
  const netPowerBalanceDescription =
    predictedNetPowerKW >= 0
      ? `+${predictedNetPowerKW.toFixed(1)} kW avg (Surplus)`
      : `${predictedNetPowerKW.toFixed(1)} kW avg (${minNetPower.toFixed(1)} kW min)`;

  // 3. Format Time to Reserve
  let timeToReserveFormatted: string;
  if (isAlreadyAtReserve && (minNetPower < 0 || predictedNetPowerKW < 0)) {
    timeToReserveFormatted = '0.0h (At 20% Floor)';
    hoursToReserve = 0.0;
  } else if (hoursToReserve !== null) {
    timeToReserveFormatted = `${hoursToReserve.toFixed(1)}h`;
  } else if (predictedNetPowerKW >= 0 && simulatedStoredKWh >= reserveFloorKWh) {
    timeToReserveFormatted = 'N/A — Net Positive';
  } else {
    timeToReserveFormatted = '> 24h (Preserved)';
  }

  // 4. Passive RFC Fuel Support Evaluation (without dispatching)
  const rfcFuelCanSupport =
    totalCumulativeUnmetDeficitKWh <= 0.001 ||
    rfcUsableKWh >= totalCumulativeUnmetDeficitKWh;

  const rfcSupportHoursAvailable =
    maxUnmetEssential > 0.001
      ? Number((rfcUsableKWh / Math.min(15.0, Math.max(1.0, maxUnmetEssential))).toFixed(1))
      : Number((rfcUsableKWh / 15.0).toFixed(1));

  // 5. Overall Status & Risk Explanation
  let status: ForecastStatus = 'NORMAL';
  let riskExplanation = '';

  if (isShortfallPredicted || (isAlreadyAtReserve && minNetPower < -0.1)) {
    status = 'CRITICAL';
    riskExplanation = `CRITICAL: Essential load shortfall (${maxUnmetEssential.toFixed(1)} kW) predicted starting at T+${earliestShortfallHour ?? 0}h when battery hits reserve floor. RFC fuel reserves (${rfcUsableKWh.toFixed(1)} kWh) can support habitat if dispatched.`;
  } else if (hoursToReserve !== null && hoursToReserve < horizonHours) {
    status = 'WARNING';
    riskExplanation = `WARNING: BESS will discharge to 20% reserve floor in ${hoursToReserve.toFixed(1)}h due to solar shortfall. Flexible loads should be deferred to preserve essential systems.`;
  } else if (solarTrend === 'suppressed' || solarTrend === 'eclipsed' || predictedNetPowerKW < 0) {
    status = 'WATCH';
    riskExplanation = `WATCH: Reduced solar generation (${expectedSolarAvgKW.toFixed(1)} kW avg). Nuclear 40.0 kW baseload and battery buffer maintain microgrid stability above reserve floor.`;
  } else {
    status = 'NORMAL';
    riskExplanation = 'NORMAL: Solar and nuclear generation maintain net energy surplus across 24h horizon. Battery safety reserve fully preserved.';
  }

  return {
    horizonHours,
    forecastScenarioId: input.scenarioId ?? 'custom',
    expectedSolarAvgKW,
    expectedSolarPeakKW,
    solarTrend,
    predictedNetPowerKW,
    netPowerBalanceDescription,
    hoursToBatteryReserve: hoursToReserve,
    timeToReserveFormatted,
    isEssentialShortfallPredicted: isShortfallPredicted,
    earliestEssentialShortfallHour: earliestShortfallHour,
    maxUnmetEssentialKW: Number(maxUnmetEssential.toFixed(2)),
    rfcFuelCanSupport,
    rfcSupportHoursAvailable,
    rfcUsableElectricalEnergyKWh: Number(rfcUsableKWh.toFixed(1)),
    status,
    riskExplanation,
    isUnknown: false,
  };
}
