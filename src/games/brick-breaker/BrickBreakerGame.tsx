import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BrickWall, Heart, Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useVisibilityPause } from '../shared/useVisibilityPause';

const WIDTH = 640;
const HEIGHT = 480;
const PADDLE_WIDTH = 104;
const PADDLE_HEIGHT = 14;
const PADDLE_Y = HEIGHT - 36;
const BALL_RADIUS = 8;
const BASE_SPEED = 350;
const MAX_SPEED = 570;
const BRICK_ROWS = 5;
const BRICK_COLS = 9;
const BRICK_GAP = 5;
const BRICK_TOP = 58;
const BRICK_HEIGHT = 22;
const SIDE_PADDING = 24;
const BRICK_WIDTH = (WIDTH - SIDE_PADDING * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
const ROW_POINTS = [60, 50, 40, 30, 20];
const ROW_COLORS = ['#cbb0ff', '#b285ff', '#6ba4ff', '#4c8dff', '#4ade9d'];
const BEST_KEY = 'neonrift:game:brick-breaker:best';

type Phase = 'idle' | 'running' | 'paused' | 'over';
type Outcome = 'win' | 'loss';

interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
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

function circleIntersectsRect(
  circleX: number,
  circleY: number,
  radius: number,
  rectX: number,
  rectY: number,
  rectWidth: number,
  rectHeight: number,
): boolean {
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));
  const dx = circleX - closestX;
  const dy = circleY - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function buildBricks(): Brick[] {
  const bricks: Brick[] = [];

  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let column = 0; column < BRICK_COLS; column += 1) {
      bricks.push({
        x: SIDE_PADDING + column * (BRICK_WIDTH + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        row,
        alive: true,
      });
    }
  }

  return bricks;
}

export default function BrickBreakerGame({ onStart, onComplete }: GameComponentProps) {
  const { best, submit } = useBestScore(BEST_KEY);

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [newRecord, setNewRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const bricksRef = useRef<Brick[]>(buildBricks());
  const paddleXRef = useRef(WIDTH / 2);
  const ballRef = useRef<Ball>({
    x: WIDTH / 2,
    y: PADDLE_Y - BALL_RADIUS - 2,
    vx: 0,
    vy: 0,
  });
  const attachedRef = useRef(true);
  const launchAtRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const keysRef = useRef({ left: false, right: false });
  const finishedRef = useRef(false);
  const bestRef = useRef<number | null>(best);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishRef = useRef<(outcome: Outcome) => void>(() => undefined);

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

  const resetBall = useCallback((attached: boolean) => {
    const ball = ballRef.current;
    ball.x = paddleXRef.current;
    ball.y = PADDLE_Y - BALL_RADIUS - 2;

    if (attached) {
      ball.vx = 0;
      ball.vy = 0;
      attachedRef.current = true;
      launchAtRef.current = performance.now() + 1100;
    } else {
      const angle = (Math.random() - 0.5) * 0.7;
      const speed = speedRef.current;
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      attachedRef.current = false;
      launchAtRef.current = 0;
    }
  }, []);

  const finishRun = useCallback(
    (outcome: Outcome) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const finalScore = scoreRef.current;
      const record = finalScore > 0 && (bestRef.current === null || finalScore > bestRef.current);
      setNewRecord(record);
      setOutcome(outcome);
      setPhaseSafe('over');
      submit(finalScore);
      onCompleteRef.current?.({ score: finalScore, outcome });
    },
    [setPhaseSafe, submit],
  );

  useEffect(() => {
    finishRef.current = finishRun;
  }, [finishRun]);

  const startRun = () => {
    bricksRef.current = buildBricks();
    paddleXRef.current = WIDTH / 2;
    speedRef.current = BASE_SPEED;
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    setOutcome(null);
    setNewRecord(false);
    finishedRef.current = false;
    resetBall(false);
    setPhaseSafe('running');
    onStartRef.current?.();
  };

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'running') {
      setPhaseSafe('paused');
    } else if (phaseRef.current === 'paused') {
      setPhaseSafe('running');
    }
  }, [setPhaseSafe]);

  useVisibilityPause(togglePause, phase === 'running');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }

      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        keysRef.current.left = true;
      } else if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        keysRef.current.right = true;
      } else if (key === ' ' || key === 'spacebar') {
        if (event.repeat) return;
        if (phaseRef.current === 'running' || phaseRef.current === 'paused') {
          event.preventDefault();
          togglePause();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') keysRef.current.left = false;
      if (key === 'arrowright' || key === 'd') keysRef.current.right = false;
    };

    const handleBlur = () => {
      keysRef.current = { left: false, right: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [togglePause]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const launchBall = () => {
      const ball = ballRef.current;
      const angle = (Math.random() - 0.5) * 0.7;
      const speed = speedRef.current;
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      attachedRef.current = false;
    };

    const loseLife = (now: number) => {
      const nextLives = livesRef.current - 1;
      livesRef.current = nextLives;
      setLives(nextLives);
      speedRef.current = Math.max(BASE_SPEED, speedRef.current - 25);

      if (nextLives <= 0) {
        finishRef.current('loss');
        return;
      }

      resetBall(true);
      launchAtRef.current = now + 1200;
    };

    const update = (dt: number, now: number) => {
      const keys = keysRef.current;
      const paddleSpeed = 540;
      if (keys.left) paddleXRef.current -= paddleSpeed * dt;
      if (keys.right) paddleXRef.current += paddleSpeed * dt;

      const halfPaddle = PADDLE_WIDTH / 2;
      paddleXRef.current = Math.min(WIDTH - halfPaddle, Math.max(halfPaddle, paddleXRef.current));

      const ball = ballRef.current;

      if (attachedRef.current) {
        ball.x = paddleXRef.current;
        ball.y = PADDLE_Y - BALL_RADIUS - 2;
        ball.vx = 0;
        ball.vy = 0;
        if (now >= launchAtRef.current) launchBall();
        return;
      }

      const bricks = bricksRef.current;
      let remaining = Math.min(speedRef.current * dt, 70);

      while (remaining > 0.01) {
        const step = Math.min(4, remaining);
        remaining -= step;

        const previousX = ball.x;
        const previousY = ball.y;
        const currentSpeed = Math.hypot(ball.vx, ball.vy) || 1;
        ball.x += (ball.vx / currentSpeed) * step;
        ball.y += (ball.vy / currentSpeed) * step;

        if (ball.x - BALL_RADIUS < 0) {
          ball.x = BALL_RADIUS;
          ball.vx = Math.abs(ball.vx);
        } else if (ball.x + BALL_RADIUS > WIDTH) {
          ball.x = WIDTH - BALL_RADIUS;
          ball.vx = -Math.abs(ball.vx);
        }

        if (ball.y - BALL_RADIUS < 0) {
          ball.y = BALL_RADIUS;
          ball.vy = Math.abs(ball.vy);
        }

        const paddleLeft = paddleXRef.current - halfPaddle;
        const paddleRight = paddleXRef.current + halfPaddle;

        if (
          ball.vy > 0 &&
          ball.y + BALL_RADIUS >= PADDLE_Y &&
          ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
          ball.x >= paddleLeft - BALL_RADIUS &&
          ball.x <= paddleRight + BALL_RADIUS
        ) {
          ball.y = PADDLE_Y - BALL_RADIUS;
          const offset = Math.max(-1, Math.min(1, (ball.x - paddleXRef.current) / halfPaddle));
          const angle = offset * (Math.PI / 3);
          speedRef.current = Math.min(MAX_SPEED, speedRef.current + 5);
          ball.vx = Math.sin(angle) * speedRef.current;
          ball.vy = -Math.cos(angle) * speedRef.current;
        }

        for (const brick of bricks) {
          if (!brick.alive) continue;
          if (!circleIntersectsRect(ball.x, ball.y, BALL_RADIUS, brick.x, brick.y, brick.width, brick.height)) {
            continue;
          }

          brick.alive = false;
          scoreRef.current += ROW_POINTS[brick.row] ?? 10;
          setScore(scoreRef.current);

          const fromTopOrBottom =
            previousY + BALL_RADIUS <= brick.y || previousY - BALL_RADIUS >= brick.y + brick.height;
          const fromSide =
            previousX + BALL_RADIUS <= brick.x || previousX - BALL_RADIUS >= brick.x + brick.width;

          if (fromTopOrBottom) {
            ball.vy = -ball.vy;
          } else if (fromSide) {
            ball.vx = -ball.vx;
          } else {
            const overlapX = Math.min(
              ball.x + BALL_RADIUS - brick.x,
              brick.x + brick.width - (ball.x - BALL_RADIUS),
            );
            const overlapY = Math.min(
              ball.y + BALL_RADIUS - brick.y,
              brick.y + brick.height - (ball.y - BALL_RADIUS),
            );
            if (overlapY <= overlapX) {
              ball.vy = -ball.vy;
            } else {
              ball.vx = -ball.vx;
            }
          }

          ball.x = previousX;
          ball.y = previousY;

          if (bricks.every((item) => !item.alive)) {
            finishRef.current('win');
            return;
          }
          break;
        }

        if (ball.y - BALL_RADIUS > HEIGHT) {
          loseLife(now);
          return;
        }
      }
    };

    const draw = (time: number) => {
      const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      background.addColorStop(0, '#08101f');
      background.addColorStop(0.55, '#060b18');
      background.addColorStop(1, '#04070f');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const aura = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.38, 10, WIDTH / 2, HEIGHT * 0.45, WIDTH * 0.72);
      aura.addColorStop(0, 'rgba(76,141,255,0.09)');
      aura.addColorStop(1, 'rgba(5,8,20,0)');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = 'rgba(147,161,189,0.055)';
      ctx.lineWidth = 1;
      for (let x = 32; x < WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, HEIGHT);
        ctx.stroke();
      }
      for (let y = 32; y < HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(WIDTH, y + 0.5);
        ctx.stroke();
      }

      for (const brick of bricksRef.current) {
        if (!brick.alive) continue;
        ctx.fillStyle = ROW_COLORS[brick.row] ?? '#6ba4ff';
        roundedRectPath(ctx, brick.x, brick.y, brick.width, brick.height, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        roundedRectPath(ctx, brick.x + 4, brick.y + 3, brick.width - 8, 3, 1.5);
        ctx.fill();
      }

      const halfPaddleForDraw = PADDLE_WIDTH / 2;
      const paddleLeft = paddleXRef.current - halfPaddleForDraw;
      const paddleGradient = ctx.createLinearGradient(paddleLeft, 0, paddleLeft + PADDLE_WIDTH, 0);
      paddleGradient.addColorStop(0, '#2f6fed');
      paddleGradient.addColorStop(0.5, '#6ba4ff');
      paddleGradient.addColorStop(1, '#a06bff');

      ctx.save();
      ctx.shadowColor = 'rgba(76,141,255,0.65)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = paddleGradient;
      roundedRectPath(ctx, paddleLeft, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT, 7);
      ctx.fill();
      ctx.restore();

      const ball = ballRef.current;
      const pulse = 0.85 + Math.sin(time / 220) * 0.15;

      ctx.save();
      ctx.shadowColor = 'rgba(156,192,255,0.9)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#e3edff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(76,141,255,0.75)';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fill();

      if (attachedRef.current && phaseRef.current === 'running') {
        ctx.fillStyle = 'rgba(147,161,189,0.85)';
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Launching automatically…', WIDTH / 2, PADDLE_Y - 34);
      }
    };

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;

      if (phaseRef.current === 'running') update(dt, now);
      draw(now);

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [resetBall]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    paddleXRef.current = Math.min(WIDTH - PADDLE_WIDTH / 2, Math.max(PADDLE_WIDTH / 2, x));
  };

  const bestLabel = best === null ? '—' : best;
  const hearts = (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 3 }, (_, index) => (
        <Heart
          key={index}
          className={cn('h-3 w-3', index < lives ? 'text-coral' : 'text-white/15')}
          fill="currentColor"
          aria-hidden="true"
        />
      ))}
      <span className="ml-1">{lives}</span>
    </span>
  );

  const statusLabel =
    phase === 'running'
      ? `Playing. Score ${score}. ${lives} lives left.`
      : phase === 'paused'
        ? 'Game paused.'
        : phase === 'over'
          ? `Run over. Score ${score}.`
          : 'Ready to start.';

  return (
    <GameFrame
      title="Rift Breaker"
      subtitle="Clear every brick. Keep the ball alive."
      icon={BrickWall}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Score" value={score} tone="electric" />
          <GameStat label="Best" value={bestLabel} />
          <GameStat label="Lives" value={hearts} tone="coral" />
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
          <GameButton size="icon" variant="ghost" onClick={startRun} aria-label="Restart run" title="Restart run">
            <RotateCcw className="h-4 w-4" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span>or</span>
            <Kbd>A</Kbd>
            <Kbd>D</Kbd>
            <span>to move</span>
          </span>
          <span>Mouse / touch drag over the board.</span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Space</Kbd>
            <span>to pause</span>
          </span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="mx-auto w-full max-w-[520px]">
        <div
          role="application"
          tabIndex={0}
          aria-label="Breakout game area. Move the paddle with the left and right arrow keys or A and D, with the mouse, or by dragging on touch screens. Press Space to pause."
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-night-950 shadow-[inset_0_0_50px_rgba(76,141,255,0.05)]"
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            className="block h-auto w-full touch-none select-none"
          />

          {phase === 'idle' ? (
            <GameOverlay>
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-electric-500/30 bg-electric-500/10 text-electric-300">
                <BrickWall className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-display text-xl font-semibold text-ink">Break the rift</p>
              <p className="max-w-[17rem] text-xs leading-relaxed text-muted">
                Five rows, three lives. Angle the ball with the paddle and clear every brick — higher rows
                score more.
              </p>
              <GameButton variant="primary" onClick={startRun}>
                <Play className="h-4 w-4" />
                Start run
              </GameButton>
            </GameOverlay>
          ) : null}

          {phase === 'paused' ? (
            <GameOverlay>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-electric-500/30 bg-electric-500/10 text-electric-300">
                <Pause className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="font-display text-lg font-semibold">Paused</p>
              <p className="text-xs text-muted">The ball is holding position.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <GameButton variant="primary" onClick={togglePause}>
                  <Play className="h-4 w-4" />
                  Resume
                </GameButton>
                <GameButton variant="secondary" onClick={startRun}>
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'over' ? (
            <GameOverlay tone={outcome === 'win' ? 'win' : 'loss'} className="gap-2 p-3">
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                {outcome === 'win' ? 'Rift cleared' : 'Run ended'}
              </span>
              <Trophy className={cn('h-5 w-5', outcome === 'win' ? 'text-mint' : 'text-coral')} aria-hidden="true" />
              <p className="font-display text-3xl font-semibold tabular-nums text-ink">{score}</p>
              <p className="text-xs text-muted">
                Score {score} · Best {Math.max(best ?? 0, score)}
              </p>
              {newRecord ? (
                <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">
                  New personal best
                </span>
              ) : null}
              <GameButton variant="primary" onClick={startRun}>
                <RotateCcw className="h-4 w-4" />
                Play again
              </GameButton>
            </GameOverlay>
          ) : null}
        </div>
      </div>
    </GameFrame>
  );
}
