import { describe, expect, it } from 'vitest';
import {
  ROAD_HALF_WIDTH,
  ROAD_HORIZONTAL,
  ROAD_VERTICAL,
  SOLARA_LANDMARKS,
  VELA_DISTRICT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  collideCircle,
  isOnRoad,
  landmarkAt,
} from './world';

describe('Vela District', () => {
  it('exposes eight original landmarks inside the world bounds', () => {
    expect(SOLARA_LANDMARKS).toHaveLength(8);
    for (const landmark of SOLARA_LANDMARKS) {
      expect(landmark.x).toBeGreaterThan(0);
      expect(landmark.x).toBeLessThan(WORLD_WIDTH);
      expect(landmark.y).toBeGreaterThan(0);
      expect(landmark.y).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it('keeps spawn points on walkable ground', () => {
    expect(isOnRoad(VELA_DISTRICT.spawn.x, VELA_DISTRICT.spawn.y)).toBe(true);
    expect(isOnRoad(VELA_DISTRICT.carSpawn.x, VELA_DISTRICT.carSpawn.y)).toBe(true);
  });

  it('keeps every landmark out of a building', () => {
    for (const landmark of SOLARA_LANDMARKS) {
      for (const block of VELA_DISTRICT.blocks) {
        for (const building of block.buildings) {
          const inside =
            landmark.x >= building.x &&
            landmark.x <= building.x + building.width &&
            landmark.y >= building.y &&
            landmark.y <= building.y + building.height;
          expect(inside, `${landmark.id} is inside a building`).toBe(false);
        }
      }
    }
  });

  it('gives every block at least two buildings clear of the road surface', () => {
    expect(VELA_DISTRICT.blocks.length).toBeGreaterThanOrEqual(8);
    for (const block of VELA_DISTRICT.blocks) {
      expect(block.buildings.length).toBeGreaterThanOrEqual(2);
      for (const building of block.buildings) {
        expect(isOnRoad(building.x, building.y)).toBe(false);
        expect(isOnRoad(building.x + building.width, building.y + building.height)).toBe(false);
      }
    }
  });

  it('pushes a circle out of a building', () => {
    const building = [{ x: 0, y: 0, width: 100, height: 100 }];
    const resolved = collideCircle(building, 50, 50, 20);
    expect(resolved.hit).toBe(true);
    expect(Math.hypot(resolved.x - 50, resolved.z - 50)).toBeGreaterThan(1);
  });

  it('leaves a circle clear of the buildings untouched', () => {
    const building = [{ x: 0, y: 0, width: 100, height: 100 }];
    const resolved = collideCircle(building, 300, 300, 20);
    expect(resolved).toEqual({ x: 300, z: 300, hit: false });
  });

  it('finds the nearest landmark inside its radius', () => {
    const market = SOLARA_LANDMARKS.find((landmark) => landmark.id === 'tideglass-market')!;
    expect(landmarkAt(market.x + 4, market.y + 4, 60)?.id).toBe('tideglass-market');
    expect(landmarkAt(market.x + 400, market.y + 400, 60)).toBeNull();
  });

  it('matches the approved road grid', () => {
    expect(ROAD_HALF_WIDTH).toBe(70);
    expect(ROAD_VERTICAL).toEqual([260, 860, 1460, 2060]);
    expect(ROAD_HORIZONTAL).toEqual([260, 760, 1260, 1760]);
  });
});
