import React from 'react';
import { LunarScene } from './components/scene/LunarScene';
import { TelemetryHeader } from './components/hud/TelemetryHeader';
import { SimulationControlsBar } from './components/hud/SimulationControlsBar';
import { EquipmentInspector } from './components/hud/EquipmentInspector';
import { EquipmentFleetBar } from './components/hud/EquipmentFleetBar';
import { SimulationTicker } from './components/simulation/SimulationTicker';

export function App() {
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

      {/* Mission Control Telemetry HUD Overlay */}
      <TelemetryHeader />
      <SimulationControlsBar />
      <EquipmentInspector />
      <EquipmentFleetBar />
    </div>
  );
}

export default App;
