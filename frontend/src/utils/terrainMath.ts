/**
 * Lunar Terrain Mathematical Elevation & Surface Geometry Model
 * Provides deterministic elevation and normal vector calculations for both
 * the 3D procedural terrain geometry and runtime player collision detection.
 */

export interface CraterSpec {
  cx: number;
  cz: number;
  radius: number;
  depth: number;
  rimHeight: number;
}

// Fixed realistic craters across the lunar landscape
export const LUNAR_CRATERS: CraterSpec[] = [
  // Distant large impact craters
  { cx: -110, cz: -105, radius: 36, depth: 7.5, rimHeight: 2.2 },
  { cx: 120, cz: -90, radius: 42, depth: 8.5, rimHeight: 2.6 },
  { cx: 130, cz: 110, radius: 32, depth: 6.8, rimHeight: 2.0 },
  { cx: -130, cz: 115, radius: 38, depth: 7.8, rimHeight: 2.4 },

  // Medium exploration craters
  { cx: -55, cz: 80, radius: 22, depth: 4.8, rimHeight: 1.5 },
  { cx: 80, cz: 40, radius: 19, depth: 4.2, rimHeight: 1.3 },
  { cx: 70, cz: -45, radius: 16, depth: 3.5, rimHeight: 1.1 },
  { cx: -40, cz: -95, radius: 18, depth: 3.8, rimHeight: 1.2 },
  { cx: 15, cz: -110, radius: 24, depth: 5.0, rimHeight: 1.6 },

  // Berm crater shielding the Nuclear Kilopower reactor
  { cx: -110, cz: 75, radius: 20, depth: 3.2, rimHeight: 2.8 },

  // Small craters near exploration pathways
  { cx: -75, cz: -15, radius: 11, depth: 2.2, rimHeight: 0.7 },
  { cx: 35, cz: 85, radius: 12, depth: 2.4, rimHeight: 0.8 },
  { cx: -15, cz: 70, radius: 9, depth: 1.8, rimHeight: 0.6 },
  { cx: 95, cz: -15, radius: 13, depth: 2.5, rimHeight: 0.8 }
];

/**
 * Calculates elevation (Y in meters) at any given world coordinate (X, Z).
 * - Central habitat zone (r < 32m) is leveled flat at y = 0.0
 * - Intermediate zone (32m < r < 55m) blends smoothly into terrain
 * - Outer terrain has rolling hills, craters with raised rims, and distant mountain ridges
 */
export function getLunarHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Leveled habitat pad (r <= 28m is strictly flat for stable structures)
  if (distFromCenter < 28) {
    return 0.0;
  }

  // Rolling natural lunar regolith topography
  const lowNoise =
    Math.sin(x * 0.014) * Math.cos(z * 0.014) * 2.2 +
    Math.sin(x * 0.032 + 1.2) * Math.sin(z * 0.028 + 0.8) * 1.3 +
    Math.cos(x * 0.065 + z * 0.048) * 0.5 +
    Math.sin(x * 0.11 - z * 0.08) * 0.2;

  let craterDisplacement = 0;

  // Evaluate influence of defined craters with C1-continuous cosine profiles
  for (let i = 0; i < LUNAR_CRATERS.length; i++) {
    const c = LUNAR_CRATERS[i];
    const dx = x - c.cx;
    const dz = z - c.cz;
    const dist = Math.hypot(dx, dz);

    if (dist < c.radius * 1.35) {
      if (dist < c.radius) {
        // Smooth crater bowl depression: zero derivative at center and lip
        const normDist = dist / c.radius;
        const bowlFactor = 0.5 * (1 + Math.cos(normDist * Math.PI));
        craterDisplacement -= c.depth * bowlFactor;
      }
      // Crater rim: ejecta blanket & raised lip (smooth cosine falloff)
      const rimPeakDist = Math.abs(dist - c.radius * 0.98);
      const rimWidth = c.radius * 0.32;
      if (rimPeakDist < rimWidth) {
        const rimFactor = Math.cos((rimPeakDist / rimWidth) * (Math.PI / 2));
        craterDisplacement += c.rimHeight * rimFactor * rimFactor;
      }
    }
  }

  // Distant impact basin rim mountain ridges (r > 135m)
  // Seamless smoothstep transition without any step or height jumps
  let horizonMountains = 0;
  if (distFromCenter > 135) {
    const t = Math.min(1.0, (distFromCenter - 135) / 135);
    const blend = t * t * (3 - 2 * t);
    const angle = Math.atan2(z, x);
    const ridgeProfile =
      Math.sin(angle * 5) * 4.2 +
      Math.cos(angle * 8 + 0.7) * 3.0 +
      Math.sin(angle * 13 + 1.8) * 1.6 +
      Math.sin(distFromCenter * 0.04) * 2.2;
    const elevationRamp = Math.pow(t, 2.0) * 20.0;
    horizonMountains = blend * (elevationRamp + ridgeProfile);
  }

  const rawHeight = lowNoise + craterDisplacement + horizonMountains;

  // Smooth blending transition from central leveled pad to natural terrain
  if (distFromCenter < 46) {
    const blendT = (distFromCenter - 28) / (46 - 28);
    const smoothT = blendT * blendT * (3 - 2 * blendT);
    return rawHeight * smoothT;
  }

  // Graceful perimeter containment at outer grid edges (r > 265m)
  if (distFromCenter > 265) {
    const edgeT = Math.min(1.0, (distFromCenter - 265) / 30);
    return rawHeight * (1.0 - edgeT * 0.5) - edgeT * 6.0;
  }

  return rawHeight;
}

/**
 * Calculates surface normal vector [nx, ny, nz] at (x, z) using finite difference
 */
export function getLunarNormal(x: number, z: number): [number, number, number] {
  const step = 0.3;
  const hL = getLunarHeight(x - step, z);
  const hR = getLunarHeight(x + step, z);
  const hD = getLunarHeight(x, z - step);
  const hU = getLunarHeight(x, z + step);

  const dx = (hR - hL) / (2 * step);
  const dz = (hU - hD) / (2 * step);

  // Normal vector = normalize([-dx, 1, -dz])
  const len = Math.hypot(-dx, 1.0, -dz);
  return [-dx / len, 1.0 / len, -dz / len];
}
