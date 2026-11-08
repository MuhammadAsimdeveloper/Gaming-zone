import { FIGHTERS, type FighterId, type FighterSpec, type MoveId, type MoveSpec } from './fighters';

export interface CombatInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  block: boolean;
  dash: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
}

export function neutralInput(): CombatInput {
  return {
    left: false,
    right: false,
    jump: false,
    block: false,
    dash: false,
    light: false,
    heavy: false,
    special: false,
  };
}

export type FighterAction =
  | { kind: 'idle' }
  | { kind: 'move' }
  | { kind: 'jump' }
  | { kind: 'block' }
  | { kind: 'dash' }
  | { kind: 'attack'; move: MoveId; frame: number; hasHit: boolean };

export interface FighterState {
  id: FighterId;
  x: number;
  y: number;
  facing: 1 | -1;
  health: number;
  meter: number;
  action: FighterAction;
  vx: number;
  vy: number;
  onGround: boolean;
  hitstop: number;
  blockStun: number;
  hitstun: number;
  invuln: number;
  dashCooldown: number;
  comboHits: number;
}

export interface CombatEvent {
  type: 'hit' | 'block' | 'ko' | 'special' | 'land';
  x: number;
  y: number;
  amount: number;
}

export const MAX_METER = 100;
export const SPECIAL_COST = 50;

const DT = 1 / 60;
const GRAVITY = 26;
const AIR_EVADE_HEIGHT = 0.9;
const HITSTUN_TICKS = 8;
const BLOCKSTUN_TICKS = 7;
const DASH_COOLDOWN_TICKS = 30;
const AIR_CONTROL = 0.6;
const GROUND_FRICTION = 0.82;

interface Advanced {
  state: FighterState;
  live: MoveSpec | null;
}

function specFor(state: FighterState): FighterSpec {
  return FIGHTERS[state.id];
}

export function createFighterState(spec: FighterSpec, x: number, facing: 1 | -1): FighterState {
  return {
    id: spec.id,
    x,
    y: 0,
    facing,
    health: spec.maxHealth,
    meter: 0,
    action: { kind: 'idle' },
    vx: 0,
    vy: 0,
    onGround: true,
    hitstop: 0,
    blockStun: 0,
    hitstun: 0,
    invuln: 0,
    dashCooldown: 0,
    comboHits: 0,
  };
}

function tickTimers(state: FighterState): FighterState {
  return {
    ...state,
    hitstop: Math.max(0, state.hitstop - 1),
    blockStun: Math.max(0, state.blockStun - 1),
    hitstun: Math.max(0, state.hitstun - 1),
    invuln: Math.max(0, state.invuln - 1),
    dashCooldown: Math.max(0, state.dashCooldown - 1),
  };
}

function faceOpponent(self: FighterState, opponent: FighterState): FighterState {
  if (self.action.kind === 'attack' || self.hitstun > 0) return self;
  const facing: 1 | -1 = opponent.x >= self.x ? 1 : -1;
  return facing === self.facing ? self : { ...self, facing };
}

function beginAttack(
  self: FighterState,
  move: MoveId,
  events: CombatEvent[],
): Advanced {
  let meter = self.meter;
  if (move === 'special') {
    if (meter < SPECIAL_COST) return { state: self, live: null };
    meter -= SPECIAL_COST;
    events.push({ type: 'special', x: self.x, y: self.y, amount: SPECIAL_COST });
  }
  return {
    state: {
      ...self,
      meter,
      vx: 0,
      action: { kind: 'attack', move, frame: 0, hasHit: false },
    },
    live: null,
  };
}

function advanceFighter(
  self: FighterState,
  input: CombatInput,
  events: CombatEvent[],
): Advanced {
  const spec = specFor(self);

  if (self.hitstun > 0) {
    return { state: { ...self, action: { kind: 'idle' } }, live: null };
  }

  if (self.blockStun > 0) {
    return {
      state: {
        ...self,
        action: input.block && self.onGround ? { kind: 'block' } : { kind: 'idle' },
        vx: self.onGround ? self.vx * GROUND_FRICTION : self.vx,
      },
      live: null,
    };
  }

  if (self.action.kind === 'attack') {
    const attack = self.action;
    const move = spec.moves[attack.move];

    if (attack.hasHit) {
      if (input.heavy && move.cancelInto.includes('heavy')) {
        return beginAttack(self, 'heavy', events);
      }
      if (input.special && move.cancelInto.includes('special') && self.meter >= SPECIAL_COST) {
        return beginAttack(self, 'special', events);
      }
    }

    const nextFrame = attack.frame + 1;
    const total = move.startup + move.active + move.recovery;
    if (nextFrame >= total) {
      return { state: { ...self, action: { kind: 'idle' }, vx: 0 }, live: null };
    }

    const liveWindow =
      nextFrame >= move.startup &&
      nextFrame < move.startup + move.active &&
      !attack.hasHit;
    return {
      state: { ...self, action: { ...attack, frame: nextFrame }, vx: 0 },
      live: liveWindow ? move : null,
    };
  }

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (!self.onGround) {
    return {
      state: { ...self, action: { kind: 'jump' }, vx: direction * spec.walkSpeed * AIR_CONTROL },
      live: null,
    };
  }

  if (input.special && self.meter >= SPECIAL_COST) return beginAttack(self, 'special', events);
  if (input.light) return beginAttack(self, 'light', events);
  if (input.heavy) return beginAttack(self, 'heavy', events);

  if (input.jump) {
    return {
      state: {
        ...self,
        onGround: false,
        vy: spec.jumpSpeed,
        action: { kind: 'jump' },
        vx: direction * spec.walkSpeed,
      },
      live: null,
    };
  }

  if (input.block) {
    return { state: { ...self, action: { kind: 'block' }, vx: 0 }, live: null };
  }

  if (input.dash && self.dashCooldown <= 0) {
    return {
      state: {
        ...self,
        action: { kind: 'dash' },
        vx: self.facing * spec.dashSpeed,
        dashCooldown: DASH_COOLDOWN_TICKS,
      },
      live: null,
    };
  }

  if (direction !== 0) {
    return {
      state: { ...self, action: { kind: 'move' }, vx: direction * spec.walkSpeed },
      live: null,
    };
  }

  return { state: { ...self, action: { kind: 'idle' }, vx: 0 }, live: null };
}

function integrate(state: FighterState): { state: FighterState; landed: boolean } {
  let { x, y, vx, vy, onGround } = state;
  x += vx * DT;
  let landed = false;

  if (!onGround) {
    vy -= GRAVITY * DT;
    y += vy * DT;
    if (y <= 0) {
      y = 0;
      vy = 0;
      onGround = true;
      landed = true;
    }
  } else if (state.action.kind !== 'move' && state.action.kind !== 'dash') {
    vx *= GROUND_FRICTION;
    if (Math.abs(vx) < 0.05) vx = 0;
  }

  return { state: { ...state, x, y, vx, vy, onGround }, landed };
}

function clampToArena(state: FighterState, arena: { minX: number; maxX: number }): FighterState {
  if (state.x < arena.minX) {
    return { ...state, x: arena.minX, vx: Math.max(0, state.vx) };
  }
  if (state.x > arena.maxX) {
    return { ...state, x: arena.maxX, vx: Math.min(0, state.vx) };
  }
  return state;
}

function canConnect(attacker: FighterState, defender: FighterState, move: MoveSpec): boolean {
  if (defender.invuln > 0) return false;
  if (defender.y > AIR_EVADE_HEIGHT) return false;

  const halfWidth = FIGHTERS[defender.id].hurtboxWidth / 2;
  const forward = (defender.x - attacker.x) * attacker.facing;
  return forward >= -halfWidth && forward <= move.reach + halfWidth;
}

export function stepCombat(
  aStart: FighterState,
  bStart: FighterState,
  inputA: CombatInput,
  inputB: CombatInput,
  arena: { minX: number; maxX: number },
): { a: FighterState; b: FighterState; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  const frozen = aStart.hitstop > 0 || bStart.hitstop > 0;

  let a = tickTimers(aStart);
  let b = tickTimers(bStart);
  if (frozen) return { a, b, events };

  a = faceOpponent(a, b);
  b = faceOpponent(b, a);

  const advancedA = advanceFighter(a, inputA, events);
  const advancedB = advanceFighter(b, inputB, events);

  const integratedA = integrate(advancedA.state);
  const integratedB = integrate(advancedB.state);
  a = integratedA.state;
  b = integratedB.state;
  if (integratedA.landed) events.push({ type: 'land', x: a.x, y: 0, amount: 0 });
  if (integratedB.landed) events.push({ type: 'land', x: b.x, y: 0, amount: 0 });

  a = clampToArena(a, arena);
  b = clampToArena(b, arena);

  const pending: Array<{ side: 'a' | 'b'; move: MoveSpec }> = [];
  if (advancedA.live) pending.push({ side: 'a', move: advancedA.live });
  if (advancedB.live) pending.push({ side: 'b', move: advancedB.live });

  if (pending.length > 0) {
    const snapshotA = a;
    const snapshotB = b;
    const connects = pending.map((entry) => {
      const attacker = entry.side === 'a' ? snapshotA : snapshotB;
      const defender = entry.side === 'a' ? snapshotB : snapshotA;
      return {
        ...entry,
        connects: canConnect(attacker, defender, entry.move),
        blocked: defender.action.kind === 'block',
      };
    });

    for (const result of connects) {
      if (!result.connects) continue;
      let attacker = result.side === 'a' ? a : b;
      let defender = result.side === 'a' ? b : a;
      const wasAlive = defender.health > 0;
      const wasInHitstun = defender.hitstun > 0;

      if (result.blocked) {
        defender = {
          ...defender,
          health: Math.max(0, defender.health - result.move.chip),
          blockStun: BLOCKSTUN_TICKS,
          comboHits: 0,
        };
        attacker = {
          ...attacker,
          meter: Math.min(MAX_METER, attacker.meter + result.move.meterGainBlock),
        };
        events.push({ type: 'block', x: defender.x, y: defender.y, amount: result.move.chip });
      } else {
        defender = {
          ...defender,
          health: Math.max(0, defender.health - result.move.damage),
          hitstun: HITSTUN_TICKS,
          hitstop: result.move.hitstop,
          action: { kind: 'idle' },
          vx: attacker.facing * result.move.knockback,
          comboHits: 0,
        };
        attacker = {
          ...attacker,
          hitstop: result.move.hitstop,
          meter: Math.min(MAX_METER, attacker.meter + result.move.meterGainHit),
          comboHits: wasInHitstun ? attacker.comboHits + 1 : 1,
        };
        events.push({ type: 'hit', x: defender.x, y: defender.y, amount: result.move.damage });
      }

      if (wasAlive && defender.health === 0) {
        events.push({ type: 'ko', x: defender.x, y: defender.y, amount: result.move.damage });
      }

      if (attacker.action.kind === 'attack') {
        attacker = { ...attacker, action: { ...attacker.action, hasHit: true } };
      }

      if (result.side === 'a') {
        a = attacker;
        b = defender;
      } else {
        b = attacker;
        a = defender;
      }
    }
  }

  return { a, b, events };
}
