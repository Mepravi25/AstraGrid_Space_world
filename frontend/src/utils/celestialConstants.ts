import * as THREE from 'three';

// -------------------------------------------------------------------------
// HabitatOS Celestial Coordinate System & Solar Illumination
// -------------------------------------------------------------------------
// Sun elevation ~21° above lunar horizon, azimuth ~330° NW.
// Vector points FROM origin TOWARDS the Sun.
// -------------------------------------------------------------------------

// Normalized world vector towards the Sun
export const SUN_DIRECTION = new THREE.Vector3(-0.46, 0.36, -0.81).normalize();

// Visible Sun Disc position in lunar sky (distance 400, prominent angular size)
export const SUN_SKY_DISTANCE = 400;
export const SUN_SKY_POSITION: [number, number, number] = [
  SUN_DIRECTION.x * SUN_SKY_DISTANCE,
  SUN_DIRECTION.y * SUN_SKY_DISTANCE,
  SUN_DIRECTION.z * SUN_SKY_DISTANCE
];

// Principal Directional Sunlight position (optimal shadow frustum depth)
export const SUN_LIGHT_DISTANCE = 240;
export const SUN_LIGHT_POSITION: [number, number, number] = [
  SUN_DIRECTION.x * SUN_LIGHT_DISTANCE,
  SUN_DIRECTION.y * SUN_LIGHT_DISTANCE,
  SUN_DIRECTION.z * SUN_LIGHT_DISTANCE
];

// Visible Earth position in lunar sky (distant celestial object at distance ~500m, azimuth ~021° NNE, elevation ~27°)
// Positioned clearly above all visible lunar horizon mountains and crater rims from Astronaut and Orbit viewpoints
export const EARTH_POSITION: [number, number, number] = [162, 228, -415];
export const EARTH_RADIUS = 26.5;

// Direct sunlight color (5778K solar white) and intensity
export const SUN_LIGHT_COLOR = '#fffdf8';
export const SUN_LIGHT_INTENSITY = 4.4;

// Lunar fill light (secondary regolith scatter & earthshine bounce, no atmospheric fog)
export const LUNAR_FILL_SKY_COLOR = '#2e3546';
export const LUNAR_FILL_GROUND_COLOR = '#20242e';
export const LUNAR_FILL_INTENSITY = 0.36;
