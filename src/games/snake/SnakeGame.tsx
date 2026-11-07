import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useBestScore } from '../shared/useBestScore';
import { useVisibilityPause } from '../shared/useVisibilityPause';

const GRID_SIZE = 20;
const BASE_TICK = 150;
const MIN_TICK = 62;
const BEST_KEY = 'neonrift:game:snake:best';

interface Point {
  x: number;
  y: number;
}

type Phase = 'idle' | 'running' | 'paused' | 'over';

const UP: Point = { x: 0, y: -1 };
const DOWN: Point = { x: 0, y: 1 };
const LEFT: Point = { x: -1, y: 0 };
const RIGHT: Point = { x: 1, y: 0 };

function initialSnake(): Point[] {
  const center = Math.floor(GRID_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

function spawnFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const free: Point[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }

  return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : { x: -1, y: -1 };
}

function tickInterval(score: number): number {
  return Math.max(MIN_TICK, BASE_TICK - score * 4.5);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function SnakeGame({ onStart, onComplete }: GameComponentProps) {
  const { best, submit } = useBestScore(BEST_KEY);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [newRecord, setNewRecord] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const bestRef = useRef<number | null>(best);
  const snakeRef = useRef<Point[]>(initialSnake());
  const foodRef = useRef<Point>(spawnFood(snakeRef.current));
  const dirRef = useRef<Point>(RIGHT);
  const queueRef = useRef<Point[]>([]);
  const touchOriginRef = useRef<Point | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishRef = useRef<(outcome: 'win' | 'loss') => void>(() => undefined);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    bestRef.current = best;
  }, [best]);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const beginRun = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    if (!startedRef.current) {
      startedRef.current = true;
      onStartRef.current?.();
    }
    changePhase('running');
  }, [changePhase]);

  const turn = useCallback(
    (direction: Point) => {
      if (phaseRef.current === 'idle') {
        const current = dirRef.current;
        if (!(direction.x === -current.x && direction.y === -current.y)) {
          queueRef.current.push(direction);
        }
        beginRun();
        return;
      }

      if (phaseRef.current !== 'running') return;

      const queue = queueRef.current;
      const base = queue.length > 0 ? queue[queue.length - 1] : dirRef.current;
      if (base.x === direction.x && base.y === direction.y) return;
      if (base.x === -direction.x && base.y === -direction.y) return;
      if (queue.length >= 3) return;
      queue.push(direction);
    },
    [beginRun],
  );

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'running') {
      changePhase('paused');
    } else if (phaseRef.current === 'paused') {
      changePhase('running');
    }
  }, [changePhase]);

  useVisibilityPause(togglePause, phase === 'running');

  // The idle overlay returns focus to the frame when it closes, so the board
  // claims the keyboard after that cleanup has run.
  useEffect(() => {
    if (phase === 'running') boardRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const resetRun = useCallback(() => {
    snakeRef.current = initialSnake();
    dirRef.current = RIGHT;
    queueRef.current = [];
    foodRef.current = spawnFood(snakeRef.current);
    scoreRef.current = 0;
    setScore(0);
    setNewRecord(false);
    startedRef.current = false;
    finishedRef.current = false;
    changePhase('idle');
  }, [changePhase]);

  const restartRun = useCallback(() => {
    resetRun();
    beginRun();
  }, [beginRun, resetRun]);

  const finishRun = useCallback(
    (outcome: 'win' | 'loss') => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const finalScore = scoreRef.current;
      const record = finalScore > 0 && (bestRef.current === null || finalScore > bestRef.current);
      setNewRecord(record);
      submit(finalScore);
      changePhase('over');
      onCompleteRef.current?.({ score: finalScore, outcome });
    },
    [changePhase, submit],
  );

  useEffect(() => {
    finishRef.current = finishRun;
  }, [finishRun]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;

    const step = () => {
      const queued = queueRef.current.shift();
      if (queued) dirRef.current = queued;

      const snake = snakeRef.current;
      const head = snake[0];
      const next = { x: head.x + dirRef.current.x, y: head.y + dirRef.current.y };

      if (next.x < 0 || next.x >= GRID_SIZE || next.y < 0 || next.y >= GRID_SIZE) {
        finishRef.current('loss');
        return;
      }

      const food = foodRef.current;
      const willEat = next.x === food.x && next.y === food.y;
      const bodyLimit = willEat ? snake.length : snake.length - 1;

      for (let i = 0; i < bodyLimit; i += 1) {
        if (snake[i].x === next.x && snake[i].y === next.y) {
          finishRef.current('loss');
          return;
        }
      }

      const nextSnake = [next, ...snake];

      if (willEat) {
        const nextScore = scoreRef.current + 1;
        scoreRef.current = nextScore;
        setScore(nextScore);
        snakeRef.current = nextSnake;

        if (nextSnake.length >= GRID_SIZE * GRID_SIZE) {
          foodRef.current = { x: -1, y: -1 };
          finishRef.current('win');
          return;
        }

        foodRef.current = spawnFood(nextSnake);
      } else {
        nextSnake.pop();
        snakeRef.current = nextSnake;
      }
    };

    const draw = (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const size = Math.floor(Math.min(rect.width, rect.height));
      if (size < 8) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const buffer = Math.max(1, Math.round(size * dpr));
      if (canvas.width !== buffer || canvas.height !== buffer) {
        canvas.width = buffer;
        canvas.height = buffer;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const background = ctx.createLinearGradient(0, 0, size, size);
      background.addColorStop(0, '#060b18');
      background.addColorStop(0.55, '#081022');
      background.addColorStop(1, '#0c1428');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size, size);

      const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.75);
      vignette.addColorStop(0, 'rgba(76,141,255,0.06)');
      vignette.addColorStop(1, 'rgba(5,8,20,0)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = 'rgba(147,161,189,0.09)';
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID_SIZE; i += 1) {
        const position = Math.round((i * size) / GRID_SIZE) + 0.5;
        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, position);
        ctx.lineTo(size, position);
        ctx.stroke();
      }

      const cell = size / GRID_SIZE;
      const food = foodRef.current;

      if (food.x >= 0) {
        const fx = (food.x + 0.5) * cell;
        const fy = (food.y + 0.5) * cell;
        const pulse = 0.75 + Math.sin(time / 260) * 0.15;

        ctx.save();
        ctx.shadowColor = 'rgba(74,222,157,0.85)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#4ade9d';
        ctx.beginPath();
        ctx.arc(fx, fy, cell * 0.26 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(238,242,255,0.85)';
        ctx.beginPath();
        ctx.arc(fx - cell * 0.07, fy - cell * 0.07, cell * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }

      const snake = snakeRef.current;
      if (snake.length > 0) {
        const head = snake[0];
        const tail = snake[snake.length - 1];
        const bodyGradient = ctx.createLinearGradient(
          (head.x + 0.5) * cell,
          (head.y + 0.5) * cell,
          (tail.x + 0.5) * cell,
          (tail.y + 0.5) * cell,
        );
        bodyGradient.addColorStop(0, '#d7e6ff');
        bodyGradient.addColorStop(0.35, '#6ba4ff');
        bodyGradient.addColorStop(1, '#a06bff');

        ctx.save();
        ctx.shadowColor = 'rgba(76,141,255,0.55)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = bodyGradient;
        for (let i = snake.length - 1; i >= 0; i -= 1) {
          const segment = snake[i];
          roundedRectPath(
            ctx,
            segment.x * cell + 1.5,
            segment.y * cell + 1.5,
            cell - 3,
            cell - 3,
            Math.max(3, cell * 0.26),
          );
          ctx.fill();
        }
        ctx.restore();

        const direction = dirRef.current;
        const centerX = (head.x + 0.5) * cell + direction.x * cell * 0.16;
        const centerY = (head.y + 0.5) * cell + direction.y * cell * 0.16;
        const perpX = -direction.y;
        const perpY = direction.x;
        const eyeRadius = Math.max(1.1, cell * 0.055);

        ctx.fillStyle = '#050814';
        ctx.beginPath();
        ctx.arc(centerX + perpX * cell * 0.17, centerY + perpY * cell * 0.17, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX - perpX * cell * 0.17, centerY - perpY * cell * 0.17, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const delta = Math.min(Math.max(now - last, 0), 240);
      last = now;

      if (phaseRef.current === 'running') {
        accumulator = Math.min(accumulator + delta, 240);
        let safety = 0;
        while (accumulator >= tickInterval(scoreRef.current) && safety < 5) {
          accumulator -= tickInterval(scoreRef.current);
          step();
          safety += 1;
          if (phaseRef.current !== 'running') {
            accumulator = 0;
            break;
          }
        }
      } else {
        accumulator = 0;
      }

      draw(now);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      // Buttons and links keep their own activation keys; the board only hears
      // keys that were not aimed at a control.
      if (isInteractiveTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const directions: Record<string, Point> = {
        arrowup: UP,
        w: UP,
        arrowdown: DOWN,
        s: DOWN,
        arrowleft: LEFT,
        a: LEFT,
        arrowright: RIGHT,
        d: RIGHT,
      };

      const direction = directions[key];
      if (direction) {
        // Arrows only steer while a run is on or about to start; otherwise they
        // keep their native scrolling behaviour.
        if (phaseRef.current !== 'idle' && phaseRef.current !== 'running') return;
        event.preventDefault();
        turn(direction);
        return;
      }

      if (key === ' ' || key === 'spacebar') {
        if (phaseRef.current === 'running' || phaseRef.current === 'paused') {
          event.preventDefault();
          togglePause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePause, turn]);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchOriginRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const origin = touchOriginRef.current;
    touchOriginRef.current = null;
    if (!origin) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      turn({ x: dx > 0 ? 1 : -1, y: 0 });
    } else {
      turn({ x: 0, y: dy > 0 ? 1 : -1 });
    }
  };

  const speedMultiplier = (BASE_TICK / tickInterval(score)).toFixed(1);
  const bestLabel = best === null ? '—' : best;
  const statusLabel =
    phase === 'running'
      ? 'Run in progress'
      : phase === 'paused'
        ? 'Game paused'
        : phase === 'over'
          ? `Run over. Score ${score}.`
          : 'Ready to start';

  return (
    <GameFrame
      title="Neon Snake"
      subtitle="Grow the glow. Don't bite yourself."
      icon={Gamepad2}
      accent="mint"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Score" value={score} tone="mint" />
          <GameStat label="Best" value={bestLabel} />
          <GameStat label="Speed" value={`${speedMultiplier}x`} tone="electric" />
        </div>
      }
      toolbar={
        <>
          <GameButton
            size="icon"
            variant="secondary"
            onClick={togglePause}
            disabled={phase !== 'running' && phase !== 'paused'}
            aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
            title={phase === 'paused' ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </GameButton>
          <GameButton
            size="icon"
            variant="ghost"
            onClick={restartRun}
            aria-label="Restart run"
            title="Restart run"
          >
            <RotateCcw className="h-4 w-4" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span>or</span>
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd>
            <span>to steer</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Space</Kbd>
            <span>to pause</span>
          </span>
          <span>Swipe or use the on-screen pad on touch.</span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="mx-auto w-full max-w-[380px]">
        <div
          ref={boardRef}
          role="application"
          tabIndex={0}
          aria-label="Snake game area, 20 by 20 grid. Use arrow keys or W A S D to steer, Space to pause, or swipe on touch screens."
          onPointerDown={() => boardRef.current?.focus()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-night-950 shadow-[inset_0_0_40px_rgba(76,141,255,0.06)]"
        >
          <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

          {phase === 'idle' ? (
            <GameOverlay>
              <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">
                Ready
              </span>
              <p className="font-display text-xl font-semibold text-ink">Thread the neon grid</p>
              <p className="max-w-[16rem] text-xs leading-relaxed text-muted">
                Collect orbs to grow. Walls and your own tail end the run — speed climbs with every bite.
              </p>
              <GameButton variant="primary" onClick={beginRun}>
                <Play className="h-4 w-4" />
                Start run
              </GameButton>
              <p className="text-[10px] text-muted">Arrows / WASD · Swipe · D-pad</p>
            </GameOverlay>
          ) : null}

          {phase === 'paused' ? (
            <GameOverlay>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-electric-500/30 bg-electric-500/10 text-electric-300">
                <Pause className="h-5 w-5" />
              </span>
              <p className="font-display text-lg font-semibold">Paused</p>
              <p className="text-xs text-muted">The grid is holding its breath.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <GameButton variant="primary" onClick={togglePause}>
                  <Play className="h-4 w-4" />
                  Resume
                </GameButton>
                <GameButton variant="secondary" onClick={restartRun}>
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'over' ? (
            <GameOverlay tone="loss">
              <span className="rounded-full border border-coral/30 bg-coral/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-coral">
                Run ended
              </span>
              <p className="font-display text-4xl font-semibold tabular-nums text-ink">{score}</p>
              <p className="text-xs text-muted">
                Score {score} · Best {Math.max(best ?? 0, score)}
              </p>
              {newRecord ? (
                <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">
                  New personal best
                </span>
              ) : null}
              <GameButton variant="primary" onClick={restartRun}>
                <RotateCcw className="h-4 w-4" />
                Play again
              </GameButton>
            </GameOverlay>
          ) : null}
        </div>

        <div className="mt-3 grid w-40 grid-cols-3 gap-1.5 sm:hidden" aria-label="On-screen direction pad">
          <span aria-hidden="true" />
          <GameButton size="icon" variant="secondary" aria-label="Move up" onClick={() => turn(UP)}>
            <ArrowUp className="h-4 w-4" />
          </GameButton>
          <span aria-hidden="true" />
          <GameButton size="icon" variant="secondary" aria-label="Move left" onClick={() => turn(LEFT)}>
            <ArrowLeft className="h-4 w-4" />
          </GameButton>
          <GameButton
            size="icon"
            variant="ghost"
            aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
            onClick={togglePause}
            disabled={phase !== 'running' && phase !== 'paused'}
          >
            {phase === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </GameButton>
          <GameButton size="icon" variant="secondary" aria-label="Move right" onClick={() => turn(RIGHT)}>
            <ArrowRight className="h-4 w-4" />
          </GameButton>
          <span aria-hidden="true" />
          <GameButton size="icon" variant="secondary" aria-label="Move down" onClick={() => turn(DOWN)}>
            <ArrowDown className="h-4 w-4" />
          </GameButton>
          <span aria-hidden="true" />
        </div>
      </div>
    </GameFrame>
  );
}
