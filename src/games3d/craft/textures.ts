import type { TextureKey } from './blocks';

export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 8;
export const TILE_PIXELS = 16;
export const ATLAS_WIDTH = ATLAS_COLUMNS * TILE_PIXELS;
export const ATLAS_HEIGHT = ATLAS_ROWS * TILE_PIXELS;

export const TEXTURE_KEYS: readonly TextureKey[] = [
  'stone', 'cobblestone', 'dirt', 'grass_top', 'grass_side', 'sand', 'gravel', 'clay',
  'mud', 'emberstone', 'ash', 'moss',
  'riftwood_top', 'riftwood_side', 'leaves',
  'glowwood_top', 'glowwood_side', 'glow_leaves',
  'glowcap', 'reeds', 'glowkelp', 'flower',
  'coal_ore', 'iron_ore', 'gold_ore', 'crystal_ore',
  'planks', 'workbench_top', 'workbench_side', 'kiln_top', 'kiln_side', 'torch', 'lantern',
  'glass', 'gilded', 'bricks', 'water', 'lava', 'rift_lantern',
  'farmland_top', 'farmland_side',
  'glowberry_0', 'glowberry_1', 'glowberry_2', 'glowberry_3',
  'riftroot_0', 'riftroot_1', 'riftroot_2', 'riftroot_3',
];

const TEXTURE_INDEX = new Map<TextureKey, number>(
  TEXTURE_KEYS.map((key, index) => [key, index]),
);

type Rgb = readonly [number, number, number];

const COLORS: Record<TextureKey, Rgb> = {
  stone: [138, 143, 152],
  cobblestone: [122, 126, 134],
  dirt: [122, 88, 62],
  grass_top: [92, 158, 92],
  grass_side: [112, 112, 82],
  sand: [214, 199, 146],
  gravel: [134, 128, 124],
  clay: [156, 162, 172],
  mud: [86, 74, 62],
  emberstone: [146, 78, 62],
  ash: [92, 90, 96],
  moss: [74, 116, 78],
  riftwood_top: [134, 96, 68],
  riftwood_side: [110, 78, 56],
  leaves: [66, 142, 92],
  glowwood_top: [86, 108, 122],
  glowwood_side: [64, 92, 110],
  glow_leaves: [72, 198, 190],
  glowcap: [188, 108, 196],
  reeds: [126, 158, 82],
  glowkelp: [66, 178, 158],
  flower: [214, 108, 148],
  coal_ore: [128, 134, 142],
  iron_ore: [138, 136, 136],
  gold_ore: [150, 138, 104],
  crystal_ore: [118, 142, 152],
  planks: [172, 132, 88],
  workbench_top: [158, 112, 72],
  workbench_side: [136, 96, 64],
  kiln_top: [110, 104, 100],
  kiln_side: [96, 90, 88],
  torch: [150, 108, 62],
  lantern: [110, 116, 128],
  glass: [186, 224, 232],
  gilded: [222, 182, 82],
  bricks: [168, 88, 74],
  water: [58, 142, 202],
  lava: [226, 102, 42],
  rift_lantern: [112, 214, 196],
  farmland_top: [104, 76, 54],
  farmland_side: [116, 86, 60],
  glowberry_0: [116, 168, 96],
  glowberry_1: [126, 186, 100],
  glowberry_2: [142, 208, 118],
  glowberry_3: [156, 228, 132],
  riftroot_0: [120, 148, 92],
  riftroot_1: [134, 168, 96],
  riftroot_2: [150, 188, 104],
  riftroot_3: [168, 208, 112],
};

const ORE_ACCENT: Partial<Record<TextureKey, Rgb>> = {
  coal_ore: [42, 40, 46],
  iron_ore: [216, 160, 106],
  gold_ore: [244, 197, 66],
  crystal_ore: [126, 249, 227],
};

type Style =
  | 'noise' | 'ore' | 'wood' | 'leaves' | 'plant' | 'glass' | 'liquid' | 'brick' | 'metal' | 'panel';

function styleFor(key: TextureKey): Style {
  if (key.endsWith('_ore')) return 'ore';
  if (key === 'planks' || key.startsWith('riftwood') || key.startsWith('glowwood')) return 'wood';
  if (key === 'leaves' || key === 'glow_leaves') return 'leaves';
  if (key === 'glass') return 'glass';
  if (key === 'water' || key === 'lava') return 'liquid';
  if (key === 'bricks') return 'brick';
  if (key === 'gilded') return 'metal';
  if (key.startsWith('workbench') || key.startsWith('kiln') || key.startsWith('farmland')) {
    return 'panel';
  }
  if (
    key === 'glowcap' || key === 'reeds' || key === 'glowkelp' || key === 'flower' ||
    key === 'torch' || key === 'lantern' || key === 'rift_lantern' ||
    key.startsWith('glowberry_') || key.startsWith('riftroot_')
  ) {
    return 'plant';
  }
  return 'noise';
}

function hashKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function noise(x: number, y: number, seed: number): number {
  let hash = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

function shade(color: Rgb, factor: number): Rgb {
  return [
    Math.max(0, Math.min(255, Math.round(color[0] * factor))),
    Math.max(0, Math.min(255, Math.round(color[1] * factor))),
    Math.max(0, Math.min(255, Math.round(color[2] * factor))),
  ];
}

type Pixel = [number, number, number, number];

function cropHeight(key: TextureKey): number {
  return 5 + Number(key.charAt(key.length - 1)) * 3;
}

function plantPixel(key: TextureKey, x: number, y: number, color: Rgb, n: number): Pixel {
  if (key.startsWith('glowberry_') || key.startsWith('riftroot_')) {
    const height = cropHeight(key);
    const top = 16 - height;
    const stem = (x === 7 || x === 8) && y >= top;
    const leaves = Math.abs(x - 7.5) <= 2 && y >= top - 2 && y <= top + 3 && n > 0.35;
    if (stem || leaves) {
      const c = shade(color, 0.86 + n * 0.28);
      return [c[0], c[1], c[2], 255];
    }
    return [0, 0, 0, 0];
  }

  if (key === 'flower') {
    const stem = (x === 7 || x === 8) && y >= 7;
    const petal = Math.hypot(x + 0.5 - 8, y + 0.5 - 4.5) <= 3.2;
    if (stem) return [86, 148, 76, 255];
    if (petal) {
      const c = shade(color, 0.88 + n * 0.24);
      return [c[0], c[1], c[2], 255];
    }
    return [0, 0, 0, 0];
  }

  if (key === 'torch') {
    const stick = (x === 7 || x === 8) && y >= 6;
    const flame = Math.hypot(x + 0.5 - 8, y + 0.5 - 4) <= 2.4;
    if (flame) return [252, 196, 92, 255];
    if (stick) {
      const c = shade(color, 0.84 + n * 0.2);
      return [c[0], c[1], c[2], 255];
    }
    return [0, 0, 0, 0];
  }

  if (key === 'lantern' || key === 'rift_lantern') {
    const inside = x >= 3 && x <= 12 && y >= 2 && y <= 13;
    const border = inside && (x === 3 || x === 12 || y === 2 || y === 13);
    const glow = inside && !border && Math.hypot(x - 7.5, y - 7.5) < 3.4;
    if (border) {
      const c = shade(color, 0.7);
      return [c[0], c[1], c[2], 255];
    }
    if (glow) return [252, 226, 148, 255];
    if (inside) return [56, 52, 50, 255];
    return [0, 0, 0, 0];
  }

  if (key === 'glowcap') {
    const stem = (x === 7 || x === 8) && y >= 8;
    const cap = Math.hypot((x + 0.5 - 8) / 1.5, (y + 0.5 - 7) / 1) <= 4.2;
    if (stem) return [222, 216, 198, 255];
    if (cap) {
      const c = shade(color, 0.9 + n * 0.3);
      return [c[0], c[1], c[2], 255];
    }
    return [0, 0, 0, 0];
  }

  const blades = key === 'reeds' ? [4, 7, 10, 13] : [5, 8, 11];
  const blade = blades.some((column, index) => x === column && y >= 4 + index);
  const tip = y < 6 && Math.abs(x - 8) <= 3 && n > 0.72;
  if (blade || tip) {
    const c = shade(color, 0.84 + n * 0.3);
    return [c[0], c[1], c[2], 255];
  }
  return [0, 0, 0, 0];
}

function pixelFor(key: TextureKey, x: number, y: number, seed: number): Pixel {
  const color = COLORS[key];
  const style = styleFor(key);
  const n = noise(x, y, seed);

  switch (style) {
    case 'ore': {
      const blob = noise(x >> 1, y >> 1, seed + 17);
      const accent = ORE_ACCENT[key] ?? color;
      const c = shade(blob > 0.72 ? accent : color, 0.78 + n * 0.36);
      return [c[0], c[1], c[2], 255];
    }
    case 'wood': {
      const ring = x % 5 === 0 ? 0.78 : 1;
      const c = shade(color, (0.84 + n * 0.24) * ring);
      return [c[0], c[1], c[2], 255];
    }
    case 'leaves': {
      if (n < 0.24) return [0, 0, 0, 0];
      const c = shade(color, 0.78 + n * 0.42);
      return [c[0], c[1], c[2], 255];
    }
    case 'plant':
      return plantPixel(key, x, y, color, n);
    case 'glass': {
      if (x === 0 || y === 0 || x === 15 || y === 15) {
        const c = shade(color, 0.82);
        return [c[0], c[1], c[2], 190];
      }
      if (x === y || x === y + 1) return [236, 252, 255, 96];
      return [color[0], color[1], color[2], 42];
    }
    case 'liquid': {
      const ripple = 0.9 + Math.sin((x + y * 2) * 0.7) * 0.08 + n * 0.12;
      const c = shade(color, ripple);
      return [c[0], c[1], c[2], key === 'water' ? 190 : 255];
    }
    case 'brick': {
      const mortar = y % 5 === 0 || (x + Math.floor(y / 5) * 4) % 8 === 0;
      const c = shade(color, mortar ? 0.72 : 0.9 + n * 0.22);
      return [c[0], c[1], c[2], 255];
    }
    case 'metal': {
      const gleam = (x + y) % 7 < 2 ? 1.28 : 1;
      const c = shade(color, (0.84 + n * 0.2) * gleam);
      return [c[0], c[1], c[2], 255];
    }
    case 'panel': {
      const border = x === 0 || y === 0 || x === 15 || y === 15;
      const seam = x === 8 || y === 8;
      const furrow = key.startsWith('farmland') && y % 4 === 1;
      const factor = border ? 0.68 : seam ? 0.82 : furrow ? 0.74 : 0.9 + n * 0.22;
      const c = shade(color, factor);
      return [c[0], c[1], c[2], 255];
    }
    case 'noise': {
      const c = shade(color, 0.8 + n * 0.36);
      return [c[0], c[1], c[2], 255];
    }
  }
}

export function tileFor(key: TextureKey): number {
  return TEXTURE_INDEX.get(key) ?? 0;
}

export function generateTexture(key: TextureKey): Uint8ClampedArray {
  const data = new Uint8ClampedArray(TILE_PIXELS * TILE_PIXELS * 4);
  const seed = hashKey(key);
  for (let y = 0; y < TILE_PIXELS; y += 1) {
    for (let x = 0; x < TILE_PIXELS; x += 1) {
      const [r, g, b, a] = pixelFor(key, x, y, seed);
      const offset = (y * TILE_PIXELS + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return data;
}

export interface TileUvRange {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export function atlasUvRange(tile: number): TileUvRange {
  const column = tile % ATLAS_COLUMNS;
  const row = Math.floor(tile / ATLAS_COLUMNS);
  const insetX = 0.5 / ATLAS_WIDTH;
  const insetY = 0.5 / ATLAS_HEIGHT;
  return {
    u0: (column * TILE_PIXELS) / ATLAS_WIDTH + insetX,
    v0: (row * TILE_PIXELS) / ATLAS_HEIGHT + insetY,
    u1: ((column + 1) * TILE_PIXELS) / ATLAS_WIDTH - insetX,
    v1: ((row + 1) * TILE_PIXELS) / ATLAS_HEIGHT - insetY,
  };
}