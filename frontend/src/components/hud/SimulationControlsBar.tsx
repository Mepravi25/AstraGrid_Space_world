import React from 'react';
import { Play, Pause, RotateCcw, FastForward, SlidersHorizontal, Info } from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';
import { PREDEFINED_SCENARIOS } from '../../data/scenarios';

export const SimulationControlsBar: React.FC = () => {
  const isSimulating = useHabitatStore((state) => state.isSimulating);
  const simSpeed = useHabitatStore((state) => state.simSpeed);
  const currentScenarioId = useHabitatStore((state) => state.currentScenarioId);
  const startSimulation = useHabitatStore((state) => state.startSimulation);
  const pauseSimulation = useHabitatStore((state) => state.pauseSimulation);
  const resetSimulation = useHabitatStore((state) => state.resetSimulation);
  const setSimSpeed = useHabitatStore((state) => state.setSimSpeed);
  const loadScenario = useHabitatStore((state) => state.loadScenario);

  const currentScenario = PREDEFINED_SCENARIOS.find((s) => s.id === currentScenarioId);

  return (
    <div className="absolute top-20 left-3 z-20 flex flex-col gap-2 max-w-sm pointer-events-none">
      {/* Control Strip */}
      <div className="glass-panel p-2 flex items-center gap-2 pointer-events-auto">
        {/* Play/Pause */}
        <button
          onClick={isSimulating ? pauseSimulation : startSimulation}
          className={`hud-btn ${isSimulating ? 'active' : ''}`}
          title={isSimulating ? 'Pause Simulation' : 'Start Simulation'}
        >
          {isSimulating ? (
            <>
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>START</span>
            </>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={resetSimulation}
          className="hud-btn"
          title="Reset Simulation State to Baseline"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
          <span>RESET</span>
        </button>

        <div className="w-[1px] h-5 bg-slate-700/60" />

        {/* Speed Multipliers */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded border border-slate-800">
          {[1, 2, 5].map((speed) => (
            <button
              key={speed}
              onClick={() => setSimSpeed(speed)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors ${
                simSpeed === speed
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Selector Panel */}
      <div className="glass-panel p-2.5 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold uppercase tracking-wider text-slate-200">
              MISSION SCENARIO
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400/80">DEMO PRESETS</span>
        </div>

        {/* Scenario dropdown selector */}
        <select
          value={currentScenarioId}
          onChange={(e) => loadScenario(e.target.value)}
          className="bg-slate-950/90 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          {PREDEFINED_SCENARIOS.map((scen) => (
            <option key={scen.id} value={scen.id} className="bg-slate-900 text-slate-100">
              {scen.name}
            </option>
          ))}
        </select>

        {/* Scenario Description Card */}
        {currentScenario && (
          <div className="bg-slate-900/60 rounded border border-slate-800/80 p-2 text-[11px] text-slate-300 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-slate-300">{currentScenario.shortDescription}</p>
          </div>
        )}
      </div>
    </div>
  );
};
