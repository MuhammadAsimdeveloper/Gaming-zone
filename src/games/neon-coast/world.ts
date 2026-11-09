/**
 * Vela District world data for Neon Coast: After Hours.
 *
 * Coordinates are world units: x grows east, y grows south. This module is
 * React-free and rendering-free so the simulation can be tested on its own.
 */

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 2000;
export const ROAD_HALF_WIDTH = 70;
export const SIDEWALK_WIDTH = 26;

export const ROAD_VERTICAL = [260, 860, 1460, 2060];
export const ROAD_HORIZONTAL = [260, 760, 1260, 1760];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Road {
  orientation: 'vertical' | 'horizontal';
  position: number;
}

export interface Block {
  id: string;
  name: string;
  bounds: Rect;
  buildings: Rect[];
}

export type LandmarkKind =
  | 'garage'
  | 'market'
  | 'tower'
  | 'pier'
  | 'plaza'
  | 'arcade'
  | 'depot'
  | 'park';

export interface Landmark {
  id: string;
  name: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  /** How close the player must be to interact. */
  radius: number;
  tagline: string;
}

export interface District {
  id: string;
  name: string;
  width: number;
  height: number;
  roads: Road[];
  blocks: Block[];
  props: Rect[];
  landmarks: Landmark[];
  spawn: Point;
  carSpawn: Point;
}

/** Paved ground that is not part of the street grid, such as the garage forecourt. */
export const PAVED_AREAS: Rect[] = [{ x: 1076, y: 1472, width: 196, height: 176 }];

export const SOLARA_LANDMARKS: Landmark[] = [
  {
    id: 'vela-garage',
    name: 'Vela Garage',
    kind: 'garage',
    x: 1160,
    y: 1560,
    radius: 90,
    tagline: 'Your coupe waits under the sodium lights.',
  },
  {
    id: 'tideglass-market',
    name: 'Tideglass Market',
    kind: 'market',
    x: 560,
    y: 510,
    radius: 90,
    tagline: 'Stalls under striped awnings, breakfast until noon.',
  },
  {
    id: 'coral-radio-tower',
    name: 'Coral Radio Tower',
    kind: 'tower',
    x: 1160,
    y: 1010,
    radius: 85,
    tagline: 'The district’s heartbeat, broadcast in warm static.',
  },
  {
    id: 'lantern-pier',
    name: 'Lantern Pier',
    kind: 'pier',
    x: 560,
    y: 1900,
    radius: 95,
    tagline: 'Boardwalk lights stacked out over the bay.',
  },
  {
    id: 'sunset-steps',
    name: 'Sunset Steps',
    kind: 'plaza',
    x: 1760,
    y: 510,
    radius: 85,
    tagline: 'Terraced stone, buskers, and a view down to the water.',
  },
  {
    id: 'solara-arcade',
    name: 'Solara Arcade',
    kind: 'arcade',
    x: 1760,
    y: 1010,
    radius: 85,
    tagline: 'Neon frontage and the smell of warm circuitry.',
  },
  {
    id: 'meridian-tram-depot',
    name: 'Meridian Tram Depot',
    kind: 'depot',
    x: 1160,
    y: 510,
    radius: 85,
    tagline: 'Trams glide out on the hour, every hour.',
  },
  {
    id: 'marigold-park',
    name: 'Marigold Park',
    kind: 'park',
    x: 560,
    y: 1010,
    radius: 95,
    tagline: 'A green shortcut with paths worn smooth.',
  },
];

interface BlockSeed {
  id: string;
  name: string;
  column: number;
  row: number;
}

const BLOCK_INSET = ROAD_HALF_WIDTH + SIDEWALK_WIDTH + 4;
const BUILDING_DEPTH = 80;

const BLOCK_SEEDS: BlockSeed[] = [
  { id: 'tideglass-block', name: 'Tideglass Market', column: 0, row: 0 },
  { id: 'meridian-block', name: 'Meridian Depot', column: 1, row: 0 },
  { id: 'sunset-block', name: 'Sunset Steps', column: 2, row: 0 },
  { id: 'marigold-block', name: 'Marigold Park', column: 0, row: 1 },
  { id: 'coral-block', name: 'Coral Tower', column: 1, row: 1 },
  { id: 'arcade-block', name: 'Solara Arcade', column: 2, row: 1 },
  { id: 'kiln-block', name: 'Kiln Row', column: 0, row: 2 },
  { id: 'garage-block', name: 'Vela Garage', column: 1, row: 2 },
  { id: 'heights-block', name: 'Coral Heights', column: 2, row: 2 },
];

function blockBounds(column: number, row: number): Rect {
  const left = ROAD_VERTICAL[column]! + BLOCK_INSET;
  const right = ROAD_VERTICAL[column + 1]! - BLOCK_INSET;
  const top = ROAD_HORIZONTAL[row]! + BLOCK_INSET;
  const bottom = ROAD_HORIZONTAL[row + 1]! - BLOCK_INSET;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function blockBuildings(bounds: Rect): Rect[] {
  return [
    { x: bounds.x, y: bounds.y, width: BUILDING_DEPTH, height: bounds.height },
    {
      x: bounds.x + bounds.width - BUILDING_DEPTH,
      y: bounds.y,
      width: BUILDING_DEPTH,
      height: bounds.height,
    },
  ];
}

function buildProps(blocks: Block[]): Rect[] {
  const props: Rect[] = [];
  for (const block of blocks) {
    const cx = block.bounds.x + block.bounds.width / 2;
    const cy = block.bounds.y + block.bounds.height / 2;
    props.push(
      { x: cx - 78, y: cy - 78, width: 24, height: 24 },
      { x: cx + 54, y: cy + 54, width: 24, height: 24 },
    );
  }
  return props;
}

const blocks: Block[] = BLOCK_SEEDS.map((seed) => {
  const bounds = blockBounds(seed.column, seed.row);
  return { id: seed.id, name: seed.name, bounds, buildings: blockBuildings(bounds) };
});

const roads: Road[] = [
  ...ROAD_VERTICAL.map((position): Road => ({ orientation: 'vertical', position })),
  ...ROAD_HORIZONTAL.map((position): Road => ({ orientation: 'horizontal', position })),
];

export const VELA_DISTRICT: District = {
  id: 'vela',
  name: 'Vela District',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  roads,
  blocks,
  props: buildProps(blocks),
  landmarks: SOLARA_LANDMARKS,
  spawn: { x: 1220, y: 1560 },
  carSpawn: { x: 1160, y: 1560 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function insideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** True on the street, the sidewalk band, or another paved surface. */
export function isOnRoad(x: number, y: number): boolean {
  const reach = ROAD_HALF_WIDTH + SIDEWALK_WIDTH;
  if (ROAD_VERTICAL.some((line) => Math.abs(x - line) <= reach)) return true;
  if (ROAD_HORIZONTAL.some((line) => Math.abs(y - line) <= reach)) return true;
  return PAVED_AREAS.some((area) => insideRect(x, y, area));
}

/** Nearest landmark whose centre is within `radius` of the point. */
export function landmarkAt(x: number, y: number, radius: number): Landmark | null {
  let best: Landmark | null = null;
  let bestDistance = radius;
  for (const landmark of SOLARA_LANDMARKS) {
    const distance = Math.hypot(landmark.x - x, landmark.y - y);
    if (distance <= bestDistance) {
      best = landmark;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Pushes a circle out of every overlapping rectangle. Returns the adjusted
 * position (z is the world y coordinate) and whether any rectangle was hit.
 */
export function collideCircle(
  rects: ReadonlyArray<Rect>,
  x: number,
  y: number,
  radius: number,
): { x: number; z: number; hit: boolean } {
  let px = x;
  let py = y;
  let hit = false;

  for (const rect of rects) {
    const nearestX = clamp(px, rect.x, rect.x + rect.width);
    const nearestY = clamp(py, rect.y, rect.y + rect.height);
    const dx = px - nearestX;
    const dy = py - nearestY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq >= radius * radius) continue;

    hit = true;
    if (distanceSq > 1e-9) {
      const distance = Math.sqrt(distanceSq);
      px = nearestX + (dx / distance) * radius;
      py = nearestY + (dy / distance) * radius;
      continue;
    }

    // Centre is inside the rectangle: eject through the nearest face.
    const left = px - rect.x;
    const right = rect.x + rect.width - px;
    const top = py - rect.y;
    const bottom = rect.y + rect.height - py;
    const nearest = Math.min(left, right, top, bottom);
    if (nearest === left) px = rect.x - radius;
    else if (nearest === right) px = rect.x + rect.width + radius;
    else if (nearest === top) py = rect.y - radius;
    else py = rect.y + rect.height + radius;
  }

  return {
    x: clamp(px, 0, WORLD_WIDTH),
    z: clamp(py, 0, WORLD_HEIGHT),
    hit,
  };
}
