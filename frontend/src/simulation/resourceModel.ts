/**
 * Astra Grid / HabitatOS — Deterministic Resource Transition Engine
 * 
 * Physical transition function modeling a 1.0-hour discrete simulation step
 * for a lunar surface habitat microgrid and environmental control system.
 * 
 * Engineering Principles & Conservation Laws:
 * 1. Power (kW) & Energy (kWh): Standardized at hourly timestep (dt = 1.0 h).
 * 2. Battery Storage: Dual-path Coulombic / inverter efficiencies:
 *    - Charge: E_stored_gain = P_charge_bus * dt * eta_charge
 *    - Discharge: E_stored_loss = (P_discharge_bus * dt) / eta_discharge
 * 3. Power Balance: Generation + Battery Discharge = Demand Served + Battery Charge + Curtailment
 * 4. Water Mass Balance: Potable water consumed enters graywater buffer.
 *    Recovery (VCD) draws strictly from graywater buffer up to throughput and energy limits:
 *    W_clean = W_raw * eta_recovery; W_brine_loss = W_raw * (1 - eta_recovery).
 * 5. Flexible Task Accounting: Progress, preemption by priority, completion, and deadline tracking.
 * 6. Determinism: Zero random variables, zero browser/React side-effects.
 * 7. Infeasibility & Safety: Explicit reporting of deficits, reserve breaches, and life-support compromises.
 */

import type {
  HabitatResourceState,
  BatteryConfig,
  WaterConfig,
  SafetyConstraints,
  FlexibleTask,
  StepResult,
  SafetyViolation,
  HourlyForecast,
  ControllerDecision,
  RFCConfig,
  RFCStepResult,
  RFCWaterFlowRecord,
  EnergyManagementState,
  PowerDeficitType,
} from './types.ts';
import {
  DEFAULT_BATTERY_CONFIG,
  DEFAULT_WATER_CONFIG,
  DEFAULT_SAFETY_CONSTRAINTS,
  DEFAULT_RFC_CONFIG,
  TOTAL_ESSENTIAL_LOAD_KW,
  SIMULATION_TIMESTEP_HOURS,
  LUNAR_SOL_HOURS,
  createDefaultRFCState,
} from './types.ts';
import { stepRFC } from './rfcModel.ts';
import { createRFCWaterFlowRecord } from './waterManagement.ts';

export interface ResourceStepInput {
  /** Current state of habitat resources */
  currentState: HabitatResourceState;
  /** Solar array power generation for this hour (kW) */
  solarGenerationKW: number;
  /** Continuous or emergency backup generation for this hour (kW), e.g. Kilopower 40 kW */
  backupGenerationKW: number;
  /** Required life-critical essential electricity demand (kW). Defaults to TOTAL_ESSENTIAL_LOAD_KW (~40.1 kW) */
  essentialDemandKW?: number;
  /** Battery subsystem configuration and operational limits */
  batteryConfig?: BatteryConfig;
  /** Water storage, consumption and recycling configuration */
  waterConfig?: WaterConfig;
  /** Operational safety constraints and thresholds */
  safetyConstraints?: SafetyConstraints;
  /** Pool of active and pending flexible tasks */
  tasks?: FlexibleTask[];
  /** IDs of flexible tasks dispatched to run during this hour */
  dispatchedTaskIds?: string[];
  /** Optional controller cap on battery charging power from the bus (kW) */
  batteryChargeLimitKW?: number;
  /** Optional controller cap on battery discharging power to the bus (kW) */
  batteryDischargeLimitKW?: number;
  /** Explicit crew water consumption override (L). Defaults to waterConfig.baselineConsumptionLPerHour */
  crewWaterConsumptionL?: number;
  /** Explicit water recycling override flag (if not activated via flexible task) */
  enableWaterRecovery?: boolean;
  /** Regenerative Fuel Cell configuration */
  rfcConfig?: RFCConfig;
  /** Explicit flag to activate or bypass RFC during this step */
  enableRFC?: boolean;
  /** Explicit target operating mode override for RFC */
  rfcModeOverride?: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled';
  /** Optional controller cap or surplus budget explicitly allocated for RFC charging (kW) */
  rfcElectrolyzerPowerLimitKW?: number;
  /** Optional controller cap on RFC generation power to the bus (kW) */
  rfcGenerationLimitKW?: number;
  /** Available RFC dedicated water feedstock override (L) */
  availableRFCWaterL?: number;
}

/**
 * Executes a deterministic one-hour simulation step on habitat resources.
 * 
 * Enforces first-principles conservation of mass and electrical energy.
 */
export function stepResourceModel(input: ResourceStepInput): StepResult {
  const dt = SIMULATION_TIMESTEP_HOURS; // 1.0 hour
  const currentState = input.currentState;
  const batteryConfig = input.batteryConfig ?? DEFAULT_BATTERY_CONFIG;
  const waterConfig = input.waterConfig ?? DEFAULT_WATER_CONFIG;
  const safetyConstraints = input.safetyConstraints ?? DEFAULT_SAFETY_CONSTRAINTS;
  const essentialDemandKW = Math.max(0, input.essentialDemandKW ?? TOTAL_ESSENTIAL_LOAD_KW);
  const tasks = input.tasks ? input.tasks.map((t) => ({ ...t })) : [];
  const dispatchedIds = new Set(input.dispatchedTaskIds ?? []);

  const violations: SafetyViolation[] = [];
  const currentHour = currentState.timestampHour;
  const nextHour = currentHour + 1;

  // --------------------------------------------------------------------------
  // 1. Generation Accounting
  // --------------------------------------------------------------------------
  const solarGenKW = Math.max(0, input.solarGenerationKW);
  const backupGenKW = Math.max(0, input.backupGenerationKW);
  const totalGenKW = solarGenKW + backupGenKW;

  // --------------------------------------------------------------------------
  // 2. Flexible Task Filtering & Candidate Selection
  // --------------------------------------------------------------------------
  // Find which dispatched tasks are eligible to run (time >= earliestStart, remaining > 0)
  const candidateTasks: FlexibleTask[] = [];
  for (const task of tasks) {
    if (dispatchedIds.has(task.id)) {
      if (currentHour >= task.earliestStartHour && task.remainingHours > 0) {
        candidateTasks.push(task);
      }
    }
  }

  // Sort candidate tasks by priority: 1 (highest) to 4 (lowest)
  candidateTasks.sort((a, b) => a.priority - b.priority);

  const isWaterTaskDispatched = candidateTasks.some((t) => t.taskType === 'water_recycling');
  const explicitWaterPowerKW =
    input.enableWaterRecovery === true && !isWaterTaskDispatched
      ? waterConfig.recyclingPowerDemandKW
      : 0;

  const totalFlexibleRequestedKW =
    candidateTasks.reduce((sum, t) => sum + Math.max(0, t.powerKW), 0) +
    explicitWaterPowerKW;

  // Total attempted electrical demand
  const totalDemandKW = essentialDemandKW + totalFlexibleRequestedKW;

  // Gross bus power balance before battery interaction
  const netPowerBeforeStorageKW = totalGenKW - totalDemandKW;

  // --------------------------------------------------------------------------
  // 3. Electrical Power Balance & Storage Dynamics (Battery + RFC)
  // --------------------------------------------------------------------------
  const isRFCActive =
    input.enableRFC === true ||
    (input.rfcConfig !== undefined && input.rfcConfig.enabled !== false);
  const rfcConfig = input.rfcConfig ?? DEFAULT_RFC_CONFIG;
  const currentRFCState = currentState.rfcState ?? createDefaultRFCState();

  let batteryChargeKW = 0;
  let batteryDischargeKW = 0;
  let rfcChargeKW = 0;
  let rfcGenerationKW = 0;
  let rfcStepResult: RFCStepResult | undefined;
  let curtailedGenKW = 0;
  let batteryStoredDeltaKWh = 0;
  let batteryLossKWh = 0;
  let nextStoredKWh = currentState.batteryStoredKWh;

  let demandServedKW = 0;
  let essentialServedKW = 0;
  let flexibleServedKW = 0;
  let unmetEssentialLoadKW = 0;
  let unmetFlexibleLoadKW = 0;
  let unmetDemandKW = 0;

  if (netPowerBeforeStorageKW >= 0) {
    // ------------------------------------------------------------------------
    // CASE A: Generation Surplus (P_gen >= P_demand)
    // ------------------------------------------------------------------------
    // All requested loads are fully met by generation
    essentialServedKW = essentialDemandKW;
    flexibleServedKW = totalFlexibleRequestedKW;
    demandServedKW = totalDemandKW;

    const surplusKW = netPowerBeforeStorageKW;

    // Battery charging bounds:
    // 1. Available physical energy headroom in battery
    const energyHeadroomKWh = Math.max(
      0,
      batteryConfig.capacityKWh - currentState.batteryStoredKWh
    );
    const maxChargeByCapacityKW =
      energyHeadroomKWh / (batteryConfig.chargeEfficiency * dt);

    // 2. Rate limit
    const maxChargeByRateKW = batteryConfig.maxChargeRateKW;

    // 3. Controller limit
    const controllerChargeLimitKW =
      input.batteryChargeLimitKW !== undefined
        ? Math.max(0, input.batteryChargeLimitKW)
        : Infinity;

    // Check rate limit violation if controller requested too high
    if (
      input.batteryChargeLimitKW !== undefined &&
      input.batteryChargeLimitKW > batteryConfig.maxChargeRateKW
    ) {
      violations.push({
        rule: 'BATTERY_CHARGE_RATE_EXCEEDED',
        hour: nextHour,
        currentValue: input.batteryChargeLimitKW,
        limitValue: batteryConfig.maxChargeRateKW,
        severity: 'warning',
        message: `Requested charge limit (${input.batteryChargeLimitKW} kW) exceeded max charge rate (${batteryConfig.maxChargeRateKW} kW).`,
      });
    }

    batteryChargeKW = Math.min(
      surplusKW,
      maxChargeByCapacityKW,
      maxChargeByRateKW,
      controllerChargeLimitKW
    );
    batteryChargeKW = Math.max(0, batteryChargeKW);

    const surplusAfterBatteryKW = Math.max(0, surplusKW - batteryChargeKW);

    if (isRFCActive) {
      const budgetForRFC =
        input.rfcElectrolyzerPowerLimitKW !== undefined
          ? Math.min(surplusAfterBatteryKW, Math.max(0, input.rfcElectrolyzerPowerLimitKW))
          : surplusAfterBatteryKW;

      rfcStepResult = stepRFC({
        currentState: currentRFCState,
        availableSurplusPowerKW: budgetForRFC,
        requestedDischargeKW: 0,
        availableWaterL: input.availableRFCWaterL ?? currentRFCState.waterInventoryL,
        modeOverride: input.rfcModeOverride,
        dtHours: dt,
        config: rfcConfig,
      });

      rfcChargeKW = rfcStepResult.electricalInputKW;
      curtailedGenKW = Math.max(0, surplusAfterBatteryKW - rfcChargeKW);
    } else {
      curtailedGenKW = surplusAfterBatteryKW;
    }

    // Chemical energy stored and conversion loss
    batteryStoredDeltaKWh = batteryChargeKW * batteryConfig.chargeEfficiency * dt;
    batteryLossKWh = batteryChargeKW * (1.0 - batteryConfig.chargeEfficiency) * dt;
    nextStoredKWh = Math.min(
      batteryConfig.capacityKWh,
      currentState.batteryStoredKWh + batteryStoredDeltaKWh
    );
  } else {
    // ------------------------------------------------------------------------
    // CASE B: Generation Deficit (P_gen < P_demand)
    // ------------------------------------------------------------------------
    const deficitKW = -netPowerBeforeStorageKW;

    // Battery discharge bounds:
    // 1. Maximum energy physically dischargeable before hitting 0 kWh
    const maxDischargeByEnergyKW =
      (currentState.batteryStoredKWh * batteryConfig.dischargeEfficiency) / dt;

    // 2. Rate limit
    const maxDischargeByRateKW = batteryConfig.maxDischargeRateKW;

    // 3. Controller limit
    const controllerDischargeLimitKW =
      input.batteryDischargeLimitKW !== undefined
        ? Math.max(0, input.batteryDischargeLimitKW)
        : Infinity;

    if (
      input.batteryDischargeLimitKW !== undefined &&
      input.batteryDischargeLimitKW > batteryConfig.maxDischargeRateKW
    ) {
      violations.push({
        rule: 'BATTERY_DISCHARGE_RATE_EXCEEDED',
        hour: nextHour,
        currentValue: input.batteryDischargeLimitKW,
        limitValue: batteryConfig.maxDischargeRateKW,
        severity: 'warning',
        message: `Requested discharge limit (${input.batteryDischargeLimitKW} kW) exceeded max discharge rate (${batteryConfig.maxDischargeRateKW} kW).`,
      });
    }

    const maxDischargePossibleKW = Math.min(
      maxDischargeByEnergyKW,
      maxDischargeByRateKW,
      controllerDischargeLimitKW
    );

    batteryDischargeKW = Math.min(deficitKW, Math.max(0, maxDischargePossibleKW));

    // Chemical energy drained and conversion loss
    const chemDrawnKWh =
      (batteryDischargeKW * dt) / batteryConfig.dischargeEfficiency;
    batteryStoredDeltaKWh = -chemDrawnKWh;
    batteryLossKWh = chemDrawnKWh - batteryDischargeKW * dt;
    nextStoredKWh = Math.max(0, currentState.batteryStoredKWh - chemDrawnKWh);

    const deficitAfterBatteryKW = Math.max(0, deficitKW - batteryDischargeKW);

    if (isRFCActive) {
      const rfcDischargeRequestKW =
        input.rfcGenerationLimitKW !== undefined
          ? Math.min(deficitAfterBatteryKW, Math.max(0, input.rfcGenerationLimitKW))
          : deficitAfterBatteryKW;

      rfcStepResult = stepRFC({
        currentState: currentRFCState,
        availableSurplusPowerKW: 0,
        requestedDischargeKW: rfcDischargeRequestKW,
        availableWaterL: input.availableRFCWaterL ?? currentRFCState.waterInventoryL,
        modeOverride: input.rfcModeOverride,
        dtHours: dt,
        config: rfcConfig,
      });

      rfcGenerationKW = rfcStepResult.electricalOutputKW;
    }

    // Total power available at the distribution bus (Generation + Battery Discharge + RFC Generation)
    const totalBusPowerAvailableKW = totalGenKW + batteryDischargeKW + rfcGenerationKW;

    // Allocate bus power: Essential load has absolute priority
    if (totalBusPowerAvailableKW >= essentialDemandKW) {
      essentialServedKW = essentialDemandKW;
      const powerRemainingForFlexKW = totalBusPowerAvailableKW - essentialDemandKW;
      flexibleServedKW = Math.min(totalFlexibleRequestedKW, powerRemainingForFlexKW);
      unmetFlexibleLoadKW = totalFlexibleRequestedKW - flexibleServedKW;
      unmetDemandKW = unmetFlexibleLoadKW;
    } else {
      // Catastrophic: Generation + Storage + RFC cannot even satisfy life-support!
      essentialServedKW = totalBusPowerAvailableKW;
      unmetEssentialLoadKW = essentialDemandKW - essentialServedKW;
      flexibleServedKW = 0;
      unmetFlexibleLoadKW = totalFlexibleRequestedKW;
      unmetDemandKW = unmetEssentialLoadKW + unmetFlexibleLoadKW;
    }

    demandServedKW = essentialServedKW + flexibleServedKW;
  }

  // Net battery flow: + charging, - discharging
  const batteryFlowKW = batteryChargeKW > 0 ? batteryChargeKW : -batteryDischargeKW;

  // Battery State of Charge (%)
  const nextBatterySocPct =
    (nextStoredKWh / batteryConfig.capacityKWh) * 100.0;

  // --------------------------------------------------------------------------
  // 4. Reserve Bounds, Emergency Tracking & Violations
  // --------------------------------------------------------------------------
  const minReserveKWh =
    batteryConfig.capacityKWh * (safetyConstraints.minBatterySocPct / 100.0);
  const safeBatteryEnergyAvailableKWh = Math.max(0, currentState.batteryStoredKWh - minReserveKWh);
  const safeBatteryPowerAvailableKW = (safeBatteryEnergyAvailableKWh * batteryConfig.dischargeEfficiency) / dt;
  const availableSurplusPowerKW = Math.max(0, netPowerBeforeStorageKW);
  let backupEnergyUsedKWh = currentState.backupEnergyUsedKWh;
  let isEmergencyReserveBreached = false;

  if (nextBatterySocPct < safetyConstraints.minBatterySocPct) {
    isEmergencyReserveBreached = true;

    // Track energy drawn under the minimum safety reserve
    let drawnBelowReserve = 0;
    if (currentState.batteryStoredKWh < minReserveKWh) {
      drawnBelowReserve = Math.max(
        0,
        currentState.batteryStoredKWh - nextStoredKWh
      );
    } else if (nextStoredKWh < minReserveKWh) {
      drawnBelowReserve = minReserveKWh - nextStoredKWh;
    }
    backupEnergyUsedKWh += drawnBelowReserve;

    violations.push({
      rule: 'BATTERY_MIN_RESERVE_VIOLATED',
      hour: nextHour,
      currentValue: Number(nextBatterySocPct.toFixed(2)),
      limitValue: safetyConstraints.minBatterySocPct,
      severity: nextStoredKWh <= 0.001 ? 'catastrophic' : 'critical',
      message: `Battery SoC (${nextBatterySocPct.toFixed(1)}%) breached hard safety reserve floor (${safetyConstraints.minBatterySocPct}%).`,
    });
  }

  // Life support compromise check
  let isLifeSupportCompromised = currentState.isLifeSupportCompromised;
  if (unmetEssentialLoadKW > 0.001) {
    isLifeSupportCompromised = true;
    violations.push({
      rule: 'ESSENTIAL_LOAD_UNMET',
      hour: nextHour,
      currentValue: Number(essentialServedKW.toFixed(2)),
      limitValue: Number(essentialDemandKW.toFixed(2)),
      severity: 'catastrophic',
      message: `Life-support essential load curtailed by ${unmetEssentialLoadKW.toFixed(2)} kW. Immediate hazard to habitat crew.`,
    });
  }

  // --------------------------------------------------------------------------
  // 5. Flexible Task Execution, Preemption & Deadlines
  // --------------------------------------------------------------------------
  const activeTaskIds: string[] = [];
  const preemptedTaskIds: string[] = [];
  const completedTaskIds: string[] = [];

  // Allocate available flexible power across candidate tasks by priority
  let powerAvailableForFlexKW = flexibleServedKW;
  const tasksToRun = new Set<string>();

  let explicitWaterPowered = false;
  if (explicitWaterPowerKW > 0) {
    if (powerAvailableForFlexKW >= explicitWaterPowerKW - 1e-6) {
      explicitWaterPowered = true;
      powerAvailableForFlexKW = Math.max(0, powerAvailableForFlexKW - explicitWaterPowerKW);
    }
  }

  for (const candidate of candidateTasks) {
    if (candidate.powerKW <= powerAvailableForFlexKW + 1e-6) {
      tasksToRun.add(candidate.id);
      activeTaskIds.push(candidate.id);
      powerAvailableForFlexKW = Math.max(0, powerAvailableForFlexKW - candidate.powerKW);
    } else {
      preemptedTaskIds.push(candidate.id);
    }
  }

  // Update tasks progress
  let solidWasteConsumedKg = 0;
  const updatedTasks: FlexibleTask[] = tasks.map((task) => {
    if (tasksToRun.has(task.id)) {
      const stepRun = Math.min(dt, task.remainingHours);
      const newProgress = task.progressHours + stepRun;
      const newRemaining = Math.max(0, task.durationHours - newProgress);

      if (newRemaining <= 0.001) {
        completedTaskIds.push(task.id);
      }

      if (task.taskType === 'waste_pyrolysis') {
        solidWasteConsumedKg += (task.wasteConsumedKgPerHour ?? 5.0) * stepRun;
      }

      return {
        ...task,
        progressHours: Number(newProgress.toFixed(4)),
        remainingHours: Number(newRemaining.toFixed(4)),
      };
    }
    return { ...task };
  });

  // Evaluate task deadlines at nextHour
  for (const task of updatedTasks) {
    if (task.remainingHours > 0.001 && nextHour > task.deadlineHour) {
      violations.push({
        rule: 'TASK_DEADLINE_BREACHED',
        hour: nextHour,
        currentValue: Number(task.remainingHours.toFixed(2)),
        limitValue: 0,
        severity: task.priority === 1 ? 'critical' : 'warning',
        message: `Task "${task.name}" (${task.id}) missed deadline at hour ${nextHour} with ${task.remainingHours.toFixed(1)}h remaining.`,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. Water Balance & Recovery Model
  // --------------------------------------------------------------------------
  // Crew consumption
  const requestedConsumptionL =
    input.crewWaterConsumptionL !== undefined
      ? Math.max(0, input.crewWaterConsumptionL)
      : waterConfig.baselineConsumptionLPerHour * dt;

  const initialPotableL = currentState.potableWaterLiters;
  const initialRecoverableL = currentState.recoverableWaterLiters ?? 120.0;

  const actualConsumedL = Math.min(initialPotableL, requestedConsumptionL);
  const unmetWaterDemandL = requestedConsumptionL - actualConsumedL;
  const potableAfterConsumptionL = initialPotableL - actualConsumedL;

  // Consumed water enters the recoverable wastewater buffer (mass balance)
  const recoverableBufferBeforeVCD = initialRecoverableL + actualConsumedL;

  // Water recovery activation: Active water_recycling task OR explicit enable
  const isWaterTaskActive = updatedTasks.some(
    (t) => t.taskType === 'water_recycling' && activeTaskIds.includes(t.id)
  );
  const isExplicitRecoveryActive =
    input.enableWaterRecovery === true && explicitWaterPowered;

  const shouldRunRecovery = isWaterTaskActive || isExplicitRecoveryActive;

  let actualRecoveredL = 0;
  let remainingRecoverableL = recoverableBufferBeforeVCD;

  if (shouldRunRecovery) {
    const maxRecyclingThroughputL = waterConfig.recyclingThroughputLPerHour * dt;
    const tankHeadroomL = Math.max(0, waterConfig.capacityL - potableAfterConsumptionL);
    const maxRawByHeadroomL = tankHeadroomL / waterConfig.recoveryEfficiency;

    // Raw wastewater drawn from buffer
    const rawWastewaterProcessedL = Math.min(
      maxRecyclingThroughputL,
      recoverableBufferBeforeVCD,
      maxRawByHeadroomL
    );

    actualRecoveredL = rawWastewaterProcessedL * waterConfig.recoveryEfficiency;
    remainingRecoverableL = Math.max(0, recoverableBufferBeforeVCD - rawWastewaterProcessedL);
  }

  const nextPotableWaterLiters = Math.min(
    waterConfig.capacityL,
    Math.max(0, potableAfterConsumptionL + actualRecoveredL)
  );

  const waterDeltaL = nextPotableWaterLiters - initialPotableL;
  const nextWaterReservePct =
    (nextPotableWaterLiters / waterConfig.capacityL) * 100.0;

  // Water reserve floor violation check
  if (nextPotableWaterLiters < safetyConstraints.minWaterReserveL) {
    violations.push({
      rule: 'WATER_MIN_RESERVE_VIOLATED',
      hour: nextHour,
      currentValue: Number(nextPotableWaterLiters.toFixed(2)),
      limitValue: safetyConstraints.minWaterReserveL,
      severity: nextPotableWaterLiters <= 0.001 ? 'catastrophic' : 'critical',
      message: `Potable water reserve (${nextPotableWaterLiters.toFixed(1)} L) breached safety reserve floor (${safetyConstraints.minWaterReserveL} L).`,
    });
  }

  // --------------------------------------------------------------------------
  // 7. Solid Waste Inventory
  // --------------------------------------------------------------------------
  const nextWasteAccumulatedKg = Math.max(
    0,
    currentState.wasteAccumulatedKg - solidWasteConsumedKg
  );

  // --------------------------------------------------------------------------
  // 8. Next State Assembly & Emergency Dispatch Classification
  // --------------------------------------------------------------------------
  let energyManagementState: EnergyManagementState = 'NORMAL';
  if (netPowerBeforeStorageKW >= 0) {
    const wasInShortage =
      currentState.energyManagementState &&
      ['SOLAR_SHORTAGE', 'BATTERY_SUPPORT', 'RFC_SUPPORT', 'ENERGY_CONSERVATION', 'CRITICAL_POWER_SHORTAGE'].includes(
        currentState.energyManagementState
      );
    if (wasInShortage || (currentState.batterySocPct < batteryConfig.nominalMaxSocPct && solarGenKW > 0 && batteryChargeKW > 0)) {
      energyManagementState = 'RECOVERY';
    } else {
      energyManagementState = 'NORMAL';
    }
  } else {
    if (unmetEssentialLoadKW > 0.001) {
      energyManagementState = 'CRITICAL_POWER_SHORTAGE';
    } else if (rfcGenerationKW > 0.001) {
      energyManagementState = 'RFC_SUPPORT';
    } else if (batteryDischargeKW > 0.001 && currentState.batteryStoredKWh > minReserveKWh + 0.001) {
      energyManagementState = 'BATTERY_SUPPORT';
    } else if (unmetFlexibleLoadKW > 0.001) {
      energyManagementState = 'ENERGY_CONSERVATION';
    } else {
      energyManagementState = 'SOLAR_SHORTAGE';
    }
  }

  let deficitType: PowerDeficitType = 'NONE';
  if (totalGenKW <= 0.001 && batteryDischargeKW <= 0.001 && rfcGenerationKW <= 0.001 && essentialDemandKW > 0) {
    deficitType = 'COMPLETE_LOSS_OF_GENERATION';
  } else if (unmetEssentialLoadKW > 0.001) {
    deficitType = 'PARTIAL_ESSENTIAL_DEFICIT';
  } else if (unmetFlexibleLoadKW > 0.001) {
    deficitType = 'FLEXIBLE_CURTAILMENT';
  } else {
    deficitType = 'NONE';
  }

  let shortageDurationHours = 0;
  if (
    deficitType !== 'NONE' ||
    ['SOLAR_SHORTAGE', 'BATTERY_SUPPORT', 'RFC_SUPPORT', 'ENERGY_CONSERVATION', 'CRITICAL_POWER_SHORTAGE'].includes(
      energyManagementState
    )
  ) {
    shortageDurationHours = (currentState.shortageDurationHours ?? 0) + dt;
  } else {
    shortageDurationHours = 0;
  }

  const cumulativeUnmetEssentialEnergyKWh =
    (currentState.cumulativeUnmetEssentialEnergyKWh ?? 0) + unmetEssentialLoadKW * dt;

  const rfcWaterFlow = rfcStepResult
    ? createRFCWaterFlowRecord(
        nextHour,
        rfcStepResult.electrolyzerResult.waterRequestedL,
        rfcStepResult.electrolyzerResult.waterConsumedL,
        rfcStepResult.electrolyzerResult.waterUnavailableL,
        rfcStepResult.nextState.cumulativeWaterConsumedL,
        rfcStepResult.fuelCellResult.waterProducedL,
        rfcStepResult.fuelCellResult.waterRecoveredL,
        rfcStepResult.fuelCellResult.waterLossL,
        rfcStepResult.nextState.cumulativeWaterRecoveredL
      )
    : undefined;

  const nextState: HabitatResourceState = {
    timestampHour: nextHour,
    sol: Number((currentState.sol + dt / LUNAR_SOL_HOURS).toFixed(4)),
    batteryStoredKWh: Number(nextStoredKWh.toFixed(4)),
    batterySocPct: Number(nextBatterySocPct.toFixed(2)),
    batteryHealthPct: currentState.batteryHealthPct,
    potableWaterLiters: Number(nextPotableWaterLiters.toFixed(3)),
    waterReservePct: Number(nextWaterReservePct.toFixed(2)),
    oxygenReserveKg: currentState.oxygenReserveKg,
    wasteAccumulatedKg: Number(nextWasteAccumulatedKg.toFixed(2)),
    backupEnergyUsedKWh: Number(backupEnergyUsedKWh.toFixed(4)),
    isEmergencyReserveBreached,
    isLifeSupportCompromised,
    recoverableWaterLiters: Number(remainingRecoverableL.toFixed(3)),
    cumulativeUnmetWaterL: Number(
      ((currentState.cumulativeUnmetWaterL ?? 0) + unmetWaterDemandL).toFixed(3)
    ),
    energyManagementState,
    deficitType,
    shortageDurationHours,
    cumulativeUnmetEssentialEnergyKWh: Number(cumulativeUnmetEssentialEnergyKWh.toFixed(4)),
    safeBatteryEnergyAvailableKWh: Number(safeBatteryEnergyAvailableKWh.toFixed(4)),
    safeBatteryPowerAvailableKW: Number(safeBatteryPowerAvailableKW.toFixed(3)),
    rfcState: rfcStepResult ? rfcStepResult.nextState : currentRFCState,
  };

  const isSafe = violations.length === 0;
  const isInfeasible = unmetDemandKW > 0.001 || unmetWaterDemandL > 0.001;

  return {
    nextState,
    generationKW: Number(totalGenKW.toFixed(3)),
    solarGenerationKW: Number(solarGenKW.toFixed(3)),
    backupGenerationKW: Number(backupGenKW.toFixed(3)),
    demandKW: Number(totalDemandKW.toFixed(3)),
    essentialDemandKW: Number(essentialDemandKW.toFixed(3)),
    flexibleDemandKW: Number(totalFlexibleRequestedKW.toFixed(3)),
    demandServedKW: Number(demandServedKW.toFixed(3)),
    essentialServedKW: Number(essentialServedKW.toFixed(3)),
    flexibleServedKW: Number(flexibleServedKW.toFixed(3)),
    unmetDemandKW: Number(unmetDemandKW.toFixed(3)),
    unmetEssentialLoadKW: Number(unmetEssentialLoadKW.toFixed(3)),
    unmetFlexibleLoadKW: Number(unmetFlexibleLoadKW.toFixed(3)),
    netPowerKW: Number(netPowerBeforeStorageKW.toFixed(3)),
    batteryFlowKW: Number(batteryFlowKW.toFixed(3)),
    batteryChargeKW: Number(batteryChargeKW.toFixed(3)),
    batteryDischargeKW: Number(batteryDischargeKW.toFixed(3)),
    batteryStoredDeltaKWh: Number(batteryStoredDeltaKWh.toFixed(4)),
    batteryLossKWh: Number(batteryLossKWh.toFixed(4)),
    curtailedGenerationKW: Number(curtailedGenKW.toFixed(3)),
    rfcGenerationKW: Number(rfcGenerationKW.toFixed(3)),
    rfcChargeKW: Number(rfcChargeKW.toFixed(3)),
    rfcStep: rfcStepResult,
    rfcWaterFlow,
    waterDeltaL: Number(waterDeltaL.toFixed(3)),
    waterConsumedL: Number(actualConsumedL.toFixed(3)),
    waterRecoveredL: Number(actualRecoveredL.toFixed(3)),
    unmetWaterDemandL: Number(unmetWaterDemandL.toFixed(3)),
    recoverableWaterRemainingL: Number(remainingRecoverableL.toFixed(3)),
    updatedTasks,
    activeTaskIds,
    preemptedTaskIds,
    completedTaskIds,
    violations,
    isSafe,
    isInfeasible,
    energyManagementState,
    deficitType,
    shortageDurationHours,
    cumulativeUnmetEssentialEnergyKWh: Number(cumulativeUnmetEssentialEnergyKWh.toFixed(4)),
    safeBatteryEnergyAvailableKWh: Number(safeBatteryEnergyAvailableKWh.toFixed(4)),
    safeBatteryPowerAvailableKW: Number(safeBatteryPowerAvailableKW.toFixed(3)),
    availableSurplusPowerKW: Number(availableSurplusPowerKW.toFixed(3)),
  };
}

/**
 * Convenience alias for stepResourceModel.
 */
export const simulateResourceStep = stepResourceModel;

/**
 * Evaluates a ControllerDecision against the physical resource model for a given hourly forecast.
 */
export function stepWithControllerDecision(
  currentState: HabitatResourceState,
  forecast: HourlyForecast,
  decision: ControllerDecision,
  tasks: FlexibleTask[],
  configs?: {
    batteryConfig?: BatteryConfig;
    waterConfig?: WaterConfig;
    safetyConstraints?: SafetyConstraints;
    rfcConfig?: RFCConfig;
    enableRFC?: boolean;
    rfcModeOverride?: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled';
  }
): StepResult {
  return stepResourceModel({
    currentState,
    solarGenerationKW: forecast.solarGenerationKW,
    backupGenerationKW: forecast.nuclearGenerationKW,
    essentialDemandKW: forecast.essentialDemandKW,
    tasks,
    dispatchedTaskIds: decision.activeTaskIds,
    batteryConfig: configs?.batteryConfig,
    waterConfig: configs?.waterConfig,
    safetyConstraints: configs?.safetyConstraints,
    rfcConfig: configs?.rfcConfig,
    enableRFC: configs?.enableRFC,
    rfcModeOverride: configs?.rfcModeOverride,
  });
}
