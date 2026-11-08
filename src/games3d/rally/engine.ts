import * as THREE from 'three';
import { writeString, readString } from '../../lib/storage';
import { createKeyboard, readDriveInput, type TouchDriveState } from '../shared/input';
import { clamp, damp, normalizeAngle } from '../shared/math';
import {
  createCar,
  createCity,
  createRoad,
  createStartGate,
  createTrackLights,
  disposeObject,
  type VehicleVisual,
} from '../shared/scenery';
import { RallyAudio } from './audio';
import { decodeGhost, encodeGhost, GhostRecorder, sampleGhost, type GhostSample } from './ghost';
import {
  CAR_CLASSES,
  aiDriveInput,
  createVehicle,
  mulberry32,
  speedOf,
  stepVehicle,
  type AiTier,
  type CarClass,
  type CarClassId,
  type DriveInput,
  type RallyVehicle,
  type Weather,
} from './physics';
import {
  createLapProgress,
  getRallyTrack,
  isOnRallyTrack,
  nearestTrackIndex,
  projectToMinimap,
  registerGatePass,
  trackFrame,
  type LapProgress,
  type RallyTrack,
  type RallyTrackId,
} from './track';

export type CameraMode = 'chase' | 'wide' | 'hood';
export type RallyPhase = 'countdown' | 'racing' | 'finished';

export interface RallyHud {
  speed: number;
  gear: number;
  lap: number;
  totalLaps: number;
  position: number;
  racers: number;
  raceTime: number;
  lastLap: number | null;
  bestLap: number | null;
  countdown: number;
  phase: RallyPhase;
  offTrack: boolean;
  driftCharge: number;
  boostTime: number;
  weather: Weather;
  minimapPlayer: { x: number; y: number };
  minimapRivals: Array<{ x: number; y: number }>;
}

export interface RallySetup {
  trackId: RallyTrackId;
  carId: CarClassId;
  weather: Weather;
  aiTier: AiTier;
  camera: CameraMode;
}

export interface RallyResultRow {
  position: number;
  name: string;
  isPlayer: boolean;
  finishTime: number | null;
  bestLap: number | null;
  lapsCompleted: number;
}

export interface RallyResult {
  rows: RallyResultRow[];
  playerPosition: number;
  raceTime: number;
  bestLap: number | null;
  newBestLap: boolean;
  trackId: RallyTrackId;
  carId: CarClassId;
  weather: Weather;
}

interface RallyCallbacks {
  onHud: (hud: RallyHud) => void;
  onFinish: (result: RallyResult) => void;
}

interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  visual: VehicleVisual;
  car: CarClass;
  vehicle: RallyVehicle;
  index: number;
  lap: LapProgress;
  lapStartedAt: number;
  lastLap: number | null;
  bestLap: number | null;
  finished: boolean;
  finishTime: number | null;
  lane: number;
  rng: () => number;
  wheelSpin: number;
}

const TOTAL_LAPS = 3;
const STEP = 1 / 60;
const COUNTDOWN_SECONDS = 3.2;

export const RALLY_BEST_LAP_KEY = 'neonrift:game:rift-rally:best-lap';

function ghostKey(trackId: RallyTrackId): string {
  return `neonrift:game:rift-rally:ghost:${trackId}`;
}

function headingFromTangent(tangent: { x: number; z: number }): number {
  return Math.atan2(tangent.x, tangent.z);
}

function aiCar(base: CarClass, tier: AiTier): CarClass {
  const factor = tier === 'rookie' ? 0.9 : tier === 'pro' ? 0.96 : 1;
  return { ...base, maxSpeed: base.maxSpeed * factor, accel: base.accel * factor };
}

export class RallyEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cameraObject = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 950);
  private keyboard: ReturnType<typeof createKeyboard>;
  private touch: TouchDriveState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    handbrake: false,
  };
  private audio = new RallyAudio();
  private track: RallyTrack;
  private setup: RallySetup;
  private callbacks: RallyCallbacks;
  private racers: Racer[] = [];
  private player!: Racer;
  private ghostVisual: VehicleVisual | null = null;
  private ghostSamples: GhostSample[] | null = null;
  private ghostDuration = 0;
  private recorder = new GhostRecorder();
  private rain: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private paused = false;
  private disposed = false;
  private phase: RallyPhase = 'countdown';
  private countdown = COUNTDOWN_SECONDS;
  private lastCountdownBeep = 4;
  private raceTime = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private hudTimer = 0;
  private shake = 0;
  private cameraMode: CameraMode;
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private collisionCooldown = 0;
  private finished = false;
  private previousBestLap: number | null;
  private aiNames = ['Rook', 'Juno', 'Piper'];

  constructor(
    private canvas: HTMLCanvasElement,
    setup: RallySetup,
    callbacks: RallyCallbacks,
  ) {
    this.setup = setup;
    this.callbacks = callbacks;
    this.track = getRallyTrack(setup.trackId);
    const storedBest = readString(RALLY_BEST_LAP_KEY);
    const parsedBest = storedBest === null ? Number.NaN : Number(storedBest);
    this.previousBestLap = Number.isFinite(parsedBest) ? parsedBest : null;
    this.cameraMode = setup.camera;
    this.keyboard = createKeyboard(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(this.track.skyColor);
    this.scene.fog = new THREE.Fog(this.track.fogColor, 130, 460);

    this.buildWorld();
    this.loadGhost();
    this.spawnRacers();
    this.resize();
    window.addEventListener('resize', this.handleResize);
    this.start();
  }

  private buildWorld(): void {
    this.scene.add(new THREE.HemisphereLight('#8bb8ff', '#05070f', 0.9));

    const sun = new THREE.DirectionalLight('#cfe3ff', 2.05);
    sun.position.set(90, 130, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 360;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    this.scene.add(sun);

    const center = this.track.points.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x / this.track.points.length,
        z: accumulator.z + point.z / this.track.points.length,
      }),
      { x: 0, z: 0 },
    );
    const maxRadius = this.track.points.reduce(
      (maximum, point) => Math.max(maximum, Math.hypot(point.x - center.x, point.z - center.z)),
      0,
    );

    this.scene.add(createRoad(this.track.points, this.track.width, this.track.curbColors).group);
    this.scene.add(
      createCity({
        center,
        radius: maxRadius + 180,
        count: 150,
        avoidRadius: maxRadius + 26,
        seed: this.track.seed,
      }),
    );
    this.scene.add(createTrackLights(this.track.points));

    const startFrame = trackFrame(this.track.points, 0);
    this.scene.add(
      createStartGate(
        startFrame.point,
        headingFromTangent(startFrame.tangent),
        this.track.accent,
      ),
    );

    const glow = new THREE.PointLight(this.track.accent, 3.2, 44, 2);
    glow.position.set(startFrame.point.x, 4, startFrame.point.z);
    this.scene.add(glow);

    if (this.setup.weather === 'rain') this.buildRain();
  }

  private buildRain(): void {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 190;
      positions[index * 3 + 1] = Math.random() * 62;
      positions[index * 3 + 2] = (Math.random() - 0.5) * 190;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: '#9fd8ff',
      size: 0.34,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.rainPositions = positions;
    this.rain = points;
    this.scene.add(points);
  }

  private loadGhost(): void {
    const raw = readString(ghostKey(this.track.id));
    if (!raw) return;
    const samples = decodeGhost(raw);
    if (!samples || samples.length < 2) return;
    this.ghostSamples = samples;
    this.ghostDuration = samples.at(-1)!.t;
    this.ghostVisual = createCar('#bfe6ff', '#8fd6ff');
    this.ghostVisual.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        material.transparent = true;
        material.opacity = 0.3;
        material.depthWrite = false;
        material.emissive = new THREE.Color('#2f7fb0');
        material.emissiveIntensity = 0.5;
      }
    });
    this.ghostVisual.group.visible = false;
    this.scene.add(this.ghostVisual.group);
  }

  private spawnRacers(): void {
    const playerClass = CAR_CLASSES[this.setup.carId];
    const rivalClasses: CarClassId[] = ['grip', 'balanced', 'drift'];
    const grid: Array<{ index: number; lane: number; name: string; player: boolean }> = [
      { index: this.track.points.length - 8, lane: -3.3, name: this.aiNames[0]!, player: false },
      { index: this.track.points.length - 9, lane: 3.3, name: this.aiNames[1]!, player: false },
      { index: this.track.points.length - 16, lane: -3.3, name: this.aiNames[2]!, player: false },
      { index: this.track.points.length - 17, lane: 3.3, name: 'You', player: true },
    ];

    grid.forEach((slot, slotIndex) => {
      const frame = trackFrame(this.track.points, slot.index);
      const x = frame.point.x + frame.normal.x * slot.lane;
      const z = frame.point.z + frame.normal.z * slot.lane;
      const base = slot.player
        ? playerClass
        : aiCar(CAR_CLASSES[rivalClasses[slotIndex] ?? 'balanced'], this.setup.aiTier);
      const color = slot.player ? '#f3f7ff' : ['#ff6b9d', '#38e8ff', '#ffcf5c'][slotIndex] ?? '#38e8ff';
      const accent = slot.player ? '#4c8dff' : this.track.accent;
      const visual = createCar(color, accent);
      const heading = headingFromTangent(frame.tangent);
      visual.group.position.set(x, 0, z);
      visual.group.rotation.y = heading + Math.PI;
      this.scene.add(visual.group);

      const racer: Racer = {
        id: slot.player ? 'player' : `ai-${slotIndex}`,
        name: slot.name,
        isPlayer: slot.player,
        visual,
        car: base,
        vehicle: createVehicle(x, z, heading),
        index: slot.index,
        lap: createLapProgress(this.track.checkpoints.length),
        lapStartedAt: 0,
        lastLap: null,
        bestLap: null,
        finished: false,
        finishTime: null,
        lane: slot.lane,
        rng: mulberry32(this.track.seed + slotIndex * 7919),
        wheelSpin: 0,
      };
      this.racers.push(racer);
      if (slot.player) this.player = racer;
    });

    this.cameraPosition.set(
      this.player.vehicle.x - Math.sin(this.player.vehicle.heading) * 9,
      4.4,
      this.player.vehicle.z - Math.cos(this.player.vehicle.heading) * 9,
    );
    this.cameraObject.position.copy(this.cameraPosition);
  }

  start(): void {
    this.audio.start();
    this.lastFrame = performance.now();
    this.renderer.setAnimationLoop(this.loop);
    this.canvas.focus();
    this.emitHud();
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const frameDelta = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown -= frameDelta;
      const display = Math.max(0, Math.ceil(this.countdown - 0.2));
      if (display < this.lastCountdownBeep) {
        this.lastCountdownBeep = display;
        this.audio.countdown(display <= 0);
      }
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.raceTime = 0;
        this.recorder = new GhostRecorder();
        this.audio.engine(0);
      }
    } else if (this.phase === 'racing') {
      this.accumulator = Math.min(this.accumulator + frameDelta, STEP * 6);
      let steps = 0;
      while (this.accumulator >= STEP && steps < 5 && !this.finished) {
        this.simulate(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }
      const ratio = clamp(speedOf(this.player.vehicle) / this.player.car.maxSpeed, 0, 1);
      this.audio.engine(ratio);
      this.audio.skid(Math.abs(this.player.vehicle.driftCharge), STEP);
      this.shake = Math.max(0, this.shake - frameDelta * 2.2);
    }

    this.updateVisuals();
    this.updateRain(frameDelta);
    this.updateGhost();
    this.updateCamera(frameDelta);
    this.renderer.render(this.scene, this.cameraObject);

    this.hudTimer += frameDelta;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHud();
    }
  };

  private simulate(dt: number): void {
    this.raceTime += dt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

    for (const racer of this.racers) {
      if (racer.finished) {
        racer.vehicle = stepVehicle(
          racer.vehicle,
          racer.car,
          { throttle: false, brake: true, steer: 0, handbrake: false },
          { weather: this.setup.weather, onTrack: true },
          dt,
        );
        this.syncRacer(racer, dt);
        continue;
      }

      const input = racer.isPlayer ? this.playerInput() : this.aiInput(racer);
      const onTrack = isOnRallyTrack(this.track, racer.vehicle.x, racer.vehicle.z, racer.index);
      racer.vehicle = stepVehicle(
        racer.vehicle,
        racer.car,
        input,
        { weather: this.setup.weather, onTrack },
        dt,
      );
      this.syncRacer(racer, dt);
      this.updateLap(racer);
      if (this.finished) return;
    }

    this.resolveCollisions();

    if (this.player.isPlayer) {
      this.recorder.push(
        this.raceTime - this.player.lapStartedAt,
        this.player.vehicle.x,
        this.player.vehicle.z,
        this.player.vehicle.heading,
      );
    }
  }

  private playerInput(): DriveInput {
    const drive = readDriveInput(this.keyboard.keys, this.touch);
    return {
      throttle: drive.forward,
      brake: drive.back,
      steer: (drive.right ? 1 : 0) - (drive.left ? 1 : 0),
      handbrake: drive.handbrake,
    };
  }

  private aiInput(racer: Racer): DriveInput {
    const count = this.track.points.length;
    const lookAhead = Math.round(10 + speedOf(racer.vehicle) * 0.4);
    const targetIndex = (racer.index + lookAhead) % count;
    const frame = trackFrame(this.track.points, targetIndex);
    const target = {
      x: frame.point.x + frame.normal.x * (racer.lane * 0.55),
      z: frame.point.z + frame.normal.z * (racer.lane * 0.55),
    };
    const input = aiDriveInput(
      racer.vehicle,
      target,
      racer.car,
      this.setup.aiTier,
      racer.rng,
    );

    const far = trackFrame(this.track.points, (racer.index + 34) % count);
    const near = trackFrame(this.track.points, racer.index);
    const curvature = Math.abs(
      normalizeAngle(headingFromTangent(far.tangent) - headingFromTangent(near.tangent)),
    );
    const cornerSpeed = racer.car.maxSpeed * clamp(1 - curvature * 0.62, 0.42, 1);
    if (speedOf(racer.vehicle) > cornerSpeed) {
      return { ...input, throttle: false, brake: true, handbrake: curvature > 1.1 };
    }
    return input;
  }

  private syncRacer(racer: Racer, dt: number): void {
    const vehicle = racer.vehicle;
    let index = nearestTrackIndex(this.track.points, vehicle.x, vehicle.z, racer.index);
    const frame = trackFrame(this.track.points, index);
    if (Math.hypot(frame.point.x - vehicle.x, frame.point.z - vehicle.z) > 48) {
      index = nearestTrackIndex(this.track.points, vehicle.x, vehicle.z);
    }
    racer.index = index;

    const lateral =
      (vehicle.x - frame.point.x) * frame.normal.x +
      (vehicle.z - frame.point.z) * frame.normal.z;
    const limit = this.track.width / 2 + 2.1;
    if (Math.abs(lateral) > limit) {
      const excess = Math.abs(lateral) - limit;
      const sign = Math.sign(lateral) || 1;
      racer.vehicle = {
        ...vehicle,
        x: vehicle.x - frame.normal.x * excess * sign,
        z: vehicle.z - frame.normal.z * excess * sign,
        vx: vehicle.vx * 0.72,
        vz: vehicle.vz * 0.72,
      };
      if (racer.isPlayer && this.collisionCooldown <= 0 && speedOf(vehicle) > 9) {
        this.audio.impact(clamp(speedOf(vehicle) / 50, 0.3, 1));
        this.shake = 0.5;
        this.collisionCooldown = 0.45;
      }
    }

    racer.wheelSpin += speedOf(racer.vehicle) * dt * 1.4;
  }

  private updateLap(racer: Racer): void {
    const previousLap = racer.lap.lap;
    const next = registerGatePass(this.track, racer.lap, racer.index, this.raceTime);
    if (next.lap === previousLap) {
      racer.lap = next;
      return;
    }

    const lapTime = this.raceTime - racer.lapStartedAt;
    racer.lapStartedAt = this.raceTime;
    racer.lastLap = lapTime;
    const improved = racer.bestLap === null || lapTime < racer.bestLap;
    if (improved) racer.bestLap = lapTime;
    racer.lap = next;

    if (racer.isPlayer) {
      this.audio.lap(improved);
      if (improved && this.recorder.samples.length > 1) {
        writeString(ghostKey(this.track.id), encodeGhost(this.recorder.samples));
        this.ghostSamples = this.recorder.samples.map((sample) => ({ ...sample }));
        this.ghostDuration = this.recorder.samples.at(-1)!.t;
      }
      this.recorder = new GhostRecorder();
    }

    if (next.lap > TOTAL_LAPS) this.finishRacer(racer);
  }

  private finishRacer(racer: Racer): void {
    racer.finished = true;
    racer.finishTime = this.raceTime;
    racer.vehicle = { ...racer.vehicle, vx: 0, vz: 0 };
    if (!racer.isPlayer || this.finished) return;
    this.finished = true;
    this.phase = 'finished';
    this.audio.finish();

    const rows: RallyResultRow[] = this.standings().map((entry, index) => ({
      position: index + 1,
      name: entry.name,
      isPlayer: entry.isPlayer,
      finishTime: entry.finished ? entry.finishTime : null,
      bestLap: entry.bestLap,
      lapsCompleted: Math.min(TOTAL_LAPS, entry.lap.lap - 1),
    }));
    const playerPosition = rows.find((row) => row.isPlayer)?.position ?? this.racers.length;

    this.callbacks.onFinish({
      rows,
      playerPosition,
      raceTime: this.raceTime,
      bestLap: this.player.bestLap,
      newBestLap:
        this.player.bestLap !== null &&
        (this.previousBestLap === null || this.player.bestLap < this.previousBestLap),
      trackId: this.setup.trackId,
      carId: this.setup.carId,
      weather: this.setup.weather,
    });
    this.emitHud();
  }

  private standings(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.finished) return -1;
      if (b.finished) return 1;
      const aProgress = (a.lap.lap - 1) * this.track.points.length + a.index;
      const bProgress = (b.lap.lap - 1) * this.track.points.length + b.index;
      return bProgress - aProgress;
    });
  }

  private resolveCollisions(): void {
    for (let i = 0; i < this.racers.length; i += 1) {
      for (let j = i + 1; j < this.racers.length; j += 1) {
        const a = this.racers[i]!;
        const b = this.racers[j]!;
        const dx = b.vehicle.x - a.vehicle.x;
        const dz = b.vehicle.z - a.vehicle.z;
        const distance = Math.hypot(dx, dz);
        if (distance <= 0.001 || distance >= 3.5) continue;
        const push = (3.5 - distance) / 2;
        const nx = dx / distance;
        const nz = dz / distance;
        a.vehicle = {
          ...a.vehicle,
          x: a.vehicle.x - nx * push,
          z: a.vehicle.z - nz * push,
          vx: a.vehicle.vx * 0.96,
          vz: a.vehicle.vz * 0.96,
        };
        b.vehicle = {
          ...b.vehicle,
          x: b.vehicle.x + nx * push,
          z: b.vehicle.z + nz * push,
          vx: b.vehicle.vx * 0.96,
          vz: b.vehicle.vz * 0.96,
        };
        if ((a.isPlayer || b.isPlayer) && this.collisionCooldown <= 0) {
          this.audio.impact(0.5);
          this.shake = 0.3;
          this.collisionCooldown = 0.5;
        }
      }
    }
  }

  private updateVisuals(): void {
    for (const racer of this.racers) {
      const { group, wheels, underglow } = racer.visual;
      group.position.set(racer.vehicle.x, 0, racer.vehicle.z);
      group.rotation.y = racer.vehicle.heading + Math.PI;
      for (const wheel of wheels) wheel.rotation.x = -racer.wheelSpin;
      const ratio = clamp(speedOf(racer.vehicle) / racer.car.maxSpeed, 0, 1);
      underglow.scale.set(1 + ratio * 0.14, 1, 1 + racer.vehicle.boostTime * 0.3);
      const material = underglow.material as THREE.MeshBasicMaterial;
      material.opacity = 0.2 + ratio * 0.32 + (racer.vehicle.boostTime > 0 ? 0.18 : 0);
    }
  }

  private updateRain(delta: number): void {
    if (!this.rain || !this.rainPositions) return;
    const positions = this.rainPositions;
    for (let index = 0; index < positions.length; index += 3) {
      positions[index + 1] = positions[index + 1]! - 58 * delta;
      if (positions[index + 1]! < 0) positions[index + 1] = 62;
    }
    const attribute = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.needsUpdate = true;
    this.rain.position.set(this.player.vehicle.x, 0, this.player.vehicle.z);
  }

  private updateGhost(): void {
    if (!this.ghostVisual || !this.ghostSamples || this.phase !== 'racing') {
      if (this.ghostVisual) this.ghostVisual.group.visible = false;
      return;
    }
    const duration = this.ghostDuration || 1;
    const lapElapsed = Math.max(0, this.raceTime - this.player.lapStartedAt);
    const pose = sampleGhost(this.ghostSamples, Math.min(lapElapsed, duration));
    if (!pose) {
      this.ghostVisual.group.visible = false;
      return;
    }
    this.ghostVisual.group.visible = true;
    this.ghostVisual.group.position.set(pose.x, 0, pose.z);
    this.ghostVisual.group.rotation.y = pose.heading + Math.PI;
  }

  private updateCamera(delta: number): void {
    const vehicle = this.player.vehicle;
    const forwardX = Math.sin(vehicle.heading);
    const forwardZ = Math.cos(vehicle.heading);
    const ratio = clamp(speedOf(vehicle) / this.player.car.maxSpeed, 0, 1);
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.55 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.32 : 0;

    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.cameraMode === 'hood') {
      desiredX = vehicle.x + forwardX * 0.4;
      desiredY = 1.4;
      desiredZ = vehicle.z + forwardZ * 0.4;
      lookX = vehicle.x + forwardX * 26;
      lookY = 1.3;
      lookZ = vehicle.z + forwardZ * 26;
    } else {
      const distance = this.cameraMode === 'wide' ? 14.5 : 8.8;
      const height = this.cameraMode === 'wide' ? 6.6 : 4.2;
      desiredX = vehicle.x - forwardX * distance;
      desiredY = height;
      desiredZ = vehicle.z - forwardZ * distance;
      lookX = vehicle.x + forwardX * 10;
      lookY = 1.2;
      lookZ = vehicle.z + forwardZ * 10;
    }

    this.cameraPosition.x = damp(this.cameraPosition.x, desiredX, 5.5, delta) + shakeX;
    this.cameraPosition.y = damp(this.cameraPosition.y, desiredY, 5.5, delta) + shakeY;
    this.cameraPosition.z = damp(this.cameraPosition.z, desiredZ, 5.5, delta);
    this.cameraObject.position.copy(this.cameraPosition);

    this.cameraTarget.x = damp(this.cameraTarget.x, lookX, 7, delta);
    this.cameraTarget.y = damp(this.cameraTarget.y, lookY, 7, delta);
    this.cameraTarget.z = damp(this.cameraTarget.z, lookZ, 7, delta);
    this.cameraObject.lookAt(this.cameraTarget);

    const targetFov = 62 + ratio * 15 + (this.cameraMode === 'hood' ? 4 : 0);
    this.cameraObject.fov = damp(this.cameraObject.fov, targetFov, 3, delta);
    this.cameraObject.updateProjectionMatrix();
  }

  private emitHud(): void {
    const position =
      this.standings().findIndex((racer) => racer.isPlayer) + 1 || this.racers.length;
    const onTrack = isOnRallyTrack(
      this.track,
      this.player.vehicle.x,
      this.player.vehicle.z,
      this.player.index,
    );
    const speed = speedOf(this.player.vehicle);

    this.callbacks.onHud({
      speed: speed * 3.6,
      gear: Math.min(8, Math.max(1, Math.ceil((speed / this.player.car.maxSpeed) * 7))),
      lap: Math.min(TOTAL_LAPS, this.player.lap.lap),
      totalLaps: TOTAL_LAPS,
      position,
      racers: this.racers.length,
      raceTime: this.raceTime,
      lastLap: this.player.lastLap,
      bestLap: this.player.bestLap,
      countdown: Math.max(0, Math.ceil(this.countdown - 0.2)),
      phase: this.phase,
      offTrack: !onTrack && this.phase === 'racing',
      driftCharge: this.player.vehicle.driftCharge,
      boostTime: this.player.vehicle.boostTime,
      weather: this.setup.weather,
      minimapPlayer: projectToMinimap(this.track, this.player.vehicle.x, this.player.vehicle.z),
      minimapRivals: this.racers
        .filter((racer) => !racer.isPlayer)
        .map((racer) => projectToMinimap(this.track, racer.vehicle.x, racer.vehicle.z)),
    });
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || this.canvas.clientWidth || 960;
    const height = parent?.clientHeight || this.canvas.clientHeight || 540;
    this.renderer.setSize(width, height, false);
    this.cameraObject.aspect = width / Math.max(1, height);
    this.cameraObject.updateProjectionMatrix();
  }

  setTouch(touch: Partial<TouchDriveState>): void {
    this.touch = { ...this.touch, ...touch };
  }

  setCamera(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  pause(): void {
    this.paused = true;
    this.audio.pause();
  }

  resume(): void {
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.resume();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.keyboard.dispose();
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.racers = [];
    this.ghostVisual = null;
    this.ghostSamples = null;
  }
}
