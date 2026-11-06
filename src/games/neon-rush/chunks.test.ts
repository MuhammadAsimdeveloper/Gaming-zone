import { describe, expect, it } from 'vitest';
import {
  CHUNK_LENGTH,
  FULL_GATE_CLEARANCE,
  SAFE_OPENING_CHUNKS,
  createTrack,
  ensureAhead,
  validateObstacles,
  type Lane,
  type ObstacleKind,
  type WorldObstacle,
} from './chunks';

function obstacle(lane: Lane, kind: ObstacleKind, z: number, length = 1.2): WorldObstacle {
  return { id: Math.round(z * 10) + lane, lane, kind, z, length, hit: false };
}

describe('fairness validator', () => {
  it('rejects three trains in one row', () => {
    const result = validateObstacles([
      obstacle(0, 'train', 10, 6),
      obstacle(1, 'train', 10, 6),
      obstacle(2, 'train', 10, 6),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('triple-train');
  });

  it('rejects rows closer than the minimum gap', () => {
    const result = validateObstacles([obstacle(0, 'barrier', 10), obstacle(1, 'gate', 14)]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('row-gap');
  });

  it('requires a 12 m clearance after a full-width gate', () => {
    const gateRow = [
      obstacle(0, 'gate', 10),
      obstacle(1, 'gate', 10),
      obstacle(2, 'gate', 10),
    ];
    const result = validateObstacles([
      ...gateRow,
      obstacle(0, 'barrier', 10 + FULL_GATE_CLEARANCE - 2),
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('full-gate-clearance');
  });

  it('rejects a gate immediately after a barrier in the same lane', () => {
    const result = validateObstacles([obstacle(0, 'barrier', 10), obstacle(0, 'gate', 13)]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('barrier-gate-adjacent');
  });

  it('accepts a passable staggered field', () => {
    const result = validateObstacles([
      obstacle(0, 'barrier', 10),
      obstacle(1, 'gate', 20),
      obstacle(2, 'barrier', 30),
    ]);
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it('accepts two trains that leave a lane open', () => {
    const result = validateObstacles([
      obstacle(0, 'train', 10, 6),
      obstacle(1, 'train', 10, 6),
    ]);
    expect(result).toEqual({ ok: true, errors: [] });
  });
});

describe('chunk generator', () => {
  it('is deterministic for the same seed', () => {
    const first = createTrack(1234);
    const second = createTrack(1234);
    ensureAhead(first, 1200);
    ensureAhead(second, 1200);
    expect(first.chunks).toEqual(second.chunks);
  });

  it('keeps the opening free of obstacles', () => {
    const track = createTrack(7);
    ensureAhead(track, 600);
    const opening = track.obstacles.filter((entry) => entry.z < SAFE_OPENING_CHUNKS * CHUNK_LENGTH);
    expect(opening).toHaveLength(0);
  });

  it('generates one thousand chunks that all pass validation', () => {
    const track = createTrack(99);
    ensureAhead(track, 1000 * CHUNK_LENGTH);
    expect(track.chunks.length).toBeGreaterThanOrEqual(1000);
    expect(validateObstacles(track.obstacles)).toEqual({ ok: true, errors: [] });
  });

  it('never repeats a chunk index', () => {
    const track = createTrack(5);
    ensureAhead(track, 900);
    const indexes = track.chunks.map((chunk) => chunk.index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('places shards on lanes that are clear at their distance', () => {
    const track = createTrack(11);
    ensureAhead(track, 900);
    for (const shard of track.shards) {
      const blocked = track.obstacles.some(
        (entry) => entry.lane === shard.lane && Math.abs(entry.z - shard.z) < 2,
      );
      expect(blocked).toBe(false);
    }
  });

  it('spawns power-ups occasionally without placing them inside obstacles', () => {
    const track = createTrack(21);
    ensureAhead(track, 1800);
    expect(track.powerups.length).toBeGreaterThan(0);
    for (const powerUp of track.powerups) {
      const blocked = track.obstacles.some(
        (entry) => entry.lane === powerUp.lane && Math.abs(entry.z - powerUp.z) < 2,
      );
      expect(blocked).toBe(false);
    }
  });
});
