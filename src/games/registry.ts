import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { GameComponentProps, InternalGameKey } from '../types/game';

export const gameRegistry: Record<
  InternalGameKey,
  LazyExoticComponent<ComponentType<GameComponentProps>>
> = {
  snake: lazy(() => import('../games/snake/SnakeGame')),
  'tic-tac-toe': lazy(() => import('../games/tic-tac-toe/TicTacToeGame')),
  memory: lazy(() => import('../games/memory/MemoryGame')),
  'rock-paper-scissors': lazy(() => import('../games/rock-paper-scissors/RockPaperScissorsGame')),
  'reaction-time': lazy(() => import('../games/reaction-time/ReactionTimeGame')),
  'brick-breaker': lazy(() => import('../games/brick-breaker/BrickBreakerGame')),
  'math-sprint': lazy(() => import('../games/math-sprint/MathSprintGame')),
  'neon-apex': lazy(() => import('../games3d/racing/NeonApexGame')),
  'rift-striker': lazy(() => import('../games3d/football/RiftStrikerGame')),
  'neon-city-drive': lazy(() => import('../games3d/driving/NeonCityDriveGame')),
};
