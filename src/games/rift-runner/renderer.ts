import {
  RUNNER_GROUND,
  RUNNER_HEIGHT,
  RUNNER_PLAYER_HEIGHT,
  RUNNER_PLAYER_WIDTH,
  RUNNER_PLAYER_X,
  RUNNER_WIDTH,
  type RunnerState,
} from './simulation';

export function drawRunnerScene(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: RunnerState,
): void {
  if (canvas.width !== RUNNER_WIDTH) canvas.width = RUNNER_WIDTH;
  if (canvas.height !== RUNNER_HEIGHT) canvas.height = RUNNER_HEIGHT;

  const width = RUNNER_WIDTH;
  const height = RUNNER_HEIGHT;

  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#050814');
  sky.addColorStop(0.65, '#081a2b');
  sky.addColorStop(1, '#0a241f');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = 'rgba(255,255,255,0.5)';
  for (let index = 0; index < 26; index += 1) {
    const x = (index * 97 + 41) % width;
    const y = (index * 53 + 29) % (RUNNER_GROUND - 60);
    context.globalAlpha = 0.15 + (index % 5) * 0.08;
    context.fillRect(x, y, 2, 2);
  }
  context.globalAlpha = 1;

  context.fillStyle = 'rgba(74,222,157,0.09)';
  for (let x = 0; x < width; x += 48) context.fillRect(x, 0, 1, RUNNER_GROUND);
  for (let y = 0; y < RUNNER_GROUND; y += 48) context.fillRect(0, y, width, 1);

  context.fillStyle = '#0b1a22';
  context.fillRect(0, RUNNER_GROUND, width, height - RUNNER_GROUND);
  context.fillStyle = '#4ade9d';
  context.fillRect(0, RUNNER_GROUND, width, 2);
  context.fillStyle = 'rgba(74,222,157,0.18)';
  for (let x = -((state.distance * 0.8) % 64); x < width; x += 64) {
    context.fillRect(x, RUNNER_GROUND + 18, 34, 3);
  }

  for (const obstacle of state.obstacles) {
    const top = RUNNER_GROUND - obstacle.height;
    context.fillStyle = '#ff6b81';
    context.shadowColor = '#ff6b81';
    context.shadowBlur = 12;
    context.fillRect(obstacle.x, top, obstacle.width, obstacle.height);
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(obstacle.x + 4, top + 4, obstacle.width - 8, 3);
  }

  const playerTop = RUNNER_GROUND - state.y - RUNNER_PLAYER_HEIGHT;
  context.fillStyle = '#4c8dff';
  context.shadowColor = '#4c8dff';
  context.shadowBlur = 18;
  context.beginPath();
  context.roundRect(RUNNER_PLAYER_X, playerTop, RUNNER_PLAYER_WIDTH, RUNNER_PLAYER_HEIGHT, 8);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = '#eaffff';
  context.fillRect(RUNNER_PLAYER_X + 7, playerTop + 9, 14, 5);
  context.fillStyle = '#0b1120';
  context.fillRect(RUNNER_PLAYER_X + 8, playerTop + 29, 4, 8);
  context.fillRect(RUNNER_PLAYER_X + 18, playerTop + 29, 4, 8);
}
