/**
 * Canvas 2D renderer for Vela District.
 *
 * The district is drawn once into an offscreen layer; each frame only draws
 * the camera transform, dynamic entities, a day/night tint and a vignette.
 */
import { nextTarget } from './missions';
import { dayPhase, type WorldState } from './simulation';
import {
  PAVED_AREAS,
  ROAD_HALF_WIDTH,
  ROAD_HORIZONTAL,
  ROAD_VERTICAL,
  SIDEWALK_WIDTH,
  SOLARA_LANDMARKS,
  VELA_DISTRICT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Landmark,
} from './world';

export interface RenderOptions {
  /** Camera shake in world units; the engine zeroes this for reduced motion. */
  shake: number;
  reducedMotion: boolean;
  /** Seconds since the previous frame, used to smooth the camera. */
  dt: number;
}

export interface NeonCoastRenderer {
  draw(world: WorldState, options: RenderOptions): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

const STATIC_SCALE = 0.5;
const WATER = '#07242c';
const GRASS = '#14312c';
const PLAZA = '#17313a';
const ROAD = '#0f2933';
const SIDEWALK = '#22424a';
const MINT = '#7ef0b2';
const CORAL = '#ff8a6a';
const AMBER = '#ffc46b';
const CREAM = '#ffe9cc';

const ROOF_COLORS = ['#b35c46', '#a9723f', '#2f6b63', '#8c4b5c', '#3b5d72', '#7a5a48'];

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGlyph(ctx: CanvasRenderingContext2D, landmark: Landmark): void {
  const { x, y } = landmark;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = AMBER;
  ctx.fillStyle = 'rgba(255, 196, 107, 0.2)';
  ctx.lineWidth = 3;
  switch (landmark.kind) {
    case 'garage':
      ctx.beginPath();
      ctx.moveTo(-16, 6);
      ctx.lineTo(-16, -4);
      ctx.lineTo(0, -16);
      ctx.lineTo(16, -4);
      ctx.lineTo(16, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'market':
      for (let stripe = -2; stripe <= 2; stripe += 1) {
        ctx.fillRect(stripe * 8 - 3, -8, 6, 16);
      }
      ctx.strokeRect(-20, 8, 40, 4);
      break;
    case 'tower':
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-12, 12);
      ctx.moveTo(0, -18);
      ctx.lineTo(12, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -18, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'pier':
      for (let plank = -2; plank <= 2; plank += 1) {
        ctx.fillRect(-18, plank * 7 - 2, 36, 4);
      }
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, 16);
      ctx.stroke();
      break;
    case 'plaza':
      for (let step = 0; step < 3; step += 1) {
        ctx.strokeRect(-18 + step * 4, 4 + step * 5, 36 - step * 8, 4);
      }
      break;
    case 'arcade':
      roundedRect(ctx, -18, -12, 36, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = MINT;
      for (let light = -1; light <= 1; light += 1) {
        ctx.beginPath();
        ctx.arc(light * 9, 0, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'depot':
      ctx.beginPath();
      ctx.moveTo(-16, -10);
      ctx.lineTo(16, -10);
      ctx.moveTo(-16, 10);
      ctx.lineTo(16, 10);
      ctx.stroke();
      for (let sleeper = -2; sleeper <= 2; sleeper += 1) {
        ctx.fillRect(sleeper * 8 - 2, -10, 4, 20);
      }
      break;
    case 'park':
      ctx.beginPath();
      ctx.arc(-8, 2, 8, 0, Math.PI * 2);
      ctx.arc(9, 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function buildDistrictLayer(): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = Math.round(WORLD_WIDTH * STATIC_SCALE);
  layer.height = Math.round(WORLD_HEIGHT * STATIC_SCALE);
  const ctx = layer.getContext('2d');
  if (!ctx) return layer;
  ctx.scale(STATIC_SCALE, STATIC_SCALE);

  ctx.fillStyle = GRASS;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = WATER;
  ctx.fillRect(0, WORLD_HEIGHT - 120, WORLD_WIDTH, 120);
  ctx.strokeStyle = 'rgba(126, 240, 178, 0.22)';
  ctx.lineWidth = 2;
  for (let wave = 0; wave < 4; wave += 1) {
    const y = WORLD_HEIGHT - 96 + wave * 26;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 60) {
      const offset = Math.sin(x / 90 + wave) * 6;
      if (x === 0) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }

  for (const x of ROAD_VERTICAL) {
    ctx.fillStyle = SIDEWALK;
    ctx.fillRect(x - ROAD_HALF_WIDTH - SIDEWALK_WIDTH, 0, (ROAD_HALF_WIDTH + SIDEWALK_WIDTH) * 2, WORLD_HEIGHT);
  }
  for (const y of ROAD_HORIZONTAL) {
    ctx.fillStyle = SIDEWALK;
    ctx.fillRect(0, y - ROAD_HALF_WIDTH - SIDEWALK_WIDTH, WORLD_WIDTH, (ROAD_HALF_WIDTH + SIDEWALK_WIDTH) * 2);
  }

  ctx.fillStyle = ROAD;
  for (const x of ROAD_VERTICAL) {
    ctx.fillRect(x - ROAD_HALF_WIDTH, 0, ROAD_HALF_WIDTH * 2, WORLD_HEIGHT);
  }
  for (const y of ROAD_HORIZONTAL) {
    ctx.fillRect(0, y - ROAD_HALF_WIDTH, WORLD_WIDTH, ROAD_HALF_WIDTH * 2);
  }

  ctx.strokeStyle = 'rgba(255, 220, 170, 0.16)';
  ctx.lineWidth = 3;
  ctx.setLineDash([38, 38]);
  for (const x of ROAD_VERTICAL) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }
  for (const y of ROAD_HORIZONTAL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const area of PAVED_AREAS) {
    ctx.fillStyle = '#25434a';
    roundedRect(ctx, area.x, area.y, area.width, area.height, 14);
    ctx.fill();
  }

  VELA_DISTRICT.blocks.forEach((block, index) => {
    const { bounds } = block;
    ctx.fillStyle = PLAZA;
    roundedRect(ctx, bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(126, 240, 178, 0.16)';
    ctx.lineWidth = 3;
    ctx.stroke();

    block.buildings.forEach((building, side) => {
      const roof = ROOF_COLORS[(index * 2 + side) % ROOF_COLORS.length]!;
      ctx.fillStyle = '#102630';
      roundedRect(ctx, building.x, building.y, building.width, building.height, 8);
      ctx.fill();
      ctx.fillStyle = roof;
      roundedRect(ctx, building.x + 6, building.y + 6, building.width - 12, building.height - 12, 6);
      ctx.fill();

      const units = Math.max(1, Math.floor(building.height / 70));
      for (let unit = 0; unit < units; unit += 1) {
        const uy = building.y + 22 + unit * 62;
        ctx.fillStyle = 'rgba(10, 24, 30, 0.45)';
        ctx.fillRect(building.x + 22, uy, building.width - 44, 20);
        ctx.fillStyle = 'rgba(255, 233, 204, 0.16)';
        ctx.fillRect(building.x + 26, uy + 4, building.width - 52, 4);
      }
    });
  });

  for (const prop of VELA_DISTRICT.props) {
    ctx.fillStyle = '#28564d';
    roundedRect(ctx, prop.x, prop.y, prop.width, prop.height, 5);
    ctx.fill();
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.arc(prop.x + prop.width / 2, prop.y + prop.height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const landmark of SOLARA_LANDMARKS) {
    ctx.fillStyle = 'rgba(255, 196, 107, 0.07)';
    ctx.beginPath();
    ctx.arc(landmark.x, landmark.y, landmark.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 196, 107, 0.38)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(landmark.x, landmark.y, landmark.radius - 6, 0, Math.PI * 2);
    ctx.stroke();

    drawGlyph(ctx, landmark);

    ctx.fillStyle = CREAM;
    ctx.font = "600 20px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(landmark.name, landmark.x, landmark.y + landmark.radius + 22);
  }

  return layer;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

class CanvasRenderer implements NeonCoastRenderer {
  private cssWidth = 800;
  private cssHeight = 600;
  private dpr = 1;
  private cameraX = VELA_DISTRICT.spawn.x;
  private cameraY = VELA_DISTRICT.spawn.y;
  private readonly layer: HTMLCanvasElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ctx: CanvasRenderingContext2D,
  ) {
    this.layer = buildDistrictLayer();
  }

  resize(width: number, height: number, dpr: number): void {
    this.cssWidth = Math.max(1, width);
    this.cssHeight = Math.max(1, height);
    this.dpr = clamp(dpr, 1, 2);
    const pixelWidth = Math.round(this.cssWidth * this.dpr);
    const pixelHeight = Math.round(this.cssHeight * this.dpr);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
  }

  draw(world: WorldState, options: RenderOptions): void {
    const ctx = this.ctx;
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width <= 0 || height <= 0) return;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const focus = world.inVehicle
      ? { x: world.vehicle.x, y: world.vehicle.z }
      : { x: world.player.x, y: world.player.z };
    const zoom = clamp(Math.min(width / 1500, height / 1000), 0.42, 1.1);
    const halfWidth = width / (2 * zoom);
    const halfHeight = height / (2 * zoom);
    const cameraX = clamp(focus.x, halfWidth, WORLD_WIDTH - halfWidth);
    const cameraY = clamp(focus.y, halfHeight, WORLD_HEIGHT - halfHeight);

    const smoothing = options.reducedMotion ? 1 : clamp(options.dt * 9, 0.12, 1);
    this.cameraX += (cameraX - this.cameraX) * smoothing;
    this.cameraY += (cameraY - this.cameraY) * smoothing;

    const shakeX = options.shake > 0 ? Math.sin(world.tick * 2.3) * options.shake : 0;
    const shakeY = options.shake > 0 ? Math.cos(world.tick * 1.7) * options.shake : 0;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

    ctx.drawImage(this.layer, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const pulse = options.reducedMotion ? 0.8 : 0.65 + 0.35 * Math.sin(world.tick / 6);
    this.drawMissionOverlay(world, pulse);
    this.drawTraffic(world);
    this.drawPedestrians(world);
    this.drawVehicle(world, pulse);
    if (!world.inVehicle) this.drawPlayer(world);

    ctx.restore();

    this.drawLight(world);
  }

  private drawMissionOverlay(world: WorldState, pulse: number): void {
    const ctx = this.ctx;
    const mission = world.mission;
    if (!mission || mission.status !== 'active') return;

    if (mission.id === 'glow-run') {
      mission.shards.forEach((shard, index) => {
        if (mission.collected.includes(index)) return;
        ctx.save();
        ctx.translate(shard.x, shard.y);
        ctx.rotate(Math.PI / 4);
        ctx.shadowColor = 'rgba(126, 240, 216, 0.8)';
        ctx.shadowBlur = 18 * pulse;
        ctx.fillStyle = '#7ef0d8';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();
        ctx.strokeStyle = 'rgba(126, 240, 216, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(shard.x, shard.y, 26 * pulse, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    if (mission.id === 'lantern-circuit') {
      mission.gates.forEach((gate, index) => {
        const reached = index < mission.gateIndex;
        const next = index === mission.gateIndex;
        ctx.strokeStyle = reached
          ? 'rgba(126, 240, 178, 0.25)'
          : next
            ? '#ffd166'
            : 'rgba(255, 196, 107, 0.45)';
        ctx.lineWidth = next ? 6 : 3;
        ctx.beginPath();
        ctx.arc(gate.x, gate.y, next ? 96 : 80, 0, Math.PI * 2);
        ctx.stroke();
        if (next) {
          ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
          ctx.fill();
        }
      });
    }

    if (mission.id === 'landmark-trail') {
      for (const landmark of SOLARA_LANDMARKS) {
        const found = mission.discovered.includes(landmark.id);
        ctx.fillStyle = found ? 'rgba(126, 240, 178, 0.45)' : `rgba(255, 196, 107, ${0.3 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(landmark.x, landmark.y, found ? 10 : 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const target = nextTarget(mission);
    if (target) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 44 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
      ctx.fill();
    }
  }

  private drawTraffic(world: WorldState): void {
    const palette = [CORAL, AMBER, '#9ad7c8', '#e8a3b4', '#c8b0ff', '#ffd9a0'];
    world.traffic.forEach((car, index) => {
      this.drawCar(
        car.position.x,
        car.position.y,
        car.heading,
        palette[index % palette.length]!,
        'rgba(10, 24, 30, 0.55)',
        0.82,
        world,
      );
    });
  }

  private drawPedestrians(world: WorldState): void {
    const ctx = this.ctx;
    for (const ped of world.pedestrians) {
      ctx.fillStyle = ped.mood === 'pausing' ? '#e8d5b5' : '#9fe0c8';
      ctx.beginPath();
      ctx.arc(ped.position.x, ped.position.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1a20';
      ctx.beginPath();
      ctx.arc(
        ped.position.x + Math.sin(ped.heading) * 3,
        ped.position.y - Math.cos(ped.heading) * 3,
        2.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  private drawVehicle(world: WorldState, pulse: number): void {
    const { vehicle } = world;
    this.drawCar(vehicle.x, vehicle.z, vehicle.heading, '#7ef0b2', CORAL, 1, world);
    if (world.inVehicle) {
      this.ctx.strokeStyle = `rgba(126, 240, 178, ${0.25 + pulse * 0.35})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(vehicle.x, vehicle.z, 34, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  private drawCar(
    x: number,
    y: number,
    heading: number,
    body: string,
    accent: string,
    scale: number,
    world: WorldState,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    roundedRect(ctx, -14, -22, 30, 48, 8);
    ctx.fill();

    ctx.fillStyle = body;
    roundedRect(ctx, -14, -24, 28, 48, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(8, 22, 28, 0.7)';
    ctx.fillRect(-9, -15, 18, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(-10, 2, 20, 5);

    const phase = dayPhase(world.timeOfDay);
    if (phase === 'dusk' || phase === 'night') {
      ctx.fillStyle = 'rgba(255, 233, 176, 0.9)';
      ctx.fillRect(-10, -26, 6, 3);
      ctx.fillRect(4, -26, 6, 3);
      ctx.fillStyle = 'rgba(255, 220, 150, 0.08)';
      ctx.beginPath();
      ctx.moveTo(-13, -24);
      ctx.lineTo(-38, -78);
      ctx.lineTo(38, -78);
      ctx.lineTo(13, -24);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(world: WorldState): void {
    const ctx = this.ctx;
    const { player } = world;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(player.x + 2, player.z + 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8ef0d0';
    ctx.beginPath();
    ctx.arc(player.x, player.z, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b1a20';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0b1a20';
    ctx.beginPath();
    ctx.moveTo(player.x + Math.sin(player.heading) * 12, player.z - Math.cos(player.heading) * 12);
    ctx.lineTo(
      player.x + Math.sin(player.heading + 2.5) * 7,
      player.z - Math.cos(player.heading + 2.5) * 7,
    );
    ctx.lineTo(
      player.x + Math.sin(player.heading - 2.5) * 7,
      player.z - Math.cos(player.heading - 2.5) * 7,
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawLight(world: WorldState): void {
    const ctx = this.ctx;
    const phase = dayPhase(world.timeOfDay);
    const darkness = phase === 'night' ? 0.46 : phase === 'dusk' ? 0.22 : phase === 'dawn' ? 0.14 : 0.02;

    ctx.fillStyle = `rgba(4, 10, 24, ${darkness})`;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    if (phase === 'dusk') {
      ctx.fillStyle = 'rgba(255, 122, 84, 0.07)';
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
    }

    const vignette = ctx.createRadialGradient(
      this.cssWidth / 2,
      this.cssHeight / 2,
      Math.min(this.cssWidth, this.cssHeight) * 0.32,
      this.cssWidth / 2,
      this.cssHeight / 2,
      Math.max(this.cssWidth, this.cssHeight) * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, `rgba(0, 0, 0, ${0.42 + darkness * 0.2})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  dispose(): void {
    this.layer.width = 0;
    this.layer.height = 0;
  }
}

export function createRenderer(canvas: HTMLCanvasElement): NeonCoastRenderer | null {
  if (typeof document === 'undefined') return null;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;
  return new CanvasRenderer(canvas, ctx);
}
