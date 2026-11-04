import { describe, expect, it } from 'vitest';
import {
  attackSelected,
  canAttack,
  canMoveTo,
  createTacticsState,
  distance,
  moveSelected,
  selectUnit,
  startTactics,
  tacticsScore,
  unitAt,
} from './simulation';

function playing() {
  return startTactics(createTacticsState());
}

describe('Rift Tactics simulation', () => {
  it('sets up three players against three enemies', () => {
    const state = createTacticsState();
    expect(state.units).toHaveLength(6);
    expect(state.phase).toBe('ready');
    expect(unitAt(state, 0, 4)?.team).toBe('player');
  });

  it('starts once and selects a player unit', () => {
    const state = playing();
    expect(state.phase).toBe('player');
    const selected = selectUnit(state, 'vanguard');
    expect(selected.selectedId).toBe('vanguard');
    expect(selectUnit(state, 'drone-a')).toBe(state);
  });

  it('moves a selected unit one square and ends the turn', () => {
    const state = selectUnit(playing(), 'vanguard');
    expect(canMoveTo(state, 0, 3)).toBe(true);
    expect(canMoveTo(state, 0, 2)).toBe(false);

    const moved = moveSelected(state, 0, 3);
    expect(unitAt(moved, 0, 3)?.id).toBe('vanguard');
    expect(moved.phase).toBe('player');
    expect(moved.turn).toBe(2);
  });

  it('attacks an enemy in range and damages it', () => {
    const state = selectUnit(playing(), 'striker');
    expect(canAttack(state, 'drone-b')).toBe(false);

    const adjacent = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'striker' ? { ...unit, x: 3, y: 1 } : unit,
      ),
    };
    const targetHp = adjacent.units.find((unit) => unit.id === 'brute')!.hp;
    expect(canAttack(adjacent, 'brute')).toBe(true);

    const attacked = attackSelected(adjacent, 'brute');
    const brute = attacked.units.find((unit) => unit.id === 'brute');
    expect(brute?.hp).toBe(targetHp - 3);
  });

  it('computes Manhattan distance', () => {
    const state = createTacticsState();
    const vanguard = state.units.find((unit) => unit.id === 'vanguard')!;
    const brute = state.units.find((unit) => unit.id === 'brute')!;
    expect(distance(vanguard, brute)).toBe(7);
  });

  it('gives the enemy a turn after a player action', () => {
    const state = selectUnit(playing(), 'vanguard');
    const moved = moveSelected(state, 0, 3);
    expect(moved.turn).toBe(2);
    expect(moved.phase).toBe('player');
  });

  it('scores a win by turns remaining', () => {
    const state = { ...playing(), phase: 'won' as const, turn: 8 };
    expect(tacticsScore(state)).toBe(84);
  });

  it('does not score an unfinished game', () => {
    expect(tacticsScore(playing())).toBe(0);
  });

  it('rejects moves outside the board', () => {
    const state = selectUnit(playing(), 'ranger');
    expect(canMoveTo(state, -1, 4)).toBe(false);
    expect(canMoveTo(state, 5, 4)).toBe(false);
  });
});
