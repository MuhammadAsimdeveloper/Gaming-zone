import type { Difficulty, TrackId } from './tracks';

export type CarId = 'rift-gt' | 'vanta-rs' | 'solaris-x';

export interface VehicleDefinition {
  id: CarId;
  name: string;
  tagline: string;
  description: string;
  color: string;
  accent: string;
  maxSpeed: number;
  acceleration: number;
  braking: number;
  handling: number;
  grip: number;
  unlockWins: number;
}

export const VEHICLES: VehicleDefinition[] = [
  {
    id: 'rift-gt',
    name: 'Rift GT',
    tagline: 'Balanced factory racer',
    description: 'The all-rounder. Predictable grip, strong brakes and enough top end to fight anywhere on the grid.',
    color: '#3b82f6',
    accent: '#38e8ff',
    maxSpeed: 68,
    acceleration: 26,
    braking: 38,
    handling: 1.85,
    grip: 1,
    unlockWins: 0,
  },
  {
    id: 'vanta-rs',
    name: 'Vanta RS',
    tagline: 'Straight-line missile',
    description: 'A twin-turbo prototype with a huge top speed. It rewards clean exits and punishes clumsy steering.',
    color: '#7c3aed',
    accent: '#c084fc',
    maxSpeed: 77,
    acceleration: 24,
    braking: 32,
    handling: 1.55,
    grip: 0.92,
    unlockWins: 1,
  },
  {
    id: 'solaris-x',
    name: 'Solaris X',
    tagline: 'Corner-carving prototype',
    description: 'Lower top speed, ferocious acceleration and telepathic front-end grip. Built for switchbacks.',
    color: '#10b981',
    accent: '#6ee7b7',
    maxSpeed: 63,
    acceleration: 33,
    braking: 42,
    handling: 2.1,
    grip: 1.08,
    unlockWins: 2,
  },
];

export function getVehicle(id: CarId): VehicleDefinition {
  return VEHICLES.find((vehicle) => vehicle.id === id) ?? VEHICLES[0]!;
}

export interface RaceProgress {
  races: number;
  wins: number;
  bestLaps: Partial<Record<TrackId, number>>;
}

const PROGRESS_KEY = 'neonrift:game:neon-apex:progress';

export const emptyProgress: RaceProgress = { races: 0, wins: 0, bestLaps: {} };

export function loadProgress(): RaceProgress {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return emptyProgress;
    const parsed = JSON.parse(raw) as Partial<RaceProgress>;
    return {
      races: typeof parsed.races === 'number' ? parsed.races : 0,
      wins: typeof parsed.wins === 'number' ? parsed.wins : 0,
      bestLaps:
        parsed.bestLaps && typeof parsed.bestLaps === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.bestLaps).filter(
                (entry): entry is [string, number] =>
                  typeof entry[0] === 'string' && typeof entry[1] === 'number',
              ),
            )
          : {},
    };
  } catch {
    return emptyProgress;
  }
}

export function saveProgress(progress: RaceProgress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be blocked; progress simply will not persist.
  }
}

export function difficultyProfile(difficulty: Difficulty): {
  label: string;
  aiSpeed: number;
  aiCorner: number;
  aiReaction: number;
} {
  switch (difficulty) {
    case 'rookie':
      return { label: 'Rookie', aiSpeed: 0.86, aiCorner: 0.82, aiReaction: 0.7 };
    case 'legend':
      return { label: 'Legend', aiSpeed: 1.02, aiCorner: 1.06, aiReaction: 1.25 };
    case 'pro':
    default:
      return { label: 'Pro', aiSpeed: 0.95, aiCorner: 0.95, aiReaction: 1 };
  }
}
