import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS, PLAYER_SPRINT_SPEED, PLAYER_WALK_SPEED, createPlayer, stepPlayer } from './player';
import { VELA_DISTRICT } from './world';

const walk = { up: true, down: false, left: false, right: false, sprint: false };
const sprint = { ...walk, sprint: true };

describe('on-foot movement', () => {
  it('moves the player toward the pressed direction', () => {
    const start = createPlayer(1220, 1560);
    const next = stepPlayer(start, walk, 1 / 60, VELA_DISTRICT);
    expect(next.x).toBeCloseTo(start.x, 5);
    expect(next.z).toBeLessThan(start.z);
  });

  it('faces the direction of travel', () => {
    let player = createPlayer(1220, 1560);
    for (let i = 0; i < 30; i += 1) player = stepPlayer(player, walk, 1 / 60, VELA_DISTRICT);
    expect(player.heading).toBeCloseTo(0, 3);
  });

  it('sprints faster than it walks', () => {
    let walked = createPlayer(1160, 1500);
    let sprinted = createPlayer(1160, 1500);
    for (let i = 0; i < 120; i += 1) {
      walked = stepPlayer(walked, walk, 1 / 60, VELA_DISTRICT);
      sprinted = stepPlayer(sprinted, sprint, 1 / 60, VELA_DISTRICT);
    }
    expect(walked.speed).toBeCloseTo(PLAYER_WALK_SPEED, 0);
    expect(sprinted.speed).toBeCloseTo(PLAYER_SPRINT_SPEED, 0);
    expect(sprinted.z).toBeLessThan(walked.z);
  });

  it('cannot walk through a building', () => {
    const building = VELA_DISTRICT.blocks[0]!.buildings[0]!;
    const start = createPlayer(building.x - 40, building.y + building.height / 2);
    let player = start;
    for (let i = 0; i < 120; i += 1) {
      player = stepPlayer(
        player,
        { up: false, down: false, left: false, right: true, sprint: true },
        1 / 60,
        VELA_DISTRICT,
      );
    }
    expect(player.x).toBeGreaterThan(start.x);
    expect(player.x).toBeLessThanOrEqual(building.x - PLAYER_RADIUS + 0.001);
  });

  it('stays inside the world bounds', () => {
    let player = createPlayer(PLAYER_RADIUS + 4, PLAYER_RADIUS + 4);
    for (let i = 0; i < 300; i += 1) {
      player = stepPlayer(
        player,
        { up: true, down: false, left: true, right: false, sprint: true },
        1 / 60,
        VELA_DISTRICT,
      );
    }
    expect(player.x).toBeGreaterThanOrEqual(0);
    expect(player.z).toBeGreaterThanOrEqual(0);
  });
});
