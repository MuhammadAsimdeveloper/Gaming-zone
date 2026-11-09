import { describe, expect, it } from 'vitest';
import {
  VEHICLE_ACCELERATION,
  VEHICLE_MAX_SPEED,
  VEHICLE_RADIUS,
  createVehicle,
  stepVehicle,
} from './vehicle';
import { VELA_DISTRICT } from './world';

const coast = { forward: false, back: false, left: false, right: false, handbrake: false };
const drive = { ...coast, forward: true };

describe('arcade driving', () => {
  it('accelerates, brakes and reverses', () => {
    let car = createVehicle(1160, 1560);
    for (let i = 0; i < 60; i += 1) car = stepVehicle(car, drive, 1 / 60, VELA_DISTRICT);
    expect(car.speed).toBeGreaterThan(100);
    expect(car.speed).toBeLessThanOrEqual(VEHICLE_MAX_SPEED);

    const moving = car.speed;
    car = stepVehicle(car, { ...coast, back: true }, 0.2, VELA_DISTRICT);
    expect(car.speed).toBeLessThan(moving);

    for (let i = 0; i < 120; i += 1) car = stepVehicle(car, { ...coast, back: true }, 1 / 60, VELA_DISTRICT);
    expect(car.speed).toBeLessThan(0);
  });

  it('reaches its top speed only after sustained throttle', () => {
    let car = createVehicle(1160, 1560);
    for (let i = 0; i < 600; i += 1) car = stepVehicle(car, drive, 1 / 60, VELA_DISTRICT);
    expect(car.speed).toBeCloseTo(VEHICLE_MAX_SPEED, 0);
    expect(VEHICLE_ACCELERATION).toBeGreaterThan(0);
  });

  it('steers only when moving', () => {
    const parked = stepVehicle(createVehicle(1160, 1560), { ...coast, left: true }, 0.5, VELA_DISTRICT);
    expect(parked.heading).toBeCloseTo(createVehicle(1160, 1560).heading, 6);

    let moving = createVehicle(1160, 1560);
    for (let i = 0; i < 60; i += 1) moving = stepVehicle(moving, drive, 1 / 60, VELA_DISTRICT);
    const heading = moving.heading;
    moving = stepVehicle(moving, { ...coast, left: true }, 0.5, VELA_DISTRICT);
    expect(moving.heading).toBeLessThan(heading);
  });

  it('handbrakes harder than coasting', () => {
    let coasting = createVehicle(1160, 1560);
    let braking = createVehicle(1160, 1560);
    for (let i = 0; i < 120; i += 1) {
      coasting = stepVehicle(coasting, drive, 1 / 60, VELA_DISTRICT);
      braking = stepVehicle(braking, drive, 1 / 60, VELA_DISTRICT);
    }
    for (let i = 0; i < 30; i += 1) {
      coasting = stepVehicle(coasting, coast, 1 / 60, VELA_DISTRICT);
      braking = stepVehicle(braking, { ...coast, handbrake: true }, 1 / 60, VELA_DISTRICT);
    }
    expect(braking.speed).toBeLessThan(coasting.speed);
  });

  it('stops against a building instead of driving through it', () => {
    const building = VELA_DISTRICT.blocks[0]!.buildings[0]!;
    let car = createVehicle(building.x - 140, building.y + building.height / 2, Math.PI / 2);
    for (let i = 0; i < 120; i += 1) car = stepVehicle(car, drive, 1 / 60, VELA_DISTRICT);
    expect(car.x).toBeLessThanOrEqual(building.x - VEHICLE_RADIUS + 0.001);
    expect(car.speed).toBeLessThan(VEHICLE_MAX_SPEED);
  });
});
