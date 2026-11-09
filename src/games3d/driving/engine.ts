import * as THREE from 'three';
import { AnimationLoop } from '../shared/animationLoop';
import { GameAudio } from '../shared/audio';
import { createKeyboard, readDriveInput, type TouchDriveState } from '../shared/input';
import { clamp, damp, normalizeAngle } from '../shared/math';
import { createCar, disposeObject, type VehicleVisual } from '../shared/scenery';
import {
  DRIVE_CHECKPOINT_RADIUS,
  DRIVE_EXTENT,
  DRIVE_SPAWN,
  ROAD_HALF_WIDTH,
  ROAD_LINES,
  createCityEnvironment,
  createTrafficSpawns,
  getDriveCar,
  getDriveMission,
  type CityCollider,
  type DriveCameraMode,
  type DriveCar,
  type DriveCarId,
  type DriveMission,
  type TrafficSpawn,
} from './city';

export type DrivePhase = 'countdown' | 'driving' | 'finished';

export interface DriveHud {
  speedKph: number;
  phase: DrivePhase;
  countdown: number;
  missionName: string;
  checkpoint: number;
  totalCheckpoints: number;
  timeLeft: number;
  elapsed: number;
  clock: string;
  crashes: number;
  offRoad: boolean;
  distanceToTarget: number;
  targetBearing: number;
  message: string | null;
  playerHeading: number;
  minimapPlayer: { x: number; y: number };
  minimapTarget: { x: number; y: number } | null;
  minimapTraffic: { x: number; y: number }[];
}

export interface DriveResult {
  missionId: string;
  missionName: string;
  outcome: 'win' | 'loss';
  checkpoints: number;
  totalCheckpoints: number;
  elapsed: number;
  timeLimit: number;
  crashes: number;
  carId: DriveCarId;
}

export interface DriveSetup {
  missionId: string;
  carId: DriveCarId;
  camera: DriveCameraMode;
}

interface TrafficCar {
  spawn: TrafficSpawn;
  visual: VehicleVisual;
  x: number;
  z: number;
  heading: number;
  speed: number;
  baseSpeed: number;
}

const COUNTDOWN_SECONDS = 3.2;
const CAR_RADIUS = 1.75;
const CHECKPOINT_RADIUS = DRIVE_CHECKPOINT_RADIUS;
const DAY_LENGTH_SECONDS = 240;

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

function mapPoint(x: number, z: number, extent: number): { x: number; y: number } {
  return {
    x: ((x + extent) / (extent * 2)) * 100,
    y: ((z + extent) / (extent * 2)) * 100,
  };
}

function clockLabel(timeOfDay: number): string {
  const totalMinutes = Math.floor(timeOfDay * 24 * 60) % (24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export class DriveEngine {
  private renderer: THREE.WebGLRenderer;
  private frameLoop: AnimationLoop;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.3, 420);
  private lastFrame = 0;
  private keyboard: ReturnType<typeof createKeyboard>;
  private audio = new GameAudio();
  private mission: DriveMission;
  private carConfig: DriveCar;
  private cameraMode: DriveCameraMode;
  private callbackHud: (hud: DriveHud) => void;
  private callbackFinish: (result: DriveResult) => void;
  private disposed = false;
  private paused = false;
  private phase: DrivePhase = 'countdown';
  private countdown = COUNTDOWN_SECONDS;
  private lastCountdownBeep = 4;
  private elapsed = 0;
  private timeLeft: number;
  private checkpointIndex = 0;
  private crashes = 0;
  private crashCooldown = 0;
  private message: string | null = null;
  private messageTimer = 0;
  private hudTimer = 0;
  private timeOfDay = 0.36;
  private player: VehicleVisual;
  private playerX = DRIVE_SPAWN.x;
  private playerZ = DRIVE_SPAWN.z;
  private playerHeading = 0;
  private playerSpeed = 0;
  private steerVisual = 0;
  private offRoad = false;
  private touch: TouchDriveState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    handbrake: false,
  };
  private colliders: CityCollider[];
  private traffic: TrafficCar[] = [];
  private checkpointGroup: THREE.Group;
  private checkpointRings: THREE.Object3D[] = [];
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private stars: THREE.Points;
  private skyNight = new THREE.Color('#040713');
  private skyDay = new THREE.Color('#7fb0d8');
  private fogNight = new THREE.Color('#060c18');
  private fogDay = new THREE.Color('#9dbfe0');
  private sunColorDay = new THREE.Color('#fff1d6');
  private sunColorNight = new THREE.Color('#8fa9d6');
  private scratchColor = new THREE.Color();
  private cameraPosition = new THREE.Vector3(0, 8, 92);
  private cameraTarget = new THREE.Vector3(0, 1, 72);
  private background: THREE.Color;
  private fog: THREE.Fog;

  constructor(
    private canvas: HTMLCanvasElement,
    setup: DriveSetup,
    callbacks: { onHud: (hud: DriveHud) => void; onFinish: (result: DriveResult) => void },
  ) {
    this.mission = getDriveMission(setup.missionId);
    this.carConfig = getDriveCar(setup.carId);
    this.cameraMode = setup.camera;
    this.callbackHud = callbacks.onHud;
    this.callbackFinish = callbacks.onFinish;
    this.timeLeft = this.mission.timeLimit;
    this.keyboard = createKeyboard(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.background = this.skyNight.clone();
    this.fog = new THREE.Fog(this.fogNight.clone(), 70, 240);
    this.scene.background = this.background;
    this.scene.fog = this.fog;

    const hemisphere = new THREE.HemisphereLight('#cfe4ff', '#0a1626', 0.9);
    this.hemi = hemisphere;
    this.scene.add(hemisphere);

    this.sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    this.sun.position.set(60, 80, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 320;
    this.sun.shadow.camera.left = -110;
    this.sun.shadow.camera.right = 110;
    this.sun.shadow.camera.top = 110;
    this.sun.shadow.camera.bottom = -110;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);

    const fill = new THREE.DirectionalLight('#7ca6ff', 0.35);
    fill.position.set(-60, 40, -50);
    this.scene.add(fill);

    const environment = createCityEnvironment();
    this.scene.add(environment.group);
    this.colliders = environment.colliders;
    this.stars = environment.stars;

    this.player = createCar(this.carConfig.color, this.carConfig.accent);
    this.player.group.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.player.group);

    this.spawnTraffic();
    this.checkpointGroup = this.buildCheckpoint();
    this.scene.add(this.checkpointGroup);
    this.placeCheckpoint();

    this.applyTimeOfDay();
    this.resize();
    window.addEventListener('resize', this.handleResize);
    this.canvas.focus();

    this.audio.start();
    this.audio.setEngineVolume(0.03);
    this.frameLoop = new AnimationLoop((callback) => this.renderer.setAnimationLoop(callback));
    this.frameLoop.start(this.loop);
    this.emitHud();
  }

  private spawnTraffic(): void {
    for (const spawn of createTrafficSpawns()) {
      const visual = createCar(spawn.color, spawn.accent);
      const x = spawn.axis === 'x' ? spawn.position : spawn.lane;
      const z = spawn.axis === 'x' ? spawn.lane : spawn.position;
      const heading =
        spawn.axis === 'x'
          ? spawn.direction === 1
            ? -Math.PI / 2
            : Math.PI / 2
          : spawn.direction === 1
            ? Math.PI
            : 0;
      visual.group.position.set(x, 0, z);
      visual.group.rotation.y = heading;
      this.scene.add(visual.group);
      this.traffic.push({ spawn, visual, x, z, heading, speed: spawn.speed, baseSpeed: spawn.speed });
    }
  }

  private buildCheckpoint(): THREE.Group {
    const group = new THREE.Group();
    const accent = this.mission.id === 'first-light' ? '#38e8ff' : '#ffd166';
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const outer = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.18, 8, 56), ringMaterial);
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.16;
    const inner = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.07, 8, 48), innerMaterial);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.18;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 12, 32, 1, true), beamMaterial);
    beam.position.y = 6;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 12, 10),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7 }),
    );
    core.position.y = 6;
    group.add(outer, inner, beam, core);
    this.checkpointRings = [outer, inner];
    return group;
  }

  private placeCheckpoint(): void {
    const target = this.currentTarget();
    this.checkpointGroup.visible = Boolean(target);
    if (!target) return;
    this.checkpointGroup.position.set(target.x, 0, target.z);
  }

  private currentTarget(): { x: number; z: number } | null {
    return this.mission.route[this.checkpointIndex] ?? null;
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const delta = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - delta);
      const beep = Math.ceil(this.countdown);
      if (beep < this.lastCountdownBeep && beep > 0) {
        this.lastCountdownBeep = beep;
        this.audio.countdown(beep === 1);
      }
      if (this.countdown <= 0) {
        this.phase = 'driving';
        this.audio.countdown(true);
        this.lastCountdownBeep = 0;
      }
      this.applyTimeOfDay();
    } else if (this.phase === 'driving') {
      this.elapsed += delta;
      this.timeLeft = Math.max(0, this.mission.timeLimit - this.elapsed);
      this.timeOfDay = (this.timeOfDay + delta / DAY_LENGTH_SECONDS) % 1;
      this.crashCooldown = Math.max(0, this.crashCooldown - delta);
      this.messageTimer = Math.max(0, this.messageTimer - delta);
      if (this.messageTimer <= 0) this.message = null;

      this.updatePlayer(delta);
      this.updateTraffic(delta);
      this.resolveCollisions();
      this.checkCheckpoint();

      if (this.phase === 'driving' && this.timeLeft <= 0) {
        this.finish(false);
      }
      this.applyTimeOfDay();
    }

    this.updateCarVisual(delta);
    this.updateCheckpointVisual(delta);
    this.updateCamera(delta);
    this.audio.setSpeed(Math.abs(this.playerSpeed) / this.carConfig.maxSpeed);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer += delta;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
  };

  private updatePlayer(delta: number): void {
    const input = readDriveInput(this.keyboard.keys, this.touch);

    if (input.handbrake) {
      this.playerSpeed = approach(this.playerSpeed, 0, 26 * delta);
    } else if (input.forward) {
      const maxSpeed = this.offRoad ? this.carConfig.maxSpeed * 0.55 : this.carConfig.maxSpeed;
      this.playerSpeed = approach(this.playerSpeed, maxSpeed, this.carConfig.acceleration * delta);
    } else if (input.back) {
      if (this.playerSpeed > 0.4) {
        this.playerSpeed = approach(this.playerSpeed, 0, 25 * delta);
      } else {
        this.playerSpeed = approach(this.playerSpeed, -this.carConfig.reverseSpeed, 9 * delta);
      }
    } else {
      this.playerSpeed = approach(this.playerSpeed, 0, 5 * delta);
    }

    if (this.offRoad) {
      this.playerSpeed = approach(this.playerSpeed, 0, 3.2 * delta);
    }

    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steerVisual = damp(this.steerVisual, steerInput, 8, delta);
    const authority = clamp(Math.abs(this.playerSpeed) / 6, 0, 1);
    const driftBoost = input.handbrake ? 1.35 : 1;
    this.playerHeading +=
      steerInput * this.carConfig.handling * 0.62 * authority * driftBoost * Math.sign(this.playerSpeed || 1) * delta;

    const forwardX = -Math.sin(this.playerHeading);
    const forwardZ = -Math.cos(this.playerHeading);
    this.playerX += forwardX * this.playerSpeed * delta;
    this.playerZ += forwardZ * this.playerSpeed * delta;

    if (this.playerX > DRIVE_EXTENT || this.playerX < -DRIVE_EXTENT) {
      this.playerX = clamp(this.playerX, -DRIVE_EXTENT, DRIVE_EXTENT);
      this.playerSpeed *= 0.35;
      this.registerCrash();
    }
    if (this.playerZ > DRIVE_EXTENT || this.playerZ < -DRIVE_EXTENT) {
      this.playerZ = clamp(this.playerZ, -DRIVE_EXTENT, DRIVE_EXTENT);
      this.playerSpeed *= 0.35;
      this.registerCrash();
    }

    const nearestX = Math.min(...ROAD_LINES.map((line) => Math.abs(this.playerX - line)));
    const nearestZ = Math.min(...ROAD_LINES.map((line) => Math.abs(this.playerZ - line)));
    this.offRoad = nearestX > ROAD_HALF_WIDTH + 2.2 && nearestZ > ROAD_HALF_WIDTH + 2.2;
  }

  private updateTraffic(delta: number): void {
    for (const car of this.traffic) {
      const aheadX = this.playerX - car.x;
      const aheadZ = this.playerZ - car.z;
      const forwardX = -Math.sin(car.heading);
      const forwardZ = -Math.cos(car.heading);
      const ahead = aheadX * forwardX + aheadZ * forwardZ;
      const lateral = Math.abs(aheadX * forwardZ - aheadZ * forwardX);
      const shouldBrake = ahead > 0 && ahead < 13 && lateral < 2.6;

      const targetSpeed = shouldBrake ? 0 : car.baseSpeed;
      car.speed = approach(car.speed, targetSpeed, (shouldBrake ? 18 : 5) * delta);

      if (car.spawn.axis === 'x') {
        car.x += car.spawn.direction * car.speed * delta;
        if (car.x > DRIVE_EXTENT + 2) car.x = -DRIVE_EXTENT - 2;
        if (car.x < -DRIVE_EXTENT - 2) car.x = DRIVE_EXTENT + 2;
      } else {
        car.z += car.spawn.direction * car.speed * delta;
        if (car.z > DRIVE_EXTENT + 2) car.z = -DRIVE_EXTENT - 2;
        if (car.z < -DRIVE_EXTENT - 2) car.z = DRIVE_EXTENT + 2;
      }
    }
  }

  private resolveCollisions(): void {
    for (const collider of this.colliders) {
      const closestX = clamp(this.playerX, collider.minX, collider.maxX);
      const closestZ = clamp(this.playerZ, collider.minZ, collider.maxZ);
      const dx = this.playerX - closestX;
      const dz = this.playerZ - closestZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= CAR_RADIUS * CAR_RADIUS) continue;

      if (distanceSq > 0.0001) {
        const distance = Math.sqrt(distanceSq);
        const push = CAR_RADIUS - distance;
        this.playerX += (dx / distance) * push;
        this.playerZ += (dz / distance) * push;
      } else {
        const toLeft = this.playerX - collider.minX;
        const toRight = collider.maxX - this.playerX;
        const toTop = this.playerZ - collider.minZ;
        const toBottom = collider.maxZ - this.playerZ;
        const smallest = Math.min(toLeft, toRight, toTop, toBottom);
        if (smallest === toLeft) this.playerX = collider.minX - CAR_RADIUS;
        else if (smallest === toRight) this.playerX = collider.maxX + CAR_RADIUS;
        else if (smallest === toTop) this.playerZ = collider.minZ - CAR_RADIUS;
        else this.playerZ = collider.maxZ + CAR_RADIUS;
      }
      this.playerSpeed *= 0.3;
      this.registerCrash();
    }

    for (const car of this.traffic) {
      const dx = this.playerX - car.x;
      const dz = this.playerZ - car.z;
      const distance = Math.hypot(dx, dz);
      const minimum = CAR_RADIUS + 2.1;
      if (distance < minimum && distance > 0.001) {
        const push = minimum - distance;
        this.playerX += (dx / distance) * push;
        this.playerZ += (dz / distance) * push;
        this.playerSpeed *= 0.32;
        this.registerCrash();
      }
    }
  }

  private registerCrash(): void {
    if (this.crashCooldown > 0) return;
    this.crashCooldown = 1.1;
    this.crashes += 1;
    this.audio.crash(0.9);
  }

  private checkCheckpoint(): void {
    const target = this.currentTarget();
    if (!target) return;
    const distance = Math.hypot(this.playerX - target.x, this.playerZ - target.z);
    if (distance > CHECKPOINT_RADIUS) return;

    this.checkpointIndex += 1;
    this.audio.lap();
    if (this.checkpointIndex >= this.mission.route.length) {
      this.finish(true);
      return;
    }
    this.message = `Checkpoint ${this.checkpointIndex}/${this.mission.route.length}`;
    this.messageTimer = 2;
    this.placeCheckpoint();
    this.emitHud();
  }

  private finish(completed: boolean): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.checkpointGroup.visible = false;
    this.audio.setEngineVolume(0.0001);
    if (completed) this.audio.lap();
    this.callbackFinish({
      missionId: this.mission.id,
      missionName: this.mission.name,
      outcome: completed ? 'win' : 'loss',
      checkpoints: this.checkpointIndex,
      totalCheckpoints: this.mission.route.length,
      elapsed: this.elapsed,
      timeLimit: this.mission.timeLimit,
      crashes: this.crashes,
      carId: this.carConfig.id,
    });
    this.emitHud();
    this.frameLoop.stop();
    this.audio.stopMusic();
  }

  private updateCarVisual(delta: number): void {
    this.player.group.position.set(this.playerX, 0, this.playerZ);
    this.player.group.rotation.y = this.playerHeading;

    const wheelSpin = this.playerSpeed * delta / 0.38;
    this.player.wheels.forEach((wheel, index) => {
      wheel.rotation.x += wheelSpin;
      if (index === 0 || index === 2) {
        wheel.rotation.y = this.steerVisual * 0.35;
      }
    });

    const glow = this.player.underglow.material as THREE.MeshBasicMaterial;
    glow.opacity = 0.24 + Math.sin(performance.now() * 0.004) * 0.08;

    for (const car of this.traffic) {
      car.visual.group.position.set(car.x, 0, car.z);
      car.visual.group.rotation.y = car.heading;
      car.visual.wheels.forEach((wheel) => {
        wheel.rotation.x += car.speed * delta / 0.38;
      });
    }
  }

  private updateCheckpointVisual(delta: number): void {
    if (!this.checkpointGroup.visible) return;
    for (const ring of this.checkpointRings) {
      ring.rotation.z += delta * 0.55;
    }
    const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.05;
    this.checkpointGroup.scale.setScalar(pulse);
  }

  private updateCamera(delta: number): void {
    const forwardX = -Math.sin(this.playerHeading);
    const forwardZ = -Math.cos(this.playerHeading);
    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.cameraMode === 'hood') {
      desiredX = this.playerX + forwardX * 0.9;
      desiredY = 1.28;
      desiredZ = this.playerZ + forwardZ * 0.9;
      lookX = this.playerX + forwardX * 26;
      lookY = 1.1;
      lookZ = this.playerZ + forwardZ * 26;
    } else if (this.cameraMode === 'far') {
      desiredX = this.playerX - forwardX * 17;
      desiredY = 9.5;
      desiredZ = this.playerZ - forwardZ * 17;
      lookX = this.playerX + forwardX * 20;
      lookY = 1.4;
      lookZ = this.playerZ + forwardZ * 20;
    } else {
      desiredX = this.playerX - forwardX * 10.5;
      desiredY = 5.4;
      desiredZ = this.playerZ - forwardZ * 10.5;
      lookX = this.playerX + forwardX * 15;
      lookY = 1.3;
      lookZ = this.playerZ + forwardZ * 15;
    }

    this.cameraPosition.x = damp(this.cameraPosition.x, desiredX, 4.6, delta);
    this.cameraPosition.y = damp(this.cameraPosition.y, desiredY, 4.6, delta);
    this.cameraPosition.z = damp(this.cameraPosition.z, desiredZ, 4.6, delta);
    this.camera.position.copy(this.cameraPosition);

    this.cameraTarget.x = damp(this.cameraTarget.x, lookX, 6, delta);
    this.cameraTarget.y = damp(this.cameraTarget.y, lookY, 6, delta);
    this.cameraTarget.z = damp(this.cameraTarget.z, lookZ, 6, delta);
    this.camera.lookAt(this.cameraTarget);

    const speedRatio = clamp(Math.abs(this.playerSpeed) / this.carConfig.maxSpeed, 0, 1);
    const targetFov = 56 + speedRatio * 12;
    this.camera.fov = damp(this.camera.fov, targetFov, 2.5, delta);
    this.camera.updateProjectionMatrix();
  }

  private applyTimeOfDay(): void {
    const daylight = clamp(Math.sin((this.timeOfDay - 0.25) * Math.PI * 2) * 0.5 + 0.5, 0, 1);
    this.background.copy(this.skyNight).lerp(this.skyDay, daylight);
    this.fog.color.copy(this.fogNight).lerp(this.fogDay, daylight);
    this.scratchColor.copy(this.sunColorNight).lerp(this.sunColorDay, daylight);
    this.sun.color.copy(this.scratchColor);
    this.sun.intensity = 0.12 + daylight * 2.3;
    this.hemi.intensity = 0.3 + daylight * 0.75;

    const solarAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    this.sun.position.set(Math.cos(solarAngle) * 85, Math.max(12, Math.sin(solarAngle) * 90), 48);

    const starMaterial = this.stars.material as THREE.PointsMaterial;
    starMaterial.opacity = 0.9 * (1 - daylight);
  }

  private emitHud(): void {
    const target = this.currentTarget();
    const dx = target ? target.x - this.playerX : 0;
    const dz = target ? target.z - this.playerZ : 0;
    const distance = target ? Math.hypot(dx, dz) : 0;
    const bearing = target ? normalizeAngle(Math.atan2(-dx, -dz) - this.playerHeading) : 0;

    this.callbackHud({
      speedKph: Math.abs(this.playerSpeed) * 3.6,
      phase: this.phase,
      countdown: Math.ceil(this.countdown),
      missionName: this.mission.name,
      checkpoint: this.checkpointIndex,
      totalCheckpoints: this.mission.route.length,
      timeLeft: this.timeLeft,
      elapsed: this.elapsed,
      clock: clockLabel(this.timeOfDay),
      crashes: this.crashes,
      offRoad: this.offRoad,
      distanceToTarget: distance,
      targetBearing: bearing,
      message: this.message,
      playerHeading: this.playerHeading,
      minimapPlayer: mapPoint(this.playerX, this.playerZ, DRIVE_EXTENT),
      minimapTarget: target ? mapPoint(target.x, target.z, DRIVE_EXTENT) : null,
      minimapTraffic: this.traffic.map((car) => mapPoint(car.x, car.z, DRIVE_EXTENT)),
    });
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth || 960;
    const height = parent?.clientHeight || 540;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  setTouch(patch: Partial<TouchDriveState>): void {
    this.touch = { ...this.touch, ...patch };
  }

  cycleCamera(): DriveCameraMode {
    const order: DriveCameraMode[] = ['chase', 'far', 'hood'];
    const index = order.indexOf(this.cameraMode);
    this.cameraMode = order[(index + 1) % order.length]!;
    return this.cameraMode;
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  pause(): void {
    this.paused = true;
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
    this.traffic = [];
    this.colliders = [];
  }
}

export { DRIVE_EXTENT, ROAD_LINES, ROAD_HALF_WIDTH };
