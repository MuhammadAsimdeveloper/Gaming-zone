import { describe, expect, it } from 'vitest';
import {
  beginBall,
  completeBall,
  controlFor,
  createSession,
  nextBall,
  usesFielders,
} from './session';
import { DOT_BALL } from './types';

const SETUP = { format: 'super-over' as const, playerTeamId: 'harbour-row', cpuTeamId: 'tidewalk' };

function dot(overrides = {}) {
  return { ...DOT_BALL, ...overrides };
}

describe('street cricket session', () => {
  it('starts ready with the player batting in a super over', () => {
    const session = createSession(SETUP);
    expect(session.phase).toBe('ready');
    expect(session.control).toBe('bat');
    expect(usesFielders(session)).toBe(true);
  });

  it('refuses to complete a ball that was never started', () => {
    const session = createSession(SETUP);
    const report = completeBall(session, dot());
    expect(report.events).toEqual([]);
    expect(session.phase).toBe('ready');
  });

  it('records a completed ball and waits before the next one', () => {
    const session = createSession(SETUP);
    expect(beginBall(session)).toBe(true);
    const report = completeBall(session, dot({ batRuns: 6, boundary: 6, note: 'Six!' }));
    expect(report.matchEnded).toBe(false);
    expect(session.phase).toBe('result');
    expect(report.message).toMatch(/six/i);
    expect(session.match.innings[0]!.runs).toBe(6);
    expect(session.match.innings[0]!.sixes).toBe(1);
    nextBall(session);
    expect(session.phase).toBe('ready');
  });

  it('hands over to the player bowling after six balls', () => {
    const session = createSession(SETUP);
    for (let index = 0; index < 6; index += 1) {
      beginBall(session);
      const report = completeBall(session, dot({ batRuns: 2, note: 'Two.' }));
      if (index < 5) nextBall(session);
      else {
        expect(report.inningsChanged).toBe(true);
        expect(report.control).toBe('bowl');
      }
    }
    expect(session.match.current).toBe(1);
    expect(session.control).toBe('bowl');
    expect(session.match.innings[1]!.target).toBe(13);
  });

  it('finishes with a win when the CPU falls short', () => {
    const session = createSession(SETUP);
    for (let index = 0; index < 6; index += 1) {
      beginBall(session);
      completeBall(session, dot({ batRuns: 4 }));
      if (session.phase === 'result') nextBall(session);
    }
    for (let index = 0; index < 6; index += 1) {
      beginBall(session);
      const report = completeBall(session, dot({ batRuns: 1 }));
      if (session.phase === 'result') nextBall(session);
      if (report.matchEnded) break;
    }
    expect(session.match.result?.outcome).toBe('win');
    expect(session.phase).toBe('finished');
  });

  it('keeps the player batting throughout a rooftop chase', () => {
    const session = createSession({ ...SETUP, format: 'rooftop-chase', target: 40 });
    expect(session.control).toBe('bat');
    for (let index = 0; index < 30; index += 1) {
      beginBall(session);
      const report = completeBall(session, dot({ batRuns: 2 }));
      if (report.matchEnded) break;
      nextBall(session);
    }
    expect(session.match.result).not.toBeNull();
    expect(session.phase).toBe('finished');
    expect(session.control).toBe('bat');
  });

  it('turns off fielders for nets', () => {
    const session = createSession({ ...SETUP, format: 'nets' });
    expect(usesFielders(session)).toBe(false);
    expect(controlFor(session.match)).toBe('bat');
  });
});
