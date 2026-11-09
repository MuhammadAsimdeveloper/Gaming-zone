import * as THREE from 'three';
import { AnimationLoop } from '../shared/animationLoop';
import { HudPump } from '../shared/hud';
import { GameAudio } from '../shared/audio';
import { createKeyboard, readDriveInput, type TouchDriveState } from '../shared/input';
import { clamp, damp } from '../shared/math';
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
import { getVehicle, type CarId, type VehicleDefinition } from '../racing/cars';
import { findNearestIndex, isOnTrack, trackFrame, type CameraMode } from '../racing/tracks';
import {
  GHOST_MAX_SECONDS,
  interpolateGhost,
  sampleGhost,
  shouldSample,
  type GhostRecording,
  type GhostSample,
} from './ghost';
import {
  advanceRun,
  beginRun,
  createRun,
  medalForTime,
  registerGate,
  registerOffTrack,
  respawnRun,
  sectorCount,
  type MedalTier,
  type RunState,
  type TrialRulesConfig,
} from './rules';
import {
  SURFACE_GRIP,
  getTimeTrialTrack,
  surfaceAt,
  type SurfaceKind,
  type TimeTrialTrack,
  type TimeTrialTrackId,
} from './tracks';

export type TrialPhase = 'countdown' | 'running' | 'finished' | 'invalid';

export interface TrialSetup {
  trackId: TimeTrialTrackId;
  carId: CarId;
  camera: CameraMode;
  ghost: GhostRecording | null;
  bestTime: number | null;
  bestSplits: number[] | null;
}

export interface TrialHud {
  phase: TrialPhase;
  clock: number;
  speed: number;
  lap: number;
  totalLaps: number;
  sector: number;
  totalSectors: number;
  nextSplit: 'checkpoint' | 'finish' | 'done';
  splitDelta: number | null;
  bestTime: number | null;
  medal: MedalTier;
  surface: SurfaceKind;
  offTrack: boolean;
  awaitingStart: boolean;
  countdown: number;
  respawns: number;
  invalidReason: string | null;
  progress: { x: number; y: number };
  ghostProgress: { x: number; y: number } | null;
}

export interface TrialRunResult {
  trackId: TimeTrialTrackId;
  carId: CarId;
  time: number;
  splits: number[];
  medal: MedalTier;
  respawns: number;
  ghost: GhostRecording;
}

interface TrialCallbacks {
  onHud: (hud: TrialHud) => void;
  onFinish: (result: TrialRunResult) => void;
}

const STEP = 1 / 120;
const COUNTDOWN_SECONDS = 1.2;
const START_GRID_OFFSET = 16;

function headingFromTangent(tangent: TrackPoint): number {
  return Math.atan2(-tangent.x, -tangent.z);
}

function modularCrossed(previous: number, current: number, target: number, count: number): boolean {
  const delta = (current - previous + count) % count;
  if (delta === 0 || delta > 60) return false;
  const targetDelta = (target - previous + count) % count;
  return targetDelta > 0 && targetDelta <= delta;
}

function createCheckpointGate(
  point: TrackPoint,
  heading: number,
  accent: string,
  width: number,
): THREE.Group {
  const group = new THREE.Group();
  const pillarMaterial = new THREE.MeshStandardMaterial({
    color: '#121a30',
    metalness: 0.7,
    roughness: 0.35,
  });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: accent });
  const half = width / 2 + 1.7;

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.4, 0.45), pillarMaterial);
    pillar.position.set(side * half, 2.7, 0);
    pillar.castShadow = true;
    group.add(pillar);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.9, 0.12), glowMaterial);
    strip.position.set(side * half + side * 0.24, 2.7, 0);
    group.add(strip);
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.36, 0.5), pillarMaterial);
  beam.position.y = 5.3;
  group.add(beam);

  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 1.7, 0.9),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    }),
  );
  banner.position.y = 4.6;
  group.add(banner);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(width * 0.32, width * 0.4, 28),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  group.position.set(point.x, 0, point.z);
  group.rotation.y = heading;
  return group;
}

export class TimeTrialEngine {
  private renderer: THREE.WebGLRenderer;
  private frameLoop: AnimationLoop;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 1000);
  private lastFrame = 0;
  private accumulator = 0;
  private keyboard: ReturnType<typeof createKeyboard>;
  private touch: TouchDriveState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    handbrake: false,
  };
  private audio = new GameAudio();
  private track: TimeTrialTrack;
  private vehicle: VehicleDefinition;
  private setup: TrialSetup;
  private callbacks: TrialCallbacks;
  private rulesConfig: TrialRulesConfig;
  private run: RunState = createRun();
  private phase: TrialPhase = 'countdown';
  private countdown = COUNTDOWN_SECONDS;
  private paused = false;
  private disposed = false;
  private cameraMode: CameraMode;
  private cameraPosition = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();
  private visual!: VehicleVisual;
  private ghostVisual: VehicleVisual | null = null;
  private samples: GhostSample[] = [];
  private lastSampleAt: number | null = null;
  private splitDelta: number | null = null;

  private x = 0;
  private z = 0;
  private heading = 0;
  private speed = 0;
  private steer = 0;
  private index = 0;
  private previousIndex = 0;
  private lastRespawnIndex = 0;
  private wheelSpin = 0;
  private shake = 0;
  private offTrack = false;

  private minimapBounds: { minX: number; minZ: number; scale: number };
  private gatePoints: Array<{ pointIndex: number; gate: number }>;
  private hudPump: HudPump<TrialHud>;

  constructor(
    private canvas: HTMLCanvasElement,
    setup: TrialSetup,
    callbacks: TrialCallbacks,
  ) {
    this.setup = setup;
    this.callbacks = callbacks;
    this.hudPump = new HudPump<TrialHud>((hud) => this.callbacks.onHud(hud), 0.1);
    this.track = getTimeTrialTrack(setup.trackId);
    this.vehicle = getVehicle(setup.carId);
    this.cameraMode = setup.camera;
    this.rulesConfig = {
      totalLaps: this.track.laps,
      checkpointsPerLap: this.track.checkpoints.length,
    };
    this.keyboard = createKeyboard(this.canvas);
    this.gatePoints = [
      { pointIndex: 0, gate: 0 },
      ...this.track.checkpoints.map((pointIndex, index) => ({ pointIndex, gate: index + 1 })),
    ];

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(this.track.skyColor);
    this.scene.fog = new THREE.Fog(this.track.fogColor, 140, 520);

    this.buildWorld();
    this.spawnCar();
    this.buildGhost();
    this.resize();
    window.addEventListener('resize', this.handleResize);

    this.audio.start();
    this.audio.beep(392, 120, 'sine', 0.06);
    this.frameLoop = new AnimationLoop((callback) => this.renderer.setAnimationLoop(callback));
    this.frameLoop.start(this.loop);
    this.canvas.focus();
    this.emitHud();
  }

  private buildWorld(): void {
    const hemi = new THREE.HemisphereLight('#8bb8ff', '#05070f', 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#cfe3ff', 2.15);
    sun.position.set(90, 140, 50);
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

    const road = createRoad(this.track.points, this.track.width, this.track.curbColors);
    this.scene.add(road.group);

    const city = createCity({
      center,
      radius: maxRadius + 190,
      count: 180,
      avoidRadius: maxRadius + 26,
      seed: this.track.id.length * 1249 + 53,
    });
    this.scene.add(city);

    this.scene.add(createTrackLights(this.track.points));

    const startFrame = trackFrame(this.track.points, 0);
    this.scene.add(
      createStartGate(startFrame.point, headingFromTangent(startFrame.tangent), this.track.accent),
    );

    for (const checkpointIndex of this.track.checkpoints) {
      const frame = trackFrame(this.track.points, checkpointIndex);
      this.scene.add(
        createCheckpointGate(
          frame.point,
          headingFromTangent(frame.tangent),
          this.track.accent,
          this.track.width,
        ),
      );
    }

    const glow = new THREE.PointLight(this.track.accent, 3.2, 46, 2);
    glow.position.set(startFrame.point.x, 4, startFrame.point.z);
    this.scene.add(glow);
  }

  private spawnCar(): void {
    const spawnIndex = this.track.points.length - START_GRID_OFFSET;
    const frame = trackFrame(this.track.points, spawnIndex);
    this.index = spawnIndex;
    this.previousIndex = spawnIndex;
    this.lastRespawnIndex = spawnIndex;
    this.x = frame.point.x;
    this.z = frame.point.z;
    this.heading = headingFromTangent(frame.tangent);

    this.visual = createCar(this.vehicle.color, this.vehicle.accent);
    this.visual.group.position.set(this.x, 0, this.z);
    this.visual.group.rotation.y = this.heading;
    this.scene.add(this.visual.group);

    this.cameraPosition.set(
      this.x + Math.sin(this.heading) * 9,
      4.2,
      this.z + Math.cos(this.heading) * 9,
    );
    this.camera.position.copy(this.cameraPosition);
  }

  private buildGhost(): void {
    const ghost = this.setup.ghost;
    if (!ghost || ghost.samples.length === 0) return;
    const visual = createCar('#9fd8ff', '#e6f4ff');
    visual.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          material.transparent = true;
          material.opacity = 0.3;
          material.depthWrite = false;
        }
      }
    });
    visual.group.visible = false;
    this.ghostVisual = visual;
    this.scene.add(visual.group);
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const delta = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown -= delta;
      if (this.countdown <= 0) {
        this.phase = 'running';
        this.audio.beep(1046, 180, 'sine', 0.08);
      }
      this.updateVisuals(delta);
      this.updateGhost();
      this.updateCamera(delta);
      this.renderer.render(this.scene, this.camera);
      this.hudPump.push(delta, () => this.snapshotHud());
      return;
    }

    if (this.phase === 'running') {
      this.accumulator += delta;
      let steps = 0;
      while (this.accumulator >= STEP && steps < 8 && this.phase === 'running') {
        this.stepSimulation(STEP);
        this.accumulator -= STEP;
        steps += 1;
      }

      const speedRatio = clamp(Math.abs(this.speed) / this.vehicle.maxSpeed, 0, 1);
      this.audio.setSpeed(speedRatio);
      this.audio.setEngineVolume(0.035 + speedRatio * 0.06);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - delta * 2.4);
    }

    this.updateVisuals(delta);
    this.updateGhost();
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);

    this.hudPump.push(delta, () => this.snapshotHud());
  };

  private stepSimulation(dt: number): void {
    const drive = readDriveInput(this.keyboard.keys, this.touch);
    this.driveStep(dt, drive);
    this.run = advanceRun(this.run, dt);

    const crossed: number[] = [];
    for (const gate of this.gatePoints) {
      if (modularCrossed(this.previousIndex, this.index, gate.pointIndex, this.track.points.length)) {
        crossed.push(gate.gate);
      }
    }

    for (const gate of crossed) {
      if (this.run.status === 'ready') {
        if (gate === 0) {
          this.run = beginRun(this.run);
          this.recordGhostSample();
          this.audio.beep(880, 120, 'sine', 0.07);
        }
        continue;
      }
      if (this.run.status !== 'running') break;

      const splitsBefore = this.run.splits.length;
      this.run = registerGate(this.run, gate, this.rulesConfig);
      if (this.run.splits.length > splitsBefore) this.onSplit();
      if (this.run.status === 'invalid') {
        this.invalidateRun();
        return;
      }
      if (this.run.status === 'finished') {
        this.finishRun();
        return;
      }
    }

    this.offTrack = !isOnTrack(
      this.track.points,
      this.track.width,
      this.x,
      this.z,
      this.index,
    );
    this.run = registerOffTrack(this.run, this.offTrack, dt);
    if (this.run.status === 'invalid') {
      this.invalidateRun();
      return;
    }

    this.recordGhostSample();
  }

  private driveStep(dt: number, drive: TouchDriveState): void {
    const grip = SURFACE_GRIP[surfaceAt(this.track, this.index)];
    const onTrack = isOnTrack(
      this.track.points,
      this.track.width,
      this.x,
      this.z,
      this.index,
    );
    const maxSpeed = this.vehicle.maxSpeed * grip;
    const steerTarget = (drive.left ? 1 : 0) - (drive.right ? 1 : 0);
    this.steer = damp(this.steer, steerTarget, 7.5, dt);

    if (drive.forward) {
      this.speed += this.vehicle.acceleration * dt * (onTrack ? 1 : 0.35);
    } else if (drive.back) {
      if (this.speed > 0.5) this.speed -= this.vehicle.braking * dt;
      else this.speed -= this.vehicle.acceleration * 0.55 * dt;
    } else {
      this.speed = damp(this.speed, 0, 0.65, dt);
    }

    if (drive.handbrake) this.speed = damp(this.speed, 0, 1.8, dt);
    if (!onTrack) this.speed = damp(this.speed, this.speed * 0.55, 1.5, dt);

    this.speed = clamp(this.speed, -14, maxSpeed);
    const speedRatio = clamp(Math.abs(this.speed) / 22, 0, 1);
    const direction = this.speed >= 0 ? 1 : -1;
    const steeringAuthority = clamp(Math.abs(this.speed) / 5, 0, 1);
    this.heading +=
      this.steer *
      this.vehicle.handling *
      grip *
      (drive.handbrake ? 1.45 : 1) *
      steeringAuthority *
      (0.45 + speedRatio * 0.75) *
      dt *
      direction;

    this.integrate(dt);
  }

  private integrate(dt: number): void {
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    this.x += forwardX * this.speed * dt;
    this.z += forwardZ * this.speed * dt;

    this.previousIndex = this.index;
    this.index = findNearestIndex(this.track.points, this.x, this.z, this.index);

    const frame = trackFrame(this.track.points, this.index);
    const dx = this.x - frame.point.x;
    const dz = this.z - frame.point.z;
    const lateral = dx * frame.normal.x + dz * frame.normal.z;
    const wallLimit = this.track.width / 2 + 8;
    if (Math.abs(lateral) > wallLimit) {
      const excess = Math.abs(lateral) - wallLimit;
      const sign = Math.sign(lateral);
      this.x -= frame.normal.x * excess * sign;
      this.z -= frame.normal.z * excess * sign;
      if (Math.abs(this.speed) > 8) {
        this.speed *= 0.6;
        if (this.shake < 0.2) this.audio.crash(clamp(Math.abs(this.speed) / 40, 0.3, 1));
        this.shake = 0.5;
      }
    }

    this.offTrack = Math.abs(lateral) > this.track.width / 2 + 1.6;
  }

  private onSplit(): void {
    const splitIndex = this.run.splits.length - 1;
    const best = this.setup.bestSplits;
    this.splitDelta =
      best && splitIndex >= 0 && splitIndex < best.length
        ? this.run.splits[splitIndex]! - best[splitIndex]!
        : null;
    const checkpointCount = this.track.checkpoints.length;
    if (splitIndex < checkpointCount) {
      this.lastRespawnIndex =
        this.track.checkpoints[this.run.nextGate - 2] ?? this.lastRespawnIndex;
    }
    this.audio.beep(splitIndex < checkpointCount ? 980 : 660, 110, 'sine', 0.06);
    this.emitHud();
  }

  private invalidateRun(): void {
    this.phase = 'invalid';
    this.audio.setEngineVolume(0.0001);
    this.audio.crash(0.9);
    if (this.ghostVisual) this.ghostVisual.group.visible = false;
    this.emitHud();
  }

  private finishRun(): void {
    const time = this.run.splits.at(-1) ?? this.run.clock;
    this.recordGhostSample();
    this.phase = 'finished';
    this.audio.setEngineVolume(0.0001);
    this.audio.beep(880, 140, 'sine', 0.08);
    window.setTimeout(() => this.audio.beep(1320, 300, 'sine', 0.07), 150);

    const ghost: GhostRecording = {
      version: 1,
      trackId: this.track.id,
      carId: this.vehicle.id,
      time,
      splits: [...this.run.splits],
      samples: this.samples,
    };
    this.callbacks.onFinish({
      trackId: this.track.id,
      carId: this.vehicle.id,
      time,
      splits: [...this.run.splits],
      medal: medalForTime(this.track.medals, time),
      respawns: this.run.respawns,
      ghost,
    });
    this.emitHud();
    this.frameLoop.stop();
    this.audio.stopMusic();
  }

  private recordGhostSample(): void {
    if (this.run.status !== 'running') return;
    if (this.run.clock > GHOST_MAX_SECONDS) return;
    if (!shouldSample(this.lastSampleAt, this.run.clock)) return;
    this.lastSampleAt = this.run.clock;
    this.samples.push(
      sampleGhost(this.run.clock, this.x, this.z, this.heading, Math.abs(this.speed)),
    );
  }

  private updateVisuals(delta: number): void {
    this.visual.group.position.set(this.x, 0, this.z);
    this.visual.group.rotation.y = this.heading;
    this.wheelSpin += this.speed * delta * 1.4;
    for (const wheel of this.visual.wheels) wheel.rotation.x = -this.wheelSpin;

    const ratio = clamp(Math.abs(this.speed) / this.vehicle.maxSpeed, 0, 1);
    this.visual.underglow.scale.set(1 + ratio * 0.12, 1, 1);
    const material = this.visual.underglow.material as THREE.MeshBasicMaterial;
    material.opacity = 0.22 + ratio * 0.3;
  }

  private updateGhost(): void {
    const ghost = this.setup.ghost;
    if (!this.ghostVisual || !ghost) return;
    if (this.phase !== 'running' || this.run.status !== 'running') {
      this.ghostVisual.group.visible = false;
      return;
    }
    if (this.run.clock > ghost.time + 0.1) {
      this.ghostVisual.group.visible = false;
      return;
    }
    const pose = interpolateGhost(ghost.samples, this.run.clock);
    if (!pose) {
      this.ghostVisual.group.visible = false;
      return;
    }
    this.ghostVisual.group.visible = true;
    this.ghostVisual.group.position.set(pose.x, 0, pose.z);
    this.ghostVisual.group.rotation.y = pose.heading;
  }

  private updateCamera(delta: number): void {
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const speedRatio = clamp(Math.abs(this.speed) / this.vehicle.maxSpeed, 0, 1);

    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.6 : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 0.35 : 0;

    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.cameraMode === 'hood') {
      desiredX = this.x + forwardX * 0.35;
      desiredY = 1.45;
      desiredZ = this.z + forwardZ * 0.35;
      lookX = this.x + forwardX * 26;
      lookY = 1.3;
      lookZ = this.z + forwardZ * 26;
    } else {
      const distance = this.cameraMode === 'far' ? 15 : 8.8;
      const height = this.cameraMode === 'far' ? 6.6 : 4.2;
      desiredX = this.x - forwardX * distance;
      desiredY = height;
      desiredZ = this.z - forwardZ * distance;
      lookX = this.x + forwardX * 10;
      lookY = 1.2;
      lookZ = this.z + forwardZ * 10;
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
    this.hudPump.push(0, () => this.snapshotHud(), true);
  }

  private snapshotHud(): TrialHud {
    const checkpointCount = this.track.checkpoints.length;
    const ghostPose = this.setup.ghost
      ? interpolateGhost(this.setup.ghost.samples, this.run.clock)
      : null;

    return {
      phase: this.phase,
      clock: this.run.clock,
      speed: Math.abs(this.speed) * 3.6,
      lap: Math.min(this.run.lap, this.track.laps),
      totalLaps: this.track.laps,
      sector: Math.min(this.run.nextGate, checkpointCount + 1),
      totalSectors: checkpointCount + 1,
      nextSplit:
        this.run.status === 'finished'
          ? 'done'
          : this.run.nextGate === checkpointCount + 1
            ? 'finish'
            : 'checkpoint',
      splitDelta: this.splitDelta,
      bestTime: this.setup.bestTime,
      medal: medalForTime(this.track.medals, this.run.clock),
      surface: surfaceAt(this.track, this.index),
      offTrack: this.offTrack && this.phase === 'running',
      awaitingStart: this.run.status === 'ready',
      countdown: Math.max(0, this.countdown),
      respawns: this.run.respawns,
      invalidReason: this.run.invalidReason,
      progress: this.toMinimap(this.x, this.z),
      ghostProgress: ghostPose ? this.toMinimap(ghostPose.x, ghostPose.z) : null,
    };
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

  respawn(): void {
    if (this.phase !== 'running' || this.run.status !== 'running') return;
    this.run = respawnRun(this.run);
    const frame = trackFrame(this.track.points, this.lastRespawnIndex);
    this.index = this.lastRespawnIndex;
    this.previousIndex = this.lastRespawnIndex;
    this.x = frame.point.x;
    this.z = frame.point.z;
    this.heading = headingFromTangent(frame.tangent);
    this.speed = 0;
    this.steer = 0;
    this.accumulator = 0;
    this.offTrack = false;
    this.cameraPosition.set(
      this.x + Math.sin(this.heading) * 9,
      4.2,
      this.z + Math.cos(this.heading) * 9,
    );
    this.audio.beep(240, 90, 'square', 0.05);
    this.emitHud();
  }

  getState(): TrialPhase {
    return this.phase;
  }

  getRun(): RunState {
    return this.run;
  }

  getSectorCount(): number {
    return sectorCount(this.rulesConfig);
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.frameLoop.stop();
    window.removeEventListener('resize', this.handleResize);
    this.keyboard.dispose();
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.samples = [];
  }
}
