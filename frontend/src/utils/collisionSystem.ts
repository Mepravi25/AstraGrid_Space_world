/**
 * Collision system for HabitatOS lunar base and environment.
 * Provides fast 2D/3D obstacle detection and sliding resolution
 * so the player cannot walk through habitat domes, modules, equipment or boulders.
 */

export interface CylinderCollider {
  type: 'cylinder';
  x: number;
  z: number;
  radius: number;
  name: string;
}

export interface BoxCollider {
  type: 'box';
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  rotation?: number; // radians
  name: string;
}

export type WorldCollider = CylinderCollider | BoxCollider;

export const BASE_COLLIDERS: WorldCollider[] = [
  // 1. Central Geodesic Habitat Dome
  { type: 'cylinder', x: 0, z: 0, radius: 10.2, name: 'Main Habitat Dome' },
  // Airlock tunnel north & south
  { type: 'box', x: 0, z: 12.0, halfWidth: 2.2, halfDepth: 2.8, name: 'Airlock Alpha' },
  { type: 'box', x: 0, z: -12.0, halfWidth: 2.2, halfDepth: 2.8, name: 'Airlock Beta' },

  // 2. Solar PV Field Mast & Primary Inverters
  { type: 'cylinder', x: -65, z: -55, radius: 7.0, name: 'Solar Array Alpha' },
  { type: 'cylinder', x: -82, z: -55, radius: 6.0, name: 'Solar Array Beta' },
  { type: 'cylinder', x: -65, z: -72, radius: 6.0, name: 'Solar Array Gamma' },

  // 3. Modular BESS Battery Storage Enclosure
  { type: 'box', x: -32, z: 22, halfWidth: 5.5, halfDepth: 4.0, name: 'BESS Battery Bank' },

  // 4. Potable Water Storage Pressure Spheres
  { type: 'cylinder', x: 28, z: -24, radius: 5.2, name: 'Potable Water Reservoir' },

  // 5. VCD Water Recovery Unit
  { type: 'box', x: 38, z: 10, halfWidth: 4.8, halfDepth: 4.2, name: 'Water Recovery VCD' },

  // 6. Solid-Waste Pyrolysis Unit
  { type: 'box', x: 50, z: 32, halfWidth: 4.8, halfDepth: 4.2, name: 'Solid Waste Pyrolysis' },

  // 7. Oxygen Generation & ECLSS Revitalisation Unit
  { type: 'box', x: 18, z: 32, halfWidth: 4.5, halfDepth: 4.0, name: 'Oxygen Generation Unit' },

  // 8. Kilopower Nuclear Microreactor (berm exclusion perimeter)
  { type: 'cylinder', x: -110, z: 75, radius: 8.5, name: 'Nuclear Kilopower Core' },

  // 9. Central Microgrid Power Distribution Substation
  { type: 'box', x: -20, z: -18, halfWidth: 3.8, halfDepth: 3.5, name: 'Power Distribution Hub' },

  // 10. Autonomous Lunar Lander Descent Stage (Landing Pad)
  { type: 'cylinder', x: 85, z: -75, radius: 8.0, name: 'Lunar Lander Descent Stage' },

  // 11. Lunar Rover & Exploration Depot
  { type: 'box', x: 70, z: 50, halfWidth: 4.0, halfDepth: 3.2, name: 'Lunar Rover Station' },

  // 12. Regenerative Fuel Cell (RFC) Power Unit
  { type: 'box', x: -16, z: 10, halfWidth: 3.2, halfDepth: 2.2, name: 'RFC Power Unit' },

  // Large perimeter boulders
  { type: 'cylinder', x: -24, z: -35, radius: 2.4, name: 'Lunar Boulder 1' },
  { type: 'cylinder', x: 32, z: 42, radius: 2.2, name: 'Lunar Boulder 2' },
  { type: 'cylinder', x: -45, z: -18, radius: 2.8, name: 'Lunar Boulder 3' },
  { type: 'cylinder', x: -15, z: 48, radius: 2.0, name: 'Lunar Boulder 4' },
  { type: 'cylinder', x: 54, z: -38, radius: 2.6, name: 'Lunar Boulder 5' },
];

/**
 * Resolves 2D horizontal collision against all world colliders.
 * Returns the adjusted [x, z] position sliding along obstacle boundaries.
 */
export function resolveHorizontalCollisions(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  playerRadius: number = 0.55
): [number, number] {
  let resX = targetX;
  let resZ = targetZ;

  for (let i = 0; i < BASE_COLLIDERS.length; i++) {
    const col = BASE_COLLIDERS[i];

    // Broad-phase AABB rejection
    const bound = col.type === 'cylinder' ? col.radius + playerRadius : Math.max(col.halfWidth, col.halfDepth) + playerRadius;
    const dx = resX - col.x;
    const dz = resZ - col.z;
    if (Math.abs(dx) > bound || Math.abs(dz) > bound) {
      continue;
    }

    if (col.type === 'cylinder') {
      const minDistance = col.radius + playerRadius;
      const distSq = dx * dx + dz * dz;

      if (distSq < minDistance * minDistance && distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        // Push outside the collider boundary
        resX = col.x + nx * minDistance;
        resZ = col.z + nz * minDistance;
      }
    } else if (col.type === 'box') {
      // Axis-aligned box collision check
      const halfW = col.halfWidth + playerRadius;
      const halfD = col.halfDepth + playerRadius;

      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
        // Find shortest push-out axis
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);

        if (overlapX < overlapZ) {
          resX = col.x + (dx > 0 ? halfW : -halfW);
        } else {
          resZ = col.z + (dz > 0 ? halfD : -halfD);
        }
      }
    }
  }

  // Constrain exploration within navigable terrain bounds (radius 270m)
  const maxRadius = 270.0;
  const currentDist = Math.hypot(resX, resZ);
  if (currentDist > maxRadius) {
    const scale = maxRadius / currentDist;
    resX *= scale;
    resZ *= scale;
  }

  return [resX, resZ];
}
