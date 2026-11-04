import { describe, expect, it } from 'vitest';
import {
  STACK_WIDTH,
  createStackState,
  dropBlock,
  overlapWidth,
  startStack,
  topBlock,
} from './simulation';

function playing() {
  return startStack(createStackState());
}

describe('Signal Stack simulation', () => {
  it('creates a single starting block', () => {
    const state = createStackState();
    expect(state.blocks).toHaveLength(1);
    expect(state.phase).toBe('ready');
    expect(topBlock(state).width).toBe(46);
  });

  it('starts once', () => {
    const state = playing();
    expect(state.phase).toBe('playing');
    expect(startStack(state)).toBe(state);
  });

  it('computes overlap between the top block and marker', () => {
    const top = { x: 30, width: 40 };
    expect(overlapWidth(top, 20)).toBe(30);
    expect(overlapWidth(top, 60)).toBe(10);
    expect(overlapWidth(top, 80)).toBe(0);
  });

  it('drops a block and shrinks to the overlap', () => {
    const state = playing();
    const top = topBlock(state);
    const next = dropBlock(state, top.x + 10);
    expect(next.blocks).toHaveLength(2);
    expect(topBlock(next).width).toBe(top.width - 10);
    expect(next.score).toBe(10);
  });

  it('rewards a perfect drop', () => {
    const state = playing();
    const next = dropBlock(state, topBlock(state).x);
    expect(next.perfects).toBe(1);
    expect(next.score).toBe(20);
    expect(topBlock(next).width).toBeGreaterThanOrEqual(topBlock(state).width);
  });

  it('ends the run on a complete miss', () => {
    const state = playing();
    const top = topBlock(state);
    const next = dropBlock(state, top.x + top.width + 5);
    expect(next.phase).toBe('over');
    expect(next.blocks).toHaveLength(1);
  });

  it('clamps blocks inside the board', () => {
    const state = playing();
    const next = dropBlock(state, -10);
    expect(next.blocks[1]!.x).toBeGreaterThanOrEqual(0);
    expect(next.blocks[1]!.x + next.blocks[1]!.width).toBeLessThanOrEqual(STACK_WIDTH);
  });

  it('increases speed after a successful drop', () => {
    const state = playing();
    expect(dropBlock(state, topBlock(state).x).speed).toBeGreaterThan(state.speed);
  });
});
