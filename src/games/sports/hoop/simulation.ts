export type HoopDifficulty = 'rookie' | 'pro' | 'allstar';
export type HoopPhase = 'aim' | 'flight' | 'reset' | 'over';
export type HoopEvent = 'score' | 'miss' | 'reset' | 'over';
export type ShotResult = 'swish' | 'rim-in' | 'miss';
export type Rng = () => number;

export const GRAVITY = 60;
export const BALL_RADIUS = 1.6;
export const RIM_THICKNESS = 0.35;
export const RIM_HALF = 5;
export const HOOP_Y = 32;
export const HOOP_CENTER_X = 80;
export const FLOOR_Y = 90;
export const ROUND_SECONDS = 60;
export const RESET_SECONDS = 0.8;
export const MIN_ANGLE = 12;
export const MAX_ANGLE = 82;
export const MIN_POWER = 0;
export const MAX_POWER = 1;
export const MIN_SPEED = 40;
export const MAX_SPEED = 140;

export const SPOTS = [
  { x: 24, y: 88 },
  { x: 36, y: 86 },
  { x: 48, y: 88 },
  { x: 60, y: 87 },
] as const;

interface HoopProfile {
  amplitude: number;
  speed: number;
}

export const HOOP_PROFILES: Record<HoopDifficulty, HoopProfile> = {
  rookie: { amplitude: 0, speed: 0 },
  pro: { amplitude: 2.5, speed: 1.05 },
  allstar: { amplitude: 4.5, speed: 1.55 },
};

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: boolean;
  rimHit: boolean;
  flight: number;
}

export interface HoopState {
  difficulty: HoopDifficulty;
  phase: HoopPhase;
  timeLeft: number;
  elapsed: number;
  score: number;
  shots: number;
  makes: number;
  streak: number;
  bestStreak: number;
  swishes: number;
  spot: number;
  ball: Ball;
  hoopX: number;
  aimAngle: number;
  power: number;
  resetTimer: number;
  lastResult: ShotResult | null;
  lastPoints: number;
  message: string;
  trail: Array<{ x: number; y: number }>;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function spotOf(state: HoopState): { x: number; y: number } {
  return SPOTS[state.spot] ?? SPOTS[0];
}

export function hoopXAt(elapsed: number, difficulty: HoopDifficulty): number {
  const profile = HOOP_PROFILES[difficulty];
  if (profile.amplitude === 0) return HOOP_CENTER_X;
  return HOOP_CENTER_X + Math.sin(elapsed * profile.speed) * profile.amplitude;
}

export function launchVelocity(angleDeg: number, power01: number): { vx: number; vy: number } {
  const angle = (clamp(angleDeg, MIN_ANGLE, MAX_ANGLE) * Math.PI) / 180;
  const speed = MIN_SPEED + clamp(power01, 0, 1) * (MAX_SPEED - MIN_SPEED);
  return { vx: Math.cos(angle) * speed, vy: -Math.sin(angle) * speed };
}

export function adjustAim(state: HoopState, dAngle: number, dPower: number): void {
  state.aimAngle = clamp(state.aimAngle + dAngle, MIN_ANGLE, MAX_ANGLE);
  state.power = clamp(state.power + dPower, MIN_POWER, MAX_POWER);
}

export function streakMultiplier(streak: number): number {
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function shotPoints(result: Exclude<ShotResult, 'miss'>, streakBefore: number): number {
  const base = result === 'swish' ? 3 : 2;
  return base * streakMultiplier(streakBefore);
}

export function accuracy(state: HoopState): number {
  return state.shots === 0 ? 0 : Math.round((state.makes / state.shots) * 100);
}

export function createHoopGame(difficulty: HoopDifficulty = 'pro', rng: Rng = Math.random): HoopState {
  const spot = clamp(Math.floor(rng() * SPOTS.length), 0, SPOTS.length - 1);
  const start = SPOTS[spot] ?? SPOTS[0];
  return {
    difficulty,
    phase: 'aim',
    timeLeft: ROUND_SECONDS,
    elapsed: 0,
    score: 0,
    shots: 0,
    makes: 0,
    streak: 0,
    bestStreak: 0,
    swishes: 0,
    spot,
    ball: { x: start.x, y: start.y, vx: 0, vy: 0, flying: false, rimHit: false, flight: 0 },
    hoopX: HOOP_CENTER_X,
    aimAngle: 58,
    power: 0.55,
    resetTimer: 0,
    lastResult: null,
    lastPoints: 0,
    message: 'Line up your shot.',
    trail: [],
  };
}

export function resetBall(state: HoopState): void {
  const start = spotOf(state);
  state.ball = { x: start.x, y: start.y, vx: 0, vy: 0, flying: false, rimHit: false, flight: 0 };
  state.trail = [];
}

export function shootBall(state: HoopState, angle: number = state.aimAngle, power: number = state.power): boolean {
  if (state.phase !== 'aim' || state.timeLeft <= 0) return false;
  state.aimAngle = clamp(angle, MIN_ANGLE, MAX_ANGLE);
  state.power = clamp(power, MIN_POWER, MAX_POWER);
  const start = spotOf(state);
  const velocity = launchVelocity(state.aimAngle, state.power);
  state.ball = {
    x: start.x,
    y: start.y,
    vx: velocity.vx,
    vy: velocity.vy,
    flying: true,
    rimHit: false,
    flight: 0,
  };
  state.trail = [];
  state.shots += 1;
  state.phase = 'flight';
  state.message = 'In the air…';
  return true;
}

export function predictPath(state: HoopState, count = 36): Array<{ x: number; y: number }> {
  const start = spotOf(state);
  const velocity = launchVelocity(state.aimAngle, state.power);
  const step = 1 / 30;
  let x = start.x;
  let y = start.y;
  let vy = velocity.vy;
  const points: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < count; index += 1) {
    vy += GRAVITY * step;
    x += velocity.vx * step;
    y += vy * step;
    points.push({ x, y });
    if (y > FLOOR_Y) break;
  }
  return points;
}

function resolveShot(state: HoopState, result: ShotResult, events: HoopEvent[]): void {
  if (result === 'miss') {
    state.lastResult = 'miss';
    state.lastPoints = 0;
    state.streak = 0;
    state.message = 'Missed. Streak reset.';
    events.push('miss');
  } else {
    const points = shotPoints(result, state.streak);
    state.lastResult = result;
    state.lastPoints = points;
    state.score += points;
    state.makes += 1;
    if (result === 'swish') state.swishes += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.message = result === 'swish' ? `Swish! +${points}` : `Off the rim and in! +${points}`;
    events.push('score');
  }
  state.phase = 'reset';
  state.resetTimer = RESET_SECONDS;
  state.ball.flying = false;
}

function finishRound(state: HoopState, events: HoopEvent[]): void {
  state.phase = 'over';
  state.ball.flying = false;
  state.message = 'Round over.';
  events.push('over');
}

function advanceBall(state: HoopState, dt: number): ShotResult | null {
  const ball = state.ball;
  const hoopX = state.hoopX;
  const plane = HOOP_Y + BALL_RADIUS * 0.4;
  const previousY = ball.y;

  state.trail.push({ x: ball.x, y: ball.y });
  if (state.trail.length > 24) state.trail.shift();

  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.flight += dt;

  for (const rimX of [hoopX - RIM_HALF, hoopX + RIM_HALF]) {
    const dx = ball.x - rimX;
    const dy = ball.y - HOOP_Y;
    const distance = Math.hypot(dx, dy);
    const contact = BALL_RADIUS + RIM_THICKNESS;
    if (distance > 0 && distance < contact) {
      const nx = dx / distance;
      const ny = dy / distance;
      const normalSpeed = ball.vx * nx + ball.vy * ny;
      if (normalSpeed < 0) {
        ball.vx -= 1.5 * normalSpeed * nx;
        ball.vy -= 1.5 * normalSpeed * ny;
        ball.vx *= 0.68;
        ball.vy *= 0.68;
        ball.rimHit = true;
      }
      ball.x = rimX + nx * (contact + 0.05);
      ball.y = HOOP_Y + ny * (contact + 0.05);
    }
  }

  if (previousY <= plane && ball.y > plane && ball.vy > 0) {
    if (Math.abs(ball.x - hoopX) < RIM_HALF - BALL_RADIUS * 0.5) {
      return ball.rimHit ? 'rim-in' : 'swish';
    }
  }

  if (ball.y >= FLOOR_Y || ball.x < -25 || ball.x > 165 || ball.flight > 7) return 'miss';
  return null;
}

export function stepGame(state: HoopState, delta: number, rng: Rng = Math.random): HoopEvent[] {
  const events: HoopEvent[] = [];
  if (state.phase === 'over') return events;
  const total = Math.max(0, Math.min(0.25, delta));
  if (total === 0) return events;

  state.elapsed += total;
  state.timeLeft = Math.max(0, state.timeLeft - total);
  state.hoopX = hoopXAt(state.elapsed, state.difficulty);

  if (state.phase === 'flight') {
    let outcome: ShotResult | null = null;
    let remaining = total;
    while (remaining > 1e-9 && outcome === null) {
      const step = Math.min(1 / 120, remaining);
      remaining -= step;
      outcome = advanceBall(state, step);
    }
    if (outcome !== null) resolveShot(state, outcome, events);
    return events;
  }

  if (state.phase === 'aim' && state.timeLeft <= 0) {
    finishRound(state, events);
    return events;
  }

  if (state.phase === 'reset') {
    state.resetTimer = Math.max(0, state.resetTimer - total);
    if (state.resetTimer === 0) {
      if (state.timeLeft <= 0) {
        finishRound(state, events);
      } else {
        state.spot = clamp(Math.floor(rng() * SPOTS.length), 0, SPOTS.length - 1);
        resetBall(state);
        state.phase = 'aim';
        state.message = 'Line up the next shot.';
        events.push('reset');
      }
    }
  }

  return events;
}
