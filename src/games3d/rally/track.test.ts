import { describe, expect, it } from 'vitest';
import {
  RALLY_TRACKS,
  createLapProgress,
  getRallyTrack,
  isOnRallyTrack,
  nearestTrackIndex,
  projectToMinimap,
  registerGatePass,
  sampleCircuit,
  trackFrame,
} from './track';

const WAYPOINTS = [
  { x: 0, z: -100 },
  { x: 80, z: -120 },
  { x: 140, z: -60 },
  { x: 120, z: 40 },
  { x: 40, z: 100 },
  { x: -60, z: 80 },
  { x: -130, z: 10 },
  { x: -80, z: -80 },
];

describe('Rift Rally circuits', () => {
  it('builds three long, checkpointed circuits', () => {
    expect(RALLY_TRACKS).toHaveLength(3);
    for (const track of RALLY_TRACKS) {
      expect(track.points).toHaveLength(480);
      expect(track.checkpoints).toHaveLength(6);
      expect(track.length).toBeGreaterThan(500);
      expect(track.width).toBeGreaterThan(10);
    }
  });

  it('samples the same waypoints deterministically for a seed', () => {
    const first = sampleCircuit(WAYPOINTS, 1234);
    const second = sampleCircuit(WAYPOINTS, 1234);
    const other = sampleCircuit(WAYPOINTS, 9876);

    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });

  it('keeps the three circuits geometrically distinct', () => {
    const [coastal, interchange, market] = RALLY_TRACKS;
    expect(coastal!.points[60]).not.toEqual(interchange!.points[60]);
    expect(interchange!.points[60]).not.toEqual(market!.points[60]);
    expect(coastal!.width).not.toBe(market!.width);
  });

  it('spaces checkpoints evenly with the start line first', () => {
    for (const track of RALLY_TRACKS) {
      expect(track.checkpoints[0]).toBe(0);
      for (let index = 1; index < track.checkpoints.length; index += 1) {
        expect(track.checkpoints[index]! - track.checkpoints[index - 1]!).toBe(80);
      }
    }
  });

  it('finds the nearest sample with and without a hint', () => {
    const track = getRallyTrack('coastal-ring');
    const target = track.points[217]!;

    expect(nearestTrackIndex(track.points, target.x, target.z)).toBe(217);
    expect(nearestTrackIndex(track.points, target.x, target.z, 210)).toBe(217);
  });

  it('detects when a car leaves the road', () => {
    const track = getRallyTrack('interchange');
    const index = 150;
    const frame = trackFrame(track.points, index);
    const onRoad = track.points[index]!;
    const farOff = {
      x: onRoad.x + frame.normal.x * (track.width / 2 + 8),
      z: onRoad.z + frame.normal.z * (track.width / 2 + 8),
    };

    expect(isOnRallyTrack(track, onRoad.x, onRoad.z, index)).toBe(true);
    expect(isOnRallyTrack(track, farOff.x, farOff.z, index)).toBe(false);
  });

  it('rejects gates taken out of order', () => {
    const track = getRallyTrack('night-market');
    const progress = createLapProgress(track.checkpoints.length);
    const skipped = registerGatePass(track, progress, track.checkpoints[2]!, 5);

    expect(skipped).toEqual(progress);
  });

  it('advances gates in order and records split times', () => {
    const track = getRallyTrack('coastal-ring');
    let progress = createLapProgress(track.checkpoints.length);

    progress = registerGatePass(track, progress, track.checkpoints[1]!, 10);
    expect(progress.nextGate).toBe(2);
    expect(progress.splits).toEqual([10]);

    progress = registerGatePass(track, progress, track.checkpoints[2]!, 18);
    expect(progress.nextGate).toBe(3);
    expect(progress.splits).toEqual([10, 18]);
  });

  it('counts a lap only after every gate and the start line', () => {
    const track = getRallyTrack('coastal-ring');
    let progress = createLapProgress(track.checkpoints.length);

    for (let gate = 1; gate < track.checkpoints.length; gate += 1) {
      progress = registerGatePass(track, progress, track.checkpoints[gate]!, gate * 10);
    }
    expect(progress.lap).toBe(1);
    expect(progress.nextGate).toBe(0);

    progress = registerGatePass(track, progress, track.checkpoints[0]!, 66);
    expect(progress.lap).toBe(2);
    expect(progress.nextGate).toBe(1);
    expect(progress.splits).toEqual([66]);
  });

  it('projects world positions inside the minimap box', () => {
    const track = getRallyTrack('interchange');
    for (const point of track.points) {
      const projected = projectToMinimap(track, point.x, point.z);
      expect(projected.x).toBeGreaterThanOrEqual(5.9);
      expect(projected.x).toBeLessThanOrEqual(94.1);
      expect(projected.y).toBeGreaterThanOrEqual(5.9);
      expect(projected.y).toBeLessThanOrEqual(94.1);
    }
  });
});
