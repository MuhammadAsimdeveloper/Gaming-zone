import { describe, expect, it } from 'vitest';
import {
  applyBall,
  createMatch,
  currentInnings,
  formatConfig,
  oversLabel,
  rollChaseTarget,
} from './rules';
import { DOT_BALL, type BallOutcome } from './types';

function ball(overrides: Partial<BallOutcome> = {}): BallOutcome {
  return { ...DOT_BALL, ...overrides };
}

describe('street cricket match rules', () => {
  it('opens the chase after the first super over innings', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    for (let index = 0; index < 6; index += 1) {
      applyBall(match, ball({ batRuns: 1 }));
    }

    expect(match.innings[0]?.closed).toBe(true);
    expect(match.current).toBe(1);
    expect(currentInnings(match).target).toBe(7);
    expect(match.result).toBeNull();
  });

  it('counts a wide as an extra without consuming a legal ball', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    applyBall(match, ball({ legal: false, extras: 1, timing: 'miss' }));

    expect(currentInnings(match).runs).toBe(1);
    expect(currentInnings(match).extras).toBe(1);
    expect(currentInnings(match).balls).toBe(0);
  });

  it('adds runs and boundary totals to the innings', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    applyBall(match, ball({ batRuns: 6, boundary: 6, timing: 'perfect', note: 'Six!' }));
    applyBall(match, ball({ batRuns: 4, boundary: 4, timing: 'good', note: 'Four!' }));

    const innings = currentInnings(match);
    expect(innings.runs).toBe(10);
    expect(innings.sixes).toBe(1);
    expect(innings.fours).toBe(1);
    expect(innings.balls).toBe(2);
  });

  it('closes the innings when the wicket limit is reached', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    applyBall(match, ball({ wicket: 'bowled', timing: 'miss', note: 'Bowled.' }));
    applyBall(match, ball({ wicket: 'caught', timing: 'edge', note: 'Caught.' }));

    expect(match.innings[0]?.closed).toBe(true);
    expect(match.innings[0]?.wickets).toBe(2);
    expect(match.current).toBe(1);
  });

  it('ends a chase as soon as the target is reached', () => {
    const match = createMatch({
      format: 'rooftop-chase',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
      target: 40,
    });

    for (let index = 0; index < 6; index += 1) {
      applyBall(match, ball({ batRuns: 6, boundary: 6, timing: 'perfect', note: 'Six!' }));
    }
    applyBall(match, ball({ batRuns: 4, boundary: 4, timing: 'good', note: 'Four!' }));

    expect(match.result?.outcome).toBe('win');
    expect(match.result?.playerRuns).toBe(40);
    expect(match.result?.playerBalls).toBe(7);
    expect(match.result?.detail).toContain('23 balls to spare');
  });

  it('ends a failed chase when the overs run out', () => {
    const config = formatConfig('rooftop-chase');
    const match = createMatch({
      format: 'rooftop-chase',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
      target: 40,
    });

    for (let index = 0; index < config.balls; index += 1) {
      applyBall(match, ball());
    }

    expect(match.result?.outcome).toBe('loss');
    expect(match.result?.detail).toContain('40 short');
  });

  it('completes a net session without a chase target', () => {
    const config = formatConfig('nets');
    const match = createMatch({
      format: 'nets',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    for (let index = 0; index < config.balls; index += 1) {
      applyBall(match, ball({ batRuns: 2, timing: 'good', note: 'Two.' }));
    }

    expect(match.result?.outcome).toBe('complete');
    expect(match.result?.playerRuns).toBe(config.balls * 2);
    expect(match.result?.cpuRuns).toBeNull();
  });

  it('starts a new super over when the scores are tied', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    for (let index = 0; index < 6; index += 1) applyBall(match, ball({ batRuns: 1 }));
    for (let index = 0; index < 6; index += 1) applyBall(match, ball({ batRuns: 1 }));

    expect(match.result).toBeNull();
    expect(match.round).toBe(1);
    expect(match.innings).toHaveLength(4);
    expect(match.current).toBe(2);
  });

  it('declares a draw after three tied super overs', () => {
    const match = createMatch({
      format: 'super-over',
      playerTeamId: 'rookies',
      cpuTeamId: 'vipers',
    });

    for (let round = 0; round < 3; round += 1) {
      for (let index = 0; index < 6; index += 1) applyBall(match, ball({ batRuns: 1 }));
      for (let index = 0; index < 6; index += 1) applyBall(match, ball({ batRuns: 1 }));
    }

    expect(match.result?.outcome).toBe('draw');
    expect(match.result?.round).toBe(3);
  });

  it('formats overs using cricket notation', () => {
    expect(oversLabel(0)).toBe('0.0');
    expect(oversLabel(5)).toBe('0.5');
    expect(oversLabel(6)).toBe('1.0');
    expect(oversLabel(29)).toBe('4.5');
  });

  it('rolls chase targets inside the authored band', () => {
    expect(rollChaseTarget(() => 0)).toBe(48);
    expect(rollChaseTarget(() => 0.999)).toBe(69);
  });
});
