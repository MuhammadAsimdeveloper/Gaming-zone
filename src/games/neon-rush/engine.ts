import * as THREE from 'three';
import { GameAudio } from '../../games3d/shared/audio';
import { createKeyboard } from '../../games3d/shared/input';
import { disposeObject } from '../../games3d/shared/scenery';
import { LANE_X } from './chunks';
import { applyPlayerAction, type PlayerAction } from './player';
import {
  applyRunAction,
  createRun,
  dronePressure,
  multiplierFor,
  stepRun,
  type RunEndReason,
  type RunEvent,
  type RunMode,
  type RunState,
} from './run';
import type { QualityPreset } from './persistence';

export interface NeonRushSetup {
  mode: RunMode;
  seed: number;
  quality: QualityPreset;
}

export interface NeonRushHud {
  phase: 'countdown' | 'playing' | 'paused' | 'finished';
  countdown: number;
  mode: RunMode;
  score: number;
  distance: number;
  speedKph: number;
  shards: number;
  combo: number;
  multiplier: number;
  crashes: number;
  timeLeft: number;
  shield: boolean;
  magnet: number;
  overdrive: number;
  dronePressure: number;
}

export interface NeonRushResult {
  mode: RunMode;
  score: number;
  distance: number;
  shards: number;
  crashes: number;
  elapsed: number;
  endReason: RunEndReason;
}

interface Callbacks {
  onHud: (hud: NeonRushHud) => void;
  onFinish: (result: NeonRushResult) => void;
}

const COUNTDOWN_SECONDS = 3;
const VISUAL_AHEAD = 220;
const VISUAL_BEHIND = 16;
const SKYLINE_SPACING = 26;
const SKYLINE_COUNT = 14;

const QUALITY: Record<QualityPreset, { pixelRatio: number; shadows: boolean; antialias: boolean; fogFar: number }> = {
  high: { pixelRatio: 2, shadows: true, antialias: true, fogFar: 230 },
  balanced: { pixelRatio: 1.5, shadows: false, antialias: true, fogFar: 190 },
  performance: { pixelRatio: 1, shadows: false, antialias: false, fogFar: 150 },
};

function makeEmissive(color: string, intensity = 1.4): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#0b1224',
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.5,
  });
}

function makeSolid(color: string, roughness = 0.6, metalness = 0.4): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class NeonRushEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private run: RunState;
  private callbacks: Callbacks;
  private keyboard: ReturnType<typeof createKeyboard>;
  private lastKeys = new Set<string>();
  private audio = new GameAudio();
  private disposed = false;
  private paused = false;
  private pausedFrom: 'countdown' | 'playing' = 'playing';
  private phase: 'countdown' | 'playing' | 'paused' | 'finished' = 'countdown';
  private countdown = COUNTDOWN_SECONDS;
  private lastBeep = 4;
  private lastFrame = 0;
  private accumulator = 0;
  private hudTimer = 0;
  private syncTimer = 0;
  private elapsedVisual = 0;
  private quality: QualityPreset;

  private ground: THREE.Mesh;
  private sideStrips: THREE.Mesh[] = [];
  private dashPool: THREE.Mesh[] = [];
  private skyline: THREE.Group[] = [];
  private speedLines: THREE.Points | null = null;
  private speedLinePositions: Float32Array | null = null;
  private playerGroup = new THREE.Group();
  private playerBody = new THREE.Group();
  private playerArmL = new THREE.Group();
  private playerArmR = new THREE.Group();
  private playerLegL = new THREE.Group();
  private playerLegR = new THREE.Group();
  private drone = new THREE.Group();
  private droneCore!: THREE.Mesh;

  private obstacleMeshes = new Map<number, THREE.Group>();
  private shardMeshes = new Map<number, THREE.Mesh>();
  private powerupMeshes = new Map<number, THREE.Group>();

  private trainBody: THREE.BoxGeometry;
  private trainGlass: THREE.BoxGeometry;
  private barrierBody: THREE.BoxGeometry;
  private barrierStripe: THREE.BoxGeometry;
  private gateBar: THREE.BoxGeometry;
  private gatePost: THREE.BoxGeometry;
  private shardGeometry: THREE.OctahedronGeometry;
  private powerupGeometry: THREE.IcosahedronGeometry;
  private powerupRing: THREE.TorusGeometry;

  private trainShell = makeSolid('#141a2c', 0.4, 0.7);
  private trainWindow = makeEmissive('#4c8dff', 1.6);
  private barrierMaterial = makeEmissive('#ff6b6b', 1.8);
  private barrierStripeMaterial = makeSolid('#f5f7ff', 0.4, 0.2);
  private gateMaterial = makeEmissive('#b285ff', 1.5);
  private shardMaterial = makeEmissive('#69f0ff', 2);
  private shieldMaterial = makeEmissive('#4c8dff', 1.8);
  private magnetMaterial = makeEmissive('#b285ff', 1.8);
  private overdriveMaterial = makeEmissive('#ffb347', 2);
  private ringMaterial = makeEmissive('#ffffff', 1.2);

  constructor(
    private canvas: HTMLCanvasElement,
    setup: NeonRushSetup,
    callbacks: Callbacks,
  ) {
    this.run = createRun(setup.mode, setup.seed);
    this.callbacks = callbacks;
    this.quality = setup.quality;
    this.keyboard = createKeyboard(this.canvas);
    const profile = QUALITY[setup.quality];

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: profile.antialias,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color('#050814');
    this.scene.fog = new THREE.Fog('#050814', 24, profile.fogFar);

    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, profile.fogFar + 80);

    const hemisphere = new THREE.HemisphereLight('#9fc4ff', '#070d1f', 1.05);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#dfe9ff', 2.1);
    sun.position.set(18, 34, -12);
    sun.castShadow = profile.shadows;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
    const rim = new THREE.PointLight('#b285ff', 24, 40, 2);
    rim.position.set(0, 7, -4);
    this.scene.add(rim);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 380),
      new THREE.MeshStandardMaterial({ color: '#070d1c', roughness: 0.92, metalness: 0.25 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = profile.shadows;
    this.scene.add(this.ground);

    const stripGeometry = new THREE.BoxGeometry(0.08, 0.04, 380);
    for (const x of [-5.2, 5.2, -7.4, 7.4]) {
      const strip = new THREE.Mesh(stripGeometry, makeEmissive(x < 0 ? '#2d6bff' : '#b285ff', 1.2));
      strip.position.set(x, 0.02, 0);
      this.scene.add(strip);
      this.sideStrips.push(strip);
    }

    const dashGeometry = new THREE.BoxGeometry(0.06, 0.02, 2.2);
    const dashMaterial = makeEmissive('#1f3d78', 1.1);
    for (let i = 0; i < 40; i += 1) {
      const dash = new THREE.Mesh(dashGeometry, dashMaterial);
      dash.position.set(0, 0.015, i * 8 - VISUAL_BEHIND);
      this.scene.add(dash);
      this.dashPool.push(dash);
    }

    this.buildSkyline();
    this.buildPlayer();
    this.buildDrone();

    this.trainBody = new THREE.BoxGeometry(1.9, 2.3, 6);
    this.trainGlass = new THREE.BoxGeometry(1.6, 0.62, 0.12);
    this.barrierBody = new THREE.BoxGeometry(1.9, 0.5, 0.72);
    this.barrierStripe = new THREE.BoxGeometry(1.94, 0.12, 0.76);
    this.gateBar = new THREE.BoxGeometry(2.1, 0.24, 0.5);
    this.gatePost = new THREE.BoxGeometry(0.12, 1.7, 0.5);
    this.shardGeometry = new THREE.OctahedronGeometry(0.24, 0);
    this.powerupGeometry = new THREE.IcosahedronGeometry(0.32, 0);
    this.powerupRing = new THREE.TorusGeometry(0.48, 0.04, 8, 24);

    if (setup.quality === 'high') this.buildSpeedLines();

    this.resize();
    window.addEventListener('resize', this.handleResize);
    this.canvas.focus();
    this.audio.start();
    this.audio.setEngineVolume(0.018);
    this.syncVisuals(true);
    this.emitHud();
    this.renderer.setAnimationLoop(this.loop);
  }

  private buildSkyline(): void {
    const heights = [3.2, 5.4, 4.1, 7.2, 2.8, 6.1, 4.8, 8.4, 3.6, 5.9, 4.4, 7.8, 3.1, 6.4];
    for (let i = 0; i < SKYLINE_COUNT; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const height = heights[i] ?? 4;
      const group = new THREE.Group();
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, height, 2.4),
        makeSolid(side < 0 ? '#0b1226' : '#0d102b', 0.5, 0.5),
      );
      tower.position.y = height / 2;
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.12, 2.5),
        makeEmissive(side < 0 ? '#2d6bff' : '#b285ff', 1.4),
      );
      crown.position.y = height + 0.02;
      const windowStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, height * 0.7, 0.1),
        makeEmissive(side < 0 ? '#4c8dff' : '#69f0ff', 1.1),
      );
      windowStrip.position.set(1.22, height * 0.5, 0);
      group.add(tower, crown, windowStrip);
      group.position.set(side * (9 + (i % 3) * 2.6), 0, i * SKYLINE_SPACING - VISUAL_BEHIND);
      this.scene.add(group);
      this.skyline.push(group);
    }
  }

  private buildPlayer(): void {
    const suit = makeSolid('#f2f5ff', 0.45, 0.3);
    const accent = makeEmissive('#4c8dff', 1.6);
    const skin = makeSolid('#ffcf9f', 0.7, 0.05);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), suit);
    torso.position.y = 0.96;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.38), accent);
    chest.position.set(0, 1.06, 0.02);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
    head.position.y = 1.44;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), accent);
    visor.position.set(0, 1.46, 0.18);
    this.playerBody.add(torso, chest, head, visor);
    this.playerBody.position.y = 0.32;

    const armGeometry = new THREE.BoxGeometry(0.16, 0.5, 0.16);
    const legGeometry = new THREE.BoxGeometry(0.2, 0.62, 0.2);
    const armL = new THREE.Mesh(armGeometry, suit);
    armL.position.y = -0.24;
    this.playerArmL.add(armL);
    this.playerArmL.position.set(-0.4, 1.24, 0);
    const armR = armL.clone();
    this.playerArmR.add(armR);
    this.playerArmR.position.set(0.4, 1.24, 0);
    const legL = new THREE.Mesh(legGeometry, makeSolid('#141a2c', 0.5, 0.4));
    legL.position.y = -0.3;
    this.playerLegL.add(legL);
    this.playerLegL.position.set(-0.17, 0.66, 0);
    const legR = new THREE.Mesh(legGeometry, makeSolid('#141a2c', 0.5, 0.4));
    legR.position.y = -0.3;
    this.playerLegR.add(legR);
    this.playerLegR.position.set(0.17, 0.66, 0);

    this.playerGroup.add(this.playerBody, this.playerArmL, this.playerArmR, this.playerLegL, this.playerLegR);
    this.playerBody.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = this.quality !== 'performance';
    });
    this.scene.add(this.playerGroup);
  }

  private buildDrone(): void {
    this.droneCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      makeEmissive('#ff4d6d', 2.4),
    );
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24), makeEmissive('#ff4d6d', 1.6));
    ring.rotation.x = Math.PI / 2;
    this.drone.add(this.droneCore, ring);
    this.drone.visible = false;
    this.scene.add(this.drone);
  }

  private buildSpeedLines(): void {
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = 0.4 + Math.random() * 6;
      positions[i * 3 + 2] = -VISUAL_BEHIND + Math.random() * 200;
    }
    this.speedLinePositions = positions;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: '#8fb6ff',
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.speedLines = new THREE.Points(geometry, material);
    this.scene.add(this.speedLines);
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const delta = Math.min((now - (this.lastFrame || now)) / 1000, 0.1);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - delta);
      const beep = Math.ceil(this.countdown);
      if (beep < this.lastBeep && beep > 0) {
        this.lastBeep = beep;
        this.audio.countdown(beep === 1);
      }
      if (this.countdown === 0) {
        this.phase = 'playing';
        this.audio.countdown(true);
        this.lastBeep = 0;
        this.emitHud();
      }
    } else if (this.phase === 'playing') {
      this.pollKeyboard();
      this.accumulator += delta;
      while (this.accumulator >= 0.02) {
        const events = stepRun(this.run, 0.02);
        this.accumulator -= 0.02;
        this.handleEvents(events);
        if (this.run.ended) break;
      }
      if (this.run.ended) this.finish();
    }

    this.updateVisuals(delta);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer += delta;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }

    this.syncTimer += delta;
    if (this.syncTimer >= 0.12) {
      this.syncTimer = 0;
      this.syncVisuals(false);
    }
  };

  private pollKeyboard(): void {
    const keys = this.keyboard.keys;
    const pressed = (...codes: string[]): boolean =>
      codes.some((code) => keys.has(code) && !this.lastKeys.has(code));

    if (pressed('ArrowLeft', 'KeyA')) applyPlayerAction(this.run.player, 'left');
    if (pressed('ArrowRight', 'KeyD')) applyPlayerAction(this.run.player, 'right');
    if (pressed('ArrowUp', 'KeyW', 'Space')) applyPlayerAction(this.run.player, 'jump');
    if (pressed('ArrowDown', 'KeyS')) applyPlayerAction(this.run.player, 'roll');

    this.lastKeys = new Set(keys);
  }

  private handleEvents(events: RunEvent[]): void {
    for (const event of events) {
      if (event === 'shard') this.audio.beep(920, 55, 'sine', 0.045);
      else if (event === 'powerup') this.audio.lap();
      else if (event === 'shield-break') this.audio.beep(280, 180, 'sawtooth', 0.08);
      else if (event === 'crash') this.audio.crash(1.4);
      else if (event === 'end') this.audio.beep(160, 420, 'sawtooth', 0.09);
    }
  }

  private finish(): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.audio.setEngineVolume(0.002);
    this.emitHud();
    this.callbacks.onFinish({
      mode: this.run.mode,
      score: this.run.score,
      distance: Math.floor(this.run.distance),
      shards: this.run.shards,
      crashes: this.run.crashes,
      elapsed: this.run.elapsed,
      endReason: this.run.endReason ?? 'drone',
    });
  }

  private syncVisuals(force: boolean): void {
    const distance = this.run.distance;
    const low = distance - VISUAL_BEHIND;
    const high = distance + VISUAL_AHEAD;

    this.ground.position.set(0, -0.02, distance + 150);
    for (const strip of this.sideStrips) strip.position.z = distance + 150;

    for (const dash of this.dashPool) {
      while (dash.position.z < low) dash.position.z += 320;
      if (force) dash.position.z = ((dash.position.z - distance + 16) % 320 + 320) % 320 + distance - 16;
    }
    for (const tower of this.skyline) {
      while (tower.position.z < low - 20) tower.position.z += SKYLINE_SPACING * SKYLINE_COUNT;
      if (force) {
        tower.position.z =
          ((tower.position.z - distance + VISUAL_BEHIND) % (SKYLINE_SPACING * SKYLINE_COUNT) +
            SKYLINE_SPACING * SKYLINE_COUNT) %
            (SKYLINE_SPACING * SKYLINE_COUNT) +
          distance -
          VISUAL_BEHIND;
      }
    }

    const activeObstacles = new Set<number>();
    for (const obstacle of this.run.track.obstacles) {
      if (obstacle.z < low || obstacle.z > high) continue;
      activeObstacles.add(obstacle.id);
      let mesh = this.obstacleMeshes.get(obstacle.id);
      if (!mesh) {
        mesh = this.createObstacleMesh(obstacle.kind);
        this.obstacleMeshes.set(obstacle.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(LANE_X[obstacle.lane], 0, obstacle.z + obstacle.length / 2);
    }
    for (const [id, mesh] of this.obstacleMeshes) {
      if (activeObstacles.has(id)) continue;
      this.scene.remove(mesh);
      this.obstacleMeshes.delete(id);
    }

    const activeShards = new Set<number>();
    for (const shard of this.run.track.shards) {
      if (shard.z < low || shard.z > high) continue;
      activeShards.add(shard.id);
      let mesh = this.shardMeshes.get(shard.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.shardGeometry, this.shardMaterial);
        this.shardMeshes.set(shard.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = !shard.collected;
      mesh.position.set(LANE_X[shard.lane], 0.95, shard.z);
    }
    for (const [id, mesh] of this.shardMeshes) {
      if (activeShards.has(id)) continue;
      this.scene.remove(mesh);
      this.shardMeshes.delete(id);
    }

    const activePowerups = new Set<number>();
    for (const powerUp of this.run.track.powerups) {
      if (powerUp.z < low || powerUp.z > high) continue;
      activePowerups.add(powerUp.id);
      let group = this.powerupMeshes.get(powerUp.id);
      if (!group) {
        group = new THREE.Group();
        const core = new THREE.Mesh(
          this.powerupGeometry,
          powerUp.kind === 'shield'
            ? this.shieldMaterial
            : powerUp.kind === 'magnet'
              ? this.magnetMaterial
              : this.overdriveMaterial,
        );
        const ring = new THREE.Mesh(this.powerupRing, this.ringMaterial);
        ring.rotation.x = Math.PI / 2;
        group.add(core, ring);
        this.powerupMeshes.set(powerUp.id, group);
        this.scene.add(group);
      }
      group.visible = !powerUp.collected;
      group.position.set(LANE_X[powerUp.lane], 1.1, powerUp.z);
    }
    for (const [id, group] of this.powerupMeshes) {
      if (activePowerups.has(id)) continue;
      this.scene.remove(group);
      this.powerupMeshes.delete(id);
    }
  }

  private createObstacleMesh(kind: 'train' | 'barrier' | 'gate'): THREE.Group {
    const group = new THREE.Group();
    if (kind === 'train') {
      const body = new THREE.Mesh(this.trainBody, this.trainShell);
      body.position.y = 1.15;
      body.castShadow = this.quality === 'high';
      const glass = new THREE.Mesh(this.trainGlass, this.trainWindow);
      glass.position.set(0, 1.55, -3.02);
      const tail = new THREE.Mesh(this.trainGlass, this.trainWindow);
      tail.position.set(0, 1.55, 3.02);
      group.add(body, glass, tail);
    } else if (kind === 'barrier') {
      const body = new THREE.Mesh(this.barrierBody, this.barrierMaterial);
      body.position.y = 0.28;
      const stripe = new THREE.Mesh(this.barrierStripe, this.barrierStripeMaterial);
      stripe.position.y = 0.4;
      const postL = new THREE.Mesh(this.gatePost, this.barrierStripeMaterial);
      postL.scale.y = 0.28;
      postL.position.set(-0.9, 0.15, 0);
      const postR = postL.clone();
      postR.position.x = 0.9;
      group.add(body, stripe, postL, postR);
    } else {
      const bar = new THREE.Mesh(this.gateBar, this.gateMaterial);
      bar.position.y = 1.32;
      const postL = new THREE.Mesh(this.gatePost, this.gateMaterial);
      postL.position.set(-1.0, 0.85, 0);
      const postR = postL.clone();
      postR.position.x = 1.0;
      group.add(bar, postL, postR);
    }
    return group;
  }

  private updateVisuals(delta: number): void {
    this.elapsedVisual += delta;
    const player = this.run.player;
    const bob = Math.sin(this.elapsedVisual * (8 + this.run.speed * 0.4)) * 0.035;
    this.playerGroup.position.set(player.x, player.y + bob, this.run.distance + 0.4);
    this.playerGroup.rotation.z = (LANE_X[player.lane] - player.x) * 0.12;
    const stride = Math.sin(this.elapsedVisual * (10 + this.run.speed * 0.5)) * 0.75;
    this.playerArmL.rotation.x = stride;
    this.playerArmR.rotation.x = -stride;
    this.playerLegL.rotation.x = -stride * 0.85;
    this.playerLegR.rotation.x = stride * 0.85;
    const rolling = player.rolling;
    this.playerBody.rotation.x = rolling ? 1.25 : -0.08;
    this.playerBody.position.y = rolling ? 0.1 : 0.32;
    this.playerBody.scale.y = rolling ? 0.72 : 1;

    const camX = player.x * 0.42;
    const camY = 3.35 + player.y * 0.42;
    const camZ = this.run.distance - 7.4;
    this.camera.position.x += (camX - this.camera.position.x) * Math.min(1, delta * 8);
    this.camera.position.y += (camY - this.camera.position.y) * Math.min(1, delta * 6);
    this.camera.position.z = camZ;
    this.camera.lookAt(player.x * 0.5, 1.05 + player.y * 0.4, this.run.distance + 10);

    for (const mesh of this.shardMeshes.values()) {
      if (!mesh.visible) continue;
      mesh.rotation.y += delta * 3.2;
      mesh.rotation.x += delta * 1.4;
      mesh.position.y = 0.95 + Math.sin(this.elapsedVisual * 3 + mesh.position.z) * 0.12;
    }
    for (const group of this.powerupMeshes.values()) {
      if (!group.visible) continue;
      group.rotation.y += delta * 2.4;
      group.position.y = 1.1 + Math.sin(this.elapsedVisual * 2.6 + group.position.z) * 0.16;
    }

    const pressure = dronePressure(this.run);
    this.drone.visible = pressure > 0.01;
    if (this.drone.visible) {
      this.drone.position.set(
        Math.sin(this.elapsedVisual * 2.2) * 2.6,
        3.1 + Math.sin(this.elapsedVisual * 4.1) * 0.25,
        this.run.distance - 10 + pressure * 5,
      );
      this.droneCore.rotation.y += delta * 5;
    }

    if (this.speedLines && this.speedLinePositions) {
      this.speedLines.position.z = this.run.distance;
      const positions = this.speedLinePositions;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 2] -= delta * (10 + this.run.speed * 1.6);
        if (positions[i + 2] < -VISUAL_BEHIND) positions[i + 2] += 200;
      }
      this.speedLines.geometry.attributes.position.needsUpdate = true;
    }

    const ratio = Math.min(1, (this.run.speed - 12) / 16);
    this.audio.setSpeed(ratio);
  }

  private emitHud(): void {
    const run = this.run;
    this.callbacks.onHud({
      phase: this.phase,
      countdown: this.countdown,
      mode: run.mode,
      score: run.score,
      distance: Math.floor(run.distance),
      speedKph: Math.round(run.speed * 3.6),
      shards: run.shards,
      combo: run.combo,
      multiplier: multiplierFor(run.combo),
      crashes: run.crashes,
      timeLeft: run.timeLeft,
      shield: run.shield,
      magnet: run.magnetTimer,
      overdrive: run.overdriveTimer,
      dronePressure: dronePressure(run),
    });
  }

  applyAction(action: PlayerAction): boolean {
    if (this.phase !== 'playing') return false;
    return applyRunAction(this.run, action);
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  pause(): void {
    if (this.phase === 'finished' || this.phase === 'paused') return;
    this.pausedFrom = this.phase;
    this.phase = 'paused';
    this.paused = true;
    this.audio.suspend();
    this.emitHud();
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = this.pausedFrom;
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.resume();
    this.emitHud();
  }

  getHud(): NeonRushHud {
    return {
      phase: this.phase,
      countdown: this.countdown,
      mode: this.run.mode,
      score: this.run.score,
      distance: Math.floor(this.run.distance),
      speedKph: Math.round(this.run.speed * 3.6),
      shards: this.run.shards,
      combo: this.run.combo,
      multiplier: multiplierFor(this.run.combo),
      crashes: this.run.crashes,
      timeLeft: this.run.timeLeft,
      shield: this.run.shield,
      magnet: this.run.magnetTimer,
      overdrive: this.run.overdriveTimer,
      dronePressure: dronePressure(this.run),
    };
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.keyboard.dispose();
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.obstacleMeshes.clear();
    this.shardMeshes.clear();
    this.powerupMeshes.clear();
  }
}
