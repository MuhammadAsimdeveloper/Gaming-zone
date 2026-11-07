import { describe, expect, it } from 'vitest';
import {
  CYCLE_SECONDS,
  PHASE_SECONDS,
  clockAt,
  phaseAt,
  skyLightAt,
  skyPalette,
} from './daynight';

describe('day/night cycle', () => {
  it('runs a twelve-minute cycle split into day, dusk, night and dawn', () => {
    expect(CYCLE_SECONDS).toBe(720);
    expect(PHASE_SECONDS.day).toBe(360);
    expect(PHASE_SECONDS.dusk).toBe(90);
    expect(PHASE_SECONDS.night).toBe(180);
    expect(PHASE_SECONDS.dawn).toBe(90);
    const total = Object.values(PHASE_SECONDS).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(CYCLE_SECONDS);
  });

  it('selects the phase for any time in the cycle', () => {
    expect(phaseAt(0)).toBe('day');
    expect(phaseAt(359.9)).toBe('day');
    expect(phaseAt(360)).toBe('dusk');
    expect(phaseAt(449.9)).toBe('dusk');
    expect(phaseAt(450)).toBe('night');
    expect(phaseAt(629.9)).toBe('night');
    expect(phaseAt(630)).toBe('dawn');
    expect(phaseAt(719.9)).toBe('dawn');
    expect(phaseAt(720)).toBe('day');
  });

  it('wraps the day counter and keeps cross-cycle queries stable', () => {
    expect(clockAt(0)).toMatchObject({ day: 1, phase: 'day' });
    expect(clockAt(720)).toMatchObject({ day: 2, phase: 'day' });
    expect(clockAt(1_440)).toMatchObject({ day: 3, phase: 'day' });
    expect(clockAt(800)).toMatchObject({ day: 2, phase: 'day' });
    expect(clockAt(1_120)).toMatchObject({ day: 2, phase: 'dusk' });
  });

  it('labels the in-game clock as a compressed 24-hour day', () => {
    expect(clockAt(0).label).toBe('06:00');
    expect(clockAt(180).label).toBe('12:00');
    expect(clockAt(359).label).toBe('17:58');
    expect(clockAt(360).label).toBe('18:00');
    expect(clockAt(450).label).toBe('21:00');
    expect(clockAt(630).label).toBe('03:00');
  });

  it('reports phase progress from zero to one', () => {
    expect(clockAt(0).progress).toBe(0);
    expect(clockAt(180).progress).toBeCloseTo(0.5);
    expect(clockAt(360).progress).toBe(0);
    expect(clockAt(405).progress).toBeCloseTo(0.5);
    expect(clockAt(450).progress).toBe(0);
    expect(clockAt(630).progress).toBe(0);
  });

  it('dims the sky through dusk and restores it through dawn', () => {
    expect(skyLightAt(0)).toBe(1);
    expect(skyLightAt(360)).toBe(1);
    expect(skyLightAt(405)).toBeCloseTo(0.625);
    expect(skyLightAt(450)).toBeCloseTo(0.25);
    expect(skyLightAt(540)).toBeCloseTo(0.25);
    expect(skyLightAt(675)).toBeCloseTo(0.625);
    expect(skyLightAt(720)).toBe(1);
  });
  it('paints a bright daytime sky with no stars', () => {
    const noon = skyPalette(180);
    expect(noon.daylight).toBe(1);
    expect(noon.starOpacity).toBe(0);
    expect(noon.sunIntensity).toBeGreaterThan(2);
    expect(noon.top.b).toBeGreaterThan(noon.top.r);
    expect(noon.skyLight).toBe(1);
  });

  it('switches to a dark starry night', () => {
    const midnight = skyPalette(540);
    const luminance = (midnight.top.r + midnight.top.g + midnight.top.b) / 3;
    expect(midnight.daylight).toBeCloseTo(0.25);
    expect(midnight.starOpacity).toBe(1);
    expect(luminance).toBeLessThan(0.08);
    expect(midnight.sunIntensity).toBeLessThan(0.5);
    expect(midnight.ambientIntensity).toBeLessThan(skyPalette(180).ambientIntensity);
  });

  it('warms the horizon during dusk', () => {
    const dusk = skyPalette(405);
    expect(dusk.horizon.r).toBeGreaterThan(dusk.horizon.b);
    expect(dusk.starOpacity).toBeGreaterThan(0);
    expect(dusk.starOpacity).toBeLessThan(1);
    expect(dusk.daylight).toBeLessThan(1);
  });

  it('keeps every channel in range and wraps continuously', () => {
    for (let time = 0; time < CYCLE_SECONDS; time += 15) {
      const palette = skyPalette(time);
      for (const color of [palette.top, palette.horizon, palette.fog, palette.sun]) {
        for (const channel of [color.r, color.g, color.b]) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
      expect(palette.starOpacity).toBeGreaterThanOrEqual(0);
      expect(palette.starOpacity).toBeLessThanOrEqual(1);
    }
    const end = skyPalette(CYCLE_SECONDS - 0.001);
    const start = skyPalette(0.001);
    expect(end.top.r).toBeCloseTo(start.top.r, 2);
    expect(end.fog.b).toBeCloseTo(start.fog.b, 2);
    expect(end.sunIntensity).toBeCloseTo(start.sunIntensity, 2);
  });
});
