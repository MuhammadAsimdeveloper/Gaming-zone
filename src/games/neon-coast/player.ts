/**
 * On-foot movement for Neon Coast. Pure state in, state out: no React, no DOM.
 */
import { type District, collideCircle, obstacleRects } from './world';

export const PLAYER_RADIUS = 14;
export const PLAYER_WALK_SPEED = 120;
export const PLAYER_SPRINT_SPEED = 175;
const PLAYER_ACCELERATION = 900;
const MIN_MOVING_SPEED = 4;

export interface MoveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface PlayerState {
  x: number;
  z: number;
  heading: number;
  speed: number;
  vx: number;
  vz: number;
}

export function createPlayer(x: number, y: number): PlayerState {
  return { x, z: y, heading: 0, speed: 0, vx: 0, vz: 0 };
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

export function stepPlayer(
  player: PlayerState,
  input: MoveInput,
  dt: number,
  district: District,
): PlayerState {
  const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirZ = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const magnitude = Math.hypot(dirX, dirZ);
  const targetSpeed = input.sprint ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  const targetVx = magnitude > 0 ? (dirX / magnitude) * targetSpeed : 0;
  const targetVz = magnitude > 0 ? (dirZ / magnitude) * targetSpeed : 0;
  const maxDelta = PLAYER_ACCELERATION * dt;

  const vx = approach(player.vx, targetVx, maxDelta);
  const vz = approach(player.vz, targetVz, maxDelta);
  const speed = Math.hypot(vx, vz);
  const heading = speed > MIN_MOVING_SPEED ? Math.atan2(vx, -vz) : player.heading;

  const resolved = collideCircle(
    obstacleRects(district),
    player.x + vx * dt,
    player.z + vz * dt,
    PLAYER_RADIUS,
  );

  return {
    x: resolved.x,
    z: resolved.z,
    heading,
    speed: resolved.hit ? 0 : speed,
    vx: resolved.hit ? 0 : vx,
    vz: resolved.hit ? 0 : vz,
  };
}
