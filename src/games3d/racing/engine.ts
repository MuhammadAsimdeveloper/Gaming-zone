import * as THREE from 'three';
import { AnimationLoop } from '../shared/animationLoop';
import { GameAudio } from '../shared/audio';
import { createKeyboard, readDriveInput, type TouchDriveState } from '../shared/input';
import { clamp, damp, formatRaceTime, normalizeAngle } from '../shared/math';
import {
  createCar,
  createCity,
  createRoad,
  createStartGate,
  createTrackLights,
  disposeObject,
  type TrackPoint,
  type VehicleVisual,
} from '../shared/scenery';
import {
  difficultyProfile,
  getVehicle,
  type CarId,
  type VehicleDefinition,
} from './cars';
import {
  findNearestIndex,
  getTrack,
  isOnTrack,
  trackFrame,
  type CameraMode,
  type Difficulty,
  type TrackDefinition,
  type TrackId,
} from './tracks';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceHud {
  speed: number;
  lap: number;
  totalLaps: number;
  position: number;
  racers: number;
  raceTime: number;
  lastLap: number | null;
  bestLap: number | null;
  countdown: number;
  phase: RacePhase;
  offTrack: boolean;
  minimapPlayer: { x: number; y: number };
  minimapRivals: Array<{ x: number; y: number }>;
}

export interface RaceResultRow {
  position: number;
  name: string;
  isPlayer: boolean;
  finishTime: number | null;
  bestLap: number | null;
  lapsCompleted: number;
}

export interface RaceResultData {
  rows: RaceResultRow[];
  playerPosition: number;
  raceTime: number;
  bestLap: number | null;
  newBestLap: boolean;
}

export interface RaceSetup {
  trackId: TrackId;
  carId: CarId;
  difficulty: Difficulty;
  camera: CameraMode;
}

interface RaceCallbacks {
  onHud: (hud: RaceHud) => void;
  onFinish: (result: RaceResultData) => void;
}

interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  visual: VehicleVisual;
  vehicle: VehicleDefinition;
  x: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  index: number;
  previousIndex: number;
  lapsCompleted: number;
  nextGate: number;
  lapStartedAt: number;
  lastLap: number | null;
  bestLap: number | null;
  finished: boolean;
  finishTime: number | null;
  lane: number;
  skill: number;
  wheelSpin: number;
}

const TOTAL_LAPS = 3;
const GATE_FRACTIONS = [0.25, 0.5, 0.75];

function headingFromTangent(tangent: TrackPoint): number {
  return Math.atan2(-tangent.x, -tangent.z);
}

function modularCrossed(previous: number, current: number, target: number, count: number): boolean {
  const delta = (current - previous + count) % count;
  if (delta === 0 || delta > 60) return false;
  const targetDelta = (target - previous + count) % count;
  return targetDelta > 0 && targetDelta <= delta;
}

export class RaceEngine {
  private renderer: THREE.WebGLRenderer;
  private frameLoop: AnimationLoop;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 900);
  private lastFrame = 0;
  private keyboard: ReturnType<typeof createKeyboard>;
  private touch: TouchDriveState = { forward: false, back: false, left: false, right: false, handbrake: false };
  private audio = new GameAudio();
  private racers: Racer[] = [];
  private player!: Racer;
  private track: TrackDefinition;
  private setup: RaceSetup;
  private callbacks: RaceCallbacks;
  private paused = false;
  private disposed = false;
  private phase: RacePhase = 'countdown';
  // Three full seconds, so the overlay shows 3, 2, 1 and never a leading 4.
  private countdown = 3;
  private lastCountdownBeep = 4;
  private raceTime = 0;
  private hudTimer = 0;
  private shake = 0;
  private cameraMode: CameraMode;
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private minimapBounds: { minX: number; minZ: number; scale: number };
  private gateIndices: number[];
  private aiNames = ['Vex', 'Nyx', 'Kite'];
  private collisionCooldown = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    setup: RaceSetup,
    callbacks: RaceCallbacks,
  ) {
    this.setup = setup;
    this.callbacks = callbacks;
    this.track = getTrack(setup.trackId);
    this.cameraMode = setup.camera;
    this.keyboard = createKeyboard(this.canvas);
    this.gateIndices = GATE_FRACTIONS.map((fraction) =>
      Math.floor(this.track.points.length * fraction),
    );

    const bounds = this.track.points.reduce(
      (accumulator, point) => ({
        minX: Math.min(accumulator.minX, point.x),
        maxX: Math.max(accumulator.maxX, point.x),
        minZ: Math.min(accumulator.minZ, point.z),
        maxZ: Math.max(accumulator.maxZ, point.z),
      }),
      { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
    );
    this.minimapBounds = {
      minX: bounds.minX,
      minZ: bounds.minZ,
      scale: 100 / Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ),
    };

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(this.track.skyColor);
    this.scene.fog = new THREE.Fog(this.track.fogColor, 120, 430);

    this.buildWorld();
    this.spawnRacers();
    this.resize();
    window.addEventListener('resize', this.handleResize);

    this.audio.start();
    this.audio.beep(330, 80, 'sine', 0.05);
    this.frameLoop = new AnimationLoop((callback) => this.renderer.setAnimationLoop(callback));
    this.frameLoop.start(this.loop);
    canvas.focus();
    this.emitHud();
  }

  private buildWorld(): void {
    const hemi = new THREE.HemisphereLight('#8bb8ff', '#05070f', 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#cfe3ff', 2.1);
    sun.position.set(80, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);

    const center = this.track.points.reduce(
      (accumulator, point) => ({ x: accumulator.x + point.x / this.track.points.length, z: accumulator.z + point.z / this.track.points.length }),
      { x: 0, z: 0 },
    );
    const maxRadius = this.track.points.reduce(
      (maximum, point) => Math.max(maximum, Math.hypot(point.x - center.x, point.z - center.z)),
      0,
    );

    const road = createRoad(this.track.points, this.track.width, this.track.curbColors);
    this.scene.add(road.group);

    const city = createCity({
      center,
      radius: maxRadius + 170,
      count: 150,
      avoidRadius: maxRadius + 22,
      seed: this.track.id.length * 977 + 31,
    });
    this.scene.add(city);

    const lights = createTrackLights(this.track.points);
    this.scene.add(lights);

    const startFrame = trackFrame(this.track.points, 0);
    const gate = createStartGate(startFrame.point, headingFromTangent(startFrame.tangent), this.track.accent);
    this.scene.add(gate);

    const glow = new THREE.PointLight(this.track.accent, 3.4, 40, 2);
    glow.position.set(startFrame.point.x, 4, startFrame.point.z);
    this.scene.add(glow);
  }

  private spawnRacers(): void {
    const profile = difficultyProfile(this.setup.difficulty);
    const playerVehicle = getVehicle(this.setup.carId);
    const aiVehicles: CarId[] = ['rift-gt', 'vanta-rs', 'solaris-x'];
    const grid: Array<{ index: number; lane: number; name: string; player: boolean }> = [
      { index: this.track.points.length - 14, lane: -3.2, name: this.aiNames[0]!, player: false },
      { index: this.track.points.length - 15, lane: 3.2, name: this.aiNames[1]!, player: false },
      { index: this.track.points.length - 26, lane: -3.2, name: this.aiNames[2]!, player: false },
      { index: this.track.points.length - 27, lane: 3.2, name: 'You', player: true },
    ];

    grid.forEach((slot, slotIndex) => {
      const frame = trackFrame(this.track.points, slot.index);
      const x = frame.point.x + frame.normal.x * slot.lane;
      const z = frame.point.z + frame.normal.z * slot.lane;
      const vehicle = slot.player ? playerVehicle : getVehicle(aiVehicles[slotIndex] ?? 'rift-gt');
      const visual = createCar(vehicle.color, vehicle.accent);
      visual.group.position.set(x, 0, z);
      const heading = headingFromTangent(frame.tangent);
      visual.group.rotation.y = heading;
      this.scene.add(visual.group);

      const racer: Racer = {
        id: slot.player ? 'player' : `ai-${slotIndex}`,
        name: slot.name,
        isPlayer: slot.player,
        visual,
        vehicle: slot.player ? playerVehicle : { ...vehicle, maxSpeed: vehicle.maxSpeed * profile.aiSpeed },
        x,
        z,
        heading,
        speed: 0,
        steer: 0,
        index: slot.index,
        previousIndex: slot.index,
        lapsCompleted: 0,
        nextGate: 1,
        lapStartedAt: 0,
        lastLap: null,
        bestLap: null,
        finished: false,
        finishTime: null,
        lane: slot.player ? 0 : (slotIndex % 2 === 0 ? -1 : 1) * (2 + slotIndex * 0.8),
        skill: profile.aiCorner,
        wheelSpin: 0,
      };

      this.racers.push(racer);
      if (slot.player) this.player = racer;
    });

    this.player = this.racers.find((racer) => racer.isPlayer)!;

    const frame = trackFrame(this.track.points, this.player.index);
    this.cameraPosition.set(
      this.player.x - frame.tangent.x * 9,
      4.5,
      this.player.z - frame.tangent.z * 9,
    );
    this.camera.position.copy(this.cameraPosition);
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const delta = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown -= delta;
      const display = Math.ceil(this.countdown);
      if (display < this.lastCountdownBeep) {
        this.lastCountdownBeep = display;
        this.audio.countdown(display <= 0);
      }
      if (this.countdown <= 0) {
        this.phase = 'racing';
        this.raceTime = 0;
        for (const racer of this.racers) racer.lapStartedAt = 0;
        this.audio.beep(1046, 200, 'sine', 0.09);
      }
      this.updateVisuals(delta);
      this.updateCamera(delta);
      this.renderer.render(this.scene, this.camera);
      this.emitHud();
      return;
    }

    if (this.phase === 'racing') {
      this.raceTime += delta;
      this.collisionCooldown = Math.max(0, this.collisionCooldown - delta);
      const drive = readDriveInput(this.keyboard.keys, this.touch);
      this.updatePlayer(delta, drive);
      this.updateAi(delta);
      this.resolveCollisions(delta);
      this.updateLapProgress();
      this.updateVisuals(delta);

      const speedRatio = Math.abs(this.player.speed) / this.player.vehicle.maxSpeed;
      this.audio.setSpeed(clamp(speedRatio, 0, 1));
      this.audio.setEngineVolume(0.035 + clamp(speedRatio, 0, 1) * 0.06);

      if (this.shake > 0) this.shake = Math.max(0, this.shake - delta * 2.4);
    }

    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer += delta;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
  };

  private updatePlayer(delta: number, drive: TouchDriveState): void {
    const racer = this.player;
    if (racer.finished) {
      racer.speed = damp(racer.speed, 0, 3, delta);
      this.integrate(racer, delta);
      return;
    }

    const onTrack = isOnTrack(this.track.points, this.track.width, racer.x, racer.z, racer.index);
    const maxSpeed = racer.vehicle.maxSpeed;
    const steerTarget = (drive.left ? 1 : 0) - (drive.right ? 1 : 0);
    racer.steer = damp(racer.steer, steerTarget, 7.5, delta);

    if (drive.forward) {
      racer.speed += racer.vehicle.acceleration * delta * (onTrack ? 1 : 0.35);
    } else if (drive.back) {
      if (racer.speed > 0.5) {
        racer.speed -= racer.vehicle.braking * delta;
      } else {
        racer.speed -= racer.vehicle.acceleration * 0.55 * delta;
      }
    } else {
      racer.speed = damp(racer.speed, 0, 0.65, delta);
    }

    if (drive.handbrake) {
      racer.speed = damp(racer.speed, 0, 1.8, delta);
    }

    if (!onTrack) racer.speed = damp(racer.speed, racer.speed * 0.55, 1.5, delta);

    racer.speed = clamp(racer.speed, -14, maxSpeed);
    const speedRatio = clamp(Math.abs(racer.speed) / 22, 0, 1);
    const direction = racer.speed >= 0 ? 1 : -1;
    const turnBoost = drive.handbrake ? 1.45 : 1;
    const steeringAuthority = clamp(Math.abs(racer.speed) / 5, 0, 1);
    racer.heading +=
      racer.steer *
      racer.vehicle.handling *
      turnBoost *
      steeringAuthority *
      (0.45 + speedRatio * 0.75) *
      delta *
      direction;

    this.integrate(racer, delta);
  }

  private integrate(racer: Racer, delta: number): void {
    const forwardX = -Math.sin(racer.heading);
    const forwardZ = -Math.cos(racer.heading);
    racer.x += forwardX * racer.speed * delta;
    racer.z += forwardZ * racer.speed * delta;

    racer.previousIndex = racer.index;
    racer.index = findNearestIndex(this.track.points, racer.x, racer.z, racer.index);

    const frame = trackFrame(this.track.points, racer.index);
    const dx = racer.x - frame.point.x;
    const dz = racer.z - frame.point.z;
    const lateral = dx * frame.normal.x + dz * frame.normal.z;
    const limit = this.track.width / 2 + 1.4;
    if (Math.abs(lateral) > limit) {
      const excess = Math.abs(lateral) - limit;
      const sign = Math.sign(lateral);
      racer.x -= frame.normal.x * excess * sign;
      racer.z -= frame.normal.z * excess * sign;
      if (Math.abs(racer.speed) > 8) {
        racer.speed *= 0.72;
        if (racer.isPlayer && this.collisionCooldown <= 0) {
          this.audio.crash(clamp(Math.abs(racer.speed) / 40, 0.3, 1));
          this.shake = 0.55;
          this.collisionCooldown = 0.45;
        }
      }
    }
  }

  private updateAi(delta: number): void {
    const playerProgress = this.player.lapsCompleted * this.track.points.length + this.player.index;

    for (const racer of this.racers) {
      if (racer.isPlayer || racer.finished) {
        if (!racer.isPlayer) {
          racer.speed = damp(racer.speed, 0, 2, delta);
          this.integrateAi(racer, delta);
        }
        continue;
      }

      const count = this.track.points.length;
      const lookAhead = Math.round(9 + Math.abs(racer.speed) * 0.34);
      const targetIndex = (racer.index + lookAhead) % count;
      const frame = trackFrame(this.track.points, targetIndex);
      const lane = racer.lane;
      const targetX = frame.point.x + frame.normal.x * lane;
      const targetZ = frame.point.z + frame.normal.z * lane;
      const desiredHeading = Math.atan2(-(targetX - racer.x), -(targetZ - racer.z));
      const angleDifference = normalizeAngle(desiredHeading - racer.heading);
      const steer = clamp(angleDifference * 2.6, -1, 1);
      racer.steer = damp(racer.steer, steer, 5, delta);

      const farFrame = trackFrame(this.track.points, (racer.index + lookAhead + 16) % count);
      const headingAtTarget = headingFromTangent(frame.tangent);
      const headingFar = headingFromTangent(farFrame.tangent);
      const curvature = Math.abs(normalizeAngle(headingFar - headingAtTarget));
      const cornerLimit = racer.vehicle.maxSpeed * clamp(1 - curvature * 0.85 * racer.skill, 0.42, 1);

      const rivalProgress = racer.lapsCompleted * count + racer.index;
      const rubberBand = clamp((playerProgress - rivalProgress) / 260, -0.06, 0.07);
      const targetSpeed = cornerLimit * (1 + rubberBand);

      if (racer.speed < targetSpeed) {
        racer.speed += racer.vehicle.acceleration * 0.82 * delta;
      } else {
        racer.speed -= racer.vehicle.braking * 0.45 * delta;
      }

      racer.speed = clamp(racer.speed, 0, racer.vehicle.maxSpeed * 1.02);
      const speedRatio = clamp(Math.abs(racer.speed) / 22, 0, 1);
      racer.heading +=
        racer.steer * racer.vehicle.handling * racer.skill * (0.45 + speedRatio * 0.7) * delta;

      const playerDistance = Math.hypot(racer.x - this.player.x, racer.z - this.player.z);
      if (playerDistance < 4.6 && Math.abs(racer.speed) > 6) {
        racer.lane = clamp(racer.lane + 0.6 * delta * Math.sign(racer.lane || 1), -5, 5);
      }

      this.integrateAi(racer, delta);
    }
  }

  private integrateAi(racer: Racer, delta: number): void {
    const forwardX = -Math.sin(racer.heading);
    const forwardZ = -Math.cos(racer.heading);
    racer.x += forwardX * racer.speed * delta;
    racer.z += forwardZ * racer.speed * delta;
    racer.previousIndex = racer.index;
    racer.index = findNearestIndex(this.track.points, racer.x, racer.z, racer.index);

    const frame = trackFrame(this.track.points, racer.index);
    const dx = racer.x - frame.point.x;
    const dz = racer.z - frame.point.z;
    const lateral = dx * frame.normal.x + dz * frame.normal.z;
    const limit = this.track.width / 2 + 1;
    if (Math.abs(lateral) > limit) {
      const excess = Math.abs(lateral) - limit;
      const sign = Math.sign(lateral);
      racer.x -= frame.normal.x * excess * sign;
      racer.z -= frame.normal.z * excess * sign;
      racer.speed *= 0.9;
    }
  }

  private resolveCollisions(delta: number): void {
    for (let i = 0; i < this.racers.length; i += 1) {
      for (let j = i + 1; j < this.racers.length; j += 1) {
        const a = this.racers[i]!;
        const b = this.racers[j]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distance = Math.hypot(dx, dz);
        const minimum = 3.4;
        if (distance > 0.001 && distance < minimum) {
          const push = (minimum - distance) / 2;
          const nx = dx / distance;
          const nz = dz / distance;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
          const slower = a.speed < b.speed ? a : b;
          slower.speed *= 1 - delta * 1.6;
          if ((a.isPlayer || b.isPlayer) && this.collisionCooldown <= 0) {
            this.audio.crash(0.6);
            this.shake = 0.35;
            this.collisionCooldown = 0.5;
          }
        }
      }
    }
  }

  private updateLapProgress(): void {
    const count = this.track.points.length;
    for (const racer of this.racers) {
      if (racer.finished) continue;

      if (racer.nextGate <= 3) {
        const target = this.gateIndices[racer.nextGate - 1]!;
        if (modularCrossed(racer.previousIndex, racer.index, target, count)) {
          racer.nextGate += 1;
        }
      } else if (modularCrossed(racer.previousIndex, racer.index, 0, count)) {
        const lapTime = this.raceTime - racer.lapStartedAt;
        racer.lapStartedAt = this.raceTime;
        racer.lastLap = lapTime;
        racer.bestLap = racer.bestLap === null ? lapTime : Math.min(racer.bestLap, lapTime);
        racer.lapsCompleted += 1;
        racer.nextGate = 1;

        if (racer.isPlayer) {
          this.audio.lap();
          if (racer.lapsCompleted >= TOTAL_LAPS) {
            this.finishRace(racer);
            return;
          }
        } else if (racer.lapsCompleted >= TOTAL_LAPS) {
          racer.finished = true;
          racer.finishTime = this.raceTime;
        }
      }
    }
  }

  private finishRace(player: Racer): void {
    player.finished = true;
    player.finishTime = this.raceTime;
    player.speed = 0;
    this.phase = 'finished';
    this.audio.setEngineVolume(0.0001);
    this.audio.beep(880, 160, 'sine', 0.08);
    window.setTimeout(() => this.audio.beep(1320, 320, 'sine', 0.08), 170);

    const rows = this.standings().map((racer, index) => ({
      position: index + 1,
      name: racer.name,
      isPlayer: racer.isPlayer,
      finishTime: racer.finished ? racer.finishTime : null,
      bestLap: racer.bestLap,
      lapsCompleted: racer.lapsCompleted,
    }));

    const playerPosition = rows.find((row) => row.isPlayer)?.position ?? this.racers.length;

    this.callbacks.onFinish({
      rows,
      playerPosition,
      raceTime: this.raceTime,
      bestLap: player.bestLap,
      newBestLap: player.bestLap !== null && player.lastLap !== null && player.bestLap === player.lastLap,
    });
    this.emitHud();
    this.frameLoop.stop();
    this.audio.stopMusic();
  }

  private standings(): Racer[] {
    return [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
      if (a.finished) return -1;
      if (b.finished) return 1;
      const aProgress = a.lapsCompleted * this.track.points.length + a.index;
      const bProgress = b.lapsCompleted * this.track.points.length + b.index;
      return bProgress - aProgress;
    });
  }

  private updateVisuals(delta: number): void {
    for (const racer of this.racers) {
      const visual = racer.visual;
      visual.group.position.set(racer.x, 0, racer.z);
      visual.group.rotation.y = racer.heading;
      racer.wheelSpin += racer.speed * delta * 1.4;
      for (const wheel of visual.wheels) {
        wheel.rotation.x = -racer.wheelSpin;
      }
      const speedRatio = clamp(Math.abs(racer.speed) / racer.vehicle.maxSpeed, 0, 1);
      visual.underglow.scale.set(1 + speedRatio * 0.12, 1, 1);
      const material = visual.underglow.material as THREE.MeshBasicMaterial;
      material.opacity = 0.22 + speedRatio * 0.3;
    }
  }

  private updateCamera(delta: number): void {
    const player = this.player;
    const forwardX = -Math.sin(player.heading);
    const forwardZ = -Math.cos(player.heading);
    const speedRatio = clamp(Math.abs(player.speed) / player.vehicle.maxSpeed, 0, 1);

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.35 : 0;

    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.cameraMode === 'hood') {
      desiredX = player.x + forwardX * 0.35;
      desiredY = 1.45;
      desiredZ = player.z + forwardZ * 0.35;
      lookX = player.x + forwardX * 24;
      lookY = 1.35;
      lookZ = player.z + forwardZ * 24;
    } else {
      const distance = this.cameraMode === 'far' ? 14 : 8.6;
      const height = this.cameraMode === 'far' ? 6.4 : 4.1;
      desiredX = player.x - forwardX * distance;
      desiredY = height;
      desiredZ = player.z - forwardZ * distance;
      lookX = player.x + forwardX * 9;
      lookY = 1.2;
      lookZ = player.z + forwardZ * 9;
    }

    this.cameraPosition.x = damp(this.cameraPosition.x, desiredX, 5.5, delta) + shakeX;
    this.cameraPosition.y = damp(this.cameraPosition.y, desiredY, 5.5, delta) + shakeY;
    this.cameraPosition.z = damp(this.cameraPosition.z, desiredZ, 5.5, delta);
    this.camera.position.copy(this.cameraPosition);

    this.cameraTarget.x = damp(this.cameraTarget.x, lookX, 7, delta);
    this.cameraTarget.y = damp(this.cameraTarget.y, lookY, 7, delta);
    this.cameraTarget.z = damp(this.cameraTarget.z, lookZ, 7, delta);
    this.camera.lookAt(this.cameraTarget);

    const targetFov = 62 + speedRatio * 14 + (this.cameraMode === 'hood' ? 4 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 3, delta);
    this.camera.updateProjectionMatrix();
  }

  private emitHud(): void {
    const count = this.track.points.length;
    const playerProgress = this.player.lapsCompleted * count + this.player.index;
    const position =
      this.standings().findIndex((racer) => racer.id === this.player.id) + 1;
    const onTrack = isOnTrack(
      this.track.points,
      this.track.width,
      this.player.x,
      this.player.z,
      this.player.index,
    );

    this.callbacks.onHud({
      speed: Math.abs(this.player.speed) * 3.6,
      lap: Math.min(this.player.lapsCompleted + 1, TOTAL_LAPS),
      totalLaps: TOTAL_LAPS,
      position: position || this.racers.length,
      racers: this.racers.length,
      raceTime: this.raceTime,
      lastLap: this.player.lastLap,
      bestLap: this.player.bestLap,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      phase: this.phase,
      offTrack: !onTrack && this.phase === 'racing',
      minimapPlayer: this.toMinimap(this.player.x, this.player.z),
      minimapRivals: this.racers
        .filter((racer) => !racer.isPlayer)
        .map((racer) => this.toMinimap(racer.x, racer.z)),
    });

    void playerProgress;
  }

  private toMinimap(x: number, z: number): { x: number; y: number } {
    return {
      x: (x - this.minimapBounds.minX) * this.minimapBounds.scale + 6,
      y: (z - this.minimapBounds.minZ) * this.minimapBounds.scale + 6,
    };
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || this.canvas.clientWidth || 960;
    const height = parent?.clientHeight || this.canvas.clientHeight || 540;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  setTouch(touch: Partial<TouchDriveState>): void {
    this.touch = { ...this.touch, ...touch };
  }

  cycleCamera(): CameraMode {
    const order: CameraMode[] = ['chase', 'far', 'hood'];
    const index = order.indexOf(this.cameraMode);
    this.cameraMode = order[(index + 1) % order.length]!;
    return this.cameraMode;
  }

  setCamera(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  getCamera(): CameraMode {
    return this.cameraMode;
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  pause(): void {
    this.paused = true;
    this.audio.setEngineVolume(0.0001);
    this.audio.suspend();
  }

  resume(): void {
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.resume();
  }

  getState(): RacePhase {
    return this.phase;
  }

  getRaceTimeLabel(): string {
    return formatRaceTime(this.raceTime);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.frameLoop.stop();
    window.removeEventListener('resize', this.handleResize);
    this.keyboard.dispose();
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.racers = [];
  }
}
