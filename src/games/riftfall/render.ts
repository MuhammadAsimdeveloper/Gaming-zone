import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PARRY_WINDOW_TICKS,
  type EnemyKind,
  type EnemyState,
  type RunState,
} from './simulation';

export interface RiftfallView {
  run: RunState;
  time: number;
}

export interface RiftfallRenderOptions {
  reducedMotion?: boolean;
}

const ENEMY_COLORS: Record<EnemyKind, string> = {
  grunt: '#ff6b8a',
  runner: '#ffb84d',
  brute: '#ff8a5c',
  elite: '#a06bff',
  boss: '#ff3d6e',
};

function polygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, rotation: number): void {
  ctx.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (index / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawGrid(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.fillStyle = '#070d1d';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const pulse = 0.06 + 0.02 * Math.sin(time * 1.6);
  ctx.strokeStyle = `rgba(76, 141, 255, ${pulse.toFixed(3)})`;
  ctx.lineWidth = 1;
  for (let x = 60; x < ARENA_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_HEIGHT);
    ctx.stroke();
  }
  for (let y = 60; y < ARENA_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_WIDTH, y);
    ctx.stroke();
  }

  const glow = ctx.createLinearGradient(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  glow.addColorStop(0, 'rgba(160, 107, 255, 0.1)');
  glow.addColorStop(0.5, 'rgba(76, 141, 255, 0.04)');
  glow.addColorStop(1, 'rgba(67, 240, 201, 0.08)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.strokeStyle = 'rgba(76, 141, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1.5, 1.5);
  ctx.lineTo(ARENA_WIDTH - 1.5, 1.5);
  ctx.lineTo(ARENA_WIDTH - 1.5, ARENA_HEIGHT - 1.5);
  ctx.lineTo(1.5, ARENA_HEIGHT - 1.5);
  ctx.closePath();
  ctx.stroke();
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState, time: number): void {
  const color = ENEMY_COLORS[enemy.kind];

  if (enemy.kind === 'elite') {
    const cycle = enemy.chargeTicks % 180;
    if (cycle >= 120 && cycle < 150) {
      const progress = (cycle - 120) / 30;
      ctx.strokeStyle = `rgba(160, 107, 255, ${(0.65 - progress * 0.4).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 18 + progress * 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;

  if (enemy.kind === 'grunt') polygon(ctx, 4, enemy.radius, Math.PI / 4);
  else if (enemy.kind === 'runner') polygon(ctx, 3, enemy.radius * 1.15, Math.PI / 2);
  else if (enemy.kind === 'brute') polygon(ctx, 6, enemy.radius, 0);
  else if (enemy.kind === 'elite') polygon(ctx, 5, enemy.radius, -Math.PI / 2);
  else polygon(ctx, 8, enemy.radius, Math.PI / 8);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 0.34, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.kind === 'boss') {
    const spin = time * 0.8;
    ctx.strokeStyle = 'rgba(255, 61, 110, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 10, spin, spin + Math.PI * 1.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 18, -spin, -spin + Math.PI * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  if (enemy.stunTicks > 0) {
    ctx.strokeStyle = 'rgba(255, 211, 102, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.health < enemy.maxHealth) {
    const width = enemy.radius * 2;
    const ratio = Math.max(0, enemy.health / enemy.maxHealth);
    ctx.fillStyle = 'rgba(5, 8, 20, 0.7)';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 14, width, 4);
    ctx.fillStyle = ratio > 0.4 ? '#43f0c9' : '#ff6b8a';
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 14, width * ratio, 4);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, run: RunState, reducedMotion: boolean): void {
  const player = run.player;
  const stats = run.weapons[run.weapon];

  ctx.strokeStyle = 'rgba(76, 141, 255, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(player.x, player.y, stats.range, 0, Math.PI * 2);
  ctx.stroke();

  if (player.dashTicks > 0 && !reducedMotion) {
    for (let index = 1; index <= 3; index += 1) {
      ctx.globalAlpha = 0.22 / index;
      ctx.fillStyle = '#4c8dff';
      ctx.beginPath();
      ctx.arc(
        player.x - player.facingX * index * 16,
        player.y - player.facingY * index * 16,
        player.radius * (1 - index * 0.12),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (player.parryTicks > 0) {
    const ratio = player.parryTicks / Math.max(1, run.parryWindow, PARRY_WINDOW_TICKS);
    ctx.strokeStyle = `rgba(255, 211, 102, ${(0.35 + ratio * 0.5).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 12, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
  }

  const body = ctx.createRadialGradient(player.x, player.y, 4, player.x, player.y, player.radius);
  body.addColorStop(0, '#cfe6ff');
  body.addColorStop(0.55, '#4c8dff');
  body.addColorStop(1, '#1b2f66');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(207, 230, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(Math.atan2(player.facingY, player.facingX));
  ctx.beginPath();
  ctx.moveTo(player.radius + 5, 0);
  ctx.lineTo(player.radius - 7, -7);
  ctx.lineTo(player.radius - 7, 7);
  ctx.closePath();
  ctx.fillStyle = '#9fd0ff';
  ctx.fill();
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, run: RunState): void {
  for (const shot of run.projectiles) {
    const color = shot.hostile ? '#ff6b8a' : '#43f0c9';
    ctx.fillStyle = color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function drawRiftfall(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  view: RiftfallView,
  options: RiftfallRenderOptions = {},
): void {
  if (!ctx || canvas.width < 2 || canvas.height < 2) return;
  const reducedMotion = options.reducedMotion ?? false;
  const scale = Math.min(canvas.width / ARENA_WIDTH, canvas.height / ARENA_HEIGHT);
  const offsetX = (canvas.width - ARENA_WIDTH * scale) / 2;
  const offsetY = (canvas.height - ARENA_HEIGHT * scale) / 2;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, '#040713');
  background.addColorStop(1, '#0a1224');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawGrid(ctx, reducedMotion ? 0 : view.time);
  drawProjectiles(ctx, view.run);
  for (const enemy of view.run.enemies) drawEnemy(ctx, enemy, reducedMotion ? 0 : view.time);
  drawPlayer(ctx, view.run, reducedMotion);

  ctx.restore();
}
