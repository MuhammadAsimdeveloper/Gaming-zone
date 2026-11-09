export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 600;
export const PLAYER_RADIUS = 28;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_SPEED = 240;
export const DASH_SPEED = 620;
export const DASH_TICKS = 12;
export const DASH_COOLDOWN_TICKS = 36;
export const PARRY_WINDOW_TICKS = 10;
export const PARRY_COOLDOWN_TICKS = 40;
export const COMBO_DECAY_TICKS = 180;
export const WAVE_COUNT = 12;
export const TICK_SECONDS = 1 / 60;

export type WeaponId = 'blade' | 'arc' | 'rail' | 'bloom';
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'elite' | 'boss';
export type RunStatus = 'fighting' | 'betweenWaves' | 'won' | 'lost';

export interface WeaponStats {
  damage: number;
  cooldownTicks: number;
  range: number;
  projectileSpeed: number;
  area: number;
}

export interface RunConfig {
  seed: number;
  weapon: WeaponId;
}

export interface RunInput {
  moveX: number;
  moveY: number;
  dash: boolean;
  parry: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  radius: number;
  health: number;
  maxHealth: number;
  facingX: number;
  facingY: number;
  dashTicks: number;
  dashCooldown: number;
  parryTicks: number;
  parryCooldown: number;
  attackCooldown: number;
  weapon: WeaponId;
}

export interface EnemyState {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  radius: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  stunTicks: number;
  phase: number;
  chargeTicks: number;
  fireCooldown: number;
}

export interface ProjectileState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  hostile: boolean;
  life: number;
}

export interface RunState {
  seed: number;
  rng: () => number;
  status: RunStatus;
  wave: number;
  tick: number;
  player: PlayerState;
  weapon: WeaponId;
  weapons: Record<WeaponId, WeaponStats>;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  score: number;
  combo: number;
  comboIdleTicks: number;
  kills: number;
  nextId: number;
  parryWindow: number;
  parryCooldownLength: number;
  dashCooldownLength: number;
  comboDecayTicks: number;
  scoreBonus: number;
}

export const WEAPON_IDS: readonly WeaponId[] = ['blade', 'arc', 'rail', 'bloom'];

export const BASE_WEAPONS: Record<WeaponId, WeaponStats> = {
  blade: { damage: 30, cooldownTicks: 16, range: 130, projectileSpeed: 900, area: 55 },
  arc: { damage: 18, cooldownTicks: 22, range: 280, projectileSpeed: 620, area: 45 },
  rail: { damage: 48, cooldownTicks: 40, range: 460, projectileSpeed: 1400, area: 0 },
  bloom: { damage: 22, cooldownTicks: 28, range: 210, projectileSpeed: 480, area: 95 },
};

interface EnemyProfile {
  health: number;
  speed: number;
  radius: number;
  damage: number;
  value: number;
}

const ENEMY_PROFILES: Record<EnemyKind, EnemyProfile> = {
  grunt: { health: 40, speed: 70, radius: 16, damage: 8, value: 1 },
  runner: { health: 26, speed: 130, radius: 13, damage: 6, value: 1 },
  brute: { health: 110, speed: 45, radius: 22, damage: 14, value: 2 },
  elite: { health: 80, speed: 62, radius: 19, damage: 12, value: 3 },
  boss: { health: 420, speed: 44, radius: 34, damage: 18, value: 10 },
};

export function neutralInput(): RunInput {
  return { moveX: 0, moveY: 0, dash: false, parry: false };
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function cloneWeapons(): Record<WeaponId, WeaponStats> {
  return {
    blade: { ...BASE_WEAPONS.blade },
    arc: { ...BASE_WEAPONS.arc },
    rail: { ...BASE_WEAPONS.rail },
    bloom: { ...BASE_WEAPONS.bloom },
  };
}

function pickAddKind(wave: number, rng: () => number): EnemyKind {
  const roll = rng();
  if (wave >= 4) {
    if (roll < 0.4) return 'grunt';
    if (roll < 0.7) return 'runner';
    if (roll < 0.88) return 'brute';
    return 'elite';
  }
  if (wave === 3) {
    if (roll < 0.55) return 'grunt';
    if (roll < 0.85) return 'runner';
    return 'brute';
  }
  if (wave === 2) return roll < 0.7 ? 'grunt' : 'runner';
  return 'grunt';
}

export function waveComposition(wave: number, seed: number): EnemyKind[] {
  const rng = mulberry32((seed ^ Math.imul(wave + 1, 0x9e3779b1)) >>> 0);
  if (wave === 6 || wave === 12) {
    const adds = 2 + wave;
    const kinds: EnemyKind[] = ['boss'];
    for (let index = 0; index < adds; index += 1) kinds.push(pickAddKind(wave, rng));
    return kinds;
  }
  const count = 3 + wave;
  const kinds: EnemyKind[] = [];
  for (let index = 0; index < count; index += 1) kinds.push(pickAddKind(wave, rng));
  return kinds;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceBetween(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function comboMultiplier(state: RunState): number {
  return 1 + Math.min(4, Math.floor(state.combo / 5) * 0.5) + state.scoreBonus;
}

function createPlayer(weapon: WeaponId): PlayerState {
  return {
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    radius: PLAYER_RADIUS,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    facingX: 1,
    facingY: 0,
    dashTicks: 0,
    dashCooldown: 0,
    parryTicks: 0,
    parryCooldown: 0,
    attackCooldown: 0,
    weapon,
  };
}

function spawnPoint(state: RunState): { x: number; y: number } {
  const inset = 40;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const side = Math.floor(state.rng() * 4);
    const along = state.rng();
    let x: number;
    let y: number;
    if (side === 0) {
      x = inset + along * (ARENA_WIDTH - inset * 2);
      y = inset;
    } else if (side === 1) {
      x = ARENA_WIDTH - inset;
      y = inset + along * (ARENA_HEIGHT - inset * 2);
    } else if (side === 2) {
      x = inset + along * (ARENA_WIDTH - inset * 2);
      y = ARENA_HEIGHT - inset;
    } else {
      x = inset;
      y = inset + along * (ARENA_HEIGHT - inset * 2);
    }
    if (distanceBetween(x, y, state.player.x, state.player.y) >= 240) return { x, y };
  }
  return { x: 60, y: 60 };
}

function createEnemy(kind: EnemyKind, x: number, y: number, id: number): EnemyState {
  const profile = ENEMY_PROFILES[kind];
  return {
    id,
    kind,
    x,
    y,
    health: profile.health,
    maxHealth: profile.health,
    radius: profile.radius,
    speed: profile.speed,
    damage: profile.damage,
    attackCooldown: 0,
    stunTicks: 0,
    phase: 1,
    chargeTicks: 0,
    fireCooldown: kind === 'boss' ? 90 : 150,
  };
}

function spawnWave(state: RunState): void {
  for (const kind of waveComposition(state.wave, state.seed)) {
    const point = spawnPoint(state);
    state.enemies.push(createEnemy(kind, point.x, point.y, state.nextId));
    state.nextId += 1;
  }
}

export function createRun({ seed, weapon }: RunConfig): RunState {
  const state: RunState = {
    seed: seed >>> 0,
    rng: mulberry32(seed >>> 0),
    status: 'fighting',
    wave: 1,
    tick: 0,
    player: createPlayer(weapon),
    weapon,
    weapons: cloneWeapons(),
    enemies: [],
    projectiles: [],
    score: 0,
    combo: 0,
    comboIdleTicks: 0,
    kills: 0,
    nextId: 1,
    parryWindow: PARRY_WINDOW_TICKS,
    parryCooldownLength: PARRY_COOLDOWN_TICKS,
    dashCooldownLength: DASH_COOLDOWN_TICKS,
    comboDecayTicks: COMBO_DECAY_TICKS,
    scoreBonus: 0,
  };
  spawnWave(state);
  return state;
}

export function startNextWave(state: RunState): void {
  if (state.status !== 'betweenWaves') return;
  if (state.wave >= WAVE_COUNT) {
    state.status = 'won';
    return;
  }
  state.wave += 1;
  spawnWave(state);
  state.status = 'fighting';
}

export function nearestEnemy(state: RunState): EnemyState | null {
  let best: EnemyState | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (enemy.health <= 0) continue;
    const distance = distanceBetween(state.player.x, state.player.y, enemy.x, enemy.y);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

function spawnProjectile(
  state: RunState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  hostile: boolean,
): void {
  state.projectiles.push({
    id: state.nextId,
    x,
    y,
    vx,
    vy,
    radius: 6,
    damage,
    hostile,
    life: hostile ? 260 : 240,
  });
  state.nextId += 1;
}

function fireFan(state: RunState, enemy: EnemyState, count: number, spread: number, speed: number): void {
  const player = state.player;
  const aim = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? 0 : (index - (count - 1) / 2) * spread;
    const angle = aim + offset;
    spawnProjectile(state, enemy.x, enemy.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 10, true);
  }
}

function fireRadial(state: RunState, enemy: EnemyState, count: number, speed: number): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    spawnProjectile(state, enemy.x, enemy.y, Math.cos(angle) * speed, Math.sin(angle) * speed, 8, true);
  }
}

function updateBossPhase(state: RunState, enemy: EnemyState): void {
  if (enemy.kind !== 'boss') return;
  const ratio = enemy.health / enemy.maxHealth;
  if (ratio <= 0.6 && enemy.phase < 2) {
    enemy.phase = 2;
    fireRadial(state, enemy, 8, 170);
  }
  if (ratio <= 0.3 && enemy.phase < 3) {
    enemy.phase = 3;
    fireRadial(state, enemy, 12, 200);
  }
}

function applyDamage(state: RunState, enemy: EnemyState, amount: number): void {
  if (enemy.health <= 0) return;
  enemy.health -= amount;
  updateBossPhase(state, enemy);
  if (enemy.health > 0) return;
  enemy.health = 0;
  state.kills += 1;
  state.combo += 1;
  state.comboIdleTicks = 0;
  state.score += Math.round(10 * ENEMY_PROFILES[enemy.kind].value * comboMultiplier(state));
}

function applyPlayerAttack(state: RunState): void {
  const stats = state.weapons[state.weapon];
  const target = nearestEnemy(state);
  if (!target) return;
  if (distanceBetween(state.player.x, state.player.y, target.x, target.y) > stats.range) return;
  state.player.attackCooldown = stats.cooldownTicks;
  applyDamage(state, target, stats.damage);
  if (stats.area <= 0) return;
  for (const enemy of state.enemies) {
    if (enemy === target || enemy.health <= 0) continue;
    if (distanceBetween(target.x, target.y, enemy.x, enemy.y) > stats.area) continue;
    applyDamage(state, enemy, Math.max(1, Math.round(stats.damage * 0.5)));
  }
}

function updateCombo(state: RunState): void {
  if (state.combo <= 0) return;
  state.comboIdleTicks += 1;
  if (state.comboIdleTicks < state.comboDecayTicks) return;
  state.combo = 0;
  state.comboIdleTicks = 0;
}

function stepEnemies(state: RunState): void {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.health <= 0) continue;
    if (enemy.stunTicks > 0) {
      enemy.stunTicks -= 1;
      continue;
    }
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= 1;
    if (enemy.fireCooldown > 0) enemy.fireCooldown -= 1;

    let speed = enemy.speed;
    if (enemy.kind === 'elite') {
      enemy.chargeTicks += 1;
      const cycle = enemy.chargeTicks % 180;
      if (cycle >= 120 && cycle < 150) speed = 0;
      else if (cycle >= 150 && cycle < 170) speed = 320;
    }

    if (enemy.fireCooldown === 0) {
      if (enemy.kind === 'boss') {
        enemy.fireCooldown = 90;
        fireFan(state, enemy, 3, 0.28, 180);
      } else if (enemy.kind === 'elite') {
        enemy.fireCooldown = 150;
        fireFan(state, enemy, 1, 0, 220);
      }
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (speed > 0 && distance > player.radius + enemy.radius) {
      enemy.x += (dx / distance) * speed * TICK_SECONDS;
      enemy.y += (dy / distance) * speed * TICK_SECONDS;
    }

    const contact = distanceBetween(player.x, player.y, enemy.x, enemy.y);
    if (contact <= player.radius + enemy.radius) {
      if (player.parryTicks > 0) {
        enemy.stunTicks = 60;
        const nx = (enemy.x - player.x) / (contact || 1);
        const ny = (enemy.y - player.y) / (contact || 1);
        enemy.x += nx * 70;
        enemy.y += ny * 70;
      } else if (player.dashTicks <= 0 && enemy.attackCooldown <= 0) {
        player.health = Math.max(0, player.health - enemy.damage);
        enemy.attackCooldown = 45;
      }
    }

    enemy.x = clamp(enemy.x, enemy.radius, ARENA_WIDTH - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, ARENA_HEIGHT - enemy.radius);
  }
}

function stepProjectiles(state: RunState): void {
  const player = state.player;
  for (const shot of state.projectiles) {
    if (shot.life <= 0) continue;
    shot.x += shot.vx * TICK_SECONDS;
    shot.y += shot.vy * TICK_SECONDS;
    shot.life -= 1;

    if (shot.x < -40 || shot.x > ARENA_WIDTH + 40 || shot.y < -40 || shot.y > ARENA_HEIGHT + 40) {
      shot.life = 0;
      continue;
    }

    if (shot.hostile) {
      if (distanceBetween(shot.x, shot.y, player.x, player.y) > shot.radius + player.radius) continue;
      if (player.parryTicks > 0) {
        shot.hostile = false;
        shot.vx *= -1.4;
        shot.vy *= -1.4;
        shot.damage *= 2;
        shot.life = 240;
      } else if (player.dashTicks > 0) {
        shot.life = 0;
      } else {
        player.health = Math.max(0, player.health - shot.damage);
        shot.life = 0;
      }
      continue;
    }

    const target = state.enemies.find(
      (enemy) =>
        enemy.health > 0 &&
        distanceBetween(shot.x, shot.y, enemy.x, enemy.y) <= shot.radius + enemy.radius,
    );
    if (!target) continue;
    applyDamage(state, target, shot.damage);
    shot.life = 0;
  }
  state.projectiles = state.projectiles.filter((shot) => shot.life > 0);
}

function stepOnce(state: RunState, input: RunInput): void {
  state.tick += 1;
  updateCombo(state);

  const player = state.player;
  if (player.dashTicks > 0) player.dashTicks -= 1;
  if (player.dashCooldown > 0) player.dashCooldown -= 1;
  if (player.parryTicks > 0) player.parryTicks -= 1;
  if (player.parryCooldown > 0) player.parryCooldown -= 1;
  if (player.attackCooldown > 0) player.attackCooldown -= 1;

  let moveX = input.moveX;
  let moveY = input.moveY;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  if (length > 0.01) {
    const unit = Math.hypot(moveX, moveY);
    player.facingX = moveX / unit;
    player.facingY = moveY / unit;
  }

  if (input.parry && player.parryCooldown <= 0) {
    player.parryTicks = state.parryWindow;
    player.parryCooldown = state.parryCooldownLength;
  }
  if (input.dash && player.dashCooldown <= 0 && player.dashTicks <= 0) {
    player.dashTicks = DASH_TICKS;
    player.dashCooldown = state.dashCooldownLength;
  }

  const speed = player.dashTicks > 0 ? DASH_SPEED : PLAYER_SPEED;
  const directionX = player.dashTicks > 0 ? player.facingX : moveX;
  const directionY = player.dashTicks > 0 ? player.facingY : moveY;
  player.x = clamp(player.x + directionX * speed * TICK_SECONDS, player.radius, ARENA_WIDTH - player.radius);
  player.y = clamp(player.y + directionY * speed * TICK_SECONDS, player.radius, ARENA_HEIGHT - player.radius);

  stepEnemies(state);
  stepProjectiles(state);

  if (player.attackCooldown <= 0) applyPlayerAttack(state);

  state.enemies = state.enemies.filter((enemy) => enemy.health > 0);

  if (player.health <= 0) {
    state.status = 'lost';
    return;
  }
  if (state.enemies.length > 0) return;
  state.status = state.wave >= WAVE_COUNT ? 'won' : 'betweenWaves';
}

export function stepRun(state: RunState, input: RunInput, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) {
    if (state.status !== 'fighting') return;
    stepOnce(state, input);
  }
}
