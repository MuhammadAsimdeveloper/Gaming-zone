/**
 * Neon Coast engine: owns the frame loop, fixed-step simulation, HUD pump,
 * renderer and audio. React only calls into this class.
 */
import { HudPump } from '../../games3d/shared/hud';
import { NeonCoastAudio, type CoastAudioChannel } from './audio';
import { definitionFor, nextTarget, rankFor, type MissionId, type MissionRuntime } from './missions';
import { defaultSave, type NeonCoastSave } from './persistence';
import { createRenderer, type NeonCoastRenderer } from './render';
import {
  CAR_ENTER_RADIUS,
  SIM_STEP,
  consumeDelta,
  createWorld,
  dayPhase,
  stepWorld,
  type DayPhase,
  type FrameBudget,
  type WorldEvent,
  type WorldInput,
  type WorldState,
} from './simulation';
import type { Point } from './world';

export interface NeonCoastHudMission {
  id: MissionId;
  name: string;
  status: MissionRuntime['status'];
  elapsed: number;
  timeLeft: number;
  timeLimit: number;
  pickedUp: boolean;
  gateIndex: number;
  gateCount: number;
  discovered: number;
  shards: number;
  shardCount: number;
  reward: number;
}

export interface NeonCoastHud {
  tick: number;
  timeOfDay: number;
  phase: DayPhase;
  position: Point;
  heading: number;
  inVehicle: boolean;
  canEnterCar: boolean;
  speed: number;
  speedKph: number;
  vehicle: { x: number; y: number; heading: number; speed: number };
  mission: NeonCoastHudMission | null;
  target: Point | null;
  distanceToTarget: number;
  traffic: Point[];
  pedestrians: Point[];
  shards: { x: number; y: number; collected: boolean }[];
  gates: { x: number; y: number; reached: boolean }[];
  cash: number;
  rank: string;
}

export interface NeonCoastCallbacks {
  onHud: (hud: NeonCoastHud) => void;
  onEvent: (event: WorldEvent) => void;
}

export interface NeonCoastEngineOptions {
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  audio?: CoastAudioChannel;
  renderer?: NeonCoastRenderer | null;
  reducedMotion?: boolean;
}

const HUD_INTERVAL_SECONDS = 0.1;
const MAX_FRAME_DELTA = 0.25;
const HANDBRAKE_SHAKE_SPEED = 150;
const SPEED_TO_KMH = 0.25;

function neutralInput(): WorldInput {
  return {
    move: { up: false, down: false, left: false, right: false, sprint: false },
    drive: { forward: false, back: false, left: false, right: false, handbrake: false },
    interact: false,
    acceptMission: null,
  };
}

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export class NeonCoastEngine {
  private world: WorldState;
  private progress: NeonCoastSave = defaultSave();
  private readonly audio: CoastAudioChannel;
  private readonly renderer: NeonCoastRenderer | null;
  private readonly now: () => number;
  private readonly requestFrame: ((callback: FrameRequestCallback) => number) | null;
  private readonly cancelFrame: ((handle: number) => void) | null;
  private readonly reducedMotion: boolean;
  private readonly hudPump: HudPump<NeonCoastHud>;
  private readonly observer: ResizeObserver | null = null;
  private input: WorldInput = neutralInput();
  private budget: FrameBudget = { accumulator: 0, steps: 0 };
  private running = false;
  private disposed = false;
  private raf = 0;
  private last = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    seed: number,
    private readonly callbacks: NeonCoastCallbacks,
    options: NeonCoastEngineOptions = {},
  ) {
    this.world = createWorld(seed);
    this.audio = options.audio ?? new NeonCoastAudio();
    this.renderer = options.renderer === undefined ? createRenderer(canvas) : options.renderer;
    this.now = options.now ?? defaultNow;
    this.requestFrame =
      options.requestFrame ??
      (typeof window !== 'undefined' ? window.requestAnimationFrame.bind(window) : null);
    this.cancelFrame =
      options.cancelFrame ??
      (typeof window !== 'undefined' ? window.cancelAnimationFrame.bind(window) : null);
    this.reducedMotion = options.reducedMotion ?? false;
    this.hudPump = new HudPump<NeonCoastHud>(
      (hud) => this.callbacks.onHud(hud),
      HUD_INTERVAL_SECONDS,
    );

    if (typeof window !== 'undefined') window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(this.handleResize);
      this.observer.observe(canvas);
    }
    this.resize();
  }

  get muted(): boolean {
    return this.audio.muted;
  }

  getWorld(): Readonly<WorldState> {
    return this.world;
  }

  setProgress(save: NeonCoastSave): void {
    this.progress = save;
    this.hudPump.push(1, () => this.buildHud(), true);
  }

  setInput(patch: Partial<WorldInput>): void {
    this.input = { ...this.input, ...patch };
  }

  start(): void {
    if (this.disposed || this.running || !this.requestFrame) return;
    this.running = true;
    this.last = this.now();
    this.audio.start();
    this.hudPump.push(1, () => this.buildHud(), true);
    this.raf = this.requestFrame(this.frame);
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    if (this.raf && this.cancelFrame) this.cancelFrame(this.raf);
    this.raf = 0;
    this.audio.suspend();
  }

  resume(): void {
    if (this.disposed || this.running || !this.requestFrame) return;
    this.running = true;
    this.last = this.now();
    this.audio.resume();
    this.raf = this.requestFrame(this.frame);
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    if (this.raf && this.cancelFrame) this.cancelFrame(this.raf);
    this.raf = 0;
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.handleResize);
    this.observer?.disconnect();
    this.audio.dispose();
    this.renderer?.dispose();
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.clientWidth || 960;
    const height = rect.height || this.canvas.clientHeight || 540;
    const dpr =
      typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.renderer?.resize(width, height, dpr);
  }

  private frame = (timestamp: number): void => {
    if (!this.running || this.disposed) return;
    this.raf = 0;

    const now = Number.isFinite(timestamp) ? timestamp : this.now();
    let delta = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    delta = Math.min(delta, MAX_FRAME_DELTA);

    this.budget = consumeDelta(this.budget, delta);
    const interact = this.input.interact;
    const acceptMission = this.input.acceptMission ?? null;

    for (let step = 0; step < this.budget.steps; step += 1) {
      const result = stepWorld(
        this.world,
        {
          move: this.input.move,
          drive: this.input.drive,
          interact: step === 0 ? interact : false,
          acceptMission: step === 0 ? acceptMission : null,
        },
        SIM_STEP,
      );
      this.world = result.state;
      for (const event of result.events) {
        this.callbacks.onEvent(event);
        this.playCue(event);
      }
    }
    // Queued taps survive sub-step frames; otherwise a zero-delta first frame
    // would silently drop the mission accept or the E press.
    if (this.budget.steps > 0) {
      this.input.interact = false;
      this.input.acceptMission = null;
    }

    this.audio.updateEngine(this.world.inVehicle ? this.world.vehicle.speed : 0);
    this.hudPump.push(delta, () => this.buildHud());

    this.renderer?.draw(this.world, {
      shake:
        !this.reducedMotion &&
        this.input.drive.handbrake &&
        Math.abs(this.world.vehicle.speed) > HANDBRAKE_SHAKE_SPEED
          ? 3
          : 0,
      reducedMotion: this.reducedMotion,
      dt: delta,
    });

    if (this.requestFrame) this.raf = this.requestFrame(this.frame);
  };

  private playCue(event: WorldEvent): void {
    switch (event.type) {
      case 'checkpoint':
        this.audio.cue('checkpoint');
        break;
      case 'discover':
        this.audio.cue('discover');
        break;
      case 'shard':
        this.audio.cue('shard');
        break;
      case 'mission-complete':
        this.audio.cue('complete');
        break;
      case 'mission-failed':
        this.audio.cue('failed');
        break;
      case 'enter-car':
        this.audio.cue('enter-car');
        break;
      case 'exit-car':
        this.audio.cue('exit-car');
        break;
      default:
        break;
    }
  }

  private buildHud(): NeonCoastHud {
    const world = this.world;
    const mission = world.mission;
    const definition = mission ? definitionFor(mission.id) : null;
    const position = world.inVehicle
      ? { x: world.vehicle.x, y: world.vehicle.z }
      : { x: world.player.x, y: world.player.z };
    const target = mission ? nextTarget(mission) : null;

    return {
      tick: world.tick,
      timeOfDay: world.timeOfDay,
      phase: dayPhase(world.timeOfDay),
      position,
      heading: world.inVehicle ? world.vehicle.heading : world.player.heading,
      inVehicle: world.inVehicle,
      canEnterCar:
        !world.inVehicle &&
        Math.hypot(world.player.x - world.vehicle.x, world.player.z - world.vehicle.z) <=
          CAR_ENTER_RADIUS,
      speed: Math.abs(world.vehicle.speed),
      speedKph: Math.round(Math.abs(world.vehicle.speed) * SPEED_TO_KMH),
      vehicle: {
        x: world.vehicle.x,
        y: world.vehicle.z,
        heading: world.vehicle.heading,
        speed: world.vehicle.speed,
      },
      mission:
        mission && definition
          ? {
              id: mission.id,
              name: definition.name,
              status: mission.status,
              elapsed: mission.elapsed,
              timeLeft: Math.max(0, definition.timeLimit - mission.elapsed),
              timeLimit: definition.timeLimit,
              pickedUp: mission.pickedUp,
              gateIndex: mission.gateIndex,
              gateCount: mission.gates.length,
              discovered: mission.discovered.length,
              shards: mission.collected.length,
              shardCount: mission.shards.length,
              reward: definition.reward,
            }
          : null,
      target,
      distanceToTarget: target
        ? Math.hypot(target.x - position.x, target.y - position.y)
        : 0,
      traffic: world.traffic.map((car) => ({ ...car.position })),
      pedestrians: world.pedestrians.map((ped) => ({ ...ped.position })),
      shards:
        mission && mission.id === 'glow-run'
          ? mission.shards.map((shard, index) => ({
              x: shard.x,
              y: shard.y,
              collected: mission.collected.includes(index),
            }))
          : [],
      gates:
        mission && mission.id === 'lantern-circuit'
          ? mission.gates.map((gate, index) => ({
              x: gate.x,
              y: gate.y,
              reached: index < mission.gateIndex,
            }))
          : [],
      cash: this.progress.cash,
      rank: rankFor(this.progress.completed),
    };
  }
}
