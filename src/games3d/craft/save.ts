import { BLOCK, BLOCKS } from './blocks';
import { CYCLE_SECONDS } from './daynight';
import { INVENTORY_SIZE } from './inventory';
import { ITEMS } from './items';
import { MAX_HEALTH, MAX_HUNGER, type Vec3 } from './player';
import { CHUNK_HEIGHT } from './terrain';

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_SLOTS = [1, 2, 3] as const;

export type SaveSlot = (typeof SAVE_SLOTS)[number];

export interface SavedStack {
  id: number;
  count: number;
  durability?: number;
}

export interface SavedPlayer {
  position: Vec3;
  yaw: number;
  pitch: number;
  health: number;
  hunger: number;
  inventory: Array<SavedStack | null>;
  selected: number;
}

export interface SavedEdit {
  x: number;
  y: number;
  z: number;
  block: number;
}

export interface SavedStats {
  blocksMined: number;
  blocksPlaced: number;
  creaturesDefeated: number;
  deaths: number;
}

export interface SaveRecord {
  schema: number;
  slot: SaveSlot;
  name: string;
  seed: string;
  createdAt: number;
  updatedAt: number;
  playSeconds: number;
  day: number;
  timeOfDay: number;
  player: SavedPlayer;
  edits: SavedEdit[];
  stats: SavedStats;
}

export type DecodeResult =
  | { ok: true; record: SaveRecord }
  | { ok: false; reason: 'unreadable'; detail: string };

type JsonObject = Record<string, unknown>;

function unreadable(detail: string): DecodeResult {
  return { ok: false, reason: 'unreadable', detail };
}

function objectOf(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isKnownSlotId(id: number): boolean {
  return (
    id !== BLOCK.Air &&
    (Object.prototype.hasOwnProperty.call(ITEMS, id) ||
      Object.prototype.hasOwnProperty.call(BLOCKS, id))
  );
}

function readStack(value: unknown): SavedStack | string {
  const field = objectOf(value);
  if (field === null) return 'inventory entry is not an object';
  const { id, count, durability } = field;
  if (!isInteger(id) || !isKnownSlotId(id)) return 'inventory entry has an unknown id';
  if (!isInteger(count) || count < 1 || count > 64) return 'inventory entry has an invalid count';
  const stack: SavedStack = { id, count };
  if (durability !== undefined) {
    if (!isFiniteNumber(durability) || durability <= 0) {
      return 'inventory entry has invalid durability';
    }
    stack.durability = durability;
  }
  return stack;
}

function readVec3(value: unknown): Vec3 | string {
  const field = objectOf(value);
  if (field === null) return 'position is not an object';
  const { x, y, z } = field;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
    return 'position is not finite';
  }
  return { x, y, z };
}

function readPlayer(value: unknown): SavedPlayer | string {
  const field = objectOf(value);
  if (field === null) return 'player is not an object';
  const position = readVec3(field.position);
  if (typeof position === 'string') return position;
  if (!isFiniteNumber(field.yaw) || !isFiniteNumber(field.pitch)) {
    return 'player orientation is invalid';
  }
  if (!isFiniteNumber(field.health) || field.health < 0 || field.health > MAX_HEALTH) {
    return 'player health is out of range';
  }
  if (!isFiniteNumber(field.hunger) || field.hunger < 0 || field.hunger > MAX_HUNGER) {
    return 'player hunger is out of range';
  }
  if (!isInteger(field.selected) || field.selected < 0 || field.selected > 8) {
    return 'selected hotbar slot is invalid';
  }
  if (!Array.isArray(field.inventory) || field.inventory.length !== INVENTORY_SIZE) {
    return 'inventory shape is invalid';
  }
  const inventory: Array<SavedStack | null> = [];
  for (const entry of field.inventory) {
    if (entry === null) {
      inventory.push(null);
      continue;
    }
    const stack = readStack(entry);
    if (typeof stack === 'string') return stack;
    inventory.push(stack);
  }
  return {
    position,
    yaw: field.yaw,
    pitch: field.pitch,
    health: field.health,
    hunger: field.hunger,
    inventory,
    selected: field.selected,
  };
}

function readEdits(value: unknown): SavedEdit[] | string {
  if (!Array.isArray(value)) return 'edits is not an array';
  const edits: SavedEdit[] = [];
  for (const entry of value) {
    const field = objectOf(entry);
    if (field === null) return 'edit entry is not an object';
    if (!isInteger(field.x) || !isInteger(field.z)) {
      return 'edit coordinates must be integers';
    }
    if (!isInteger(field.y) || field.y < 0 || field.y >= CHUNK_HEIGHT) {
      return 'edit height is out of range';
    }
    if (!isInteger(field.block) || !Object.prototype.hasOwnProperty.call(BLOCKS, field.block)) {
      return 'edit references an unknown block';
    }
    edits.push({ x: field.x, y: field.y, z: field.z, block: field.block });
  }
  return edits;
}

function readStat(field: JsonObject, key: keyof SavedStats): number | string {
  const value = field[key];
  if (!isInteger(value) || value < 0) return `stat ${key} is invalid`;
  return value;
}

function readStats(value: unknown): SavedStats | string {
  const field = objectOf(value);
  if (field === null) return 'stats is not an object';
  const blocksMined = readStat(field, 'blocksMined');
  if (typeof blocksMined === 'string') return blocksMined;
  const blocksPlaced = readStat(field, 'blocksPlaced');
  if (typeof blocksPlaced === 'string') return blocksPlaced;
  const creaturesDefeated = readStat(field, 'creaturesDefeated');
  if (typeof creaturesDefeated === 'string') return creaturesDefeated;
  const deaths = readStat(field, 'deaths');
  if (typeof deaths === 'string') return deaths;
  return { blocksMined, blocksPlaced, creaturesDefeated, deaths };
}

export function encodeSave(record: SaveRecord): string {
  return JSON.stringify(record);
}

export function decodeSave(encoded: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return unreadable('save payload is not valid JSON');
  }
  const field = objectOf(parsed);
  if (field === null) return unreadable('save payload is not an object');
  if (field.schema !== SAVE_SCHEMA_VERSION) {
    return unreadable(`unsupported schema ${String(field.schema)}`);
  }
  if (!isInteger(field.slot) || field.slot < 1 || field.slot > 3) {
    return unreadable('slot must be 1, 2 or 3');
  }
  if (typeof field.name !== 'string' || field.name.length === 0 || field.name.length > 64) {
    return unreadable('world name is invalid');
  }
  if (typeof field.seed !== 'string' || field.seed.length === 0 || field.seed.length > 128) {
    return unreadable('world seed is invalid');
  }
  if (!isFiniteNumber(field.createdAt) || field.createdAt < 0) {
    return unreadable('created timestamp is invalid');
  }
  if (!isFiniteNumber(field.updatedAt) || field.updatedAt < 0) {
    return unreadable('updated timestamp is invalid');
  }
  if (!isFiniteNumber(field.playSeconds) || field.playSeconds < 0) {
    return unreadable('elapsed play time is invalid');
  }
  if (!isInteger(field.day) || field.day < 1) return unreadable('day is invalid');
  if (
    !isFiniteNumber(field.timeOfDay) ||
    field.timeOfDay < 0 ||
    field.timeOfDay >= CYCLE_SECONDS
  ) {
    return unreadable('time of day is invalid');
  }

  const player = readPlayer(field.player);
  if (typeof player === 'string') return unreadable(player);
  const edits = readEdits(field.edits);
  if (typeof edits === 'string') return unreadable(edits);
  const stats = readStats(field.stats);
  if (typeof stats === 'string') return unreadable(stats);

  return {
    ok: true,
    record: {
      schema: SAVE_SCHEMA_VERSION,
      slot: field.slot as SaveSlot,
      name: field.name,
      seed: field.seed,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
      playSeconds: field.playSeconds,
      day: field.day,
      timeOfDay: field.timeOfDay,
      player,
      edits,
      stats,
    },
  };
}

export interface NewSaveOptions {
  slot: SaveSlot;
  name: string;
  seed: string;
  now: number;
  spawn: Vec3;
}

export function createSave({ slot, name, seed, now, spawn }: NewSaveOptions): SaveRecord {
  return {
    schema: SAVE_SCHEMA_VERSION,
    slot,
    name,
    seed,
    createdAt: now,
    updatedAt: now,
    playSeconds: 0,
    day: 1,
    timeOfDay: 0,
    player: {
      position: { ...spawn },
      yaw: 0,
      pitch: 0,
      health: MAX_HEALTH,
      hunger: MAX_HUNGER,
      inventory: Array.from({ length: INVENTORY_SIZE }, () => null),
      selected: 0,
    },
    edits: [],
    stats: { blocksMined: 0, blocksPlaced: 0, creaturesDefeated: 0, deaths: 0 },
  };
}