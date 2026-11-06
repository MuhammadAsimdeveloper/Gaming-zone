import { COLS, LANES, type ThemeId } from './content';
import type { EnemyState, LawnState, PlantedModule } from './simulation';

export const PLAYFIELD = { left: 0.06, top: 0.05, width: 0.92, height: 0.9 } as const;

interface ThemePalette {
  skyTop: string;
  skyBottom: string;
  glow: string;
  grid: string;
  line: string;
  core: string;
  accent: string;
  enemy: string;
  enemyDark: string;
}

const THEMES: Record<ThemeId, ThemePalette> = {
  solar: {
    skyTop: '#071022',
    skyBottom: '#22384a',
    glow: 'rgba(244, 201, 93, 0.22)',
    grid: '#20382f',
    line: 'rgba(140, 230, 180, 0.12)',
    core: '#7ef0b2',
    accent: '#f4c95d',
    enemy: '#c2653c',
    enemyDark: '#6d3521',
  },
  copper: {
    skyTop: '#0a1216',
    skyBottom: '#38241f',
    glow: 'rgba(232, 137, 74, 0.2)',
    grid: '#2a2f2a',
    line: 'rgba(226, 170, 130, 0.12)',
    core: '#f2b880',
    accent: '#e8894a',
    enemy: '#b95d45',
    enemyDark: '#5c2d22',
  },
  glass: {
    skyTop: '#080d20',
    skyBottom: '#2a2048',
    glow: 'rgba(142, 240, 255, 0.18)',
    grid: '#21353e',
    line: 'rgba(150, 220, 240, 0.13)',
    core: '#8ef0ff',
    accent: '#c792ff',
    enemy: '#c75a6a',
    enemyDark: '#622b3c',
  },
};

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, palette: ThemePalette): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.skyTop);
  sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.78, height * 0.12, 0, width * 0.78, height * 0.12, width * 0.5);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  const blocks = [0.03, 0.09, 0.05, 0.13, 0.07, 0.11, 0.04, 0.1, 0.06];
  blocks.forEach((heightFraction, index) => {
    const blockWidth = width / blocks.length;
    const blockHeight = height * heightFraction * 3;
    ctx.fillRect(index * blockWidth, height * 0.92 - blockHeight, blockWidth * 0.86, blockHeight);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let row = 0; row < 3; row += 1) {
      ctx.fillRect(index * blockWidth + blockWidth * 0.18, height * 0.92 - blockHeight + 10 + row * 14, blockWidth * 0.16, 4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
  });
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  field: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
): void {
  const cellW = field.w / COLS;
  const cellH = field.h / LANES;
  for (let lane = 0; lane < LANES; lane += 1) {
    for (let col = 0; col < COLS; col += 1) {
      ctx.fillStyle = (lane + col) % 2 === 0 ? palette.grid : 'rgba(10, 24, 20, 0.82)';
      ctx.fillRect(field.x + col * cellW, field.y + lane * cellH, cellW, cellH);
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(field.x + col * cellW) + 0.5,
        Math.round(field.y + lane * cellH) + 0.5,
        Math.round(cellW),
        Math.round(cellH),
      );
    }
  }
}

function drawCore(
  ctx: CanvasRenderingContext2D,
  state: LawnState,
  field: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
): void {
  const cellH = field.h / LANES;
  const pulse = 0.65 + Math.sin(state.time * 2.4) * 0.2;

  ctx.save();
  ctx.shadowColor = palette.core;
  ctx.shadowBlur = 14;
  ctx.fillStyle = palette.core;
  ctx.globalAlpha = pulse;
  ctx.fillRect(field.x - 5, field.y, 4, field.h);
  ctx.restore();

  for (let lane = 0; lane < LANES; lane += 1) {
    const y = field.y + (lane + 0.5) * cellH;
    ctx.beginPath();
    if (state.purges[lane]) {
      ctx.fillStyle = palette.core;
      ctx.moveTo(field.x - 12, y - 6);
      ctx.lineTo(field.x - 4, y);
      ctx.lineTo(field.x - 12, y + 6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      ctx.moveTo(field.x - 11, y - 4);
      ctx.lineTo(field.x - 5, y + 4);
      ctx.moveTo(field.x - 5, y - 4);
      ctx.lineTo(field.x - 11, y + 4);
      ctx.stroke();
    }
  }
}

function drawModule(
  ctx: CanvasRenderingContext2D,
  module: PlantedModule,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
  time: number,
): void {
  const scale = Math.min(cellW, cellH) * 0.52;
  const sway = Math.sin(time * 1.8 + module.id) * 0.06;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sway);

  switch (module.moduleId) {
    case 'photofern': {
      ctx.fillStyle = '#3f7a3a';
      for (let petal = 0; petal < 6; petal += 1) {
        ctx.save();
        ctx.rotate((petal / 6) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(scale * 0.5, 0, scale * 0.42, scale * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#f4d35e';
      ctx.shadowColor = '#f4d35e';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'needle-pod': {
      ctx.fillStyle = '#2b5d3a';
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8fe0a8';
      ctx.fillRect(scale * 0.2, -scale * 0.16, scale * 0.75, scale * 0.32);
      ctx.fillStyle = '#d9ffe6';
      ctx.beginPath();
      ctx.arc(scale * 0.18, 0, scale * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'burst-bloom': {
      ctx.fillStyle = '#c96f2b';
      for (let petal = 0; petal < 5; petal += 1) {
        ctx.save();
        ctx.rotate((petal / 5) * Math.PI * 2 + Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(scale * 0.62, -scale * 0.2);
        ctx.lineTo(scale * 0.72, scale * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.26, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rind-wall': {
      ctx.fillStyle = '#2f6b58';
      rounded(ctx, -scale * 0.6, -scale * 0.55, scale * 1.2, scale * 1.1, scale * 0.22);
      ctx.fill();
      ctx.strokeStyle = '#79c9a4';
      ctx.lineWidth = 2;
      for (let row = -1; row <= 1; row += 1) {
        ctx.beginPath();
        ctx.moveTo(-scale * 0.55, row * scale * 0.28);
        ctx.lineTo(scale * 0.55, row * scale * 0.28);
        ctx.stroke();
      }
      break;
    }
    case 'frost-cap': {
      ctx.fillStyle = '#a8e6f2';
      ctx.beginPath();
      ctx.arc(0, scale * 0.1, scale * 0.56, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e8fbff';
      ctx.lineWidth = 1.6;
      for (let ray = 0; ray < 3; ray += 1) {
        const angle = (ray / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * -scale * 0.4, Math.sin(angle) * -scale * 0.1);
        ctx.lineTo(Math.cos(angle) * scale * 0.4, Math.sin(angle) * scale * 0.5);
        ctx.stroke();
      }
      break;
    }
    case 'ember-vine': {
      ctx.strokeStyle = '#7a2f24';
      ctx.lineWidth = scale * 0.16;
      ctx.beginPath();
      ctx.moveTo(-scale * 0.6, scale * 0.4);
      for (let step = 0; step <= 6; step += 1) {
        const x = -scale * 0.6 + (step / 6) * scale * 1.2;
        const y = scale * 0.4 - Math.sin(step * 1.2) * scale * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let ember = 0; ember < 4; ember += 1) {
        ctx.fillStyle = ember % 2 === 0 ? '#ff9f45' : '#ffd166';
        ctx.globalAlpha = 0.65 + Math.sin(time * 5 + ember) * 0.2;
        ctx.beginPath();
        ctx.arc(-scale * 0.4 + ember * scale * 0.28, -scale * 0.1 + Math.cos(ember) * scale * 0.2, scale * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'mortar-moss': {
      ctx.fillStyle = '#4a6d3c';
      rounded(ctx, -scale * 0.55, -scale * 0.25, scale * 1.1, scale * 0.6, scale * 0.2);
      ctx.fill();
      ctx.fillStyle = '#88a86a';
      ctx.save();
      ctx.rotate(-0.5);
      rounded(ctx, 0, -scale * 0.65, scale * 0.3, scale * 0.8, scale * 0.1);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'purge-reed': {
      ctx.strokeStyle = '#d88cff';
      ctx.lineWidth = scale * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, scale * 0.6);
      ctx.lineTo(0, -scale * 0.6);
      ctx.stroke();
      ctx.fillStyle = '#f0d6ff';
      ctx.beginPath();
      ctx.arc(0, -scale * 0.55, scale * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(216, 140, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  ctx.restore();

  if (module.health < module.maxHealth) {
    const ratio = Math.max(0, module.health / module.maxHealth);
    const barWidth = cellW * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - barWidth / 2, cy + cellH * 0.28, barWidth, 3);
    ctx.fillStyle = ratio > 0.4 ? '#7ef0b2' : '#ff8b7a';
    ctx.fillRect(cx - barWidth / 2, cy + cellH * 0.28, barWidth * ratio, 3);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState, cx: number, cy: number, cellW: number, cellH: number, time: number, palette: ThemePalette): void {
  const scale = Math.min(cellW, cellH) * 0.4;
  const boss = enemy.enemyId === 'boss';
  const bob = Math.sin(time * 7 + enemy.id) * (enemy.speed > 0 ? 1.6 : 0.4);
  const size = boss ? scale * 1.6 : scale;

  ctx.save();
  ctx.translate(cx, cy + bob);
  if (enemy.slowUntil > time) {
    ctx.fillStyle = 'rgba(142, 240, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = palette.enemyDark;
  ctx.strokeStyle = palette.enemy;
  ctx.lineWidth = 2;

  switch (enemy.enemyId) {
    case 'runner': {
      ctx.beginPath();
      ctx.moveTo(size * 0.8, 0);
      ctx.lineTo(-size * 0.4, -size * 0.6);
      ctx.lineTo(-size * 0.2, 0);
      ctx.lineTo(-size * 0.4, size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'armoured': {
      ctx.beginPath();
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = (corner / 6) * Math.PI * 2;
        const x = Math.cos(angle) * size * 0.72;
        const y = Math.sin(angle) * size * 0.62;
        if (corner === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,190,0.4)';
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, 0);
      ctx.lineTo(size * 0.5, 0);
      ctx.stroke();
      break;
    }
    case 'shielded': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (enemy.shield > 0) {
        ctx.strokeStyle = 'rgba(142, 240, 255, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      }
      break;
    }
    case 'jumper': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = palette.enemy;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * size * 0.24, size * 0.3);
        ctx.lineTo(side * size * 0.34, size * 0.68);
        ctx.lineTo(side * size * 0.08, size * 0.56);
        ctx.stroke();
      }
      break;
    }
    case 'burrower': {
      ctx.beginPath();
      ctx.arc(0, size * 0.2, size * 0.62, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#f0b07a';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * size * 0.3, size * 0.2);
        ctx.lineTo(side * size * 0.6, size * 0.34);
        ctx.stroke();
      }
      break;
    }
    case 'splitter': {
      ctx.beginPath();
      ctx.arc(-size * 0.28, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size * 0.28, 0, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'healer': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd7d2';
      ctx.fillRect(-size * 0.09, -size * 0.3, size * 0.18, size * 0.6);
      ctx.fillRect(-size * 0.3, -size * 0.09, size * 0.6, size * 0.18);
      break;
    }
    case 'ranged': {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.enemy;
      ctx.fillRect(-size * 0.75, -size * 0.12, size * 0.7, size * 0.24);
      break;
    }
    case 'boss': {
      ctx.beginPath();
      for (let corner = 0; corner < 8; corner += 1) {
        const angle = (corner / 8) * Math.PI * 2;
        const radius = corner % 2 === 0 ? size * 0.8 : size * 0.62;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (corner === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffcf8a';
      for (let spike = -1; spike <= 1; spike += 1) {
        ctx.beginPath();
        ctx.moveTo(spike * size * 0.3 - size * 0.1, -size * 0.6);
        ctx.lineTo(spike * size * 0.3, -size * 0.95);
        ctx.lineTo(spike * size * 0.3 + size * 0.1, -size * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    default: {
      ctx.beginPath();
      rounded(ctx, -size * 0.4, -size * 0.5, size * 0.8, size, size * 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd7b0';
      const eyeOffset = Math.sin(time * 5 + enemy.id) * size * 0.06;
      ctx.beginPath();
      ctx.arc(-size * 0.12 + eyeOffset, -size * 0.16, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  if (enemy.burnUntil > time) {
    ctx.fillStyle = 'rgba(255, 159, 69, 0.55)';
    for (let ember = 0; ember < 3; ember += 1) {
      ctx.beginPath();
      ctx.arc(-size * 0.4 + ember * size * 0.4, -size * 0.5 - ((time * 30 + ember * 10) % 16), size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  if (enemy.health < enemy.maxHealth || enemy.shield > 0) {
    const barWidth = boss ? cellW * 0.8 : cellW * 0.52;
    const y = cy - (boss ? cellH * 0.42 : cellH * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - barWidth / 2, y, barWidth, 3.5);
    ctx.fillStyle = '#ff8b7a';
    ctx.fillRect(cx - barWidth / 2, y, barWidth * Math.max(0, enemy.health / enemy.maxHealth), 3.5);
    if (enemy.shield > 0) {
      ctx.fillStyle = 'rgba(142, 240, 255, 0.85)';
      ctx.fillRect(cx - barWidth / 2, y - 3, barWidth * (enemy.shield / 90), 2);
    }
  }
}

function drawTelegraphs(
  ctx: CanvasRenderingContext2D,
  state: LawnState,
  field: { x: number; y: number; w: number; h: number },
  palette: ThemePalette,
): void {
  const cellH = field.h / LANES;
  const nextByLane = new Map<number, number>();
  for (const entry of state.queue) {
    if (entry.time - state.time > 3.2) continue;
    const current = nextByLane.get(entry.lane);
    if (current === undefined || entry.time < current) nextByLane.set(entry.lane, entry.time);
  }
  for (const [lane, at] of nextByLane) {
    const soon = Math.max(0, Math.min(1, 1 - (at - state.time) / 3.2));
    ctx.save();
    ctx.globalAlpha = 0.35 + soon * 0.55;
    ctx.fillStyle = palette.enemy;
    const y = field.y + (lane + 0.5) * cellH;
    for (let chevron = 0; chevron < 3; chevron += 1) {
      const x = field.x + field.w - 14 - chevron * 7;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 7);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 5, y + 7);
      ctx.lineTo(x + 2, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTokens(ctx: CanvasRenderingContext2D, state: LawnState, field: { x: number; y: number; w: number; h: number }): void {
  const cellW = field.w / COLS;
  const cellH = field.h / LANES;
  for (const token of state.tokens) {
    const cx = field.x + (token.col + 0.5) * cellW;
    const cy = field.y + (token.lane + 0.5) * cellH + Math.sin(state.time * 2 + token.id) * 3;
    const fade = token.ttl < 2 ? Math.max(0.25, token.ttl / 2) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = '#f4d35e';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(cellW, cellH) * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 240, 190, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.restore();
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: LawnState, field: { x: number; y: number; w: number; h: number }): void {
  const cellW = field.w / COLS;
  const cellH = field.h / LANES;
  for (const projectile of state.projectiles) {
    const laneY = field.y + (projectile.lane + 0.5) * cellH;
    if (projectile.kind === 'mortar') {
      const x = field.x + (projectile.startX + (projectile.targetX - projectile.startX) * projectile.progress) * cellW;
      const y = laneY - Math.sin(projectile.progress * Math.PI) * cellH * 0.9;
      ctx.fillStyle = '#b6d98a';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(182, 217, 138, 0.35)';
      ctx.beginPath();
      ctx.arc(field.x + projectile.targetX * cellW, laneY, cellW * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const x = field.x + projectile.x * cellW;
    if (projectile.kind === 'needle') {
      ctx.strokeStyle = '#d9ffe6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 6, laneY);
      ctx.lineTo(x + 4, laneY);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffb45e';
      ctx.beginPath();
      ctx.arc(x, laneY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  state: LawnState,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;
  const palette = THEMES[state.stage] ?? THEMES.solar;
  const field = {
    x: width * PLAYFIELD.left,
    y: height * PLAYFIELD.top,
    w: width * PLAYFIELD.width,
    h: height * PLAYFIELD.height,
  };
  const cellW = field.w / COLS;
  const cellH = field.h / LANES;

  ctx.clearRect(0, 0, width, height);
  drawBackdrop(ctx, width, height, palette);
  drawGrid(ctx, field, palette);
  drawCore(ctx, state, field, palette);
  drawTelegraphs(ctx, state, field, palette);
  drawTokens(ctx, state, field);

  for (const module of state.grid) {
    if (!module) continue;
    drawModule(
      ctx,
      module,
      field.x + (module.col + 0.5) * cellW,
      field.y + (module.lane + 0.5) * cellH,
      cellW,
      cellH,
      state.time,
    );
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    drawEnemy(
      ctx,
      enemy,
      field.x + enemy.x * cellW,
      field.y + (enemy.lane + 0.5) * cellH,
      cellW,
      cellH,
      state.time,
      palette,
    );
  }

  drawProjectiles(ctx, state, field);

  if (state.finalWave && state.waveStartTimes.length > 0) {
    const start = state.waveStartTimes[state.waveStartTimes.length - 1];
    const remaining = 3.2 - (state.time - start);
    if (remaining > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, remaining);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd9a0';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('FINAL WAVE', width / 2, field.y + 22);
      ctx.restore();
    }
  }

  if (state.status !== 'running') {
    ctx.fillStyle = 'rgba(6, 10, 18, 0.45)';
    ctx.fillRect(0, 0, width, height);
  }
}
