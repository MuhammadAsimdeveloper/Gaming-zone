import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Gauge,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Target,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameComponentProps } from '../../../types/game';
import { cn } from '../../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameSegmented, GameStat, type SegmentOption } from '../../shared/GameFrame';
import { isInteractiveTarget } from '../../shared/keyboard';
import { useVisibilityPause } from '../../shared/useVisibilityPause';
import { SportsAudio } from '../shared/audio';
import {
  accuracy,
  adjustAim,
  createHoopGame,
  shootBall,
  stepGame,
  streakMultiplier,
  type HoopDifficulty,
  type HoopEvent,
  type HoopPhase,
  type HoopState,
  type ShotResult,
} from './simulation';
import { drawHoopScene } from './renderer';
import {
  EMPTY_RECORDS,
  loadRecords,
  loadSettings,
  recordGame,
  saveRecords,
  saveSettings,
  type HoopRecords,
  type HoopSettings,
} from './persistence';

type Phase = 'menu' | 'playing' | 'paused' | 'finished';

interface Snapshot {
  gamePhase: HoopPhase;
  timeLeft: number;
  score: number;
  streak: number;
  bestStreak: number;
  makes: number;
  shots: number;
  swishes: number;
  message: string;
  lastResult: ShotResult | null;
  lastPoints: number;
}

interface RoundResult {
  score: number;
  makes: number;
  shots: number;
  swishes: number;
  bestStreak: number;
  accuracy: number;
}

const EMPTY_SNAPSHOT: Snapshot = {
  gamePhase: 'aim',
  timeLeft: 60,
  score: 0,
  streak: 0,
  bestStreak: 0,
  makes: 0,
  shots: 0,
  swishes: 0,
  message: 'Line up your shot.',
  lastResult: null,
  lastPoints: 0,
};

const DIFFICULTY_OPTIONS: ReadonlyArray<SegmentOption<HoopDifficulty>> = [
  { value: 'rookie', label: 'Rookie' },
  { value: 'pro', label: 'Pro' },
  { value: 'allstar', label: 'All-Star' },
];

function clockLabel(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function snapshotOf(state: HoopState): Snapshot {
  return {
    gamePhase: state.phase,
    timeLeft: Math.ceil(state.timeLeft),
    score: state.score,
    streak: state.streak,
    bestStreak: state.bestStreak,
    makes: state.makes,
    shots: state.shots,
    swishes: state.swishes,
    message: state.message,
    lastResult: state.lastResult,
    lastPoints: state.lastPoints,
  };
}

function signatureOf(snapshot: Snapshot): string {
  return [
    snapshot.gamePhase,
    snapshot.timeLeft,
    snapshot.score,
    snapshot.streak,
    snapshot.makes,
    snapshot.shots,
    snapshot.message,
  ].join('|');
}

export default function HoopCircuitGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<HoopState | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const audioRef = useRef<SportsAudio | null>(null);
  const finishedRef = useRef(false);
  const phaseRef = useRef<Phase>('menu');
  const signatureRef = useRef('');
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<Phase>('menu');
  const [settings, setSettings] = useState<HoopSettings>(() => loadSettings());
  const [records, setRecords] = useState<HoopRecords>(EMPTY_RECORDS);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [isBest, setIsBest] = useState(false);

  if (stateRef.current === null) {
    stateRef.current = createHoopGame(settings.difficulty);
  }

  phaseRef.current = phase;

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const state = stateRef.current;
    if (!canvas || !context || !state) return;
    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    drawHoopScene(context, width, height, state);
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    sizeRef.current = { width, height };
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [resize]);

  const applySnapshot = useCallback((state: HoopState) => {
    const next = snapshotOf(state);
    const signature = signatureOf(next);
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setSnapshot(next);
  }, []);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    const state = stateRef.current;
    if (!state) return;
    finishedRef.current = true;
    const summary = recordGame(loadRecords(), {
      score: state.score,
      streak: state.bestStreak,
      makes: state.makes,
      shots: state.shots,
    });
    saveRecords(summary.records);
    setRecords(summary.records);
    setIsBest(summary.isBest);
    setResult({
      score: state.score,
      makes: state.makes,
      shots: state.shots,
      swishes: state.swishes,
      bestStreak: state.bestStreak,
      accuracy: accuracy(state),
    });
    applySnapshot(state);
    setPhase('finished');
    onCompleteRef.current?.({ score: state.score, outcome: 'complete' });
  }, [applySnapshot]);

  const handleEvent = useCallback(
    (event: HoopEvent, state: HoopState) => {
      if (event === 'over') {
        audioRef.current?.whistle();
        finishGame();
        return;
      }
      if (event === 'score') {
        if (state.lastResult === 'swish') audioRef.current?.score();
        else audioRef.current?.bounce();
      } else if (event === 'miss') {
        audioRef.current?.miss();
      }
      applySnapshot(state);
    },
    [applySnapshot, finishGame],
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const state = stateRef.current;
      if (!state) return;
      const events = stepGame(state, delta);
      for (const event of events) handleEvent(event, state);
      applySnapshot(state);
      draw();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, draw, handleEvent, applySnapshot]);

  const start = useCallback(() => {
    const state = createHoopGame(settings.difficulty);
    stateRef.current = state;
    signatureRef.current = '';
    finishedRef.current = false;
    applySnapshot(state);
    setResult(null);
    setIsBest(false);

    let audio = audioRef.current;
    if (!audio) {
      audio = new SportsAudio();
      audioRef.current = audio;
    }
    audio.start();
    if (audio.isMuted !== settings.muted) audio.toggleMute();

    setPhase('playing');
    onStartRef.current?.();
  }, [applySnapshot, settings.difficulty, settings.muted]);

  const chooseSetup = useCallback(() => {
    finishedRef.current = false;
    stateRef.current = createHoopGame(settings.difficulty);
    signatureRef.current = signatureOf(EMPTY_SNAPSHOT);
    setSnapshot(EMPTY_SNAPSHOT);
    setResult(null);
    setIsBest(false);
    setPhase('menu');
    draw();
  }, [draw, settings.difficulty]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      audioRef.current?.suspend();
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      audioRef.current?.resume();
      setPhase('playing');
    }
  }, []);

  useVisibilityPause(togglePause, phase === 'playing');

  const nudge = useCallback(
    (deltaAngle: number, deltaPower: number) => {
      const state = stateRef.current;
      if (!state || phaseRef.current !== 'playing' || state.phase !== 'aim') return;
      adjustAim(state, deltaAngle, deltaPower);
      draw();
    },
    [draw],
  );

  const shootNow = useCallback(() => {
    const state = stateRef.current;
    if (!state || phaseRef.current !== 'playing') return;
    if (!shootBall(state)) return;
    audioRef.current?.kick(0.5 + state.power * 0.5);
    applySnapshot(state);
  }, [applySnapshot]);

  const toggleMute = useCallback(() => {
    const nextMuted = !settings.muted;
    const audio = audioRef.current;
    if (audio && audio.isMuted !== nextMuted) audio.toggleMute();
    const updated = { ...settings, muted: nextMuted };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  const changeDifficulty = useCallback((difficulty: HoopDifficulty) => {
    setSettings((current) => {
      const updated = { ...current, difficulty };
      saveSettings(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          event.preventDefault();
          nudge(2, 0);
          return;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          nudge(-2, 0);
          return;
        case 'ArrowRight':
        case 'KeyD':
          event.preventDefault();
          nudge(0, 0.05);
          return;
        case 'ArrowLeft':
        case 'KeyA':
          event.preventDefault();
          nudge(0, -0.05);
          return;
        case 'Space':
          event.preventDefault();
          shootNow();
          return;
        case 'KeyP':
        case 'Escape':
          event.preventDefault();
          togglePause();
          return;
        case 'KeyM':
          event.preventDefault();
          toggleMute();
          return;
        default:
          return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudge, shootNow, toggleMute, togglePause]);

  const canShoot = phase === 'playing' && snapshot.gamePhase === 'aim';
  const multiplier = streakMultiplier(snapshot.streak);
  const accuracyPct = snapshot.shots === 0 ? 0 : Math.round((snapshot.makes / snapshot.shots) * 100);

  const status =
    phase === 'menu'
      ? 'Choose a difficulty, then tip off.'
      : phase === 'finished' && result
        ? `Round over. ${result.score} points from ${result.makes} of ${result.shots} shots.`
        : `${snapshot.message} ${snapshot.score} points, ${clockLabel(snapshot.timeLeft)} left.`;

  return (
    <GameFrame
      title="Hoop Circuit"
      subtitle="Sixty seconds. Four spots. One drifting rim."
      icon={Target}
      accent="electric"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label="Score" value={snapshot.score} tone="mint" />
          <GameStat
            label="Clock"
            value={clockLabel(snapshot.timeLeft)}
            tone={snapshot.timeLeft <= 10 && phase !== 'menu' ? 'coral' : 'ink'}
          />
          <GameStat label="Streak" value={`${snapshot.streak} · ×${multiplier}`} tone="plasma" />
          <GameStat label="Accuracy" value={`${accuracyPct}%`} tone="electric" />
        </div>
      }
      toolbar={
        <>
          {phase !== 'menu' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={togglePause}
              disabled={phase === 'finished'}
              aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
              title={phase === 'paused' ? 'Resume game' : 'Pause game'}
            >
              {phase === 'paused' ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
            aria-pressed={settings.muted}
            title={settings.muted ? 'Unmute audio' : 'Mute audio'}
          >
            {settings.muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </GameButton>
          {phase !== 'menu' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={chooseSetup}
              aria-label="Back to setup"
              title="Back to setup"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Aim with ↑ ↓, set power with ← →, Space shoots. Hold the on-screen buttons on touch. P pauses, M mutes.</span>
          <span>Pro and All-Star rims drift, so lead the hoop. Bests are stored only in this browser.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={phase === 'menu' || phase === 'paused' || phase === 'finished' ? true : undefined}>
          <div className="relative h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[430px]">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Hoop Circuit half court. Set your aim and power, then shoot at the drifting rim."
            />

            {phase === 'playing' || phase === 'paused' ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
                <span className="rounded-full border border-electric-400/30 bg-night-950/80 px-2.5 py-1 text-[11px] font-semibold text-electric-200">
                  {snapshot.score} pts · ×{multiplier}
                </span>
                <span
                  className={cn(
                    'rounded-full border bg-night-950/80 px-2.5 py-1 text-[11px] tabular-nums',
                    snapshot.timeLeft <= 10 ? 'border-coral/40 text-coral' : 'border-white/10 text-muted',
                  )}
                >
                  {clockLabel(snapshot.timeLeft)}
                </span>
              </div>
            ) : null}

            {phase === 'playing' && snapshot.gamePhase === 'flight' ? (
              <div className="pointer-events-none absolute inset-x-0 top-11 flex justify-center">
                <span className="rounded-full border border-white/10 bg-night-950/80 px-3 py-1 text-[11px] text-ink">
                  {snapshot.message}
                </span>
              </div>
            ) : null}

            {phase === 'playing' && snapshot.gamePhase === 'aim' ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
                <span className="rounded-full border border-electric-400/30 bg-night-950/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-electric-200">
                  Aim · Space to shoot
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <HoldButton label="Aim down" disabled={!canShoot} onStep={() => nudge(-2, 0)}>
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Aim
            </HoldButton>
            <HoldButton label="Aim up" disabled={!canShoot} onStep={() => nudge(2, 0)}>
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              Aim
            </HoldButton>
            <HoldButton label="Less power" disabled={!canShoot} onStep={() => nudge(0, -0.05)}>
              <Minus className="h-4 w-4" aria-hidden="true" />
              Power
            </HoldButton>
            <HoldButton label="More power" disabled={!canShoot} onStep={() => nudge(0, 0.05)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Power
            </HoldButton>
            <GameButton
              variant="primary"
              className="col-span-2 h-11 sm:col-span-1"
              onClick={shootNow}
              disabled={!canShoot}
              aria-label="Shoot"
            >
              <Target className="h-4 w-4" aria-hidden="true" />
              Shoot
            </GameButton>
          </div>
        </div>

        {phase === 'menu' ? (
          <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-electric-300">NeonRift Sports · Arcade hoops</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Beat the clock. <span className="text-gradient">Chase the swish.</span>
                  </h3>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    Sixty seconds, four shooting spots and a rim that starts drifting on higher difficulties. Swishes
                    are worth three, rim-ins two, and every third make doubles the points.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <RecordTile label="Best" value={records.bestScore.toLocaleString()} />
                  <RecordTile label="Streak" value={records.bestStreak} />
                  <RecordTile label="Games" value={records.games} />
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Rim movement</p>
                  <GameSegmented
                    options={DIFFICULTY_OPTIONS}
                    value={settings.difficulty}
                    onChange={changeDifficulty}
                    label="Hoop difficulty"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  {records.makes} makes on {records.shots} shots · best {records.bestStreak} in a row
                </p>
              </div>

              <p className="text-[11px] text-muted">{difficultyBlurb(settings.difficulty)}</p>

              <div className="flex flex-wrap items-center gap-2">
                <GameButton variant="primary" onClick={start}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Tip off
                </GameButton>
                <span className="text-[11px] text-muted">Scores and streaks stay inside this browser.</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Guide icon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />} label="Aim" value="↑ ↓ or W S" />
                <Guide icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />} label="Power" value="← → or A D" />
                <Guide icon={<Trophy className="h-3.5 w-3.5" aria-hidden="true" />} label="Score" value="Swish 3 · rim 2 · streak bonus" />
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'paused' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Game paused</p>
            <h3 className="font-display text-xl font-semibold text-ink">Catch your breath</h3>
            <p className="max-w-xs text-xs leading-5 text-muted">
              {snapshot.score} points · {clockLabel(snapshot.timeLeft)} left · {snapshot.streak} in a row
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={togglePause}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Resume
              </GameButton>
              <GameButton variant="secondary" onClick={chooseSetup}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Change setup
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'finished' && result ? (
          <GameOverlay tone="win">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">Round over</h3>
            <p className="font-display text-3xl font-bold tabular-nums text-ink">{result.score.toLocaleString()}</p>
            <p className="text-sm text-muted">
              {result.makes} of {result.shots} makes · {result.accuracy}% · best streak {result.bestStreak}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Timer className="h-3.5 w-3.5 text-electric-300" aria-hidden="true" />
              {result.swishes} swish{result.swishes === 1 ? '' : 'es'} · browser-local best {records.bestScore.toLocaleString()}
            </p>
            {isBest ? <p className="text-[11px] font-semibold text-mint">New personal best.</p> : null}
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={start}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Play again
              </GameButton>
              <GameButton variant="secondary" onClick={chooseSetup}>
                Change difficulty
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

function difficultyBlurb(difficulty: HoopDifficulty): string {
  if (difficulty === 'rookie') return 'Rookie keeps the rim locked in place so you can dial in the arc.';
  if (difficulty === 'allstar') return 'All-Star sweeps the rim fast and wide — lead it, or the shot rim-outs.';
  return 'Pro drifts the rim gently. A clean arc still drops, but timing starts to matter.';
}

function RecordTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night-900/80 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function Guide({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-night-900/70 px-3 py-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-electric-300">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className="block truncate text-[11px] text-ink">{value}</span>
      </span>
    </div>
  );
}

function HoldButton({
  label,
  disabled,
  onStep,
  children,
}: {
  label: string;
  disabled: boolean;
  onStep: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        if (event.detail === 0) onStep();
        event.currentTarget.blur();
      }}
      onPointerDown={() => {
        onStep();
        stop();
        timerRef.current = window.setInterval(onStep, 70);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-ink transition hover:border-white/25 active:scale-[0.98] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
