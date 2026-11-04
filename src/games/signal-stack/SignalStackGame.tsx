import { Layers, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import {
  STACK_WIDTH,
  createStackState,
  dropBlock,
  startStack,
  topBlock,
  type StackState,
} from './simulation';

const BEST_KEY = 'neonrift:game:signal-stack:best';

export default function SignalStackGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<StackState>(createStackState);
  const [markerX, setMarkerX] = useState(0);
  const [paused, setPaused] = useState(false);
  const { best, submit } = useBestScore(BEST_KEY);
  const directionRef = useRef(1);
  const lastDropRef = useRef(0);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  const top = topBlock(state);
  const markerWidth = top.width;

  useEffect(() => {
    if (state.phase !== 'playing' || paused) return undefined;
    let frame = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      setMarkerX((current) => {
        let next = current + directionRef.current * state.speed * delta;
        const max = STACK_WIDTH - markerWidth;
        if (next > max) {
          next = max;
          directionRef.current = -1;
        } else if (next < 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [markerWidth, paused, state.phase, state.speed]);

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.score);
    onCompleteRef.current?.({ score: state.score, outcome: 'complete' });
  }, [state.phase, state.score, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startStack(current));
    setMarkerX(0);
    directionRef.current = 1;
    lastDropRef.current = 0;
    setPaused(false);
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createStackState());
    setMarkerX(0);
    directionRef.current = 1;
    setPaused(false);
  }, []);

  const drop = useCallback(() => {
    if (state.phase !== 'playing' || paused) return;
    const now = performance.now();
    if (now - lastDropRef.current < 120) return;
    lastDropRef.current = now;
    const next = dropBlock(state, markerX);
    setState(next);
    if (next.phase !== 'over') {
      setMarkerX(0);
      directionRef.current = 1;
    }
  }, [markerX, paused, state]);

  const dropRef = useRef(drop);
  dropRef.current = drop;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.code === 'Space' && state.phase === 'playing') {
        event.preventDefault();
        dropRef.current();
      }
      if (event.code === 'KeyP' && state.phase === 'playing') {
        event.preventDefault();
        setPaused((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, state.phase]);

  const win = state.blocks.length >= 20;
  const overlayOpen = state.phase !== 'playing' || paused;
  const status =
    state.phase === 'ready'
      ? 'Signal Stack ready. Drop the moving bar on the stack.'
      : state.phase === 'over'
        ? `Stack collapsed at ${state.blocks.length} blocks and ${state.score} points.`
        : `${state.blocks.length} blocks stacked. Current width ${Math.round(markerWidth)}. ${state.perfects} perfect drops.`;

  return (
    <GameFrame
      title="Signal Stack"
      subtitle="Drop on the line. Keep the signal alive."
      icon={Layers}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Blocks" value={state.blocks.length} tone="plasma" />
          <GameStat label="Score" value={state.score} tone="mint" />
          <GameStat label="Perfect" value={state.perfects} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'playing' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setPaused((current) => !current)}
              aria-label={paused ? 'Resume stack' : 'Pause stack'}
              title={paused ? 'Resume stack' : 'Pause stack'}
            >
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart stack" title="Restart stack">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Press Space or tap the board to drop. Perfect drops widen the next bar.</span>
          <span>Best: <b className="text-mint">{best === null ? '—' : `${best} points`}</b></span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div
            className="relative mx-auto h-[300px] w-full max-w-[520px] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-night-950/80"
            onClick={drop}
            role="presentation"
          >
            {state.blocks.map((block, index) => (
              <div
                key={index}
                className={cn(
                  'absolute h-[10px] rounded-sm border border-white/10',
                  index === state.blocks.length - 1
                    ? 'bg-gradient-to-r from-plasma-500 to-electric-500'
                    : 'bg-electric-500/40',
                )}
                style={{ left: `${block.x}%`, width: `${block.width}%`, bottom: `${index * 10}px` }}
              />
            ))}
            {state.phase === 'playing' ? (
              <div
                className="absolute h-[10px] rounded-sm border border-mint/60 bg-mint/80 shadow-[0_0_18px_rgba(74,222,157,0.7)]"
                style={{ left: `${markerX}%`, width: `${markerWidth}%`, bottom: `${state.blocks.length * 10 + 18}px` }}
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-night-950 to-transparent" />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] text-muted">
              Bar width shrinks to the overlap. A miss ends the run.
            </p>
            <GameButton variant="primary" size="sm" onClick={drop} disabled={state.phase !== 'playing' || paused}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Drop
            </GameButton>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              Timing puzzle
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Stack the signal to the sky</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              A bar slides across the board. Drop it on the block below; any overhang is cut away.
              Perfect drops widen the stack instead.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start stacking
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'playing' && paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Stack paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">Hold the line</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setPaused(false)}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Resume
              </GameButton>
              <GameButton variant="secondary" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restart
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {state.phase === 'over' ? (
          <GameOverlay tone={win ? 'win' : 'loss'}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-plasma-500/10 text-plasma-300">
              <Layers className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Signal tower complete' : 'Signal lost'}
            </h3>
            <p className="text-sm text-muted">
              {state.blocks.length} blocks · {state.score} points · {state.perfects} perfect.
            </p>
            <p className="text-[11px] text-muted">
              Best {best === null ? '—' : `${best} points`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Stack again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
