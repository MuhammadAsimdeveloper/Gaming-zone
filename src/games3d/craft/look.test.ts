import { describe, expect, it } from 'vitest';
import { MAX_PITCH, applyLook, wrapAngle } from './look';

describe('applyLook', () => {
  it('turns right when the pointer moves right', () => {
    const next = applyLook(0, 0, 100, 0);
    expect(next.yaw).toBeLessThan(0);
    expect(next.pitch).toBe(0);
  });

  it('looks up when the pointer moves up', () => {
    const next = applyLook(0, 0, 0, -100);
    expect(next.pitch).toBeGreaterThan(0);
  });

  it('scales with sensitivity and pointer delta', () => {
    const slow = applyLook(0, 0, 50, 0, 0.001);
    const fast = applyLook(0, 0, 100, 0, 0.001);
    expect(fast.yaw).toBeCloseTo(slow.yaw * 2, 6);
    expect(applyLook(0, 0, 50, 0, 0.002).yaw).toBeCloseTo(slow.yaw * 2, 6);
  });

  it('clamps pitch just short of straight up and down', () => {
    expect(applyLook(0, 0, 0, -10_000).pitch).toBeCloseTo(MAX_PITCH, 6);
    expect(applyLook(0, 0, 0, 10_000).pitch).toBeCloseTo(-MAX_PITCH, 6);
    expect(MAX_PITCH).toBeLessThan(Math.PI / 2);
  });

  it('wraps yaw into one turn so it never grows without bound', () => {
    let angle = 0;
    for (let index = 0; index < 40; index += 1) {
      angle = applyLook(angle, 0, 500, 0).yaw;
      expect(angle).toBeGreaterThanOrEqual(-Math.PI);
      expect(angle).toBeLessThanOrEqual(Math.PI);
    }
  });

  it('ignores non-finite pointer deltas', () => {
    const next = applyLook(0.4, 0.2, Number.NaN, Number.POSITIVE_INFINITY);
    expect(next).toEqual({ yaw: 0.4, pitch: 0.2 });
  });
});

describe('wrapAngle', () => {
  it('maps any angle into one turn', () => {
    expect(wrapAngle(Math.PI * 2)).toBeCloseTo(0, 6);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 6);
    expect(wrapAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5, 6);
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2, 6);
  });
});