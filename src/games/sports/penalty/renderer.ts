import {
  FLIGHT_SECONDS,
  ZONE_LABELS,
  zoneAt,
  zoneColumn,
  zoneRow,
  type ShootoutState,
  type Zone,
} from './simulation';

export interface GoalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function goalRect(width: number, height: number): GoalRect {
  return {
    x: width * 0.16,
    y: height * 0.15,
    w: width * 0.68,
    h: height * 0.46,
  };
}

export function zoneCenter(zone: Zone, goal: GoalRect): { x: number; y: number } {
  return {
    x: goal.x + (goal.w * (zoneColumn(zone) + 0.5)) / 3,
    y: goal.y + (goal.h * (zoneRow(zone) + 0.5)) / 2,
  };
}

export function zoneFromCanvas(x: number, y: number, width: number, height: number): Zone {
  const goal = goalRect(width, height);
  const nx = Math.max(0, Math.min(0.999, (x - goal.x) / goal.w));
  const ny = Math.max(0, Math.min(0.999, (y - goal.y) / goal.h));
  return zoneAt(nx, ny);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function crowd(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const colors = ['#4c8dff', '#b285ff', '#69f0ff', '#ffb347', '#ff6b8a', '#f5f7ff'];
  for (let row = 0; row < 5; row += 1) {
    for (let index = 0; index < 40; index += 1) {
      const x = (index / 39) * width + ((row % 2) * width) / 78;
      const y = height * (0.055 + row * 0.024);
      const color = colors[(index + row * 3) % colors.length] ?? '#4c8dff';
      ctx.globalAlpha = 0.22 + (row % 3) * 0.05;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, width * 0.0022), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawGoal(ctx: CanvasRenderingContext2D, goal: GoalRect, selected: Zone | null, active: boolean) {
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(220,235,255,0.35)';
  for (let column = 1; column < 12; column += 1) {
    const x = goal.x + (goal.w * column) / 12;
    ctx.beginPath();
    ctx.moveTo(x, goal.y + 4);
    ctx.lineTo(x, goal.y + goal.h - 4);
    ctx.stroke();
  }
  for (let row = 1; row < 6; row += 1) {
    const y = goal.y + (goal.h * row) / 6;
    ctx.beginPath();
    ctx.moveTo(goal.x + 4, y);
    ctx.lineTo(goal.x + goal.w - 4, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(130,200,255,0.16)';
  ctx.lineWidth = 1;
  for (let column = 1; column < 3; column += 1) {
    const x = goal.x + (goal.w * column) / 3;
    ctx.beginPath();
    ctx.moveTo(x, goal.y);
    ctx.lineTo(x, goal.y + goal.h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(goal.x, goal.y + goal.h / 2);
  ctx.lineTo(goal.x + goal.w, goal.y + goal.h / 2);
  ctx.stroke();

  if (selected !== null && active) {
    const center = zoneCenter(selected, goal);
    ctx.fillStyle = 'rgba(76,141,255,0.18)';
    ctx.strokeStyle = 'rgba(105,240,255,0.85)';
    ctx.lineWidth = 2;
    const zoneW = goal.w / 3;
    const zoneH = goal.h / 2;
    roundRect(
      ctx,
      center.x - zoneW / 2 + 2,
      center.y - zoneH / 2 + 2,
      zoneW - 4,
      zoneH - 4,
      10,
    );
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = '#f5f7ff';
  ctx.lineWidth = Math.max(5, goal.w * 0.009);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(180,220,255,0.75)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(goal.x, goal.y + goal.h);
  ctx.lineTo(goal.x, goal.y);
  ctx.lineTo(goal.x + goal.w, goal.y);
  ctx.lineTo(goal.x + goal.w, goal.y + goal.h);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawKeeper(
  ctx: CanvasRenderingContext2D,
  goal: GoalRect,
  state: ShootoutState,
  width: number,
) {
  const center = { x: goal.x + goal.w / 2, y: goal.y + goal.h * 0.62 };
  let x = center.x;
  let y = center.y;
  let dive = 0;
  let target: Zone | null = null;

  if (state.current) {
    if (state.phase === 'player-flight' || state.phase === 'result' || state.phase === 'over') {
      target = state.current.keeperZone;
    } else if (state.phase === 'ai-flight') {
      target = state.current.keeperZone;
    }
  }
  if (target !== null && (state.phase === 'player-flight' || state.phase === 'ai-flight' || state.phase === 'result' || state.phase === 'over')) {
    const spot = zoneCenter(target, goal);
    const raw = state.phase === 'player-flight' || state.phase === 'ai-flight' ? state.flight / FLIGHT_SECONDS : 1;
    dive = Math.max(0, Math.min(1, raw));
    const eased = 1 - (1 - dive) ** 3;
    x = center.x + (spot.x - center.x) * eased;
    y = center.y + (spot.y - center.y) * eased * 0.85;
  }

  const scale = width / 960;
  const bodyW = 30 * scale;
  const bodyH = 54 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dive * (target !== null && zoneColumn(target) === 0 ? -0.5 : target !== null && zoneColumn(target) === 2 ? 0.5 : 0));
  ctx.fillStyle = '#0b1224';
  ctx.strokeStyle = '#69f0ff';
  ctx.lineWidth = 2;

  const armSpan = 30 + dive * 44;
  ctx.strokeStyle = '#69f0ff';
  ctx.lineWidth = Math.max(4, 7 * scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-armSpan, -bodyH * 0.25);
  ctx.lineTo(armSpan, -bodyH * 0.25);
  ctx.stroke();

  ctx.fillStyle = '#101a34';
  roundRect(ctx, -bodyW / 2, -bodyH * 0.55, bodyW, bodyH, 8 * scale);
  ctx.fill();
  ctx.strokeStyle = '#4c8dff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath();
  ctx.arc(0, -bodyH * 0.72, 11 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#69f0ff';
  ctx.fillRect(-bodyW / 2 + 4 * scale, -bodyH * 0.3, bodyW - 8 * scale, 4 * scale);
  ctx.restore();
}

function drawKicker(ctx: CanvasRenderingContext2D, width: number, height: number, player: boolean) {
  if (!player) return;
  const x = width * 0.4;
  const y = height * 0.84;
  const scale = width / 960;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#101a34';
  roundRect(ctx, -14 * scale, -46 * scale, 28 * scale, 40 * scale, 8 * scale);
  ctx.fill();
  ctx.strokeStyle = '#4c8dff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath();
  ctx.arc(0, -54 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#141a2c';
  ctx.lineWidth = 8 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5 * scale, -6 * scale);
  ctx.lineTo(-16 * scale, 24 * scale);
  ctx.moveTo(5 * scale, -6 * scale);
  ctx.lineTo(14 * scale, 22 * scale);
  ctx.stroke();
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  goal: GoalRect,
  state: ShootoutState,
) {
  const spot = { x: width * 0.53, y: height * 0.85 };
  let x = spot.x;
  let y = spot.y;
  let radius = width * 0.024;

  if (state.current && (state.phase === 'player-flight' || state.phase === 'ai-flight' || state.phase === 'result' || state.phase === 'over')) {
    const target = zoneCenter(state.current.shotZone, goal);
    const raw = state.phase === 'player-flight' || state.phase === 'ai-flight' ? state.flight / FLIGHT_SECONDS : 1;
    const t = Math.max(0, Math.min(1, raw));
    x = spot.x + (target.x - spot.x) * t;
    y = spot.y + (target.y - spot.y) * t - Math.sin(Math.PI * t) * height * 0.12;
    radius = width * (0.024 - 0.01 * t);
  }

  ctx.save();
  const shadowAlpha = 0.28 * (1 - Math.max(0, (spot.y - y) / height) * 2);
  ctx.fillStyle = `rgba(3,6,15,${Math.max(0.06, shadowAlpha)})`;
  ctx.beginPath();
  ctx.ellipse(x, spot.y + radius * 0.9, radius * 1.1, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.2, x, y, radius);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.55, '#dfe8ff');
  gradient.addColorStop(1, '#8fa9d6');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b2a52';
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();

  ctx.fillStyle = '#1b2a52';
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * radius * 0.48, y + Math.sin(angle) * radius * 0.48, radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPenaltyScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: ShootoutState,
  selected: Zone | null,
): void {
  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.75);
  sky.addColorStop(0, '#03060f');
  sky.addColorStop(0.55, '#0a1430');
  sky.addColorStop(1, '#101f42');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.1, 0, width * 0.5, height * 0.1, width * 0.6);
  glow.addColorStop(0, 'rgba(76,141,255,0.22)');
  glow.addColorStop(1, 'rgba(76,141,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height * 0.7);

  crowd(ctx, width, height);

  for (const side of [0, 1]) {
    const x = side === 0 ? width * 0.07 : width * 0.93;
    ctx.fillStyle = '#0d1730';
    ctx.fillRect(x - 3, height * 0.1, 6, height * 0.34);
    const lamp = ctx.createRadialGradient(x, height * 0.1, 0, x, height * 0.1, width * 0.16);
    lamp.addColorStop(0, 'rgba(220,236,255,0.5)');
    lamp.addColorStop(1, 'rgba(220,236,255,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(x - width * 0.16, height * 0.02, width * 0.32, height * 0.36);
    ctx.fillStyle = '#f5f7ff';
    ctx.fillRect(x - 20, height * 0.085, 40, 10);
  }

  const pitch = ctx.createLinearGradient(0, height * 0.52, 0, height);
  pitch.addColorStop(0, '#0b3a2a');
  pitch.addColorStop(1, '#061a16');
  ctx.fillStyle = pitch;
  ctx.fillRect(0, height * 0.52, width, height * 0.48);

  for (let stripe = 0; stripe < 8; stripe += 1) {
    ctx.fillStyle = stripe % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, height * (0.54 + stripe * 0.055), width, height * 0.055);
  }

  ctx.strokeStyle = 'rgba(150,220,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.78);
  ctx.lineTo(width, height * 0.78);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(150,220,255,0.16)';
  ctx.beginPath();
  ctx.ellipse(width * 0.53, height * 0.86, width * 0.2, height * 0.05, 0, 0, Math.PI * 2);
  ctx.stroke();

  const goal = goalRect(width, height);
  const aiming = state.phase === 'player-aim' || state.phase === 'ai-aim';
  drawGoal(ctx, goal, selected, aiming);
  drawKicker(ctx, width, height, state.current === null || state.current.shooter === 'player');

  drawKeeper(ctx, goal, state, width);
  drawBall(ctx, width, height, goal, state);

  if (state.phase === 'result' && state.current) {
    const label = state.current.offTarget
      ? 'WIDE'
      : state.current.saved
        ? 'SAVED'
        : 'GOAL';
    ctx.save();
    ctx.font = `700 ${Math.round(width * 0.05)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = label === 'GOAL' ? 'rgba(105,240,255,0.94)' : 'rgba(255,107,107,0.94)';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 24;
    ctx.fillText(label, width / 2, height * 0.43);
    ctx.restore();
  }

  if (aiming && selected !== null) {
    ctx.save();
    ctx.font = `600 ${Math.round(width * 0.016)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(220,236,255,0.7)';
    ctx.fillText(ZONE_LABELS[selected], width / 2, height * 0.985);
    ctx.restore();
  }
}
