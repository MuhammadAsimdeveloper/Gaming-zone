import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  Footprints,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Target,
  Timer,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameComponentProps } from '../../types/game';
import { FootballEngine, type FootballCamera, type FootballDifficulty, type FootballHud, type FootballResult } from './engine';

type Phase = 'menu' | 'live' | 'paused' | 'finished';

const RECORD_KEY = 'neonrift:game:rift-striker:record';

interface MatchRecord {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
}

const EMPTY_RECORD: MatchRecord = { matches: 0, wins: 0, draws: 0, losses: 0 };

function loadRecord(): MatchRecord {
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    if (!raw) return EMPTY_RECORD;
    const parsed = JSON.parse(raw) as Partial<MatchRecord>;
    return {
      matches: Number.isFinite(parsed.matches) ? Number(parsed.matches) : 0,
      wins: Number.isFinite(parsed.wins) ? Number(parsed.wins) : 0,
      draws: Number.isFinite(parsed.draws) ? Number(parsed.draws) : 0,
      losses: Number.isFinite(parsed.losses) ? Number(parsed.losses) : 0,
    };
  } catch {
    return EMPTY_RECORD;
  }
}

function saveRecord(record: MatchRecord): void {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable in private modes; the match still works.
  }
}

const START_HUD: FootballHud = {
  homeScore: 0,
  awayScore: 0,
  timeLeft: 120,
  phase: 'countdown',
  possession: null,
  power: 0,
  goalMessage: null,
  playerHasBall: false,
  controlledName: 'Nova',
};

const cameraLabels: Record<FootballCamera, string> = {
  broadcast: 'Broadcast',
  follow: 'Follow',
  tight: 'Close',
};

const difficultyLabels: Record<FootballDifficulty, string> = {
  rookie: 'Rookie',
  pro: 'Pro',
  legend: 'Legend',
};

const difficultyHints: Record<FootballDifficulty, string> = {
  rookie: 'Slower opponents, forgiving keeper',
  pro: 'Balanced pace and pressing',
  legend: 'Fast press, sharp finishes',
};

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function TouchButton({
  label,
  onPress,
  onRelease,
  className,
  children,
}: {
  label: string;
  onPress: () => void;
  onRelease: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onPointerLeave={onRelease}
      onContextMenu={(event) => event.preventDefault()}
      className={`grid select-none place-items-center border border-white/15 bg-white/10 text-white backdrop-blur-md active:bg-electric-500/40 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export default function RiftStrikerGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FootballEngine | null>(null);
  const touchRef = useRef({ moveX: 0, moveZ: 0, sprint: false, shoot: false, pass: false, tackle: false });
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<FootballHud>(START_HUD);
  const [difficulty, setDifficulty] = useState<FootballDifficulty>('pro');
  const [camera, setCamera] = useState<FootballCamera>('broadcast');
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<FootballResult | null>(null);
  const [record, setRecord] = useState<MatchRecord>(() => loadRecord());
  const [error, setError] = useState<string | null>(null);

  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => () => disposeEngine(), [disposeEngine]);

  const resetTouch = useCallback(() => {
    touchRef.current = { moveX: 0, moveZ: 0, sprint: false, shoot: false, pass: false, tackle: false };
    engineRef.current?.setTouch(touchRef.current);
  }, []);

  const startMatch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposeEngine();
    resetTouch();
    setResult(null);
    setError(null);
    setHud(START_HUD);
    setPhase('live');

    try {
      const engine = new FootballEngine(
        canvas,
        { difficulty, camera },
        {
          onHud: (nextHud) => setHud(nextHud),
          onFinish: (matchResult) => {
            setResult(matchResult);
            setPhase('finished');
            setRecord((previous) => {
              const next: MatchRecord = {
                matches: previous.matches + 1,
                wins: previous.wins + (matchResult.outcome === 'win' ? 1 : 0),
                draws: previous.draws + (matchResult.outcome === 'draw' ? 1 : 0),
                losses: previous.losses + (matchResult.outcome === 'loss' ? 1 : 0),
              };
              saveRecord(next);
              return next;
            });
            const possessionBonus = Math.round(matchResult.possessionHome * 6);
            const score =
              matchResult.homeScore * 900 -
              matchResult.awayScore * 300 +
              possessionBonus +
              (matchResult.outcome === 'win' ? 500 : 0);
            onCompleteRef.current?.({ score: Math.max(0, score), outcome: matchResult.outcome });
          },
        },
      );
      engineRef.current = engine;
      onStartRef.current?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `The 3D renderer could not start: ${cause.message}`
          : 'The 3D renderer could not start on this device.',
      );
      setPhase('menu');
    }
  }, [camera, difficulty, disposeEngine, resetTouch]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === 'live') {
      engine.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      engine.resume();
      setPhase('live');
    }
  }, [phase]);

  const toggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute();
    if (next !== undefined) setMuted(next);
  }, []);

  const cycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleCamera();
    if (next) setCamera(next);
  }, []);

  const switchPlayer = useCallback(() => {
    engineRef.current?.switchControlledPlayer();
    resetTouch();
  }, [resetTouch]);

  const chooseSetup = useCallback(() => {
    disposeEngine();
    resetTouch();
    setResult(null);
    setPhase('menu');
    setHud(START_HUD);
  }, [disposeEngine, resetTouch]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase !== 'live' && phase !== 'paused') return;
      if (event.code === 'KeyP' || (event.code === 'Escape' && phase === 'paused')) {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'KeyC') {
        event.preventDefault();
        cycleCamera();
      }
      if (event.code === 'Tab') {
        event.preventDefault();
        switchPlayer();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleCamera, phase, switchPlayer, togglePause]);

  const applyTouch = useCallback((patch: Partial<typeof touchRef.current>) => {
    touchRef.current = { ...touchRef.current, ...patch };
    engineRef.current?.setTouch(touchRef.current);
  }, []);

  const recordLine = record.matches === 0 ? 'No matches finished yet' : `${record.wins}W · ${record.draws}D · ${record.losses}L`;

  if (phase === 'menu') {
    return (
      <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 420px at 15% -10%, rgba(56,232,255,0.16), transparent 65%), radial-gradient(700px 420px at 92% 8%, rgba(225,29,72,0.14), transparent 65%), linear-gradient(180deg, #050814 0%, #07101d 100%)',
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
                NeonRift 3D · Football
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Rift <span className="text-gradient">Striker</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Three-a-side under the floodlights. Pass, sprint, charge a shot and press for the ball.
                Every arena, athlete and sound is generated by the game — no borrowed teams or assets.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(['rookie', 'pro', 'legend'] as FootballDifficulty[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDifficulty(value)}
                  aria-pressed={difficulty === value}
                  className={`rounded-2xl border p-3 text-left transition ${
                    difficulty === value
                      ? 'border-mint/50 bg-mint/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                  }`}
                >
                  <span className="text-sm font-semibold text-white">{difficultyLabels[value]}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted">{difficultyHints[value]}</span>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">Camera</p>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-night-900/80 p-1">
                  {(['broadcast', 'follow', 'tight'] as FootballCamera[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCamera(value)}
                      aria-pressed={camera === value}
                      className={`rounded-full px-1 py-1.5 text-[11px] font-medium transition ${
                        camera === value ? 'bg-white text-night-950' : 'text-muted hover:text-white'
                      }`}
                    >
                      {cameraLabels[value]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted/70">
                  <Trophy className="h-3 w-3" aria-hidden="true" /> Your record
                </p>
                <p className="mt-2 font-display text-lg font-semibold text-white">{recordLine}</p>
                <p className="mt-0.5 text-[11px] text-muted">{record.matches} match{record.matches === 1 ? '' : 'es'} stored on this device</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] leading-5 text-muted">
              <p className="font-medium text-ink">How the match works</p>
              <p className="mt-1">
                Two 60-second halves are compressed into a two-minute match. You control one of three
                Rift outfielders, press to win the ball, and the keeper guards the goal. Goals are
                detected only when the ball fully crosses the line under the crossbar.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Match setup</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                3D · WebGL
              </span>
            </div>

            <div className="space-y-2 rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] leading-5 text-muted">
              <p className="flex items-center gap-2 text-ink"><Users className="h-3.5 w-3.5 text-electric-300" aria-hidden="true" /> Rift vs Void XI</p>
              <p className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" /> Sprint drains nothing — but changes your touch</p>
              <p className="flex items-center gap-2"><Crosshair className="h-3.5 w-3.5 text-coral" aria-hidden="true" /> Hold shoot to charge power, release to strike</p>
            </div>

            <button
              type="button"
              onClick={startMatch}
              className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950 shadow-[0_14px_40px_-14px_rgba(110,231,255,0.8)] transition hover:brightness-110 active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Kick off
            </button>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted/80">
              <span><b className="text-ink">WASD</b> move</span>
              <span><b className="text-ink">Shift</b> sprint</span>
              <span><b className="text-ink">J</b> shoot (hold)</span>
              <span><b className="text-ink">K</b> pass</span>
              <span><b className="text-ink">Space</b> press / tackle</span>
              <span><b className="text-ink">Tab</b> switch player</span>
              <span><b className="text-ink">C</b> camera</span>
              <span><b className="text-ink">P</b> pause</span>
            </div>
            <p className="text-[10px] leading-4 text-muted/60">
              Touch pads appear during the match. Match records are stored locally in this browser.
            </p>
            {error ? (
              <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 p-2 text-[11px] text-coral">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        aria-label="Rift Striker 3D football match. Use WASD to move, Shift to sprint, J to shoot, K to pass and Space to tackle."
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-night-950/85 to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-4">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 rounded-2xl border border-white/10 bg-night-950/70 px-3 py-2 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-electric-400 shadow-[0_0_10px_rgba(76,141,255,0.9)]" />
            <div className="min-w-0">
              <p className="truncate text-[9px] uppercase tracking-[0.18em] text-muted/70">Rift</p>
              <p className="truncate text-[11px] font-medium text-white">{difficultyLabels[difficulty]}</p>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <p className="font-display text-2xl font-bold leading-none text-white">
              <span className={hud.possession === 'home' ? 'text-electric-300' : undefined}>{hud.homeScore}</span>
              <span className="mx-2 text-base text-muted">:</span>
              <span className={hud.possession === 'away' ? 'text-coral' : undefined}>{hud.awayScore}</span>
            </p>
            <p className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] text-muted">
              <Timer className="h-3 w-3" aria-hidden="true" /> {formatClock(hud.timeLeft)}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right">
            <div className="min-w-0">
              <p className="truncate text-[9px] uppercase tracking-[0.18em] text-muted/70">Void XI</p>
              <p className="truncate text-[11px] font-medium text-white">Away</p>
            </div>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral shadow-[0_0_10px_rgba(255,107,129,0.9)]" />
          </div>
        </div>

        <div className="pointer-events-auto mx-auto mt-2 flex max-w-xl items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={togglePause}
            aria-label={phase === 'paused' ? 'Resume match' : 'Pause match'}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            {phase === 'paused' ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={cycleCamera}
            aria-label={`Camera: ${cameraLabels[camera]}. Change camera`}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={switchPlayer}
            aria-label="Switch controlled player"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 hidden sm:block">
        <div className="rounded-2xl border border-white/10 bg-night-950/70 px-3 py-2 backdrop-blur-md">
          <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-muted/70">
            <Shield className="h-3 w-3" aria-hidden="true" /> Controlling
          </p>
          <p className="mt-0.5 text-sm font-semibold text-white">{hud.controlledName}</p>
          <p className={`mt-0.5 text-[10px] ${hud.playerHasBall ? 'text-mint' : 'text-muted'}`}>
            {hud.playerHasBall ? 'On the ball' : 'Press to win it back'}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 hidden text-right sm:block">
        <div className="rounded-2xl border border-white/10 bg-night-950/70 px-4 py-2 backdrop-blur-md">
          <p className="flex items-center justify-end gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Target className="h-3 w-3" aria-hidden="true" /> Shot power
          </p>
          <div className="mt-1.5 h-2 w-36 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mint to-coral transition-[width] duration-75"
              style={{ width: `${Math.round(hud.power * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">
            {hud.playerHasBall ? 'Hold J or the shoot pad' : 'Possession: '}
            {!hud.playerHasBall ? (hud.possession === 'home' ? 'Rift' : hud.possession === 'away' ? 'Void XI' : 'loose ball') : null}
          </p>
        </div>
      </div>

      {hud.phase === 'countdown' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/25">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-mint">Floodlights on</p>
            <p className="animate-pop font-display text-6xl font-bold text-white drop-shadow-[0_0_30px_rgba(110,231,255,0.7)] sm:text-7xl">
              Kickoff
            </p>
            <p className="mt-2 text-xs text-muted">Rift vs Void XI · {difficultyLabels[difficulty]}</p>
          </div>
        </div>
      ) : null}

      {hud.phase === 'goal' && hud.goalMessage ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="animate-pop rounded-full border border-white/15 bg-night-950/70 px-8 py-3 font-display text-3xl font-bold text-white shadow-2xl backdrop-blur-md sm:text-4xl">
            {hud.goalMessage}
          </p>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="absolute inset-0 grid place-items-center bg-night-950/75 backdrop-blur-sm">
          <div className="w-[min(92%,360px)] rounded-3xl border border-white/12 bg-night-900/95 p-6 text-center shadow-2xl">
            <Pause className="mx-auto h-8 w-8 text-mint" aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-white">Match paused</h3>
            <p className="mt-1 text-sm text-muted">The clock and both teams are frozen.</p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Resume
              </button>
              <button
                type="button"
                onClick={startMatch}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart match
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-muted hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change setup
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'finished' && result ? (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-night-950/85 p-3 backdrop-blur-md">
          <div className="my-auto w-full max-w-md rounded-3xl border border-white/12 bg-night-900/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-mint">Full time</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  {result.outcome === 'win' ? 'Victory' : result.outcome === 'draw' ? 'Draw' : 'Defeat'}
                </h3>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${result.outcome === 'win' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-muted'}`}>
                {result.outcome === 'win' ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Shield className="h-6 w-6" aria-hidden="true" />}
              </span>
            </div>

            <p className="mt-4 text-center font-display text-5xl font-bold text-white">
              {result.homeScore}
              <span className="mx-3 text-2xl text-muted">:</span>
              {result.awayScore}
            </p>
            <p className="mt-1 text-center text-[11px] uppercase tracking-[0.18em] text-muted">Rift vs Void XI</p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Shots</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{result.homeShots}–{result.awayShots}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Possession</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{result.possessionHome}%</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Record</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{record.wins}W</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={startMatch}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Play again
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change difficulty or camera
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] text-muted/70">{recordLine} · saved locally</p>
          </div>
        </div>
      ) : null}

      {phase === 'live' || phase === 'paused' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 px-3 sm:hidden">
          <div className="flex items-end justify-between gap-2">
            <div className="pointer-events-auto grid grid-cols-3 grid-rows-2 gap-1.5">
              <span aria-hidden="true" />
              <TouchButton label="Move forward" onPress={() => applyTouch({ moveZ: -1 })} onRelease={() => applyTouch({ moveZ: 0 })} className="h-12 w-12 rounded-xl">
                <ChevronRight className="h-5 w-5 -rotate-90" aria-hidden="true" />
              </TouchButton>
              <span aria-hidden="true" />
              <TouchButton label="Move left" onPress={() => applyTouch({ moveX: -1 })} onRelease={() => applyTouch({ moveX: 0 })} className="h-12 w-12 rounded-xl">
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </TouchButton>
              <TouchButton label="Move backward" onPress={() => applyTouch({ moveZ: 1 })} onRelease={() => applyTouch({ moveZ: 0 })} className="h-12 w-12 rounded-xl">
                <ChevronRight className="h-5 w-5 rotate-90" aria-hidden="true" />
              </TouchButton>
              <TouchButton label="Move right" onPress={() => applyTouch({ moveX: 1 })} onRelease={() => applyTouch({ moveX: 0 })} className="h-12 w-12 rounded-xl">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </TouchButton>
            </div>

            <div className="pointer-events-auto flex items-end gap-1.5">
              <TouchButton label="Switch player" onPress={switchPlayer} onRelease={() => undefined} className="h-11 w-11 rounded-xl">
                <Users className="h-4 w-4" aria-hidden="true" />
              </TouchButton>
              <TouchButton label="Sprint" onPress={() => applyTouch({ sprint: true })} onRelease={() => applyTouch({ sprint: false })} className="h-12 w-12 rounded-xl text-[9px] uppercase tracking-wider">
                Run
              </TouchButton>
              <TouchButton label="Pass" onPress={() => applyTouch({ pass: true })} onRelease={() => applyTouch({ pass: false })} className="h-12 w-12 rounded-xl">
                <Footprints className="h-4 w-4" aria-hidden="true" />
              </TouchButton>
              <TouchButton label="Tackle" onPress={() => applyTouch({ tackle: true })} onRelease={() => applyTouch({ tackle: false })} className="h-12 w-12 rounded-xl">
                <Hand className="h-4 w-4" aria-hidden="true" />
              </TouchButton>
              <TouchButton label="Shoot" onPress={() => applyTouch({ shoot: true })} onRelease={() => applyTouch({ shoot: false })} className="h-16 w-16 rounded-2xl bg-coral/30">
                <Zap className="h-6 w-6" aria-hidden="true" />
              </TouchButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
