import { describe, expect, it } from 'vitest';
import { LANE_X } from './chunks';
import {
  PLAYER_HEIGHT,
  PLAYER_ROLL_HEIGHT,
  ROLL_DURATION,
  applyPlayerAction,
  createPlayer,
  playerHeight,
  stepPlayer,
} from './player';

describe('player state machine', () => {
  it('starts centered and grounded', () => {
    const player = createPlayer();
    expect(player.lane).toBe(1);
    expect(player.x).toBe(LANE_X[1]);
    expect(player.y).toBe(0);
    expect(player.airborne).toBe(false);
    expect(player.rolling).toBe(false);
  });

  it('switches lanes and clamps at the edges', () => {
    const player = createPlayer();
    expect(applyPlayerAction(player, 'right')).toBe(true);
    expect(player.lane).toBe(2);
    expect(applyPlayerAction(player, 'right')).toBe(false);
    expect(player.lane).toBe(2);
    expect(applyPlayerAction(player, 'left')).toBe(true);
    expect(applyPlayerAction(player, 'left')).toBe(true);
    expect(player.lane).toBe(0);
    expect(applyPlayerAction(player, 'left')).toBe(false);
  });

  it('interpolates the visual lane toward the target', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'right');
    expect(player.x).toBeLessThan(LANE_X[2]);
    for (let step = 0; step < 24; step += 1) stepPlayer(player, 1 / 120);
    expect(player.x).toBeGreaterThan(LANE_X[2] - 0.05);
  });

  it('jumps, peaks and lands at the ground', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'jump');
    expect(player.airborne).toBe(true);

    let peak = 0;
    for (let step = 0; step < 90; step += 1) {
      stepPlayer(player, 1 / 120);
      peak = Math.max(peak, player.y);
    }

    expect(peak).toBeGreaterThan(1.3);
    expect(peak).toBeLessThan(1.8);
    expect(player.airborne).toBe(false);
    expect(player.y).toBe(0);
  });

  it('rolls for the authored duration and lowers the hitbox', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'roll');
    expect(player.rolling).toBe(true);
    expect(playerHeight(player)).toBe(PLAYER_ROLL_HEIGHT);
    expect(PLAYER_ROLL_HEIGHT).toBeLessThan(PLAYER_HEIGHT);

    stepPlayer(player, ROLL_DURATION - 0.01);
    expect(player.rolling).toBe(true);
    stepPlayer(player, 0.02);
    expect(player.rolling).toBe(false);
    expect(playerHeight(player)).toBe(PLAYER_HEIGHT);
  });

  it('buffers a jump pressed just before landing', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'jump');
    for (let step = 0; step < 60; step += 1) stepPlayer(player, 1 / 120);
    expect(player.airborne).toBe(true);
    expect(player.y).toBeGreaterThan(0.8);

    expect(applyPlayerAction(player, 'jump')).toBe(false);
    expect(player.airborne).toBe(true);

    for (let step = 0; step < 18; step += 1) stepPlayer(player, 1 / 120);
    expect(player.airborne).toBe(true);
    expect(player.vy).toBeGreaterThan(0);
  });

  it('cancels a roll when jumping', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'roll');
    expect(player.rolling).toBe(true);
    applyPlayerAction(player, 'jump');
    expect(player.rolling).toBe(false);
    expect(player.airborne).toBe(true);
  });

  it('buffers a roll until the player lands', () => {
    const player = createPlayer();
    applyPlayerAction(player, 'jump');
    for (let step = 0; step < 66; step += 1) stepPlayer(player, 1 / 120);
    expect(player.airborne).toBe(true);

    expect(applyPlayerAction(player, 'roll')).toBe(false);
    expect(player.rolling).toBe(false);

    for (let step = 0; step < 24; step += 1) stepPlayer(player, 1 / 120);
    expect(player.airborne).toBe(false);
    expect(player.rolling).toBe(true);
  });
});
