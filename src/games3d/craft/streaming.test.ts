import { describe, expect, it } from 'vitest';
import {
  MESH_BUDGET_PER_FRAME,
  chunkId,
  clampRenderDistance,
  defaultRenderDistance,
  fogDistances,
  planChunks,
  withinRenderDistance,
} from './streaming';

const origin = { cx: 0, cz: 0 };

function ids(coords: Array<{ cx: number; cz: number }>): string[] {
  return coords.map(({ cx, cz }) => chunkId(cx, cz));
}

describe('render distance', () => {
  it('defaults to six chunks on desktop and three on mobile', () => {
    expect(defaultRenderDistance('desktop')).toBe(6);
    expect(defaultRenderDistance('mobile')).toBe(3);
  });

  it('clamps to the documented range per quality tier', () => {
    expect(clampRenderDistance('desktop', 1)).toBe(4);
    expect(clampRenderDistance('desktop', 99)).toBe(8);
    expect(clampRenderDistance('desktop', 6.6)).toBe(7);
    expect(clampRenderDistance('mobile', 1)).toBe(2);
    expect(clampRenderDistance('mobile', 9)).toBe(4);
    expect(clampRenderDistance('mobile', Number.NaN)).toBe(3);
  });

  it('counts chunks in a square neighbourhood', () => {
    expect(withinRenderDistance(origin, 6, 0, 6)).toBe(true);
    expect(withinRenderDistance(origin, 0, -6, 6)).toBe(true);
    expect(withinRenderDistance(origin, 7, 0, 6)).toBe(false);
    expect(withinRenderDistance(origin, 4, 4, 6)).toBe(true);
  });

  it('derives fog from the render distance, starting at 70 percent', () => {
    expect(fogDistances(6)).toEqual({ near: 67.2, far: 96 });
    expect(fogDistances(3)).toEqual({ near: 33.6, far: 48 });
  });
});

describe('planChunks', () => {
  it('asks for unloaded chunks nearest first and deterministically', () => {
    const plan = planChunks(origin, [], 1, 100);
    expect(plan.unload).toEqual([]);
    expect(ids(plan.load)).toEqual([
      '0,0',
      '0,-1',
      '-1,0',
      '1,0',
      '0,1',
      '-1,-1',
      '1,-1',
      '-1,1',
      '1,1',
    ]);
  });

  it('never returns a chunk that is already loaded', () => {
    const plan = planChunks(origin, ['0,0', '-1,0', '0,-1'], 1, 100);
    expect(ids(plan.load)).not.toContain('0,0');
    expect(ids(plan.load)).not.toContain('-1,0');
    expect(plan.load).toHaveLength(6);
  });

  it('caps one frame of mesh work to the budget', () => {
    const plan = planChunks(origin, [], 2, MESH_BUDGET_PER_FRAME);
    expect(plan.load).toHaveLength(MESH_BUDGET_PER_FRAME);
    expect(plan.load[0]).toEqual(origin);
  });

  it('keeps a one-chunk margin before unloading', () => {
    // Radius 1 unloads beyond Chebyshev 2, so a chunk two away survives one frame of lag.
    const plan = planChunks(origin, ['2,2', '3,0', 'bad-key', '-2,3'], 1, 1);
    expect(ids(plan.unload)).toEqual(['3,0', '-2,3']);
  });

  it('ignores malformed loaded keys', () => {
    const plan = planChunks(origin, ['', 'x,y', '1,', null as unknown as string], 0, 4);
    expect(ids(plan.load)).toEqual(['0,0']);
    expect(plan.unload).toEqual([]);
  });
});