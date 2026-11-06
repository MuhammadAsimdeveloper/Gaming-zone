import { normalizeAngle } from '../shared/math';

export const GHOST_SAMPLE_INTERVAL = 0.05;
export const GHOST_MAX_SECONDS = 180;

export interface GhostSample {
  t: number;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface GhostPose {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export interface GhostRecording {
  version: 1;
  trackId: string;
  carId: string;
  time: number;
  splits: number[];
  samples: GhostSample[];
}

export function sampleGhost(t: number, x: number, z: number, heading: number, speed: number): GhostSample {
  return { t, x, z, heading, speed };
}

export function shouldSample(lastSampleTime: number | null, time: number): boolean {
  if (lastSampleTime === null) return true;
  return time - lastSampleTime >= GHOST_SAMPLE_INTERVAL - 1e-6;
}

function poseOf(sample: GhostSample): GhostPose {
  return { x: sample.x, z: sample.z, heading: sample.heading, speed: sample.speed };
}

export function interpolateGhost(samples: readonly GhostSample[], time: number): GhostPose | null {
  if (samples.length === 0) return null;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  if (!Number.isFinite(time) || time <= first.t) return poseOf(first);
  if (time >= last.t) return poseOf(last);

  let low = 0;
  let high = samples.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (samples[middle]!.t <= time) low = middle;
    else high = middle;
  }

  const near = samples[low]!;
  const far = samples[high]!;
  const span = far.t - near.t;
  if (span <= 0) return poseOf(near);
  const fraction = (time - near.t) / span;

  return {
    x: near.x + (far.x - near.x) * fraction,
    z: near.z + (far.z - near.z) * fraction,
    speed: near.speed + (far.speed - near.speed) * fraction,
    heading: normalizeAngle(near.heading + normalizeAngle(far.heading - near.heading) * fraction),
  };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSample(value: unknown): value is GhostSample {
  if (!value || typeof value !== 'object') return false;
  const sample = value as Partial<GhostSample>;
  return (
    finiteNumber(sample.t) &&
    finiteNumber(sample.x) &&
    finiteNumber(sample.z) &&
    finiteNumber(sample.heading) &&
    finiteNumber(sample.speed)
  );
}

export function isValidGhost(value: unknown): value is GhostRecording {
  if (!value || typeof value !== 'object') return false;
  const ghost = value as Partial<GhostRecording>;
  return (
    ghost.version === 1 &&
    typeof ghost.trackId === 'string' &&
    typeof ghost.carId === 'string' &&
    finiteNumber(ghost.time) &&
    ghost.time > 0 &&
    Array.isArray(ghost.splits) &&
    ghost.splits.length > 0 &&
    ghost.splits.every(finiteNumber) &&
    Array.isArray(ghost.samples) &&
    ghost.samples.length > 0 &&
    ghost.samples.every(isSample)
  );
}
