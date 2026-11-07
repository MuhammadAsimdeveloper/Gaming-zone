import * as THREE from 'three';
import { createCraftMaterials, type CraftMaterials } from './atlas';
import { CraftAudio, footstepSurface } from './audio';
import { BLOCK, BLOCKS, blockSpec, isLiquidBlock, type BlockId, type TextureKey } from './blocks';
import { ChunkView } from './chunkView';
import { MELEE_COOLDOWN, attackReady, knockbackVector, meleeDamage } from './combat';
import { CreatureViews } from './creatureView';
import {
  createCreature,
  damageCreature,
  rollDrop,
  spawnAllowed,
  stepCreature,
  MAX_HOSTILES,
  type CreatureEvent,
  type CreatureKind,
  type CreatureState,
} from './creatures';
import { CYCLE_SECONDS, clockAt, phaseAt, skyPalette, type DayPhase } from './daynight';
import {
  CROPS,
  cropForSeed,
  cropOfBlock,
  hasIrrigation,
  harvest,
  isMature,
  isTillable,
  stageAfterDawn,
  till,
} from './farming';
import {
  addItem,
  consumeHeld,
  damageTool,
  heldStack,
  moveStack,
  setSelected,
  type Inventory,
  type ItemStack,
} from './inventory';
import { itemSpec } from './items';
import { itemLabel, itemTextureKey, itemTint } from './itemView';
import { DEFAULT_SENSITIVITY, applyLook } from './look';
import { breakSeconds, canHarvest, dropFor, toolWear } from './mining';
import { ParticleField } from './particles';
import {
  EYE_HEIGHT,
  MAX_HUNGER,
  canPlaceBlock,
  createPlayer,
  damagePlayer,
  respawnPlayer,
  stepPlayer,
  type PlayerInput,
  type PlayerState,
  type Vec3,
} from './player';
import { raycastVoxel, DEFAULT_REACH, type RayHit } from './raycast';
import { craft as craftRecipe, getRecipe, type CraftResult, type Station } from './recipes';
import type { SaveRecord, SavedStats, SavedStack } from './save';
import { SkyView } from './skyView';
import {
  MESH_BUDGET_PER_FRAME,
  chunkId,
  clampRenderDistance,
  fogDistances,
  planChunks,
} from './streaming';
import { CHUNK_HEIGHT, CHUNK_SIZE, SEA_LEVEL, createTerrain, findSpawn } from './terrain';
import { generateTexture } from './textures';
import { VoxelWorld, worldToChunk } from './world';

export type CraftQuality = 'desktop' | 'mobile';

export interface CraftSettings {
  renderDistance: number;
  fov: number;
  sensitivity: number;
  shadows: boolean;
  reducedEffects: boolean;
}

export interface CraftInventoryItem {
  id: number;
  count: number;
  durability?: number;
}

export interface CraftHud {
  health: number;
  hunger: number;
  clock: string;
  day: number;
  phase: DayPhase;
  hotbar: Array<CraftInventoryItem | null>;
  selected: number;
  prompt: string | null;
  toast: string | null;
  mining: number;
  underwater: boolean;
  depth: number;
}

export interface CraftDeathSummary {
  day: number;
  blocksMined: number;
  blocksPlaced: number;
  creaturesDefeated: number;
  deaths: number;
}

export interface CraftCallbacks {
  onHud(hud: CraftHud): void;
  onInventory(view: { slots: Array<CraftInventoryItem | null>; selected: number }): void;
  onOpenCrafting(station: Station): void;
  onOpenInventory(): void;
  onPauseRequest(): void;
  onDeath(summary: CraftDeathSummary): void;
  onAutosave(record: SaveRecord): void;
  onLockChange?(locked: boolean): void;
}

export interface CraftEngineOptions {
  record: SaveRecord;
  settings: CraftSettings;
  quality: CraftQuality;
  touch: boolean;
  muted: boolean;
}

interface ActiveCreature {
  id: number;
  state: CreatureState;
}

const AUTOSAVE_SECONDS = 60;
const HUD_INTERVAL = 0.1;
const HAND_SWING_SECONDS = 0.28;
const SPAWN_INTERVAL = 2.5;
const CREATURE_ATTACK_REACH = 3.6;
const SUN_DISTANCE = 90;
const SKY_RADIUS = 190;
const CAMERA_FAR = 260;

function stackOf(slot: ItemStack | null): CraftInventoryItem | null {
  if (!slot) return null;
  return slot.durability === undefined
    ? { id: slot.id, count: slot.count }
    : { id: slot.id, count: slot.count, durability: slot.durability };
}

function savedToItem(slot: SavedStack | null): ItemStack | null {
  if (!slot) return null;
  return slot.durability === undefined
    ? { id: slot.id, count: slot.count }
    : { id: slot.id, count: slot.count, durability: slot.durability };
}

function cloneItem(slot: ItemStack | null): ItemStack | null {
  return slot ? { ...slot } : null;
}

/** Approximate particle tint per block family; the atlas is too small to sample at runtime. */
function burstColor(id: number): number {
  if (id === BLOCK.Grass || id === BLOCK.RiftwoodLeaves || id === BLOCK.GlowwoodLeaves) return 0x4f8f4a;
  if (id === BLOCK.Dirt || id === BLOCK.Mud || id === BLOCK.Farmland) return 0x7a5433;
  if (id === BLOCK.Sand) return 0xd8c78e;
  if (id === BLOCK.RiftwoodLog || id === BLOCK.GlowwoodLog || id === BLOCK.Planks) return 0x8a6238;
  if (id === BLOCK.Water) return 0x3d8fd6;
  if (id === BLOCK.Lava) return 0xff6a1f;
  if (id === BLOCK.Emberstone || id === BLOCK.Ash) return 0x8c3b2a;
  if (id === BLOCK.Glowcap || id === BLOCK.GlowwoodLeaves) return 0x6ef0c2;
  return 0x9aa0a6;
}

export class CraftEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly materials: CraftMaterials;
  private readonly world: VoxelWorld;
  private view: ChunkView;
  private readonly sky: SkyView;
  private readonly particles: ParticleField;
  private readonly creatureViews: CreatureViews;
  private readonly audio = new CraftAudio();
  private readonly hemisphere: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly lightTarget = new THREE.Object3D();
  private readonly player: PlayerState;
  private readonly inventory: Inventory;
  private readonly spawn: Vec3;
  private readonly record: SaveRecord;
  private readonly stats: SavedStats;
  private readonly quality: CraftQuality;
  private readonly touch: boolean;
  private settings: CraftSettings;
  private radius: number;
  private fogNear: number;
  private fogFar: number;

  private readonly creatures: ActiveCreature[] = [];
  private readonly cropSites = new Set<string>();
  private readonly sunDirection = new THREE.Vector3();
  private nextCreatureId = 1;
  private spawnTimer = SPAWN_INTERVAL;

  private readonly keys = new Set<string>();
  private readonly touchMove = { forward: 0, strafe: 0 };
  private readonly touchButtons = { jump: false, sneak: false, sprint: false };
  private primaryHeld = false;

  private target: RayHit | null = null;
  private miningProgress = 0;
  private miningKey: string | null = null;
  private attackTimer = 0;
  private swingTimer = 0;

  private day: number;
  private timeOfDay: number;
  private playSeconds: number;
  private previousPhase: DayPhase;
  private elapsed = 0;
  private underwater = false;
  private paused = false;
  private dead = false;
  private started = false;
  private disposed = false;

  private raf = 0;
  private lastTime = 0;
  private hudTimer = HUD_INTERVAL;
  private autosaveTimer = 0;
  private stepDistance = 0;
  private toast: { text: string; ttl: number } | null = null;

  private centerCx = Number.NaN;
  private centerCz = Number.NaN;
  private pendingLoads: Array<{ cx: number; cz: number }> = [];
  private readonly dirty = new Set<string>();
  private locked = false;
  private readonly hand: THREE.Group;
  private readonly handMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly arm: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly handTextures = new Map<number, THREE.DataTexture>();
  private handItemId: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: CraftEngineOptions,
    private readonly callbacks: CraftCallbacks,
  ) {
    this.quality = options.quality;
    this.touch = options.touch;
    this.record = options.record;
    this.settings = {
      renderDistance: clampRenderDistance(this.quality, options.settings.renderDistance),
      fov: Math.min(90, Math.max(60, options.settings.fov)),
      sensitivity: Math.min(3, Math.max(0.2, options.settings.sensitivity)),
      shadows: options.settings.shadows,
      reducedEffects: options.settings.reducedEffects,
    };
    this.radius = this.settings.renderDistance;
    const fog = fogDistances(this.radius);
    this.fogNear = fog.near;
    this.fogFar = fog.far;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality === 'desktop',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.quality === 'mobile' ? 1.5 : 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.shadowsEnabled();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.1, CAMERA_FAR);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0x9ec9ef, this.fogNear, this.fogFar);

    this.world = new VoxelWorld(this.record.seed);
    this.world.applyEdits(
      this.record.edits.map((edit) => ({ x: edit.x, y: edit.y, z: edit.z, id: edit.block as BlockId })),
    );
    for (const edit of this.record.edits) {
      if (cropOfBlock(edit.block) !== null) {
        this.cropSites.add(`${edit.x},${edit.y},${edit.z}`);
      }
    }

    this.materials = createCraftMaterials();
    this.view = new ChunkView(this.scene, this.world, this.materials, this.shadowsEnabled());
    this.sky = new SkyView(this.scene, SKY_RADIUS);
    this.particles = new ParticleField(this.scene);
    this.creatureViews = new CreatureViews(this.scene);

    this.hemisphere = new THREE.HemisphereLight(0xbcd8ff, 0x28301f, 0.9);
    this.scene.add(this.hemisphere);
    this.sunLight = new THREE.DirectionalLight(0xfff2d8, 2.2);
    this.sunLight.castShadow = this.shadowsEnabled();
    this.sunLight.shadow.mapSize.set(
      this.quality === 'desktop' ? 2048 : 1024,
      this.quality === 'desktop' ? 2048 : 1024,
    );
    this.sunLight.shadow.camera.left = -42;
    this.sunLight.shadow.camera.right = 42;
    this.sunLight.shadow.camera.top = 42;
    this.sunLight.shadow.camera.bottom = -42;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 180;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.04;
    this.sunLight.target = this.lightTarget;
    this.scene.add(this.sunLight);
    this.scene.add(this.lightTarget);

    this.player = createPlayer(
      this.record.player.position,
      this.record.player.yaw,
      this.record.player.pitch,
    );
    this.player.health = this.record.player.health;
    this.player.hunger = this.record.player.hunger;
    this.inventory = {
      slots: this.record.player.inventory.map(savedToItem),
      selected: this.record.player.selected,
    };
    this.spawn = findSpawn(createTerrain(this.record.seed));

    this.day = this.record.day;
    this.timeOfDay = this.record.timeOfDay;
    this.playSeconds = this.record.playSeconds;
    this.previousPhase = phaseAt(this.timeOfDay);
    this.stats = { ...this.record.stats };

    this.hand = new THREE.Group();
    this.arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.55, metalness: 0.1 }),
    );
    this.arm.position.set(0.12, -0.05, 0.18);
    this.hand.add(this.arm);
    this.handMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.1 }),
    );
    this.handMesh.position.set(0, 0, -0.16);
    this.hand.add(this.handMesh);
    this.hand.position.set(0.46, -0.4, -0.72);
    this.hand.rotation.set(-0.12, 0.24, 0.08);
    this.camera.add(this.hand);

    this.audio.init();
    this.audio.setMuted(options.muted, null);
    this.audio.setPhase(this.previousPhase, skyPalette(this.timeOfDay).daylight);
    this.sky.setCloudsVisible(!this.settings.reducedEffects);

    this.refreshHandModel();
    this.buildInitialChunks();
    this.refreshPlan();
    this.attachListeners();
    this.emitHud(true);
    this.emitInventory();
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.resize();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isDead(): boolean {
    return this.dead;
  }

  pause(): void {
    if (this.paused || this.disposed) return;
    this.paused = true;
    this.primaryHeld = false;
    if (this.locked) {
      document.exitPointerLock();
      this.locked = false;
    }
    this.callbacks.onAutosave(this.snapshot());
    this.emitHud(true);
  }

  resume(): void {
    if (this.disposed) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.emitHud(true);
  }

  requestPointerLock(): void {
    if (this.touch || this.disposed) return;
    try {
      const request: unknown = this.canvas.requestPointerLock();
      if (request instanceof Promise) void request.catch(() => undefined);
    } catch {
      // A browser may refuse the lock without a gesture; the pause overlay stays up.
    }
  }

  setSettings(next: Partial<CraftSettings>): void {
    if (this.disposed) return;
    const nextShadows = next.shadows ?? this.settings.shadows;
    const shadowsChanged = nextShadows !== this.settings.shadows;
    const nextDistance =
      next.renderDistance === undefined
        ? this.settings.renderDistance
        : clampRenderDistance(this.quality, next.renderDistance);

    this.settings = {
      renderDistance: nextDistance,
      fov: Math.min(90, Math.max(60, next.fov ?? this.settings.fov)),
      sensitivity: Math.min(3, Math.max(0.2, next.sensitivity ?? this.settings.sensitivity)),
      shadows: nextShadows,
      reducedEffects: next.reducedEffects ?? this.settings.reducedEffects,
    };

    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    this.sky.setCloudsVisible(!this.settings.reducedEffects);

    if (shadowsChanged) {
      this.renderer.shadowMap.enabled = this.shadowsEnabled();
      this.sunLight.castShadow = this.shadowsEnabled();
      this.view.setShadows(this.shadowsEnabled());
    }

    if (nextDistance !== this.radius) {
      this.radius = nextDistance;
      this.centerCx = Number.NaN;
      this.centerCz = Number.NaN;
      this.refreshPlan();
      this.emitHud(true);
    }
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted, null);
  }

  getInventory(): { slots: Array<CraftInventoryItem | null>; selected: number } {
    return { slots: this.inventory.slots.map(stackOf), selected: this.inventory.selected };
  }

  selectSlot(index: number): void {
    setSelected(this.inventory, index);
    this.refreshHandModel();
    this.emitInventory();
    this.emitHud(true);
  }

  moveSlot(from: number, to: number): void {
    if (moveStack(this.inventory, from, to)) {
      this.refreshHandModel();
      this.emitInventory();
    }
  }

  craft(recipeId: string, station: Station): CraftResult {
    const recipe = getRecipe(recipeId);
    if (!recipe) return { ok: false, reason: 'missing', missing: [] };
    const result = craftRecipe(this.inventory, recipe, station);
    if (result.ok) {
      this.refreshHandModel();
      this.emitInventory();
      this.setToast(`Crafted ${recipe.name}`);
      this.audio.placeBlock();
    }
    return result;
  }

  respawn(): void {
    if (!this.dead) return;
    respawnPlayer(this.player, this.spawn);
    this.dead = false;
    this.paused = false;
    this.attackTimer = 0;
    this.miningProgress = 0;
    this.emitHud(true);
  }

  snapshot(): SaveRecord {
    return {
      ...this.record,
      updatedAt: Date.now(),
      playSeconds: this.playSeconds,
      day: this.day,
      timeOfDay: this.timeOfDay,
      player: {
        position: { ...this.player.position },
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        health: this.player.health,
        hunger: this.player.hunger,
        inventory: this.inventory.slots.map((slot) =>
          slot
            ? slot.durability === undefined
              ? { id: slot.id, count: slot.count }
              : { id: slot.id, count: slot.count, durability: slot.durability }
            : null,
        ),
        selected: this.inventory.selected,
      },
      edits: this.world.editsForSave().map((edit) => ({
        x: edit.x,
        y: edit.y,
        z: edit.z,
        block: edit.id,
      })),
      stats: { ...this.stats },
    };
  }

  setTouchMove(forward: number, strafe: number): void {
    this.touchMove.forward = Math.max(-1, Math.min(1, Number.isFinite(forward) ? forward : 0));
    this.touchMove.strafe = Math.max(-1, Math.min(1, Number.isFinite(strafe) ? strafe : 0));
  }

  lookBy(dx: number, dy: number): void {
    if (this.paused || this.dead) return;
    const next = applyLook(
      this.player.yaw,
      this.player.pitch,
      dx,
      dy,
      DEFAULT_SENSITIVITY * this.settings.sensitivity,
    );
    this.player.yaw = next.yaw;
    this.player.pitch = next.pitch;
  }

  setTouchButton(name: 'jump' | 'sneak' | 'sprint', down: boolean): void {
    this.touchButtons[name] = down;
  }

  pressPrimary(): void {
    if (this.paused || this.dead) return;
    if (this.tryAttack()) return;
    this.primaryHeld = true;
  }

  releasePrimary(): void {
    this.primaryHeld = false;
    this.miningProgress = 0;
  }

  useItem(): void {
    if (this.paused || this.dead) return;
    this.secondaryUse();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.locked) document.exitPointerLock();
    this.detachListeners();
    this.audio.dispose();
    this.creatureViews.dispose();
    this.particles.dispose();
    this.sky.dispose();
    this.view.dispose();
    for (const texture of this.handTextures.values()) texture.dispose();
    this.handTextures.clear();
    this.hand.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    this.materials.opaque.dispose();
    this.materials.cutout.dispose();
    this.materials.transparent.dispose();
    this.materials.atlas.dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------------------------------
  // Construction helpers

  private shadowsEnabled(): boolean {
    return this.quality === 'desktop' && this.settings.shadows;
  }

  private buildInitialChunks(): void {
    const { cx, cz } = worldToChunk(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z),
    );
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        this.view.build(cx + dx, cz + dz);
      }
    }
    this.centerCx = cx;
    this.centerCz = cz;
  }

  private attachListeners(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private detachListeners(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.primaryHeld = false;
    this.touchMove.forward = 0;
    this.touchMove.strafe = 0;
  };

  private readonly onResize = (): void => {
    this.resize();
  };

  private resize(): void {
    const width = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 1;
    const height = this.canvas.clientHeight || this.canvas.parentElement?.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (this.paused || this.dead) return;

    if (event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD') {
      this.keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      this.keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      this.keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      this.keys.add(event.code);
      return;
    }
    if (event.code === 'ControlLeft' || event.code === 'ControlRight') {
      this.keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') {
      event.preventDefault();
      this.pause();
      this.callbacks.onOpenInventory();
      return;
    }
    if (event.code === 'KeyQ') {
      this.dropOne();
      return;
    }
    if (event.code.startsWith('Digit')) {
      const digit = Number(event.code.slice(5));
      if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
        this.selectSlot(digit - 1);
      }
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    this.locked = locked;
    this.callbacks.onLockChange?.(locked);
    if (locked) {
      // A lock request can resolve after the player already paused. The pause
      // must win, so drop the lock instead of silently resuming the world.
      if (this.paused) {
        this.locked = false;
        document.exitPointerLock();
      }
      return;
    }
    this.primaryHeld = false;
    if (this.started && !this.paused && !this.dead) {
      this.pause();
      this.callbacks.onPauseRequest();
    }
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.paused || this.dead) return;
    if (event.pointerType === 'mouse' && !this.touch && !this.locked) {
      this.requestPointerLock();
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      this.secondaryUse();
      return;
    }
    if (event.button !== 0) return;
    event.preventDefault();
    this.pressPrimary();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) this.releasePrimary();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.locked || this.paused || this.dead) return;
    this.lookBy(event.movementX, event.movementY);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  // ---------------------------------------------------------------------------------------
  // Simulation

  private readonly frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    if (!this.paused && !this.dead) this.simulate(dt);
    this.present(dt);
    this.hudTimer += dt;
    if (this.hudTimer >= HUD_INTERVAL) {
      this.hudTimer = 0;
      this.emitHud();
    }
  };

  private simulate(dt: number): void {
    this.elapsed += dt;
    this.playSeconds += dt;
    this.timeOfDay += dt;
    if (this.timeOfDay >= CYCLE_SECONDS) {
      this.timeOfDay -= CYCLE_SECONDS;
      this.day += 1;
    }
    const phase = phaseAt(this.timeOfDay);
    if (phase !== this.previousPhase) {
      if (phase === 'dawn') this.growCrops();
      this.previousPhase = phase;
      this.audio.setPhase(phase, skyPalette(this.timeOfDay).daylight);
    }

    const input = this.readInput();
    const events = stepPlayer(this.player, input, this.world, dt);
    if (events.landed) {
      if (events.fallDamage > 0) {
        this.audio.hurt();
        this.setToast(`Fall damage −${events.fallDamage}`);
      }
      const below = this.world.getBlock(
        Math.floor(this.player.position.x),
        Math.floor(this.player.position.y - 0.2),
        Math.floor(this.player.position.z),
      );
      this.audio.footstep(footstepSurface(below));
    }
    if (events.died) {
      this.handleDeath();
      return;
    }
    this.updateFootsteps(dt, input);

    const eye = this.eyePosition();
    this.underwater = isLiquidBlock(
      this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)),
    );

    this.target = raycastVoxel(this.world, eye, this.lookDirection(), DEFAULT_REACH);
    this.updateMining(dt, input.mining);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.swingTimer > 0) this.swingTimer = Math.max(0, this.swingTimer - dt);
    if (this.toast) {
      this.toast.ttl -= dt;
      if (this.toast.ttl <= 0) this.toast = null;
    }

    this.updateCreatures(dt, phase);
    if (this.dead) return;
    this.updateStreaming();
    this.processDirty();

    this.autosaveTimer += dt;
    if (this.autosaveTimer >= AUTOSAVE_SECONDS) {
      this.autosaveTimer = 0;
      this.callbacks.onAutosave(this.snapshot());
    }
  }

  private present(dt: number): void {
    const eye = this.eyePosition();
    this.camera.position.set(eye.x, eye.y, eye.z);
    this.camera.rotation.set(this.player.pitch, this.player.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();

    const palette = skyPalette(this.timeOfDay);
    const fogColor = this.materials.uniforms.fogColor.value;
    fogColor.setRGB(palette.fog.r, palette.fog.g, palette.fog.b, THREE.SRGBColorSpace);
    const sceneFog = this.scene.fog;
    if (sceneFog instanceof THREE.Fog) {
      sceneFog.color.copy(fogColor);
      sceneFog.near = this.fogNear;
      sceneFog.far = this.fogFar;
    }
    const uniforms = this.materials.uniforms;
    uniforms.uTime.value = this.elapsed;
    uniforms.uDaylight.value = palette.daylight;
    uniforms.fogNear.value = this.fogNear;
    uniforms.fogFar.value = this.fogFar;

    this.hemisphere.intensity = palette.ambientIntensity;
    this.hemisphere.color.setRGB(
      palette.top.r,
      palette.top.g,
      palette.top.b,
      THREE.SRGBColorSpace,
    );
    this.hemisphere.groundColor.setRGB(
      palette.fog.r * 0.5,
      palette.fog.g * 0.5,
      palette.fog.b * 0.5,
      THREE.SRGBColorSpace,
    );
    this.sunLight.intensity = palette.sunIntensity;
    this.sunLight.color.setRGB(
      palette.sun.r,
      palette.sun.g,
      palette.sun.b,
      THREE.SRGBColorSpace,
    );

    const angle = (this.timeOfDay / CYCLE_SECONDS) * Math.PI * 2;
    const sunDir = this.sunDirection
      .set(Math.cos(angle) * 0.62, Math.max(0.22, Math.sin(angle)), Math.cos(angle) * 0.34)
      .normalize();
    this.lightTarget.position.set(this.player.position.x, this.player.position.y, this.player.position.z);
    this.sunLight.position.set(
      this.player.position.x + sunDir.x * SUN_DISTANCE,
      this.player.position.y + sunDir.y * SUN_DISTANCE,
      this.player.position.z + sunDir.z * SUN_DISTANCE,
    );

    this.sky.update(palette, this.timeOfDay, this.camera.position);
    this.creatureViews.sync(this.creatures, this.elapsed);
    if (!this.paused && !this.dead) this.particles.update(dt);
    this.updateHandAnimation();

    this.renderer.render(this.scene, this.camera);
  }

  private readInput(): PlayerInput {
    const keys = this.keys;
    const forward =
      (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
      (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) +
      this.touchMove.forward;
    const strafe =
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMove.strafe;
    return {
      forward: Math.max(-1, Math.min(1, forward)),
      strafe: Math.max(-1, Math.min(1, strafe)),
      jump: keys.has('Space') || this.touchButtons.jump,
      sprint: keys.has('ControlLeft') || keys.has('ControlRight') || this.touchButtons.sprint,
      sneak: keys.has('ShiftLeft') || keys.has('ShiftRight') || this.touchButtons.sneak,
      mining: this.primaryHeld,
    };
  }

  private updateFootsteps(dt: number, input: PlayerInput): void {
    if (!this.player.onGround) return;
    const speed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    if (speed < 0.5 || (input.forward === 0 && input.strafe === 0)) {
      this.stepDistance = 0;
      return;
    }
    this.stepDistance += speed * dt;
    if (this.stepDistance < (input.sprint ? 2.6 : 2.1)) return;
    this.stepDistance = 0;
    const below = this.world.getBlock(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.y - 0.2),
      Math.floor(this.player.position.z),
    );
    this.audio.footstep(footstepSurface(below));
  }

  private updateMining(dt: number, mining: boolean): void {
    const hit = this.target;
    if (!mining || !hit) {
      this.miningProgress = 0;
      this.miningKey = null;
      return;
    }
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    const key = `${hit.x},${hit.y},${hit.z}`;
    if (key !== this.miningKey) {
      this.miningKey = key;
      this.miningProgress = 0;
    }
    const held = heldStack(this.inventory);
    if (!canHarvest(id, held?.id)) {
      this.miningProgress = 0;
      return;
    }
    const seconds = breakSeconds(id, held?.id);
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.miningProgress += dt / seconds;
    if (this.miningProgress < 1) return;
    this.miningProgress = 0;
    this.breakBlock(hit, id);
  }

  private breakBlock(hit: RayHit, id: number): void {
    const crop = cropOfBlock(id);
    if (crop !== null) {
      this.breakCrop(hit, crop.kind, isMature(id));
      return;
    }
    const held = heldStack(this.inventory);
    if (!canHarvest(id, held?.id)) return;
    const drop = dropFor(id, held?.id);
    if (drop !== null && !this.fitsInInventory(drop, 1)) {
      this.setToast('Inventory full');
      return;
    }
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.Air);
    if (drop !== null) addItem(this.inventory, drop, 1);
    this.markDirty(hit.x, hit.z);
    this.particles.burst(
      hit.x + 0.5,
      hit.y + 0.5,
      hit.z + 0.5,
      new THREE.Color(burstColor(id)),
      this.particleCount(12),
    );
    this.audio.breakBlock(footstepSurface(id));
    this.stats.blocksMined += 1;
    const wear = toolWear(held?.id);
    if (wear > 0 && damageTool(this.inventory, this.inventory.selected, wear)) {
      this.setToast('Your tool broke');
    }
    this.swingTimer = HAND_SWING_SECONDS;
    this.refreshHandModel();
    this.emitInventory();
  }

  private breakCrop(hit: RayHit, kind: 'glowberry' | 'riftroot', mature: boolean): void {
    if (!mature) {
      this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.Air);
      this.cropSites.delete(`${hit.x},${hit.y},${hit.z}`);
      this.markDirty(hit.x, hit.z);
      this.audio.breakBlock('grass');
      this.swingTimer = HAND_SWING_SECONDS;
      return;
    }
    const yields = harvest(kind);
    if (
      !this.fitsInInventory(yields.produce, yields.produceCount) ||
      !this.fitsInInventory(yields.seeds, yields.seedCount)
    ) {
      this.setToast('Inventory full');
      return;
    }
    const sprout = CROPS[kind].stages[0]!;
    this.world.setBlock(hit.x, hit.y, hit.z, sprout);
    addItem(this.inventory, yields.produce, yields.produceCount);
    addItem(this.inventory, yields.seeds, yields.seedCount);
    this.markDirty(hit.x, hit.z);
    this.particles.burst(
      hit.x + 0.5,
      hit.y + 0.5,
      hit.z + 0.5,
      new THREE.Color(0x6ef0c2),
      this.particleCount(16),
    );
    this.audio.breakBlock('grass');
    this.stats.blocksMined += 1;
    this.setToast(`Harvested ${kind === 'glowberry' ? 'Glowberries' : 'Riftroot'}`);
    this.swingTimer = HAND_SWING_SECONDS;
    this.emitInventory();
  }

  private secondaryUse(): void {
    const hit = raycastVoxel(this.world, this.eyePosition(), this.lookDirection(), DEFAULT_REACH);
    this.target = hit;
    const held = heldStack(this.inventory);
    if (!hit) {
      if (held?.id !== undefined && itemSpec(held.id)?.food) this.eat(held);
      else this.swingTimer = HAND_SWING_SECONDS;
      return;
    }
    const targetId = this.world.getBlock(hit.x, hit.y, hit.z);
    if (targetId === BLOCK.Workbench || targetId === BLOCK.Kiln) {
      const station: Station = targetId === BLOCK.Workbench ? 'workbench' : 'kiln';
      this.pause();
      this.callbacks.onOpenCrafting(station);
      return;
    }
    if (!held) {
      this.swingTimer = HAND_SWING_SECONDS;
      return;
    }
    const spec = itemSpec(held.id);
    const crop = cropForSeed(held.id);
    if (crop && hit.ny === 1 && this.world.getBlock(hit.x, hit.y, hit.z) === BLOCK.Farmland) {
      const planted = hit.y + 1;
      if (this.world.getBlock(hit.x, planted, hit.z) === BLOCK.Air) {
        this.world.setBlock(hit.x, planted, hit.z, crop.stages[0]);
        consumeHeld(this.inventory);
        this.cropSites.add(`${hit.x},${planted},${hit.z}`);
        this.markDirty(hit.x, hit.z);
        this.audio.placeBlock();
        this.swingTimer = HAND_SWING_SECONDS;
        this.refreshHandModel();
        this.emitInventory();
      }
      return;
    }
    if (spec?.tool?.kind === 'hoe' && hit.ny === 1 && isTillable(targetId)) {
      const farmland = till(targetId);
      if (farmland !== null) {
        this.world.setBlock(hit.x, hit.y, hit.z, farmland);
        this.markDirty(hit.x, hit.z);
        if (damageTool(this.inventory, this.inventory.selected)) this.setToast('Your tool broke');
        this.audio.placeBlock();
        this.swingTimer = HAND_SWING_SECONDS;
        this.refreshHandModel();
        this.emitInventory();
      }
      return;
    }
    if (spec?.food) {
      this.eat(held);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(BLOCKS, held.id) && held.id !== BLOCK.Air) {
      const placeX = hit.x + hit.nx;
      const placeY = hit.y + hit.ny;
      const placeZ = hit.z + hit.nz;
      if (!canPlaceBlock(this.world, this.player, placeX, placeY, placeZ)) {
        this.setToast('There is no room to build there');
        return;
      }
      this.world.setBlock(placeX, placeY, placeZ, held.id as BlockId);
      consumeHeld(this.inventory);
      this.markDirty(placeX, placeZ);
      this.stats.blocksPlaced += 1;
      this.audio.placeBlock();
      this.swingTimer = HAND_SWING_SECONDS;
      this.refreshHandModel();
      this.emitInventory();
      return;
    }
    this.swingTimer = HAND_SWING_SECONDS;
  }

  private eat(held: ItemStack): void {
    const food = itemSpec(held.id)?.food;
    if (!food) return;
    if (this.player.hunger >= MAX_HUNGER) {
      this.setToast('Not hungry');
      return;
    }
    this.player.hunger = Math.min(MAX_HUNGER, this.player.hunger + food);
    const name = itemSpec(held.id)?.name ?? 'Food';
    consumeHeld(this.inventory);
    this.audio.eat();
    this.setToast(`Ate ${name} (+${food} hunger)`);
    this.refreshHandModel();
    this.emitInventory();
  }

  private dropOne(): void {
    const slot = this.inventory.slots[this.inventory.selected];
    if (!slot) return;
    slot.count -= 1;
    const name = itemLabel(slot.id);
    if (slot.count <= 0) this.inventory.slots[this.inventory.selected] = null;
    this.setToast(`Dropped ${name}`);
    this.refreshHandModel();
    this.emitInventory();
  }

  private tryAttack(): boolean {
    if (!attackReady(this.attackTimer)) return false;
    const eye = this.eyePosition();
    const direction = this.lookDirection();
    let best: ActiveCreature | null = null;
    let bestDistance = CREATURE_ATTACK_REACH;
    for (const creature of this.creatures) {
      const dx = creature.state.position.x + 0.5 - eye.x;
      const dy = creature.state.position.y + 0.6 - eye.y;
      const dz = creature.state.position.z + 0.5 - eye.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > bestDistance) continue;
      const facing = (dx * direction.x + dy * direction.y + dz * direction.z) / Math.max(distance, 1e-6);
      if (facing < 0.3) continue;
      best = creature;
      bestDistance = distance;
    }
    if (!best) return false;

    const held = heldStack(this.inventory);
    const damage = meleeDamage(held?.id);
    const knockback = knockbackVector(this.player.yaw);
    best.state.position.x += knockback.x * 0.06;
    best.state.position.z += knockback.z * 0.06;
    const defeated = damageCreature(best.state, damage);
    this.creatureViews.flash(best.id);
    this.audio.swing();
    this.attackTimer = MELEE_COOLDOWN;
    this.swingTimer = HAND_SWING_SECONDS;
    this.particles.burst(
      best.state.position.x + 0.5,
      best.state.position.y + 0.8,
      best.state.position.z + 0.5,
      new THREE.Color(best.state.kind === 'gloomling' ? 0x5ef2c0 : 0xff8a4d),
      this.particleCount(8),
    );
    if (!defeated) return true;

    const drop = rollDrop(best.state.kind);
    if (drop.count > 0 && this.fitsInInventory(drop.item, drop.count)) {
      addItem(this.inventory, drop.item, drop.count);
    }
    this.stats.creaturesDefeated += 1;
    this.audio.creature(best.state.kind);
    this.setToast(`Defeated ${best.state.kind === 'gloomling' ? 'a Gloomling' : 'a Cinder Wisp'}`);
    const index = this.creatures.indexOf(best);
    if (index >= 0) this.creatures.splice(index, 1);
    this.emitInventory();
    return true;
  }

  private updateCreatures(dt: number, phase: DayPhase): void {
    const context = {
      player: { position: this.player.position, health: this.player.health },
      phase,
      emberBias: 0.3,
      random: Math.random,
    };
    const events: CreatureEvent[] = [];
    for (let index = this.creatures.length - 1; index >= 0; index -= 1) {
      const creature = this.creatures[index]!;
      events.length = 0;
      stepCreature(creature.state, this.world, context, dt, events);
      let despawn = false;
      for (const event of events) {
        if (event.type === 'despawn') {
          despawn = true;
          continue;
        }
        const applied = damagePlayer(this.player, event.damage);
        if (applied > 0) {
          this.audio.hurt();
          this.particles.burst(
            this.player.position.x,
            this.player.position.y + 1.2,
            this.player.position.z,
            new THREE.Color(0xff4d6d),
            this.particleCount(8),
          );
        }
        if (this.player.dead) {
          this.handleDeath();
          return;
        }
      }
      if (despawn) {
        this.creatures.splice(index, 1);
        continue;
      }
      if (creature.state.kind === 'gloomling') this.snapToGround(creature.state);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = SPAWN_INTERVAL;
    this.trySpawn(phase);
  }

  private snapToGround(state: CreatureState): void {
    const x = Math.floor(state.position.x);
    const z = Math.floor(state.position.z);
    const from = Math.min(CHUNK_HEIGHT - 3, Math.floor(state.position.y + 2));
    for (let y = from; y > 0; y -= 1) {
      if (!this.world.isSolid(x, y, z)) continue;
      if (this.world.isSolid(x, y + 1, z) || this.world.isSolid(x, y + 2, z)) break;
      state.position.y = y + 1;
      return;
    }
  }

  private trySpawn(phase: DayPhase): void {
    if (this.creatures.length >= MAX_HOSTILES) return;
    const keys = this.view.keys();
    if (keys.length === 0) return;
    const daylight = skyPalette(this.timeOfDay).skyLight;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const key = keys[Math.floor(Math.random() * keys.length)]!;
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cz = Number(key.slice(comma + 1));
      const x = cx * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
      const z = cz * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
      const surface = this.surfaceY(x, z);
      if (surface === null) continue;
      const distance = Math.hypot(
        x + 0.5 - this.player.position.x,
        z + 0.5 - this.player.position.z,
      );
      if (distance < 16 || distance > 40) continue;
      // Skylight is stored at full strength; scale it by the current sun exposure so an
      // open surface reads dark at dusk and fully lit at noon.
      const light = Math.max(
        this.view.blockLightAt(x, surface + 1, z),
        this.view.skyLightAt(x, surface + 1, z) * daylight,
      );
      const underground = surface < SEA_LEVEL - 6;
      let kind: CreatureKind;
      if (underground) kind = 'cinder-wisp';
      else if (phase === 'night') kind = Math.random() < 0.75 ? 'gloomling' : 'cinder-wisp';
      else if (phase === 'dusk') kind = Math.random() < 0.4 ? 'gloomling' : 'cinder-wisp';
      else continue;
      const allowed = spawnAllowed(kind, {
        light,
        phase,
        distanceToPlayer: distance,
        onSolidGround: true,
        underground,
        emberBias: 0.3,
        hostileCount: this.creatures.length,
        random: Math.random,
      });
      if (!allowed) continue;
      const y = kind === 'cinder-wisp' ? surface + 2 : surface + 1;
      this.creatures.push({
        id: this.nextCreatureId,
        state: createCreature(kind, { x: x + 0.5, y, z: z + 0.5 }),
      });
      this.nextCreatureId += 1;
      return;
    }
  }

  private surfaceY(x: number, z: number): number | null {
    for (let y = CHUNK_HEIGHT - 2; y > 0; y -= 1) {
      if (!this.world.isSolid(x, y, z)) continue;
      if (this.world.isSolid(x, y + 1, z) || this.world.isSolid(x, y + 2, z)) return null;
      return y;
    }
    return null;
  }

  private growCrops(): void {
    for (const key of [...this.cropSites]) {
      const [x, y, z] = key.split(',').map(Number);
      if (x === undefined || y === undefined || z === undefined) {
        this.cropSites.delete(key);
        continue;
      }
      const id = this.world.getBlock(x, y, z);
      if (cropOfBlock(id) === null) {
        this.cropSites.delete(key);
        continue;
      }
      const light = this.view.lightAt(x, y, z);
      if (!hasIrrigation(this.world, x, y - 1, z)) continue;
      const next = stageAfterDawn(id, light);
      if (next === null) continue;
      this.world.setBlock(x, y, z, next);
      this.markDirty(x, z);
      this.particles.burst(
        x + 0.5,
        y + 0.4,
        z + 0.5,
        new THREE.Color(0x6ef0c2),
        this.particleCount(6),
        1.2,
      );
    }
  }

  private handleDeath(): void {
    if (this.dead) return;
    this.dead = true;
    this.paused = true;
    this.primaryHeld = false;
    this.stats.deaths += 1;
    this.audio.death();
    if (this.locked) document.exitPointerLock();
    this.callbacks.onAutosave(this.snapshot());
    this.emitHud(true);
    this.callbacks.onDeath({ ...this.stats, day: this.day });
  }

  // ---------------------------------------------------------------------------------------
  // Streaming and block bookkeeping

  private updateStreaming(): void {
    const { cx, cz } = worldToChunk(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z),
    );
    if (cx !== this.centerCx || cz !== this.centerCz) {
      this.centerCx = cx;
      this.centerCz = cz;
      this.refreshPlan();
    }
    let budget = MESH_BUDGET_PER_FRAME;
    while (budget > 0 && this.pendingLoads.length > 0) {
      const next = this.pendingLoads.shift()!;
      this.view.build(next.cx, next.cz);
      budget -= 1;
    }
  }

  private refreshPlan(): void {
    const { cx, cz } = worldToChunk(
      Math.floor(this.player.position.x),
      Math.floor(this.player.position.z),
    );
    const plan = planChunks(
      { cx, cz },
      new Set(this.view.keys()),
      this.radius,
      Number.MAX_SAFE_INTEGER,
    );
    for (const coord of plan.unload) {
      this.view.remove(coord.cx, coord.cz);
      this.world.unloadChunk(coord.cx, coord.cz);
    }
    this.pendingLoads = plan.load;
    this.centerCx = cx;
    this.centerCz = cz;
    const fog = fogDistances(this.radius);
    this.fogNear = fog.near;
    this.fogFar = fog.far;
    this.materials.uniforms.fogNear.value = this.fogNear;
    this.materials.uniforms.fogFar.value = this.fogFar;
  }

  private processDirty(): void {
    let budget = MESH_BUDGET_PER_FRAME;
    for (const key of [...this.dirty]) {
      if (budget <= 0) break;
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cz = Number(key.slice(comma + 1));
      if (!this.view.has(cx, cz)) {
        this.dirty.delete(key);
        continue;
      }
      this.view.build(cx, cz);
      this.dirty.delete(key);
      budget -= 1;
    }
  }

  private markDirty(x: number, z: number): void {
    const { cx, cz } = worldToChunk(x, z);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx !== 0 && dz !== 0) continue;
        const key = chunkId(cx + dx, cz + dz);
        if (this.view.has(cx + dx, cz + dz)) this.dirty.add(key);
      }
    }
  }

  private fitsInInventory(id: number, count: number): boolean {
    const preview: Inventory = {
      slots: this.inventory.slots.map(cloneItem),
      selected: this.inventory.selected,
    };
    return addItem(preview, id, count) === 0;
  }

  // ---------------------------------------------------------------------------------------
  // View helpers

  private eyePosition(): Vec3 {
    return {
      x: this.player.position.x,
      y: this.player.position.y + EYE_HEIGHT,
      z: this.player.position.z,
    };
  }

  private lookDirection(): Vec3 {
    const pitch = this.player.pitch;
    const yaw = this.player.yaw;
    const cos = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cos, y: Math.sin(pitch), z: -Math.cos(yaw) * cos };
  }

  private refreshHandModel(): void {
    const held = heldStack(this.inventory);
    this.handMesh.visible = held !== null;
    if (!held) {
      this.handItemId = null;
      return;
    }
    if (this.handItemId === held.id) return;
    this.handItemId = held.id;
    const material = this.handMesh.material;
    material.map = null;
    material.color.setHex(itemTint(held.id));
    material.needsUpdate = true;

    const key = itemTextureKey(held.id);
    if (key) {
      material.map = this.blockTexture(held.id, key);
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
    }
  }

  private blockTexture(id: number, key: TextureKey): THREE.DataTexture {
    const cached = this.handTextures.get(id);
    if (cached) return cached;
    const pixels = generateTexture(key);
    const texture = new THREE.DataTexture(pixels, 16, 16, THREE.RGBAFormat);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.handTextures.set(id, texture);
    return texture;
  }

  private updateHandAnimation(): void {
    const progress =
      this.swingTimer > 0 ? 1 - this.swingTimer / HAND_SWING_SECONDS : 0;
    const swing = Math.sin(progress * Math.PI);
    this.hand.rotation.set(-0.12 - swing * 0.7, 0.24 + swing * 0.2, 0.08 + swing * 0.35);
    this.hand.position.set(0.46 - swing * 0.08, -0.4 + swing * 0.12, -0.72 - swing * 0.12);
  }

  private setToast(text: string): void {
    this.toast = { text, ttl: 3 };
    this.emitHud(true);
  }

  private particleCount(count: number): number {
    return this.settings.reducedEffects ? Math.max(1, Math.round(count / 2)) : count;
  }

  private promptText(): string | null {
    if (this.dead) return null;
    const hit = this.target;
    if (!hit) return null;
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    const name = blockSpec(id).name;
    if (id === BLOCK.Workbench) return 'Open Workbench';
    if (id === BLOCK.Kiln) return 'Open Kiln';
    const crop = cropOfBlock(id);
    if (crop) {
      return isMature(id)
        ? `Harvest ${name}`
        : `Growing — needs light and water`;
    }
    const held = heldStack(this.inventory);
    if (held && cropForSeed(held.id) && this.world.getBlock(hit.x, hit.y, hit.z) === BLOCK.Farmland) {
      return `Plant ${itemSpec(held.id)?.name ?? 'seeds'}`;
    }
    if (held && itemSpec(held.id)?.tool?.kind === 'hoe' && isTillable(id)) {
      return 'Till soil';
    }
    if (!canHarvest(id, held?.id)) {
      const spec = blockSpec(id);
      return `Needs a ${spec.tool === 'none' ? 'better tool' : spec.tool}`;
    }
    return `Mine ${name}`;
  }

  private emitInventory(): void {
    this.callbacks.onInventory({
      slots: this.inventory.slots.map(stackOf),
      selected: this.inventory.selected,
    });
  }

  private emitHud(force = false): void {
    const clock = clockAt(this.timeOfDay);
    const mining =
      this.miningKey !== null ? Math.min(1, Math.max(0, this.miningProgress)) : 0;
    this.callbacks.onHud({
      health: this.player.health,
      hunger: this.player.hunger,
      clock: clock.label,
      day: this.day,
      phase: clock.phase,
      hotbar: this.inventory.slots.slice(0, 9).map(stackOf),
      selected: this.inventory.selected,
      prompt: this.promptText(),
      toast: this.toast?.text ?? null,
      mining,
      underwater: this.underwater,
      depth: this.player.position.y,
    });
    if (force) this.hudTimer = 0;
  }
}