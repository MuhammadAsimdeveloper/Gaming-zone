export type RallyTrackId = 'coastal-ring' | 'interchange' | 'night-market';

export interface RallyPoint {
  x: number;
  z: number;
  y: number;
}

export interface RallyTrack {
  id: RallyTrackId;
  name: string;
  tagline: string;
  description: string;
  width: number;
  points: RallyPoint[];
  checkpoints: number[];
  length: number;
  skyColor: string;
  fogColor: string;
  accent: string;
  curbColors: [string, string];
  minimap: string;
  minimapBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  seed: number;
}

export interface TrackFrame {
  point: RallyPoint;
  tangent: RallyPoint;
  normal: RallyPoint;
  index: number;
}

export interface LapProgress {
  lap: number;
  nextGate: number;
  splits: number[];
  gateCount: number;
}

const SAMPLE_COUNT = 480;
const CHECKPOINT_COUNT = 6;
const GATE_WINDOW = 5;

interface RawTrack {
  id: RallyTrackId;
  name: string;
  tagline: string;
  description: string;
  width: number;
  waypoints: Array<{ x: number; z: number }>;
  skyColor: string;
  fogColor: string;
  accent: string;
  curbColors: [string, string];
  seed: number;
}

const RAW_TRACKS: RawTrack[] = [
  {
    id: 'coastal-ring',
    name: 'Coastal Ring',
    tagline: 'Salt spray, sea walls and a flat-out shoreline blast.',
    description:
      'A wide, flowing ring around a floodlit harbour. Long sweepers reward commitment, while two late hairpins demand a clean drift. The rain line here is unusually slippery.',
    width: 19,
    skyColor: '#03111d',
    fogColor: '#071b2b',
    accent: '#38e8ff',
    curbColors: ['#38e8ff', '#2dd4bf'],
    seed: 0x51a7,
    waypoints: [
      { x: 0, z: -118 },
      { x: 78, z: -142 },
      { x: 152, z: -112 },
      { x: 186, z: -48 },
      { x: 168, z: 24 },
      { x: 108, z: 70 },
      { x: 38, z: 104 },
      { x: -38, z: 96 },
      { x: -108, z: 62 },
      { x: -154, z: 2 },
      { x: -136, z: -72 },
      { x: -76, z: -122 },
    ],
  },
  {
    id: 'interchange',
    name: 'Interchange',
    tagline: 'Stacked ramps and blind apexes above the freight yards.',
    description:
      'A technical circuit woven through elevated freight ramps. Short straights connect second-gear corners, so traction matters more than top speed. Watch the concrete walls on the exit of the tunnel.',
    width: 17,
    skyColor: '#0b0714',
    fogColor: '#171026',
    accent: '#ffcf5c',
    curbColors: ['#ffcf5c', '#ff8a3d'],
    seed: 0x1c3e,
    waypoints: [
      { x: 0, z: -124 },
      { x: 62, z: -148 },
      { x: 126, z: -126 },
      { x: 152, z: -78 },
      { x: 118, z: -44 },
      { x: 156, z: -6 },
      { x: 142, z: 52 },
      { x: 88, z: 84 },
      { x: 106, z: 130 },
      { x: 38, z: 148 },
      { x: -30, z: 122 },
      { x: -86, z: 86 },
      { x: -122, z: 30 },
      { x: -150, z: -36 },
      { x: -118, z: -96 },
      { x: -58, z: -130 },
    ],
  },
  {
    id: 'night-market',
    name: 'Night Market',
    tagline: 'Tight neon alleys, awnings and zero room for error.',
    description:
      'A narrow street circuit threading a rain-slicked market district. The barriers sit close, the surface changes underfoot and a late chicane decides most races. Precision beats bravery.',
    width: 15,
    skyColor: '#120318',
    fogColor: '#21072a',
    accent: '#ff6b9d',
    curbColors: ['#ff6b9d', '#a06bff'],
    seed: 0x7a21,
    waypoints: [
      { x: 0, z: -104 },
      { x: 54, z: -128 },
      { x: 116, z: -110 },
      { x: 138, z: -62 },
      { x: 104, z: -26 },
      { x: 132, z: 18 },
      { x: 96, z: 62 },
      { x: 122, z: 108 },
      { x: 56, z: 130 },
      { x: -8, z: 108 },
      { x: -64, z: 126 },
      { x: -118, z: 84 },
      { x: -102, z: 22 },
      { x: -138, z: -32 },
      { x: -108, z: -92 },
      { x: -50, z: -118 },
    ],
  },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function resample(points: RallyPoint[], count: number): RallyPoint[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    lengths.push(lengths[index - 1]! + Math.hypot(current.x - previous.x, current.z - previous.z));
  }
  const total = lengths.at(-1) ?? 0;
  if (total <= 0) return points.slice(0, count);

  const result: RallyPoint[] = [];
  let cursor = 0;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / count;
    while (cursor < lengths.length - 2 && lengths[cursor + 1]! < target) cursor += 1;
    const start = lengths[cursor]!;
    const end = lengths[cursor + 1]!;
    const span = end - start || 1;
    const t = Math.min(1, Math.max(0, (target - start) / span));
    const a = points[cursor]!;
    const b = points[cursor + 1]!;
    result.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      y: a.y + (b.y - a.y) * t,
    });
  }
  return result;
}

export function sampleCircuit(
  waypoints: ReadonlyArray<{ x: number; z: number }>,
  seed: number,
  samples = SAMPLE_COUNT,
): RallyPoint[] {
  if (waypoints.length < 3) throw new Error('A circuit needs at least three waypoints');
  const random = mulberry32(seed);
  const jittered = waypoints.map((point) => ({
    x: point.x + (random() - 0.5) * 4,
    z: point.z + (random() - 0.5) * 4,
    y: 0,
  }));

  const stepsPerSegment = 16;
  const dense: RallyPoint[] = [];
  const count = jittered.length;
  for (let segment = 0; segment < count; segment += 1) {
    const p0 = jittered[(segment - 1 + count) % count]!;
    const p1 = jittered[segment]!;
    const p2 = jittered[(segment + 1) % count]!;
    const p3 = jittered[(segment + 2) % count]!;
    for (let step = 0; step < stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      dense.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
        y: 0,
      });
    }
  }
  dense.push(dense[0]!);
  return resample(dense, samples);
}

function buildCheckpoints(samples: number): number[] {
  return Array.from({ length: CHECKPOINT_COUNT }, (_, index) =>
    Math.round((index * samples) / CHECKPOINT_COUNT) % samples,
  );
}

function buildMinimap(points: RallyPoint[]): {
  minimap: string;
  minimapBounds: RallyTrack['minimapBounds'];
} {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 1);
  const scale = 88 / span;
  const minimap = points
    .map((point) => {
      const x = (point.x - bounds.minX) * scale + 6;
      const z = (point.z - bounds.minZ) * scale + 6;
      return `${x.toFixed(1)},${z.toFixed(1)}`;
    })
    .join(' ');
  return { minimap, minimapBounds: bounds };
}

function buildTrack(raw: RawTrack): RallyTrack {
  const points = sampleCircuit(raw.waypoints, raw.seed);
  const { minimap, minimapBounds } = buildMinimap(points);
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    length += Math.hypot(next.x - current.x, next.z - current.z);
  }
  return {
    id: raw.id,
    name: raw.name,
    tagline: raw.tagline,
    description: raw.description,
    width: raw.width,
    points,
    checkpoints: buildCheckpoints(points.length),
    length,
    skyColor: raw.skyColor,
    fogColor: raw.fogColor,
    accent: raw.accent,
    curbColors: raw.curbColors,
    minimap,
    minimapBounds,
    seed: raw.seed,
  };
}

export const RALLY_TRACKS: RallyTrack[] = RAW_TRACKS.map(buildTrack);

export function getRallyTrack(id: RallyTrackId): RallyTrack {
  return RALLY_TRACKS.find((track) => track.id === id) ?? RALLY_TRACKS[0]!;
}

export function trackFrame(points: RallyPoint[], index: number): TrackFrame {
  const count = points.length;
  const wrapped = ((index % count) + count) % count;
  const point = points[wrapped]!;
  const next = points[(wrapped + 1) % count]!;
  const previous = points[(wrapped - 1 + count) % count]!;
  const tx = next.x - previous.x;
  const tz = next.z - previous.z;
  const magnitude = Math.hypot(tx, tz) || 1;
  return {
    point,
    tangent: { x: tx / magnitude, z: tz / magnitude, y: 0 },
    normal: { x: -tz / magnitude, z: tx / magnitude, y: 0 },
    index: wrapped,
  };
}

export function nearestTrackIndex(
  points: RallyPoint[],
  x: number,
  z: number,
  hint?: number,
): number {
  const count = points.length;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  function consider(index: number): void {
    const point = points[index]!;
    const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  if (hint !== undefined) {
    const window = 40;
    for (let offset = -window; offset <= window; offset += 1) {
      consider(((hint + offset) % count + count) % count);
    }
    return bestIndex;
  }

  for (let index = 0; index < count; index += 1) consider(index);
  return bestIndex;
}

export function isOnRallyTrack(
  track: RallyTrack,
  x: number,
  z: number,
  index = nearestTrackIndex(track.points, x, z),
): boolean {
  const frame = trackFrame(track.points, index);
  const dx = x - frame.point.x;
  const dz = z - frame.point.z;
  const lateral = Math.abs(dx * frame.normal.x + dz * frame.normal.z);
  return lateral <= track.width / 2 + 1.2;
}

export function createLapProgress(gateCount: number): LapProgress {
  const count = Math.max(1, gateCount);
  return {
    lap: 1,
    nextGate: count > 1 ? 1 : 0,
    splits: [],
    gateCount: count,
  };
}

function gatePassed(trackIndex: number, gateIndex: number, total: number): boolean {
  const forward = (trackIndex - gateIndex + total) % total;
  return forward <= GATE_WINDOW || forward >= total - GATE_WINDOW;
}

export function registerGatePass(
  track: RallyTrack,
  progress: LapProgress,
  trackIndex: number,
  elapsed: number,
): LapProgress {
  const count = track.checkpoints.length;
  if (count === 0) return progress;
  const gate = track.checkpoints[progress.nextGate % count]!;
  if (!gatePassed(trackIndex, gate, track.points.length)) return progress;

  if (progress.nextGate === 0) {
    return {
      lap: progress.lap + 1,
      nextGate: count > 1 ? 1 : 0,
      splits: [elapsed],
      gateCount: count,
    };
  }

  const nextGate = progress.nextGate + 1 >= count ? 0 : progress.nextGate + 1;
  return {
    lap: progress.lap,
    nextGate,
    splits: [...progress.splits, elapsed],
    gateCount: count,
  };
}

export function projectToMinimap(
  track: RallyTrack,
  x: number,
  z: number,
): { x: number; y: number } {
  const { minX, maxX, minZ, maxZ } = track.minimapBounds;
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  const scale = 88 / span;
  return {
    x: (x - minX) * scale + 6,
    y: (z - minZ) * scale + 6,
  };
}
