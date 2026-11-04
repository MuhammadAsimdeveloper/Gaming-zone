export const TACTICS_SIZE = 5;

export type Team = 'player' | 'enemy';
export type TacticsPhase = 'ready' | 'player' | 'enemy' | 'won' | 'lost';

export interface Unit {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  range: number;
}

export interface TacticsState {
  units: Unit[];
  selectedId: string | null;
  turn: number;
  phase: TacticsPhase;
  log: string[];
}

export function createTacticsState(): TacticsState {
  return {
    units: [
      { id: 'vanguard', name: 'Vanguard', team: 'player', x: 0, y: 4, hp: 6, maxHp: 6, atk: 2, range: 1 },
      { id: 'striker', name: 'Striker', team: 'player', x: 2, y: 4, hp: 4, maxHp: 4, atk: 3, range: 1 },
      { id: 'ranger', name: 'Ranger', team: 'player', x: 4, y: 4, hp: 4, maxHp: 4, atk: 2, range: 2 },
      { id: 'drone-a', name: 'Drone', team: 'enemy', x: 4, y: 0, hp: 3, maxHp: 3, atk: 1, range: 1 },
      { id: 'drone-b', name: 'Drone', team: 'enemy', x: 3, y: 0, hp: 3, maxHp: 3, atk: 1, range: 1 },
      { id: 'brute', name: 'Brute', team: 'enemy', x: 4, y: 1, hp: 5, maxHp: 5, atk: 2, range: 1 },
    ],
    selectedId: null,
    turn: 1,
    phase: 'ready',
    log: ['Squad ready. Select a unit, then move or attack.'],
  };
}

export function startTactics(state: TacticsState): TacticsState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'player', log: ['Your turn. Select a unit.'] };
}

export function unitAt(state: TacticsState, x: number, y: number): Unit | undefined {
  return state.units.find((unit) => unit.x === x && unit.y === y);
}

export function distance(a: Unit, b: Unit): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function selectedUnit(state: TacticsState): Unit | undefined {
  return state.units.find((unit) => unit.id === state.selectedId);
}

export function selectUnit(state: TacticsState, id: string): TacticsState {
  if (state.phase !== 'player') return state;
  const unit = state.units.find((entry) => entry.id === id);
  if (!unit || unit.team !== 'player') return state;
  return { ...state, selectedId: id };
}

export function canMoveTo(state: TacticsState, x: number, y: number): boolean {
  const unit = selectedUnit(state);
  if (!unit || state.phase !== 'player') return false;
  if (x < 0 || y < 0 || x >= TACTICS_SIZE || y >= TACTICS_SIZE) return false;
  if (unitAt(state, x, y)) return false;
  return distance(unit, { ...unit, x, y }) <= 1;
}

export function canAttack(state: TacticsState, targetId: string): boolean {
  const unit = selectedUnit(state);
  const target = state.units.find((entry) => entry.id === targetId);
  if (!unit || !target || target.team === 'player' || state.phase !== 'player') return false;
  return distance(unit, target) <= unit.range;
}

export function moveSelected(state: TacticsState, x: number, y: number): TacticsState {
  if (!canMoveTo(state, x, y)) return state;
  const selected = selectedUnit(state)!;
  const units = state.units.map((unit) => (unit.id === selected.id ? { ...unit, x, y } : unit));
  return endPlayerAction({ ...state, units, selectedId: null, log: [`${selected.name} moved.`, ...state.log].slice(0, 5) });
}

export function attackSelected(state: TacticsState, targetId: string): TacticsState {
  if (!canAttack(state, targetId)) return state;
  const attacker = selectedUnit(state)!;
  const target = state.units.find((entry) => entry.id === targetId)!;
  const remaining = target.hp - attacker.atk;
  const units = state.units
    .map((unit) => (unit.id === target.id ? { ...unit, hp: remaining } : unit))
    .filter((unit) => unit.hp > 0);
  const log = [`${attacker.name} hit ${target.name} for ${attacker.atk}.`];
  if (remaining <= 0) log.unshift(`${target.name} destroyed.`);
  return endPlayerAction({ ...state, units, selectedId: null, log: [...log, ...state.log].slice(0, 5) });
}

function enemyAct(state: TacticsState): TacticsState {
  const enemies = state.units.filter((unit) => unit.team === 'enemy');
  const players = state.units.filter((unit) => unit.team === 'player');
  if (enemies.length === 0 || players.length === 0) return state;

  const actor = [...enemies].sort((a, b) => {
    const aDistance = Math.min(...players.map((player) => distance(a, player)));
    const bDistance = Math.min(...players.map((player) => distance(b, player)));
    return aDistance - bDistance;
  })[0]!;
  const target = [...players].sort((a, b) => distance(actor, a) - distance(actor, b))[0]!;

  if (distance(actor, target) <= actor.range) {
    const remaining = target.hp - actor.atk;
    const units = state.units
      .map((unit) => (unit.id === target.id ? { ...unit, hp: remaining } : unit))
      .filter((unit) => unit.hp > 0);
    return {
      ...state,
      units,
      log: [`${actor.name} hit ${target.name} for ${actor.atk}.`, ...state.log].slice(0, 5),
    };
  }

  const candidates: Array<{ x: number; y: number; d: number }> = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = actor.x + dx;
    const y = actor.y + dy;
    if (x < 0 || y < 0 || x >= TACTICS_SIZE || y >= TACTICS_SIZE) continue;
    if (unitAt(state, x, y)) continue;
    candidates.push({ x, y, d: Math.abs(x - target.x) + Math.abs(y - target.y) });
  }
  candidates.sort((a, b) => a.d - b.d);
  if (candidates.length === 0) return { ...state, log: [`${actor.name} is blocked.`, ...state.log].slice(0, 5) };

  const step = candidates[0]!;
  return {
    ...state,
    units: state.units.map((unit) => (unit.id === actor.id ? { ...unit, x: step.x, y: step.y } : unit)),
    log: [`${actor.name} closed in.`, ...state.log].slice(0, 5),
  };
}

function endPlayerAction(state: TacticsState): TacticsState {
  const enemies = state.units.filter((unit) => unit.team === 'enemy');
  if (enemies.length === 0) {
    return { ...state, phase: 'won', log: ['Sector secured.', ...state.log].slice(0, 5) };
  }

  const afterEnemy = enemyAct(state);
  const players = afterEnemy.units.filter((unit) => unit.team === 'player');
  if (players.length === 0) {
    return { ...afterEnemy, phase: 'lost', log: ['Squad wiped.', ...afterEnemy.log].slice(0, 5) };
  }

  return { ...afterEnemy, phase: 'player', turn: state.turn + 1, log: ['Your turn.', ...afterEnemy.log].slice(0, 5) };
}

export function tacticsScore(state: TacticsState): number {
  if (state.phase !== 'won') return 0;
  return Math.max(10, 100 - state.turn * 2);
}
