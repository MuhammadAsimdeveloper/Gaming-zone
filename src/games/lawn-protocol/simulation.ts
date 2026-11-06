import {
  COLS,
  ENEMIES,
  LANES,
  MODULES,
  MODULE_ORDER,
  type EnemyId,
  type LevelDef,
  type ModuleId,
  type ThemeId,
} from './content';

export type LawnMode = 'campaign' | 'endless';
export type LawnStatus = 'running' | 'won' | 'lost';

export interface PlantedModule {
  id: number;
  moduleId: ModuleId;
  lane: number;
  col: number;
  health: number;
  maxHealth: number;
  timer: number;
  armed?: number;
}

export interface EnemyState {
  id: number;
  lane: number;
  x: number;
  enemyId: EnemyId;
  health: number;
  maxHealth: number;
  shield: number;
  speed: number;
  slowUntil: number;
  burnUntil: number;
  burnDps: number;
  abilityUsed: boolean;
  splitDepth: number;
  abilityTimer: number;
  dead: boolean;
}

export interface Projectile {
  id: number;
  kind: 'needle' | 'burst' | 'mortar';
  lane: number;
  x: number;
  startX: number;
  targetX: number;
  maxX: number;
  damage: number;
  splash: number;
  speed: number;
  progress: number;
  duration: number;
}

export interface LightToken {
  id: number;
  lane: number;
  col: number;
  value: number;
  ttl: number;
  source: 'sky' | 'module';
}

export interface SpawnEntry {
  time: number;
  lane: number;
  enemy: EnemyId;
  hpScale: number;
  speedScale: number;
}

export interface LawnState {
  mode: LawnMode;
  levelId: string;
  levelName: string;
  stage: ThemeId;
  seed: number;
  time: number;
  status: LawnStatus;
  light: number;
  score: number;
  kills: number;
  grid: (PlantedModule | null)[];
  enemies: EnemyState[];
  projectiles: Projectile[];
  tokens: LightToken[];
  queue: SpawnEntry[];
  totalEnemies: number;
  waveStartTimes: number[];
  nextWaveIndex: number;
  purges: boolean[];
  purgesUsed: number;
  recharge: Record<ModuleId, number>;
  nextSkyAt: number;
  skyInterval: number;
  nextId: number;
  rngState: number;
  hpScale: number;
  speedScale: number;
  endless: { wave: number; nextWaveAt: number } | null;
  finalWave: boolean;
}

export type LawnEvent =
  | { type: 'light'; amount: number }
  | { type: 'plant'; moduleId: ModuleId; lane: number; col: number }
  | { type: 'shovel'; moduleId: ModuleId; refund: number }
  | { type: 'shot'; kind: 'needle' | 'burst' | 'mortar' | 'ranged' | 'purge-reed' }
  | { type: 'module-down'; moduleId: ModuleId }
  | { type: 'enemy-down'; enemyId: EnemyId }
  | { type: 'purge'; lane: number }
  | { type: 'purge-reed'; lane: number }
  | { type: 'wave'; wave: number; final: boolean }
  | { type: 'win'; stars: number; score: number }
  | { type: 'lose'; score: number; wave: number };

export type ActionFailure = 'phase' | 'bounds' | 'occupied' | 'light' | 'recharge' | 'empty' | 'missing';

export interface ActionResult {
  ok: boolean;
  reason?: ActionFailure;
  events: LawnEvent[];
}

const MAX_LIGHT = 9999;
const SLOW_FACTOR = 0.45;

export function cellIndex(lane: number, col: number): number {
  return lane * COLS + col;
}

export function inBounds(lane: number, col: number): boolean {
  return Number.isInteger(lane) && Number.isInteger(col) && lane >= 0 && lane < LANES && col >= 0 && col < COLS;
}

export function cellAt(state: LawnState, lane: number, col: number): PlantedModule | null {
  if (!inBounds(lane, col)) return null;
  return state.grid[cellIndex(lane, col)];
}

export function freeRecharge(): Record<ModuleId, number> {
  return Object.fromEntries(MODULE_ORDER.map((id) => [id, 0])) as Record<ModuleId, number>;
}

function random(state: LawnState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) | 0;
  let t = state.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function nextId(state: LawnState): number {
  state.nextId += 1;
  return state.nextId;
}

function addLight(state: LawnState, amount: number): void {
  state.light = Math.min(MAX_LIGHT, state.light + amount);
}

export function createGame(options: { level: LevelDef; seed?: number; mode?: LawnMode }): LawnState {
  const { level } = options;
  const seed = options.seed ?? 1;
  const mode = options.mode ?? 'campaign';

  const queue: SpawnEntry[] =
    mode === 'campaign'
      ? level.waves
          .flatMap((waveData) =>
            Array.from({ length: waveData.count }, (_, index) => ({
              time: waveData.at + index * waveData.spacing,
              lane: waveData.lane,
              enemy: waveData.enemy,
              hpScale: level.hpScale,
              speedScale: level.speedScale,
            })),
          )
          .sort((a, b) => a.time - b.time)
      : [];

  const waveStartTimes =
    mode === 'campaign'
      ? [...new Set(level.waves.map((waveData) => waveData.at))].sort((a, b) => a - b)
      : [];

  return {
    mode,
    levelId: level.id,
    levelName: level.name,
    stage: level.theme,
    seed,
    time: 0,
    status: 'running',
    light: level.startingLight,
    score: 0,
    kills: 0,
    grid: Array.from({ length: LANES * COLS }, () => null),
    enemies: [],
    projectiles: [],
    tokens: [],
    queue,
    totalEnemies: 0,
    waveStartTimes,
    nextWaveIndex: 0,
    purges: Array.from({ length: LANES }, () => true),
    purgesUsed: 0,
    recharge: freeRecharge(),
    nextSkyAt: level.skyInterval,
    skyInterval: level.skyInterval,
    nextId: 0,
    rngState: seed | 0,
    hpScale: level.hpScale,
    speedScale: level.speedScale,
    endless: mode === 'endless' ? { wave: 0, nextWaveAt: 18 } : null,
    finalWave: false,
  };
}

export function spawnEnemy(
  state: LawnState,
  options: {
    lane: number;
    x: number;
    enemyId: EnemyId;
    hpScale?: number;
    speedScale?: number;
    freeze?: boolean;
    splitDepth?: number;
  },
): EnemyState {
  const def = ENEMIES[options.enemyId];
  const hpScale = options.hpScale ?? 1;
  const health = Math.max(1, Math.round(def.health * hpScale));
  const enemy: EnemyState = {
    id: nextId(state),
    lane: options.lane,
    x: options.x,
    enemyId: options.enemyId,
    health,
    maxHealth: health,
    shield: Math.round(def.shield * hpScale),
    speed: options.freeze ? 0 : def.speed * (options.speedScale ?? 1),
    slowUntil: 0,
    burnUntil: 0,
    burnDps: 0,
    abilityUsed: false,
    splitDepth: options.splitDepth ?? 0,
    abilityTimer: 0,
    dead: false,
  };
  state.enemies.push(enemy);
  state.totalEnemies += 1;
  return enemy;
}

export function plant(
  state: LawnState,
  moduleId: ModuleId,
  lane: number,
  col: number,
): ActionResult {
  if (state.status !== 'running') return { ok: false, reason: 'phase', events: [] };
  if (!inBounds(lane, col)) return { ok: false, reason: 'bounds', events: [] };
  if (state.grid[cellIndex(lane, col)]) return { ok: false, reason: 'occupied', events: [] };
  if (state.recharge[moduleId] > 0) return { ok: false, reason: 'recharge', events: [] };

  const def = MODULES[moduleId];
  if (state.light < def.cost) return { ok: false, reason: 'light', events: [] };

  state.light -= def.cost;
  state.recharge[moduleId] = def.recharge;
  state.grid[cellIndex(lane, col)] = {
    id: nextId(state),
    moduleId,
    lane,
    col,
    health: def.health,
    maxHealth: def.health,
    timer: 0,
    armed: moduleId === 'purge-reed' ? 1.2 : undefined,
  };

  return { ok: true, events: [{ type: 'plant', moduleId, lane, col }] };
}

export function shovel(state: LawnState, lane: number, col: number): ActionResult {
  if (state.status !== 'running') return { ok: false, reason: 'phase', events: [] };
  if (!inBounds(lane, col)) return { ok: false, reason: 'bounds', events: [] };
  const module = state.grid[cellIndex(lane, col)];
  if (!module) return { ok: false, reason: 'empty', events: [] };

  state.grid[cellIndex(lane, col)] = null;
  const refund = Math.floor(MODULES[module.moduleId].cost * 0.5);
  addLight(state, refund);
  return { ok: true, events: [{ type: 'shovel', moduleId: module.moduleId, refund }] };
}

export function collectLight(state: LawnState, tokenId: number): ActionResult {
  if (state.status !== 'running') return { ok: false, reason: 'phase', events: [] };
  const index = state.tokens.findIndex((token) => token.id === tokenId);
  if (index < 0) return { ok: false, reason: 'missing', events: [] };
  const [token] = state.tokens.splice(index, 1);
  addLight(state, token.value);
  return { ok: true, events: [{ type: 'light', amount: token.value }] };
}

export function starsFor(state: Pick<LawnState, 'purgesUsed'>): 1 | 2 | 3 {
  if (state.purgesUsed === 0) return 3;
  if (state.purgesUsed <= 2) return 2;
  return 1;
}

function firstEnemyAhead(state: LawnState, lane: number, minX: number): EnemyState | null {
  let best: EnemyState | null = null;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.lane !== lane || enemy.x < minX) continue;
    if (!best || enemy.x < best.x) best = enemy;
  }
  return best;
}

function enemiesInLane(state: LawnState, lane: number): EnemyState[] {
  return state.enemies.filter((enemy) => !enemy.dead && enemy.lane === lane);
}

function damageEnemy(state: LawnState, enemy: EnemyState, amount: number, events: LawnEvent[]): void {
  if (enemy.dead) return;
  let remaining = amount;
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, remaining);
    enemy.shield -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) enemy.health -= remaining;
  if (enemy.health <= 0) killEnemy(state, enemy, events);
}

function killEnemy(state: LawnState, enemy: EnemyState, events: LawnEvent[]): void {
  if (enemy.dead) return;
  enemy.dead = true;
  state.kills += 1;
  state.score += ENEMIES[enemy.enemyId].score;
  events.push({ type: 'enemy-down', enemyId: enemy.enemyId });

  if (enemy.enemyId === 'splitter' && enemy.splitDepth === 0) {
    const hpScale = 0.5 * (enemy.maxHealth / ENEMIES.splitter.health);
    const speedScale = enemy.speed / ENEMIES.splitter.speed || 1;
    for (const offset of [-0.25, 0.25]) {
      const child = spawnEnemy(state, {
        lane: enemy.lane,
        x: Math.max(0.2, enemy.x + offset),
        enemyId: 'walker',
        hpScale,
        speedScale,
        splitDepth: 1,
      });
      child.slowUntil = enemy.slowUntil;
    }
  }
}

function destroyModule(state: LawnState, lane: number, col: number, events: LawnEvent[]): void {
  const module = state.grid[cellIndex(lane, col)];
  if (!module) return;
  state.grid[cellIndex(lane, col)] = null;
  events.push({ type: 'module-down', moduleId: module.moduleId });
}

function addToken(state: LawnState, lane: number, col: number, source: 'sky' | 'module'): void {
  if (state.tokens.some((token) => token.lane === lane && token.col === col)) return;
  state.tokens.push({
    id: nextId(state),
    lane,
    col,
    value: 25,
    ttl: 9,
    source,
  });
}

function skyToken(state: LawnState): void {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const lane = Math.floor(random(state) * LANES);
    const col = Math.floor(random(state) * COLS);
    if (state.grid[cellIndex(lane, col)]) continue;
    if (state.tokens.some((token) => token.lane === lane && token.col === col)) continue;
    addToken(state, lane, col, 'sky');
    return;
  }
}

function updateModules(state: LawnState, dt: number, events: LawnEvent[]): void {
  for (let index = 0; index < state.grid.length; index += 1) {
    const module = state.grid[index];
    if (!module) continue;
    module.timer -= dt;

    switch (module.moduleId) {
      case 'photofern': {
        if (module.timer <= 0) {
          addToken(state, module.lane, module.col, 'module');
          module.timer = 8;
        }
        break;
      }
      case 'needle-pod': {
        if (module.timer <= 0) {
          const target = firstEnemyAhead(state, module.lane, module.col + 0.6);
          if (target) {
            const x = module.col + 0.85;
            state.projectiles.push({
              id: nextId(state),
              kind: 'needle',
              lane: module.lane,
              x,
              startX: x,
              targetX: target.x,
              maxX: 9.6,
              damage: 20,
              splash: 0,
              speed: 7,
              progress: 0,
              duration: 0,
            });
            module.timer = 1.4;
            events.push({ type: 'shot', kind: 'needle' });
          }
        }
        break;
      }
      case 'burst-bloom': {
        if (module.timer <= 0) {
          const target = firstEnemyAhead(state, module.lane, module.col + 0.6);
          if (target && target.x <= module.col + 2.6) {
            const x = module.col + 0.85;
            state.projectiles.push({
              id: nextId(state),
              kind: 'burst',
              lane: module.lane,
              x,
              startX: x,
              targetX: target.x,
              maxX: x + 2.4,
              damage: 28,
              splash: 0.9,
              speed: 5,
              progress: 0,
              duration: 0,
            });
            module.timer = 2.2;
            events.push({ type: 'shot', kind: 'burst' });
          }
        }
        break;
      }
      case 'frost-cap': {
        if (module.timer <= 0) {
          for (const enemy of enemiesInLane(state, module.lane)) {
            enemy.slowUntil = Math.max(enemy.slowUntil, state.time + 2.4);
          }
          module.timer = 3.2;
        }
        break;
      }
      case 'ember-vine': {
        for (const enemy of enemiesInLane(state, module.lane)) {
          if (enemy.x >= module.col - 0.5 && enemy.x <= module.col + 1.5) {
            enemy.burnUntil = state.time + 1;
            enemy.burnDps = Math.max(enemy.burnDps, 16);
          }
        }
        break;
      }
      case 'mortar-moss': {
        if (module.timer <= 0) {
          const target = firstEnemyAhead(state, module.lane, module.col + 2.5);
          if (target) {
            const startX = module.col + 0.85;
            const distance = Math.abs(target.x - startX);
            state.projectiles.push({
              id: nextId(state),
              kind: 'mortar',
              lane: module.lane,
              x: startX,
              startX,
              targetX: target.x,
              maxX: 9.6,
              damage: 55,
              splash: 1,
              speed: 5,
              progress: 0,
              duration: Math.max(0.4, distance / 5),
            });
            module.timer = 3.4;
            events.push({ type: 'shot', kind: 'mortar' });
          }
        }
        break;
      }
      case 'purge-reed': {
        module.armed = (module.armed ?? 1.2) - dt;
        if (module.armed <= 0) {
          const targets = enemiesInLane(state, module.lane);
          for (const enemy of targets) enemy.dead = true;
          state.grid[index] = null;
          events.push({ type: 'purge-reed', lane: module.lane });
          events.push({ type: 'shot', kind: 'purge-reed' });
        }
        break;
      }
      case 'rind-wall':
      default:
        break;
    }
  }
}

function updateProjectiles(state: LawnState, dt: number, events: LawnEvent[]): void {
  const remaining: Projectile[] = [];

  for (const projectile of state.projectiles) {
    if (projectile.kind === 'mortar') {
      projectile.progress += dt / projectile.duration;
      if (projectile.progress >= 1) {
        const targets = state.enemies.filter(
          (enemy) => !enemy.dead && enemy.lane === projectile.lane && Math.abs(enemy.x - projectile.targetX) <= projectile.splash,
        );
        for (const enemy of targets) damageEnemy(state, enemy, projectile.damage, events);
        continue;
      }
      remaining.push(projectile);
      continue;
    }

    projectile.x += projectile.speed * dt;

    let target: EnemyState | null = null;
    for (const enemy of state.enemies) {
      if (enemy.dead || enemy.lane !== projectile.lane) continue;
      if (enemy.x < projectile.x - 0.4) continue;
      if (Math.abs(enemy.x - projectile.x) > 0.35) continue;
      if (!target || enemy.x < target.x) target = enemy;
    }

    if (target) {
      const hitX = target.x;
      const targets =
        projectile.splash > 0
          ? state.enemies.filter(
              (enemy) => !enemy.dead && enemy.lane === projectile.lane && Math.abs(enemy.x - hitX) <= projectile.splash,
            )
          : [target];
      for (const enemy of targets) damageEnemy(state, enemy, projectile.damage, events);
      continue;
    }

    if (projectile.x <= projectile.maxX) remaining.push(projectile);
  }

  state.projectiles = remaining;
}

function updateEnemies(state: LawnState, dt: number, events: LawnEvent[]): void {
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;

    if (enemy.burnUntil > state.time && enemy.burnDps > 0) {
      enemy.health -= enemy.burnDps * dt;
      if (enemy.health <= 0) {
        killEnemy(state, enemy, events);
        continue;
      }
    }

    if (enemy.enemyId === 'healer') {
      enemy.abilityTimer -= dt;
      if (enemy.abilityTimer <= 0) {
        for (const other of state.enemies) {
          if (other === enemy || other.dead || other.lane !== enemy.lane) continue;
          if (Math.abs(other.x - enemy.x) > 2) continue;
          other.health = Math.min(other.maxHealth, other.health + 18);
        }
        enemy.abilityTimer = 2;
      }
    }

    if (enemy.enemyId === 'ranged') {
      let targetModule: PlantedModule | null = null;
      for (const candidate of state.grid) {
        if (!candidate || candidate.lane !== enemy.lane) continue;
        if (!targetModule || candidate.col > targetModule.col) targetModule = candidate;
      }
      if (targetModule && enemy.x <= targetModule.col + 5) {
        enemy.abilityTimer -= dt;
        if (enemy.abilityTimer <= 0) {
          targetModule.health -= 25;
          enemy.abilityTimer = 2.6;
          events.push({ type: 'shot', kind: 'ranged' });
          if (targetModule.health <= 0) {
            destroyModule(state, targetModule.lane, targetModule.col, events);
          }
        }
        continue;
      }
    }

    const col = Math.floor(enemy.x);
    if (col >= 0 && col < COLS) {
      const module = state.grid[cellIndex(enemy.lane, col)];
      if (module) {
        if (!enemy.abilityUsed && (enemy.enemyId === 'jumper' || enemy.enemyId === 'burrower')) {
          enemy.abilityUsed = true;
          enemy.x = Math.max(0.05, col - 0.15);
          continue;
        }
        module.health -= ENEMIES[enemy.enemyId].eat * dt;
        if (module.health <= 0) destroyModule(state, enemy.lane, col, events);
        continue;
      }
    }

    const factor = enemy.slowUntil > state.time ? SLOW_FACTOR : 1;
    enemy.x -= enemy.speed * factor * dt;
  }
}

function spawnDue(state: LawnState): void {
  while (state.queue.length > 0 && state.queue[0].time <= state.time) {
    const entry = state.queue.shift()!;
    spawnEnemy(state, {
      lane: entry.lane,
      x: 9.05,
      enemyId: entry.enemy,
      hpScale: entry.hpScale,
      speedScale: entry.speedScale,
    });
  }
}

function generateEndlessWave(state: LawnState, events: LawnEvent[]): void {
  if (!state.endless) return;
  const wave = state.endless.wave + 1;
  state.endless.wave = wave;

  const pool: EnemyId[] = ['walker'];
  if (wave >= 2) pool.push('runner');
  if (wave >= 3) pool.push('shielded');
  if (wave >= 4) pool.push('armoured');
  if (wave >= 5) pool.push('jumper');
  if (wave >= 6) pool.push('burrower');
  if (wave >= 7) pool.push('splitter');
  if (wave >= 8) pool.push('healer');
  if (wave >= 9) pool.push('ranged');
  if (wave % 10 === 0) pool.push('boss');

  const count = 3 + Math.floor(wave * 0.8);
  const hpScale = 1 + wave * 0.1;
  const speedScale = Math.min(1.35, 1 + wave * 0.02);
  for (let index = 0; index < count; index += 1) {
    const lane = Math.floor(random(state) * LANES);
    const enemy = pool[Math.floor(random(state) * pool.length)];
    state.queue.push({
      time: state.time + index * Math.max(0.9, 2.2 - wave * 0.05),
      lane,
      enemy,
      hpScale,
      speedScale,
    });
  }

  state.waveStartTimes.push(state.time);
  state.nextWaveIndex = state.waveStartTimes.length;
  state.endless.nextWaveAt = state.time + Math.max(12, 22 - wave * 0.3);
  events.push({ type: 'wave', wave, final: false });
}

export function stepGame(state: LawnState, deltaSeconds: number): LawnEvent[] {
  if (state.status !== 'running') return [];
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.2);
  if (dt <= 0) return [];

  const events: LawnEvent[] = [];
  state.time += dt;

  for (const moduleId of MODULE_ORDER) {
    state.recharge[moduleId] = Math.max(0, state.recharge[moduleId] - dt);
  }

  spawnDue(state);

  if (state.mode === 'endless' && state.endless) {
    if (state.time >= state.endless.nextWaveAt) generateEndlessWave(state, events);
  } else {
    while (state.nextWaveIndex < state.waveStartTimes.length && state.time >= state.waveStartTimes[state.nextWaveIndex]) {
      const wave = state.nextWaveIndex + 1;
      const final = wave === state.waveStartTimes.length;
      if (final) state.finalWave = true;
      events.push({ type: 'wave', wave, final });
      state.nextWaveIndex += 1;
    }
  }

  if (state.time >= state.nextSkyAt) {
    skyToken(state);
    state.nextSkyAt += state.skyInterval;
  }

  state.tokens = state.tokens.filter((token) => {
    token.ttl -= dt;
    return token.ttl > 0;
  });

  updateModules(state, dt, events);
  updateProjectiles(state, dt, events);
  updateEnemies(state, dt, events);

  state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.health > 0);

  const breached = new Set(state.enemies.filter((enemy) => enemy.x <= 0).map((enemy) => enemy.lane));
  for (const lane of breached) {
    if (!state.purges[lane]) continue;
    state.purges[lane] = false;
    state.purgesUsed += 1;
    for (const enemy of state.enemies) {
      if (enemy.lane === lane) enemy.dead = true;
    }
    events.push({ type: 'purge', lane });
  }

  const unpunishedBreach = state.enemies.some((enemy) => !enemy.dead && enemy.x <= 0);
  state.enemies = state.enemies.filter((enemy) => !enemy.dead && enemy.x > 0);

  if (unpunishedBreach) {
    state.status = 'lost';
    events.push({
      type: 'lose',
      score: state.score,
      wave: state.endless ? Math.max(1, state.endless.wave) : Math.max(1, state.nextWaveIndex),
    });
    return events;
  }

  if (
    state.mode === 'campaign' &&
    state.totalEnemies > 0 &&
    state.queue.length === 0 &&
    state.enemies.length === 0 &&
    state.nextWaveIndex >= state.waveStartTimes.length
  ) {
    state.status = 'won';
    events.push({ type: 'win', stars: starsFor(state), score: state.score });
  }

  return events;
}
