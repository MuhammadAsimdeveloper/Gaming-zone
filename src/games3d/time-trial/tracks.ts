import * as THREE from 'three';
import type { TrackPoint } from '../shared/scenery';
import type { MedalThresholds } from './rules';

export type TimeTrialTrackId = 'rift-loop' | 'glass-cut' | 'terminal-spiral';
export type SurfaceKind = 'asphalt' | 'glass' | 'metal';

export interface SurfaceZone {
  from: number;
  to: number;
  kind: SurfaceKind;
}

export interface TimeTrialTrack {
  id: TimeTrialTrackId;
  name: string;
  tagline: string;
  description: string;
  difficultyLabel: string;
  width: number;
  laps: number;
  points: TrackPoint[];
  checkpoints: number[];
  curbColors: [string, string];
  skyColor: string;
  fogColor: string;
  accent: string;
  minimap: string;
  surfaces: SurfaceZone[];
  medals: MedalThresholds;
  length: number;
}

export const SURFACE_GRIP: Record<SurfaceKind, number> = {
  asphalt: 1,
  glass: 0.82,
  metal: 0.92,
};

export const SURFACE_LABEL: Record<SurfaceKind, string> = {
  asphalt: 'Asphalt',
  glass: 'Glass',
  metal: 'Metal',
};

export const CHECKPOINT_FRACTIONS = [1 / 3, 2 / 3] as const;

interface RawTrack {
  id: TimeTrialTrackId;
  name: string;
  tagline: string;
  description: string;
  difficultyLabel: string;
  width: number;
  laps: number;
  pace: number;
  waypoints: TrackPoint[];
  curbColors: [string, string];
  skyColor: string;
  fogColor: string;
  accent: string;
  surfaces: SurfaceZone[];
}

const RAW_TRACKS: RawTrack[] = [
  {
    id: 'rift-loop',
    name: 'Rift Loop',
    tagline: 'Wide sweepers and a long final straight.',
    description:
      'A flowing harbour circuit that rewards momentum. Keep the wheel smooth through the back section and carry speed onto the pit straight.',
    difficultyLabel: 'Flowing',
    width: 21,
    laps: 2,
    pace: 44,
    curbColors: ['#38e8ff', '#a06bff'],
    skyColor: '#040a1a',
    fogColor: '#071127',
    accent: '#38e8ff',
    surfaces: [{ from: 0, to: 1, kind: 'asphalt' }],
    waypoints: [
      { x: 0, z: -210 },
      { x: 120, z: -250 },
      { x: 250, z: -210 },
      { x: 310, z: -110 },
      { x: 300, z: 0 },
      { x: 240, z: 90 },
      { x: 130, z: 140 },
      { x: 20, z: 160 },
      { x: -100, z: 130 },
      { x: -210, z: 70 },
      { x: -280, z: -30 },
      { x: -260, z: -140 },
      { x: -170, z: -220 },
      { x: -70, z: -240 },
    ],
  },
  {
    id: 'glass-cut',
    name: 'Glass Cut',
    tagline: 'A technical street run over polished glass.',
    description:
      'Tight walls, late apexes and a long glass section that cuts grip by nearly a fifth. Brake earlier than instinct suggests and get the car straight before the exit.',
    difficultyLabel: 'Technical',
    width: 18,
    laps: 2,
    pace: 36,
    curbColors: ['#ffcf5c', '#ff6b9d'],
    skyColor: '#0a0417',
    fogColor: '#160a2a',
    accent: '#ff6b9d',
    surfaces: [
      { from: 0, to: 0.38, kind: 'asphalt' },
      { from: 0.38, to: 0.62, kind: 'glass' },
      { from: 0.62, to: 1, kind: 'asphalt' },
    ],
    waypoints: [
      { x: 0, z: -220 },
      { x: 110, z: -260 },
      { x: 220, z: -230 },
      { x: 280, z: -150 },
      { x: 250, z: -60 },
      { x: 310, z: 30 },
      { x: 270, z: 130 },
      { x: 180, z: 190 },
      { x: 80, z: 160 },
      { x: 20, z: 230 },
      { x: -90, z: 250 },
      { x: -200, z: 200 },
      { x: -270, z: 110 },
      { x: -290, z: 0 },
      { x: -230, z: -110 },
      { x: -290, z: -200 },
      { x: -190, z: -250 },
      { x: -80, z: -240 },
    ],
  },
  {
    id: 'terminal-spiral',
    name: 'Terminal Spiral',
    tagline: 'A long metal ribbon around the dead port.',
    description:
      'The endurance test of the slate. Long metal sections carry huge speed, then the circuit spirals inward for a sequence of tightening corners before the blast back to the line.',
    difficultyLabel: 'Endurance',
    width: 19,
    laps: 2,
    pace: 40,
    curbColors: ['#4ade9d', '#4c8dff'],
    skyColor: '#020714',
    fogColor: '#04101f',
    accent: '#4ade9d',
    surfaces: [
      { from: 0, to: 0.25, kind: 'asphalt' },
      { from: 0.25, to: 0.5, kind: 'metal' },
      { from: 0.5, to: 0.78, kind: 'asphalt' },
      { from: 0.78, to: 1, kind: 'metal' },
    ],
    waypoints: [
      { x: 0, z: -260 },
      { x: 150, z: -300 },
      { x: 300, z: -280 },
      { x: 400, z: -190 },
      { x: 430, z: -70 },
      { x: 390, z: 50 },
      { x: 300, z: 110 },
      { x: 320, z: 200 },
      { x: 250, z: 290 },
      { x: 130, z: 330 },
      { x: -10, z: 310 },
      { x: -140, z: 260 },
      { x: -250, z: 170 },
      { x: -290, z: 50 },
      { x: -250, z: -70 },
      { x: -160, z: -130 },
      { x: -170, z: -220 },
      { x: -260, z: -270 },
      { x: -180, z: -320 },
      { x: -60, z: -300 },
    ],
  },
];

function sampleTrack(waypoints: TrackPoint[]): TrackPoint[] {
  const curve = new THREE.CatmullRomCurve3(
    waypoints.map((point) => new THREE.Vector3(point.x, 0, point.z)),
    true,
    'catmullrom',
    0.6,
  );
  return curve.getSpacedPoints(420).slice(0, 420).map((point) => ({ x: point.x, z: point.z }));
}

function measureLength(points: TrackPoint[]): number {
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return total + Math.hypot(next.x - point.x, next.z - point.z);
  }, 0);
}

function buildMinimap(points: TrackPoint[]): string {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const scale = 100 / Math.max(maxX - minX, maxZ - minZ);
  return points
    .map((point) => {
      const x = (point.x - minX) * scale + 6;
      const z = (point.z - minZ) * scale + 6;
      return `${x.toFixed(1)},${z.toFixed(1)}`;
    })
    .join(' ');
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function medalTargets(length: number, laps: number, pace: number): MedalThresholds {
  const expected = (length / pace + 1.6) * laps;
  return {
    author: roundTenth(expected * 0.78),
    gold: roundTenth(expected * 0.86),
    silver: roundTenth(expected * 0.94),
    bronze: roundTenth(expected * 1.04),
  };
}

export const TIME_TRIAL_TRACKS: TimeTrialTrack[] = RAW_TRACKS.map((track) => {
  const points = sampleTrack(track.waypoints);
  const length = measureLength(points);
  return {
    id: track.id,
    name: track.name,
    tagline: track.tagline,
    description: track.description,
    difficultyLabel: track.difficultyLabel,
    width: track.width,
    laps: track.laps,
    points,
    checkpoints: CHECKPOINT_FRACTIONS.map((fraction) => Math.floor(points.length * fraction)),
    curbColors: track.curbColors,
    skyColor: track.skyColor,
    fogColor: track.fogColor,
    accent: track.accent,
    minimap: buildMinimap(points),
    surfaces: track.surfaces,
    medals: medalTargets(length, track.laps, track.pace),
    length,
  };
});

export function getTimeTrialTrack(id: TimeTrialTrackId): TimeTrialTrack {
  return TIME_TRIAL_TRACKS.find((track) => track.id === id) ?? TIME_TRIAL_TRACKS[0]!;
}

export function surfaceAt(track: TimeTrialTrack, index: number): SurfaceKind {
  const count = track.points.length;
  const fraction = (((index % count) + count) % count) / count;
  const zone = track.surfaces.find((entry) => fraction >= entry.from && fraction < entry.to);
  return zone?.kind ?? 'asphalt';
}
