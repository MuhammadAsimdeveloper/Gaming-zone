import * as THREE from 'three';
import { createAthlete, createPitchShadow, createSelectionRing, type AthleteVisual } from '../shared/athlete';
import { createKeyboard } from '../shared/input';
import { clamp, damp } from '../shared/math';
import { disposeObject } from '../shared/scenery';
import { StadiumAudio } from './audio';
import {
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  PITCH_HALF_X,
  PITCH_HALF_Z,
  createStadium,
} from './pitch';

export type FootballDifficulty = 'rookie' | 'pro' | 'legend';
export type FootballCamera = 'broadcast' | 'follow' | 'tight';
export type FootballPhase = 'countdown' | 'playing' | 'goal' | 'finished';

export interface FootballHud {
  homeScore: number;
  awayScore: number;
  timeLeft: number;
  phase: FootballPhase;
  possession: 'home' | 'away' | null;
  power: number;
  goalMessage: string | null;
  playerHasBall: boolean;
  controlledName: string;
}

export interface FootballResult {
  homeScore: number;
  awayScore: number;
  outcome: 'win' | 'loss' | 'draw';
  homeShots: number;
  awayShots: number;
  possessionHome: number;
}

export interface FootballSetup {
  difficulty: FootballDifficulty;
  camera: FootballCamera;
}

interface Footballer {
  id: string;
  name: string;
  team: 'home' | 'away';
  keeper: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  baseSpeed: number;
  visual: AthleteVisual;
  shadow: THREE.Mesh;
  home: { x: number; z: number };
  tackleCooldown: number;
  actionTimer: number;
  holdTimer: number;
  runPhase: number;
}

interface Ball {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  vx: number;
  vy: number;
  vz: number;
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  carrier: Footballer | null;
  ignoreId: string | null;
  ignoreTimer: number;
}

interface DifficultyProfile {
  aiSpeed: number;
  reaction: number;
  keeper: number;
  tackle: number;
  shotAccuracy: number;
}

const DIFFICULTY: Record<FootballDifficulty, DifficultyProfile> = {
  rookie: { aiSpeed: 0.87, reaction: 0.62, keeper: 0.72, tackle: 0.38, shotAccuracy: 0.45 },
  pro: { aiSpeed: 1, reaction: 1, keeper: 1, tackle: 0.58, shotAccuracy: 0.7 },
  legend: { aiSpeed: 1.09, reaction: 1.3, keeper: 1.25, tackle: 0.72, shotAccuracy: 0.88 },
};

const MATCH_SECONDS = 120;
const BALL_RADIUS = 0.34;
const PLAYER_SPEED = 7.6;
const SPRINT_SPEED = 10.2;

function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

function headingTo(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

export class FootballEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.5, 400);
  private lastFrame = 0;
  private keyboard: ReturnType<typeof createKeyboard>;
  private audio = new StadiumAudio();
  private profile: DifficultyProfile;
  private cameraMode: FootballCamera;
  private callbackHud: (hud: FootballHud) => void;
  private callbackFinish: (result: FootballResult) => void;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private paused = false;
  private phase: FootballPhase = 'countdown';
  private countdown = 3.4;
  private goalTimer = 0;
  private matchTime = MATCH_SECONDS;
  private homeScore = 0;
  private awayScore = 0;
  private homeShots = 0;
  private awayShots = 0;
  private possessionFrames = { home: 0, away: 0 };
  private hudTimer = 0;
  private goalMessage: string | null = null;
  private controlledId = 'home-0';
  private players: Footballer[] = [];
  private ball!: Ball;
  private selectionRing: THREE.Mesh;
  private touch: {
    moveX: number;
    moveZ: number;
    sprint: boolean;
    shoot: boolean;
    pass: boolean;
    tackle: boolean;
  } = { moveX: 0, moveZ: 0, sprint: false, shoot: false, pass: false, tackle: false };
  private shootCharge = 0;
  private previousShoot = false;
  private previousPass = false;
  private previousTackle = false;
  private cameraPosition = new THREE.Vector3(0, 30, 46);
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private pointerShoot = false;

  constructor(
    private canvas: HTMLCanvasElement,
    setup: FootballSetup,
    callbacks: { onHud: (hud: FootballHud) => void; onFinish: (result: FootballResult) => void },
  ) {
    this.profile = DIFFICULTY[setup.difficulty];
    this.cameraMode = setup.camera;
    this.callbackHud = callbacks.onHud;
    this.callbackFinish = callbacks.onFinish;
    this.keyboard = createKeyboard(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color('#050b16');
    this.scene.fog = new THREE.Fog('#07121f', 120, 260);

    this.buildScene();
    this.buildTeams();
    this.buildBall();
    this.selectionRing = createSelectionRing('#6ee7ff');
    this.scene.add(this.selectionRing);

    this.resize();
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.canvas.parentElement);
    }
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);

    this.audio.start();
    this.audio.whistle();
    this.renderer.setAnimationLoop(this.loop);
    this.canvas.focus();
    this.emitHud();
  }

  private buildScene(): void {
    const hemi = new THREE.HemisphereLight('#9cc2ff', '#04150d', 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#f2f6ff', 2.4);
    sun.position.set(36, 62, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight('#7fb0ff', 0.6);
    fill.position.set(-40, 30, -30);
    this.scene.add(fill);

    const stadium = createStadium('#38e8ff');
    this.scene.add(stadium);
  }

  private buildTeams(): void {
    const homeRoles = [
      { home: { x: 0, z: -7 }, name: 'Nova' },
      { home: { x: -13, z: 8 }, name: 'Ion' },
      { home: { x: 13, z: 8 }, name: 'Echo' },
    ];
    const awayRoles = [
      { home: { x: 0, z: 7 }, name: 'Vex' },
      { home: { x: 13, z: -8 }, name: 'Nyx' },
      { home: { x: -13, z: -8 }, name: 'Kite' },
    ];

    homeRoles.forEach((role, index) => {
      this.addFootballer(`home-${index}`, role.name, 'home', index === 0, role.home, '#2f6bff', '#38e8ff');
    });
    this.addFootballer('home-gk', 'Astra', 'home', true, { x: 0, z: PITCH_HALF_Z - 1.2 }, '#eab308', '#fde047');

    awayRoles.forEach((role, index) => {
      this.addFootballer(`away-${index}`, role.name, 'away', index === 0, role.home, '#e11d48', '#fb7185');
    });
    this.addFootballer('away-gk', 'Umbra', 'away', true, { x: 0, z: -PITCH_HALF_Z + 1.2 }, '#7c3aed', '#c4b5fd');
  }

  private addFootballer(
    id: string,
    name: string,
    team: 'home' | 'away',
    keeper: boolean,
    home: { x: number; z: number },
    primary: string,
    secondary: string,
  ): void {
    const visual = createAthlete(primary, secondary, keeper);
    const shadow = createPitchShadow();
    const start = keeper ? home : { x: home.x, z: home.z };
    visual.group.position.set(start.x, 0, start.z);
    shadow.position.set(start.x, 0.04, start.z);
    this.scene.add(visual.group, shadow);
    this.players.push({
      id,
      name,
      team,
      keeper,
      x: start.x,
      z: start.z,
      vx: 0,
      vz: 0,
      heading: team === 'home' ? Math.PI : 0,
      baseSpeed: keeper ? 6.4 : PLAYER_SPEED,
      visual,
      shadow,
      home,
      tackleCooldown: 0,
      actionTimer: 0,
      holdTimer: 0,
      runPhase: Math.random() * 10,
    });
  }

  private buildBall(): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 22, 18),
      new THREE.MeshStandardMaterial({
        color: '#f8fbff',
        roughness: 0.38,
        metalness: 0.1,
        emissive: '#2b4f8a',
        emissiveIntensity: 0.25,
      }),
    );
    mesh.castShadow = true;
    this.scene.add(mesh);
    const shadow = createPitchShadow();
    shadow.scale.setScalar(0.55);
    this.scene.add(shadow);

    this.ball = {
      x: 0,
      y: BALL_RADIUS,
      z: 0,
      prevZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      mesh,
      shadow,
      carrier: null,
      ignoreId: null,
      ignoreTimer: 0,
    };
  }

  private loop = (): void => {
    if (this.disposed || this.paused) return;
    const now = performance.now();
    const delta = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
    this.lastFrame = now;

    if (this.phase === 'countdown') {
      this.countdown -= delta;
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.audio.whistle();
      }
    } else if (this.phase === 'goal') {
      this.goalTimer -= delta;
      if (this.goalTimer <= 0) {
        this.resetKickoff();
      }
    } else if (this.phase === 'playing') {
      this.matchTime = Math.max(0, this.matchTime - delta);
      this.updateControlled(delta);
      this.updateAi(delta);
      this.updateBall(delta);
      this.separatePlayers();
      this.trackPossession();
      if (this.matchTime <= 0) this.finishMatch();
    }

    this.updateVisuals(delta);
    this.updateCamera(delta);
    this.renderer.render(this.scene, this.camera);

    this.hudTimer += delta;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud();
    }
  };

  private getControlled(): Footballer {
    return this.players.find((player) => player.id === this.controlledId) ?? this.players[0]!;
  }

  private updateControlled(delta: number): void {
    const player = this.getControlled();
    player.tackleCooldown = Math.max(0, player.tackleCooldown - delta);
    player.actionTimer = Math.max(0, player.actionTimer - delta);

    const keys = this.keyboard.keys;
    let moveX = this.touch.moveX;
    let moveZ = this.touch.moveZ;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;

    const magnitude = Math.hypot(moveX, moveZ);
    if (magnitude > 0.001) {
      moveX /= Math.max(1, magnitude);
      moveZ /= Math.max(1, magnitude);
    }

    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || this.touch.sprint;
    const speed = sprint ? SPRINT_SPEED : PLAYER_SPEED;
    player.vx = damp(player.vx, moveX * speed, 11, delta);
    player.vz = damp(player.vz, moveZ * speed, 11, delta);

    if (magnitude > 0.1) {
      player.heading = headingTo(moveX, moveZ);
    } else if (this.ball.carrier?.id === player.id) {
      const goalZ = player.team === 'home' ? -PITCH_HALF_Z : PITCH_HALF_Z;
      player.heading = headingTo(0, goalZ - player.z);
    }

    player.x = clamp(player.x + player.vx * delta, -PITCH_HALF_X + 0.5, PITCH_HALF_X - 0.5);
    player.z = clamp(player.z + player.vz * delta, -PITCH_HALF_Z + 0.5, PITCH_HALF_Z - 0.5);

    const shootInput = keys.has('KeyJ') || this.touch.shoot || this.pointerShoot;
    const passInput = keys.has('KeyK') || this.touch.pass;
    const tackleInput = keys.has('Space') || this.touch.tackle;

    if (this.ball.carrier?.id === player.id) {
      this.shootCharge = clamp(this.shootCharge + (shootInput ? delta : 0), 0, 1);
      if (this.previousShoot && !shootInput) {
        this.shoot(player, this.shootCharge);
        this.shootCharge = 0;
      }
      if (passInput && !this.previousPass) {
        this.pass(player);
      }
    } else if (shootInput && !this.previousShoot) {
      this.tackle(player);
    }

    if (tackleInput && !this.previousTackle) {
      this.tackle(player);
    }

    this.previousShoot = shootInput;
    this.previousPass = passInput;
    this.previousTackle = tackleInput;
  }

  private updateAi(delta: number): void {
    const controlled = this.getControlled();

    for (const player of this.players) {
      if (player.id === controlled.id) continue;
      player.tackleCooldown = Math.max(0, player.tackleCooldown - delta);
      player.actionTimer = Math.max(0, player.actionTimer - delta);

      if (player.keeper) {
        this.updateKeeper(player, delta);
        continue;
      }

      if (this.ball.carrier?.id === player.id) {
        this.updateAiCarrier(player, delta);
        continue;
      }

      const isHome = player.team === 'home';
      const attackZ = isHome ? -PITCH_HALF_Z : PITCH_HALF_Z;
      const ownGoalZ = -attackZ;
      const ballControlledByTeam = this.ball.carrier?.team === player.team;
      const teamHasBall = this.ball.carrier?.team === player.team;
      let targetX = player.home.x;
      let targetZ = player.home.z;

      if (teamHasBall) {
        targetX = player.home.x * 0.55 + this.ball.x * 0.45;
        targetZ = player.home.z * 0.35 + this.ball.z * 0.2 + (isHome ? -11 : 11);
      } else {
        const nearestToBall = this.players
          .filter((candidate) => candidate.team === player.team && !candidate.keeper)
          .sort((a, b) => distance(a.x, a.z, this.ball.x, this.ball.z) - distance(b.x, b.z, this.ball.x, this.ball.z))[0];

        if (nearestToBall?.id === player.id) {
          targetX = this.ball.x;
          targetZ = this.ball.z;
        } else {
          targetX = player.home.x * 0.5 + this.ball.x * 0.35;
          targetZ = player.home.z * 0.5 + this.ball.z * 0.35 + (isHome ? 5 : -5);
        }
      }

      targetX = clamp(targetX, -PITCH_HALF_X + 2, PITCH_HALF_X - 2);
      targetZ = clamp(targetZ, -PITCH_HALF_Z + 2, PITCH_HALF_Z - 2);

      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      const dist = Math.hypot(dx, dz);
      const speed = player.baseSpeed * this.profile.aiSpeed * (ballControlledByTeam ? 1 : 1);
      if (dist > 0.4) {
        player.vx = damp(player.vx, (dx / dist) * speed, 8, delta);
        player.vz = damp(player.vz, (dz / dist) * speed, 8, delta);
        player.heading = headingTo(dx, dz);
      } else {
        player.vx = damp(player.vx, 0, 8, delta);
        player.vz = damp(player.vz, 0, 8, delta);
      }

      player.x = clamp(player.x + player.vx * delta, -PITCH_HALF_X + 0.5, PITCH_HALF_X - 0.5);
      player.z = clamp(player.z + player.vz * delta, -PITCH_HALF_Z + 0.5, PITCH_HALF_Z - 0.5);

      if (this.ball.carrier && this.ball.carrier.team !== player.team && !player.keeper) {
        const carrier = this.ball.carrier;
        if (distance(player.x, player.z, carrier.x, carrier.z) < 1.9 && player.tackleCooldown <= 0) {
          if (Math.random() < this.profile.tackle * 0.55) {
            this.tackle(player);
          } else {
            player.tackleCooldown = 1.2;
          }
        }
      }

      if (player.actionTimer <= 0 && this.ball.carrier === null) {
        const ballDistance = distance(player.x, player.z, this.ball.x, this.ball.z);
        if (ballDistance < 1.15) {
          this.ball.carrier = player;
          this.ball.ignoreId = null;
        }
      }

      void ownGoalZ;
    }
  }

  private updateAiCarrier(player: Footballer, delta: number): void {
    const isHome = player.team === 'home';
    const goalZ = isHome ? -PITCH_HALF_Z : PITCH_HALF_Z;
    const goalDistance = Math.abs(goalZ - player.z);
    const opponents = this.players.filter((candidate) => candidate.team !== player.team && !candidate.keeper);
    const nearestOpponent = opponents.reduce(
      (nearest, candidate) => {
        const value = distance(candidate.x, candidate.z, player.x, player.z);
        return value < nearest.value ? { value, candidate } : nearest;
      },
      { value: Infinity, candidate: null as Footballer | null },
    );

    const decisionCooldown = player.actionTimer;
    if (decisionCooldown <= 0) {
      player.actionTimer = 0.45 / this.profile.reaction;

      if (goalDistance < 24 && Math.random() < 0.55 + (24 - goalDistance) / 60) {
        this.shoot(player, 0.65 + Math.random() * 0.35, this.profile.shotAccuracy);
        return;
      }

      if (nearestOpponent.candidate && nearestOpponent.value < 3.4 && Math.random() < 0.5) {
        this.pass(player);
        return;
      }
    }

    let steerX = 0;
    let steerZ = goalZ > player.z ? 1 : -1;
    if (nearestOpponent.candidate && nearestOpponent.value < 6) {
      steerX = player.x > nearestOpponent.candidate.x ? 1 : -1;
    }
    if (Math.abs(player.x) > PITCH_HALF_X - 4) {
      steerX = -Math.sign(player.x);
    }

    const magnitude = Math.hypot(steerX, steerZ) || 1;
    const speed = player.baseSpeed * this.profile.aiSpeed * 0.94;
    player.vx = damp(player.vx, (steerX / magnitude) * speed, 7, delta);
    player.vz = damp(player.vz, (steerZ / magnitude) * speed, 7, delta);
    player.heading = headingTo(player.vx, player.vz);
    player.x = clamp(player.x + player.vx * delta, -PITCH_HALF_X + 0.5, PITCH_HALF_X - 0.5);
    player.z = clamp(player.z + player.vz * delta, -PITCH_HALF_Z + 0.5, PITCH_HALF_Z - 0.5);

    if (goalDistance < 5) {
      this.shoot(player, 0.8, this.profile.shotAccuracy);
    }
  }

  private updateKeeper(keeper: Footballer, delta: number): void {
    const ownGoalZ = keeper.team === 'home' ? PITCH_HALF_Z : -PITCH_HALF_Z;
    const ballDistance = distance(keeper.x, keeper.z, this.ball.x, this.ball.z);
    const inBox = Math.abs(this.ball.z - ownGoalZ) < 18 && Math.abs(this.ball.x) < 17;

    let targetX = clamp(this.ball.x * 0.32, -GOAL_HALF_WIDTH + 0.6, GOAL_HALF_WIDTH - 0.6);
    let targetZ = ownGoalZ + (keeper.team === 'home' ? -0.7 : 0.7);

    if (inBox && (this.ball.carrier === null || this.ball.carrier.team !== keeper.team) && ballDistance < 13) {
      targetX = this.ball.x;
      targetZ = this.ball.z;
    }

    if (this.ball.carrier && this.ball.carrier.team !== keeper.team && inBox) {
      targetX = this.ball.carrier.x;
      targetZ = this.ball.carrier.z;
    }

    const dx = targetX - keeper.x;
    const dz = targetZ - keeper.z;
    const dist = Math.hypot(dx, dz);
    const speed = keeper.baseSpeed * this.profile.keeper;
    if (dist > 0.08) {
      keeper.vx = damp(keeper.vx, (dx / dist) * speed, 9, delta);
      keeper.vz = damp(keeper.vz, (dz / dist) * speed, 9, delta);
    } else {
      keeper.vx = damp(keeper.vx, 0, 9, delta);
      keeper.vz = damp(keeper.vz, 0, 9, delta);
    }
    keeper.x += keeper.vx * delta;
    keeper.z += keeper.vz * delta;
    keeper.heading = headingTo(this.ball.x - keeper.x, this.ball.z - keeper.z);

    if (this.ball.carrier === keeper) {
      keeper.holdTimer += delta;
      if (keeper.holdTimer > 0.9) {
        this.pass(keeper);
        keeper.holdTimer = 0;
      }
      return;
    }

    if (!this.ball.carrier && ballDistance < 1.6) {
      this.ball.carrier = keeper;
      this.ball.ignoreId = null;
      keeper.holdTimer = 0;
      this.audio.tackle();
    } else if (
      this.ball.carrier &&
      this.ball.carrier.team !== keeper.team &&
      ballDistance < 1.5 &&
      inBox &&
      Math.random() < 0.4 * this.profile.keeper
    ) {
      this.ball.carrier = keeper;
      keeper.holdTimer = 0;
      this.audio.tackle();
    }
  }

  private separatePlayers(): void {
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const a = this.players[i]!;
        const b = this.players[j]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minimum = 0.9;
        if (dist > 0.001 && dist < minimum) {
          const push = (minimum - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
        }
      }
    }
  }

  private trackPossession(): void {
    if (this.ball.carrier?.team === 'home') this.possessionFrames.home += 1;
    else if (this.ball.carrier?.team === 'away') this.possessionFrames.away += 1;
  }

  private updateBall(delta: number): void {
    const ball = this.ball;
    ball.ignoreTimer = Math.max(0, ball.ignoreTimer - delta);

    if (ball.carrier) {
      const carrier = ball.carrier;
      const forwardX = -Math.sin(carrier.heading);
      const forwardZ = -Math.cos(carrier.heading);
      ball.x = carrier.x + forwardX * 0.5;
      ball.z = carrier.z + forwardZ * 0.5;
      ball.y = BALL_RADIUS;
      ball.prevZ = ball.z;
      ball.vx = carrier.vx;
      ball.vz = carrier.vz;
      ball.vy = 0;

      if (carrier.keeper) {
        ball.x = carrier.x + forwardX * 0.45;
        ball.z = carrier.z + forwardZ * 0.45;
      }
      return;
    }

    ball.prevZ = ball.z;
    ball.vy -= 22 * delta;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;
    ball.z += ball.vz * delta;

    if (ball.y < BALL_RADIUS) {
      ball.y = BALL_RADIUS;
      ball.vy = ball.vy < -1.2 ? -ball.vy * 0.48 : 0;
      const rollDrag = Math.exp(-1.05 * delta);
      ball.vx *= rollDrag;
      ball.vz *= rollDrag;
    } else {
      const airDrag = Math.exp(-0.18 * delta);
      ball.vx *= airDrag;
      ball.vz *= airDrag;
    }

    if (this.checkGoal()) return;

    const boardX = PITCH_HALF_X + 3.6;
    const boardZ = PITCH_HALF_Z + 3;
    if (Math.abs(ball.x) > boardX - BALL_RADIUS) {
      ball.x = Math.sign(ball.x) * (boardX - BALL_RADIUS);
      ball.vx *= -0.55;
    }
    if (Math.abs(ball.z) > boardZ - BALL_RADIUS) {
      ball.z = Math.sign(ball.z) * (boardZ - BALL_RADIUS);
      ball.vz *= -0.55;
    }

    for (const z of [-PITCH_HALF_Z, PITCH_HALF_Z]) {
      for (const x of [-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH]) {
        const dx = ball.x - x;
        const dz = ball.z - z;
        const postDistance = Math.hypot(dx, dz);
        if (postDistance < BALL_RADIUS + 0.12) {
          const nx = dx / (postDistance || 1);
          const nz = dz / (postDistance || 1);
          ball.x = x + nx * (BALL_RADIUS + 0.12);
          ball.z = z + nz * (BALL_RADIUS + 0.12);
          const dot = ball.vx * nx + ball.vz * nz;
          ball.vx -= 2 * dot * nx;
          ball.vz -= 2 * dot * nz;
          ball.vx *= 0.7;
          ball.vz *= 0.7;
          this.audio.kick(0.4);
        }
      }
    }

    if (ball.ignoreTimer <= 0) {
      let nearest: Footballer | null = null;
      let nearestDistance = 1.25;
      for (const player of this.players) {
        if (player.id === ball.ignoreId) continue;
        const dist = distance(player.x, player.z, ball.x, ball.z);
        if (dist < nearestDistance && Math.abs(ball.y - BALL_RADIUS) < 0.7) {
          nearestDistance = dist;
          nearest = player;
        }
      }
      if (nearest) {
        ball.carrier = nearest;
        ball.vx = 0;
        ball.vz = 0;
        ball.vy = 0;
        ball.y = BALL_RADIUS;
      }
    }
  }

  private checkGoal(): boolean {
    const ball = this.ball;
    const crossedAwayGoal = ball.z <= -PITCH_HALF_Z && ball.prevZ > -PITCH_HALF_Z;
    const crossedHomeGoal = ball.z >= PITCH_HALF_Z && ball.prevZ < PITCH_HALF_Z;

    if (crossedAwayGoal && Math.abs(ball.x) < GOAL_HALF_WIDTH && ball.y < GOAL_HEIGHT) {
      this.scoreGoal('home');
      return true;
    }
    if (crossedHomeGoal && Math.abs(ball.x) < GOAL_HALF_WIDTH && ball.y < GOAL_HEIGHT) {
      this.scoreGoal('away');
      return true;
    }
    return false;
  }

  private scoreGoal(team: 'home' | 'away'): void {
    const scorer = this.ball.carrier;
    if (team === 'home') this.homeScore += 1;
    else this.awayScore += 1;

    const scorerName = scorer && scorer.team === team ? scorer.name : team === 'home' ? 'Rift' : 'Void';
    this.goalMessage = `Goal · ${scorerName}`;
    this.phase = 'goal';
    this.goalTimer = 2.4;
    this.ball.carrier = null;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.shootCharge = 0;
    this.audio.goal();
    this.emitHud();
  }

  private resetKickoff(): void {
    this.phase = 'playing';
    this.goalMessage = null;
    this.ball.x = 0;
    this.ball.y = BALL_RADIUS;
    this.ball.z = 0;
    this.ball.prevZ = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.carrier = null;
    this.ball.ignoreId = null;
    this.ball.ignoreTimer = 0;

    for (const player of this.players) {
      const zOffset = player.team === 'home' ? 1.5 : -1.5;
      player.x = player.home.x;
      player.z = player.home.z + (player.keeper ? 0 : zOffset);
      player.vx = 0;
      player.vz = 0;
      player.holdTimer = 0;
      player.heading = player.team === 'home' ? Math.PI : 0;
    }
    this.audio.whistle();
    this.emitHud();
  }

  private shoot(player: Footballer, power: number, accuracy = 0.94): void {
    if (this.ball.carrier?.id !== player.id) return;
    const attackZ = player.team === 'home' ? -PITCH_HALF_Z : PITCH_HALF_Z;
    const goalX = (Math.random() * 2 - 1) * (GOAL_HALF_WIDTH - 0.9) * (1 - accuracy) * 2;
    let directionX = goalX - player.x;
    let directionZ = attackZ - player.z;

    if (!player.keeper) {
      const facingX = -Math.sin(player.heading);
      const facingZ = -Math.cos(player.heading);
      const goalLength = Math.hypot(directionX, directionZ) || 1;
      const alignment = (facingX * directionX + facingZ * directionZ) / goalLength;
      if (alignment > 0.1) {
        directionX = facingX * 0.35 + (directionX / goalLength) * 0.65;
        directionZ = facingZ * 0.35 + (directionZ / goalLength) * 0.65;
      }
    }

    const magnitude = Math.hypot(directionX, directionZ) || 1;
    const shotSpeed = 20 + power * 16;
    this.ball.carrier = null;
    this.ball.ignoreId = player.id;
    this.ball.ignoreTimer = 0.55;
    this.ball.vx = (directionX / magnitude) * shotSpeed;
    this.ball.vz = (directionZ / magnitude) * shotSpeed;
    this.ball.vy = 1.4 + power * 3.4;
    this.ball.y = BALL_RADIUS + 0.1;

    if (player.team === 'home') this.homeShots += 1;
    else this.awayShots += 1;

    this.audio.kick(0.6 + power * 0.5);
  }

  private pass(player: Footballer): void {
    if (this.ball.carrier?.id !== player.id) return;

    const teammates = this.players.filter(
      (candidate) => candidate.team === player.team && candidate.id !== player.id && !candidate.keeper,
    );
    const forwardX = -Math.sin(player.heading);
    const forwardZ = -Math.cos(player.heading);

    const target = teammates
      .map((candidate) => {
        const dx = candidate.x - player.x;
        const dz = candidate.z - player.z;
        const dist = Math.hypot(dx, dz) || 1;
        const alignment = (forwardX * dx + forwardZ * dz) / dist;
        const attacking = player.team === 'home' ? -dz : dz;
        return { candidate, score: alignment * 1.2 + attacking / 60 - dist / 120 };
      })
      .sort((a, b) => b.score - a.score)[0];

    let directionX: number;
    let directionZ: number;
    if (target && target.score > -0.2) {
      directionX = target.candidate.x + target.candidate.vx * 0.35 - player.x;
      directionZ = target.candidate.z + target.candidate.vz * 0.35 - player.z;
    } else {
      directionX = forwardX;
      directionZ = forwardZ;
    }

    const magnitude = Math.hypot(directionX, directionZ) || 1;
    const passSpeed = target ? clamp(11 + magnitude * 0.28, 12, 23) : 16;
    this.ball.carrier = null;
    this.ball.ignoreId = player.id;
    this.ball.ignoreTimer = 0.35;
    this.ball.vx = (directionX / magnitude) * passSpeed;
    this.ball.vz = (directionZ / magnitude) * passSpeed;
    this.ball.vy = 0.7;
    this.audio.pass();
  }

  private tackle(player: Footballer): void {
    if (player.tackleCooldown > 0) return;
    player.tackleCooldown = 0.85;
    player.actionTimer = 0.25;

    const carrier = this.ball.carrier;
    if (carrier && carrier.team !== player.team) {
      const dist = distance(player.x, player.z, carrier.x, carrier.z);
      if (dist < 2.1) {
        const successChance = player.team === 'home' && player.id !== this.controlledId ? 0.5 : 0.82;
        if (Math.random() < successChance) {
          this.ball.carrier = player;
          this.ball.ignoreId = null;
          this.audio.tackle();
        } else {
          this.ball.carrier = null;
          this.ball.ignoreId = null;
          this.ball.vx = (Math.random() * 2 - 1) * 3;
          this.ball.vz = (Math.random() * 2 - 1) * 3;
          this.ball.vy = 1.2;
          this.audio.tackle();
        }
        return;
      }
    }

    if (!this.ball.carrier) {
      const dist = distance(player.x, player.z, this.ball.x, this.ball.z);
      if (dist < 1.6) {
        this.ball.carrier = player;
        this.audio.tackle();
      }
    }
  }

  private switchPlayer(): void {
    const outfield = this.players.filter((player) => player.team === 'home' && !player.keeper);
    const index = outfield.findIndex((player) => player.id === this.controlledId);
    const next = outfield[(index + 1) % outfield.length];
    if (next) {
      this.controlledId = next.id;
      this.shootCharge = 0;
    }
  }

  private updateVisuals(delta: number): void {
    const controlled = this.getControlled();
    this.selectionRing.position.set(controlled.x, 0.04, controlled.z);

    for (const player of this.players) {
      const speed = Math.hypot(player.vx, player.vz);
      player.visual.group.position.set(player.x, 0, player.z);
      player.visual.group.rotation.y = player.heading;
      player.shadow.position.set(player.x, 0.045, player.z);

      if (this.phase === 'goal' && player.team === 'home') {
        player.visual.leftArm.rotation.z = damp(player.visual.leftArm.rotation.z, 2.4, 6, delta);
        player.visual.rightArm.rotation.z = damp(player.visual.rightArm.rotation.z, -2.4, 6, delta);
      } else {
        player.visual.leftArm.rotation.z = damp(player.visual.leftArm.rotation.z, 0, 10, delta);
        player.visual.rightArm.rotation.z = damp(player.visual.rightArm.rotation.z, 0, 10, delta);
      }

      player.runPhase += speed * delta * 2.4;
      const swing = clamp(speed / 6, 0, 1) * 0.75;
      player.visual.leftLeg.rotation.x = Math.sin(player.runPhase) * swing;
      player.visual.rightLeg.rotation.x = Math.sin(player.runPhase + Math.PI) * swing;
      player.visual.leftArm.rotation.x = Math.sin(player.runPhase + Math.PI) * swing * 0.7;
      player.visual.rightArm.rotation.x = Math.sin(player.runPhase) * swing * 0.7;
      player.visual.torso.rotation.z = Math.sin(player.runPhase * 0.5) * swing * 0.04;
    }

    this.ball.mesh.position.set(this.ball.x, this.ball.y, this.ball.z);
    this.ball.shadow.position.set(this.ball.x, 0.046, this.ball.z);
    this.ball.mesh.rotation.x += this.ball.vz * delta * 1.8;
    this.ball.mesh.rotation.z -= this.ball.vx * delta * 1.8;

    this.selectionRing.visible = this.phase === 'playing' || this.phase === 'countdown';
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.06;
    this.selectionRing.scale.setScalar(pulse);
  }

  private updateCamera(delta: number): void {
    const ball = this.ball;
    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX: number;
    let lookY: number;
    let lookZ: number;

    if (this.cameraMode === 'follow') {
      const player = this.getControlled();
      const forwardX = -Math.sin(player.heading);
      const forwardZ = -Math.cos(player.heading);
      desiredX = player.x - forwardX * 13;
      desiredY = 8.2;
      desiredZ = player.z - forwardZ * 13;
      lookX = player.x + forwardX * 8;
      lookY = 1.2;
      lookZ = player.z + forwardZ * 8;
    } else if (this.cameraMode === 'tight') {
      desiredX = ball.x * 0.9;
      desiredY = 15;
      desiredZ = ball.z * 0.55 + 20;
      lookX = ball.x;
      lookY = 0;
      lookZ = ball.z;
    } else {
      desiredX = ball.x * 0.32;
      desiredY = 31;
      desiredZ = clamp(ball.z * 0.5 + 38, 30, 50);
      lookX = ball.x * 0.45;
      lookY = 0;
      lookZ = ball.z * 0.6 - 4;
    }

    this.cameraPosition.x = damp(this.cameraPosition.x, desiredX, 3.4, delta);
    this.cameraPosition.y = damp(this.cameraPosition.y, desiredY, 3.4, delta);
    this.cameraPosition.z = damp(this.cameraPosition.z, desiredZ, 3.4, delta);
    this.camera.position.copy(this.cameraPosition);

    this.cameraTarget.x = damp(this.cameraTarget.x, lookX, 5, delta);
    this.cameraTarget.y = damp(this.cameraTarget.y, lookY, 5, delta);
    this.cameraTarget.z = damp(this.cameraTarget.z, lookZ, 5, delta);
    this.camera.lookAt(this.cameraTarget);
  }

  private emitHud(): void {
    const possession = this.ball.carrier?.team ?? null;
    this.callbackHud({
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      timeLeft: this.matchTime,
      phase: this.phase,
      possession,
      power: this.shootCharge,
      goalMessage: this.goalTimer > 0 ? this.goalMessage : null,
      playerHasBall: this.ball.carrier?.id === this.controlledId,
      controlledName: this.getControlled().name,
    });
  }

  private finishMatch(): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.pointerShoot = false;
    this.renderer.setAnimationLoop(null);
    this.audio.pause();
    this.audio.whistle(true);
    const totalPossession = this.possessionFrames.home + this.possessionFrames.away;
    const possessionHome = totalPossession > 0 ? Math.round((this.possessionFrames.home / totalPossession) * 100) : 50;
    this.callbackFinish({
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      outcome: this.homeScore > this.awayScore ? 'win' : this.homeScore < this.awayScore ? 'loss' : 'draw',
      homeShots: this.homeShots,
      awayShots: this.awayShots,
      possessionHome,
    });
    this.emitHud();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.pointerShoot = true;
  };

  private handlePointerUp = (): void => {
    this.pointerShoot = false;
  };

  private handleWindowBlur = (): void => {
    this.pointerShoot = false;
  };

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

  setTouch(patch: Partial<typeof this.touch>): void {
    this.touch = { ...this.touch, ...patch };
  }

  cycleCamera(): FootballCamera {
    const order: FootballCamera[] = ['broadcast', 'follow', 'tight'];
    const index = order.indexOf(this.cameraMode);
    this.cameraMode = order[(index + 1) % order.length]!;
    return this.cameraMode;
  }

  switchControlledPlayer(): void {
    this.switchPlayer();
    this.emitHud();
  }

  toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  pause(): void {
    this.paused = true;
    this.pointerShoot = false;
    this.audio.pause();
  }

  resume(): void {
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.resume();
  }

  getPhase(): FootballPhase {
    return this.phase;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.keyboard.dispose();
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.players = [];
  }
}

export { MATCH_SECONDS };
