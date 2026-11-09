import { describe, expect, it } from 'vitest';
import { DRIVE_CHECKPOINT_RADIUS, DRIVE_MISSIONS, DRIVE_SPAWN } from './city';
import { advanceCheckpoint } from './progress';

const mission = DRIVE_MISSIONS[0]!;

describe('Neon City Drive checkpoint progression', () => {
  it('does not advance while the car sits at spawn', () => {
    let index = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      index = advanceCheckpoint(index, DRIVE_SPAWN, mission.route, DRIVE_CHECKPOINT_RADIUS).index;
    }
    expect(index).toBe(0);
  });

  it('only advances when the car actually reaches the gate', () => {
    const first = mission.route[0]!;
    const halfway = { x: (DRIVE_SPAWN.x + first.x) / 2, z: (DRIVE_SPAWN.z + first.z) / 2 };

    expect(advanceCheckpoint(0, halfway, mission.route, DRIVE_CHECKPOINT_RADIUS).index).toBe(0);

    const reached = advanceCheckpoint(0, first, mission.route, DRIVE_CHECKPOINT_RADIUS);
    expect(reached).toEqual({ index: 1, complete: false });
  });

  it('reports completion after the last gate', () => {
    const last = mission.route.length - 1;
    expect(advanceCheckpoint(last, mission.route[last]!, mission.route, DRIVE_CHECKPOINT_RADIUS)).toEqual({
      index: mission.route.length,
      complete: true,
    });
  });
});
