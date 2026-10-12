import { create } from 'zustand';
import { EquipmentItem, EquipmentStatus } from '../types/equipment';
import { HabitatTelemetry, HabitatSystemStatus } from '../types/simulation';
import { INITIAL_EQUIPMENT_DATA } from '../data/initialEquipment';
import { PREDEFINED_SCENARIOS } from '../data/scenarios';

export type ExplorationMode = 'first_person' | 'free_cam';
export type HudMode = 'explore' | 'inspect' | 'mission_control' | 'hidden';
export type PerformanceProfile = 'quality' | 'balanced' | 'performance';

interface HabitatStoreState {
  equipment: EquipmentItem[];
  selectedEquipmentId: string | null;
  cameraTarget: [number, number, number] | null;
  isSimulating: boolean;
  simSpeed: number; // 1, 2, 5
  currentScenarioId: string;
  telemetry: HabitatTelemetry;

  // Immersive exploration states
  explorationMode: ExplorationMode;
  isPointerLocked: boolean;
  isFlashlightOn: boolean;
  hudMode: HudMode;
  performanceProfile: PerformanceProfile;
  playerPosition: [number, number, number];
  playerYaw: number;
  playerPitch: number;
  playerHeadingDeg: number;
  orbitTarget: [number, number, number];
  orbitCameraPos: [number, number, number];
  targetedEquipmentId: string | null;
  teleportSignal: number;
  navigationNotice: string | null;

  // Actions
  setPerformanceProfile: (profile: PerformanceProfile) => void;
  selectEquipment: (id: string | null) => void;
  focusEquipment: (id: string) => void;
  resetCameraTarget: () => void;
  setEquipmentStatus: (id: string, status: EquipmentStatus) => void;
  setEquipmentPower: (id: string, powerKW: number) => void;

  setExplorationMode: (mode: ExplorationMode) => void;
  setPointerLocked: (locked: boolean) => void;
  toggleFlashlight: () => void;
  setHudMode: (mode: HudMode) => void;
  toggleHud: () => void;
  setPlayerTransform: (
    pos: [number, number, number],
    headingDeg: number,
    yaw?: number,
    pitch?: number
  ) => void;
  setOrbitState: (
    cameraPos: [number, number, number],
    target: [number, number, number]
  ) => void;
  setTargetedEquipmentId: (id: string | null) => void;
  interactWithTargeted: () => void;
  returnToBase: () => void;
  clearNavigationNotice: () => void;

  // Equipment subsystem actions
  setSolarTrackingMode: (id: string, mode: 'auto' | 'stow' | 'manual') => void;
  cleanSolarArrayPanels: (id: string) => void;
  toggleBatteryReserveLock: (id: string) => void;
  toggleWaterRecyclingVCD: (id: string) => void;
  toggleSolidWastePyrolysis: (id: string) => void;
  toggleNuclearReactorPower: (id: string) => void;
  toggleAirlockSeal: (id: string) => void;
  runWaterSterilization: (id: string) => void;

  // Simulation loop controls
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

    // Immersive controller default state
    explorationMode: 'first_person',
    isPointerLocked: false,
    isFlashlightOn: false,
    hudMode: 'explore',
    performanceProfile: 'balanced',
    playerPosition: [0, 1.75, 14], // Spawn astronaut just south of main habitat entrance
    playerYaw: 0,
    playerPitch: 0,
    playerHeadingDeg: 0,
    orbitTarget: [0, 1.5, 4.4],
    orbitCameraPos: [0, 5.5, 20],
    targetedEquipmentId: null,
    teleportSignal: 0,
    navigationNotice: null,

    setPerformanceProfile: (profile: PerformanceProfile) => {
      set({ performanceProfile: profile });
    },

    selectEquipment: (id: string | null) => {
      const currentHud = get().hudMode;
      let nextHud = currentHud;
      if (id) {
        if (currentHud !== 'mission_control') {
          nextHud = 'inspect';
        }
      } else {
        if (currentHud === 'inspect') {
          nextHud = 'explore';
        }
      }
      set({
        selectedEquipmentId: id,
        hudMode: nextHud
      });
    },

    focusEquipment: (id: string) => {
      const item = get().equipment.find((e) => e.id === id);
      if (item) {
        const currentHud = get().hudMode;
        set({
          selectedEquipmentId: id,
          cameraTarget: item.position,
          hudMode: currentHud === 'mission_control' ? 'mission_control' : 'inspect'
        });
      }
    },

    resetCameraTarget: () => {
      const { playerPosition, playerYaw, playerPitch } = get();
      const forwardX = -Math.sin(playerYaw) * Math.cos(playerPitch);
      const forwardY = Math.sin(playerPitch);
      const forwardZ = -Math.cos(playerYaw) * Math.cos(playerPitch);
      set({
        cameraTarget: [
          playerPosition[0] + forwardX * 12,
          playerPosition[1] + forwardY * 12,
          playerPosition[2] + forwardZ * 12
        ]
      });
    },

    setExplorationMode: (mode: ExplorationMode) => {
      const current = get();
      if (mode === current.explorationMode) return;

      if (mode === 'free_cam') {
        // Transitioning from Astronaut to Orbit:
        // Focus Orbit mode around current astronaut exploration location and maintain viewing perspective
        const [px, py, pz] = current.playerPosition;
        const yaw = current.playerYaw;
        const pitch = current.playerPitch;

        const forwardX = -Math.sin(yaw) * Math.cos(pitch);
        const forwardY = Math.sin(pitch);
        const forwardZ = -Math.cos(yaw) * Math.cos(pitch);

        const orbitTarget: [number, number, number] = [px, py, pz];
        const orbitCameraPos: [number, number, number] = [
          px - forwardX * 8.5,
          py - forwardY * 8.5 + 3.8,
          pz - forwardZ * 8.5
        ];

        set({
          explorationMode: 'free_cam',
          isPointerLocked: false,
          orbitCameraPos,
          orbitTarget,
          cameraTarget: null
        });
      } else {
        // Transitioning from Orbit to Astronaut:
        set({
          explorationMode: 'first_person',
          isPointerLocked: false,
          cameraTarget: null
        });
      }
    },

    setPointerLocked: (locked: boolean) => {
      set({ isPointerLocked: locked });
    },

    toggleFlashlight: () => {
      set((state) => ({ isFlashlightOn: !state.isFlashlightOn }));
    },

    setHudMode: (mode: HudMode) => {
      set({ hudMode: mode });
    },

    toggleHud: () => {
      set((state) => {
        if (state.hudMode === 'hidden') return { hudMode: 'explore' };
        if (state.hudMode === 'explore') return { hudMode: 'hidden' };
        return { hudMode: 'explore' };
      });
    },

    setPlayerTransform: (
      pos: [number, number, number],
      headingDeg: number,
      yaw?: number,
      pitch?: number
    ) => {
      set((state) => ({
        playerPosition: pos,
        playerHeadingDeg: headingDeg,
        playerYaw: yaw !== undefined ? yaw : state.playerYaw,
        playerPitch: pitch !== undefined ? pitch : state.playerPitch
      }));
    },

    setOrbitState: (
      cameraPos: [number, number, number],
      target: [number, number, number]
    ) => {
      set({
        orbitCameraPos: cameraPos,
        orbitTarget: target
      });
    },

    setTargetedEquipmentId: (id: string | null) => {
      set({ targetedEquipmentId: id });
    },

    interactWithTargeted: () => {
      const { targetedEquipmentId } = get();
      if (targetedEquipmentId) {
        set({
          selectedEquipmentId: targetedEquipmentId,
          hudMode: 'inspect',
          isPointerLocked: false
        });
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }
    },

    returnToBase: () => {
      set((state) => ({
        playerPosition: [0, 1.75, 14],
        playerYaw: 0,
        playerPitch: 0,
        playerHeadingDeg: 0,
        orbitCameraPos: [0, 5.5, 20],
        orbitTarget: [0, 1.5, 4.4],
        cameraTarget: null,
        selectedEquipmentId: null,
        teleportSignal: state.teleportSignal + 1,
        navigationNotice: 'Returned to Habitat Entrance (HAB-CORE-ALPHA)'
      }));
    },

    clearNavigationNotice: () => {
      set({ navigationNotice: null });
    },

    // Subsystem Specific Actions
    setSolarTrackingMode: (id: string, mode: 'auto' | 'stow' | 'manual') => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          let powerKW = item.powerKW;
          if (mode === 'stow') powerKW = 0;
          else if (mode === 'auto') powerKW = item.status === 'nominal' ? 120.0 : 40.0;
          else powerKW = 80.0;

          const metrics = { ...item.metrics };
          if (metrics.trackingAngle) {
            metrics.trackingAngle = {
              ...metrics.trackingAngle,
              value: mode === 'stow' ? 0.0 : mode === 'auto' ? 14.8 : 45.0
            };
          }

          return {
            ...item,
            powerKW,
            customState: {
              ...item.customState,
              trackingMode: mode,
              lastActionMessage: `Solar array tracking switched to ${mode.toUpperCase()} mode`
            },
            metrics
          };
        }
        return item;
      });

      set({
        equipment: updated,
        telemetry: computeAggregateTelemetry(
          updated,
          telemetry.missionElapsedSol,
          telemetry.missionElapsedSol * 24 * 3600,
          telemetry.batterySocPct,
          telemetry.potableWaterLiters
        )
      });
    },

    cleanSolarArrayPanels: (id: string) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const metrics = { ...item.metrics };
          if (metrics.dustAccumulation) {
            metrics.dustAccumulation = { ...metrics.dustAccumulation, value: 0.1 };
          }
          const cycles = (item.customState?.dustCleanCycles || 0) + 1;
          const powerKW = Math.min(item.maxPowerKW, item.powerKW + 10.0);

          return {
            ...item,
            powerKW,
            efficiencyPct: 34.2,
            customState: {
              ...item.customState,
              dustCleanCycles: cycles,
              lastActionMessage: `Electrostatic dust removal cycle #${cycles} completed. Dust occlusion cleared to 0.1%.`
            },
            metrics
          };
        }
        return item;
      });

      set({
        equipment: updated,
        telemetry: computeAggregateTelemetry(
          updated,
          telemetry.missionElapsedSol,
          telemetry.missionElapsedSol * 24 * 3600,
          telemetry.batterySocPct,
          telemetry.potableWaterLiters
        )
      });
    },

    toggleBatteryReserveLock: (id: string) => {
      const { equipment } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const currentLock = item.customState?.reserveLocked ?? false;
          return {
            ...item,
            customState: {
              ...item.customState,
              reserveLocked: !currentLock,
              lastActionMessage: !currentLock
                ? 'EMERGENCY RESERVE LOCK ACTIVE: Discharge limited to life-critical loads only.'
                : 'Standard charge/discharge cycling restored.'
            }
          };
        }
        return item;
      });
      set({ equipment: updated });
    },

    toggleWaterRecyclingVCD: (id: string) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const currentActive = item.customState?.vcdActive ?? true;
          const newActive = !currentActive;
          const newStatus: EquipmentStatus = newActive ? 'nominal' : 'offline';
          const powerKW = newActive ? -7.5 : 0.0;
          return {
            ...item,
            status: newStatus,
            powerKW,
            customState: {
              ...item.customState,
              vcdActive: newActive,
              lastActionMessage: newActive
                ? 'VCD centrifuge cycle started. Wastewater recovery operational.'
                : 'VCD distillation paused. Standby mode.'
            }
          };
        }
        return item;
      });

      set({
        equipment: updated,
        telemetry: computeAggregateTelemetry(
          updated,
          telemetry.missionElapsedSol,
          telemetry.missionElapsedSol * 24 * 3600,
          telemetry.batterySocPct,
          telemetry.potableWaterLiters
        )
      });
    },

    toggleSolidWastePyrolysis: (id: string) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const currentActive = item.customState?.pyroActive ?? true;
          const newActive = !currentActive;
          const newStatus: EquipmentStatus = newActive ? 'nominal' : 'offline';
          const powerKW = newActive ? -11.8 : 0.0;
          return {
            ...item,
            status: newStatus,
            powerKW,
            customState: {
              ...item.customState,
              pyroActive: newActive,
              lastActionMessage: newActive
                ? 'Pyrolysis core furnace heating to 380°C. Feedstock recovery online.'
                : 'Pyrolysis cycle stopped. Chamber cooling.'
            }
          };
        }
        return item;
      });

      set({
        equipment: updated,
        telemetry: computeAggregateTelemetry(
          updated,
          telemetry.missionElapsedSol,
          telemetry.missionElapsedSol * 24 * 3600,
          telemetry.batterySocPct,
          telemetry.potableWaterLiters
        )
      });
    },

    toggleNuclearReactorPower: (id: string) => {
      const { equipment, telemetry } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const currentOnline = item.customState?.nuclearOnline ?? true;
          const newOnline = !currentOnline;
          const newStatus: EquipmentStatus = newOnline ? 'nominal' : 'offline';
          const powerKW = newOnline ? 40.0 : 0.0;
          return {
            ...item,
            status: newStatus,
            powerKW,
            customState: {
              ...item.customState,
              nuclearOnline: newOnline,
              lastActionMessage: newOnline
                ? 'Kilopower reactor Stirling loop synchronized. 40 kWe baseload online.'
                : 'Kilopower reactor shutdown. Backup generation offline.'
            }
          };
        }
        return item;
      });

      set({
        equipment: updated,
        telemetry: computeAggregateTelemetry(
          updated,
          telemetry.missionElapsedSol,
          telemetry.missionElapsedSol * 24 * 3600,
          telemetry.batterySocPct,
          telemetry.potableWaterLiters
        )
      });
    },

    toggleAirlockSeal: (id: string) => {
      const { equipment } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          const currentSealed = item.customState?.airlockSealed ?? true;
          return {
            ...item,
            customState: {
              ...item.customState,
              airlockSealed: !currentSealed,
              lastActionMessage: !currentSealed
                ? 'Primary outer airlock hatch depressurized and cycled.'
                : 'Airlock inner hatch sealed. Cabin pressure secured at 101.3 kPa.'
            }
          };
        }
        return item;
      });
      set({ equipment: updated });
    },

    runWaterSterilization: (id: string) => {
      const { equipment } = get();
      const updated = equipment.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            customState: {
              ...item.customState,
              sterilizationActive: true,
              lastActionMessage: 'UV sterilization pulsed cycle completed. Purity 99.99% certified.'
            }
          };
        }
        return item;
      });
      set({ equipment: updated });
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
      const deltaHours = simDeltaSeconds / 3600;
      const energyDeltaKWh = telemetry.netPowerKW * deltaHours * 0.95;
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
