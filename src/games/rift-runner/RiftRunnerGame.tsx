import { Gauge, Pause, Play, RotateCcw, Rocket, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useReducedMotion } from '../shared/motion';
import { useBestScore } from '../shared/useBestScore';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { drawRunnerScene } from './renderer';
import {
  createRunnerState,
  runnerJump,
  runnerStep,
  type RunnerState,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-runner:best';
const HUD_INTERVAL_MS = 100;

type Phase = 'ready' | 'playing' | 'over';

export default function RiftRunnerGame({ onStart, onComplete }: GameComponentProps) {
  const [view, setView] = useState<RunnerState>(createRunnerState);
  const [phase, setPhase] = useState<Phase>('ready');
  const [paused, setPaused] = useState(false);
  const { best, submit } = useBestScore(BEST_KEY);
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<RunnerState>(view);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    contextRef.current = canvas.getContext('2d');
    if (contextRef.current) drawRunnerScene(contextRef.current, canvas, stateRef.current, reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (canvas && context) drawRunnerScene(context, canvas, view, reduceMotion);
  }, [reduceMotion, view]);

  useEffect(() => {
    if (phase !== 'playing' || paused) return undefined;
    let raf = 0;
    let last = performance.now();
    let lastHud = last;

    const loop = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = runnerStep(stateRef.current, delta);
      stateRef.current = next;

      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (canvas && context) drawRunnerScene(context, canvas, next, reduceMotion);

      if (!next.alive) {
        setView(next);
        setPhase('over');
        return;
      }

      if (now - lastHud >= HUD_INTERVAL_MS) {
        lastHud = now;
        setView(next);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, phase, reduceMotion]);

  useEffect(() => {
    if (phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(view.score);
    onCompleteRef.current?.({ score: view.score, outcome: 'complete' });
  }, [phase, submit, view.score]);

  const reset = useCallback(() => {
    const fresh = createRunnerState();
    stateRef.current = fresh;
    setView(fresh);
  }, []);

  const begin = useCallback(() => {
    finishedRef.current = false;
    reset();
    setPhase('playing');
    setPaused(false);
    onStartRef.current?.();
  }, [reset]);

  const restart = useCallback(() => {
    finishedRef.current = false;
    reset();
    setPhase('ready');
    setPaused(false);
  }, [reset]);

  const jump = useCallback(() => {
    stateRef.current = runnerJump(stateRef.current);
    setView(stateRef.current);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  const pauseForVisibility = useCallback(() => {
    setPaused(true);
  }, []);

  useVisibilityPause(pauseForVisibility, phase === 'playing');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || isInteractiveTarget(event.target)) return;
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        if (phase === 'playing' && !paused) {
          event.preventDefault();
          jump();
        }
      }
      if (event.code === 'KeyP' && phase === 'playing') {
        event.preventDefault();
        togglePause();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jump, paused, phase, togglePause]);

  const overlayOpen = phase !== 'playing' || paused;
  const status =
    phase === 'ready'
      ? 'Runner ready. Press Space, Arrow Up, W or tap to jump.'
      : phase === 'over'
        ? `Run ended with a score of ${view.score} after ${Math.round(view.distance)} metres.`
        : `${view.score} points, ${view.passed} obstacles cleared, speed ${Math.round(view.speed)}.`;

  return (
    <GameFrame
      title="Rift Runner"
      subtitle="Jump the signal. Outrun the dark."
      icon={Rocket}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Score" value={view.score} tone="mint" />
          <GameStat label="Distance" value={`${Math.round(view.distance)}m`} />
          <GameStat label="Best" value={best === null ? '—' : best} tone="electric" />
        </div>
      }
      toolbar={
        <>
          {phase === 'playing' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={togglePause}
              aria-label={paused ? 'Resume run' : 'Pause run'}
              title={paused ? 'Resume run' : 'Pause run'}
            >
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart run" title="Restart run">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Space / Arrow Up / W to jump. P pauses. Touch the runner or use the Jump button.</span>
          <span>Cleared obstacles add 10 points.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-night-950">
            <canvas
              ref={canvasRef}
              onClick={jump}
              className="block h-auto w-full touch-none"
              aria-label="Rift Runner. Press Space, Arrow Up or W to jump over obstacles."
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted">
              Speed {Math.round(view.speed)} · obstacles cleared {view.passed}
            </p>
            <GameButton variant="primary" size="sm" onClick={jump} disabled={phase !== 'playing' || paused}>
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              Jump
            </GameButton>
          </div>
        </div>

        {phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-electric-300">
              Endless arcade run
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Outrun the closing dark</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Jump the neon barriers and keep the runner alive. Speed rises with distance and the
              tall barriers come in threes.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start run
            </GameButton>
          </GameOverlay>
        ) : null}

        {phase === 'playing' && paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Run paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">Hold the line</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={togglePause}>
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

        {phase === 'over' ? (
          <GameOverlay tone="loss">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-coral/10 text-coral">
              <Rocket className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">Run ended</h3>
            <p className="text-sm text-muted">
              Score <b className="text-ink">{view.score}</b> · {Math.round(view.distance)} metres ·{' '}
              {view.passed} cleared.
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Trophy className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
              Best {best === null ? '—' : `${best} points`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Run again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
