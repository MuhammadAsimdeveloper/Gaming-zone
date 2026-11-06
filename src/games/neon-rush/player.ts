import { LANE_X, type Lane } from './chunks';

export const PLAYER_HEIGHT = 1.6;
export const PLAYER_ROLL_HEIGHT = 0.6;
export const PLAYER_DEPTH = 0.8;
export const JUMP_IMPULSE = 9.5;
export const GRAVITY = 30;
export const ROLL_DURATION = 0.55;
export const LANE_DAMP = 25;
export const INPUT_BUFFER = 0.15;

export type PlayerAction = 'left' | 'right' | 'jump' | 'roll';

export interface PlayerState {
  lane: Lane;
  x: number;
  y: number;
  vy: number;
  airborne: boolean;
  rolling: boolean;
  rollTimer: number;
  buffered: PlayerAction | null;
  bufferTimer: number;
}

export function createPlayer(): PlayerState {
  return {
    lane: 1,
    x: LANE_X[1],
    y: 0,
    vy: 0,
    airborne: false,
    rolling: false,
    rollTimer: 0,
    buffered: null,
    bufferTimer: 0,
  };
}

export function playerHeight(player: PlayerState): number {
  return player.rolling ? PLAYER_ROLL_HEIGHT : PLAYER_HEIGHT;
}

export function applyPlayerAction(player: PlayerState, action: PlayerAction): boolean {
  if (action === 'left' || action === 'right') {
    const next = player.lane + (action === 'left' ? -1 : 1);
    if (next < 0 || next > 2) return false;
    player.lane = next as Lane;
    return true;
  }

  if (action === 'jump') {
    if (player.airborne) {
      player.buffered = 'jump';
      player.bufferTimer = INPUT_BUFFER;
      return false;
    }
    player.rolling = false;
    player.rollTimer = 0;
    player.vy = JUMP_IMPULSE;
    player.airborne = true;
    return true;
  }

  if (player.airborne) {
    player.buffered = 'roll';
    player.bufferTimer = INPUT_BUFFER;
    return false;
  }
  player.rolling = true;
  player.rollTimer = ROLL_DURATION;
  return true;
}

export function stepPlayer(player: PlayerState, delta: number): void {
  if (player.bufferTimer > 0) {
    player.bufferTimer = Math.max(0, player.bufferTimer - delta);
    if (player.bufferTimer === 0) player.buffered = null;
  }

  if (player.airborne) {
    player.vy -= GRAVITY * delta;
    player.y += player.vy * delta;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.airborne = false;
      const buffered = player.buffered;
      if (buffered) {
        player.buffered = null;
        player.bufferTimer = 0;
        applyPlayerAction(player, buffered);
      }
    }
  }

  if (player.rolling) {
    player.rollTimer = Math.max(0, player.rollTimer - delta);
    if (player.rollTimer === 0) player.rolling = false;
  }

  const target = LANE_X[player.lane];
  const weight = 1 - Math.exp(-LANE_DAMP * delta);
  player.x += (target - player.x) * weight;
}
