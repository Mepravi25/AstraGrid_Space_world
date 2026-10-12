import React from 'react';
import { Stars } from '@react-three/drei';
import { RealisticEarth } from './RealisticEarth';
import { SunDisc } from './SunDisc';

/**
 * LunarSky Component
 * Renders the deep black space environment containing:
 * - Steady, high-density starfield in the vacuum of space
 * - Visible Sun disc positioned in exact synchronization with directional sunlight
 * - Realistic Earth with day/night terminator, clouds, oceans, continents, and city lights
 * - Pure black space background (no atmospheric fog or light scattering)
 */
export const LunarSky: React.FC = () => {
  return (
    <>
      {/* 1. Vacuum Space Starfield (steady stars, radius beyond Earth & Sun) */}
      <Stars
        radius={650}
        depth={120}
        count={9200}
        factor={3.8}
        saturation={0}
        fade
        speed={0} // No twinkling in vacuum
      />

      {/* 2. Visible Sun Disc (synchronized with directional sunlight) */}
      <SunDisc />

      {/* 3. Photorealistic Earth hanging in the black lunar sky */}
      <RealisticEarth />
    </>
  );
};
