import { describe, expect, it } from 'vitest';
import {
  CYCLE_SECONDS,
  PHASE_SECONDS,
  clockAt,
  phaseAt,
  skyLightAt,
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
});