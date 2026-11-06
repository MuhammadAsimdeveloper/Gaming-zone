import type { BallOutcome } from './types';

export type MatchFormat = 'super-over' | 'rooftop-chase' | 'nets';
export type MatchOutcome = 'win' | 'loss' | 'draw' | 'complete';
export type MatchEvent = 'ball' | 'wicket' | 'boundary' | 'extra' | 'innings-end' | 'match-end';
export type Rng = () => number;

export interface FormatConfig {
  label: string;
  balls: number;
  wickets: number;
}

export const FORMAT_CONFIG: Record<MatchFormat, FormatConfig> = {
  'super-over': { label: 'Super Over', balls: 6, wickets: 2 },
  'rooftop-chase': { label: 'Rooftop Chase', balls: 30, wickets: 6 },
  nets: { label: 'Nets', balls: 18, wickets: 3 },
};

export const MAX_SUPER_OVERS = 3;
export const CHASE_TARGET_MIN = 48;
export const CHASE_TARGET_BAND = 22;

export interface InningsState {
  teamId: string;
  runs: number;
  wickets: number;
  balls: number;
  fours: number;
  sixes: number;
  extras: number;
  target: number | null;
  log: BallOutcome[];
  closed: boolean;
}

export interface MatchResult {
  outcome: MatchOutcome;
  headline: string;
  detail: string;
  playerRuns: number;
  playerWickets: number;
  playerBalls: number;
  cpuRuns: number | null;
  cpuWickets: number | null;
  cpuBalls: number | null;
  round: number;
}

export interface MatchState {
  format: MatchFormat;
  playerTeamId: string;
  cpuTeamId: string;
  playerBatsFirst: boolean;
  rounds: number;
  round: number;
  current: number;
  innings: InningsState[];
  result: MatchResult | null;
}

export interface MatchSetup {
  format: MatchFormat;
  playerTeamId: string;
  cpuTeamId: string;
  target?: number;
  rng?: Rng;
}

function createInnings(teamId: string, target: number | null): InningsState {
  return {
    teamId,
    runs: 0,
    wickets: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    extras: 0,
    target,
    log: [],
    closed: false,
  };
}

export function formatConfig(format: MatchFormat): FormatConfig {
  return FORMAT_CONFIG[format];
}

export function rollChaseTarget(rng: Rng = Math.random): number {
  const roll = Math.min(0.999, Math.max(0, Number.isFinite(rng()) ? rng() : 0));
  return CHASE_TARGET_MIN + Math.floor(roll * CHASE_TARGET_BAND);
}

export function createMatch(setup: MatchSetup): MatchState {
  const config = formatConfig(setup.format);
  const target = setup.format === 'rooftop-chase' ? (setup.target ?? rollChaseTarget(setup.rng)) : null;
  const innings =
    setup.format === 'super-over'
      ? [createInnings(setup.playerTeamId, null), createInnings(setup.cpuTeamId, null)]
      : [createInnings(setup.playerTeamId, target)];

  return {
    format: setup.format,
    playerTeamId: setup.playerTeamId,
    cpuTeamId: setup.cpuTeamId,
    playerBatsFirst: true,
    rounds: config.balls,
    round: 0,
    current: 0,
    innings,
    result: null,
  };
}

export function currentInnings(match: MatchState): InningsState {
  return match.innings[match.current]!;
}

export function oversLabel(balls: number): string {
  const safe = Math.max(0, Math.floor(balls));
  return `${Math.floor(safe / 6)}.${safe % 6}`;
}

export function ballsRemaining(match: MatchState): number {
  const config = formatConfig(match.format);
  return Math.max(0, config.balls - currentInnings(match).balls);
}

export function runsRequired(match: MatchState): number | null {
  const innings = currentInnings(match);
  if (innings.target === null) return null;
  return Math.max(0, innings.target - innings.runs);
}

function playerInnings(match: MatchState): InningsState {
  for (let index = match.innings.length - 1; index >= 0; index -= 1) {
    const innings = match.innings[index]!;
    if (innings.teamId === match.playerTeamId) return innings;
  }
  return match.innings[0]!;
}

function cpuInnings(match: MatchState): InningsState | null {
  for (let index = match.innings.length - 1; index >= 0; index -= 1) {
    const innings = match.innings[index]!;
    if (innings.teamId === match.cpuTeamId) return innings;
  }
  return null;
}

function finalize(match: MatchState, result: MatchResult, events: MatchEvent[]): void {
  match.result = result;
  events.push('match-end');
}

function closeSuperOverRound(match: MatchState, events: MatchEvent[]): void {
  const player = playerInnings(match);
  const cpu = cpuInnings(match);
  if (!cpu) return;
  const playerScore = player.runs;
  const cpuScore = cpu.runs;

  if (playerScore === cpuScore) {
    if (match.round + 1 >= MAX_SUPER_OVERS) {
      finalize(
        match,
        {
          outcome: 'draw',
          headline: 'Three super overs, no winner',
          detail: `Level at ${playerScore} after ${MAX_SUPER_OVERS} super overs.`,
          playerRuns: playerScore,
          playerWickets: player.wickets,
          playerBalls: player.balls,
          cpuRuns: cpuScore,
          cpuWickets: cpu.wickets,
          cpuBalls: cpu.balls,
          round: MAX_SUPER_OVERS,
        },
        events,
      );
      return;
    }

    match.round += 1;
    match.innings.push(
      createInnings(match.playerTeamId, null),
      createInnings(match.cpuTeamId, null),
    );
    match.current = match.innings.length - 2;
    return;
  }

  const won = playerScore > cpuScore;
  finalize(
    match,
    {
      outcome: won ? 'win' : 'loss',
      headline: won ? 'Super Over won' : 'Super Over lost',
      detail: `You ${playerScore}/${player.wickets} · CPU ${cpuScore}/${cpu.wickets}.`,
      playerRuns: playerScore,
      playerWickets: player.wickets,
      playerBalls: player.balls,
      cpuRuns: cpuScore,
      cpuWickets: cpu.wickets,
      cpuBalls: cpu.balls,
      round: match.round + 1,
    },
    events,
  );
}

function closeInnings(match: MatchState, events: MatchEvent[]): void {
  currentInnings(match).closed = true;
  events.push('innings-end');

  if (match.format === 'super-over') {
    if (match.current % 2 === 0) {
      const next = match.current + 1;
      match.innings[next]!.target = match.innings[match.current]!.runs + 1;
      match.current = next;
      return;
    }
    closeSuperOverRound(match, events);
    return;
  }

  const player = playerInnings(match);
  const config = formatConfig(match.format);

  if (match.format === 'rooftop-chase') {
    const target = player.target ?? 0;
    if (player.runs >= target) {
      const remaining = config.balls - player.balls;
      finalize(
        match,
        {
          outcome: 'win',
          headline: 'Chase complete',
          detail: `Reached ${target} with ${remaining} ball${remaining === 1 ? '' : 's'} to spare.`,
          playerRuns: player.runs,
          playerWickets: player.wickets,
          playerBalls: player.balls,
          cpuRuns: target - 1,
          cpuWickets: null,
          cpuBalls: null,
          round: 1,
        },
        events,
      );
      return;
    }
    if (player.runs === target - 1) {
      finalize(
        match,
        {
          outcome: 'draw',
          headline: 'Chase tied',
          detail: `Scores level on ${player.runs} from ${player.balls} balls.`,
          playerRuns: player.runs,
          playerWickets: player.wickets,
          playerBalls: player.balls,
          cpuRuns: target - 1,
          cpuWickets: null,
          cpuBalls: null,
          round: 1,
        },
        events,
      );
      return;
    }
    finalize(
      match,
      {
        outcome: 'loss',
        headline: 'Chase failed',
        detail: `Fell ${target - player.runs} short of ${target}.`,
        playerRuns: player.runs,
        playerWickets: player.wickets,
        playerBalls: player.balls,
        cpuRuns: target - 1,
        cpuWickets: null,
        cpuBalls: null,
        round: 1,
      },
      events,
    );
    return;
  }

  finalize(
    match,
    {
      outcome: 'complete',
      headline: 'Net session complete',
      detail: `${player.runs} runs from ${player.balls} balls with ${player.wickets} wicket${player.wickets === 1 ? '' : 's'} down.`,
      playerRuns: player.runs,
      playerWickets: player.wickets,
      playerBalls: player.balls,
      cpuRuns: null,
      cpuWickets: null,
      cpuBalls: null,
      round: 1,
    },
    events,
  );
}

export function applyBall(match: MatchState, outcome: BallOutcome): MatchEvent[] {
  const events: MatchEvent[] = [];
  if (match.result !== null) return events;

  const innings = currentInnings(match);
  if (innings.closed) return events;

  const config = formatConfig(match.format);
  innings.runs += outcome.batRuns + outcome.extras;
  innings.extras += outcome.extras;
  if (outcome.boundary === 4) innings.fours += 1;
  if (outcome.boundary === 6) innings.sixes += 1;
  if (outcome.wicket !== null) innings.wickets += 1;
  if (outcome.legal) innings.balls += 1;
  innings.log.push(outcome);

  events.push('ball');
  if (outcome.wicket !== null) events.push('wicket');
  if (outcome.boundary !== null) events.push('boundary');
  if (outcome.extras > 0) events.push('extra');

  const targetReached = innings.target !== null && innings.runs >= innings.target;
  const oversDone = innings.balls >= config.balls;
  const wicketsDone = innings.wickets >= config.wickets;

  if (targetReached || oversDone || wicketsDone) closeInnings(match, events);

  return events;
}
