import * as THREE from 'three';
import type { TrackPoint } from '../shared/scenery';

export type TrackId = 'harbor-loop' | 'downtown-switchback' | 'orbital-ring';
export type Difficulty = 'rookie' | 'pro' | 'legend';
export type CameraMode = 'chase' | 'far' | 'hood';

export interface TrackDefinition {
  id: TrackId;
  name: string;
  tagline: string;
  description: string;
  difficultyLabel: string;
  points: TrackPoint[];
  width: number;
  curbColors: [string, string];
  skyColor: string;
  fogColor: string;
  accent: string;
  minimap: string;
  unlocksAfterWins: number;
}

interface RawTrack {
  id: TrackId;
  name: string;
  tagline: string;
  description: string;
  difficultyLabel: string;
  waypoints: TrackPoint[];
  width: number;
  curbColors: [string, string];
  skyColor: string;
  fogColor: string;
  accent: string;
  unlocksAfterWins: number;
}

const RAW_TRACKS: RawTrack[] = [
  {
    id: 'harbor-loop',
    name: 'Harbor Loop',
    tagline: 'Wide sweepers, salt air and neon cranes.',
    description: 'A fast, flowing circuit along a futuristic harbor. Long straights reward top speed; two hairpins punish late braking.',
    difficultyLabel: 'Rookie friendly',
    width: 20,
    curbColors: ['#38e8ff', '#a06bff'],
    skyColor: '#040a1a',
    fogColor: '#071127',
    accent: '#38e8ff',
    unlocksAfterWins: 0,
    waypoints: [
      { x: 0, z: -90 },
      { x: 70, z: -112 },
      { x: 138, z: -86 },
      { x: 172, z: -28 },
      { x: 156, z: 42 },
      { x: 96, z: 78 },
      { x: 30, z: 92 },
      { x: -42, z: 82 },
      { x: -104, z: 52 },
      { x: -138, z: -8 },
      { x: -116, z: -72 },
      { x: -62, z: -104 },
    ],
  },
  {
    id: 'downtown-switchback',
    name: 'Downtown Switchback',
    tagline: 'Tight corners between glass towers.',
    description: 'A technical street circuit through a dense city block. Brake early, get on the power early, and keep the barriers out of your paint.',
    difficultyLabel: 'Technical',
    width: 17,
    curbColors: ['#ffcf5c', '#ff6b9d'],
    skyColor: '#0a0417',
    fogColor: '#160a2a',
    accent: '#ff6b9d',
    unlocksAfterWins: 1,
    waypoints: [
      { x: 0, z: -96 },
      { x: 58, z: -124 },
      { x: 118, z: -110 },
      { x: 146, z: -62 },
      { x: 122, z: -24 },
      { x: 154, z: 26 },
      { x: 112, z: 78 },
      { x: 48, z: 96 },
      { x: -16, z: 124 },
      { x: -82, z: 104 },
      { x: -112, z: 54 },
      { x: -88, z: 4 },
      { x: -144, z: -38 },
      { x: -124, z: -92 },
      { x: -62, z: -122 },
    ],
  },
  {
    id: 'orbital-ring',
    name: 'Orbital Ring',
    tagline: 'A halo of light around the city.',
    description: 'The longest circuit in the game. Huge commitment corners, a high-speed chicane and a final flat-out blast to the line.',
    difficultyLabel: 'Expert',
    width: 19,
    curbColors: ['#4ade9d', '#4c8dff'],
    skyColor: '#020714',
    fogColor: '#04101f',
    accent: '#4ade9d',
    unlocksAfterWins: 2,
    waypoints: [
      { x: 0, z: -150 },
      { x: 88, z: -160 },
      { x: 158, z: -116 },
      { x: 188, z: -44 },
      { x: 168, z: 30 },
      { x: 106, z: 62 },
      { x: 64, z: 112 },
      { x: 0, z: 146 },
      { x: -74, z: 136 },
      { x: -136, z: 94 },
      { x: -176, z: 22 },
      { x: -162, z: -62 },
      { x: -102, z: -116 },
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

export const TRACKS: TrackDefinition[] = RAW_TRACKS.map((track) => {
  const points = sampleTrack(track.waypoints);
  return {
    id: track.id,
    name: track.name,
    tagline: track.tagline,
    description: track.description,
    difficultyLabel: track.difficultyLabel,
    points,
    width: track.width,
    curbColors: track.curbColors,
    skyColor: track.skyColor,
    fogColor: track.fogColor,
    accent: track.accent,
    unlocksAfterWins: track.unlocksAfterWins,
    minimap: buildMinimap(points),
  };
});

export function getTrack(id: TrackId): TrackDefinition {
  return TRACKS.find((track) => track.id === id) ?? TRACKS[0]!;
}

export interface TrackFrame {
  point: TrackPoint;
  tangent: TrackPoint;
  normal: TrackPoint;
  index: number;
}

export function trackFrame(points: TrackPoint[], index: number): TrackFrame {
  const count = points.length;
  const wrapped = ((index % count) + count) % count;
  const point = points[wrapped]!;
  const next = points[(wrapped + 1) % count]!;
  const previous = points[(wrapped - 1 + count) % count]!;
  const tx = next.x - previous.x;
  const tz = next.z - previous.z;
  const magnitude = Math.hypot(tx, tz) || 1;
  return {
    point,
    tangent: { x: tx / magnitude, z: tz / magnitude },
    normal: { x: -tz / magnitude, z: tx / magnitude },
    index: wrapped,
  };
}

export function findNearestIndex(points: TrackPoint[], x: number, z: number, hint?: number): number {
  const count = points.length;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  if (hint !== undefined) {
    const window = 26;
    for (let offset = -window; offset <= window; offset += 1) {
      const index = ((hint + offset) % count + count) % count;
      const point = points[index]!;
      const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (Number.isFinite(bestDistance)) return bestIndex;
  }

  for (let index = 0; index < count; index += 1) {
    const point = points[index]!;
    const distance = (point.x - x) ** 2 + (point.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function isOnTrack(points: TrackPoint[], width: number, x: number, z: number, index: number): boolean {
  const frame = trackFrame(points, index);
  const dx = x - frame.point.x;
  const dz = z - frame.point.z;
  const lateral = Math.abs(dx * frame.normal.x + dz * frame.normal.z);
  return lateral <= width / 2 + 0.6;
}
