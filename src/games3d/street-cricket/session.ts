import {
  applyBall,
  createMatch,
  currentInnings,
  type MatchEvent,
  type MatchSetup,
  type MatchState,
} from './rules';
import type { BallOutcome, WicketKind } from './types';

export type SessionPhase = 'ready' | 'running' | 'result' | 'finished';
export type ControlMode = 'bat' | 'bowl';

export interface SessionState {
  match: MatchState;
  phase: SessionPhase;
  control: ControlMode;
  lastMessage: string;
  lastOutcome: BallOutcome | null;
}

export interface BallReport {
  events: MatchEvent[];
  matchEnded: boolean;
  inningsChanged: boolean;
  control: ControlMode;
  message: string;
}

const WICKET_TEXT: Record<WicketKind, string> = {
  bowled: 'bowled',
  caught: 'caught',
  'run-out': 'run out',
  stumped: 'stumped',
};

export function controlFor(match: MatchState): ControlMode {
  return currentInnings(match).teamId === match.playerTeamId ? 'bat' : 'bowl';
}

export function createSession(setup: MatchSetup): SessionState {
  const match = createMatch(setup);
  return {
    match,
    phase: 'ready',
    control: controlFor(match),
    lastMessage:
      setup.format === 'rooftop-chase'
        ? `Chase ${match.innings[0]!.target} to take the rooftop.`
        : setup.format === 'nets'
          ? 'Net session. Find your timing.'
          : 'Super Over. You bat first.',
    lastOutcome: null,
  };
}

export function beginBall(session: SessionState): boolean {
  if (session.phase !== 'ready') return false;
  session.phase = 'running';
  return true;
}

function outcomeMessage(outcome: BallOutcome): string {
  if (outcome.wicket !== null) {
    return `Wicket — ${WICKET_TEXT[outcome.wicket]}! ${outcome.note}`;
  }
  if (outcome.boundary === 6) return `Six! ${outcome.note}`;
  if (outcome.boundary === 4) return `Four! ${outcome.note}`;
  if (outcome.extras > 0) return `${outcome.extras} extra${outcome.extras === 1 ? '' : 's'}. ${outcome.note}`;
  if (outcome.batRuns === 0) return `No run. ${outcome.note}`;
  return `${outcome.batRuns} run${outcome.batRuns === 1 ? '' : 's'}. ${outcome.note}`;
}

export function completeBall(session: SessionState, outcome: BallOutcome): BallReport {
  if (session.phase !== 'running') {
    return {
      events: [],
      matchEnded: session.phase === 'finished',
      inningsChanged: false,
      control: session.control,
      message: session.lastMessage,
    };
  }

  const previousInnings = session.match.current;
  const events = applyBall(session.match, outcome);
  session.lastOutcome = outcome;
  const inningsChanged = session.match.current !== previousInnings;
  const matchEnded = session.match.result !== null;

  session.control = controlFor(session.match);
  let message = outcomeMessage(outcome);

  if (matchEnded && session.match.result) {
    message = `${session.match.result.headline}. ${session.match.result.detail}`;
    session.phase = 'finished';
  } else if (inningsChanged) {
    if (session.control === 'bowl') {
      const target = currentInnings(session.match).target ?? 0;
      message = `${message} You made ${target - 1}. Defend ${target} on the rooftop.`;
    } else {
      message = `${message} Level after super over ${session.match.round + 1}. Bat again.`;
    }
    session.phase = 'result';
  } else {
    session.phase = 'result';
  }

  session.lastMessage = message;
  return { events, matchEnded, inningsChanged, control: session.control, message };
}

export function nextBall(session: SessionState): void {
  if (session.phase === 'result') session.phase = 'ready';
}

export function usesFielders(session: SessionState): boolean {
  return session.match.format !== 'nets';
}
