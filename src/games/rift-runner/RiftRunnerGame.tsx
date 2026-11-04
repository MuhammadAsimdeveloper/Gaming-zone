import { Gauge, Pause, Play, RotateCcw, Rocket, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import {
  RUNNER_GROUND,
  RUNNER_HEIGHT,
  RUNNER_PLAYER_HEIGHT,
  RUNNER_PLAYER_WIDTH,
  RUNNER_PLAYER_X,
  RUNNER_WIDTH,
  createRunnerState,
  runnerJump,
  runnerStep,
  type RunnerState,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-runner:best';

type Phase = 'ready' | 'playing' | 'over';

export default function RiftRunnerGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<RunnerState>(createRunnerState);
  const [phase, setPhase] = useState<Phase>('ready');
  const [paused, setPaused] = useState(false);
  const { best, submit } = useBestScore(BEST_KEY);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    if (phase !== 'playing' || paused) return undefined;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      setState((current) => runnerStep(current, delta));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, phase]);

  useEffect(() => {
    if (!state.alive && phase === 'playing') setPhase('over');
  }, [phase, state.alive]);

  useEffect(() => {
    if (phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.score);
    onCompleteRef.current?.({ score: state.score, outcome: 'complete' });
  }, [phase, state.score, submit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = RUNNER_WIDTH;
    const height = RUNNER_HEIGHT;
    canvas.width = width;
    canvas.height = height;

    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#050814');
    sky.addColorStop(0.65, '#081a2b');
    sky.addColorStop(1, '#0a241f');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(255,255,255,0.5)';
    for (let index = 0; index < 26; index += 1) {
      const x = (index * 97 + 41) % width;
      const y = (index * 53 + 29) % (RUNNER_GROUND - 60);
      context.globalAlpha = 0.15 + (index % 5) * 0.08;
      context.fillRect(x, y, 2, 2);
    }
    context.globalAlpha = 1;

    context.fillStyle = 'rgba(74,222,157,0.09)';
    for (let x = 0; x < width; x += 48) context.fillRect(x, 0, 1, RUNNER_GROUND);
    for (let y = 0; y < RUNNER_GROUND; y += 48) context.fillRect(0, y, width, 1);

    context.fillStyle = '#0b1a22';
    context.fillRect(0, RUNNER_GROUND, width, height - RUNNER_GROUND);
    context.fillStyle = '#4ade9d';
    context.fillRect(0, RUNNER_GROUND, width, 2);
    context.fillStyle = 'rgba(74,222,157,0.18)';
    for (let x = -((state.distance * 0.8) % 64); x < width; x += 64) {
      context.fillRect(x, RUNNER_GROUND + 18, 34, 3);
    }

    for (const obstacle of state.obstacles) {
      const top = RUNNER_GROUND - obstacle.height;
      context.fillStyle = '#ff6b81';
      context.shadowColor = '#ff6b81';
      context.shadowBlur = 12;
      context.fillRect(obstacle.x, top, obstacle.width, obstacle.height);
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(obstacle.x + 4, top + 4, obstacle.width - 8, 3);
    }

    const playerTop = RUNNER_GROUND - state.y - RUNNER_PLAYER_HEIGHT;
    context.fillStyle = '#4c8dff';
    context.shadowColor = '#4c8dff';
    context.shadowBlur = 18;
    context.beginPath();
    context.roundRect(RUNNER_PLAYER_X, playerTop, RUNNER_PLAYER_WIDTH, RUNNER_PLAYER_HEIGHT, 8);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#eaffff';
    context.fillRect(RUNNER_PLAYER_X + 7, playerTop + 9, 14, 5);
    context.fillStyle = '#0b1120';
    context.fillRect(RUNNER_PLAYER_X + 8, playerTop + 29, 4, 8);
    context.fillRect(RUNNER_PLAYER_X + 18, playerTop + 29, 4, 8);
  }, [state]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState(createRunnerState());
    setPhase('playing');
    setPaused(false);
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createRunnerState());
    setPhase('ready');
    setPaused(false);
  }, []);

  const jump = useCallback(() => {
    setState((current) => runnerJump(current));
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
        ? `Run ended with a score of ${state.score} after ${Math.round(state.distance)} metres.`
        : `${state.score} points, ${state.passed} obstacles cleared, speed ${Math.round(state.speed)}.`;

  return (
    <GameFrame
      title="Rift Runner"
      subtitle="Jump the signal. Outrun the dark."
      icon={Rocket}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Score" value={state.score} tone="mint" />
          <GameStat label="Distance" value={`${Math.round(state.distance)}m`} />
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
              Speed {Math.round(state.speed)} · obstacles cleared {state.passed}
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
              Score <b className="text-ink">{state.score}</b> · {Math.round(state.distance)} metres ·{' '}
              {state.passed} cleared.
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
