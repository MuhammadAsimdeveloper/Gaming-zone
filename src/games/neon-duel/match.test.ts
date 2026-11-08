import { describe, expect, it } from 'vitest';
import {
  createMatchState,
  finishRound,
  nextLadderIndex,
  startRound,
  tickTimer,
  timeoutWinner,
} from './match';

describe('match state', () => {
  it('creates a first round with a sixty second timer and no wins', () => {
    const state = createMatchState();
    expect(state.round).toBe(1);
    expect(state.timerTicks).toBe(3600);
    expect(state.roundTicks).toBe(3600);
    expect(state.phase).toBe('intro');
    expect(state.wins).toEqual({ player: 0, rival: 0 });
    expect(state.roundWinner).toBeNull();
    expect(state.winner).toBeNull();
  });

  it('accepts a custom round length', () => {
    expect(createMatchState(10).timerTicks).toBe(600);
  });

  it('counts the timer down only while fighting and clamps at zero', () => {
    let state = startRound(createMatchState(10));
    expect(state.phase).toBe('fight');
    expect(state.timerTicks).toBe(600);

    state = tickTimer(state);
    expect(state.timerTicks).toBe(599);

    for (let tick = 0; tick < 700; tick += 1) state = tickTimer(state);
    expect(state.timerTicks).toBe(0);
    expect(tickTimer(state).timerTicks).toBe(0);
  });

  it('starts from 3600 ticks by default', () => {
    const state = tickTimer(startRound(createMatchState()));
    expect(state.timerTicks).toBe(3599);
  });

  it('awards a timeout to the fighter with more health', () => {
    expect(timeoutWinner(420, 300)).toBe('player');
    expect(timeoutWinner(200, 500)).toBe('rival');
    expect(timeoutWinner(300, 300)).toBeNull();
  });
});

describe('round flow', () => {
  it('records a round win and moves to the next round', () => {
    let state = startRound(createMatchState());
    state = finishRound(state, 'player');

    expect(state.wins.player).toBe(1);
    expect(state.roundWinner).toBe('player');
    expect(state.phase).toBe('roundOver');
    expect(state.winner).toBeNull();

    state = startRound(state);
    expect(state.round).toBe(2);
    expect(state.phase).toBe('fight');
    expect(state.roundWinner).toBeNull();
  });

  it('ends the match when one side reaches two wins', () => {
    let state = startRound(createMatchState());
    state = finishRound(startRound(finishRound(state, 'player')), 'player');

    expect(state.wins.player).toBe(2);
    expect(state.phase).toBe('matchOver');
    expect(state.winner).toBe('player');
  });

  it('can reach a deciding third round', () => {
    let state = startRound(createMatchState());
    state = finishRound(state, 'player');
    state = finishRound(startRound(state), 'rival');
    expect(state.wins).toEqual({ player: 1, rival: 1 });
    expect(state.phase).toBe('roundOver');

    state = finishRound(startRound(state), 'rival');
    expect(state.round).toBe(3);
    expect(state.wins.rival).toBe(2);
    expect(state.winner).toBe('rival');
  });

  it('awards nothing when a round times out level', () => {
    const state = finishRound(startRound(createMatchState()), null);
    expect(state.wins).toEqual({ player: 0, rival: 0 });
    expect(state.roundWinner).toBeNull();
    expect(state.phase).toBe('roundOver');
  });

  it('ignores extra rounds once the match is over', () => {
    let state = finishRound(startRound(finishRound(startRound(createMatchState()), 'player')), 'player');
    expect(state.phase).toBe('matchOver');

    const unchanged = startRound(state);
    expect(unchanged).toBe(state);
    expect(finishRound(state, 'rival')).toBe(state);
  });

  it('advances the ladder only after a win', () => {
    expect(nextLadderIndex(0, true, 5)).toBe(1);
    expect(nextLadderIndex(2, true, 5)).toBe(3);
    expect(nextLadderIndex(0, false, 5)).toBe(0);
    expect(nextLadderIndex(4, true, 5)).toBe(4);
  });
});
