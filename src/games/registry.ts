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
  'neon-harvest': lazy(() => import('../games/neon-harvest/NeonHarvestGame')),
  'rift-transit': lazy(() => import('../games/rift-transit/RiftTransitGame')),
  'grid-supply': lazy(() => import('../games/grid-supply/GridSupplyGame')),
  'rift-colony': lazy(() => import('../games/rift-colony/RiftColonyGame')),
  'orbit-market': lazy(() => import('../games/orbit-market/OrbitMarketGame')),
  'neon-diner': lazy(() => import('../games/neon-diner/NeonDinerGame')),
  skyport: lazy(() => import('../games/skyport/SkyportGame')),
  'rift-hospital': lazy(() => import('../games/rift-hospital/RiftHospitalGame')),
  'park-pulse': lazy(() => import('../games/park-pulse/ParkPulseGame')),
  'factory-line': lazy(() => import('../games/factory-line/FactoryLineGame')),
  'cargo-ring': lazy(() => import('../games/cargo-ring/CargoRingGame')),
  'aqua-grid': lazy(() => import('../games/aqua-grid/AquaGridGame')),
  'signal-stack': lazy(() => import('../games/signal-stack/SignalStackGame')),
  'rift-runner': lazy(() => import('../games/rift-runner/RiftRunnerGame')),
  'rift-tactics': lazy(() => import('../games/rift-tactics/RiftTacticsGame')),
  'rift-chess': lazy(() => import('../games/rift-chess/RiftChessGame')),
  'neon-rush': lazy(() => import('../games/neon-rush/NeonRushGame')),
  'penalty-protocol': lazy(() => import('../games/sports/penalty/PenaltyProtocolGame')),
  'hoop-circuit': lazy(() => import('../games/sports/hoop/HoopCircuitGame')),
  'lawn-protocol': lazy(() => import('../games/lawn-protocol/LawnProtocolGame')),
  'apex-time-trial': lazy(() => import('../games3d/time-trial/ApexTimeTrialGame')),
  'street-cricket': lazy(() => import('../games3d/street-cricket/StreetCricketGame')),
  'neon-craft': lazy(() => import('../games3d/craft/NeonCraftGame')),
  'rift-rally': lazy(() => import('../games3d/rally/RiftRallyGame')),
  'neon-duel': lazy(() => import('../games/neon-duel/NeonDuelGame')),
};
