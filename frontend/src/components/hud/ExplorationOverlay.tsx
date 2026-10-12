import React, { useState, useEffect } from 'react';
import {
  Compass,
  Flashlight,
  Eye,
  SlidersHorizontal,
  Home,
  MousePointer,
  Crosshair,
  Radio,
  ChevronRight,
  X
} from 'lucide-react';
import { useHabitatStore } from '../../store/useHabitatStore';

export const ExplorationOverlay: React.FC = () => {
  const explorationMode = useHabitatStore((state) => state.explorationMode);
  const isPointerLocked = useHabitatStore((state) => state.isPointerLocked);
  const isFlashlightOn = useHabitatStore((state) => state.isFlashlightOn);
  const hudMode = useHabitatStore((state) => state.hudMode);
  const playerPosition = useHabitatStore((state) => state.playerPosition);
  const playerHeadingDeg = useHabitatStore((state) => state.playerHeadingDeg);
  const targetedEquipmentId = useHabitatStore((state) => state.targetedEquipmentId);
  const selectedEquipmentId = useHabitatStore((state) => state.selectedEquipmentId);
  const equipmentList = useHabitatStore((state) => state.equipment);

  const setExplorationMode = useHabitatStore((state) => state.setExplorationMode);
  const toggleFlashlight = useHabitatStore((state) => state.toggleFlashlight);
  const setHudMode = useHabitatStore((state) => state.setHudMode);
  const toggleHud = useHabitatStore((state) => state.toggleHud);
  const selectEquipment = useHabitatStore((state) => state.selectEquipment);
  const interactWithTargeted = useHabitatStore((state) => state.interactWithTargeted);
  const returnToBase = useHabitatStore((state) => state.returnToBase);
  const navigationNotice = useHabitatStore((state) => state.navigationNotice);
  const clearNavigationNotice = useHabitatStore((state) => state.clearNavigationNotice);

  const [dismissGuide, setDismissGuide] = useState(false);
  const [showControlsGuide, setShowControlsGuide] = useState(true);

  // Auto-clear navigation notice after 3.5 seconds
  useEffect(() => {
    if (navigationNotice) {
      const timer = setTimeout(() => {
        clearNavigationNotice();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [navigationNotice, clearNavigationNotice]);

  const targetedEquipment = equipmentList.find((e) => e.id === targetedEquipmentId);

  // Global keyboard shortcuts (KeyF for flashlight, KeyE for interact, Tab for HUD)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFlashlight();
      } else if (e.code === 'KeyE') {
        interactWithTargeted();
      } else if (e.code === 'Tab') {
        e.preventDefault();
        toggleHud();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleFlashlight, interactWithTargeted, toggleHud]);

  // Calculate distance to targeted equipment if present
  let targetedDistanceM = 0;
  if (targetedEquipment) {
    const dx = playerPosition[0] - targetedEquipment.position[0];
    const dz = playerPosition[2] - targetedEquipment.position[2];
    targetedDistanceM = Math.round(Math.hypot(dx, dz));
  }

  // Compass cardinal direction
  const getCompassDirection = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return directions[idx];
  };

  const handleEnterSimulation = () => {
    setDismissGuide(true);
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        window.focus();
        if (typeof canvas.focus === 'function') {
          canvas.focus();
        }
        const p = canvas.requestPointerLock?.();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (err) {
        console.warn('Pointer lock request error:', err);
      }
    }
  };

  if (hudMode === 'hidden') {
    return (
      <div className="absolute top-3 right-3 z-30 pointer-events-auto">
        <button
          onClick={() => setHudMode('explore')}
          className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700 text-xs font-mono text-cyan-300 hover:border-cyan-400 cursor-pointer shadow-lg"
          title="Show Mission HUD (Tab)"
        >
          HUD [TAB]
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none flex flex-col justify-between p-3 overflow-hidden">
      {/* TOP BAR: Astronaut Navigation Tape, Coordinates & Exploration Mode Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        {/* Left: Astronaut Visor Heading & Geolocation */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-950/85 border border-cyan-500/30 font-mono text-xs shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1 text-cyan-400 font-bold">
            <Compass className="w-3.5 h-3.5 animate-spin-slow" />
            <span>
              {String(playerHeadingDeg).padStart(3, '0')}° {getCompassDirection(playerHeadingDeg)}
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="text-slate-300 text-[11px] flex items-center gap-2">
            <span>
              X: <span className="text-cyan-300 font-bold">{playerPosition[0].toFixed(1)}m</span>
            </span>
            <span>
              Z: <span className="text-cyan-300 font-bold">{playerPosition[2].toFixed(1)}m</span>
            </span>
            <span className="hidden sm:inline">
              ALT: <span className="text-emerald-400 font-bold">{playerPosition[1].toFixed(1)}m</span>
            </span>
          </div>
        </div>

        {/* Center: Mode Switcher */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950/90 border border-slate-800 shadow-xl backdrop-blur-md">
          <button
            onClick={() => {
              setExplorationMode('first_person');
              setDismissGuide(true);
              handleEnterSimulation();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
              explorationMode === 'first_person'
                ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
            title="First-Person Astronaut Walk Mode (WASD + Mouse Look)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ASTRONAUT</span>
          </button>

          <button
            onClick={() => setExplorationMode('free_cam')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
              explorationMode === 'free_cam'
                ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
            title="Free Orbit Camera Inspection Mode"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>ORBIT</span>
          </button>

          <button
            onClick={() => setHudMode(hudMode === 'mission_control' ? 'explore' : 'mission_control')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
              hudMode === 'mission_control'
                ? 'bg-purple-500/25 border border-purple-400 text-purple-300 font-bold shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
            title="Open Mission Control Full Telemetry Dashboard"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>CONTROL</span>
          </button>
        </div>

        {/* Right: Quick Astronaut Tool Controls */}
        <div className="flex items-center gap-1.5">
          {/* Flashlight toggle with explicit ON/OFF status */}
          <button
            onClick={toggleFlashlight}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono transition-all cursor-pointer ${
              isFlashlightOn
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Astronaut Helmet Flashlight (Key F)"
          >
            <Flashlight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">[F] LIGHT</span>
            <span
              className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                isFlashlightOn
                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_6px_#f59e0b]'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isFlashlightOn ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Return to Base */}
          <button
            onClick={returnToBase}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950/80 border border-cyan-500/40 text-cyan-300 hover:text-white hover:bg-cyan-950/70 text-xs font-mono transition-all cursor-pointer shadow-[0_0_8px_rgba(0,229,255,0.2)]"
            title="Return to Habitat Entrance [HAB-CORE-ALPHA]"
          >
            <Home className="w-3.5 h-3.5 text-cyan-400" />
            <span>BASE</span>
          </button>
        </div>
      </div>

      {/* Deliberate navigation toast notification */}
      {navigationNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto z-40 animate-bounce">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-950/95 border border-cyan-400 text-cyan-200 text-xs font-mono shadow-[0_0_24px_rgba(0,229,255,0.5)] backdrop-blur-md">
            <Home className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold tracking-wide">{navigationNotice}</span>
          </div>
        </div>
      )}

      {/* CENTER: Crosshair Reticle & Contextual Interaction Prompt */}
      {explorationMode === 'first_person' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Reticle Graphics */}
          <div className="relative flex items-center justify-center">
            {targetedEquipment ? (
              // Highlighted Targeting Crosshair
              <div className="relative flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border border-cyan-400 border-dashed animate-spin-slow flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.6)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#00e5ff]" />
                </div>

                {/* Contextual Action Prompt Box */}
                <div className="absolute top-10 pointer-events-auto animate-fade-in">
                  <button
                    onClick={() => selectEquipment(targetedEquipment.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/90 border border-cyan-400 text-cyan-200 text-xs font-mono shadow-[0_0_16px_rgba(0,229,255,0.4)] backdrop-blur-md cursor-pointer hover:bg-cyan-950/80 transition-all transform hover:scale-105"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold text-[10px]">
                      E
                    </span>
                    <span className="font-bold tracking-wide">
                      INSPECT {targetedEquipment.name.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-cyan-400/80">({targetedDistanceM}m)</span>
                    <ChevronRight className="w-3 h-3 text-cyan-400" />
                  </button>
                </div>
              </div>
            ) : (
              // Idle Crosshair Reticle
              <div className="w-4 h-4 flex items-center justify-center opacity-70">
                <div className="w-1 h-1 rounded-full bg-cyan-400/80 shadow-[0_0_4px_#00e5ff]" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instruction banner shown when pointer lock is not active in astronaut mode */}
      {explorationMode === 'first_person' && !isPointerLocked && hudMode === 'explore' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto z-20">
          <button
            onClick={handleEnterSimulation}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-cyan-400 text-cyan-300 font-mono text-xs shadow-[0_0_20px_rgba(0,229,255,0.4)] backdrop-blur-md cursor-pointer hover:bg-cyan-950/80 hover:border-cyan-300 transition-all hover:scale-105 active:scale-95 animate-pulse"
            title="Click to capture mouse (ESC to release)"
          >
            <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold tracking-wider">CLICK TO CAPTURE MOUSE</span>
            <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">[ESC to release]</span>
          </button>
        </div>
      )}

      {/* ONBOARDING MODAL: Shown only in first_person mode when pointer is not locked and no equipment is selected */}
      {explorationMode === 'first_person' &&
        !isPointerLocked &&
        selectedEquipmentId === null &&
        hudMode === 'explore' &&
        !dismissGuide && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-sm pointer-events-auto z-20">
            <div className="max-w-md w-full mx-4 p-4 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_40px_rgba(0,229,255,0.25)] flex flex-col items-center text-center relative">
              <button
                onClick={() => setDismissGuide(true)}
                className="absolute top-3 right-3 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="Dismiss Guide"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 mb-2 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                <Crosshair className="w-5 h-5 animate-pulse" />
              </div>

              <h2 className="font-hud text-base font-bold text-slate-100 tracking-wider">
                LUNAR SURFACE SIMULATOR
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3 leading-relaxed">
                Step onto the lunar regolith and explore the HabitatOS research complex in first-person.
              </p>

              {/* Click to Enter Button */}
              <button
                onClick={handleEnterSimulation}
                className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-hud text-xs font-black tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                ENTER MOON EXPLORATION
              </button>

              {/* Controls Guide Matrix */}
              <div className="w-full mt-3 pt-2.5 border-t border-slate-800 grid grid-cols-2 gap-1.5 text-left">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">W A S D</span>
                  <span className="text-slate-400">Move</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">MOUSE</span>
                  <span className="text-slate-400">Look Around</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">SHIFT</span>
                  <span className="text-slate-400">Sprint</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">SPACE</span>
                  <span className="text-slate-400">Lunar Jump</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">E</span>
                  <span className="text-slate-400">Interact</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">F</span>
                  <span className="text-slate-400">Flashlight</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">TAB</span>
                  <span className="text-slate-400">Toggle HUD</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">ESC</span>
                  <span className="text-slate-400">Exit Look</span>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Compact Readable Control Guide Panel */}
      {showControlsGuide && (
        <div className="absolute bottom-14 right-3 pointer-events-auto z-20">
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/90 shadow-2xl backdrop-blur-md max-w-xs">
            <div className="flex items-center justify-between gap-3 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
              <span>CONTROLS GUIDE</span>
              <button
                onClick={() => setShowControlsGuide(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
                title="Minimize Controls Guide"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-slate-300">
              {explorationMode === 'first_person' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">WASD</span>
                    <span className="text-slate-400">Move</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">MOUSE</span>
                    <span className="text-slate-400">Look</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">SHIFT</span>
                    <span className="text-slate-400">Sprint</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">E</span>
                    <span className="text-slate-400">Interact</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">F</span>
                    <span className="text-slate-400">Light [{isFlashlightOn ? 'ON' : 'OFF'}]</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">ESC</span>
                    <span className="text-slate-400">Release</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">LEFT-DRAG</span>
                    <span className="text-slate-400">Rotate View</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">WHEEL</span>
                    <span className="text-slate-400">Zoom In/Out</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold text-[9px]">RIGHT-DRAG</span>
                    <span className="text-slate-400">Pan Exploration Site</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between col-span-2 pt-1 mt-0.5 border-t border-slate-800/60 text-[9px]">
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold">TAB</span>
                  <span className="text-slate-400">HUD</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.2 rounded bg-cyan-900/60 text-cyan-300 font-bold">BASE</span>
                  <span className="text-slate-400">Habitat Entrance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Waypoint Compass Radar & Status Ticker */}
      <div className="flex items-end justify-between gap-3 pointer-events-auto">
        {/* Spatial Waypoints Radar */}
        <div className="hidden md:flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/85 border border-slate-800 backdrop-blur-md overflow-x-auto max-w-2xl">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider px-1">
            SITES:
          </span>
          {equipmentList.slice(0, 6).map((item) => {
            const dist = Math.round(
              Math.hypot(playerPosition[0] - item.position[0], playerPosition[2] - item.position[2])
            );
            return (
              <button
                key={item.id}
                onClick={() => selectEquipment(item.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-[10px] font-mono text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{item.code}</span>
                <span className="text-slate-500">{dist}m</span>
              </button>
            );
          })}
        </div>

        {/* Quick Help reminder / Controls toggle */}
        <div className="flex items-center gap-2">
          {!showControlsGuide && (
            <button
              onClick={() => setShowControlsGuide(true)}
              className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800 hover:border-cyan-500 text-[10px] font-mono text-cyan-300 cursor-pointer"
            >
              [?] CONTROLS
            </button>
          )}
          <div className="px-2.5 py-1 rounded bg-slate-950/80 border border-slate-800/80 text-[10px] font-mono text-slate-400 hidden sm:block">
            Press <span className="text-cyan-300 font-bold">TAB</span> to hide HUD |{' '}
            <span className="text-cyan-300 font-bold">ESC</span> to release mouse
          </div>
        </div>
      </div>
    </div>
  );
};
