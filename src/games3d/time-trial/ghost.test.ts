import { describe, expect, it } from 'vitest';
import {
  GHOST_SAMPLE_INTERVAL,
  interpolateGhost,
  isValidGhost,
  sampleGhost,
  shouldSample,
  type GhostRecording,
} from './ghost';

function recording(samples: GhostRecording['samples']): GhostRecording {
  return {
    version: 1,
    trackId: 'rift-loop',
    carId: 'rift-gt',
    time: samples.at(-1)?.t ?? 0,
    splits: [1, 2],
    samples,
  };
}

describe('ghost recording', () => {
  it('samples poses at a fixed cadence', () => {
    expect(shouldSample(null, 0)).toBe(true);
    expect(shouldSample(0, GHOST_SAMPLE_INTERVAL * 0.5)).toBe(false);
    expect(shouldSample(0, GHOST_SAMPLE_INTERVAL)).toBe(true);
    expect(shouldSample(1, 1.6)).toBe(true);

    const sample = sampleGhost(1.25, 12, -4, 0.5, 30);
    expect(sample).toEqual({ t: 1.25, x: 12, z: -4, heading: 0.5, speed: 30 });
  });

  it('returns null for an empty ghost', () => {
    expect(interpolateGhost([], 1)).toBeNull();
  });

  it('clamps before the first and after the last sample', () => {
    const samples = recording([
      { t: 0, x: 0, z: 0, heading: 0, speed: 10 },
      { t: 1, x: 10, z: 0, heading: 0, speed: 20 },
    ]).samples;
    expect(interpolateGhost(samples, -2)).toEqual({ x: 0, z: 0, heading: 0, speed: 10 });
    expect(interpolateGhost(samples, 4)).toEqual({ x: 10, z: 0, heading: 0, speed: 20 });
  });

  it('interpolates position, speed and heading between samples', () => {
    const samples = [
      { t: 0, x: 0, z: 0, heading: 0, speed: 10 },
      { t: 1, x: 10, z: 20, heading: 1, speed: 30 },
    ];
    const pose = interpolateGhost(samples, 0.25);
    expect(pose).not.toBeNull();
    expect(pose!.x).toBeCloseTo(2.5);
    expect(pose!.z).toBeCloseTo(5);
    expect(pose!.speed).toBeCloseTo(15);
    expect(pose!.heading).toBeCloseTo(0.25);
  });

  it('takes the shortest path when a heading crosses the wrap point', () => {
    const samples = [
      { t: 0, x: 0, z: 0, heading: Math.PI - 0.1, speed: 10 },
      { t: 1, x: 0, z: 0, heading: -Math.PI + 0.1, speed: 10 },
    ];
    const pose = interpolateGhost(samples, 0.5);
    expect(pose).not.toBeNull();
    expect(Math.abs(pose!.heading)).toBeGreaterThan(Math.PI - 0.05);
  });

  it('finds exact sample times without drift', () => {
    const samples = [
      { t: 0, x: 1, z: 2, heading: 0, speed: 5 },
      { t: 0.5, x: 3, z: 4, heading: 0, speed: 6 },
      { t: 1, x: 5, z: 6, heading: 0, speed: 7 },
    ];
    expect(interpolateGhost(samples, 0.5)).toEqual({ x: 3, z: 4, heading: 0, speed: 6 });
  });

  it('validates recorded ghosts before they are replayed or stored', () => {
    const valid = recording([
      { t: 0, x: 0, z: 0, heading: 0, speed: 0 },
      { t: 0.05, x: 1, z: 1, heading: 0.1, speed: 12 },
    ]);
    expect(isValidGhost(valid)).toBe(true);

    expect(isValidGhost(null)).toBe(false);
    expect(isValidGhost({ ...valid, version: 2 })).toBe(false);
    expect(isValidGhost({ ...valid, trackId: 7 })).toBe(false);
    expect(isValidGhost({ ...valid, time: Number.NaN })).toBe(false);
    expect(isValidGhost({ ...valid, samples: [] })).toBe(false);
    expect(isValidGhost({ ...valid, samples: [{ t: 0, x: 0, z: 0, heading: 0 }] })).toBe(false);
    expect(isValidGhost({ ...valid, splits: ['fast'] })).toBe(false);
  });
});
