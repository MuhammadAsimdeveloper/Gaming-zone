import { isLiquidBlock, isSolidBlock } from './blocks';
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

/**
 * Amanatides–Woo grid traversal. Entry distance is the ray parameter at which the current
 * cell was entered, so the reported `distance` is the hit face's distance from the origin.
 * Liquids are transparent to picking.
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

  while (distance <= maxDistance) {
    const id = world.getBlock(x, y, z);
    if (isSolidBlock(id) && !isLiquidBlock(id)) {
      return { x, y, z, nx, ny, nz, distance };
    }

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