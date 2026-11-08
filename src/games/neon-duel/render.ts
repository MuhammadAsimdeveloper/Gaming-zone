import type { FighterState } from './combat';
import type { Side } from './match';
import { FIGHTERS, type FighterSpec } from './fighters';

export interface DuelEffect {
  kind: 'hit' | 'block' | 'ko' | 'land' | 'special';
  x: number;
  y: number;
  life: number;
  maxLife: number;
  strength: number;
}

export interface DuelBanner {
  title: string;
  subtitle: string;
  tone: 'neutral' | 'win' | 'loss';
}

export interface DuelView {
  a: FighterState;
  b: FighterState;
  timerTicks: number;
  roundTicks: number;
  round: number;
  wins: Record<Side, number>;
  banner: DuelBanner | null;
  shake: number;
  effects: DuelEffect[];
  training: boolean;
  rivalName: string;
  clock: number;
}

export interface DuelRenderOptions {
  reducedMotion: boolean;
  time: number;
}

const VIEW_MIN_X = -7;
const VIEW_MAX_X = 7;
const GROUND_RATIO = 0.8;
const HORIZON_RATIO = 0.62;

function project(canvas: HTMLCanvasElement, x: number, y: number): { x: number; y: number } {
  const scaleX = canvas.width / (VIEW_MAX_X - VIEW_MIN_X);
  return {
    x: canvas.width / 2 + x * scaleX,
    y: canvas.height * GROUND_RATIO - y * scaleX * 1.15,
  };
}

function unitFor(canvas: HTMLCanvasElement): number {
  return (canvas.width / (VIEW_MAX_X - VIEW_MIN_X)) * 1.15;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

function drawBackdrop(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number): void {
  const width = canvas.width;
  const height = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#070a18');
  sky.addColorStop(0.45, '#12112c');
  sky.addColorStop(0.72, '#241438');
  sky.addColorStop(1, '#090a18');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.72, height * 0.28, 0, width * 0.72, height * 0.28, width * 0.5);
  glow.addColorStop(0, 'rgba(160, 107, 255, 0.24)');
  glow.addColorStop(0.5, 'rgba(76, 141, 255, 0.08)');
  glow.addColorStop(1, 'rgba(7, 10, 24, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(220, 235, 255, 0.7)';
  for (let index = 0; index < 48; index += 1) {
    const x = ((index * 137.5) % 100) / 100 * width;
    const y = ((index * 61.7) % 52) / 100 * height;
    const pulse = 0.35 + 0.35 * Math.sin(time * 0.0012 + index);
    ctx.globalAlpha = pulse;
    ctx.fillRect(x, y, index % 7 === 0 ? 2.5 : 1.4, index % 7 === 0 ? 2.5 : 1.4);
  }
  ctx.globalAlpha = 1;

  drawSkyline(ctx, canvas, 0.16, time * 0.02, '#0d1230', 0.35);
  drawSkyline(ctx, canvas, 0.28, time * 0.045, '#131538', 0.55);
  drawSigns(ctx, canvas, time);
  drawSkyline(ctx, canvas, 0.44, time * 0.08, '#191947', 0.8);
}

function drawSkyline(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  depth: number,
  offset: number,
  fill: string,
  alpha: number,
): void {
  const width = canvas.width;
  const height = canvas.height;
  const horizon = height * HORIZON_RATIO;
  const buildingWidth = width * 0.055;
  const shift = (offset % (buildingWidth * 2)) - buildingWidth * 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  for (let index = -4; index < 30; index += 1) {
    const seed = (index + 40) * 97.13;
    const local = seed % 1;
    const buildingHeight = height * (0.08 + (depth + local * 0.24));
    const x = index * buildingWidth + shift;
    const w = buildingWidth * (0.62 + local * 0.3);
    ctx.fillRect(x, horizon - buildingHeight, w, buildingHeight + height * 0.2);

    ctx.fillStyle = 'rgba(120, 220, 255, 0.22)';
    const rows = Math.max(1, Math.floor(buildingHeight / (height * 0.055)));
    for (let row = 0; row < rows; row += 1) {
      if ((row + index) % 3 === 0) continue;
      ctx.fillRect(x + w * 0.18, horizon - buildingHeight + row * height * 0.05 + 4, w * 0.16, height * 0.014);
      ctx.fillRect(x + w * 0.62, horizon - buildingHeight + row * height * 0.05 + 4, w * 0.16, height * 0.014);
    }
    ctx.fillStyle = fill;
  }
  ctx.restore();
}

function drawSigns(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number): void {
  const horizon = canvas.height * HORIZON_RATIO;
  const pulse = 0.55 + Math.sin(time * 0.003) * 0.2;

  ctx.save();
  for (let index = 0; index < 5; index += 1) {
    const x = canvas.width * (0.08 + index * 0.21);
    const width = canvas.width * 0.09;
    const height = canvas.height * 0.025;
    const y = horizon - canvas.height * (0.09 + (index % 3) * 0.075);
    const color = index % 2 === 0 ? 'rgba(56, 232, 255, 0.7)' : 'rgba(255, 122, 89, 0.7)';
    ctx.globalAlpha = pulse * (0.6 + (index % 3) * 0.15);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(9, 12, 28, 0.9)';
    roundRect(ctx, x, y, width, height, height / 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x + width * 0.14, y + height * 0.36, width * 0.72, Math.max(1.5, height * 0.12));
  }
  ctx.restore();
}

function drawArena(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, time: number): void {
  const horizon = canvas.height * HORIZON_RATIO;
  const groundY = canvas.height * GROUND_RATIO;
  const width = canvas.width;

  const floor = ctx.createLinearGradient(0, horizon, 0, canvas.height);
  floor.addColorStop(0, 'rgba(21, 20, 54, 0.2)');
  floor.addColorStop(0.3, 'rgba(27, 28, 74, 0.85)');
  floor.addColorStop(1, 'rgba(8, 10, 24, 0.98)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, width, canvas.height - horizon);

  ctx.save();
  ctx.strokeStyle = 'rgba(86, 160, 255, 0.2)';
  ctx.lineWidth = 1;
  for (let index = -10; index <= 10; index += 1) {
    const startX = width / 2 + index * width * 0.028;
    ctx.beginPath();
    ctx.moveTo(startX, horizon);
    ctx.lineTo(width / 2 + index * width * 0.11, canvas.height);
    ctx.stroke();
  }
  for (let row = 1; row <= 12; row += 1) {
    const t = row / 12;
    const y = horizon + (canvas.height - horizon) * t * t;
    ctx.globalAlpha = 0.28 + t * 0.38;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const ring = ctx.createRadialGradient(width / 2, groundY, 0, width / 2, groundY, width * 0.32);
  ring.addColorStop(0, 'rgba(56, 232, 255, 0.1)');
  ring.addColorStop(0.6, 'rgba(160, 107, 255, 0.06)');
  ring.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ring;
  ctx.fillRect(0, horizon, width, canvas.height - horizon);

  ctx.save();
  ctx.strokeStyle = 'rgba(56, 232, 255, 0.38)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.lineDashOffset = -time * 0.03;
  ctx.beginPath();
  ctx.ellipse(width / 2, groundY + 6, width * 0.3, canvas.height * 0.035, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(160, 107, 255, 0.5)';
  ctx.fillRect(0, groundY, width, 1.5);
  const edge = ctx.createLinearGradient(0, groundY, 0, groundY + 26);
  edge.addColorStop(0, 'rgba(56, 232, 255, 0.22)');
  edge.addColorStop(1, 'rgba(56, 232, 255, 0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, groundY, width, 26);
}

interface Pose {
  lean: number;
  crouch: number;
  armFront: { x: number; y: number };
  armBack: { x: number; y: number };
  stride: number;
  tuck: number;
  guard: boolean;
  aura: number;
}

function poseFor(fighter: FighterState, spec: FighterSpec, time: number): Pose {
  const bob = Math.sin(time * 0.004 + (fighter.id === 'volt' ? 0 : 1.7)) * 0.025;
  let pose: Pose = {
    lean: 0,
    crouch: bob,
    armFront: { x: 0.18, y: 0.42 },
    armBack: { x: -0.16, y: 0.44 },
    stride: 0,
    tuck: 0,
    guard: false,
    aura: 0,
  };

  if (fighter.hitstun > 0) {
    return { ...pose, lean: -0.3, armFront: { x: -0.1, y: 0.2 }, armBack: { x: -0.3, y: 0.3 } };
  }

  const action = fighter.action;
  if (action.kind === 'move') {
    const cycle = Math.sin(time * 0.014);
    return {
      ...pose,
      lean: 0.08,
      stride: cycle * 0.26,
      armFront: { x: 0.18, y: 0.4 },
      armBack: { x: -0.18, y: 0.35 },
    };
  }
  if (action.kind === 'jump') {
    return {
      ...pose,
      lean: 0.05,
      tuck: 0.3,
      armFront: { x: 0.2, y: 0.55 },
      armBack: { x: -0.2, y: 0.5 },
    };
  }
  if (action.kind === 'dash') {
    return {
      ...pose,
      lean: 0.38,
      stride: 0.42,
      armFront: { x: 0.32, y: 0.36 },
      armBack: { x: -0.34, y: 0.28 },
    };
  }
  if (action.kind === 'block') {
    return {
      ...pose,
      lean: 0.04,
      crouch: bob * 1.4 - 0.02,
      guard: true,
      armFront: { x: 0.14, y: 0.62 },
      armBack: { x: -0.04, y: 0.58 },
    };
  }
  if (action.kind === 'attack') {
    const move = spec.moves[action.move];
    const activeEnd = move.startup + move.active;
    let reach: number;
    if (action.frame < move.startup) {
      const windup = action.frame / Math.max(1, move.startup);
      reach = -0.18 * windup;
    } else if (action.frame < activeEnd) {
      const strike = (action.frame - move.startup) / Math.max(1, move.active);
      reach = 0.55 + Math.sin(strike * Math.PI) * (action.move === 'heavy' ? 0.4 : 0.28);
    } else {
      const recover = (action.frame - activeEnd) / Math.max(1, move.recovery);
      reach = 0.55 * (1 - recover);
    }
    if (action.move === 'special') {
      return {
        ...pose,
        lean: 0.2,
        stride: 0.1,
        aura: action.frame >= move.startup ? 1 : 0.4,
        armFront: { x: 0.3 + reach, y: 0.5 },
        armBack: { x: -0.3, y: 0.24 },
      };
    }
    if (action.move === 'heavy') {
      return {
        ...pose,
        lean: 0.22 + reach * 0.2,
        crouch: -0.05,
        armFront: { x: 0.22 + reach, y: 0.55 },
        armBack: { x: 0.14 + reach * 0.7, y: 0.48 },
      };
    }
    return {
      ...pose,
      lean: 0.12 + reach * 0.2,
      armFront: { x: 0.2 + reach, y: 0.5 },
      armBack: { x: -0.2, y: 0.4 },
    };
  }

  return { ...pose, crouch: bob, armFront: { x: 0.16, y: 0.42 }, armBack: { x: -0.14, y: 0.4 } };
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  fighter: FighterState,
  spec: FighterSpec,
  time: number,
  options: DuelRenderOptions,
  isDummy: boolean,
): void {
  const unit = unitFor(canvas);
  const pose = poseFor(fighter, spec, time);
  const base = project(canvas, fighter.x, fighter.y);
  const dir = fighter.facing;

  ctx.save();
  ctx.translate(base.x, base.y);

  const shadowWidth = unit * 0.62 * (1 - clamp01(fighter.y) * 0.35);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, shadowWidth);
  shadow.addColorStop(0, 'rgba(3, 5, 14, 0.65)');
  shadow.addColorStop(1, 'rgba(3, 5, 14, 0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, 3, shadowWidth, shadowWidth * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose.aura > 0) {
    const aura = ctx.createRadialGradient(0, -unit * 0.9, 0, 0, -unit * 0.9, unit * 0.95);
    aura.addColorStop(0, `${spec.accent}44`);
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = aura;
    ctx.globalAlpha = pose.aura * (options.reducedMotion ? 0.5 : 0.7 + Math.sin(time * 0.02) * 0.2);
    ctx.fillRect(-unit, -unit * 2, unit * 2, unit * 2);
    ctx.globalAlpha = 1;
  }

  ctx.scale(dir, 1);
  ctx.translate(0, -pose.crouch * unit);
  ctx.rotate(-pose.lean * 0.5);
  ctx.translate(0, -fighter.y * 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -unit * (0.78 - pose.tuck * 0.3);
  const shoulderY = -unit * (1.28 - pose.crouch * 0.5);
  const headY = -unit * (1.56 - pose.crouch * 0.4);
  const legSwing = pose.stride * unit;

  // Back leg
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = unit * 0.13;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(-unit * 0.12 - legSwing, -unit * 0.36);
  ctx.lineTo(-unit * 0.2 - legSwing * 1.4, -unit * 0.02);
  ctx.stroke();

  // Torso
  const torso = ctx.createLinearGradient(0, shoulderY, 0, hipY);
  torso.addColorStop(0, spec.color);
  torso.addColorStop(1, spec.accent);
  ctx.strokeStyle = torso;
  ctx.lineWidth = unit * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY + unit * 0.05);
  ctx.lineTo(0, hipY);
  ctx.stroke();

  // Back arm
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = unit * 0.11;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY + unit * 0.08);
  ctx.lineTo(pose.armBack.x * unit, shoulderY + pose.armBack.y * unit * 0.5);
  ctx.lineTo(pose.armBack.x * unit * 1.5, shoulderY + pose.armBack.y * unit * 1.1);
  ctx.stroke();

  // Front leg
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = unit * 0.135;
  ctx.beginPath();
  ctx.moveTo(0, hipY);
  ctx.lineTo(unit * 0.12 + legSwing, -unit * 0.36);
  ctx.lineTo(unit * 0.2 + legSwing * 1.4, -unit * 0.02);
  ctx.stroke();

  // Head
  ctx.shadowColor = spec.color;
  ctx.shadowBlur = unit * 0.28;
  ctx.fillStyle = spec.color;
  ctx.beginPath();
  ctx.arc(unit * 0.03, headY, unit * 0.155, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Visor
  ctx.fillStyle = '#081020';
  roundRect(ctx, unit * 0.02, headY - unit * 0.06, unit * 0.2, unit * 0.075, unit * 0.03);
  ctx.fill();
  ctx.fillStyle = spec.accent;
  ctx.fillRect(unit * 0.1, headY - unit * 0.04, unit * 0.09, unit * 0.035);

  // Front arm
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = unit * 0.115;
  ctx.shadowColor = spec.accent;
  ctx.shadowBlur = unit * 0.18;
  ctx.beginPath();
  ctx.moveTo(0, shoulderY + unit * 0.08);
  ctx.lineTo(pose.armFront.x * unit, shoulderY + pose.armFront.y * unit * 0.5);
  ctx.lineTo(pose.armFront.x * unit * 1.55, shoulderY + pose.armFront.y * unit * 1.05);
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (pose.guard) {
    ctx.strokeStyle = `${spec.accent}bb`;
    ctx.lineWidth = unit * 0.06;
    ctx.beginPath();
    ctx.arc(unit * 0.16, shoulderY + unit * 0.2, unit * 0.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.fillStyle = `${spec.accent}1f`;
    ctx.beginPath();
    ctx.arc(unit * 0.16, shoulderY + unit * 0.2, unit * 0.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  }

  if (isDummy) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = `600 ${Math.max(9, unit * 0.14)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('DUMMY', 0, -unit * 1.95);
  }

  ctx.restore();
}

function drawAttackArc(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  fighter: FighterState,
  spec: FighterSpec,
  options: DuelRenderOptions,
  time: number,
): void {
  const action = fighter.action;
  if (action.kind !== 'attack') return;
  const move = spec.moves[action.move];
  if (action.frame < move.startup || action.frame >= move.startup + move.active) return;

  const unit = unitFor(canvas);
  const base = project(canvas, fighter.x, fighter.y);
  const radius = move.reach * unit;
  const start = fighter.facing === 1 ? -0.75 : Math.PI - 0.75;
  const end = fighter.facing === 1 ? 0.75 : Math.PI + 0.75;
  const pulse = options.reducedMotion ? 0.7 : 0.55 + Math.sin(time * 0.04) * 0.3;

  ctx.save();
  ctx.translate(base.x, base.y - unit * 0.95);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = action.move === 'special' ? spec.accent : spec.color;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 18;
  ctx.lineWidth = unit * (action.move === 'heavy' ? 0.16 : 0.1);
  ctx.beginPath();
  ctx.arc(0, 0, radius, start, end);
  ctx.stroke();
  ctx.globalAlpha = pulse * 0.25;
  ctx.lineWidth = unit * 0.4;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.92, start, end);
  ctx.stroke();
  ctx.restore();
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  effects: readonly DuelEffect[],
): void {
  const unit = unitFor(canvas);
  for (const effect of effects) {
    const ratio = clamp01(effect.life / Math.max(1, effect.maxLife));
    const point = project(canvas, effect.x, effect.y);
    const y = point.y - unit * 0.9;

    ctx.save();
    ctx.globalAlpha = ratio;
    if (effect.kind === 'hit') {
      const radius = unit * (0.22 + (1 - ratio) * 0.55);
      ctx.strokeStyle = '#ffd166';
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 16;
      ctx.lineWidth = unit * 0.05;
      for (let spoke = 0; spoke < 7; spoke += 1) {
        const angle = (spoke / 7) * Math.PI * 2 + effect.x;
        ctx.beginPath();
        ctx.moveTo(point.x + Math.cos(angle) * radius * 0.3, y + Math.sin(angle) * radius * 0.3);
        ctx.lineTo(point.x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(point.x, y, radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect.kind === 'block') {
      ctx.strokeStyle = '#8fd8ff';
      ctx.lineWidth = unit * 0.06;
      ctx.beginPath();
      ctx.arc(point.x, y, unit * (0.25 + (1 - ratio) * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === 'ko') {
      ctx.strokeStyle = '#ff7a59';
      ctx.shadowColor = '#ff7a59';
      ctx.shadowBlur = 24;
      ctx.lineWidth = unit * 0.08;
      ctx.beginPath();
      ctx.arc(point.x, y, unit * (0.3 + (1 - ratio) * 1.4), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === 'land') {
      ctx.strokeStyle = 'rgba(190, 200, 255, 0.8)';
      ctx.lineWidth = unit * 0.03;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, unit * (0.25 + (1 - ratio) * 0.35), unit * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const streak = unit * (0.5 + (1 - ratio) * 1.3);
      ctx.strokeStyle = '#c9a6ff';
      ctx.shadowColor = '#a06bff';
      ctx.shadowBlur = 20;
      ctx.lineWidth = unit * 0.07;
      ctx.beginPath();
      ctx.moveTo(point.x - streak, y);
      ctx.lineTo(point.x + streak, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  color: string,
  alignRight: boolean,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 8, 20, 0.78)';
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();

  const fillWidth = Math.max(0, Math.min(width - 4, (width - 4) * clamp01(ratio)));
  const fillX = alignRight ? x + width - 2 - fillWidth : x + 2;
  const fill = ctx.createLinearGradient(fillX, y, fillX + fillWidth, y);
  fill.addColorStop(0, alignRight ? '#ff9d7a' : color);
  fill.addColorStop(1, alignRight ? '#ff7a59' : color);
  ctx.fillStyle = fill;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  roundRect(ctx, fillX, y + 2, fillWidth, height - 4, (height - 4) / 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  ratio: number,
  color: string,
  alignRight: boolean,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 9, 22, 0.78)';
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fill();
  const fillWidth = Math.max(0, (width - 2) * clamp01(ratio));
  const fillX = alignRight ? x + width - 1 - fillWidth : x + 1;
  ctx.fillStyle = color;
  if (ratio >= 0.5) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  roundRect(ctx, fillX, y + 1, fillWidth, height - 2, (height - 2) / 2);
  ctx.fill();
  ctx.restore();
}

function drawPips(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  size: number,
  wins: Record<Side, number>,
): void {
  ctx.save();
  const gap = size * 1.9;
  for (let index = 0; index < 2; index += 1) {
    const x = centerX - gap * (index + 1);
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x + size / 2, y);
    ctx.lineTo(x, y + size / 2);
    ctx.lineTo(x - size / 2, y);
    ctx.closePath();
    ctx.fillStyle = index < wins.player ? '#38e8ff' : 'rgba(255, 255, 255, 0.16)';
    if (index < wins.player) {
      ctx.shadowColor = '#38e8ff';
      ctx.shadowBlur = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    const rivalX = centerX + gap * (index + 1);
    ctx.beginPath();
    ctx.moveTo(rivalX, y - size / 2);
    ctx.lineTo(rivalX + size / 2, y);
    ctx.lineTo(rivalX, y + size / 2);
    ctx.lineTo(rivalX - size / 2, y);
    ctx.closePath();
    ctx.fillStyle = index < wins.rival ? '#ff7a59' : 'rgba(255, 255, 255, 0.16)';
    if (index < wins.rival) {
      ctx.shadowColor = '#ff7a59';
      ctx.shadowBlur = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  view: DuelView,
  playerName: string,
): void {
  const margin = Math.max(12, canvas.width * 0.025);
  const barWidth = canvas.width * 0.3;
  const barHeight = Math.max(12, canvas.height * 0.026);
  const top = Math.max(10, canvas.height * 0.03);
  const small = Math.max(9, canvas.height * 0.019);

  ctx.save();
  ctx.textBaseline = 'bottom';
  ctx.font = `700 ${small}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(235, 240, 255, 0.92)';
  ctx.textAlign = 'left';
  ctx.fillText(playerName.toUpperCase(), margin, top - 5);
  ctx.textAlign = 'right';
  ctx.fillText(view.rivalName.toUpperCase(), canvas.width - margin, top - 5);

  drawHealthBar(ctx, margin, top, barWidth, barHeight, view.a.health / FIGHTERS[view.a.id].maxHealth, '#38e8ff', false);
  drawHealthBar(
    ctx,
    canvas.width - margin - barWidth,
    top,
    barWidth,
    barHeight,
    view.b.health / FIGHTERS[view.b.id].maxHealth,
    '#ff7a59',
    true,
  );

  const meterY = top + barHeight + 5;
  const meterHeight = Math.max(5, barHeight * 0.28);
  drawMeter(ctx, margin, meterY, barWidth * 0.82, meterHeight, view.a.meter / 100, '#a06bff', false);
  drawMeter(
    ctx,
    canvas.width - margin - barWidth * 0.82,
    meterY,
    barWidth * 0.82,
    meterHeight,
    view.b.meter / 100,
    '#a06bff',
    true,
  );

  const timer = Math.max(0, Math.ceil(view.timerTicks / 60));
  const timerBox = Math.max(46, canvas.width * 0.07);
  const timerY = top - 2;
  ctx.fillStyle = 'rgba(5, 8, 20, 0.85)';
  roundRect(ctx, canvas.width / 2 - timerBox / 2, timerY, timerBox, barHeight + 8, 8);
  ctx.fill();
  ctx.strokeStyle = timer <= 10 ? 'rgba(255, 122, 89, 0.8)' : 'rgba(56, 232, 255, 0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, canvas.width / 2 - timerBox / 2, timerY, timerBox, barHeight + 8, 8);
  ctx.stroke();

  ctx.fillStyle = timer <= 10 ? '#ff9d7a' : '#f3f7ff';
  ctx.font = `700 ${Math.max(16, canvas.height * 0.035)}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(timer), canvas.width / 2, timerY + (barHeight + 8) / 2);

  drawPips(ctx, canvas.width / 2, timerY + barHeight + 20, Math.max(6, canvas.height * 0.012), view.wins);

  ctx.font = `600 ${small}px 'Segoe UI', system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(220, 230, 255, 0.6)';
  ctx.textBaseline = 'top';
  ctx.fillText(`ROUND ${view.round}`, canvas.width / 2, timerY + barHeight + 28);
  ctx.restore();
}

function drawBanner(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  banner: DuelBanner,
): void {
  const centerX = canvas.width / 2;
  const centerY = canvas.height * 0.42;
  const titleSize = Math.max(30, canvas.width * 0.06);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const veil = ctx.createLinearGradient(0, centerY - titleSize, 0, centerY + titleSize);
  veil.addColorStop(0, 'rgba(5, 8, 20, 0)');
  veil.addColorStop(0.5, 'rgba(5, 8, 20, 0.55)');
  veil.addColorStop(1, 'rgba(5, 8, 20, 0)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, centerY - titleSize, canvas.width, titleSize * 2);

  ctx.font = `800 ${titleSize}px 'Segoe UI', system-ui, sans-serif`;
  ctx.lineWidth = Math.max(4, titleSize * 0.09);
  ctx.strokeStyle = 'rgba(5, 8, 20, 0.85)';
  ctx.strokeText(banner.title, centerX, centerY);
  ctx.fillStyle = banner.tone === 'win' ? '#6effc0' : banner.tone === 'loss' ? '#ff9d7a' : '#f4f8ff';
  ctx.shadowColor = banner.tone === 'win' ? '#4ade9d' : banner.tone === 'loss' ? '#ff7a59' : '#38e8ff';
  ctx.shadowBlur = 26;
  ctx.fillText(banner.title, centerX, centerY);
  ctx.shadowBlur = 0;

  if (banner.subtitle) {
    ctx.font = `600 ${Math.max(11, titleSize * 0.24)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(220, 232, 255, 0.85)';
    ctx.fillText(banner.subtitle, centerX, centerY + titleSize * 0.72);
  }
  ctx.restore();
}

export function drawDuelScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  view: DuelView,
  options: DuelRenderOptions,
): void {
  if (canvas.width <= 0 || canvas.height <= 0) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop(ctx, canvas, options.time);
  drawArena(ctx, canvas, options.time);

  const shakeAmount = options.reducedMotion ? 0 : view.shake;
  ctx.save();
  if (shakeAmount > 0.01) {
    ctx.translate(
      Math.sin(options.time * 0.09) * shakeAmount * 9,
      Math.cos(options.time * 0.13) * shakeAmount * 6,
    );
  }

  const behind = view.a.x <= view.b.x ? view.a : view.b;
  const ahead = behind === view.a ? view.b : view.a;
  drawFighter(ctx, canvas, behind, FIGHTERS[behind.id], options.time, options, view.training && behind === view.b);
  drawFighter(ctx, canvas, ahead, FIGHTERS[ahead.id], options.time, options, view.training && ahead === view.b);
  drawAttackArc(ctx, canvas, view.a, FIGHTERS[view.a.id], options, options.time);
  drawAttackArc(ctx, canvas, view.b, FIGHTERS[view.b.id], options, options.time);
  drawEffects(ctx, canvas, view.effects);

  ctx.restore();

  drawHud(ctx, canvas, view, FIGHTERS[view.a.id].name);
  if (view.training) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 207, 92, 0.85)';
    ctx.font = `700 ${Math.max(10, canvas.height * 0.018)}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TRAINING DUMMY', canvas.width / 2, canvas.height * 0.18);
    ctx.restore();
  }
  if (view.banner) drawBanner(ctx, canvas, view.banner);
}
