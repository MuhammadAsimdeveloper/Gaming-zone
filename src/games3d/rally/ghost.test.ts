import { describe, expect, it } from 'vitest';
import { GhostRecorder, decodeGhost, encodeGhost, sampleGhost, type GhostSample } from './ghost';

describe('Rift Rally ghost replay', () => {
  it('records at 20 Hz', () => {
    const recorder = new GhostRecorder();
    for (let step = 0; step <= 60; step += 1) {
      recorder.push(step / 60, step, 0, 0);
    }

    expect(recorder.samples).toHaveLength(21);
    expect(recorder.samples[0]!.t).toBe(0);
    expect(recorder.samples.at(-1)!.t).toBeCloseTo(1, 5);
  });

  it('ignores pushes that arrive inside the sample interval', () => {
    const recorder = new GhostRecorder();
    expect(recorder.push(0, 1, 2, 3)).toBe(true);
    expect(recorder.push(0.01, 4, 5, 6)).toBe(false);
    expect(recorder.push(0.05, 7, 8, 9)).toBe(true);
    expect(recorder.samples).toHaveLength(2);
  });

  it('round-trips a recording through the codec', () => {
    const samples: GhostSample[] = [
      { t: 0, x: 1.234, z: -5.678, heading: 0.5 },
      { t: 0.05, x: 2.5, z: -6.25, heading: -2.75 },
    ];
    const decoded = decodeGhost(encodeGhost(samples));
    expect(decoded).toEqual(samples);
  });

  it('rejects corrupt, empty and wrong-version payloads', () => {
    expect(decodeGhost('not json')).toBeNull();
    expect(decodeGhost('{}')).toBeNull();
    expect(decodeGhost('{"v":2,"s":[[0,1,2,3]]}')).toBeNull();
    expect(decodeGhost('{"v":1,"s":[]}')).toBeNull();
    expect(decodeGhost('{"v":1,"s":[[0,"x",2,3]]}')).toBeNull();
  });

  it('interpolates position and takes the shortest heading arc', () => {
    const samples: GhostSample[] = [
      { t: 0, x: 0, z: 0, heading: 3 },
      { t: 1, x: 10, z: 20, heading: -3 },
    ];
    const middle = sampleGhost(samples, 0.5);

    expect(middle).not.toBeNull();
    expect(middle!.x).toBeCloseTo(5, 6);
    expect(middle!.z).toBeCloseTo(10, 6);
    expect(Math.abs(middle!.heading)).toBeCloseTo(Math.PI, 5);
  });

  it('clamps sampling to the recording endpoints', () => {
    const samples: GhostSample[] = [
      { t: 1, x: 4, z: 5, heading: 0 },
      { t: 2, x: 8, z: 9, heading: 0 },
    ];
    expect(sampleGhost(samples, 0)).toEqual(samples[0]);
    expect(sampleGhost(samples, 9)).toEqual(samples[1]);
    expect(sampleGhost([], 1)).toBeNull();
  });
});
