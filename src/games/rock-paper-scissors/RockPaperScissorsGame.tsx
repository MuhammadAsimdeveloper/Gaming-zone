import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Hand,
  HelpCircle,
  RotateCcw,
  Scissors,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';

type Throw = 'rock' | 'paper' | 'scissors';
type Verdict = 'win' | 'loss' | 'draw';
type Phase = 'ready' | 'countdown' | 'result' | 'over';

interface ThrowMeta {
  label: string;
  Icon: LucideIcon;
  beats: string;
}

interface HistoryEntry {
  id: number;
  player: Throw;
  house: Throw;
  outcome: Verdict;
}

const THROWS: Record<Throw, ThrowMeta> = {
  rock: { label: 'Rock', Icon: Hand, beats: 'Scissors' },
  paper: { label: 'Paper', Icon: FileText, beats: 'Rock' },
  scissors: { label: 'Scissors', Icon: Scissors, beats: 'Paper' },
};

const THROW_ORDER: ReadonlyArray<Throw> = ['rock', 'paper', 'scissors'];

const COUNTDOWN_STEP_MS = 150;
const COUNTDOWN_TOTAL_MS = COUNTDOWN_STEP_MS * 3;
const RESULT_HOLD_MS = 1050;
const DRAW_HOLD_MS = 850;

function verdictFor(player: Throw, house: Throw): Verdict {
  if (player === house) return 'draw';
  if (
    (player === 'rock' && house === 'scissors') ||
    (player === 'paper' && house === 'rock') ||
    (player === 'scissors' && house === 'paper')
  ) {
    return 'win';
  }
  return 'loss';
}

function outcomeText(outcome: Verdict | null): string {
  if (outcome === 'win') return 'Round won';
  if (outcome === 'loss') return 'House takes the round';
  if (outcome === 'draw') return 'Tie — throw again';
  return 'Choose your throw';
}

export default function RockPaperScissorsGame({ onStart, onComplete }: GameComponentProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [playerWins, setPlayerWins] = useState(0);
  const [houseWins, setHouseWins] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [playerChoice, setPlayerChoice] = useState<Throw | null>(null);
  const [houseChoice, setHouseChoice] = useState<Throw | null>(null);
  const [roundOutcome, setRoundOutcome] = useState<Verdict | null>(null);
  const [matchResult, setMatchResult] = useState<Verdict | null>(null);

  const scoresRef = useRef({ player: 0, house: 0 });
  // Deadlines rather than running timers, so a hidden tab can push the whole
  // round forward by exactly the time it was out of sight.
  const revealAtRef = useRef<number | null>(null);
  const resetAtRef = useRef<number | null>(null);
  const pendingRoundRef = useRef<{ player: Throw; house: Throw } | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const playRef = useRef<(choice: Throw) => void>(() => undefined);
  const revealRef = useRef<(player: Throw, house: Throw) => void>(() => undefined);
  const resetRoundRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  const clearTimers = () => {
    revealAtRef.current = null;
    resetAtRef.current = null;
    pendingRoundRef.current = null;
    hiddenAtRef.current = null;
  };

  const resetMatch = () => {
    clearTimers();
    scoresRef.current = { player: 0, house: 0 };
    setPlayerWins(0);
    setHouseWins(0);
    setHistory([]);
    setCountdown(3);
    setPlayerChoice(null);
    setHouseChoice(null);
    setRoundOutcome(null);
    setMatchResult(null);
    setPhase('ready');
    startedRef.current = false;
    finishedRef.current = false;
  };

  const reveal = (player: Throw, house: Throw) => {
    const outcome = verdictFor(player, house);
    const nextPlayer = scoresRef.current.player + (outcome === 'win' ? 1 : 0);
    const nextHouse = scoresRef.current.house + (outcome === 'loss' ? 1 : 0);

    scoresRef.current = { player: nextPlayer, house: nextHouse };
    setPlayerWins(nextPlayer);
    setHouseWins(nextHouse);
    setHouseChoice(house);
    setRoundOutcome(outcome);
    setPhase('result');
    setHistory((current) =>
      [{ id: Date.now() + Math.random(), player, house, outcome }, ...current].slice(0, 12),
    );

    if (nextPlayer >= 3 || nextHouse >= 3) {
      const final: Verdict = nextPlayer > nextHouse ? 'win' : nextPlayer < nextHouse ? 'loss' : 'draw';
      setMatchResult(final);
      setPhase('over');
      if (!finishedRef.current) {
        finishedRef.current = true;
        onCompleteRef.current?.({ score: nextPlayer, outcome: final });
      }
      return;
    }

    resetAtRef.current = Date.now() + (outcome === 'draw' ? DRAW_HOLD_MS : RESULT_HOLD_MS);
  };

  const resetRound = () => {
    resetAtRef.current = null;
    setPhase('ready');
    setRoundOutcome(null);
    setPlayerChoice(null);
    setHouseChoice(null);
    setCountdown(3);
  };

  const play = (choice: Throw) => {
    if (phase === 'countdown' || phase === 'over') return;

    clearTimers();
    const house = THROW_ORDER[Math.floor(Math.random() * THROW_ORDER.length)];
    pendingRoundRef.current = { player: choice, house };
    revealAtRef.current = Date.now() + COUNTDOWN_TOTAL_MS;
    if (document.visibilityState === 'hidden') hiddenAtRef.current = Date.now();

    setPlayerChoice(choice);
    setHouseChoice(null);
    setRoundOutcome(null);
    setCountdown(3);
    setPhase('countdown');

    if (!startedRef.current) {
      startedRef.current = true;
      onStartRef.current?.();
    }
  };

  useEffect(() => {
    playRef.current = play;
    revealRef.current = reveal;
    resetRoundRef.current = resetRound;
  });

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'result') return undefined;

    const tick = () => {
      // A hidden tab must not settle the round; the visibility handler shifts the
      // deadline forward by the time that elapsed off-screen.
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();

      const revealAt = revealAtRef.current;
      if (revealAt !== null) {
        if (now >= revealAt) {
          const pending = pendingRoundRef.current;
          revealAtRef.current = null;
          pendingRoundRef.current = null;
          if (pending) revealRef.current(pending.player, pending.house);
          return;
        }
        setCountdown(Math.max(1, Math.ceil((revealAt - now) / COUNTDOWN_STEP_MS)));
        return;
      }

      const resetAt = resetAtRef.current;
      if (resetAt !== null && now >= resetAt) resetRoundRef.current();
    };

    tick();
    const interval = window.setInterval(tick, 50);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (revealAtRef.current !== null || resetAtRef.current !== null) {
          hiddenAtRef.current = Date.now();
        }
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt === null) return;

      const hiddenFor = Date.now() - hiddenAt;
      if (revealAtRef.current !== null) {
        revealAtRef.current += hiddenFor;
        const remaining = revealAtRef.current - Date.now();
        setCountdown(Math.max(1, Math.ceil(remaining / COUNTDOWN_STEP_MS)));
      }
      if (resetAtRef.current !== null) resetAtRef.current += hiddenFor;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }

      const keyMap: Record<string, Throw> = { '1': 'rock', '2': 'paper', '3': 'scissors' };
      const choice = keyMap[event.key];
      if (choice) {
        event.preventDefault();
        playRef.current(choice);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const playerMeta = playerChoice ? THROWS[playerChoice] : null;
  const houseMeta = houseChoice ? THROWS[houseChoice] : null;
  const PlayerIcon = playerMeta?.Icon;
  const HouseIcon = houseMeta?.Icon;

  const scoreLabel = `${playerWins} – ${houseWins}`;
  const statusLabel =
    phase === 'over'
      ? matchResult === 'win'
        ? `Match won ${scoreLabel}.`
        : `Match lost ${scoreLabel}.`
      : phase === 'countdown'
        ? 'Revealing throws.'
        : roundOutcome
          ? `${outcomeText(roundOutcome)}. Score ${scoreLabel}.`
          : `Choose rock, paper or scissors. Score ${scoreLabel}.`;

  return (
    <GameFrame
      title="Rock Paper Scissors"
      subtitle="Best of five. No excuses."
      icon={Swords}
      accent="coral"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="You" value={`${playerWins} / 3`} tone="electric" />
          <GameStat label="House" value={`${houseWins} / 3`} tone="coral" />
          <GameStat label="Throws" value={history.length} />
        </div>
      }
      toolbar={
        <GameButton size="sm" variant="secondary" onClick={resetMatch}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset match
        </GameButton>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Rock beats scissors · Paper beats rock · Scissors beats paper.</span>
          <span>Ties replay without changing the score.</span>
          <span className="inline-flex items-center gap-1.5">
            Keys
            <Kbd>1</Kbd>
            <Kbd>2</Kbd>
            <Kbd>3</Kbd>
            to throw
          </span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="relative">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-night-950/70 px-3 py-4 sm:px-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-electric-500/5 to-transparent" />

          <div className="relative grid grid-cols-3 items-center gap-2 sm:gap-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">You</p>
              <div
                className={cn(
                  'mx-auto mt-2 grid aspect-square w-full max-w-[88px] place-items-center rounded-2xl border transition sm:max-w-[110px]',
                  playerChoice
                    ? 'border-electric-500/30 bg-electric-500/10 text-electric-300'
                    : 'border-white/10 bg-white/5 text-muted',
                )}
              >
                {PlayerIcon ? (
                  <PlayerIcon
                    className={cn('h-9 w-9 sm:h-11 sm:w-11', phase === 'countdown' && 'animate-pulse')}
                    aria-hidden="true"
                  />
                ) : (
                  <HelpCircle className="h-7 w-7" aria-label="No throw selected" />
                )}
              </div>
            </div>

            <div className="flex min-h-24 flex-col items-center justify-center text-center">
              {phase === 'countdown' ? (
                <p key={countdown} className="animate-pop font-display text-4xl font-semibold text-ink sm:text-5xl">
                  {countdown}
                </p>
              ) : (
                <p className="font-display text-xl font-semibold text-muted sm:text-2xl">VS</p>
              )}
              <span
                className={cn(
                  'mt-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                  roundOutcome === 'win'
                    ? 'border-mint/30 bg-mint/10 text-mint'
                    : roundOutcome === 'loss'
                      ? 'border-coral/30 bg-coral/10 text-coral'
                      : 'border-white/10 bg-white/5 text-muted',
                )}
              >
                {phase === 'countdown' ? 'Reveal' : outcomeText(roundOutcome)}
              </span>
            </div>

            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">House</p>
              <div
                className={cn(
                  'mx-auto mt-2 grid aspect-square w-full max-w-[88px] place-items-center rounded-2xl border transition sm:max-w-[110px]',
                  houseChoice
                    ? 'border-plasma-500/30 bg-plasma-500/10 text-plasma-300'
                    : 'border-white/10 bg-white/5 text-muted',
                )}
              >
                {HouseIcon ? (
                  <HouseIcon
                    className={cn('h-9 w-9 sm:h-11 sm:w-11', phase === 'countdown' && 'animate-pulse')}
                    aria-hidden="true"
                  />
                ) : (
                  <HelpCircle className="h-7 w-7" aria-label="House throw hidden" />
                )}
              </div>
            </div>
          </div>

          <p className="relative mt-3 text-center text-xs text-muted">
            {phase === 'countdown'
              ? 'Reading the house…'
              : roundOutcome === 'draw'
                ? 'Dead even. Throw again.'
                : roundOutcome
                  ? outcomeText(roundOutcome)
                  : 'Pick a throw. First to three round wins takes the match.'}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {THROW_ORDER.map((throwId, index) => {
            const meta = THROWS[throwId];
            const Icon = meta.Icon;
            const selected = playerChoice === throwId;

            return (
              <button
                key={throwId}
                type="button"
                onClick={() => play(throwId)}
                disabled={phase === 'countdown'}
                aria-label={`Throw ${meta.label}. Beats ${meta.beats}. Keyboard shortcut ${index + 1}.`}
                className={cn(
                  'group flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center transition duration-200 active:scale-[0.98] disabled:opacity-60',
                  selected
                    ? 'border-electric-500/40 bg-electric-500/10 text-electric-200'
                    : 'border-white/10 bg-white/5 text-ink hover:border-electric-500/30 hover:bg-white/10',
                )}
              >
                <Icon className="h-6 w-6 transition group-hover:scale-110 sm:h-7 sm:w-7" aria-hidden="true" />
                <span className="text-xs font-semibold sm:text-sm">{meta.label}</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted">
                  <Kbd>{index + 1}</Kbd>
                  <span className="hidden sm:inline">beats {meta.beats}</span>
                </span>
              </button>
            );
          })}
        </div>

        {phase === 'over' ? (
          <GameOverlay tone={matchResult === 'win' ? 'win' : 'loss'}>
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                matchResult === 'win' ? 'border-mint/30 bg-mint/10 text-mint' : 'border-coral/30 bg-coral/10 text-coral',
              )}
            >
              Match complete
            </span>
            <span
              className={cn(
                'grid h-12 w-12 place-items-center rounded-full border',
                matchResult === 'win'
                  ? 'border-mint/30 bg-mint/10 text-mint'
                  : 'border-coral/30 bg-coral/10 text-coral',
              )}
            >
              <Trophy className="h-5 w-5" />
            </span>
            <p className="font-display text-2xl font-semibold text-ink">
              {matchResult === 'win' ? 'You take the match' : 'The house takes it'}
            </p>
            <p className="font-display text-xl font-semibold tabular-nums text-ink">
              <span className="text-electric-300">{playerWins}</span>
              <span className="mx-2 text-muted">–</span>
              <span className="text-coral">{houseWins}</span>
            </p>
            <p className="text-xs text-muted">First to three round wins</p>
            <GameButton variant="primary" onClick={resetMatch}>
              <RotateCcw className="h-4 w-4" />
              Rematch
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          <span>Round history</span>
          <span>{history.length === 0 ? 'No throws yet' : `${history.length} rounds`}</span>
        </div>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-muted">
            Your throws will appear here.
          </p>
        ) : (
          <div className="no-scrollbar flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
            {history.map((entry) => {
              const playerEntry = THROWS[entry.player];
              const houseEntry = THROWS[entry.house];
              const PlayerEntryIcon = playerEntry.Icon;
              const HouseEntryIcon = houseEntry.Icon;

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-1.5 text-muted">
                    <PlayerEntryIcon className="h-3.5 w-3.5 text-electric-300" aria-hidden="true" />
                    <span className="sr-only">{playerEntry.label}</span>
                    <span className="text-muted/60">vs</span>
                    <HouseEntryIcon className="h-3.5 w-3.5 text-plasma-300" aria-hidden="true" />
                    <span className="sr-only">{houseEntry.label}</span>
                    <span className="hidden sm:inline">
                      {playerEntry.label} vs {houseEntry.label}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      entry.outcome === 'win'
                        ? 'bg-mint/10 text-mint'
                        : entry.outcome === 'loss'
                          ? 'bg-coral/10 text-coral'
                          : 'bg-white/5 text-muted',
                    )}
                  >
                    {entry.outcome === 'win' ? 'Win' : entry.outcome === 'loss' ? 'Loss' : 'Tie'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GameFrame>
  );
}
