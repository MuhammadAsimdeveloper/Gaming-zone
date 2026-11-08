import { describe, expect, it } from 'vitest';
import {
  CAR_CLASSES,
  aiDriveInput,
  createVehicle,
  lateralSpeedOf,
  mulberry32,
  speedOf,
  stepVehicle,
  type DriveInput,
} from './physics';

const DT = 1 / 60;
const NEUTRAL: DriveInput = { throttle: false, brake: false, steer: 0, handbrake: false };

function run(
  steps: number,
  input: DriveInput,
  options: { weather?: 'clear' | 'rain'; onTrack?: boolean } = {},
) {
  let vehicle = createVehicle(0, 0, 0);
  const car = CAR_CLASSES.balanced;
  for (let step = 0; step < steps; step += 1) {
    vehicle = stepVehicle(vehicle, car, input, {
      weather: options.weather ?? 'clear',
      onTrack: options.onTrack ?? true,
    }, DT);
  }
  return vehicle;
}

describe('Rift Rally vehicle physics', () => {
  it('accelerates under throttle and caps at the class top speed', () => {
    const launched = run(180, { ...NEUTRAL, throttle: true });
    expect(speedOf(launched)).toBeGreaterThan(20);

    let fast = createVehicle(0, 0, 0);
    for (let step = 0; step < 1800; step += 1) {
      fast = stepVehicle(fast, CAR_CLASSES.grip, { ...NEUTRAL, throttle: true }, { weather: 'clear', onTrack: true }, DT);
    }
    expect(speedOf(fast)).toBeLessThanOrEqual(CAR_CLASSES.grip.maxSpeed + 0.5);
    expect(speedOf(fast)).toBeGreaterThan(CAR_CLASSES.grip.maxSpeed - 2);
  });

  it('brakes and coasts down', () => {
    let vehicle = run(180, { ...NEUTRAL, throttle: true });
    const cruise = speedOf(vehicle);
    vehicle = stepVehicle(vehicle, CAR_CLASSES.balanced, { ...NEUTRAL, brake: true }, { weather: 'clear', onTrack: true }, DT);
    expect(speedOf(vehicle)).toBeLessThan(cruise);
    const braked = speedOf(vehicle);

    let coasting = vehicle;
    for (let step = 0; step < 60; step += 1) {
      coasting = stepVehicle(coasting, CAR_CLASSES.balanced, NEUTRAL, { weather: 'clear', onTrack: true }, DT);
    }
    expect(speedOf(coasting)).toBeLessThan(braked);
  });

  it('only steers while the car is moving', () => {
    const parked = stepVehicle(createVehicle(0, 0, 0), CAR_CLASSES.balanced, { ...NEUTRAL, steer: 1 }, { weather: 'clear', onTrack: true }, DT);
    expect(parked.heading).toBe(0);

    let moving = run(120, { ...NEUTRAL, throttle: true });
    const before = moving.heading;
    moving = stepVehicle(moving, CAR_CLASSES.balanced, { ...NEUTRAL, throttle: true, steer: 1 }, { weather: 'clear', onTrack: true }, DT);
    expect(moving.heading).toBeGreaterThan(before);
  });

  it('slides more in the rain than in the dry', () => {
    function corner(weather: 'clear' | 'rain') {
      let vehicle = run(150, { ...NEUTRAL, throttle: true }, { weather });
      const turn: DriveInput = { ...NEUTRAL, throttle: true, steer: 1 };
      for (let step = 0; step < 40; step += 1) {
        vehicle = stepVehicle(vehicle, CAR_CLASSES.balanced, turn, { weather, onTrack: true }, DT);
      }
      return Math.abs(lateralSpeedOf(vehicle, vehicle.heading));
    }

    expect(corner('rain')).toBeGreaterThan(corner('clear'));
  });

  it('charges a drift on the handbrake and pays out a boost on release', () => {
    let vehicle = run(150, { ...NEUTRAL, throttle: true });
    const drift: DriveInput = { ...NEUTRAL, throttle: true, steer: -1, handbrake: true };
    for (let step = 0; step < 60; step += 1) {
      vehicle = stepVehicle(vehicle, CAR_CLASSES.drift, drift, { weather: 'clear', onTrack: true }, DT);
    }
    expect(vehicle.driftCharge).toBeGreaterThan(0.3);

    const released = stepVehicle(vehicle, CAR_CLASSES.drift, { ...NEUTRAL, throttle: true, steer: -1 }, { weather: 'clear', onTrack: true }, DT);
    expect(released.boostTime).toBeGreaterThan(0.5);
    expect(released.driftCharge).toBe(0);
  });

  it('lets a boost exceed the class top speed', () => {
    let vehicle = { ...createVehicle(0, 0, 0), boostTime: 1.4 };
    for (let step = 0; step < 90; step += 1) {
      vehicle = stepVehicle(vehicle, CAR_CLASSES.grip, { ...NEUTRAL, throttle: true }, { weather: 'clear', onTrack: true }, DT);
    }
    expect(speedOf(vehicle)).toBeGreaterThan(CAR_CLASSES.grip.maxSpeed);
  });

  it('limits speed when the car leaves the road', () => {
    const onRoad = run(300, { ...NEUTRAL, throttle: true }, { onTrack: true });
    const offRoad = run(300, { ...NEUTRAL, throttle: true }, { onTrack: false });
    expect(speedOf(offRoad)).toBeLessThan(speedOf(onRoad) * 0.8);
  });

  it('is deterministic for identical inputs', () => {
    const first = run(90, { ...NEUTRAL, throttle: true, steer: 0.4 });
    const second = run(90, { ...NEUTRAL, throttle: true, steer: 0.4 });
    expect(first).toEqual(second);
  });

  it('drives the AI toward a target and brakes for a hairpin', () => {
    const straight = createVehicle(0, 0, 0);
    const ahead = aiDriveInput(straight, { x: 0, z: 60 }, CAR_CLASSES.balanced, 'pro', mulberry32(4));
    expect(ahead.throttle).toBe(true);
    expect(Math.abs(ahead.steer)).toBeLessThan(0.2);

    const fast = { ...createVehicle(0, 0, 0), vx: 0, vz: 40 };
    const sharp = aiDriveInput(fast, { x: 0, z: -12 }, CAR_CLASSES.balanced, 'pro', mulberry32(4));
    expect(sharp.brake || sharp.handbrake).toBe(true);
  });

  it('produces repeatable AI input for the same seed', () => {
    const a = mulberry32(11);
    const b = mulberry32(11);
    const self = { ...createVehicle(10, 10, 0.4), vz: 20 };
    const target = { x: 30, z: 40 };
    const first = aiDriveInput(self, target, CAR_CLASSES.drift, 'rookie', a);
    const second = aiDriveInput(self, target, CAR_CLASSES.drift, 'rookie', b);
    expect(first).toEqual(second);
  });
});
