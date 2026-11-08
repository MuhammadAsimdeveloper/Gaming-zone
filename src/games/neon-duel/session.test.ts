import { describe, expect, it } from 'vitest';
import { DuelSession } from './session';
import { neutralInput } from './combat';

function run(session: DuelSession, ticks: number, input = neutralInput()): void {
  for (let tick = 0; tick < ticks; tick += 1) session.step(input);
}

describe('DuelSession', () => {
  it('counts down before the first round starts', () => {
    const session = new DuelSession({ player: 'volt', rival: 'kestrel', tier: 'rookie', seed: 7 });
    expect(session.phase).toBe('intro');

    run(session, 45);
    expect(session.snapshot().banner?.title).toBe('2');

    run(session, 140);
    expect(session.phase).toBe('fight');
    expect(session.snapshot().timerTicks).toBeLessThan(3600);
  });

  it('ends a round when the timer runs out', () => {
    const session = new DuelSession({
      player: 'volt',
      rival: 'volt',
      tier: 'rookie',
      seed: 3,
      roundSeconds: 0.05,
    });

    run(session, 200);

    expect(session.phase).toBe('roundOver');
    expect(session.snapshot().banner?.title).toBe('TIME UP');
    expect(session.snapshot().wins).toEqual({ player: 0, rival: 0 });
  });

  it('awards a round when a fighter is knocked out', () => {
    const session = new DuelSession({ player: 'kestrel', rival: 'volt', tier: 'rookie', seed: 11 });
    const pressure = { ...neutralInput(), light: true, right: true };

    for (let tick = 0; tick < 9000 && session.phase !== 'matchOver'; tick += 1) {
      session.step(pressure);
    }

    const { wins } = session.snapshot();
    expect(wins.player + wins.rival).toBeGreaterThan(0);
  });

  it('training keeps going after a knockout instead of ending the match', () => {
    const session = new DuelSession({
      player: 'mako',
      rival: 'volt',
      tier: 'rookie',
      seed: 5,
      training: true,
    });
    const pressure = { ...neutralInput(), heavy: true, right: true };

    let sawRoundOver = false;
    for (let tick = 0; tick < 9000; tick += 1) {
      session.step(pressure);
      if (session.phase === 'roundOver') sawRoundOver = true;
      expect(session.phase).not.toBe('matchOver');
    }

    expect(sawRoundOver).toBe(true);
    expect(session.phase).not.toBe('matchOver');
  });
});
