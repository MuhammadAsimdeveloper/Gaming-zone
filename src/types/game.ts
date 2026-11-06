export const CATEGORY_IDS = [
  'arcade',
  'racing',
  'puzzle',
  'adventure',
  'sports',
  'strategy',
  'simulation',
  'action',
  'casual',
  'multiplayer',
  'educational',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export const INTERNAL_GAME_KEYS = [
  'snake',
  'tic-tac-toe',
  'memory',
  'rock-paper-scissors',
  'reaction-time',
  'brick-breaker',
  'math-sprint',
  'neon-apex',
  'rift-striker',
  'neon-city-drive',
  'neon-harvest',
  'rift-transit',
  'grid-supply',
  'rift-colony',
  'orbit-market',
  'neon-diner',
  'skyport',
  'rift-hospital',
  'park-pulse',
  'factory-line',
  'cargo-ring',
  'aqua-grid',
  'signal-stack',
  'rift-runner',
  'rift-tactics',
  'rift-chess',
] as const;

export type InternalGameKey = (typeof INTERNAL_GAME_KEYS)[number];

export type GameType = 'internal' | 'external';

export interface GameControl {
  label: string;
  keys: string;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: CategoryId;
  secondaryCategories?: CategoryId[];
  thumbnail: string;
  accent: string;
  type: GameType;
  internalKey?: InternalGameKey;
  externalUrl?: string;
  allowedOrigins?: string[];
  instructions: string[];
  controls: GameControl[];
  published: boolean;
  createdAt: string;
  featured: boolean;
  popularityRank: number;
}

export interface PlayEvent {
  score?: number;
  outcome?: 'win' | 'loss' | 'draw' | 'complete';
}

export interface GameComponentProps {
  onStart?: () => void;
  onComplete?: (event: PlayEvent) => void;
}
