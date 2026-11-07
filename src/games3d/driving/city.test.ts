import { describe, expect, it } from 'vitest';
import { DRIVE_MISSIONS, DRIVE_SPAWN } from './city';

describe('Neon City Drive mission routes', () => {
  it('does not place the first First Light checkpoint underneath the starting car', () => {
    const firstCheckpoint = DRIVE_MISSIONS.find((mission) => mission.id === 'first-light')?.route[0];

    expect(firstCheckpoint).toBeDefined();
    expect(Math.hypot(firstCheckpoint!.x - DRIVE_SPAWN.x, firstCheckpoint!.z - DRIVE_SPAWN.z)).toBeGreaterThan(10);
  });
});
