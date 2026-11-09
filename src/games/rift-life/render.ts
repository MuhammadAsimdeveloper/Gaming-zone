import { NPC_IDS, npcById } from './npcs';
import type { LifeState, Weather } from './simulation';

export interface TownView {
  life: LifeState;
  time: number;
}

export interface TownRenderOptions {
  reducedMotion?: boolean;
}

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const STREET_LINE = 424;

const SKY: Record<Weather, [string, string, string]> = {
  clear: ['#070b1c', '#1b2b52', '#ff8a5c'],
  rain: ['#0a1220', '#1e3040', '#39506a'],
  storm: ['#080616', '#1a1130', '#3a1f52'],
};

function hash(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function drawSky(ctx: CanvasRenderingContext2D, weather: Weather): void {
  const [top, mid, horizon] = SKY[weather];
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, top);
  sky.addColorStop(0.62, mid);
  sky.addColorStop(1, horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawStars(ctx: CanvasRenderingContext2D, seed: number, weather: Weather, time: number, reduced: boolean): void {
  if (weather === 'storm') return;
  const count = weather === 'rain' ? 18 : 48;
  for (let index = 0; index < count; index += 1) {
    const x = hash(seed, index * 3 + 1) * WORLD_WIDTH;
    const y = hash(seed, index * 3 + 2) * 260;
    const twinkle = reduced ? 0.7 : 0.45 + Math.sin(time / 900 + index) * 0.25;
    ctx.globalAlpha = Math.max(0.15, twinkle);
    ctx.fillStyle = '#dce6ff';
    ctx.beginPath();
    ctx.arc(x, y, hash(seed, index * 3 + 3) > 0.85 ? 1.8 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRidge(ctx: CanvasRenderingContext2D, seed: number): void {
  ctx.fillStyle = '#0c1428';
  ctx.beginPath();
  ctx.moveTo(0, STREET_LINE);
  for (let index = 0; index <= 8; index += 1) {
    const x = (index / 8) * WORLD_WIDTH;
    const y = 250 - hash(seed, index + 40) * 90;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_WIDTH, STREET_LINE);
  ctx.closePath();
  ctx.fill();
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  height: number,
  seed: number,
  index: number,
  weather: Weather,
): void {
  const top = STREET_LINE - height;
  ctx.fillStyle = '#0e1830';
  ctx.fillRect(x, top, width, height);
  ctx.fillStyle = 'rgba(76, 141, 255, 0.14)';
  ctx.fillRect(x, top, width, 4);

  const columns = Math.max(2, Math.floor(width / 26));
  const rows = Math.max(2, Math.floor(height / 34));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const lit = hash(seed, index * 97 + row * 13 + column) > (weather === 'storm' ? 0.72 : 0.55);
      const wx = x + 10 + column * (width - 20) / columns;
      const wy = top + 16 + row * (height - 28) / rows;
      ctx.fillStyle = lit ? '#ffd27a' : 'rgba(12, 22, 44, 0.9)';
      ctx.globalAlpha = lit ? 0.85 : 1;
      ctx.fillRect(wx, wy, 10, 12);
    }
  }
  ctx.globalAlpha = 1;
}

function drawStreet(ctx: CanvasRenderingContext2D): void {
  const road = ctx.createLinearGradient(0, STREET_LINE, 0, WORLD_HEIGHT);
  road.addColorStop(0, '#101a30');
  road.addColorStop(1, '#050a17');
  ctx.fillStyle = road;
  ctx.fillRect(0, STREET_LINE, WORLD_WIDTH, WORLD_HEIGHT - STREET_LINE);

  ctx.strokeStyle = 'rgba(67, 240, 201, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, STREET_LINE + 2);
  ctx.lineTo(WORLD_WIDTH, STREET_LINE + 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(76, 141, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 40; x < WORLD_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, STREET_LINE + 18);
    ctx.lineTo(x - 26, WORLD_HEIGHT);
    ctx.stroke();
  }
}

function drawNpc(ctx: CanvasRenderingContext2D, life: LifeState, index: number): void {
  const id = NPC_IDS[index];
  const npc = npcById(id);
  const bond = life.relationships[id];
  const x = 120 + index * 180;
  const y = STREET_LINE - 8;

  if (bond >= 25) {
    ctx.fillStyle = npc.color;
    ctx.globalAlpha = bond >= 75 ? 0.22 : 0.1;
    ctx.beginPath();
    ctx.arc(x, y - 28, bond >= 75 ? 34 : 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#0a1224';
  ctx.beginPath();
  ctx.arc(x, y - 52, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = npc.color;
  ctx.globalAlpha = bond > 0 ? 0.95 : 0.4;
  ctx.fillRect(x - 6, y - 44, 12, 30);
  ctx.fillRect(x - 9, y - 14, 7, 14);
  ctx.fillRect(x + 2, y - 14, 7, 14);
  ctx.globalAlpha = 1;
}

function drawWeather(ctx: CanvasRenderingContext2D, life: LifeState, time: number, reduced: boolean): void {
  if (life.weather === 'clear') return;
  const storm = life.weather === 'storm';
  const count = storm ? 70 : 40;
  ctx.strokeStyle = storm ? 'rgba(160, 107, 255, 0.45)' : 'rgba(150, 190, 255, 0.35)';
  ctx.lineWidth = 1;
  for (let index = 0; index < count; index += 1) {
    const drift = reduced ? 0 : (time * (storm ? 0.9 : 0.55)) % WORLD_HEIGHT;
    const x = hash(life.seed, index + 300) * WORLD_WIDTH;
    const y = (hash(life.seed, index + 500) * WORLD_HEIGHT + drift) % WORLD_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (storm ? 12 : 6), y + (storm ? 26 : 18));
    ctx.stroke();
  }

  if (storm && !reduced) {
    const flash = Math.max(0, Math.sin(time / 2400)) ** 18;
    if (flash > 0.01) {
      ctx.fillStyle = '#cdd8ff';
      ctx.globalAlpha = flash * 0.35;
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawTown(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  view: TownView,
  options: TownRenderOptions = {},
): void {
  if (!ctx || canvas.width < 2 || canvas.height < 2) return;
  const reduced = options.reducedMotion ?? false;
  const scale = Math.min(canvas.width / WORLD_WIDTH, canvas.height / WORLD_HEIGHT);
  const offsetX = (canvas.width - WORLD_WIDTH * scale) / 2;
  const offsetY = (canvas.height - WORLD_HEIGHT * scale) / 2;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#040713';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  const life = view.life;
  drawSky(ctx, life.weather);
  drawStars(ctx, life.seed, life.weather, view.time, reduced);
  drawRidge(ctx, life.seed);

  for (let index = 0; index < 8; index += 1) {
    const width = 86 + hash(life.seed, index + 11) * 34;
    const height = 90 + hash(life.seed, index + 21) * 130;
    const x = 20 + index * 116;
    drawBuilding(ctx, x, width, height, life.seed + life.day, index, life.weather);
  }

  drawStreet(ctx);
  for (let index = 0; index < NPC_IDS.length; index += 1) drawNpc(ctx, life, index);
  drawWeather(ctx, life, view.time, reduced);

  ctx.restore();
}
