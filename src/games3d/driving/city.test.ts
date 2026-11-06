import { describe, expect, it } from 'vitest';
import { DRIVE_CHECKPOINT_RADIUS, DRIVE_MISSIONS, DRIVE_SPAWN, ROAD_LINES } from './city';

describe('Neon City Drive routes', () => {
  it.each(DRIVE_MISSIONS)('$name starts outside the spawn gate', (mission) => {
    const first = mission.route[0]!;
    const distance = Math.hypot(first.x - DRIVE_SPAWN.x, first.z - DRIVE_SPAWN.z);

    expect(distance).toBeGreaterThan(DRIVE_CHECKPOINT_RADIUS);
  });

  it.each(DRIVE_MISSIONS)('$name only places gates on road junctions', (mission) => {
    for (const gate of mission.route) {
      expect(ROAD_LINES).toContain(gate.x);
      expect(ROAD_LINES).toContain(gate.z);
    }
  });

  it.each(DRIVE_MISSIONS)('$name has no back-to-back duplicate gates', (mission) => {
    for (let index = 1; index < mission.route.length; index += 1) {
      const previous = mission.route[index - 1]!;
      const gate = mission.route[index]!;
      expect(Math.hypot(gate.x - previous.x, gate.z - previous.z)).toBeGreaterThan(0);
    }
  });
});
