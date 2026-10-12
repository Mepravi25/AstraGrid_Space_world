import { create } from 'zustand';
import { EquipmentItem, EquipmentStatus } from '../types/equipment';
import { HabitatTelemetry, HabitatSystemStatus } from '../types/simulation';
import { INITIAL_EQUIPMENT_DATA } from '../data/initialEquipment';
import { PREDEFINED_SCENARIOS } from '../data/scenarios';

interface HabitatStoreState {
  equipment: EquipmentItem[];
  selectedEquipmentId: string | null;
  cameraTarget: [number, number, number] | null;
  isSimulating: boolean;
  simSpeed: number; // 1, 2, 5
  currentScenarioId: string;
  telemetry: HabitatTelemetry;
  
  // Actions
  selectEquipment: (id: string | null) => void;
  focusEquipment: (id: string) => void;
  resetCameraTarget: () => void;
  setEquipmentStatus: (id: string, status: EquipmentStatus) => void;
  setEquipmentPower: (id: string, powerKW: number) => void;
  
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimSpeed: (speed: number) => void;
  loadScenario: (scenarioId: string) => void;
  tickSimulation: (deltaRealSeconds: number) => void;
}

const computeAggregateTelemetry = (
  items: EquipmentItem[],
  sol: number,
  baseTimeSeconds: number,
  batterySoc: number,
  waterLiters: number
): HabitatTelemetry => {
  let solarGen = 0;
  let nuclearGen = 0;
  let demand = 0;
  let activeCount = 0;
  let hasCritical = false;
  let hasWarning = false;

  for (const item of items) {
    if (item.status !== 'offline') {
      activeCount++;
    }
    if (item.status === 'critical') hasCritical = true;
    if (item.status === 'warning') hasWarning = true;

    if (item.type === 'solar_array') {
      solarGen += Math.max(0, item.powerKW);
    } else if (item.type === 'nuclear_power') {
      nuclearGen += Math.max(0, item.powerKW);
    } else if (item.powerKW < 0) {
      demand += Math.abs(item.powerKW);
    }
  }

  const totalGen = solarGen + nuclearGen;
  const netPower = totalGen - demand;
  
  let overallStatus: HabitatSystemStatus = 'nominal';
  if (hasCritical || batterySoc < 25) {
    overallStatus = 'critical';
  } else if (hasWarning || batterySoc < 40 || netPower < -20) {
    overallStatus = 'warning';
  }

  // Format SOL time
  const totalHours = (baseTimeSeconds / 3600) % 24;
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);
  const seconds = Math.floor(((totalHours - hours) * 60 - minutes) * 60);
  const timeStr = `SOL ${Math.floor(sol)} — ${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    timestamp: Date.now(),
    missionElapsedSol: sol,
    missionTimeStr: timeStr,
    sunElevationDeg: 12.5 + Math.sin(sol * 2 * Math.PI) * 4.0,
    solarFluxW_m2: solarGen > 10 ? 1361 : 120,
    solarGenerationKW: Number(solarGen.toFixed(1)),
    nuclearGenerationKW: Number(nuclearGen.toFixed(1)),
    totalGenerationKW: Number(totalGen.toFixed(1)),
    totalDemandKW: Number(demand.toFixed(1)),
    netPowerKW: Number(netPower.toFixed(1)),
    batterySocPct: Number(Math.max(0, Math.min(100, batterySoc)).toFixed(1)),
    batteryCapacityKWh: 500,
    batteryStoredKWh: Number(((batterySoc / 100) * 500).toFixed(1)),
    batteryNetFlowKW: Number(netPower.toFixed(1)),
    potableWaterLiters: Math.round(waterLiters),
    potableWaterCapacityL: 3000,
    waterReservePct: Number(((waterLiters / 3000) * 100).toFixed(1)),
    waterDailyConsumptionL: 10.4,
    waterDailyRecoveryL: 9.8,
    oxygenReserveKg: 242.0,
    oxygenCapacityKg: 280.0,
    oxygenPressureKPa: 101.3,
    solidWasteKg: 46.5,
    recycledMaterialKg: 312.0,
    activeEquipmentCount: activeCount,
    totalEquipmentCount: items.length,
    overallStatus
  };
};

export const useHabitatStore = create<HabitatStoreState>((set, get) => {
  const initialSol = 14.48;
  const initialSeconds = 14.48 * 24 * 3600;
  const initialSoc = 88.5;
  const initialWater = 2680;

  return {
    equipment: JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_DATA)),
    selectedEquipmentId: null,
    cameraTarget: null,
    isSimulating: true,
    simSpeed: 1,
    currentScenarioId: 'nominal_daytime',
    telemetry: computeAggregateTelemetry(
      INITIAL_EQUIPMENT_DATA,
      initialSol,
      initialSeconds,
      initialSoc,
      initialWater
    ),

    selectEquipment: (id: string | null) => {
      set({ selectedEquipmentId: id });
    },

    focusEquipment: (id: string) => {
      const item = get().equipment.find((e) => e.id === id);
      if (item) {
        set({
          selectedEquipmentId: id,
          cameraTarget: item.position
        });
      }
    },

    resetCameraTarget: () => {
      set({ cameraTarget: [0, 2, 0] });
    },

    setEquipmentStatus: (id: string, status: EquipmentStatus) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const powerKW = status === 'offline' ? 0 : item.powerKW;
          return { ...item, status, powerKW };
        }
        return item;
      });
      const newTelem = computeAggregateTelemetry(
        updated,
        telemetry.missionElapsedSol,
        telemetry.missionElapsedSol * 24 * 3600,
        telemetry.batterySocPct,
        telemetry.potableWaterLiters
      );
      set({ equipment: updated, telemetry: newTelem });
    },

    setEquipmentPower: (id: string, powerKW: number) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => (item.id === id ? { ...item, powerKW } : item));
      const newTelem = computeAggregateTelemetry(
        updated,
        telemetry.missionElapsedSol,
        telemetry.missionElapsedSol * 24 * 3600,
        telemetry.batterySocPct,
        telemetry.potableWaterLiters
      );
      set({ equipment: updated, telemetry: newTelem });
    },

    startSimulation: () => set({ isSimulating: true }),
    pauseSimulation: () => set({ isSimulating: false }),
    resetSimulation: () => {
      const baseEquipment = JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_DATA));
      const newTelem = computeAggregateTelemetry(
        baseEquipment,
        initialSol,
        initialSeconds,
        initialSoc,
        initialWater
      );
      set({
        equipment: baseEquipment,
        currentScenarioId: 'nominal_daytime',
        telemetry: newTelem,
        isSimulating: true,
        simSpeed: 1
      });
    },

    setSimSpeed: (speed: number) => set({ simSpeed: speed }),

    loadScenario: (scenarioId: string) => {
      const scenario = PREDEFINED_SCENARIOS.find((s) => s.id === scenarioId);
      if (!scenario) return;

      const baseEquipment: EquipmentItem[] = JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_DATA));
      const updated = baseEquipment.map((item) => {
        const override = scenario.equipmentOverrides[item.id];
        if (override) {
          return {
            ...item,
            status: override.status ?? item.status,
            powerKW: override.powerKW !== undefined ? override.powerKW : item.powerKW
          };
        }
        return item;
      });

      const newTelem = computeAggregateTelemetry(
        updated,
        get().telemetry.missionElapsedSol,
        get().telemetry.missionElapsedSol * 24 * 3600,
        scenario.initialBatterySoc,
        (scenario.initialWaterReservePct / 100) * 3000
      );

      set({
        currentScenarioId: scenarioId,
        equipment: updated,
        telemetry: newTelem
      });
    },

    tickSimulation: (deltaRealSeconds: number) => {
      const { isSimulating, simSpeed, telemetry, equipment } = get();
      if (!isSimulating) return;

      // Accelerated simulation time: 1 real second = 60 * simSpeed sim seconds
      const simDeltaSeconds = deltaRealSeconds * 60 * simSpeed;
      const newSol = telemetry.missionElapsedSol + simDeltaSeconds / (24 * 3600);
      const newTotalSeconds = newSol * 24 * 3600;

      // Net energy balance dynamically affects battery SoC
      // netPowerKW (kW) * (hours) = kWh change
      const deltaHours = simDeltaSeconds / 3600;
      const energyDeltaKWh = telemetry.netPowerKW * deltaHours * 0.95; // 95% round-trip efficiency
      const newStoredKWh = Math.max(
        0,
        Math.min(telemetry.batteryCapacityKWh, telemetry.batteryStoredKWh + energyDeltaKWh)
      );
      const newBatterySoc = (newStoredKWh / telemetry.batteryCapacityKWh) * 100;

      // Minor water dynamic
      const waterDeltaL =
        ((telemetry.waterDailyRecoveryL - telemetry.waterDailyConsumptionL) / 24) * deltaHours;
      const newWater = Math.max(
        0,
        Math.min(telemetry.potableWaterCapacityL, telemetry.potableWaterLiters + waterDeltaL)
      );

      const newTelem = computeAggregateTelemetry(
        equipment,
        newSol,
        newTotalSeconds,
        newBatterySoc,
        newWater
      );

      set({ telemetry: newTelem });
    }
  };
});
