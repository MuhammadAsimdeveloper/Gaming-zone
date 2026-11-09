/**
 * Arcade driving for the Solstice Vela. Pure state in, state out.
 */
import { type District, collideCircle, obstacleRects } from './world';

export const VEHICLE_MAX_SPEED = 430;
export const VEHICLE_ACCELERATION = 260;
export const VEHICLE_BRAKING = 480;
export const VEHICLE_REVERSE_SPEED = 160;
export const VEHICLE_STEER_RATE = 2.4;
export const VEHICLE_HANDBRAKE_DECELERATION = 420;
export const VEHICLE_DRAG = 60;
export const VEHICLE_RADIUS = 26;
const STEER_REFERENCE_SPEED = 120;
const COLLISION_SPEED_FACTOR = 0.25;

export interface DriveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export interface VehicleState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export function createVehicle(x: number, y: number, heading = 0): VehicleState {
  return { x, z: y, heading, speed: 0 };
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

export function stepVehicle(
  vehicle: VehicleState,
  input: DriveInput,
  dt: number,
  district: District,
): VehicleState {
  let speed = vehicle.speed;

  if (input.handbrake) {
    speed = approach(speed, 0, VEHICLE_HANDBRAKE_DECELERATION * dt);
  } else if (input.forward) {
    speed = approach(speed, VEHICLE_MAX_SPEED, VEHICLE_ACCELERATION * dt);
  } else if (input.back) {
    if (speed > 0) speed = approach(speed, 0, VEHICLE_BRAKING * dt);
    else speed = approach(speed, -VEHICLE_REVERSE_SPEED, VEHICLE_ACCELERATION * dt);
  } else {
    speed = approach(speed, 0, VEHICLE_DRAG * dt);
  }

  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  let heading = vehicle.heading;
  if (steer !== 0 && Math.abs(speed) > 1) {
    const grip = Math.min(Math.abs(speed) / STEER_REFERENCE_SPEED, 1);
    const direction = speed < 0 ? -1 : 1;
    const boost = input.handbrake ? 1.25 : 1;
    heading -= steer * direction * VEHICLE_STEER_RATE * grip * boost * dt;
  }

  const resolved = collideCircle(
    obstacleRects(district),
    vehicle.x + Math.sin(heading) * speed * dt,
    vehicle.z - Math.cos(heading) * speed * dt,
    VEHICLE_RADIUS,
  );

  return {
    x: resolved.x,
    z: resolved.z,
    heading,
    speed: resolved.hit ? speed * COLLISION_SPEED_FACTOR : speed,
  };
}
