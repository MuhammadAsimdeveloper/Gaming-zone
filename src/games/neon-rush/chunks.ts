export const CHUNK_LENGTH = 30;
export const LANE_X = [-2.4, 0, 2.4] as const;
export const MIN_ROW_GAP = 8;
export const FULL_GATE_CLEARANCE = 12;
export const SAFE_OPENING_CHUNKS = 9;

export type Lane = 0 | 1 | 2;
export type ObstacleKind = 'train' | 'barrier' | 'gate';
export type PowerUpKind = 'shield' | 'magnet' | 'overdrive';
export type ValidationCode =
  | 'triple-train'
  | 'row-gap'
  | 'full-gate-clearance'
  | 'barrier-gate-adjacent';

export interface WorldObstacle {
  id: number;
  lane: Lane;
  kind: ObstacleKind;
  z: number;
  length: number;
  hit: boolean;
}

export interface WorldShard {
  id: number;
  lane: Lane;
  z: number;
  collected: boolean;
}

export interface WorldPowerUp {
  id: number;
  kind: PowerUpKind;
  lane: Lane;
  z: number;
  collected: boolean;
}

export interface Chunk {
  index: number;
  startZ: number;
  obstacles: WorldObstacle[];
  shards: WorldShard[];
  powerups: WorldPowerUp[];
}

export interface Track {
  seed: number;
  chunks: Chunk[];
  nextIndex: number;
  obstacles: WorldObstacle[];
  shards: WorldShard[];
  powerups: WorldPowerUp[];
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationCode[];
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function chunkSeed(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function isFullGateRow(row: ReadonlyArray<WorldObstacle>): boolean {
  return row.length === 3 && row.every((entry) => entry.kind === 'gate');
}

export function validateObstacles(obstacles: ReadonlyArray<WorldObstacle>): ValidationResult {
  if (obstacles.length === 0) return { ok: true, errors: [] };

  const errors = new Set<ValidationCode>();
  const sorted = [...obstacles].sort((a, b) => a.z - b.z || a.lane - b.lane);

  const rows: WorldObstacle[][] = [];
  for (const entry of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].z - entry.z) < 0.001) row.push(entry);
    else rows.push([entry]);
  }

  for (const row of rows) {
    if (row.filter((entry) => entry.kind === 'train').length >= 3) {
      errors.add('triple-train');
    }
  }

  for (let index = 1; index < rows.length; index += 1) {
    const gap = rows[index][0].z - rows[index - 1][0].z;
    if (gap < MIN_ROW_GAP) errors.add('row-gap');
    if (isFullGateRow(rows[index - 1]) && gap < FULL_GATE_CLEARANCE) {
      errors.add('full-gate-clearance');
    }
  }

  const byLane = new Map<Lane, WorldObstacle[]>();
  for (const entry of sorted) {
    const lane = byLane.get(entry.lane) ?? [];
    lane.push(entry);
    byLane.set(entry.lane, lane);
  }
  for (const lane of byLane.values()) {
    for (let index = 1; index < lane.length; index += 1) {
      const previous = lane[index - 1];
      const current = lane[index];
      if (previous.kind === current.kind) continue;
      const mixesJumpAndSlide =
        (previous.kind === 'barrier' && current.kind === 'gate') ||
        (previous.kind === 'gate' && current.kind === 'barrier');
      if (mixesJumpAndSlide && current.z - (previous.z + previous.length) < 3) {
        errors.add('barrier-gate-adjacent');
      }
    }
  }

  return { ok: errors.size === 0, errors: [...errors] };
}

interface RowPlan {
  z: number;
  lanes: Partial<Record<Lane, ObstacleKind>>;
}

interface Template {
  weight: number;
  build: (rng: () => number) => RowPlan[];
}

function randomLane(rng: () => number): Lane {
  return Math.floor(rng() * 3) as Lane;
}

function shuffledLanes(rng: () => number): Lane[] {
  const lanes: Lane[] = [0, 1, 2];
  for (let index = 2; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [lanes[index], lanes[swap]] = [lanes[swap], lanes[index]];
  }
  return lanes;
}

function pickKind(rng: () => number): ObstacleKind {
  const roll = rng();
  if (roll < 0.34) return 'train';
  if (roll < 0.67) return 'barrier';
  return 'gate';
}

function singleRow(rng: () => number): RowPlan[] {
  return [
    {
      z: 8 + rng() * 17,
      lanes: { [randomLane(rng)]: pickKind(rng) } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function doubleRow(rng: () => number): RowPlan[] {
  const [first, second] = shuffledLanes(rng);
  return [
    {
      z: 10 + rng() * 14,
      lanes: {
        [first]: pickKind(rng),
        [second]: pickKind(rng),
      } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function staggerRows(rng: () => number): RowPlan[] {
  const [first, second] = shuffledLanes(rng);
  const firstZ = 6 + rng() * 6;
  return [
    { z: firstZ, lanes: { [first]: pickKind(rng) } as Partial<Record<Lane, ObstacleKind>> },
    {
      z: firstZ + 10 + rng() * 4,
      lanes: { [second]: pickKind(rng) } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function barrierGateRows(rng: () => number): RowPlan[] {
  const [barrierLane, gateLane] = shuffledLanes(rng);
  const firstZ = 6 + rng() * 6;
  return [
    { z: firstZ, lanes: { [barrierLane]: 'barrier' } as Partial<Record<Lane, ObstacleKind>> },
    {
      z: firstZ + 11 + rng() * 3,
      lanes: { [gateLane]: 'gate' } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function overheadRow(rng: () => number): RowPlan[] {
  return [
    {
      z: 10 + rng() * 10,
      lanes: { 0: 'gate', 1: 'gate', 2: 'gate' } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function trainPairRow(rng: () => number): RowPlan[] {
  const [first, second] = shuffledLanes(rng);
  return [
    {
      z: 8 + rng() * 14,
      lanes: { [first]: 'train', [second]: 'train' } as Partial<Record<Lane, ObstacleKind>>,
    },
  ];
}

function slalomRows(rng: () => number): RowPlan[] {
  return [4, 14, 24].map((z) => ({
    z,
    lanes: { [randomLane(rng)]: pickKind(rng) } as Partial<Record<Lane, ObstacleKind>>,
  }));
}

function templatesFor(index: number): Template[] {
  if (index < SAFE_OPENING_CHUNKS) {
    return [{ weight: 1, build: () => [] }];
  }
  if (index < 16) {
    return [
      { weight: 1, build: () => [] },
      { weight: 4, build: singleRow },
      { weight: 2, build: staggerRows },
    ];
  }
  if (index < 32) {
    return [
      { weight: 0.5, build: () => [] },
      { weight: 3, build: singleRow },
      { weight: 2, build: staggerRows },
      { weight: 2, build: doubleRow },
      { weight: 1.5, build: barrierGateRows },
      { weight: 1, build: trainPairRow },
      { weight: 1, build: overheadRow },
    ];
  }
  return [
    { weight: 0.3, build: () => [] },
    { weight: 2, build: singleRow },
    { weight: 2, build: staggerRows },
    { weight: 2, build: doubleRow },
    { weight: 1.5, build: barrierGateRows },
    { weight: 1.5, build: trainPairRow },
    { weight: 1.2, build: overheadRow },
    { weight: 1.2, build: slalomRows },
  ];
}

function pickTemplate(rng: () => number, templates: Template[]): Template {
  const total = templates.reduce((sum, template) => sum + template.weight, 0);
  let roll = rng() * total;
  for (const template of templates) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return templates[templates.length - 1];
}

function materializeRows(rows: RowPlan[], index: number, startZ: number): WorldObstacle[] {
  const obstacles: WorldObstacle[] = [];
  rows.forEach((row, rowIndex) => {
    for (const lane of [0, 1, 2] as const) {
      const kind = row.lanes[lane];
      if (!kind) continue;
      obstacles.push({
        id: index * 1000 + rowIndex * 10 + lane,
        lane,
        kind,
        z: startZ + row.z,
        length: kind === 'train' ? 6 : 0.8,
        hit: false,
      });
    }
  });
  return obstacles;
}

function placeShards(
  rng: () => number,
  index: number,
  startZ: number,
  obstacles: ReadonlyArray<WorldObstacle>,
): WorldShard[] {
  const shards: WorldShard[] = [];
  const runs = index < SAFE_OPENING_CHUNKS ? 2 : 1 + Math.floor(rng() * 2);

  for (let run = 0; run < runs; run += 1) {
    const lane = randomLane(rng);
    let start = 4 + rng() * 12;
    let clear = false;
    for (let attempt = 0; attempt < 10 && !clear; attempt += 1) {
      const from = startZ + start - 2.5;
      const to = startZ + start + 12 + 2.5;
      clear = !obstacles.some(
        (entry) => entry.lane === lane && entry.z + entry.length >= from && entry.z <= to,
      );
      if (!clear) start = 4 + rng() * 10;
    }
    if (!clear) continue;

    for (let shard = 0; shard < 4; shard += 1) {
      const z = startZ + start + shard * 3;
      if (z >= startZ + CHUNK_LENGTH - 1) break;
      shards.push({
        id: index * 1000 + 500 + run * 10 + shard,
        lane,
        z,
        collected: false,
      });
    }
  }

  return shards;
}

function placePowerUp(
  rng: () => number,
  index: number,
  startZ: number,
  obstacles: ReadonlyArray<WorldObstacle>,
): WorldPowerUp[] {
  const lane = randomLane(rng);
  const z = startZ + 10 + rng() * 12;
  const blocked = obstacles.some(
    (entry) => entry.lane === lane && entry.z + entry.length >= z - 2 && entry.z <= z + 2,
  );
  if (blocked) return [];
  const kinds: PowerUpKind[] = ['shield', 'magnet', 'overdrive'];
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? 'shield';
  return [{ id: index * 1000 + 900, kind, lane, z, collected: false }];
}

export function generateChunk(
  index: number,
  seed: number,
  previous: ReadonlyArray<WorldObstacle> = [],
): Chunk {
  const startZ = index * CHUNK_LENGTH;
  const rng = createRng(chunkSeed(seed, index));
  const templates = templatesFor(index);

  let obstacles: WorldObstacle[] = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const template = pickTemplate(rng, templates);
    const candidateObstacles = materializeRows(template.build(rng), index, startZ);
    if (validateObstacles([...previous, ...candidateObstacles]).ok) {
      obstacles = candidateObstacles;
      break;
    }
  }

  const shards = placeShards(rng, index, startZ, obstacles);
  const powerups =
    index > 0 && index % 5 === 2 ? placePowerUp(rng, index, startZ, obstacles) : [];

  return { index, startZ, obstacles, shards, powerups };
}

export function createTrack(seed: number): Track {
  return {
    seed,
    chunks: [],
    nextIndex: 0,
    obstacles: [],
    shards: [],
    powerups: [],
  };
}

export function ensureAhead(track: Track, distance: number, ahead = 180): void {
  const target = distance + ahead;
  while (track.nextIndex * CHUNK_LENGTH < target) {
    const startZ = track.nextIndex * CHUNK_LENGTH;
    const previous = track.obstacles.filter((entry) => entry.z >= startZ - 40);
    const chunk = generateChunk(track.nextIndex, track.seed, previous);
    track.chunks.push(chunk);
    track.obstacles.push(...chunk.obstacles);
    track.shards.push(...chunk.shards);
    track.powerups.push(...chunk.powerups);
    track.nextIndex += 1;
  }
}
