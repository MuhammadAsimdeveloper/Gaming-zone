import { describe, expect, it } from 'vitest';
import {
  FLIGHT_SECONDS,
  RESULT_SECONDS,
  chooseAiShot,
  chooseKeeperZone,
  createShootout,
  decideWinner,
  dive,
  roundLabel,
  savedCount,
  scoreValue,
  shoot,
  stepShootout,
  zoneAt,
  zonesAdjacent,
  type Rng,
  type ShootoutState,
} from './simulation';

function sequence(values: number[]): Rng {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function settle(state: ShootoutState): void {
  let guard = 0;
  while (state.phase === 'player-flight' || state.phase === 'ai-flight' || state.phase === 'result') {
    stepShootout(state, 0.05);
    guard += 1;
    if (guard > 200) throw new Error('Shootout did not settle');
  }
}

function regulationScores(state: ShootoutState, player: number, ai: number, kicksPlayer = 5, kicksAi = 5) {
  state.scorePlayer = player;
  state.scoreAi = ai;
  state.kicksPlayer = kicksPlayer;
  state.kicksAi = kicksAi;
}

describe('zones', () => {
  it('maps normalized goal coordinates to six zones', () => {
    expect(zoneAt(0.05, 0.1)).toBe(0);
    expect(zoneAt(0.5, 0.2)).toBe(1);
    expect(zoneAt(0.95, 0.4)).toBe(2);
    expect(zoneAt(0.2, 0.8)).toBe(3);
    expect(zoneAt(0.5, 0.9)).toBe(4);
    expect(zoneAt(1, 1)).toBe(5);
  });

  it('treats neighbouring columns and rows as adjacent', () => {
    expect(zonesAdjacent(0, 1)).toBe(true);
    expect(zonesAdjacent(0, 3)).toBe(true);
    expect(zonesAdjacent(0, 4)).toBe(true);
    expect(zonesAdjacent(0, 2)).toBe(false);
    expect(zonesAdjacent(0, 5)).toBe(false);
    expect(zonesAdjacent(2, 2)).toBe(false);
  });
});

describe('penalty resolution', () => {
  it('saves an exact read more often than a wrong dive', () => {
    const state = createShootout('pro');
    const exact = shoot(state, 0, sequence([0, 0]));
    expect(exact?.saved).toBe(true);
    expect(exact?.keeperZone).toBe(0);

    const wide = createShootout('pro');
    const far = shoot(wide, 2, sequence([0, 0.5]));
    expect(far?.saved).toBe(false);
    expect(far?.scored).toBe(true);
  });

  it('applies difficulty save rates for a near miss', () => {
    const casual = createShootout('casual');
    // keeper 0, shot 1 => adjacent; 0.25 is above casual 0.2 but below pro 0.3.
    const casualNear = shoot(casual, 1, sequence([0, 0.25]));
    expect(casualNear?.saved).toBe(false);

    const pro = createShootout('pro');
    const proNear = shoot(pro, 1, sequence([0, 0.25]));
    expect(proNear?.saved).toBe(true);
  });

  it('lets the keeper read the player’s favourite corner', () => {
    const state = createShootout('elite');
    state.history.push({ shooter: 'player', shotZone: 2, keeperZone: 0, saved: false, scored: true, offTarget: false });
    state.history.push({ shooter: 'player', shotZone: 2, keeperZone: 5, saved: false, scored: true, offTarget: false });
    expect(chooseKeeperZone(state, sequence([0]))).toBe(2);
    expect(chooseKeeperZone(state, sequence([0.99, 0.3]))).toBe(1);
  });

  it('weights CPU shots toward the corners', () => {
    const state = createShootout('elite');
    expect(chooseAiShot(state, sequence([0, 0]))).toBe(0);
    expect(chooseAiShot(state, sequence([0.99, 0.6]))).toBe(3);
  });
});

describe('shootout flow', () => {
  it('alternates turns and counts attempts', () => {
    const state = createShootout('pro');
    expect(state.phase).toBe('player-aim');

    shoot(state, 0, sequence([0.99, 0.99]));
    settle(state);
    expect(state.phase).toBe('ai-aim');
    expect(state.kicksPlayer).toBe(1);

    dive(state, 0, sequence([0.99, 0.99, 0.99]));
    settle(state);
    expect(state.phase).toBe('player-aim');
    expect(state.kicksAi).toBe(1);
    expect(state.history).toHaveLength(2);
  });

  it('records CPU misses without awarding a goal', () => {
    const state = createShootout('pro');
    state.phase = 'ai-aim';
    const attempt = dive(state, 2, sequence([0]));
    expect(attempt?.offTarget).toBe(true);
    expect(attempt?.scored).toBe(false);
    expect(state.scoreAi).toBe(0);
    expect(savedCount(state)).toBe(0);
  });

  it('counts a player save and scores it higher', () => {
    const state = createShootout('pro');
    state.phase = 'ai-aim';
    const attempt = dive(state, 0, sequence([0.99, 0, 0]));
    expect(attempt?.saved).toBe(true);
    expect(state.scoreAi).toBe(0);
    expect(savedCount(state)).toBe(1);
    expect(scoreValue(state)).toBe(45);
  });

  it('waits for both sides before deciding regulation', () => {
    const state = createShootout('pro');
    regulationScores(state, 1, 0, 1, 0);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 2, 0, 2, 1);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 3, 0, 3, 2);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 4, 0, 4, 3);
    expect(decideWinner(state)).toBe('player');
  });

  it('requires a sudden-death winner to survive both replies', () => {
    const state = createShootout('pro');
    regulationScores(state, 5, 4, 6, 5);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 5, 5, 6, 6);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 6, 5, 7, 6);
    expect(decideWinner(state)).toBeNull();
    regulationScores(state, 6, 5, 7, 7);
    expect(decideWinner(state)).toBe('player');
  });

  it('plays a full sudden-death shootout to a winner', () => {
    const state = createShootout('pro');
    for (let index = 0; index < 5; index += 1) {
      shoot(state, 0, sequence([0.99, 0.99]));
      settle(state);
      dive(state, 0, sequence([0.99, 0.99]));
      settle(state);
    }
    expect(state.scorePlayer).toBe(5);
    expect(state.scoreAi).toBe(5);
    expect(state.phase).toBe('player-aim');
    expect(roundLabel(state)).toBe('Sudden death');

    shoot(state, 0, sequence([0.99, 0.99]));
    settle(state);
    dive(state, 0, sequence([0.99, 0.99]));
    settle(state);
    expect(state.decided).toBe(false);

    shoot(state, 0, sequence([0.99, 0.99]));
    settle(state);
    dive(state, 2, sequence([0]));
    settle(state);

    expect(state.phase).toBe('over');
    expect(state.winner).toBe('player');
    expect(state.scorePlayer).toBe(7);
    expect(state.scoreAi).toBe(6);
  });

  it('ends early when the lead is mathematically safe', () => {
    const state = createShootout('pro');
    for (let index = 0; index < 2; index += 1) {
      shoot(state, 0, sequence([0.99, 0.99]));
      settle(state);
      dive(state, 2, sequence([0]));
      settle(state);
    }
    expect(state.scorePlayer).toBe(2);
    expect(state.scoreAi).toBe(0);
    expect(state.decided).toBe(false);

    shoot(state, 0, sequence([0.99, 0.99]));
    settle(state);
    expect(state.decided).toBe(false);

    dive(state, 2, sequence([0]));
    settle(state);
    expect(state.scorePlayer).toBe(3);
    expect(state.decided).toBe(true);
    expect(state.winner).toBe('player');
    expect(state.phase).toBe('over');
  });

  it('advances animation timers deterministically', () => {
    const state = createShootout('pro');
    shoot(state, 0, sequence([0.99, 0.99]));
    let elapsed = 0;
    while (state.phase === 'player-flight') {
      stepShootout(state, 0.1);
      elapsed += 0.1;
    }
    expect(elapsed).toBeGreaterThanOrEqual(FLIGHT_SECONDS);
    expect(state.phase).toBe('result');
    expect(state.resultTimer).toBeGreaterThan(0);

    let resultSteps = 0;
    while (state.phase === 'result') {
      stepShootout(state, 0.1);
      resultSteps += 1;
    }
    expect(resultSteps * 0.1).toBeGreaterThanOrEqual(RESULT_SECONDS);
    expect(state.phase).toBe('ai-aim');
  });

  it('ignores shots outside the current turn', () => {
    const state = createShootout('pro');
    state.phase = 'ai-aim';
    expect(shoot(state, 0, sequence([0.99]))).toBeNull();
    state.phase = 'player-aim';
    expect(dive(state, 0, sequence([0.99]))).toBeNull();
  });
});
