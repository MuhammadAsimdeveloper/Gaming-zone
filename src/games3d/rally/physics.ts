import { clamp, normalizeAngle } from '../shared/math';

export type CarClassId = 'grip' | 'balanced' | 'drift';
export type Weather = 'clear' | 'rain';
export type AiTier = 'rookie' | 'pro' | 'elite';

export interface CarClass {
  id: CarClassId;
  name: string;
  tagline: string;
  maxSpeed: number;
  accel: number;
  brake: number;
  steerRate: number;
  grip: number;
  driftGrip: number;
  boostAccel: number;
}

export const CAR_CLASSES: Record<CarClassId, CarClass> = {
  grip: {
    id: 'grip',
    name: 'Vector GT',
    tagline: 'Highest top speed and the most tenacious front end.',
    maxSpeed: 62,
    accel: 23,
    brake: 44,
    steerRate: 1.85,
    grip: 10.5,
    driftGrip: 0.6,
    boostAccel: 26,
  },
  balanced: {
    id: 'balanced',
    name: 'Meridian R',
    tagline: 'A forgiving all-rounder that rewards clean lines.',
    maxSpeed: 58,
    accel: 24,
    brake: 40,
    steerRate: 2.05,
    grip: 8.4,
    driftGrip: 0.5,
    boostAccel: 24,
  },
  drift: {
    id: 'drift',
    name: 'Ember RX',
    tagline: 'Loose rear end, huge drift charge, spectacular exits.',
    maxSpeed: 55,
    accel: 22,
    brake: 35,
    steerRate: 2.3,
    grip: 6.6,
    driftGrip: 0.36,
    boostAccel: 22,
  },
};

export interface RallyVehicle {
  x: number;
  z: number;
  heading: number;
  vx: number;
  vz: number;
  driftCharge: number;
  boostTime: number;
}

export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  steer: number;
  handbrake: boolean;
}

export interface VehicleWorld {
  weather: Weather;
  onTrack: boolean;
}

const WEATHER_GRIP: Record<Weather, number> = {
  clear: 1,
  rain: 0.76,
};

const BOOST_TOP_SPEED = 1.15;
const BOOST_DECAY = 3;
const DRIFT_BOOST_THRESHOLD = 0.35;

export function createVehicle(x: number, z: number, heading: number): RallyVehicle {
  return { x, z, heading, vx: 0, vz: 0, driftCharge: 0, boostTime: 0 };
}

export function speedOf(vehicle: RallyVehicle): number {
  return Math.hypot(vehicle.vx, vehicle.vz);
}

export function lateralSpeedOf(vehicle: RallyVehicle, heading: number): number {
  return vehicle.vx * Math.cos(heading) - vehicle.vz * Math.sin(heading);
}

export function stepVehicle(
  vehicle: RallyVehicle,
  car: CarClass,
  input: DriveInput,
  world: VehicleWorld,
  dt: number,
): RallyVehicle {
  const delta = clamp(dt, 0, 0.05);
  if (delta === 0) return { ...vehicle };

  const weatherGrip = WEATHER_GRIP[world.weather];
  const forwardX = Math.sin(vehicle.heading);
  const forwardZ = Math.cos(vehicle.heading);
  const rightX = Math.cos(vehicle.heading);
  const rightZ = -Math.sin(vehicle.heading);

  let longitudinal = vehicle.vx * forwardX + vehicle.vz * forwardZ;
  let lateral = vehicle.vx * rightX + vehicle.vz * rightZ;
  const boostActive = vehicle.boostTime > 0;
  const topSpeed =
    car.maxSpeed * (world.onTrack ? 1 : 0.55) * (boostActive ? BOOST_TOP_SPEED : 1);

  let force = 0;
  if (input.throttle) force += car.accel;
  if (input.brake) force -= car.brake;
  if (!world.onTrack) force *= 0.62;
  if (boostActive) force += car.boostAccel;

  if (!boostActive && longitudinal > car.maxSpeed) {
    longitudinal = Math.max(car.maxSpeed, longitudinal - BOOST_DECAY * delta);
  } else {
    longitudinal += force * delta;
    if (!input.throttle && !input.brake) longitudinal *= 1 - 0.55 * delta;
    longitudinal = clamp(longitudinal, -car.maxSpeed * 0.3, topSpeed);
  }

  const steerAuthority = clamp(Math.abs(longitudinal) / 12, 0, 1);
  const driftSteer = input.handbrake ? 1.18 : 1;
  const steering =
    input.steer * car.steerRate * steerAuthority * driftSteer * (0.62 + weatherGrip * 0.38);
  vehicle = { ...vehicle, heading: vehicle.heading + steering * delta };

  const gripForce = car.grip * weatherGrip * (input.handbrake ? car.driftGrip : 1);
  lateral *= Math.exp(-gripForce * delta);
  if (!world.onTrack) lateral *= Math.exp(-2.2 * delta);

  let driftCharge = vehicle.driftCharge;
  let boostTime = vehicle.boostTime;
  const drifting = input.handbrake && Math.abs(longitudinal) > 7 && Math.abs(input.steer) > 0.15;
  if (drifting) {
    driftCharge = Math.min(1, driftCharge + delta * (0.42 + Math.abs(lateral) * 0.06));
  } else if (!input.handbrake) {
    if (driftCharge >= DRIFT_BOOST_THRESHOLD) {
      boostTime = Math.max(boostTime, 0.65 + driftCharge * 1.15);
      driftCharge = 0;
    } else {
      driftCharge = Math.max(0, driftCharge - delta * 0.9);
    }
  } else {
    driftCharge = Math.max(0, driftCharge - delta * 0.25);
  }

  boostTime = Math.max(0, boostTime - delta);

  const heading = vehicle.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);

  return {
    x: vehicle.x + (fx * longitudinal + rx * lateral) * delta,
    z: vehicle.z + (fz * longitudinal + rz * lateral) * delta,
    heading,
    vx: fx * longitudinal + rx * lateral,
    vz: fz * longitudinal + rz * lateral,
    driftCharge,
    boostTime,
  };
}

const TIER_NOISE: Record<AiTier, { jitter: number; caution: number; brakeRatio: number }> = {
  rookie: { jitter: 0.34, caution: 0.9, brakeRatio: 0.42 },
  pro: { jitter: 0.12, caution: 1, brakeRatio: 0.48 },
  elite: { jitter: 0.04, caution: 1.12, brakeRatio: 0.54 },
};

export function aiDriveInput(
  self: RallyVehicle,
  target: { x: number; z: number },
  car: CarClass,
  tier: AiTier,
  rng: () => number,
): DriveInput {
  const profile = TIER_NOISE[tier];
  const desired = Math.atan2(target.x - self.x, target.z - self.z);
  const difference = normalizeAngle(desired - self.heading);
  const speed = speedOf(self);
  const jitter = (rng() - 0.5) * profile.jitter;
  const steer = clamp(difference * 2.4 + jitter, -1, 1);
  const tooFast = Math.abs(difference) > 0.9 && speed > car.maxSpeed * profile.brakeRatio;
  const handbrake =
    Math.abs(difference) > 1.55 && speed > car.maxSpeed * (profile.brakeRatio + 0.08);
  const confidence = rng();

  return {
    throttle: !tooFast && confidence < profile.caution + 0.08,
    brake: tooFast,
    steer,
    handbrake,
  };
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
