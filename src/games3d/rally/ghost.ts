import { normalizeAngle } from '../shared/math';

export interface GhostSample {
  t: number;
  x: number;
  z: number;
  heading: number;
}

const GHOST_INTERVAL = 0.05;
const GHOST_VERSION = 1;

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class GhostRecorder {
  private readonly interval: number;
  private lastTime = Number.NEGATIVE_INFINITY;
  readonly samples: GhostSample[] = [];

  constructor(interval = GHOST_INTERVAL) {
    this.interval = Math.max(0.01, interval);
  }

  push(elapsed: number, x: number, z: number, heading: number): boolean {
    if (!Number.isFinite(elapsed) || !Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(heading)) {
      return false;
    }
    if (elapsed - this.lastTime < this.interval - 1e-6) return false;
    this.lastTime = elapsed;
    this.samples.push({ t: round(elapsed), x: round(x), z: round(z), heading: round(heading) });
    return true;
  }
}

export function encodeGhost(samples: readonly GhostSample[]): string {
  return JSON.stringify({
    v: GHOST_VERSION,
    s: samples.map((sample) => [sample.t, sample.x, sample.z, sample.heading]),
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function decodeGhost(raw: string): GhostSample[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const payload = parsed as { v?: unknown; s?: unknown };
  if (payload.v !== GHOST_VERSION || !Array.isArray(payload.s) || payload.s.length === 0) {
    return null;
  }

  const samples: GhostSample[] = [];
  for (const entry of payload.s) {
    if (!Array.isArray(entry) || entry.length !== 4) return null;
    const [t, x, z, heading] = entry;
    if (!isFiniteNumber(t) || !isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(heading)) {
      return null;
    }
    samples.push({ t, x, z, heading });
  }
  return samples;
}

export function sampleGhost(samples: readonly GhostSample[], t: number): GhostSample | null {
  if (samples.length === 0 || !Number.isFinite(t)) return null;
  const first = samples[0]!;
  const last = samples.at(-1)!;
  if (t <= first.t) return { ...first };
  if (t >= last.t) return { ...last };

  for (let index = 1; index < samples.length; index += 1) {
    const next = samples[index]!;
    if (t > next.t) continue;
    const previous = samples[index - 1]!;
    const span = next.t - previous.t || 1;
    const ratio = (t - previous.t) / span;
    const headingDelta = normalizeAngle(next.heading - previous.heading);
    return {
      t,
      x: previous.x + (next.x - previous.x) * ratio,
      z: previous.z + (next.z - previous.z) * ratio,
      heading: normalizeAngle(previous.heading + headingDelta * ratio),
    };
  }

  return { ...last };
}
