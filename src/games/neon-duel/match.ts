export type Side = 'player' | 'rival';

export type MatchPhase = 'intro' | 'fight' | 'roundOver' | 'matchOver';

export interface MatchState {
  round: number;
  wins: Record<Side, number>;
  timerTicks: number;
  roundTicks: number;
  phase: MatchPhase;
  roundWinner: Side | null;
  winner: Side | null;
  bannerTicks: number;
}

const DEFAULT_ROUND_SECONDS = 60;
const TICKS_PER_SECOND = 60;
const BANNER_TICKS = 90;
const WINS_REQUIRED = 2;

export function createMatchState(roundSeconds = DEFAULT_ROUND_SECONDS): MatchState {
  const roundTicks = Math.max(1, Math.round(roundSeconds * TICKS_PER_SECOND));
  return {
    round: 1,
    wins: { player: 0, rival: 0 },
    timerTicks: roundTicks,
    roundTicks,
    phase: 'intro',
    roundWinner: null,
    winner: null,
    bannerTicks: BANNER_TICKS,
  };
}

export function startRound(state: MatchState, resetTimer = true): MatchState {
  if (state.phase === 'matchOver') return state;
  return {
    ...state,
    round: state.phase === 'intro' ? state.round : state.round + 1,
    phase: 'fight',
    roundWinner: null,
    timerTicks: resetTimer ? state.roundTicks : state.timerTicks,
    bannerTicks: 0,
  };
}

export function tickTimer(state: MatchState): MatchState {
  if (state.phase !== 'fight') return state;
  return { ...state, timerTicks: Math.max(0, state.timerTicks - 1) };
}

export function finishRound(state: MatchState, winner: Side | null): MatchState {
  if (state.phase !== 'fight') return state;

  const wins = { ...state.wins };
  if (winner === 'player') wins.player += 1;
  else if (winner === 'rival') wins.rival += 1;

  const matchOver = wins.player >= WINS_REQUIRED || wins.rival >= WINS_REQUIRED;
  return {
    ...state,
    wins,
    roundWinner: winner,
    phase: matchOver ? 'matchOver' : 'roundOver',
    winner: matchOver ? (wins.player >= WINS_REQUIRED ? 'player' : 'rival') : null,
    bannerTicks: BANNER_TICKS,
  };
}

export function timeoutWinner(healthA: number, healthB: number): Side | null {
  if (healthA > healthB) return 'player';
  if (healthB > healthA) return 'rival';
  return null;
}

export function nextLadderIndex(current: number, won: boolean, total: number): number {
  if (!won) return Math.max(0, Math.min(current, total - 1));
  return Math.min(total - 1, current + 1);
}
