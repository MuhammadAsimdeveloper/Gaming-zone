import { FIGHTERS, type AiTier, type FighterId } from './fighters';
import {
  createFighterState,
  stepCombat,
  type CombatEvent,
  type CombatInput,
  type FighterState,
} from './combat';
import {
  createMatchState,
  finishRound,
  startRound,
  tickTimer,
  timeoutWinner,
  type MatchState,
  type Side,
} from './match';
import { AI_PROFILES, chooseAiInput, createAiMemory, mulberry32, type AiMemory } from './ai';
import type { DuelBanner, DuelEffect, DuelView } from './render';

export type DuelPhase = 'intro' | 'fight' | 'roundOver' | 'matchOver';

export interface DuelSessionConfig {
  player: FighterId;
  rival: FighterId;
  tier: AiTier;
  seed: number;
  roundSeconds?: number;
  training?: boolean;
}

export type DuelCue =
  | { type: 'countdown'; final: boolean }
  | { type: 'roundStart' }
  | { type: 'roundEnd' }
  | { type: 'matchEnd' }
  | { type: 'reset' };

export interface StepResult {
  events: CombatEvent[];
  cues: DuelCue[];
}

export interface DuelSnapshot extends DuelView {
  phase: DuelPhase;
  winner: Side | null;
  match: MatchState;
}

const START_X = 2.6;
const ARENA = { minX: -6, maxX: 6 };
const INTRO_TICKS = 150;
const SHORT_INTRO_TICKS = 120;
const ROUND_BREAK_TICKS = 120;
const TRAINING_BREAK_TICKS = 80;
const EFFECT_TICKS = 28;
const COUNTDOWN_LABELS = ['3', '2', '1', 'FIGHT!'] as const;

type RoundReason = 'ko' | 'time' | 'training';

export class DuelSession {
  private readonly config: Required<Omit<DuelSessionConfig, 'seed'>> & { seed: number };
  private readonly rng: () => number;
  private readonly playerSpec;
  private readonly rivalSpec;
  private aiMemory: AiMemory;
  private a: FighterState;
  private b: FighterState;
  private match: MatchState;
  private phaseState: DuelPhase = 'intro';
  private phaseTicks = 0;
  private introTicks = INTRO_TICKS;
  private lastCountdown = -1;
  private roundReason: RoundReason = 'ko';
  private effects: DuelEffect[] = [];
  private shake = 0;
  private tickCount = 0;

  constructor(config: DuelSessionConfig) {
    this.config = {
      roundSeconds: 60,
      training: false,
      ...config,
    };
    this.rng = mulberry32(config.seed);
    this.playerSpec = FIGHTERS[config.player];
    this.rivalSpec = FIGHTERS[config.rival];
    this.a = createFighterState(this.playerSpec, -START_X, 1);
    this.b = createFighterState(this.rivalSpec, START_X, -1);
    this.match = createMatchState(this.config.roundSeconds);
    this.aiMemory = createAiMemory();
  }

  get phase(): DuelPhase {
    return this.phaseState;
  }

  get winner(): Side | null {
    return this.match.winner;
  }

  step(playerInput: CombatInput): StepResult {
    this.tickCount += 1;
    this.decay();
    const events: CombatEvent[] = [];
    const cues: DuelCue[] = [];

    if (this.phaseState === 'intro') this.stepIntro(cues);
    else if (this.phaseState === 'fight') this.stepFight(playerInput, events, cues);
    else if (this.phaseState === 'roundOver') this.stepBreak(cues);

    return { events, cues };
  }

  snapshot(): DuelSnapshot {
    return {
      a: this.a,
      b: this.b,
      timerTicks: this.match.timerTicks,
      roundTicks: this.match.roundTicks,
      round: this.match.round,
      wins: this.match.wins,
      banner: this.banner(),
      shake: this.shake,
      effects: this.effects,
      training: this.config.training,
      rivalName: this.rivalSpec.name,
      clock: this.tickCount,
      phase: this.phaseState,
      winner: this.match.winner,
      match: this.match,
    };
  }

  dispose(): void {
    this.effects = [];
  }

  private stepIntro(cues: DuelCue[]): void {
    this.phaseTicks += 1;
    const step = Math.floor(this.phaseTicks / 30);
    if (step !== this.lastCountdown && step < COUNTDOWN_LABELS.length) {
      this.lastCountdown = step;
      cues.push({ type: 'countdown', final: step === COUNTDOWN_LABELS.length - 1 });
    }

    if (this.phaseTicks < this.introTicks) return;

    this.match = startRound(this.match);
    this.phaseState = 'fight';
    this.phaseTicks = 0;
    this.lastCountdown = -1;
    cues.push({ type: 'roundStart' });
  }

  private stepFight(input: CombatInput, events: CombatEvent[], cues: DuelCue[]): void {
    if (!this.config.training) {
      this.match = tickTimer(this.match);
      if (this.match.timerTicks <= 0) {
        this.endRound(timeoutWinner(this.a.health, this.b.health), 'time');
        cues.push({ type: 'roundEnd' });
        return;
      }
    }

    const decision = chooseAiInput(
      this.aiMemory,
      this.b,
      this.a,
      AI_PROFILES[this.config.tier],
      this.tickCount,
      this.rng,
    );
    this.aiMemory = decision.memory;

    const result = stepCombat(this.a, this.b, input, decision.input, ARENA);
    this.a = result.a;
    this.b = result.b;
    this.absorbEvents(result.events, events);

    if (this.a.health <= 0 || this.b.health <= 0) {
      const winner: Side | null =
        this.a.health <= 0 && this.b.health <= 0 ? null : this.a.health <= 0 ? 'rival' : 'player';
      this.endRound(winner, this.config.training ? 'training' : 'ko');
      cues.push({ type: 'roundEnd' });
    }
  }

  private stepBreak(cues: DuelCue[]): void {
    this.phaseTicks += 1;
    const wait = this.config.training ? TRAINING_BREAK_TICKS : ROUND_BREAK_TICKS;
    if (this.phaseTicks < wait) return;

    if (!this.config.training && this.match.phase === 'matchOver') {
      this.phaseState = 'matchOver';
      this.phaseTicks = 0;
      cues.push({ type: 'matchEnd' });
      return;
    }

    this.resetFighters();
    if (!this.config.training) this.match = startRound(this.match);
    this.phaseState = 'intro';
    this.phaseTicks = 0;
    this.introTicks = SHORT_INTRO_TICKS;
    this.lastCountdown = -1;
    cues.push({ type: 'reset' });
  }

  private endRound(winner: Side | null, reason: RoundReason): void {
    this.phaseState = 'roundOver';
    this.phaseTicks = 0;
    this.roundReason = reason;
    this.shake = 1;
    if (!this.config.training) this.match = finishRound(this.match, winner);
  }

  private resetFighters(): void {
    this.a = createFighterState(this.playerSpec, -START_X, 1);
    this.b = createFighterState(this.rivalSpec, START_X, -1);
    this.aiMemory = createAiMemory();
  }

  private absorbEvents(events: CombatEvent[], out: CombatEvent[]): void {
    for (const event of events) {
      out.push(event);
      if (event.type === 'special') {
        this.effects.push(this.effect('special', event.x, event.y, 0.4));
        this.shake = Math.max(this.shake, 0.25);
      } else if (event.type === 'hit') {
        this.effects.push(this.effect('hit', event.x, event.y, Math.min(1, event.amount / 120)));
        this.shake = Math.max(this.shake, 0.6);
      } else if (event.type === 'block') {
        this.effects.push(this.effect('block', event.x, event.y, 0.3));
        this.shake = Math.max(this.shake, 0.2);
      } else if (event.type === 'ko') {
        this.effects.push(this.effect('ko', event.x, event.y, 1));
        this.shake = 1;
      } else if (event.type === 'land') {
        this.effects.push(this.effect('land', event.x, event.y, 0.2));
      }
    }
  }

  private effect(kind: DuelEffect['kind'], x: number, y: number, strength: number): DuelEffect {
    return { kind, x, y, life: EFFECT_TICKS, maxLife: EFFECT_TICKS, strength };
  }

  private decay(): void {
    if (this.effects.length > 0) {
      this.effects = this.effects.filter((effect) => {
        effect.life -= 1;
        return effect.life > 0;
      });
    }
    this.shake *= 0.86;
    if (this.shake < 0.01) this.shake = 0;
  }

  private banner(): DuelBanner | null {
    if (this.phaseState === 'fight') return null;

    if (this.phaseState === 'intro') {
      const label = COUNTDOWN_LABELS[Math.min(COUNTDOWN_LABELS.length - 1, Math.floor(this.phaseTicks / 30))] ?? 'FIGHT!';
      return {
        title: label,
        subtitle: this.config.training ? 'Training dummy' : `Round ${this.match.round}`,
        tone: 'neutral',
      };
    }

    if (this.phaseState === 'roundOver') {
      if (this.config.training) {
        return {
          title: this.roundReason === 'training' ? 'K.O.' : 'TIME UP',
          subtitle: 'Training continues · dummy resets',
          tone: 'neutral',
        };
      }
      const winner = this.match.roundWinner;
      const title = this.roundReason === 'time' ? 'TIME UP' : 'K.O.';
      return {
        title,
        subtitle:
          winner === null
            ? 'Round drawn'
            : winner === 'player'
              ? `You take the round · ${this.match.wins.player}–${this.match.wins.rival}`
              : `Rival takes the round · ${this.match.wins.player}–${this.match.wins.rival}`,
        tone: winner === null ? 'neutral' : winner === 'player' ? 'win' : 'loss',
      };
    }

    return {
      title: this.match.winner === 'player' ? 'MATCH WON' : 'MATCH LOST',
      subtitle: `Best of three · ${this.match.wins.player}–${this.match.wins.rival}`,
      tone: this.match.winner === 'player' ? 'win' : 'loss',
    };
  }
}
