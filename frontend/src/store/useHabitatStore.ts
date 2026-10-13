import { create } from 'zustand';
import type { EquipmentItem, EquipmentStatus } from '../types/equipment.ts';
import type { HabitatTelemetry, HabitatSystemStatus, SimulationEventLogItem } from '../types/simulation.ts';
import { INITIAL_EQUIPMENT_DATA } from '../data/initialEquipment.ts';
import { PREDEFINED_SCENARIOS } from '../data/scenarios.ts';
import type { RFCConfig, RFCState } from '../simulation/rfcModel.ts';
import { DEFAULT_RFC_CONFIG, createDefaultRFCState, stepRFC } from '../simulation/rfcModel.ts';
import type { EnergyManagementState } from '../simulation/types.ts';

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

  // Regenerative Fuel Cell (RFC) Subsystem & Resilience
  rfcState: RFCState;
  rfcConfig: RFCConfig;
  rfcModeOverride: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled';
  isRFCPanelOpen: boolean;
  activeRFCTab: 'rfc' | 'water_planned' | 'events';
  eventLog: SimulationEventLogItem[];
  toggleRFCPanel: () => void;
  setRFCPanelOpen: (open: boolean) => void;
  setActiveRFCTab: (tab: 'rfc' | 'water_planned' | 'events') => void;
  setRFCEnabled: (enabled: boolean) => void;
  setRFCModeOverride: (mode: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled') => void;
  addEventLogItem: (item: Omit<SimulationEventLogItem, 'id'>) => void;
  clearEventLog: () => void;

  // Live Resource Monitoring Dashboard
  isResourceMonitoringOpen: boolean;
  toggleResourceMonitoring: () => void;
  setResourceMonitoringOpen: (open: boolean) => void;

  // Floating 3D Resource Labels (Module 1B)
  showResourceLabels: boolean;
  toggleResourceLabels: () => void;
  setShowResourceLabels: (show: boolean) => void;
}

const computeAggregateTelemetry = (
  items: EquipmentItem[],
  sol: number,
  baseTimeSeconds: number,
  batterySoc: number,
  waterLiters: number,
  rfcGeneratingKW: number = 0,
  rfcElectrolyzingKW: number = 0,
  shortageDurationHours: number = 0,
  cumulativeUnmetEssentialKWh: number = 0
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
    } else if (item.type !== 'battery_bank' && item.powerKW < 0) {
      demand += Math.abs(item.powerKW);
    }
  }

  const totalGen = solarGen + nuclearGen + rfcGeneratingKW;
  const demandTotal = demand + rfcElectrolyzingKW;
  const netPower = totalGen - demandTotal;

  const essentialDemandKW = 40.1;
  const flexibleDemandKW = Math.max(0, demand - essentialDemandKW);
  const safeBatteryEnergyKWh = Math.max(0, (batterySoc / 100) * 500 - 100.0);
  const safeBatteryPowerKW = Math.min(100.0, safeBatteryEnergyKWh * 0.95);
  const busPowerAvailable = totalGen + safeBatteryPowerKW;
  const unmetEssentialLoadKW = Math.max(0, essentialDemandKW - busPowerAvailable);
  const flexibleLoadsDeferredKW = busPowerAvailable < demandTotal ? Math.min(flexibleDemandKW, demandTotal - busPowerAvailable) : 0;

  let energyManagementState: EnergyManagementState = 'NORMAL';
  if (solarGen <= 5) {
    if (unmetEssentialLoadKW > 0.001) energyManagementState = 'CRITICAL_POWER_SHORTAGE';
    else if (rfcGeneratingKW > 0.001) energyManagementState = 'RFC_SUPPORT';
    else if (batterySoc > 20) energyManagementState = 'BATTERY_SUPPORT';
    else if (flexibleLoadsDeferredKW > 0) energyManagementState = 'ENERGY_CONSERVATION';
    else energyManagementState = 'SOLAR_SHORTAGE';
  } else if (solarGen > 20 && batterySoc < 95) {
    energyManagementState = 'RECOVERY';
  } else {
    energyManagementState = 'NORMAL';
  }

  let overallStatus: HabitatSystemStatus = 'nominal';
  if (hasCritical || batterySoc < 25 || unmetEssentialLoadKW > 0.001) {
    overallStatus = 'critical';
  } else if (hasWarning || batterySoc < 40 || netPower < -20 || flexibleLoadsDeferredKW > 0) {
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
    totalDemandKW: Number(demandTotal.toFixed(1)),
    netPowerKW: Number(netPower.toFixed(1)),
    batterySocPct: Number(Math.max(0, Math.min(100, batterySoc)).toFixed(1)),
    batteryCapacityKWh: 500,
    batteryStoredKWh: Number(((batterySoc / 100) * 500).toFixed(1)),
    batteryNetFlowKW: Number(netPower.toFixed(1)),
    batteryMinReservePct: 20.0,
    batteryMinReserveKWh: 100.0,
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
    overallStatus,
    essentialDemandKW,
    flexibleDemandKW,
    flexibleLoadsDeferredKW,
    unmetEssentialLoadKW: Number(unmetEssentialLoadKW.toFixed(2)),
    energyManagementState,
    shortageDurationHours: Number(shortageDurationHours.toFixed(2)),
    cumulativeUnmetEssentialKWh: Number(cumulativeUnmetEssentialKWh.toFixed(2)),
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

    // Regenerative Fuel Cell Subsystem initial state
    rfcState: createDefaultRFCState(),
    rfcConfig: DEFAULT_RFC_CONFIG,
    rfcModeOverride: 'auto',
    isRFCPanelOpen: false,
    activeRFCTab: 'rfc',
    isResourceMonitoringOpen: true,
    showResourceLabels: true,
    eventLog: [
      {
        id: 'evt-init-1',
        timestampStr: 'SOL 14 — 11:30:00',
        eventType: 'info',
        title: 'Microgrid Telemetry Synchronized',
        details: 'Kilopower 40.0 kWe baseload nominal. Solar array tracking enabled.',
        severity: 'info',
      },
      {
        id: 'evt-init-2',
        timestampStr: 'SOL 14 — 11:30:05',
        eventType: 'info',
        title: 'RFC Subsystem Operational',
        details: 'H2 (12.0 kg) and O2 (96.0 kg) storage pressurized. Water feedstock nominal.',
        severity: 'info',
      },
    ],

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
        rfcState: createDefaultRFCState(),
        isSimulating: true,
        simSpeed: 1
      });
    },

    setSimSpeed: (speed: number) => set({ simSpeed: speed }),

    // RFC Subsystem Actions
    toggleRFCPanel: () => set((state) => ({ isRFCPanelOpen: !state.isRFCPanelOpen })),
    setRFCPanelOpen: (open: boolean) => set({ isRFCPanelOpen: open }),

    // Live Resource Monitoring Dashboard Actions
    toggleResourceMonitoring: () => set((state) => ({ isResourceMonitoringOpen: !state.isResourceMonitoringOpen })),
    setResourceMonitoringOpen: (open: boolean) => set({ isResourceMonitoringOpen: open }),

    // Floating 3D Resource Labels Actions
    toggleResourceLabels: () => set((state) => ({ showResourceLabels: !state.showResourceLabels })),
    setShowResourceLabels: (show: boolean) => set({ showResourceLabels: show }),
    setActiveRFCTab: (tab: 'rfc' | 'water_planned' | 'events') => set({ activeRFCTab: tab }),
    setRFCEnabled: (enabled: boolean) =>
      set((state) => ({
        rfcState: { ...state.rfcState, isEnabled: enabled, mode: enabled ? 'idle' : 'unavailable' },
        rfcConfig: { ...state.rfcConfig, enabled },
      })),
    setRFCModeOverride: (mode: 'auto' | 'electrolyzing' | 'generating' | 'idle' | 'disabled') =>
      set((state) => {
        let nextMode = state.rfcState.mode;
        if (mode === 'idle') nextMode = 'idle';
        else if (mode === 'disabled') nextMode = 'unavailable';
        else if (mode === 'electrolyzing' && state.rfcState.isEnabled) nextMode = 'electrolyzing';
        else if (mode === 'generating' && state.rfcState.isEnabled) nextMode = 'generating';
        return {
          rfcModeOverride: mode,
          rfcState: { ...state.rfcState, mode: nextMode },
        };
      }),
    addEventLogItem: (item: Omit<SimulationEventLogItem, 'id'>) =>
      set((state) => ({
        eventLog: [
          { ...item, id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
          ...state.eventLog.slice(0, 49),
        ],
      })),
    clearEventLog: () => set({ eventLog: [] }),

    loadScenario: (scenarioId: string) => {
      const scenario = PREDEFINED_SCENARIOS.find((s) => s.id === scenarioId);
      if (!scenario) return;

      const baseEquipment: EquipmentItem[] = JSON.parse(JSON.stringify(INITIAL_EQUIPMENT_DATA));
      const updated = baseEquipment.map((item) => {
        const override = scenario.equipmentOverrides[item.id];
        let itemStatus = item.status;
        let itemPower = item.powerKW;
        if (override) {
          itemStatus = override.status ?? item.status;
          itemPower = override.powerKW !== undefined ? override.powerKW : item.powerKW;
        }
        if (item.type === 'battery_bank') {
          const soc = scenario.initialBatterySoc;
          const stored = Number(((soc / 100) * 500).toFixed(1));
          return {
            ...item,
            status: itemStatus,
            powerKW: itemPower,
            metrics: {
              ...item.metrics,
              stateOfCharge: item.metrics.stateOfCharge
                ? { ...item.metrics.stateOfCharge, value: soc }
                : item.metrics.stateOfCharge,
              storedCapacity: item.metrics.storedCapacity
                ? { ...item.metrics.storedCapacity, value: stored }
                : item.metrics.storedCapacity,
            },
          };
        }
        if (item.type === 'potable_water') {
          const waterL = (scenario.initialWaterReservePct / 100) * 3000;
          return {
            ...item,
            status: itemStatus,
            powerKW: itemPower,
            metrics: {
              ...item.metrics,
              waterVolume: item.metrics.waterVolume
                ? { ...item.metrics.waterVolume, value: Math.round(waterL) }
                : item.metrics.waterVolume,
              capacityPct: item.metrics.capacityPct
                ? { ...item.metrics.capacityPct, value: scenario.initialWaterReservePct }
                : item.metrics.capacityPct,
            },
          };
        }
        return {
          ...item,
          status: itemStatus,
          powerKW: itemPower,
        };
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
      const { isSimulating, simSpeed, telemetry, equipment, rfcState, rfcConfig, rfcModeOverride, eventLog } = get();
      if (!isSimulating) return;

      // Accelerated simulation time: 1 real second = 60 * simSpeed sim seconds
      const simDeltaSeconds = deltaRealSeconds * 60 * simSpeed;
      const newSol = telemetry.missionElapsedSol + simDeltaSeconds / (24 * 3600);
      const newTotalSeconds = newSol * 24 * 3600;
      const deltaHours = simDeltaSeconds / 3600;

      // Minor water dynamic
      const waterDeltaL =
        ((telemetry.waterDailyRecoveryL - telemetry.waterDailyConsumptionL) / 24) * deltaHours;
      const newWater = Math.max(
        0,
        Math.min(telemetry.potableWaterCapacityL, telemetry.potableWaterLiters + waterDeltaL)
      );

      // Baseline power balance directly from equipment items before storage/RFC
      let solarGenKW = 0;
      let nuclearGenKW = 0;
      let equipmentDemandKW = 0;
      for (const item of equipment) {
        if (item.status !== 'offline') {
          if (item.type === 'solar_array') solarGenKW += Math.max(0, item.powerKW);
          else if (item.type === 'nuclear_power') nuclearGenKW += Math.max(0, item.powerKW);
          else if (item.type !== 'battery_bank' && item.powerKW < 0) {
            equipmentDemandKW += Math.abs(item.powerKW);
          }
        }
      }
      const baseNetPowerKW = solarGenKW + nuclearGenKW - equipmentDemandKW;
      const minReserveKWh = 500 * 0.20; // 100 kWh hard reserve floor

      let newStoredKWh = telemetry.batteryStoredKWh;
      let newRFCState = rfcState;
      let rfcGenKW = 0;
      let rfcElyKW = 0;
      let batteryFlowKW = 0;

      if (baseNetPowerKW >= 0) {
        // Generation Surplus: charge battery up to headroom/rate, route excess to RFC electrolyzer
        const surplusKW = baseNetPowerKW;
        const batteryHeadroomKWh = Math.max(0, 500 - telemetry.batteryStoredKWh);
        const maxChargeKW = Math.min(80.0, batteryHeadroomKWh / (0.95 * Math.max(0.001, deltaHours)));
        const batteryChargeKW = Math.min(surplusKW, maxChargeKW);
        const surplusAfterBatteryKW = Math.max(0, surplusKW - batteryChargeKW);

        const batteryEnergyDeltaKWh = batteryChargeKW * 0.95 * deltaHours;
        newStoredKWh = Math.min(500, telemetry.batteryStoredKWh + batteryEnergyDeltaKWh);
        batteryFlowKW = batteryChargeKW;

        if (rfcState.isEnabled && rfcConfig.enabled && rfcModeOverride !== 'disabled') {
          const rfcStepRes = stepRFC({
            currentState: rfcState,
            availableSurplusPowerKW: surplusAfterBatteryKW,
            requestedDischargeKW: 0,
            modeOverride: rfcModeOverride,
            dtHours: deltaHours,
            config: rfcConfig,
          });
          newRFCState = rfcStepRes.nextState;
          rfcElyKW = rfcStepRes.electricalInputKW;
          rfcGenKW = 0;
        }
      } else {
        // Generation Deficit: discharge battery above 20% floor, route remaining deficit to RFC fuel cell
        const deficitKW = -baseNetPowerKW;
        const safeBatteryEnergyKWh = Math.max(0, telemetry.batteryStoredKWh - minReserveKWh);
        const maxSafeDischargeKW = Math.min(100.0, (safeBatteryEnergyKWh * 0.95) / Math.max(0.001, deltaHours));
        const batteryDischargeKW = Math.min(deficitKW, maxSafeDischargeKW);
        const deficitAfterBatteryKW = Math.max(0, deficitKW - batteryDischargeKW);

        const chemDrawnKWh = (batteryDischargeKW * deltaHours) / 0.95;
        newStoredKWh = Math.max(minReserveKWh, telemetry.batteryStoredKWh - chemDrawnKWh);
        batteryFlowKW = -batteryDischargeKW;

        if (rfcState.isEnabled && rfcConfig.enabled && rfcModeOverride !== 'disabled') {
          const rfcStepRes = stepRFC({
            currentState: rfcState,
            availableSurplusPowerKW: 0,
            requestedDischargeKW: deficitAfterBatteryKW,
            modeOverride: rfcModeOverride,
            dtHours: deltaHours,
            config: rfcConfig,
          });
          newRFCState = rfcStepRes.nextState;
          rfcGenKW = rfcStepRes.electricalOutputKW;
          rfcElyKW = 0;
        }
      }

      const newBatterySoc = (newStoredKWh / 500) * 100;

      // Cumulative shortage tracking
      const safeBatteryPowerKW = Math.min(100.0, Math.max(0, (newStoredKWh - minReserveKWh) * 0.95));
      const busPowerAvailable = solarGenKW + nuclearGenKW + rfcGenKW + safeBatteryPowerKW;
      const currentUnmetEssentialKW = Math.max(0, 40.1 - busPowerAvailable);

      const nextShortageDuration = currentUnmetEssentialKW > 0.001
        ? (telemetry.shortageDurationHours ?? 0) + deltaHours
        : 0;
      const nextCumulativeUnmet = (telemetry.cumulativeUnmetEssentialKWh ?? 0) + (currentUnmetEssentialKW * deltaHours);

      // Keep equipment items synchronized with authoritative battery and water state
      const updatedEquipment = equipment.map((item) => {
        if (item.type === 'battery_bank') {
          return {
            ...item,
            powerKW: Number(batteryFlowKW.toFixed(1)),
            metrics: {
              ...item.metrics,
              stateOfCharge: item.metrics.stateOfCharge
                ? { ...item.metrics.stateOfCharge, value: Number(newBatterySoc.toFixed(1)) }
                : item.metrics.stateOfCharge,
              storedCapacity: item.metrics.storedCapacity
                ? { ...item.metrics.storedCapacity, value: Number(newStoredKWh.toFixed(1)) }
                : item.metrics.storedCapacity,
            },
          };
        }
        if (item.type === 'potable_water') {
          return {
            ...item,
            metrics: {
              ...item.metrics,
              waterVolume: item.metrics.waterVolume
                ? { ...item.metrics.waterVolume, value: Math.round(newWater) }
                : item.metrics.waterVolume,
              capacityPct: item.metrics.capacityPct
                ? { ...item.metrics.capacityPct, value: Number(((newWater / 3000) * 100).toFixed(1)) }
                : item.metrics.capacityPct,
            },
          };
        }
        return item;
      });

      const newTelem = computeAggregateTelemetry(
        updatedEquipment,
        newSol,
        newTotalSeconds,
        newBatterySoc,
        newWater,
        rfcGenKW,
        rfcElyKW,
        nextShortageDuration,
        nextCumulativeUnmet
      );

      // Detect state transitions and append actual events
      const newEvents: SimulationEventLogItem[] = [];
      const timestampStr = newTelem.missionTimeStr;

      if (telemetry.solarGenerationKW > 15 && newTelem.solarGenerationKW <= 5) {
        newEvents.push({
          id: `evt-${Date.now()}-sol-dec`,
          timestampStr,
          eventType: 'solar_decreased',
          title: 'Solar Generation Decreased',
          details: `Solar irradiance dropped to ${newTelem.solarGenerationKW} kW. BESS taking load.`,
          severity: 'warning',
        });
      } else if (telemetry.solarGenerationKW <= 5 && newTelem.solarGenerationKW > 15) {
        newEvents.push({
          id: `evt-${Date.now()}-sol-rec`,
          timestampStr,
          eventType: 'solar_recovered',
          title: 'Solar Generation Recovered',
          details: `Solar irradiance returned to ${newTelem.solarGenerationKW} kW. Resuming battery and RFC charging.`,
          severity: 'success',
        });
      }

      if (telemetry.batterySocPct > 20.0 && newBatterySoc <= 20.0) {
        newEvents.push({
          id: `evt-${Date.now()}-bat-res`,
          timestampStr,
          eventType: 'battery_reserve_reached',
          title: 'Battery Reserve Floor (20%) Reached',
          details: 'Discharge halted to protect cell longevity. Requesting RFC fuel cell generation.',
          severity: 'critical',
        });
      }

      if (rfcState.mode !== newRFCState.mode) {
        if (newRFCState.mode === 'generating') {
          newEvents.push({
            id: `evt-${Date.now()}-rfc-gen`,
            timestampStr,
            eventType: 'rfc_activated',
            title: 'RFC Fuel Cell Online',
            details: `Fuel cell generating to support habitat microgrid from stored H2/O2.`,
            severity: 'info',
          });
        } else if (newRFCState.mode === 'electrolyzing') {
          newEvents.push({
            id: `evt-${Date.now()}-rfc-ely`,
            timestampStr,
            eventType: 'rfc_activated',
            title: 'RFC Electrolyzer Online',
            details: 'Surplus solar electricity routed to produce hydrogen and oxygen.',
            severity: 'info',
          });
        }
      }

      if (
        rfcState.usableElectricalEnergyKWh > 0.05 &&
        newRFCState.usableElectricalEnergyKWh <= 0.05 &&
        newRFCState.mode === 'generating'
      ) {
        newEvents.push({
          id: `evt-${Date.now()}-rfc-exh`,
          timestampStr,
          eventType: 'rfc_fuel_exhausted',
          title: 'RFC Reactants Exhausted',
          details: 'Hydrogen and oxygen storage depleted. Generation ceased.',
          severity: 'warning',
        });
      }

      if (
        newTelem.energyManagementState === 'CRITICAL_POWER_SHORTAGE' &&
        telemetry.energyManagementState !== 'CRITICAL_POWER_SHORTAGE'
      ) {
        newEvents.push({
          id: `evt-${Date.now()}-crit-short`,
          timestampStr,
          eventType: 'critical_power_shortage',
          title: 'Critical Power Shortage Detected',
          details: `Essential life support curtailed. Honest deficit reported: ${(newTelem.unmetEssentialLoadKW ?? 0.1).toFixed(1)} kW.`,
          severity: 'critical',
        });
      }

      const updatedLog = newEvents.length > 0 ? [...newEvents, ...eventLog].slice(0, 50) : eventLog;

      set({
        equipment: updatedEquipment,
        telemetry: newTelem,
        rfcState: newRFCState,
        eventLog: updatedLog
      });
    }
  };
});
