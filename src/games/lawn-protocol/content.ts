export const LANES = 5;
export const COLS = 9;
export const CELL_COUNT = LANES * COLS;

export const MODULE_IDS = [
  'photofern',
  'needle-pod',
  'burst-bloom',
  'rind-wall',
  'frost-cap',
  'ember-vine',
  'mortar-moss',
  'purge-reed',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export const ENEMY_IDS = [
  'walker',
  'runner',
  'armoured',
  'shielded',
  'jumper',
  'burrower',
  'splitter',
  'healer',
  'ranged',
  'boss',
] as const;

export type EnemyId = (typeof ENEMY_IDS)[number];

export const THEME_IDS = ['solar', 'copper', 'glass'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ModuleDef {
  id: ModuleId;
  name: string;
  cost: number;
  recharge: number;
  health: number;
  summary: string;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  health: number;
  shield: number;
  speed: number;
  eat: number;
  score: number;
  summary: string;
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  photofern: {
    id: 'photofern',
    name: 'Photofern',
    cost: 50,
    recharge: 5,
    health: 120,
    summary: 'Drops a 25-light token every 8 seconds.',
  },
  'needle-pod': {
    id: 'needle-pod',
    name: 'Needle Pod',
    cost: 100,
    recharge: 5,
    health: 150,
    summary: 'Fires a 20-damage needle at the nearest target ahead.',
  },
  'burst-bloom': {
    id: 'burst-bloom',
    name: 'Burst Bloom',
    cost: 125,
    recharge: 12,
    health: 130,
    summary: 'Short-range burst that splashes nearby rust.',
  },
  'rind-wall': {
    id: 'rind-wall',
    name: 'Rind Wall',
    cost: 50,
    recharge: 8,
    health: 420,
    summary: 'A tough blocker. Enemies must chew through it.',
  },
  'frost-cap': {
    id: 'frost-cap',
    name: 'Frost Cap',
    cost: 100,
    recharge: 18,
    health: 130,
    summary: 'Periodically slows every enemy in its lane.',
  },
  'ember-vine': {
    id: 'ember-vine',
    name: 'Ember Vine',
    cost: 125,
    recharge: 15,
    health: 140,
    summary: 'Burns enemies that linger on its tile.',
  },
  'mortar-moss': {
    id: 'mortar-moss',
    name: 'Mortar Moss',
    cost: 150,
    recharge: 18,
    health: 140,
    summary: 'Lobs splash damage at distant targets. Blind up close.',
  },
  'purge-reed': {
    id: 'purge-reed',
    name: 'Purge Reed',
    cost: 175,
    recharge: 30,
    health: 100,
    summary: 'One-shot lane clear after a short arming delay.',
  },
};

export const MODULE_ORDER: readonly ModuleId[] = MODULE_IDS;

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  walker: {
    id: 'walker',
    name: 'Rust Walker',
    health: 110,
    shield: 0,
    speed: 0.16,
    eat: 45,
    score: 10,
    summary: 'Steady, cheap and endless.',
  },
  runner: {
    id: 'runner',
    name: 'Rust Runner',
    health: 70,
    shield: 0,
    speed: 0.36,
    eat: 40,
    score: 12,
    summary: 'Fast and fragile. Punishes thin lanes.',
  },
  armoured: {
    id: 'armoured',
    name: 'Plateback',
    health: 300,
    shield: 0,
    speed: 0.11,
    eat: 60,
    score: 25,
    summary: 'Heavy plating that soaks sustained fire.',
  },
  shielded: {
    id: 'shielded',
    name: 'Bulwark',
    health: 110,
    shield: 90,
    speed: 0.15,
    eat: 45,
    score: 20,
    summary: 'A shield absorbs damage before its body.',
  },
  jumper: {
    id: 'jumper',
    name: 'Hoplet',
    health: 100,
    shield: 0,
    speed: 0.24,
    eat: 45,
    score: 18,
    summary: 'Leaps over the first blocker it meets.',
  },
  burrower: {
    id: 'burrower',
    name: 'Burrower',
    health: 100,
    shield: 0,
    speed: 0.2,
    eat: 45,
    score: 18,
    summary: 'Tunnels under the first blocker it meets.',
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    health: 170,
    shield: 0,
    speed: 0.14,
    eat: 45,
    score: 22,
    summary: 'Breaks into two walkers when destroyed.',
  },
  healer: {
    id: 'healer',
    name: 'Patchwright',
    health: 160,
    shield: 0,
    speed: 0.13,
    eat: 40,
    score: 25,
    summary: 'Repairs nearby rust every two seconds.',
  },
  ranged: {
    id: 'ranged',
    name: 'Spitter',
    health: 120,
    shield: 0,
    speed: 0.15,
    eat: 0,
    score: 22,
    summary: 'Stops at range and spits at modules.',
  },
  boss: {
    id: 'boss',
    name: 'Siege Core',
    health: 1400,
    shield: 0,
    speed: 0.08,
    eat: 90,
    score: 100,
    summary: 'A slow, armoured core-breaker.',
  },
};

export interface SpawnWave {
  at: number;
  lane: number;
  enemy: EnemyId;
  count: number;
  spacing: number;
}

export interface LevelDef {
  id: string;
  name: string;
  theme: ThemeId;
  blurb: string;
  startingLight: number;
  skyInterval: number;
  hpScale: number;
  speedScale: number;
  waves: SpawnWave[];
}

function wave(at: number, lane: number, enemy: EnemyId, count = 1, spacing = 1.2): SpawnWave {
  return { at, lane, enemy, count, spacing };
}

export const LEVELS: readonly LevelDef[] = [
  {
    id: 'first-light',
    name: 'First Light',
    theme: 'solar',
    blurb: 'Rust walkers test the eastern roof. Learn the light and hold three lanes.',
    startingLight: 150,
    skyInterval: 8,
    hpScale: 1,
    speedScale: 1,
    waves: [
      wave(8, 2, 'walker', 2, 3),
      wave(22, 1, 'walker', 2, 2.4),
      wave(36, 3, 'walker', 3, 2),
      wave(50, 0, 'walker', 2, 2),
      wave(64, 2, 'walker', 4, 1.8),
    ],
  },
  {
    id: 'sidewalk-shuffle',
    name: 'Sidewalk Shuffle',
    theme: 'solar',
    blurb: 'Runners sprint the short gaps. Build a wall before the second horn.',
    startingLight: 150,
    skyInterval: 8,
    hpScale: 1.03,
    speedScale: 1.02,
    waves: [
      wave(8, 1, 'runner', 2, 2.2),
      wave(18, 2, 'walker', 2, 2.4),
      wave(26, 3, 'runner', 2, 1.6),
      wave(40, 0, 'runner', 3, 1.5),
      wave(54, 4, 'walker', 2, 2),
      wave(66, 2, 'runner', 4, 1.3),
    ],
  },
  {
    id: 'copper-line',
    name: 'Copper Line',
    theme: 'copper',
    blurb: 'Platebacks punish thin fire. Layer needles and let frost buy time.',
    startingLight: 175,
    skyInterval: 7.5,
    hpScale: 1.06,
    speedScale: 1.04,
    waves: [
      wave(10, 2, 'armoured', 1),
      wave(20, 1, 'walker', 3, 1.8),
      wave(32, 3, 'armoured', 1),
      wave(42, 0, 'shielded', 2, 2.4),
      wave(56, 4, 'walker', 3, 1.6),
      wave(68, 2, 'armoured', 2, 3),
    ],
  },
  {
    id: 'gutter-run',
    name: 'Gutter Run',
    theme: 'copper',
    blurb: 'Hoplets vault the first wall. Stack a second line behind the rind.',
    startingLight: 175,
    skyInterval: 7.5,
    hpScale: 1.09,
    speedScale: 1.06,
    waves: [
      wave(9, 0, 'jumper', 1),
      wave(18, 2, 'walker', 3, 1.8),
      wave(28, 4, 'jumper', 1),
      wave(34, 1, 'jumper', 1),
      wave(44, 3, 'runner', 4, 1.4),
      wave(58, 2, 'jumper', 3, 2.2),
    ],
  },
  {
    id: 'undercroft',
    name: 'Undercroft',
    theme: 'copper',
    blurb: 'Burrowers tunnel past the front wall. Keep a shooter behind it.',
    startingLight: 175,
    skyInterval: 7.5,
    hpScale: 1.12,
    speedScale: 1.08,
    waves: [
      wave(10, 1, 'burrower', 1),
      wave(20, 3, 'walker', 3, 1.8),
      wave(30, 0, 'burrower', 1),
      wave(40, 2, 'shielded', 2, 2.2),
      wave(54, 4, 'burrower', 2, 2.4),
      wave(68, 1, 'burrower', 3, 2),
    ],
  },
  {
    id: 'split-decision',
    name: 'Split Decision',
    theme: 'copper',
    blurb: 'Splitters turn one kill into two problems. Splash damage earns its cost.',
    startingLight: 200,
    skyInterval: 7,
    hpScale: 1.15,
    speedScale: 1.1,
    waves: [
      wave(10, 2, 'splitter', 1),
      wave(20, 1, 'runner', 3, 1.6),
      wave(32, 4, 'splitter', 1),
      wave(42, 0, 'splitter', 2, 3),
      wave(56, 3, 'walker', 4, 1.6),
      wave(70, 2, 'splitter', 2, 2.6),
    ],
  },
  {
    id: 'field-clinic',
    name: 'Field Clinic',
    theme: 'glass',
    blurb: 'Patchwrights repair the line. Kill the healer first or never finish.',
    startingLight: 200,
    skyInterval: 7,
    hpScale: 1.18,
    speedScale: 1.12,
    waves: [
      wave(10, 1, 'healer', 1),
      wave(16, 1, 'walker', 2, 2),
      wave(30, 3, 'healer', 1),
      wave(36, 3, 'walker', 3, 1.8),
      wave(50, 0, 'healer', 1),
      wave(56, 0, 'armoured', 1),
      wave(70, 2, 'healer', 2, 2.4),
    ],
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    theme: 'glass',
    blurb: 'Spitters remove modules from range. Push fire forward and rebuild quickly.',
    startingLight: 200,
    skyInterval: 7,
    hpScale: 1.21,
    speedScale: 1.14,
    waves: [
      wave(10, 0, 'ranged', 1),
      wave(20, 4, 'ranged', 1),
      wave(28, 2, 'walker', 3, 1.6),
      wave(42, 1, 'ranged', 2, 2.4),
      wave(52, 3, 'shielded', 2, 2.2),
      wave(66, 2, 'ranged', 2, 2.4),
    ],
  },
  {
    id: 'hot-asphalt',
    name: 'Hot Asphalt',
    theme: 'glass',
    blurb: 'Every rust type shares the roof. Read the telegraph and rotate your lanes.',
    startingLight: 225,
    skyInterval: 6.5,
    hpScale: 1.25,
    speedScale: 1.16,
    waves: [
      wave(8, 1, 'runner', 3, 1.5),
      wave(18, 3, 'armoured', 1),
      wave(28, 0, 'jumper', 2, 2.2),
      wave(38, 4, 'burrower', 2, 2.2),
      wave(48, 2, 'splitter', 2, 2.4),
      wave(60, 1, 'healer', 1),
      wave(66, 3, 'ranged', 2, 2.4),
      wave(78, 2, 'runner', 5, 1.2),
    ],
  },
  {
    id: 'glasshouse',
    name: 'Glasshouse',
    theme: 'glass',
    blurb: 'A long grinder. Bank light early; the last three horns arrive together.',
    startingLight: 225,
    skyInterval: 6.5,
    hpScale: 1.3,
    speedScale: 1.18,
    waves: [
      wave(8, 0, 'shielded', 2, 2.2),
      wave(20, 4, 'runner', 4, 1.4),
      wave(32, 2, 'armoured', 2, 2.6),
      wave(44, 1, 'splitter', 2, 2.4),
      wave(56, 3, 'jumper', 3, 2),
      wave(68, 0, 'healer', 1),
      wave(74, 4, 'burrower', 2, 2.2),
      wave(86, 2, 'armoured', 3, 2.4),
    ],
  },
  {
    id: 'final-approach',
    name: 'Final Approach',
    theme: 'glass',
    blurb: 'The east stair is open. Everything the rust has left is coming through it.',
    startingLight: 250,
    skyInterval: 6.5,
    hpScale: 1.36,
    speedScale: 1.2,
    waves: [
      wave(8, 2, 'runner', 4, 1.3),
      wave(18, 1, 'shielded', 2, 2),
      wave(28, 3, 'armoured', 2, 2.4),
      wave(38, 0, 'jumper', 2, 2),
      wave(48, 4, 'splitter', 2, 2.2),
      wave(58, 2, 'healer', 2, 2.4),
      wave(70, 1, 'ranged', 2, 2.2),
      wave(82, 3, 'runner', 5, 1.2),
      wave(92, 0, 'armoured', 2, 2.4),
    ],
  },
  {
    id: 'core-defense',
    name: 'Core Defense',
    theme: 'glass',
    blurb: 'The Siege Core walks last. Spend everything you have before it reaches the grid.',
    startingLight: 275,
    skyInterval: 6,
    hpScale: 1.45,
    speedScale: 1.25,
    waves: [
      wave(8, 1, 'walker', 4, 1.6),
      wave(18, 3, 'shielded', 2, 2),
      wave(28, 0, 'splitter', 2, 2.2),
      wave(38, 4, 'armoured', 2, 2.4),
      wave(48, 2, 'healer', 2, 2.2),
      wave(58, 1, 'runner', 4, 1.3),
      wave(68, 3, 'ranged', 2, 2.2),
      wave(78, 0, 'burrower', 3, 2),
      wave(88, 4, 'shielded', 3, 2),
      wave(100, 2, 'boss', 1),
    ],
  },
] as const;

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(
  LEVELS.map((level) => [level.id, level]),
);

export function validateLevel(level: LevelDef): string[] {
  const issues: string[] = [];
  if (!level.id.trim()) issues.push('level has no id');
  if (level.waves.length === 0) issues.push('level has no waves');
  if (level.startingLight < 0) issues.push('starting light is negative');
  if (level.skyInterval < 3) issues.push('sky interval is shorter than three seconds');
  if (!(level.hpScale > 0)) issues.push('hp scale must be positive');
  if (!(level.speedScale > 0)) issues.push('speed scale must be positive');

  for (const waveData of level.waves) {
    if (!Number.isFinite(waveData.at) || waveData.at < 0) issues.push('wave time is invalid');
    if (!Number.isInteger(waveData.lane) || waveData.lane < 0 || waveData.lane >= LANES) {
      issues.push(`lane out of range in wave at ${waveData.at}`);
    }
    if (!Number.isInteger(waveData.count) || waveData.count < 1) {
      issues.push(`count must be at least one in wave at ${waveData.at}`);
    }
    if (!Number.isFinite(waveData.spacing) || waveData.spacing < 0.2) {
      issues.push(`spacing too small in wave at ${waveData.at}`);
    }
    if (!(waveData.enemy in ENEMIES)) {
      issues.push(`unknown enemy in wave at ${waveData.at}`);
    }
  }

  if (level.waves.length > 0) {
    const last = level.waves[level.waves.length - 1];
    const latest = Math.max(...level.waves.map((waveData) => waveData.at + (waveData.count - 1) * waveData.spacing));
    if (last.at + (last.count - 1) * last.spacing < latest) {
      issues.push('final wave is not the last spawn');
    }
  }

  return issues;
}
