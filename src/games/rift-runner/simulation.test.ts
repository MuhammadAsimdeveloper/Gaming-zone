import { describe, expect, it } from 'vitest';
import {
  RUNNER_GROUND,
  createRunnerState,
  runnerJump,
  runnerStep,
} from './simulation';

describe('Rift Runner simulation', () => {
  it('starts on the ground and alive', () => {
    const state = createRunnerState();
    expect(state.y).toBe(0);
    expect(state.alive).toBe(true);
    expect(state.score).toBe(0);
  });

  it('jumps only from the ground', () => {
    const state = createRunnerState();
    const jumping = runnerJump(state);
    expect(jumping.vy).toBeGreaterThan(0);
    expect(runnerJump(jumping)).toBe(jumping);
  });

  it('rises then returns to the ground', () => {
    let state = runnerJump(createRunnerState());
    for (let index = 0; index < 20; index += 1) state = runnerStep(state, 0.02);
    expect(state.y).toBeGreaterThan(0);
    for (let index = 0; index < 200; index += 1) state = runnerStep(state, 0.02);
    expect(state.y).toBe(0);
    expect(state.vy).toBe(0);
  });

  it('increases speed and distance over time', () => {
    let state = createRunnerState();
    for (let index = 0; index < 60; index += 1) state = runnerStep(state, 0.02);
    expect(state.distance).toBeGreaterThan(0);
    expect(state.speed).toBeGreaterThan(280);
    expect(state.score).toBeGreaterThan(0);
  });

  it('spawns obstacles over time', () => {
    let state = { ...createRunnerState(), nextSpawn: 0 };
    state = runnerStep(state, 0.02);
    expect(state.obstacles).toHaveLength(1);
  });

  it('ends the run when the player hits an obstacle', () => {
    const state = {
      ...createRunnerState(),
      obstacles: [{ x: 100, width: 30, height: 50 }],
      nextSpawn: 99,
    };
    expect(runnerStep(state, 0.02).alive).toBe(false);
  });

  it('clears an obstacle when jumping above it', () => {
    const state = {
      ...createRunnerState(),
      y: 70,
      vy: 0,
      obstacles: [{ x: 100, width: 30, height: 50 }],
      nextSpawn: 99,
    };
    expect(runnerStep(state, 0.02).alive).toBe(true);
  });

  it('does not advance once dead', () => {
    const dead = { ...createRunnerState(), alive: false };
    expect(runnerStep(dead, 0.02)).toBe(dead);
  });

  it('keeps the ground constant', () => {
    expect(RUNNER_GROUND).toBeGreaterThan(0);
  });
});
