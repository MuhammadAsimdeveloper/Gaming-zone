export type QualityTier = 'desktop' | 'mobile';

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface ChunkPlan {
  /** Chunks to generate and mesh this frame, nearest first. */
  load: ChunkCoord[];
  /** Chunks outside the kept neighbourhood; they are dropped without meshing. */
  unload: ChunkCoord[];
}

/** Mesher budget per frame, matching the performance budget in the design. */
export const MESH_BUDGET_PER_FRAME = 2;
export const DESKTOP_RENDER_DISTANCE = 6;
export const MOBILE_RENDER_DISTANCE = 3;
export const DESKTOP_RENDER_RANGE = [4, 8] as const;
export const MOBILE_RENDER_RANGE = [2, 4] as const;
/** Loaded chunks survive one chunk beyond the radius so borders do not thrash. */
export const UNLOAD_MARGIN = 1;
/** Fog starts at this fraction of the visible distance. */
export const FOG_START = 0.7;

export function defaultRenderDistance(tier: QualityTier): number {
  return tier === 'mobile' ? MOBILE_RENDER_DISTANCE : DESKTOP_RENDER_DISTANCE;
}

export function clampRenderDistance(tier: QualityTier, value: number): number {
  const fallback = defaultRenderDistance(tier);
  const [min, max] = tier === 'mobile' ? MOBILE_RENDER_RANGE : DESKTOP_RENDER_RANGE;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function chunkId(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function withinRenderDistance(
  center: ChunkCoord,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  return Math.abs(cx - center.cx) <= radius && Math.abs(cz - center.cz) <= radius;
}

export function fogDistances(radiusChunks: number): { near: number; far: number } {
  const far = radiusChunks * 16;
  return { near: Math.round(far * FOG_START * 100) / 100, far };
}

function parseChunkId(key: string): ChunkCoord | null {
  if (typeof key !== 'string') return null;
  const comma = key.indexOf(',');
  if (comma <= 0) return null;
  const cx = Number(key.slice(0, comma));
  const cz = Number(key.slice(comma + 1));
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) return null;
  return { cx, cz };
}

/**
 * Chooses which chunks to build this frame and which loaded chunks to drop. Ordering is
 * distance first, then z, then x, so two frames of the same state request the same work.
 */
export function planChunks(
  center: ChunkCoord,
  loaded: Iterable<string>,
  radius: number,
  budget: number = MESH_BUDGET_PER_FRAME,
): ChunkPlan {
  const loadedKeys = new Set(loaded);
  const candidates: Array<ChunkCoord & { distance: number }> = [];

  for (let dz = -radius; dz <= radius; dz += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const cx = center.cx + dx;
      const cz = center.cz + dz;
      if (loadedKeys.has(chunkId(cx, cz))) continue;
      candidates.push({ cx, cz, distance: dx * dx + dz * dz });
    }
  }

  candidates.sort(
    (a, b) => a.distance - b.distance || a.cz - b.cz || a.cx - b.cx,
  );

  const unload: ChunkCoord[] = [];
  for (const key of loadedKeys) {
    const coord = parseChunkId(key);
    if (!coord) continue;
    if (!withinRenderDistance(center, coord.cx, coord.cz, radius + UNLOAD_MARGIN)) {
      unload.push(coord);
    }
  }
  unload.sort((a, b) => a.cz - b.cz || a.cx - b.cx);

  const limit = Math.max(0, Math.floor(budget));
  return {
    load: candidates.slice(0, limit).map(({ cx, cz }) => ({ cx, cz })),
    unload,
  };
}