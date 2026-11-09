import { describe, expect, it } from 'vitest';
import { ENDING_IDS, ENDING_TABLE, resolveEnding } from './endings';
import { DAYS, createLife, type LifeState } from './simulation';

function state(overrides: Partial<LifeState> = {}): LifeState {
  const base = createLife(21);
  return {
    ...base,
    ...overrides,
    relationships: { ...base.relationships, ...overrides.relationships },
    flags: overrides.flags ?? base.flags,
  };
}

describe('rift life endings', () => {
  it('covers all six endings exactly once', () => {
    expect(ENDING_TABLE).toHaveLength(6);
    expect(new Set(ENDING_TABLE.map((rule) => rule.id)).size).toBe(6);
    expect([...ENDING_TABLE.map((rule) => rule.id)].sort()).toEqual([...ENDING_IDS].sort());
  });

  it('resolves each ending from a documented state', () => {
    const anchor = state({
      community: 65,
      jobProgress: 65,
      relationships: { mara: 55, ilo: 55, sena: 0, tovan: 0, juno: 0 },
    });
    expect(resolveEnding(anchor)).toBe('rift-anchor');

    const kindred = state({ relationships: { mara: 80, ilo: 0, sena: 0, tovan: 0, juno: 0 } });
    expect(resolveEnding(kindred)).toBe('kindred-spark');

    const groundbreaker = state({ jobProgress: 80 });
    expect(resolveEnding(groundbreaker)).toBe('groundbreaker');

    const stormWalker = state({ weather: 'storm', community: 45 });
    expect(resolveEnding(stormWalker)).toBe('storm-walker');

    const burnedOut = state({ flags: ['burnout'] });
    expect(resolveEnding(burnedOut)).toBe('hollow-drift');

    const quiet = state();
    expect(resolveEnding(quiet)).toBe('quiet-haven');
  });

  it('breaks ties deterministically by table order', () => {
    const overlap = state({
      jobProgress: 90,
      relationships: { mara: 90, ilo: 0, sena: 0, tovan: 0, juno: 0 },
    });
    expect(resolveEnding(overlap)).toBe('kindred-spark');
    expect(resolveEnding(overlap)).toBe(resolveEnding({ ...overlap }));
  });

  it('always returns an ending, even before day 21', () => {
    const early = state({ day: 3 });
    const ending = resolveEnding(early);
    expect(ENDING_IDS).toContain(ending);
    expect(early.day).toBeLessThan(DAYS);
    expect(early.endingId).toBeNull();
  });
});
