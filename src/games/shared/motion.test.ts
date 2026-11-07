import { describe, expect, it } from 'vitest';
import { foodPulse, groundDashOffset, markerSpeed } from './motion';

describe('reduced-motion helpers', () => {
  it('holds the snake orb at a steady size when motion is reduced', () => {
    expect(foodPulse(true, 0)).toBe(1);
    expect(foodPulse(true, 408.4)).toBe(1);
  });

  it('pulses the snake orb when motion is allowed', () => {
    expect(foodPulse(false, 0)).toBeCloseTo(0.75, 5);
    expect(foodPulse(false, (Math.PI / 2) * 260)).toBeCloseTo(0.9, 5);
  });

  it('freezes the runner ground dashes when motion is reduced', () => {
    expect(groundDashOffset(true, 0)).toBe(0);
    expect(groundDashOffset(true, 100)).toBe(0);
  });

  it('scrolls the runner ground dashes at the travel rate when motion is allowed', () => {
    expect(groundDashOffset(false, 10)).toBeCloseTo(-8, 5);
    expect(groundDashOffset(false, 100)).toBeCloseTo(-16, 5);
  });

  it('slows the signal-stack marker without stopping it', () => {
    expect(markerSpeed(true, 46)).toBeCloseTo(27.6, 5);
    expect(markerSpeed(false, 46)).toBe(46);
    expect(markerSpeed(true, 46)).toBeGreaterThan(0);
  });
});