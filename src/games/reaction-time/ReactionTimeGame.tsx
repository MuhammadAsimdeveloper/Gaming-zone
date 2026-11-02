import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Gauge, Play, RotateCcw, Timer, Zap } from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';

type Phase = 'idle' | 'waiting' | 'go' | 'result' | 'over';

const ROUNDS = 5;
const FALSE_START_PENALTY = 500;
const BEST_KEY = 'neonrift:game:reaction:best';

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export default function ReactionTimeGame({ onStart, onComplete }: GameComponentProps) {
  const { best, submit } = useBestScore(BEST_KEY, true);

  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [results, setResults] = useState<number[]>([]);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [penalty, setPenalty] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [average, setAverage] = useState<number | null>(null);
  const [newRecord, setNewRecord] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const waitingRef = useRef(false);
  const goAtRef = useRef<number | null>(null);
  const penaltyRef = useRef(0);
  const resultsRef = useRef<number[]>([]);
  const waitTimerRef = useRef<number | null>(null);
  const nextTimerRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const bestRef = useRef<number | null>(best);
  const panelRef = useRef<HTMLButtonElement | null>(null);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (nextTimerRef.current !== null) {
      window.clearTimeout(nextTimerRef.current);
      nextTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (waitTimerRef.current !== null) window.clearTimeout(waitTimerRef.current);
      if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current);
    },
    [],
  );

  const armRound = useCallback(() => {
    clearTimers();
    waitingRef.current = true;
    goAtRef.current = null;
    penaltyRef.current = 0;
    setPenalty(0);
    setNotice(null);
    setPhaseSafe('waiting');

    waitTimerRef.current = window.setTimeout(
      () => {
        waitTimerRef.current = null;
        waitingRef.current = false;
        goAtRef.current = performance.now();
        setPhaseSafe('go');
      },
      1200 + Math.random() * 2300,
    );
  }, [clearTimers, setPhaseSafe]);

  const finishRun = useCallback(
    (times: number[]) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      waitingRef.current = false;
      goAtRef.current = null;

      const finalAverage = averageOf(times) ?? 0;
      setAverage(finalAverage);
      setLastMs(null);
      setNotice(null);
      setNewRecord(bestRef.current === null || finalAverage < bestRef.current);
      setPhaseSafe('over');
      submit(finalAverage);
      onCompleteRef.current?.({ score: finalAverage, outcome: 'complete' });
    },
    [setPhaseSafe, submit],
  );

  const startRun = useCallback(() => {
    clearTimers();
    resultsRef.current = [];
    setResults([]);
    setRound(1);
    setLastMs(null);
    setAverage(null);
    setNewRecord(false);
    setNotice(null);
    startedRef.current = true;
    finishedRef.current = false;
    onStartRef.current?.();
    armRound();
  }, [armRound, clearTimers]);

  const handleReact = useCallback(() => {
    if (goAtRef.current !== null) {
      const measured = Math.max(1, Math.round(performance.now() - goAtRef.current + penaltyRef.current));
      goAtRef.current = null;
      waitingRef.current = false;

      const nextResults = [...resultsRef.current, measured];
      resultsRef.current = nextResults;
      setResults(nextResults);
      setLastMs(measured);
      setNotice(null);
      setPhaseSafe('result');

      if (nextResults.length >= ROUNDS) {
        setRound(ROUNDS);
        nextTimerRef.current = window.setTimeout(
          () => {
            nextTimerRef.current = null;
            finishRun(nextResults);
          },
          950,
        );
      } else {
        setRound(nextResults.length + 1);
        nextTimerRef.current = window.setTimeout(
          () => {
            nextTimerRef.current = null;
            armRound();
          },
          950,
        );
      }
      return;
    }

    if (!waitingRef.current) return;

    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }

    const nextPenalty = penaltyRef.current + FALSE_START_PENALTY;
    penaltyRef.current = nextPenalty;
    setPenalty(nextPenalty);
    setNotice(`False start — ${nextPenalty} ms added to this round`);

    waitTimerRef.current = window.setTimeout(
      () => {
        waitTimerRef.current = null;
        waitingRef.current = false;
        goAtRef.current = performance.now();
        setPhaseSafe('go');
      },
      1200 + Math.random() * 2300,
    );
  }, [armRound, finishRun, setPhaseSafe]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Space' && event.key !== ' ') return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
        if (tag === 'BUTTON' && target !== panelRef.current) return;
      }

      event.preventDefault();

      if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
        startRun();
      } else {
        handleReact();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReact, startRun]);

  useEffect(() => {
    let suspended = false;

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        const current = phaseRef.current;
        if (current === 'idle' || current === 'over') return;
        suspended = true;
        if (current === 'waiting' || current === 'go') {
          clearTimers();
          waitingRef.current = false;
          goAtRef.current = null;
        }
        return;
      }

      if (!suspended) return;
      suspended = false;
      if (finishedRef.current) return;
      armRound();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [armRound, clearTimers]);

  const handlePanelClick = () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'over') {
      startRun();
      return;
    }
    handleReact();
  };

  const bestLabel = best === null ? '—' : `${best} ms`;
  const liveAverage = averageOf(results);
  const lastLabel = lastMs === null ? '—' : `${lastMs} ms`;
  const statusLabel =
    phase === 'waiting'
      ? 'Wait for the panel to turn green.'
      : phase === 'go'
        ? 'Green. React now.'
        : phase === 'result'
          ? lastMs === null
            ? 'Round recorded.'
            : `Round result ${lastMs} milliseconds.`
          : phase === 'over'
            ? `Run complete. Average ${average ?? 0} milliseconds.`
            : 'Ready. Press start run.';

  return (
    <GameFrame
      title="Reaction Time"
      subtitle="Wait for green. Then move."
      icon={Timer}
      accent="coral"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Round" value={`${Math.min(round, ROUNDS)} / ${ROUNDS}`} />
          <GameStat label="Last" value={lastLabel} tone="electric" />
          <GameStat label="Best avg" value={bestLabel} tone="mint" />
        </div>
      }
      toolbar={
        <GameButton size="icon" variant="ghost" onClick={startRun} aria-label="Restart run" title="Restart run">
          <RotateCcw className="h-4 w-4" />
        </GameButton>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Wait for green, then click, tap or press</span>
          <Kbd>Space</Kbd>
          <span>False starts add 500 ms to the round.</span>
          <span>Five rounds make a run; the lowest average wins.</span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="relative mx-auto w-full max-w-[430px]">
        <button
          ref={panelRef}
          type="button"
          onClick={handlePanelClick}
          aria-label={
            phase === 'idle'
              ? 'Reaction panel. Press to start the run.'
              : phase === 'waiting'
                ? 'Wait for green. Clicking now adds a 500 millisecond penalty.'
                : phase === 'go'
                  ? 'Green panel. Click or press Space now.'
                  : phase === 'result'
                    ? `Round result ${lastMs ?? 0} milliseconds.`
                    : `Run complete. Average ${average ?? 0} milliseconds.`
          }
          className={cn(
            'relative flex min-h-[200px] w-full touch-manipulation select-none flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-5 text-center transition duration-150',
            phase === 'waiting' && 'border-white/10 bg-night-850 text-ink',
            phase === 'go' &&
              'border-mint/60 bg-mint/20 text-mint shadow-[0_0_70px_-25px_rgba(74,222,157,0.9)]',
            phase === 'idle' && 'border-white/10 bg-night-850/80 text-ink hover:border-electric-500/30',
            phase === 'result' && 'border-electric-500/25 bg-electric-500/5 text-ink',
            phase === 'over' && 'border-white/10 bg-night-850/80 text-ink',
          )}
        >
          {phase === 'idle' ? (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-electric-300">
                <Timer className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-display text-xl font-semibold">Ready when you are</p>
              <p className="max-w-[19rem] text-xs leading-relaxed text-muted">
                Five rounds. The panel turns green after a random delay. React as fast as you can — a false
                start costs 500 ms.
              </p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-ink">
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Click here or use Start run
              </span>
            </>
          ) : null}

          {phase === 'waiting' ? (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-muted">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-display text-xl font-semibold">Wait for green…</p>
              <p className="text-xs text-muted">Tap / click / Space the instant it lights up.</p>
              {penalty > 0 ? (
                <span className="rounded-full border border-coral/30 bg-coral/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-coral">
                  +{penalty} ms penalty
                </span>
              ) : null}
              {notice ? (
                <p className="text-[11px] font-medium text-coral" aria-live="polite">
                  {notice}
                </p>
              ) : null}
            </>
          ) : null}

          {phase === 'go' ? (
            <>
              <Zap className="h-7 w-7" aria-hidden="true" />
              <p className="font-display text-5xl font-semibold tracking-tight">GO</p>
              <p className="text-xs font-medium text-mint/80">Tap or press Space now</p>
              {penalty > 0 ? (
                <span className="rounded-full border border-coral/30 bg-coral/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-coral">
                  +{penalty} ms included
                </span>
              ) : null}
            </>
          ) : null}

          {phase === 'result' ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Round {Math.min(results.length, ROUNDS)} of {ROUNDS}
              </p>
              <p className="font-display text-4xl font-semibold tabular-nums text-ink">{lastMs ?? 0} ms</p>
              <p className="text-xs text-muted">
                {penalty > 0 ? `Includes ${penalty} ms false-start penalty` : 'Clean reaction'}
              </p>
              <span className="mt-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                {results.length >= ROUNDS ? 'Calculating average…' : 'Next round incoming…'}
              </span>
            </>
          ) : null}
        </button>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: ROUNDS }, (_, index) => {
            const value = results[index];
            const activeIndex = phase === 'result' ? Math.max(0, results.length - 1) : Math.min(round, ROUNDS) - 1;
            const isCurrent = phase !== 'over' && index === activeIndex;
            return (
              <div
                key={index}
                className={cn(
                  'rounded-xl border px-1 py-1.5 text-center',
                  value !== undefined
                    ? 'border-electric-500/25 bg-electric-500/10'
                    : isCurrent
                      ? 'border-white/15 bg-white/5'
                      : 'border-white/5 bg-white/5 opacity-60',
                )}
              >
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">R{index + 1}</p>
                <p
                  className={cn(
                    'font-display text-xs font-semibold tabular-nums',
                    value !== undefined ? 'text-electric-200' : 'text-muted',
                  )}
                >
                  {value ?? '—'}
                </p>
              </div>
            );
          })}
        </div>

        {phase === 'idle' ? (
          <div className="mt-3">
            <GameButton variant="primary" className="w-full" onClick={startRun}>
              <Play className="h-4 w-4" />
              Start run
            </GameButton>
          </div>
        ) : null}

        {phase !== 'idle' && phase !== 'over' && liveAverage !== null ? (
          <p className="mt-2 text-center text-xs text-muted">
            Live average <span className="font-semibold text-ink">{liveAverage} ms</span>
          </p>
        ) : null}

        {phase === 'over' ? (
          <GameOverlay tone="win" className="gap-2 p-3">
            <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">
              Run complete
            </span>
            <p className="font-display text-4xl font-semibold tabular-nums text-ink">{average ?? 0} ms</p>
            <p className="text-xs text-muted">Average across {ROUNDS} rounds</p>
            <div className="grid w-full max-w-[280px] grid-cols-5 gap-1">
              {results.map((result, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/5 px-1 py-1">
                  <p className="text-[9px] uppercase text-muted">R{index + 1}</p>
                  <p className="font-display text-[11px] font-semibold tabular-nums text-ink">{result}</p>
                </div>
              ))}
            </div>
            {newRecord ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">
                <Gauge className="h-3 w-3" aria-hidden="true" />
                New personal best
              </span>
            ) : (
              <p className="text-xs text-muted">Best average · {bestLabel}</p>
            )}
            <GameButton variant="primary" onClick={startRun}>
              <RotateCcw className="h-4 w-4" />
              Run again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
