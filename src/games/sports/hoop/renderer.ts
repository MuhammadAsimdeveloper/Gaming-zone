import {
  BALL_RADIUS,
  FLOOR_Y,
  HOOP_Y,
  RIM_HALF,
  SPOTS,
  predictPath,
  spotOf,
  type HoopState,
} from './simulation';

const PALETTE = {
  electric: '#4c8dff',
  plasma: '#b285ff',
  cyan: '#69f0ff',
  mint: '#4ade9d',
  coral: '#ff6b6b',
  amber: '#ffb347',
  ink: '#f5f7ff',
  muted: '#8fa9d6',
};

export function courtPoint(x: number, y: number, width: number, height: number): { x: number; y: number } {
  return { x: (x / 100) * width, y: (y / 100) * height };
}

export function courtFromCanvas(px: number, py: number, width: number, height: number): { x: number; y: number } {
  return { x: (px / width) * 100, y: (py / height) * 100 };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawArena(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#03060f');
  sky.addColorStop(0.42, '#091430');
  sky.addColorStop(0.62, '#0c1c3a');
  sky.addColorStop(1, '#050b17');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const halo = ctx.createRadialGradient(width * 0.5, height * 0.2, 0, width * 0.5, height * 0.2, width * 0.62);
  halo.addColorStop(0, 'rgba(76,141,255,0.18)');
  halo.addColorStop(1, 'rgba(76,141,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height * 0.72);

  const colors = [PALETTE.electric, PALETTE.plasma, PALETTE.cyan, PALETTE.mint, PALETTE.amber, PALETTE.coral];
  for (let row = 0; row < 4; row += 1) {
    for (let index = 0; index < 46; index += 1) {
      const x = (index / 45) * width + ((row % 2) * width) / 90;
      const y = height * (0.055 + row * 0.03);
      ctx.globalAlpha = 0.16 + (row % 3) * 0.05;
      ctx.fillStyle = colors[(index + row * 4) % colors.length] ?? PALETTE.electric;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, width * 0.002), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(6,10,22,0.85)';
  roundRect(ctx, width * 0.36, height * 0.035, width * 0.28, height * 0.052, height * 0.012);
  ctx.fill();
  ctx.strokeStyle = 'rgba(105,240,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 ${Math.round(width * 0.017)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEONRIFT ARENA', width * 0.5, height * 0.061);

  for (const side of [0, 1]) {
    const x = side === 0 ? width * 0.1 : width * 0.9;
    const lamp = ctx.createRadialGradient(x, height * 0.03, 0, x, height * 0.03, width * 0.18);
    lamp.addColorStop(0, 'rgba(220,236,255,0.32)');
    lamp.addColorStop(1, 'rgba(220,236,255,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(x - width * 0.18, 0, width * 0.36, height * 0.34);
    ctx.fillStyle = 'rgba(220,236,255,0.85)';
    roundRect(ctx, x - width * 0.028, height * 0.02, width * 0.056, height * 0.012, height * 0.005);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,236,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, height * 0.032);
    ctx.lineTo(x - width * 0.02, height * 0.2);
    ctx.moveTo(x, height * 0.032);
    ctx.lineTo(x + width * 0.02, height * 0.2);
    ctx.stroke();
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const top = height * 0.62;
  const floor = ctx.createLinearGradient(0, top, 0, height);
  floor.addColorStop(0, '#13324b');
  floor.addColorStop(0.45, '#0c2238');
  floor.addColorStop(1, '#06111f');
  ctx.fillStyle = floor;
  ctx.fillRect(0, top, width, height - top);

  for (let plank = 0; plank < 14; plank += 1) {
    const y = top + ((height - top) * plank) / 14;
    ctx.fillStyle = plank % 2 === 0 ? 'rgba(255,255,255,0.022)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y, width, (height - top) / 14);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(74,222,157,0.55)';
  ctx.lineWidth = Math.max(2, width * 0.0026);
  ctx.shadowColor = 'rgba(74,222,157,0.55)';
  ctx.shadowBlur = 12;

  const baseline = courtPoint(0, 92, width, height);
  ctx.beginPath();
  ctx.moveTo(0, baseline.y);
  ctx.lineTo(width, baseline.y);
  ctx.stroke();

  const hoopBase = courtPoint(80, 92, width, height);
  ctx.beginPath();
  ctx.ellipse(hoopBase.x, hoopBase.y, width * 0.34, height * 0.14, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.55;
  const keyLeft = courtPoint(61, 0, width, height).x;
  const keyTop = courtPoint(0, 79, width, height).y;
  ctx.beginPath();
  ctx.moveTo(keyLeft, baseline.y);
  ctx.lineTo(keyLeft, keyTop);
  ctx.lineTo(hoopBase.x, keyTop);
  ctx.lineTo(hoopBase.x, baseline.y);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(105,240,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(hoopBase.x, hoopBase.y, width * 0.1, height * 0.042, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawHoop(ctx: CanvasRenderingContext2D, width: number, height: number, state: HoopState): void {
  const rim = courtPoint(state.hoopX, HOOP_Y, width, height);
  const halfRim = (RIM_HALF / 100) * width;
  const boardX = rim.x + halfRim + width * 0.012;
  const boardW = width * 0.06;
  const boardTop = height * 0.14;
  const boardH = height * 0.24;
  const floorY = courtPoint(0, 90, width, height).y;

  ctx.save();
  ctx.strokeStyle = 'rgba(150,190,255,0.55)';
  ctx.lineWidth = Math.max(3, width * 0.006);
  ctx.beginPath();
  ctx.moveTo(boardX + boardW * 0.5, boardTop + boardH);
  ctx.lineTo(boardX + boardW * 0.5, floorY);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(76,141,255,0.5)';
  ctx.lineWidth = Math.max(2, width * 0.0024);
  ctx.beginPath();
  ctx.moveTo(boardX + boardW * 0.5, floorY);
  ctx.lineTo(boardX + boardW * 1.1, floorY);
  ctx.stroke();

  const board = ctx.createLinearGradient(boardX, boardTop, boardX + boardW, boardTop + boardH);
  board.addColorStop(0, 'rgba(159,207,255,0.26)');
  board.addColorStop(1, 'rgba(76,141,255,0.12)');
  ctx.fillStyle = board;
  roundRect(ctx, boardX, boardTop, boardW, boardH, width * 0.006);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,236,255,0.55)';
  ctx.lineWidth = Math.max(1.5, width * 0.0018);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,107,107,0.6)';
  ctx.lineWidth = Math.max(1.5, width * 0.0018);
  ctx.strokeRect(boardX + boardW * 0.28, boardTop + boardH * 0.55, boardW * 0.44, boardH * 0.3);

  const netSway = Math.sin(state.elapsed * 2.6) * width * 0.0025;
  ctx.strokeStyle = 'rgba(220,236,255,0.42)';
  ctx.lineWidth = Math.max(1, width * 0.0014);
  const netBottomY = rim.y + height * 0.1;
  for (let strand = 0; strand <= 6; strand += 1) {
    const t = strand / 6;
    const topX = rim.x - halfRim + halfRim * 2 * t;
    const bottomX = rim.x - halfRim * 0.3 + halfRim * 0.6 * t + netSway;
    ctx.beginPath();
    ctx.moveTo(topX, rim.y);
    ctx.quadraticCurveTo(topX + (bottomX - topX) * 0.35, netBottomY - height * 0.035, bottomX, netBottomY);
    ctx.stroke();
  }
  for (let ring = 1; ring <= 3; ring += 1) {
    const t = ring / 4;
    const y = rim.y + height * 0.1 * t;
    const inset = halfRim * (0.65 + 0.35 * t);
    ctx.beginPath();
    ctx.ellipse(rim.x + netSway * t, y, inset, height * 0.008, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = '#ff8a3d';
  ctx.lineWidth = Math.max(4, width * 0.006);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,138,61,0.85)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(rim.x - halfRim, rim.y);
  ctx.lineTo(rim.x + halfRim, rim.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, width: number, height: number, state: HoopState): void {
  const spot = spotOf(state);
  const feet = courtPoint(spot.x, 93, width, height);
  const scale = width / 960;
  const armLift = state.phase === 'flight' ? 0.7 : 1;

  ctx.save();
  ctx.translate(feet.x, feet.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#0d1730';
  ctx.lineWidth = 9 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7 * scale, -6 * scale);
  ctx.lineTo(-14 * scale, -34 * scale);
  ctx.moveTo(7 * scale, -6 * scale);
  ctx.lineTo(18 * scale, -32 * scale);
  ctx.stroke();

  const jersey = ctx.createLinearGradient(0, -70 * scale, 0, -20 * scale);
  jersey.addColorStop(0, '#4ade9d');
  jersey.addColorStop(1, '#0f6b4a');
  ctx.fillStyle = jersey;
  roundRect(ctx, -16 * scale, -66 * scale, 32 * scale, 38 * scale, 8 * scale);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,236,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#06111f';
  ctx.font = `700 ${Math.round(14 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('23', 0, -48 * scale);

  ctx.strokeStyle = '#4ade9d';
  ctx.lineWidth = 8 * scale;
  ctx.beginPath();
  ctx.moveTo(-13 * scale, -60 * scale);
  ctx.lineTo(-26 * scale, (-74 - 8 * armLift) * scale);
  ctx.moveTo(13 * scale, -60 * scale);
  ctx.lineTo(26 * scale, (-74 - 8 * armLift) * scale);
  ctx.stroke();

  ctx.fillStyle = '#ffcf9f';
  ctx.beginPath();
  ctx.arc(0, -78 * scale, 11 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1730';
  ctx.beginPath();
  ctx.arc(0, -82 * scale, 11 * scale, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: HoopState,
): void {
  const radius = Math.max(6, (BALL_RADIUS / 100) * width);
  for (let index = 0; index < state.trail.length; index += 1) {
    const point = state.trail[index];
    if (!point) continue;
    const position = courtPoint(point.x, point.y, width, height);
    const alpha = (index / state.trail.length) * 0.4;
    ctx.fillStyle = `rgba(255,179,71,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, radius * (0.3 + 0.6 * (index / state.trail.length)), 0, Math.PI * 2);
    ctx.fill();
  }

  const position = courtPoint(state.ball.x, state.ball.y, width, height);
  const floor = courtPoint(0, FLOOR_Y, width, height).y;
  const heightAboveFloor = Math.max(0, floor - position.y);
  const shadowScale = Math.max(0.35, 1 - heightAboveFloor / (height * 0.6));
  ctx.fillStyle = `rgba(3,6,15,${(0.3 * shadowScale).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(position.x, floor, radius * 1.2 * shadowScale, radius * 0.34 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  const ball = ctx.createRadialGradient(
    position.x - radius * 0.35,
    position.y - radius * 0.4,
    radius * 0.2,
    position.x,
    position.y,
    radius,
  );
  ball.addColorStop(0, '#ffd9a3');
  ball.addColorStop(0.5, '#ff9f43');
  ball.addColorStop(1, '#c25a12');
  ctx.fillStyle = ball;
  ctx.beginPath();
  ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c2a08';
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(92,42,8,0.85)';
  ctx.lineWidth = Math.max(1, radius * 0.07);
  ctx.beginPath();
  ctx.ellipse(position.x, position.y, radius * 0.38, radius, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(position.x - radius, position.y);
  ctx.lineTo(position.x + radius, position.y);
  ctx.stroke();
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: HoopState,
): void {
  if (state.phase !== 'aim') return;
  const path = predictPath(state, 54);
  ctx.save();
  for (let index = 0; index < path.length; index += 2) {
    const point = path[index];
    if (!point) continue;
    if (point.y > FLOOR_Y) break;
    const position = courtPoint(point.x, point.y, width, height);
    const alpha = 0.75 * (1 - index / path.length);
    ctx.fillStyle = `rgba(105,240,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, Math.max(1.6, width * 0.0032), 0, Math.PI * 2);
    ctx.fill();
  }

  const spot = SPOTS[state.spot] ?? SPOTS[0];
  const origin = courtPoint(spot.x, spot.y, width, height);
  const angle = (state.aimAngle * Math.PI) / 180;
  const length = width * (0.05 + state.power * 0.05);
  ctx.strokeStyle = 'rgba(74,222,157,0.8)';
  ctx.lineWidth = Math.max(2, width * 0.0025);
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x + Math.cos(angle) * length, origin.y - Math.sin(angle) * length);
  ctx.stroke();
  ctx.restore();

  const meterX = width * 0.035;
  const meterTop = height * 0.58;
  const meterH = height * 0.28;
  ctx.save();
  ctx.fillStyle = 'rgba(6,12,26,0.75)';
  roundRect(ctx, meterX - width * 0.012, meterTop - height * 0.012, width * 0.028, meterH + height * 0.024, width * 0.01);
  ctx.fill();
  const fill = ctx.createLinearGradient(meterX, meterTop + meterH, meterX, meterTop);
  fill.addColorStop(0, PALETTE.mint);
  fill.addColorStop(0.6, PALETTE.cyan);
  fill.addColorStop(1, PALETTE.coral);
  ctx.fillStyle = fill;
  const filled = meterH * state.power;
  roundRect(ctx, meterX - width * 0.007, meterTop + meterH - filled, width * 0.018, filled, width * 0.008);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,236,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, meterX - width * 0.012, meterTop - height * 0.012, width * 0.028, meterH + height * 0.024, width * 0.01);
  ctx.stroke();
  ctx.restore();
}

function drawResult(ctx: CanvasRenderingContext2D, width: number, height: number, state: HoopState): void {
  if (state.phase !== 'reset' || !state.lastResult) return;
  const label =
    state.lastResult === 'swish'
      ? `SWISH +${state.lastPoints}`
      : state.lastResult === 'rim-in'
        ? `RIM IN +${state.lastPoints}`
        : 'MISS';
  ctx.save();
  ctx.font = `800 ${Math.round(width * 0.045)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = state.lastResult === 'miss' ? 'rgba(255,107,107,0.95)' : 'rgba(74,222,157,0.95)';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 22;
  ctx.fillText(label, width / 2, height * 0.47);
  if (state.streak >= 2) {
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(width * 0.018)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(220,236,255,0.8)';
    ctx.fillText(`${state.streak} in a row`, width / 2, height * 0.53);
  }
  ctx.restore();
}

export function drawHoopScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: HoopState,
): void {
  ctx.clearRect(0, 0, width, height);
  drawArena(ctx, width, height);
  drawFloor(ctx, width, height);
  drawHoop(ctx, width, height, state);
  drawAim(ctx, width, height, state);
  drawPlayer(ctx, width, height, state);
  drawBall(ctx, width, height, state);
  drawResult(ctx, width, height, state);
}
