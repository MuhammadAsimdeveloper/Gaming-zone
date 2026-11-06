import { describe, expect, it } from 'vitest';
import {
  CHECKPOINT_FRACTIONS,
  SURFACE_GRIP,
  TIME_TRIAL_TRACKS,
  getTimeTrialTrack,
  medalTargets,
  surfaceAt,
  type SurfaceKind,
} from './tracks';

function segmentsCross(
  a: { x: number; z: number },
  b: { x: number; z: number },
  c: { x: number; z: number },
  d: { x: number; z: number },
): boolean {
  function orientation(p: typeof a, q: typeof b, r: typeof a): number {
    const value = (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z);
    if (Math.abs(value) < 1e-9) return 0;
    return value > 0 ? 1 : 2;
  }
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

describe('time trial track content', () => {
  it('ships three original tracks with sampled geometry', () => {
    expect(TIME_TRIAL_TRACKS.map((track) => track.id)).toEqual([
      'rift-loop',
      'glass-cut',
      'terminal-spiral',
    ]);
    for (const track of TIME_TRIAL_TRACKS) {
      expect(track.points).toHaveLength(420);
      expect(track.length).toBeGreaterThan(900);
      expect(track.length).toBeLessThan(3200);
      expect(track.laps).toBe(2);
      expect(track.minimap.split(' ')).toHaveLength(420);
    }
    expect(getTimeTrialTrack('glass-cut').name).toBe('Glass Cut');
  });

  it('lays checkpoints in order across the lap', () => {
    for (const track of TIME_TRIAL_TRACKS) {
      expect(track.checkpoints).toHaveLength(CHECKPOINT_FRACTIONS.length);
      expect(track.checkpoints[0]).toBeGreaterThan(0);
      expect(track.checkpoints[0]).toBeLessThan(track.checkpoints[1]!);
      expect(track.checkpoints[1]).toBeLessThan(track.points.length);
    }
  });

  it('covers the whole lap with contiguous surface zones', () => {
    for (const track of TIME_TRIAL_TRACKS) {
      expect(track.surfaces[0]?.from).toBe(0);
      expect(track.surfaces.at(-1)?.to).toBe(1);
      for (let index = 1; index < track.surfaces.length; index += 1) {
        expect(track.surfaces[index]!.from).toBe(track.surfaces[index - 1]!.to);
      }
      const kinds = new Set<SurfaceKind>(track.surfaces.map((zone) => zone.kind));
      for (const kind of kinds) expect(SURFACE_GRIP[kind]).toBeGreaterThan(0.7);
    }
    expect(surfaceAt(getTimeTrialTrack('rift-loop'), 0)).toBe('asphalt');
    const glass = getTimeTrialTrack('glass-cut');
    expect(surfaceAt(glass, Math.floor(glass.points.length * 0.5))).toBe('glass');
    const spiral = getTimeTrialTrack('terminal-spiral');
    expect(surfaceAt(spiral, Math.floor(spiral.points.length * 0.3))).toBe('metal');
  });

  it('orders medal targets from author to bronze', () => {
    for (const track of TIME_TRIAL_TRACKS) {
      const { author, gold, silver, bronze } = track.medals;
      expect(author).toBeGreaterThan(10);
      expect(author).toBeLessThan(gold);
      expect(gold).toBeLessThan(silver);
      expect(silver).toBeLessThan(bronze);
      expect(bronze).toBeLessThan(track.length / 12);
    }
    const slow = medalTargets(1000, 2, 30);
    const fast = medalTargets(1000, 2, 50);
    expect(slow.bronze).toBeGreaterThan(fast.bronze);
  });

  it('does not cross its own ribbon', () => {
    for (const track of TIME_TRIAL_TRACKS) {
      const points = track.points;
      const count = points.length;
      let crossings = 0;
      for (let i = 0; i < count; i += 1) {
        const a = points[i]!;
        const b = points[(i + 1) % count]!;
        for (let j = i + 1; j < count; j += 1) {
          const wrapped = j === count - 1 && i === 0;
          if (j - i < 8 || wrapped) continue;
          const c = points[j]!;
          const d = points[(j + 1) % count]!;
          if (segmentsCross(a, b, c, d)) crossings += 1;
        }
      }
      expect(crossings, `${track.name} crossings`).toBe(0);
    }
  });
});
