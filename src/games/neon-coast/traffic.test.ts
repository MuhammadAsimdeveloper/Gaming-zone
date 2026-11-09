import { describe, expect, it } from 'vitest';
import { seededRandom } from './random';
import {
  createPedestrians,
  createTraffic,
  stepPedestrians,
  stepTraffic,
} from './traffic';
import { isOnRoad } from './world';

describe('district traffic', () => {
  it('creates six deterministic cars from the same seed', () => {
    const cars = createTraffic(7);
    expect(cars).toHaveLength(6);
    expect(cars).toEqual(createTraffic(7));
    expect(cars).not.toEqual(createTraffic(8));
  });

  it('keeps traffic circulating on the road grid', () => {
    let cars = createTraffic(3);
    const start = cars.map((car) => ({ ...car.position }));
    for (let i = 0; i < 600; i += 1) cars = stepTraffic(cars, 1 / 60, null);
    expect(cars.some((car, index) => car.position.x !== start[index]!.x || car.position.y !== start[index]!.y)).toBe(true);
    for (const car of cars) {
      expect(car.routeIndex).toBeGreaterThanOrEqual(0);
      expect(isOnRoad(car.position.x, car.position.y)).toBe(true);
    }
  });

  it('brakes for a walker standing in its path', () => {
    const car = createTraffic(5)[0]!;
    const ahead = {
      x: car.position.x + Math.sin(car.heading) * 60,
      y: car.position.y - Math.cos(car.heading) * 60,
    };
    const clear = stepTraffic([car], 1 / 30, null)[0]!;
    const blocked = stepTraffic([car], 1 / 30, ahead)[0]!;
    const clearDistance = Math.hypot(clear.position.x - car.position.x, clear.position.y - car.position.y);
    const blockedDistance = Math.hypot(blocked.position.x - car.position.x, blocked.position.y - car.position.y);
    expect(blockedDistance).toBeLessThan(clearDistance);
  });
});

describe('pedestrian state machine', () => {
  it('creates deterministic walkers from the same seed', () => {
    expect(createPedestrians(11)).toEqual(createPedestrians(11));
    expect(createPedestrians(11)).not.toEqual(createPedestrians(12));
  });

  it('pauses, walks and turns deterministically', () => {
    const first = stepPedestrians(createPedestrians(11), 1 / 60, seededRandom(11));
    const second = stepPedestrians(createPedestrians(11), 1 / 60, seededRandom(11));
    expect(first).toEqual(second);
    expect(new Set(first.map((ped) => ped.mood)).size).toBeGreaterThan(1);
  });

  it('cycles through all three moods over time', () => {
    const rng = seededRandom(11);
    let peds = createPedestrians(11);
    const seen = new Set(peds.map((ped) => ped.mood));
    for (let i = 0; i < 1200; i += 1) {
      peds = stepPedestrians(peds, 1 / 60, rng);
      if (i % 10 === 0) for (const ped of peds) seen.add(ped.mood);
    }
    expect(seen.has('walking')).toBe(true);
    expect(seen.has('pausing')).toBe(true);
    expect(seen.has('turning')).toBe(true);
  });
});
