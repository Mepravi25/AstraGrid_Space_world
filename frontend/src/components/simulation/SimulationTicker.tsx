import React, { useEffect, useRef } from 'react';
import { useHabitatStore } from '../../store/useHabitatStore';

export const SimulationTicker: React.FC = () => {
  const isSimulating = useHabitatStore((state) => state.isSimulating);
  const tickSimulation = useHabitatStore((state) => state.tickSimulation);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isSimulating) return;

    lastTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (deltaSec > 0 && deltaSec < 5) {
        tickSimulation(deltaSec);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isSimulating, tickSimulation]);

  return null;
};
