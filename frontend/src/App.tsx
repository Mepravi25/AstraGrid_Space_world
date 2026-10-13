import React from 'react';
import { LunarScene } from './components/scene/LunarScene';
import { TelemetryHeader } from './components/hud/TelemetryHeader';
import { SimulationControlsBar } from './components/hud/SimulationControlsBar';
import { EquipmentInspector } from './components/hud/EquipmentInspector';
import { EquipmentFleetBar } from './components/hud/EquipmentFleetBar';
import { ExplorationOverlay } from './components/hud/ExplorationOverlay';
import { SimulationTicker } from './components/simulation/SimulationTicker';
import { RFCPanel } from './components/hud/RFCPanel';
import { ResourceMonitoringPanel } from './components/hud/ResourceMonitoringPanel';
import { useHabitatStore } from './store/useHabitatStore';

export function App() {
  const hudMode = useHabitatStore((state) => state.hudMode);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#06070b'
      }}
    >
      {/* Simulation Clock & Dynamic Telemetry Loop */}
      <SimulationTicker />

      {/* Interactive 3D Lunar Environment & Habitat Complex */}
      <LunarScene />

      {/* Primary Astronaut Exploration Overlay (Reticle, Contextual Prompts, Compass, Mode Switcher) */}
      <ExplorationOverlay />

      {/* Live Resource Monitoring Dashboard (Module 1) */}
      <ResourceMonitoringPanel />

      {/* Regenerative Fuel Cell & Water Interface Monitoring Panel */}
      <RFCPanel />

      {/* Equipment Inspector Side Panel (Shown when equipment is targeted/selected) */}
      {(hudMode === 'inspect' || selectedEquipmentId !== null) && hudMode !== 'hidden' && (
        <EquipmentInspector />
      )}

      {/* Mission Control Telemetry Overlays (Shown in Mission Control Mode) */}
      {hudMode === 'mission_control' && (
        <>
          <TelemetryHeader />
          <SimulationControlsBar />
          <EquipmentFleetBar />
        </>
      )}
    </div>
  );
}

export default App;
