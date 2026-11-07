import { isSolidBlock } from './blocks';
import type { VoxelWorld } from './world';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  distance: number;
}

export const DEFAULT_REACH = 5.5;
/** Absorbs accumulated floating-point drift on oblique rays at the reach limit. */
const REACH_EPSILON = 1e-9;

/**
 * Amanatides–Woo grid traversal. Entry distance is the ray parameter at which the current
 * cell was entered, so the reported `distance` is the hit face's distance from the origin.
 * Liquids are skipped by the block registry (`solid: false`), not by a second check here.
 */
export function raycastVoxel(
  world: VoxelWorld,
  origin: Vec3,
  direction: Vec3,
  maxDistance: number = DEFAULT_REACH,
): RayHit | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length === 0) return null;

  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);

  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz);

  let tMaxX = stepX === 0 ? Infinity : (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX;
  let tMaxY = stepY === 0 ? Infinity : (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY;
  let tMaxZ = stepZ === 0 ? Infinity : (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let distance = 0;

  // An origin exactly on a voxel boundary steps with tMax 0. Take those steps before the
  // first cell check so the cell behind the ray is never reported with an empty normal.
  while (tMaxX === 0 || tMaxY === 0 || tMaxZ === 0) {
    if (tMaxX === 0) {
      x += stepX;
      tMaxX = tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY === 0) {
      y += stepY;
      tMaxY = tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      tMaxZ = tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }

  while (distance <= maxDistance + REACH_EPSILON) {
    const id = world.getBlock(x, y, z);
    if (isSolidBlock(id)) {
      // The origin itself can be solid when the eye is inside a block; there is no entry
      // face, so the normal faces back along the dominant axis to keep placement valid.
      if (nx === 0 && ny === 0 && nz === 0) {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        const az = Math.abs(dz);
        if (ax >= ay && ax >= az) nx = -stepX;
        else if (ay >= az) ny = -stepY;
        else nz = -stepZ;
      }
      return { x, y, z, nx, ny, nz, distance };
    }

    // Axis ties are resolved X, then Y, then Z: a ray through a voxel edge enters the
    // cells on both sides, and this order is the one the unit tests pin down.
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY <= tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }

  return null;
}