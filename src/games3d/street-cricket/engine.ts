import * as THREE from 'three';
import { AnimationLoop } from '../shared/animationLoop';
import { CricketAudio } from './audio';
import {
  directionAngle,
  resolveContact,
  type Contact,
  type ShotDirection,
  type ShotType,
} from './batting';
import { planCpuShot } from './cpu';
import {
  createDelivery,
  RELEASE_Z,
  type BowlingInput,
  type BowlingLength,
  type BowlingLine,
  type BowlingVariation,
  type Delivery,
} from './delivery';
import { BOUNDARY_RADIUS, FIELDERS, resolveShot, type ShotResult } from './fielding';
import { currentInnings, type MatchFormat, type MatchResult } from './rules';
import {
  beginBall,
  completeBall,
  createSession,
  nextBall,
  usesFielders,
  type ControlMode,
  type SessionPhase,
  type SessionState,
} from './session';
import { districtById, type District } from './teams';
import { DOT_BALL, type BallOutcome, type TimingGrade } from './types';
import { disposeObject } from '../shared/scenery';

const RUNUP_SECONDS = 0.8;
const CONTACT_SECONDS = 0.95;
const RESULT_PAUSE = 1.6;
const INNINGS_PAUSE = 2.6;
const BAT_AUTO_DELAY = 0.9;
const BAT_AUTO_GAP = 0.55;
const PITCH_WIDTH = 3.4;

const SHOT_DIRECTIONS: ReadonlyArray<ShotDirection> = ['fine', 'point', 'cover', 'straight', 'midwicket', 'leg'];
const SHOT_TYPES: ReadonlyArray<ShotType> = ['block', 'drive', 'loft'];

export interface CricketSetup {
  format: MatchFormat;
  districtId: string;
  opponentId: string;
  target?: number;
  muted: boolean;
}

export interface CricketHud {
  phase: SessionPhase;
  control: ControlMode;
  format: MatchFormat;
  message: string;
  runs: number;
  wickets: number;
  balls: number;
  target: number | null;
  battingTeam: string;
  sixes: number;
  fours: number;
  aim: ShotDirection;
  shotType: ShotType;
  bowling: BowlingInput;
  lastGrade: TimingGrade | null;
  canSwing: boolean;
  canBowl: boolean;
  deliveryLabel: string | null;
  matchResult: MatchResult | null;
}

export interface TimingFrame {
  position: number;
  perfect: number;
  good: number;
  ok: number;
  edge: number;
}

export interface CricketCallbacks {
  onHud: (hud: CricketHud) => void;
  onFinish: (result: MatchResult) => void;
  onTiming: (timing: TimingFrame | null) => void;
}

type Motion = 'idle' | 'runup' | 'flight' | 'contact' | 'wait';

function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function standardMaterial(color: string, options: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08, ...options });
}

export class StreetCricketEngine {
  private renderer: THREE.WebGLRenderer;
  private frameLoop: AnimationLoop;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 320);
  private audio = new CricketAudio();
  private callbacks: CricketCallbacks;
  private session: SessionState;
  private district: District;
  private opponent: District;
  private disposed = false;
  private paused = false;
  private muted = false;
  private lastFrame = 0;
  private clock = 0;

  private motion: Motion = 'idle';
  private motionTime = 0;
  private idleTime = 0;
  private waitSeconds = RESULT_PAUSE;

  private aim: ShotDirection = 'straight';
  private shotType: ShotType = 'drive';
  private bowling: BowlingInput = { line: 'middle', length: 'good', variation: 'stock' };

  private delivery: Delivery | null = null;
  private visualArrival = 1.2;
  private swung = false;
  private pendingContact: Contact | null = null;
  private pendingShot: ShotResult | null = null;
  private pendingOutcome: BallOutcome | null = null;
  private contactStart = new THREE.Vector3();
  private lastGrade: TimingGrade | null = null;
  private timingActive = false;
  private cpuPlan: ReturnType<typeof planCpuShot> | null = null;
  private cpuContactAt: number | null = null;

  private ball!: THREE.Mesh;
  private batsman!: THREE.Group;
  private batPivot!: THREE.Group;
  private bowler!: THREE.Group;
  private fielders: THREE.Group[] = [];
  private fieldersGroup = new THREE.Group();
  private aimGroup!: THREE.Group;
  private stumpsMaterial!: THREE.MeshStandardMaterial;
  private stumpFlash = 0;
  private swingAnim = 0;
  private cameraLook = new THREE.Vector3(0, 1.1, 6);
  private rng: () => number = Math.random;

  constructor(canvas: HTMLCanvasElement, setup: CricketSetup, callbacks: CricketCallbacks) {
    this.callbacks = callbacks;
    this.district = districtById(setup.districtId);
    this.opponent = districtById(setup.opponentId);
    this.session = createSession({
      format: setup.format,
      playerTeamId: this.district.id,
      cpuTeamId: this.opponent.id,
      target: setup.target,
      rng: this.rng,
    });
    this.muted = setup.muted;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(this.district.sky);
    this.scene.fog = new THREE.Fog(this.district.sky, 55, 150);

    this.buildStadium();
    this.buildActors();
    this.buildBall();
    this.buildAim();

    this.resize();
    window.addEventListener('resize', this.handleResize);

    this.audio.start();
    if (this.muted) this.audio.toggleMute();
    this.placeBallAtBowler();
    this.camera.position.set(0, 4.8, -8.6);
    this.camera.lookAt(this.cameraLook);
    this.frameLoop = new AnimationLoop((callback) => this.renderer.setAnimationLoop(callback));
    this.frameLoop.start(this.loop);
    this.emitHud();
  }

  // ---------- scene ----------

  private buildStadium(): void {
    const hemi = new THREE.HemisphereLight(this.district.accent, this.district.ground, 1.15);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight('#dce8ff', 1.5);
    moon.position.set(-18, 38, -22);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -30;
    moon.shadow.camera.right = 30;
    moon.shadow.camera.top = 30;
    moon.shadow.camera.bottom = -30;
    moon.shadow.camera.far = 90;
    this.scene.add(moon);

    const floodlight = new THREE.SpotLight('#e9f4ff', 55, 120, Math.PI / 5.2, 0.55, 1.2);
    floodlight.position.set(26, 24, 30);
    floodlight.target.position.set(0, 0, 8);
    this.scene.add(floodlight);
    this.scene.add(floodlight.target);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(BOUNDARY_RADIUS + 5, 64), standardMaterial(this.district.ground));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const outfield = new THREE.Mesh(
      new THREE.RingGeometry(BOUNDARY_RADIUS - 2.4, BOUNDARY_RADIUS + 5, 64),
      standardMaterial(this.district.ground, { roughness: 0.9 }),
    );
    outfield.rotation.x = -Math.PI / 2;
    outfield.position.y = 0.012;
    this.scene.add(outfield);

    const pitch = new THREE.Mesh(
      new THREE.BoxGeometry(PITCH_WIDTH, 0.08, RELEASE_Z + 2),
      standardMaterial('#b9a884', { roughness: 0.95 }),
    );
    pitch.position.set(0, 0.04, RELEASE_Z / 2);
    pitch.receiveShadow = true;
    this.scene.add(pitch);

    const creaseMaterial = standardMaterial('#f4f7ff', { roughness: 0.6 });
    for (const z of [0.6, RELEASE_Z - 0.6]) {
      const crease = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_WIDTH, 0.09), creaseMaterial);
      crease.rotation.x = -Math.PI / 2;
      crease.position.set(0, 0.085, z);
      this.scene.add(crease);
    }

    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(BOUNDARY_RADIUS, 0.12, 8, 120),
      new THREE.MeshStandardMaterial({
        color: this.district.primary,
        emissive: this.district.primary,
        emissiveIntensity: 0.5,
        roughness: 0.4,
      }),
    );
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.09;
    this.scene.add(rope);

    this.stumpsMaterial = new THREE.MeshStandardMaterial({
      color: '#f6f9ff',
      emissive: '#8fb6ff',
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    this.addStumps(0);
    this.addStumps(RELEASE_Z);

    const skyline = new THREE.Group();
    for (let index = 0; index < 22; index += 1) {
      const angle = (index / 22) * Math.PI * 2;
      const radius = 48 + ((index * 7) % 13);
      const height = 7 + ((index * 13) % 19);
      const width = 4 + ((index * 5) % 7);
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        standardMaterial(index % 3 === 0 ? this.district.ground : this.district.sky, {
          emissive: index % 4 === 0 ? this.district.primary : '#000000',
          emissiveIntensity: index % 4 === 0 ? 0.2 : 0,
          roughness: 0.85,
        }),
      );
      tower.position.set(Math.sin(angle) * radius, height / 2 - 1.5, Math.cos(angle) * radius);
      tower.rotation.y = angle;
      skyline.add(tower);
    }
    this.scene.add(skyline);

    for (const [x, z] of [
      [34, 30],
      [-34, 30],
    ] as const) {
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.32, 20, 10),
        standardMaterial('#22354d', { metalness: 0.5, roughness: 0.4 }),
      );
      mast.position.set(x, 10, z);
      this.scene.add(mast);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.1, 1.4),
        new THREE.MeshStandardMaterial({
          color: '#eaf6ff',
          emissive: '#d7ecff',
          emissiveIntensity: 1.4,
          roughness: 0.3,
        }),
      );
      head.position.set(x, 20.4, z);
      head.lookAt(0, 0, 8);
      this.scene.add(head);
    }
  }

  private addStumps(z: number): void {
    for (const x of [-0.12, 0, 0.12]) {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), this.stumpsMaterial);
      stump.position.set(x, 0.36, z);
      stump.castShadow = true;
      this.scene.add(stump);
    }
    for (const x of [-0.06, 0.06]) {
      const bail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.03), this.stumpsMaterial);
      bail.position.set(x, 0.74, z);
      this.scene.add(bail);
    }
  }

  private createFigure(primary: string, secondary: string): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 4, 10), standardMaterial(primary));
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10), standardMaterial('#e7c9a6'));
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(head);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      standardMaterial(secondary, { roughness: 0.35 }),
    );
    helmet.position.y = 1.77;
    group.add(helmet);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 8), standardMaterial(secondary));
      leg.position.set(side * 0.11, 0.34, 0);
      group.add(leg);
    }
    return group;
  }

  private buildActors(): void {
    this.batsman = this.createFigure(this.district.primary, this.district.secondary);
    this.batsman.position.set(0, 0, -0.85);
    this.scene.add(this.batsman);

    this.batPivot = new THREE.Group();
    this.batPivot.position.set(0.3, 1.28, 0.1);
    const bat = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.92, 0.06),
      standardMaterial(this.district.secondary, { roughness: 0.5 }),
    );
    bat.position.set(0, -0.52, 0.06);
    bat.rotation.x = -0.35;
    bat.castShadow = true;
    this.batPivot.add(bat);
    this.batsman.add(this.batPivot);

    this.bowler = this.createFigure(this.opponent.primary, this.opponent.secondary);
    this.bowler.position.set(1.1, 0, RELEASE_Z + 2.4);
    this.scene.add(this.bowler);

    this.fieldersGroup = new THREE.Group();
    for (const spot of FIELDERS) {
      const fielder = this.createFigure(
        spot.id === 'keeper' ? this.opponent.secondary : this.opponent.primary,
        this.opponent.sky,
      );
      fielder.position.set(Math.sin(rad(spot.angle)) * spot.distance, 0, Math.cos(rad(spot.angle)) * spot.distance);
      fielder.rotation.y = Math.atan2(-fielder.position.x, -fielder.position.z);
      this.fielders.push(fielder);
      this.fieldersGroup.add(fielder);
    }
    this.scene.add(this.fieldersGroup);
  }

  private buildBall(): void {
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 18, 12),
      new THREE.MeshStandardMaterial({
        color: '#f8e4c3',
        emissive: '#5c4322',
        emissiveIntensity: 0.35,
        roughness: 0.35,
      }),
    );
    this.ball.castShadow = true;
    this.scene.add(this.ball);
  }

  private buildAim(): void {
    this.aimGroup = new THREE.Group();
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.95, 10),
      new THREE.MeshStandardMaterial({
        color: this.district.accent,
        emissive: this.district.accent,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
      }),
    );
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0.16, 3.1);
    this.aimGroup.add(arrow);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 22),
      new THREE.MeshBasicMaterial({ color: this.district.accent, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.05, 1.9);
    this.aimGroup.add(ring);
    this.aimGroup.position.set(0, 0, -0.6);
    this.scene.add(this.aimGroup);
  }

  private placeBallAtBowler(): void {
    this.ball.position.set(0.8, 1.55, RELEASE_Z + 1.9);
  }

  // ---------- gameplay ----------

  startBall(): void {
    if (this.session.phase !== 'ready' || this.motion !== 'idle') return;
    if (!beginBall(this.session)) return;

    this.delivery =
      this.session.control === 'bowl'
        ? createDelivery(this.bowling, this.rng)
        : createDelivery(this.randomCpuBowling(), this.rng);
    this.visualArrival = THREE.MathUtils.clamp(this.delivery.arrivalSeconds * 1.9, 1.15, 1.65);
    this.swung = false;
    this.pendingContact = null;
    this.pendingShot = null;
    this.pendingOutcome = null;
    this.lastGrade = null;
    this.cpuPlan = null;
    this.cpuContactAt = null;
    this.motion = 'runup';
    this.motionTime = 0;
    this.idleTime = 0;
    this.emitTiming(null);
    this.emitHud();
  }

  bowl(): void {
    if (this.session.control === 'bowl' && this.session.phase === 'ready' && this.motion === 'idle') {
      this.startBall();
    }
  }

  swing(): void {
    if (this.session.phase !== 'running' || this.session.control !== 'bat') return;
    if (this.motion !== 'flight' || this.swung || !this.delivery) return;
    this.swung = true;
    const offset = this.motionTime - this.visualArrival;
    const contact = resolveContact({
      timingOffset: offset,
      direction: this.aim,
      shotType: this.shotType,
      line: this.delivery.line,
      length: this.delivery.length,
    });
    this.commitContact(contact);
  }

  private randomCpuBowling(): BowlingInput {
    const line: BowlingLine[] = ['off', 'middle', 'leg'];
    const length: BowlingLength[] = ['short', 'good', 'good', 'full'];
    const variation: BowlingVariation[] = ['stock', 'stock', 'stock', 'pace', 'spin'];
    const controlBias = this.opponent.control;
    const pick = <T,>(values: T[]): T => values[Math.min(values.length - 1, Math.floor(this.rng() * values.length))]!;
    const chosenLine = controlBias > 0.55 ? 'off' : pick(line);
    return { line: chosenLine, length: pick(length), variation: pick(variation) };
  }

  private releaseBall(): void {
    if (!this.delivery) return;
    this.motion = 'flight';
    this.motionTime = 0;
    this.audio.release();
    if (this.session.control === 'bowl') {
      this.cpuPlan = planCpuShot(this.delivery, this.opponent.control, this.rng);
      this.cpuContactAt = this.visualArrival + this.cpuPlan.timingOffset;
    } else {
      this.cpuPlan = null;
      this.cpuContactAt = null;
    }
    this.placeBallAtBowler();
    this.ball.position.copy(this.flightPosition(0));
    this.emitHud();
  }

  private commitContact(contact: Contact): void {
    if (!this.delivery) return;
    const shot = resolveShot(contact, { fielders: usesFielders(this.session) }, this.rng);
    this.pendingContact = contact;
    this.pendingShot = shot;
    this.pendingOutcome = shot;
    this.lastGrade = contact.grade;
    this.contactStart.copy(this.ball.position);
    this.motion = 'contact';
    this.motionTime = 0;
    this.swingAnim = 1;
    this.audio.bat(contact.grade, contact.quality);
    if (shot.boundary === 6) this.audio.six();
    else if (shot.boundary === 4) this.audio.four();
    else if (shot.wicket === 'bowled') {
      this.audio.stumps();
      this.stumpFlash = 0.7;
    } else if (shot.wicket === 'caught') this.audio.catchTaken();
    else if (shot.batRuns > 0) this.audio.runs();
    this.emitTiming(null);
    this.emitHud();
  }

  private leaveBall(): void {
    this.swung = false;
    this.pendingContact = null;
    this.pendingShot = null;
    this.pendingOutcome = { ...DOT_BALL, note: 'Left alone outside the line. No run.' };
    this.lastGrade = null;
    this.contactStart.copy(this.ball.position);
    this.motion = 'contact';
    this.motionTime = 0;
    this.emitTiming(null);
    this.emitHud();
  }

  private finishBall(): void {
    if (!this.pendingOutcome) return;
    const outcome = this.pendingOutcome;
    const report = completeBall(this.session, outcome);
    this.pendingContact = null;
    this.pendingShot = null;
    this.pendingOutcome = null;

    if (report.matchEnded) {
      this.audio.matchEnd();
      this.callbacks.onFinish(this.session.match.result!);
      this.motion = 'idle';
      this.motionTime = 0;
      this.emitHud();
      this.frameLoop.stop();
      this.audio.stopAmbience();
      return;
    }

    this.waitSeconds = report.inningsChanged ? INNINGS_PAUSE : RESULT_PAUSE;
    this.motion = 'wait';
    this.motionTime = 0;
    this.emitHud();
  }

  // ---------- loop ----------

  private loop = (now = performance.now()): void => {
    if (this.disposed || this.paused) return;
    const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000 || 0));
    this.lastFrame = now;
    this.clock += delta;
    this.tick(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private tick(delta: number): void {
    this.motionTime += delta;

    switch (this.motion) {
      case 'runup': {
        const t = Math.min(1, this.motionTime / RUNUP_SECONDS);
        this.bowler.position.set(1.1 - t * 1.1, 0, RELEASE_Z + 2.4 - t * 2.4);
        if (this.motionTime >= RUNUP_SECONDS) this.releaseBall();
        break;
      }
      case 'flight': {
        if (this.delivery) {
          this.ball.position.copy(this.flightPosition(this.motionTime));
          if (!this.timingActive) {
            this.timingActive = true;
          }
          const half = 1 / (2 * this.visualArrival);
          this.callbacks.onTiming({
            position: Math.min(1, this.motionTime / (this.visualArrival * 2)),
            perfect: 0.035 * half,
            good: 0.09 * half,
            ok: 0.17 * half,
            edge: 0.28 * half,
          });
        }
        if (this.session.control === 'bowl' && this.cpuPlan && this.cpuContactAt !== null) {
          if (this.motionTime >= this.cpuContactAt) {
            const offset = this.motionTime - this.visualArrival;
            const contact = resolveContact({ ...this.cpuPlan, timingOffset: offset });
            this.swung = true;
            this.commitContact(contact);
            break;
          }
        }
        if (this.session.control === 'bat' && !this.swung && this.motionTime > this.visualArrival + 0.32) {
          this.leaveBall();
        }
        break;
      }
      case 'contact': {
        const u = Math.min(1, this.motionTime / CONTACT_SECONDS);
        this.ball.position.copy(this.contactPosition(u));
        if (this.motionTime >= CONTACT_SECONDS) this.finishBall();
        break;
      }
      case 'wait': {
        if (this.motionTime >= this.waitSeconds) {
          nextBall(this.session);
          this.motion = 'idle';
          this.motionTime = 0;
          this.idleTime = this.session.control === 'bat' ? BAT_AUTO_DELAY - BAT_AUTO_GAP : 0;
          this.placeBallAtBowler();
          this.callbacks.onTiming(null);
          this.emitHud();
        }
        break;
      }
      default: {
        if (this.session.phase === 'ready' && this.session.control === 'bat') {
          this.idleTime += delta;
          if (this.idleTime >= BAT_AUTO_DELAY) this.startBall();
        }
        break;
      }
    }

    this.updateActors(delta);
    this.updateCamera(delta);
  }

  private flightPosition(seconds: number): THREE.Vector3 {
    const delivery = this.delivery!;
    const u = THREE.MathUtils.clamp(seconds / this.visualArrival, 0, 1);
    const bounceT = THREE.MathUtils.clamp((RELEASE_Z - delivery.bounceZ) / RELEASE_Z, 0.05, 0.95);
    const z = RELEASE_Z * (1 - u);
    const preBounce = Math.min(1, u / bounceT);
    const deviation =
      u > bounceT ? Math.sin(((u - bounceT) / (1 - bounceT)) * Math.PI * 0.5) * delivery.seamAngle * 0.07 : 0;
    const x = delivery.lineX * u + delivery.swing * preBounce + deviation;
    const y =
      u < bounceT
        ? 2.05 * (1 - (u / bounceT) ** 2)
        : 0.82 * Math.sin(Math.PI * ((u - bounceT) / (1 - bounceT))) + 0.09;
    return new THREE.Vector3(x, Math.max(0.09, y), z);
  }

  private contactPosition(u: number): THREE.Vector3 {
    const contact = this.pendingContact;
    const shot = this.pendingShot;
    if (this.pendingOutcome?.wicket === 'bowled') {
      return this.contactStart.clone().lerp(new THREE.Vector3(0, 0.45, 0), u);
    }
    if (!contact || !shot) {
      return this.contactStart.clone().lerp(new THREE.Vector3(0, 0.5, -5.5), u);
    }
    const angle = rad(directionAngle(contact.direction));
    const distance = shot.distance;
    const x = Math.sin(angle) * distance * u;
    const z = 0.25 + Math.cos(angle) * distance * u;
    const peak = Math.min(7, Math.max(0.35, (shot.carry * Math.tan(rad(contact.launchAngle))) / 4));
    const y = 0.75 * (1 - u) + peak * 4 * u * (1 - u);
    return new THREE.Vector3(x, Math.max(0.08, y), z);
  }

  private updateActors(delta: number): void {
    this.batsman.position.y = Math.sin(this.clock * 2.1) * 0.015;
    if (this.swingAnim > 0) {
      this.swingAnim = Math.max(0, this.swingAnim - delta * 3.2);
      this.batPivot.rotation.z = -1.4 * Math.sin((1 - this.swingAnim) * Math.PI);
      this.batPivot.rotation.x = -0.35 - this.swingAnim * 0.8;
    } else {
      this.batPivot.rotation.z = 0;
      this.batPivot.rotation.x = -0.35;
    }

    if (this.motion !== 'runup' && this.motion !== 'flight') {
      this.bowler.position.z += (RELEASE_Z + 2.4 - this.bowler.position.z) * Math.min(1, delta * 3);
      this.bowler.position.x += (1.1 - this.bowler.position.x) * Math.min(1, delta * 3);
    }

    for (let index = 0; index < this.fielders.length; index += 1) {
      const fielder = this.fielders[index]!;
      fielder.position.y = Math.sin(this.clock * 1.6 + index) * 0.02;
    }
    this.fieldersGroup.visible = usesFielders(this.session);

    this.aimGroup.visible = this.session.control === 'bat' && (this.motion === 'idle' || this.motion === 'runup');
    this.aimGroup.rotation.y = rad(directionAngle(this.aim));

    if (this.stumpFlash > 0) {
      this.stumpFlash = Math.max(0, this.stumpFlash - delta);
      this.stumpsMaterial.emissiveIntensity = 0.25 + this.stumpFlash * 2.2;
    } else {
      this.stumpsMaterial.emissiveIntensity = 0.25;
    }
  }

  private updateCamera(delta: number): void {
    const control = this.session.control;
    const desired = new THREE.Vector3();
    if (control === 'bowl') {
      desired.set(0, 5.6, RELEASE_Z + 7.2);
    } else {
      desired.set(0, 4.8, -8.8);
      if (this.motion === 'contact' && this.pendingContact) {
        const angle = rad(directionAngle(this.pendingContact.direction));
        desired.x = Math.sin(angle) * 3.2;
        desired.z = -8.8 + Math.cos(angle) * 2.2;
        desired.y = 5.4;
      }
    }

    const follow = this.motion === 'flight' || this.motion === 'contact' ? this.ball.position : null;
    const look = follow
      ? follow.clone()
      : new THREE.Vector3(0, 1.15, control === 'bowl' ? 5.5 : 7.5);

    const positionAlpha = 1 - Math.exp(-6 * delta);
    const lookAlpha = 1 - Math.exp(-9 * delta);
    this.camera.position.lerp(desired, positionAlpha);
    this.cameraLook.lerp(look, lookAlpha);
    this.camera.lookAt(this.cameraLook);
  }

  // ---------- public API ----------

  getHud(): CricketHud {
    return this.snapshot();
  }

  getPhase(): SessionPhase {
    return this.session.phase;
  }

  getControl(): ControlMode {
    return this.session.control;
  }

  getMatchResult(): MatchResult | null {
    return this.session.match.result;
  }

  getPlayerTotals(): { sixes: number; fours: number } {
    let sixes = 0;
    let fours = 0;
    for (const innings of this.session.match.innings) {
      if (innings.teamId !== this.session.match.playerTeamId) continue;
      sixes += innings.sixes;
      fours += innings.fours;
    }
    return { sixes, fours };
  }

  setAim(direction: ShotDirection): void {
    if (this.aim === direction) return;
    this.aim = direction;
    this.aimGroup.rotation.y = rad(directionAngle(direction));
    this.emitHud();
  }

  cycleAim(step: number): void {
    const index = SHOT_DIRECTIONS.indexOf(this.aim);
    const next = SHOT_DIRECTIONS[(index + step + SHOT_DIRECTIONS.length) % SHOT_DIRECTIONS.length]!;
    this.setAim(next);
  }

  setShotType(type: ShotType): void {
    if (this.shotType === type) return;
    this.shotType = type;
    this.emitHud();
  }

  cycleShotType(step: number): void {
    const index = SHOT_TYPES.indexOf(this.shotType);
    this.setShotType(SHOT_TYPES[(index + step + SHOT_TYPES.length) % SHOT_TYPES.length]!);
  }

  setBowling(patch: Partial<BowlingInput>): void {
    this.bowling = { ...this.bowling, ...patch };
    this.emitHud();
  }

  toggleMute(): boolean {
    this.muted = this.audio.toggleMute();
    return this.muted;
  }

  pause(): void {
    this.paused = true;
    this.audio.suspend();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.resume();
  }

  private snapshot(): CricketHud {
    const innings = currentInnings(this.session.match);
    return {
      phase: this.session.phase,
      control: this.session.control,
      format: this.session.match.format,
      message: this.session.lastMessage,
      runs: innings.runs,
      wickets: innings.wickets,
      balls: innings.balls,
      target: innings.target,
      battingTeam: districtById(innings.teamId).shortName,
      sixes: innings.sixes,
      fours: innings.fours,
      aim: this.aim,
      shotType: this.shotType,
      bowling: this.bowling,
      lastGrade: this.lastGrade,
      canSwing: this.session.phase === 'running' && this.session.control === 'bat' && this.motion === 'flight' && !this.swung,
      canBowl: this.session.phase === 'ready' && this.session.control === 'bowl' && this.motion === 'idle',
      deliveryLabel: this.motion === 'flight' ? (this.delivery?.label ?? null) : null,
      matchResult: this.session.match.result,
    };
  }

  private emitHud(): void {
    this.callbacks.onHud(this.snapshot());
  }

  private emitTiming(frame: TimingFrame | null): void {
    if (frame === null) this.timingActive = false;
    this.callbacks.onTiming(frame);
  }

  private handleResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || canvas.clientWidth || 960;
    const height = parent?.clientHeight || canvas.clientHeight || 540;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.frameLoop.stop();
    window.removeEventListener('resize', this.handleResize);
    this.audio.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.fielders = [];
  }
}

export { SHOT_DIRECTIONS, SHOT_TYPES };
