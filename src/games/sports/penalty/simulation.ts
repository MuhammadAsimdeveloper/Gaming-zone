export type Zone = 0 | 1 | 2 | 3 | 4 | 5;
export type Shooter = 'player' | 'ai';
export type Difficulty = 'casual' | 'pro' | 'elite';
export type ShootoutPhase = 'player-aim' | 'player-flight' | 'ai-aim' | 'ai-flight' | 'result' | 'over';
export type ShootoutEvent = 'settle' | 'end';

export const REGULATION_KICKS = 5;
export const FLIGHT_SECONDS = 0.62;
export const RESULT_SECONDS = 1.3;

export const ZONE_LABELS = [
  'Top left',
  'Top centre',
  'Top right',
  'Bottom left',
  'Bottom centre',
  'Bottom right',
] as const;

interface DifficultyProfile {
  read: number;
  saveExact: number;
  saveNear: number;
  saveFar: number;
  aiCorner: number;
  aiMiss: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  casual: { read: 0.18, saveExact: 0.7, saveNear: 0.2, saveFar: 0.03, aiCorner: 0.32, aiMiss: 0.14 },
  pro: { read: 0.38, saveExact: 0.85, saveNear: 0.3, saveFar: 0.04, aiCorner: 0.5, aiMiss: 0.08 },
  elite: { read: 0.56, saveExact: 0.93, saveNear: 0.38, saveFar: 0.05, aiCorner: 0.66, aiMiss: 0.04 },
};

export type Rng = () => number;

export interface Attempt {
  shooter: Shooter;
  shotZone: Zone;
  keeperZone: Zone;
  saved: boolean;
  scored: boolean;
  offTarget: boolean;
}

export interface ShootoutState {
  difficulty: Difficulty;
  phase: ShootoutPhase;
  kicksPlayer: number;
  kicksAi: number;
  scorePlayer: number;
  scoreAi: number;
  history: Attempt[];
  current: Attempt | null;
  flight: number;
  resultTimer: number;
  message: string;
  decided: boolean;
  winner: 'player' | 'ai' | null;
}

export function zoneColumn(zone: Zone): number {
  return zone % 3;
}

export function zoneRow(zone: Zone): number {
  return zone < 3 ? 0 : 1;
}

export function zonesAdjacent(a: Zone, b: Zone): boolean {
  if (a === b) return false;
  return Math.abs(zoneColumn(a) - zoneColumn(b)) <= 1 && Math.abs(zoneRow(a) - zoneRow(b)) <= 1;
}

/** Maps a normalized point inside the goal mouth to one of the six zones. */
export function zoneAt(x: number, y: number): Zone {
  const column = x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2;
  const row = y < 0.5 ? 0 : 1;
  return (row * 3 + column) as Zone;
}

export function resolvePenalty(
  shotZone: Zone,
  keeperZone: Zone,
  difficulty: Difficulty,
  rng: Rng,
): boolean {
  const profile = DIFFICULTIES[difficulty];
  if (shotZone === keeperZone) return rng() < profile.saveExact;
  if (zonesAdjacent(shotZone, keeperZone)) return rng() < profile.saveNear;
  return rng() < profile.saveFar;
}

function mostFrequentZone(history: Attempt[]): Zone | null {
  const playerKicks = history.filter((attempt) => attempt.shooter === 'player');
  if (playerKicks.length === 0) return null;
  const counts = new Map<Zone, number>();
  for (const attempt of playerKicks) counts.set(attempt.shotZone, (counts.get(attempt.shotZone) ?? 0) + 1);
  let best: Zone | null = null;
  let bestCount = 0;
  for (const [zone, count] of counts) {
    if (count > bestCount) {
      best = zone;
      bestCount = count;
    }
  }
  return best;
}

export function chooseKeeperZone(state: ShootoutState, rng: Rng): Zone {
  const profile = DIFFICULTIES[state.difficulty];
  const favourite = mostFrequentZone(state.history);
  if (favourite !== null && rng() < profile.read) return favourite;
  return Math.floor(rng() * 6) as Zone;
}

const CORNERS: Zone[] = [0, 2, 3, 5];

export function chooseAiShot(state: ShootoutState, rng: Rng): Zone {
  const profile = DIFFICULTIES[state.difficulty];
  if (rng() < profile.aiCorner) {
    return CORNERS[Math.floor(rng() * CORNERS.length)] ?? 0;
  }
  return Math.floor(rng() * 6) as Zone;
}

export function createShootout(difficulty: Difficulty = 'pro'): ShootoutState {
  return {
    difficulty,
    phase: 'player-aim',
    kicksPlayer: 0,
    kicksAi: 0,
    scorePlayer: 0,
    scoreAi: 0,
    history: [],
    current: null,
    flight: 0,
    resultTimer: 0,
    message: 'Pick your corner.',
    decided: false,
    winner: null,
  };
}

export function nextShooter(state: ShootoutState): Shooter {
  return state.kicksPlayer === state.kicksAi ? 'player' : 'ai';
}

export function isSuddenDeath(state: ShootoutState): boolean {
  return state.kicksPlayer >= REGULATION_KICKS && state.kicksAi >= REGULATION_KICKS;
}

export function shoot(state: ShootoutState, zone: Zone, rng: Rng = Math.random): Attempt | null {
  if (state.phase !== 'player-aim' || state.decided) return null;
  const keeperZone = chooseKeeperZone(state, rng);
  const saved = resolvePenalty(zone, keeperZone, state.difficulty, rng);
  const attempt: Attempt = {
    shooter: 'player',
    shotZone: zone,
    keeperZone,
    saved,
    scored: !saved,
    offTarget: false,
  };
  state.kicksPlayer += 1;
  if (attempt.scored) state.scorePlayer += 1;
  state.history.push(attempt);
  state.current = attempt;
  state.flight = 0;
  state.phase = 'player-flight';
  state.message = saved ? 'Saved by the keeper.' : 'Goal!';
  return attempt;
}

export function dive(state: ShootoutState, zone: Zone, rng: Rng = Math.random): Attempt | null {
  if (state.phase !== 'ai-aim' || state.decided) return null;
  const profile = DIFFICULTIES[state.difficulty];
  const offTarget = rng() < profile.aiMiss;
  const shotZone = chooseAiShot(state, rng);
  const saved = offTarget ? false : resolvePenalty(shotZone, zone, state.difficulty, rng);
  const attempt: Attempt = {
    shooter: 'ai',
    shotZone,
    keeperZone: zone,
    saved,
    scored: !saved && !offTarget,
    offTarget,
  };
  state.kicksAi += 1;
  if (attempt.scored) state.scoreAi += 1;
  state.history.push(attempt);
  state.current = attempt;
  state.flight = 0;
  state.phase = 'ai-flight';
  state.message = offTarget ? 'The CPU drags it wide!' : saved ? 'You save it!' : 'CPU scores.';
  return attempt;
}

export function decideWinner(state: ShootoutState): 'player' | 'ai' | null {
  const remainingPlayer = Math.max(0, REGULATION_KICKS - state.kicksPlayer);
  const remainingAi = Math.max(0, REGULATION_KICKS - state.kicksAi);

  if (state.kicksPlayer < REGULATION_KICKS || state.kicksAi < REGULATION_KICKS) {
    if (state.scorePlayer > state.scoreAi + remainingAi) return 'player';
    if (state.scoreAi > state.scorePlayer + remainingPlayer) return 'ai';
    return null;
  }

  if (state.kicksPlayer === state.kicksAi && state.scorePlayer !== state.scoreAi) {
    return state.scorePlayer > state.scoreAi ? 'player' : 'ai';
  }
  return null;
}

export function stepShootout(state: ShootoutState, delta: number): ShootoutEvent[] {
  const events: ShootoutEvent[] = [];
  const step = Math.max(0, Math.min(0.1, delta));
  if (state.phase === 'player-flight' || state.phase === 'ai-flight') {
    state.flight += step;
    if (state.flight >= FLIGHT_SECONDS) {
      state.phase = 'result';
      state.resultTimer = RESULT_SECONDS;
      const winner = decideWinner(state);
      if (winner) {
        state.decided = true;
        state.winner = winner;
      }
      events.push('settle');
    }
  } else if (state.phase === 'result') {
    state.resultTimer = Math.max(0, state.resultTimer - step);
    if (state.resultTimer === 0) {
      if (state.decided) {
        state.phase = 'over';
        events.push('end');
      } else {
        state.phase = nextShooter(state) === 'player' ? 'player-aim' : 'ai-aim';
        state.current = null;
        state.message = state.phase === 'ai-aim' ? 'Choose where to dive.' : 'Pick your corner.';
      }
    }
  }
  return events;
}

export function savedCount(state: ShootoutState): number {
  return state.history.filter((attempt) => attempt.shooter === 'ai' && attempt.saved).length;
}

export function scoreValue(state: ShootoutState): number {
  return state.scorePlayer * 120 + savedCount(state) * 45;
}

export function roundLabel(state: ShootoutState): string {
  if (isSuddenDeath(state)) return 'Sudden death';
  return `Kick ${Math.min(REGULATION_KICKS, Math.max(state.kicksPlayer, state.kicksAi) + 1)} of ${REGULATION_KICKS}`;
}
