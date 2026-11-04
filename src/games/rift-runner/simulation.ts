export const RUNNER_WIDTH = 720;
export const RUNNER_HEIGHT = 320;
export const RUNNER_GROUND = 268;
export const RUNNER_PLAYER_X = 92;
export const RUNNER_PLAYER_WIDTH = 30;
export const RUNNER_PLAYER_HEIGHT = 42;
export const RUNNER_GRAVITY = 1500;
export const RUNNER_JUMP = 540;

export interface RunnerObstacle {
  x: number;
  width: number;
  height: number;
}

export interface RunnerState {
  y: number;
  vy: number;
  speed: number;
  distance: number;
  obstacles: RunnerObstacle[];
  passed: number;
  score: number;
  alive: boolean;
  spawnCount: number;
  nextSpawn: number;
}

export function createRunnerState(): RunnerState {
  return {
    y: 0,
    vy: 0,
    speed: 280,
    distance: 0,
    obstacles: [],
    passed: 0,
    score: 0,
    alive: true,
    spawnCount: 0,
    nextSpawn: 1.1,
  };
}

export function runnerJump(state: RunnerState): RunnerState {
  if (!state.alive || state.y > 0.5 || state.vy > 0) return state;
  return { ...state, vy: RUNNER_JUMP };
}

export function runnerStep(state: RunnerState, delta: number): RunnerState {
  if (!state.alive) return state;
  const dt = Math.min(0.05, Math.max(0, delta));
  if (dt === 0) return state;

  let vy = state.vy - RUNNER_GRAVITY * dt;
  let y = state.y + vy * dt;
  if (y <= 0) {
    y = 0;
    vy = 0;
  }

  const speed = Math.min(520, 280 + state.distance * 0.015);
  const distance = state.distance + speed * dt;

  let passed = state.passed;
  const obstacles: RunnerObstacle[] = [];
  for (const obstacle of state.obstacles) {
    const x = obstacle.x - speed * dt;
    if (x + obstacle.width < 0) continue;
    if (x + obstacle.width < RUNNER_PLAYER_X && obstacle.x + obstacle.width >= RUNNER_PLAYER_X) {
      passed += 1;
    }
    obstacles.push({ ...obstacle, x });
  }

  let spawnCount = state.spawnCount;
  let nextSpawn = state.nextSpawn - dt;
  if (nextSpawn <= 0) {
    spawnCount += 1;
    const tall = spawnCount % 3 === 0;
    obstacles.push({
      x: RUNNER_WIDTH + 20,
      width: tall ? 30 : 26,
      height: tall ? 62 : 40,
    });
    nextSpawn = Math.max(0.85, 1.5 - distance / 5000);
  }

  const playerLeft = RUNNER_PLAYER_X;
  const playerRight = RUNNER_PLAYER_X + RUNNER_PLAYER_WIDTH;
  const hit = obstacles.some(
    (obstacle) =>
      obstacle.x < playerRight &&
      obstacle.x + obstacle.width > playerLeft &&
      y < obstacle.height,
  );

  return {
    ...state,
    y,
    vy,
    speed,
    distance,
    obstacles,
    passed,
    score: Math.floor(distance / 10) + passed * 10,
    alive: !hit,
    spawnCount,
    nextSpawn,
  };
}
