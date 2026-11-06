import {
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Flag,
  Gauge,
  Lock,
  Map,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useVisibilityPause } from '../../games/shared/useVisibilityPause';
import { formatRaceTime } from '../shared/math';
import { WebGLContextNotice } from '../shared/WebGLContextNotice';
import { useWebGLContextLoss } from '../shared/useContextLoss';
import type { GameComponentProps } from '../../types/game';
import {
  VEHICLES,
  difficultyProfile,
  getVehicle,
  loadProgress,
  saveProgress,
  type CarId,
  type RaceProgress,
} from './cars';
import { RaceEngine, type RaceHud, type RaceResultData } from './engine';
import {
  TRACKS,
  getTrack,
  type CameraMode,
  type Difficulty,
  type TrackId,
} from './tracks';

type Phase = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished';

const START_HUD: RaceHud = {
  speed: 0,
  lap: 1,
  totalLaps: 3,
  position: 4,
  racers: 4,
  raceTime: 0,
  lastLap: null,
  bestLap: null,
  countdown: 3,
  phase: 'countdown',
  offTrack: false,
  minimapPlayer: { x: 50, y: 50 },
  minimapRivals: [],
};

const cameraLabels: Record<CameraMode, string> = {
  chase: 'Chase',
  far: 'Wide',
  hood: 'Hood',
};

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/50">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-electric-400 to-plasma-400"
          style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
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

export default function NeonApexGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<RaceHud>(START_HUD);
  const [trackId, setTrackId] = useState<TrackId>('harbor-loop');
  const [carId, setCarId] = useState<CarId>('rift-gt');
  const [difficulty, setDifficulty] = useState<Difficulty>('pro');
  const [camera, setCamera] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<RaceResultData | null>(null);
  const [progress, setProgress] = useState<RaceProgress>(() => loadProgress());
  const [error, setError] = useState<string | null>(null);
  const contextLost = useWebGLContextLoss(canvasRef);

  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  const track = useMemo(() => getTrack(trackId), [trackId]);
  const vehicle = useMemo(() => getVehicle(carId), [carId]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => () => disposeEngine(), [disposeEngine]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (contextLost) engine.pause();
    else engine.resume();
  }, [contextLost]);

  const startRace = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposeEngine();
    setResult(null);
    setError(null);
    setPhase('countdown');
    setHud({ ...START_HUD, racers: 4 });

    try {
      const engine = new RaceEngine(
        canvas,
        { trackId, carId, difficulty, camera },
        {
          onHud: (nextHud) => {
            setHud(nextHud);
            if (nextHud.phase === 'racing') {
              setPhase((current) => (current === 'countdown' ? 'racing' : current));
            }
          },
          onFinish: (raceResult) => {
            setResult(raceResult);
            setPhase('finished');
            setProgress((previous) => {
              const previousBest = previous.bestLaps[trackId];
              const bestLap =
                raceResult.bestLap !== null &&
                (previousBest === undefined || raceResult.bestLap < previousBest)
                  ? raceResult.bestLap
                  : previousBest;
              const next: RaceProgress = {
                races: previous.races + 1,
                wins: previous.wins + (raceResult.playerPosition === 1 ? 1 : 0),
                bestLaps: {
                  ...previous.bestLaps,
                  ...(bestLap !== undefined ? { [trackId]: bestLap } : {}),
                },
              };
              saveProgress(next);
              return next;
            });
            onCompleteRef.current?.({
              score: Math.max(
                0,
                Math.round(
                  6000 -
                    raceResult.raceTime * 8 +
                    (4 - raceResult.playerPosition) * 900 +
                    (raceResult.bestLap ? Math.max(0, 90 - raceResult.bestLap) * 4 : 0),
                ),
              ),
              outcome:
                raceResult.playerPosition === 1
                  ? 'win'
                  : raceResult.playerPosition === 2
                    ? 'draw'
                    : 'loss',
            });
          },
        },
      );
      engineRef.current = engine;
      engine.setCamera(camera);
      onStartRef.current?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `The 3D renderer could not start: ${cause.message}`
          : 'The 3D renderer could not start on this device.',
      );
      setPhase('menu');
    }
  }, [camera, carId, difficulty, disposeEngine, trackId]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === 'racing') {
      engine.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      engine.resume();
      setPhase('racing');
    }
  }, [phase]);

  useVisibilityPause(togglePause, phase === 'racing');

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
      if (event.code === 'KeyP' || (event.code === 'Escape' && phase === 'paused')) {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'KeyC' && (phase === 'racing' || phase === 'paused')) {
        const next = engineRef.current?.cycleCamera();
        if (next) setCamera(next);
      }
      if (event.code === 'KeyM') {
        const nextMuted = engineRef.current?.toggleMute();
        if (nextMuted !== undefined) setMuted(nextMuted);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, togglePause]);

  const chooseSetup = useCallback(() => {
    disposeEngine();
    setResult(null);
    setPhase('menu');
    setHud(START_HUD);
  }, [disposeEngine]);

  const setTouch = useCallback((patch: Parameters<RaceEngine['setTouch']>[0]) => {
    engineRef.current?.setTouch(patch);
  }, []);

  const cycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleCamera();
    if (next) setCamera(next);
  }, []);

  const toggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute();
    if (next !== undefined) setMuted(next);
  }, []);

  const bestLapForTrack = progress.bestLaps[trackId];

  if (phase === 'menu') {
    return (
      <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 420px at 20% -10%, rgba(76,141,255,0.18), transparent 65%), radial-gradient(700px 380px at 90% 10%, rgba(160,107,255,0.16), transparent 65%), linear-gradient(180deg, #050814 0%, #070d1f 100%)',
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-electric-300">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                NeonRift 3D · Arcade racing
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Neon <span className="text-gradient">Apex</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Three circuits. Three machines. Four racers. A three-lap sprint through a neon city
                built entirely from original geometry — no downloaded assets, no copied branding.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Circuit</h3>
                <span className="text-[11px] text-muted/70">Win races to unlock later tracks</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {TRACKS.map((option, index) => {
                  const locked = progress.wins < option.unlocksAfterWins;
                  const selected = trackId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (!locked) setTrackId(option.id);
                      }}
                      disabled={locked}
                      aria-pressed={selected}
                      className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-electric-400/60 bg-electric-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      } ${locked ? 'cursor-not-allowed opacity-55' : ''}`}
                    >
                      <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
                        <span>Track {index + 1}</span>
                        {locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : <Flag className="h-3 w-3" aria-hidden="true" />}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.difficultyLabel}</span>
                      {locked ? (
                        <span className="mt-2 block text-[10px] text-amber-300/90">
                          Win {option.unlocksAfterWins} race{option.unlocksAfterWins === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="mt-2 block text-[10px] text-electric-300/80">
                          Best lap {progress.bestLaps[option.id] ? formatRaceTime(progress.bestLaps[option.id]!) : '—'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Machine</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {VEHICLES.map((option) => {
                  const locked = progress.wins < option.unlockWins;
                  const selected = carId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (!locked) setCarId(option.id);
                      }}
                      disabled={locked}
                      aria-pressed={selected}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-plasma-400/60 bg-plasma-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      } ${locked ? 'cursor-not-allowed opacity-55' : ''}`}
                    >
                      <span className="flex items-center justify-between">
                        <Car className="h-4 w-4" style={{ color: option.accent }} aria-hidden="true" />
                        {locked ? <Lock className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> : null}
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.tagline}</span>
                      {locked ? (
                        <span className="mt-2 block text-[10px] text-amber-300/90">
                          Win {option.unlockWins} race{option.unlockWins === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <div className="mt-2 space-y-1.5">
                          <StatBar label="Speed" value={(option.maxSpeed / 77) * 100} />
                          <StatBar label="Accel" value={(option.acceleration / 33) * 100} />
                          <StatBar label="Handling" value={(option.handling / 2.1) * 100} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Race setup</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                3D · WebGL
              </span>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Opponent skill</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-night-900/80 p-1">
                {(['rookie', 'pro', 'legend'] as Difficulty[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    aria-pressed={difficulty === value}
                    className={`rounded-full px-2 py-1.5 text-xs font-medium capitalize transition ${
                      difficulty === value
                        ? 'bg-white text-night-950'
                        : 'text-muted hover:text-white'
                    }`}
                  >
                    {difficultyProfile(value).label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Camera</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-night-900/80 p-1">
                {(['chase', 'far', 'hood'] as CameraMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCamera(value)}
                    aria-pressed={camera === value}
                    className={`rounded-full px-2 py-1.5 text-xs font-medium transition ${
                      camera === value ? 'bg-white text-night-950' : 'text-muted hover:text-white'
                    }`}
                  >
                    {cameraLabels[value]}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] leading-5 text-muted">
              <p className="font-medium text-ink">{track.name}</p>
              <p className="mt-1">{track.description}</p>
              <p className="mt-2 text-electric-300/90">
                {vehicle.name} · {difficultyProfile(difficulty).label} opponents
              </p>
            </div>

            <button
              type="button"
              onClick={startRace}
              className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white shadow-[0_14px_40px_-14px_rgba(76,141,255,0.9)] transition hover:brightness-110 active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start race
            </button>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted/80">
              <span><b className="text-ink">W / ↑</b> accelerate</span>
              <span><b className="text-ink">S / ↓</b> brake</span>
              <span><b className="text-ink">A D / ← →</b> steer</span>
              <span><b className="text-ink">Space</b> handbrake</span>
              <span><b className="text-ink">P</b> pause</span>
              <span><b className="text-ink">C</b> camera</span>
            </div>
            <p className="text-[10px] leading-4 text-muted/60">
              Touch controls appear during the race. Best laps and unlocks are stored locally in this
              browser.
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
        aria-label="Neon Apex 3D race. Use arrow keys or WASD to drive, Space for handbrake, P to pause and C to change camera."
      />
      <WebGLContextNotice lost={contextLost} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-night-950/80 to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Position</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.position}
              <span className="ml-0.5 text-xs text-muted">/{hud.racers}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Lap</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.lap}
              <span className="ml-0.5 text-xs text-muted">/{hud.totalLaps}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-night-950/65 px-4 py-1.5 text-center backdrop-blur-md">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Race time</p>
          <p className="font-mono text-lg font-semibold leading-tight text-white">
            {formatRaceTime(hud.raceTime)}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePause}
            aria-label={phase === 'paused' ? 'Resume race' : 'Pause race'}
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
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 hidden sm:block">
        <div className="rounded-2xl border border-white/10 bg-night-950/65 p-2 backdrop-blur-md">
          <svg viewBox="0 0 112 112" className="h-28 w-28" role="img" aria-label={`Minimap of ${track.name}`}>
            <polyline
              points={track.minimap}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <polyline
              points={track.minimap}
              fill="none"
              stroke={track.accent}
              strokeWidth="1.6"
              strokeLinejoin="round"
              opacity="0.85"
            />
            {hud.minimapRivals.map((rival, index) => (
              <circle key={index} cx={rival.x} cy={rival.y} r="2.4" fill="#cbd5f5" opacity="0.75" />
            ))}
            <circle cx={hud.minimapPlayer.x} cy={hud.minimapPlayer.y} r="3.4" fill="#ffffff" stroke="#4c8dff" strokeWidth="2" />
          </svg>
          <p className="flex items-center gap-1 px-1 text-[9px] uppercase tracking-[0.18em] text-muted/70">
            <Map className="h-3 w-3" aria-hidden="true" /> {track.name}
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 text-right">
        <div className="rounded-2xl border border-white/10 bg-night-950/65 px-4 py-2 backdrop-blur-md">
          <p className="flex items-center justify-end gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Gauge className="h-3 w-3" aria-hidden="true" /> km/h
          </p>
          <p className="font-display text-3xl font-semibold leading-none text-white">
            {Math.round(hud.speed)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            Best lap {hud.bestLap ? formatRaceTime(hud.bestLap) : bestLapForTrack ? formatRaceTime(bestLapForTrack) : '—'}
          </p>
        </div>
      </div>

      {hud.offTrack && phase === 'racing' ? (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md"
        >
          Off track — get back on the asphalt
        </p>
      ) : null}

      {phase === 'countdown' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/20">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-electric-300">Get ready</p>
            <p key={hud.countdown} className="animate-pop font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(76,141,255,0.8)]">
              {hud.countdown > 0 ? hud.countdown : 'GO'}
            </p>
            <p className="mt-2 text-xs text-muted">{track.name} · 3 laps</p>
          </div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="absolute inset-0 grid place-items-center bg-night-950/75 backdrop-blur-sm">
          <div className="w-[min(92%,360px)] rounded-3xl border border-white/12 bg-night-900/95 p-6 text-center shadow-2xl">
            <Pause className="mx-auto h-8 w-8 text-electric-300" aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-white">Race paused</h3>
            <p className="mt-1 text-sm text-muted">The clock is stopped. Your position is safe.</p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Resume
              </button>
              <button
                type="button"
                onClick={startRace}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart race
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
                <p className="text-[10px] uppercase tracking-[0.22em] text-electric-300">Race complete</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  {result.playerPosition === 1 ? 'Victory' : `${result.playerPosition}${result.playerPosition === 2 ? 'nd' : result.playerPosition === 3 ? 'rd' : 'th'} place`}
                </h3>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${result.playerPosition === 1 ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-muted'}`}>
                {result.playerPosition === 1 ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Flag className="h-6 w-6" aria-hidden="true" />}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Time</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{formatRaceTime(result.raceTime)}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Best lap</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{result.bestLap ? formatRaceTime(result.bestLap) : '—'}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Wins</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{progress.wins}</dd>
              </div>
            </dl>

            <ol className="mt-4 space-y-1.5">
              {result.rows.map((row) => (
                <li
                  key={`${row.position}-${row.name}`}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                    row.isPlayer ? 'bg-electric-500/12 text-white' : 'bg-white/[0.025] text-muted'
                  }`}
                >
                  <span className="w-4 text-xs text-muted/70">{row.position}</span>
                  <span className="flex-1 font-medium">{row.name}</span>
                  <span className="font-mono text-[11px]">
                    {row.finishTime ? formatRaceTime(row.finishTime) : `Lap ${Math.min(row.lapsCompleted + 1, 3)}`}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={startRace}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Race again
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change track or car
              </button>
            </div>
            {progress.wins < 2 ? (
              <p className="mt-3 text-center text-[10px] text-muted/70">
                Win {2 - progress.wins} more race{2 - progress.wins === 1 ? '' : 's'} to unlock everything.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'racing' || phase === 'countdown' || phase === 'paused' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex items-end justify-between px-3 sm:hidden">
          <div className="pointer-events-auto flex gap-2">
            <TouchButton
              label="Steer left"
              onPress={() => setTouch({ left: true })}
              onRelease={() => setTouch({ left: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Steer right"
              onPress={() => setTouch({ right: true })}
              onRelease={() => setTouch({ right: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
          </div>
          <div className="pointer-events-auto flex items-end gap-2">
            <TouchButton
              label="Handbrake"
              onPress={() => setTouch({ handbrake: true })}
              onRelease={() => setTouch({ handbrake: false })}
              className="h-12 w-12 rounded-2xl text-[9px] uppercase tracking-wider"
            >
              Drift
            </TouchButton>
            <TouchButton
              label="Brake"
              onPress={() => setTouch({ back: true })}
              onRelease={() => setTouch({ back: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <Timer className="h-5 w-5" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Accelerate"
              onPress={() => setTouch({ forward: true })}
              onRelease={() => setTouch({ forward: false })}
              className="h-16 w-16 rounded-2xl bg-electric-500/25"
            >
              <Zap className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
