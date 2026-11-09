import {
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Gauge,
  Ghost,
  Map,
  Medal,
  Pause,
  Play,
  RotateCcw,
  Target,
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
import { VEHICLES, type CarId } from '../racing/cars';
import type { CameraMode } from '../racing/tracks';
import { TimeTrialEngine, type TrialHud, type TrialRunResult } from './engine';
import { formatSplitDelta, type MedalTier } from './rules';
import {
  clearGhost,
  loadGhost,
  loadRecords,
  recordKey,
  recordTrial,
  saveGhost,
  saveRecords,
  type TrialRecords,
} from './persistence';
import {
  SURFACE_LABEL,
  TIME_TRIAL_TRACKS,
  getTimeTrialTrack,
  type TimeTrialTrack,
  type TimeTrialTrackId,
} from './tracks';

type Phase = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'invalid';

const cameraLabels: Record<CameraMode, string> = {
  chase: 'Chase',
  far: 'Wide',
  hood: 'Hood',
};

const MEDAL_LABEL: Record<MedalTier, string> = {
  author: 'Author',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  none: 'Finish',
};

const MEDAL_STYLE: Record<MedalTier, string> = {
  author: 'border-cyan-300/50 bg-cyan-300/10 text-cyan-200',
  gold: 'border-amber-300/50 bg-amber-300/10 text-amber-200',
  silver: 'border-slate-200/40 bg-slate-200/10 text-slate-200',
  bronze: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  none: 'border-white/15 bg-white/5 text-muted',
};

const MEDAL_SCORE: Record<MedalTier, number> = {
  author: 5000,
  gold: 3500,
  silver: 2200,
  bronze: 1200,
  none: 400,
};

function makeStartHud(track: TimeTrialTrack): TrialHud {
  return {
    phase: 'countdown',
    clock: 0,
    speed: 0,
    lap: 1,
    totalLaps: track.laps,
    sector: 1,
    totalSectors: (track.checkpoints.length + 1) * track.laps,
    nextSplit: 'checkpoint',
    splitDelta: null,
    bestTime: null,
    medal: 'none',
    surface: 'asphalt',
    offTrack: false,
    awaitingStart: true,
    countdown: 1.2,
    respawns: 0,
    invalidReason: null,
    progress: { x: 50, y: 50 },
    ghostProgress: null,
  };
}

function countdownLabel(seconds: number): string {
  if (seconds <= 0) return 'GO';
  return String(Math.min(3, Math.max(1, Math.ceil(seconds / 0.4))));
}

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

export default function ApexTimeTrialGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TimeTrialEngine | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [trackId, setTrackId] = useState<TimeTrialTrackId>('rift-loop');
  const [carId, setCarId] = useState<CarId>('rift-gt');
  const [camera, setCamera] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<TrialHud>(() => makeStartHud(getTimeTrialTrack('rift-loop')));
  const [result, setResult] = useState<TrialRunResult | null>(null);
  const [records, setRecords] = useState<TrialRecords>(() => loadRecords());
  const [baseline, setBaseline] = useState<{ time: number; splits: number[] } | null>(null);
  const [isBest, setIsBest] = useState(false);
  const [ghostVersion, setGhostVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const contextLost = useWebGLContextLoss(canvasRef);

  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  const recordsRef = useRef(records);
  recordsRef.current = records;

  const track = useMemo(() => getTimeTrialTrack(trackId), [trackId]);
  const bestRecord = records.best[recordKey(trackId, carId)] ?? null;
  const ghost = useMemo(
    () => loadGhost(trackId, carId),
    // ghostVersion re-reads storage after clearing or saving.
    [trackId, carId, ghostVersion],
  );

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

  const startRun = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposeEngine();
    setResult(null);
    setIsBest(false);
    setError(null);
    setPhase('countdown');

    const selectedTrack = getTimeTrialTrack(trackId);
    setHud(makeStartHud(selectedTrack));

    const previousBest = recordsRef.current.best[recordKey(trackId, carId)] ?? null;
    setBaseline(
      previousBest ? { time: previousBest.time, splits: [...previousBest.splits] } : null,
    );

    try {
      const engine = new TimeTrialEngine(
        canvas,
        {
          trackId,
          carId,
          camera,
          ghost: loadGhost(trackId, carId),
          bestTime: previousBest?.time ?? null,
          bestSplits: previousBest ? [...previousBest.splits] : null,
        },
        {
          onHud: (nextHud) => {
            setHud(nextHud);
            if (nextHud.phase === 'running') {
              setPhase((current) => (current === 'countdown' ? 'racing' : current));
            } else if (nextHud.phase === 'invalid') {
              setPhase('invalid');
            }
          },
          onFinish: (runResult) => {
            setResult(runResult);
            setPhase('finished');
            const update = recordTrial(recordsRef.current, {
              trackId: runResult.trackId,
              carId: runResult.carId,
              time: runResult.time,
              splits: runResult.splits,
              medal: runResult.medal,
            });
            recordsRef.current = update.records;
            saveRecords(update.records);
            setRecords(update.records);
            setIsBest(update.isBest);
            if (update.isBest) {
              saveGhost(runResult.ghost);
              setGhostVersion((version) => version + 1);
            }
            onCompleteRef.current?.({
              score: Math.max(
                0,
                MEDAL_SCORE[runResult.medal] +
                  Math.round(Math.max(0, 200 - runResult.time) * 10) -
                  runResult.respawns * 150,
              ),
              outcome: 'complete',
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
  }, [camera, carId, disposeEngine, trackId]);

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

  const cycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleCamera();
    if (next) setCamera(next);
  }, []);

  const toggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute();
    if (next !== undefined) setMuted(next);
  }, []);

  const respawn = useCallback(() => {
    engineRef.current?.respawn();
  }, []);

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
        cycleCamera();
      }
      if (event.code === 'KeyM') {
        toggleMute();
      }
      if (event.code === 'KeyR' && phase === 'racing') {
        respawn();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleCamera, phase, respawn, toggleMute, togglePause]);

  const chooseSetup = useCallback(() => {
    disposeEngine();
    setResult(null);
    setBaseline(null);
    setIsBest(false);
    setPhase('menu');
    setHud(makeStartHud(track));
  }, [disposeEngine, track]);

  const setTouch = useCallback((patch: Parameters<TimeTrialEngine['setTouch']>[0]) => {
    engineRef.current?.setTouch(patch);
  }, []);

  const removeGhost = useCallback(() => {
    clearGhost(trackId, carId);
    setGhostVersion((version) => version + 1);
  }, [carId, trackId]);

  const gatesPerLap = track.checkpoints.length + 1;

  if (phase === 'menu') {
    return (
      <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 420px at 18% -10%, rgba(56,232,255,0.16), transparent 65%), radial-gradient(700px 380px at 92% 8%, rgba(255,107,157,0.14), transparent 65%), linear-gradient(180deg, #040816 0%, #070d1f 100%)',
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-electric-300">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                NeonRift 3D · Precision racing
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Apex <span className="text-gradient">Time Trial</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Three original circuits, one machine, the clock. Two laps, two checkpoints per lap
                and a bronze-to-author medal ladder. Your fastest run saves a ghost you can race
                against in this browser.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Circuit</h3>
                <span className="text-[11px] text-muted/70">Personal bests are per car</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {TIME_TRIAL_TRACKS.map((option, index) => {
                  const selected = trackId === option.id;
                  const record = records.best[recordKey(option.id, carId)];
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTrackId(option.id)}
                      aria-pressed={selected}
                      aria-label={`Track ${index + 1}: ${option.name}`}
                      className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-electric-400/60 bg-electric-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
                        <span>Track {index + 1}</span>
                        <Flag className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.difficultyLabel}</span>
                      <span className="mt-2 block text-[10px] text-electric-300/80">
                        {Math.round(option.length)} m · {option.laps} laps
                      </span>
                      <span className="mt-1 block text-[10px] text-muted/80">
                        {record ? `PB ${formatRaceTime(record.time)}` : 'No PB yet'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Machine</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {VEHICLES.map((option) => {
                  const selected = carId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCarId(option.id)}
                      aria-pressed={selected}
                      aria-label={`Car: ${option.name}`}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-plasma-400/60 bg-plasma-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <Car className="h-4 w-4" style={{ color: option.accent }} aria-hidden="true" />
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted/70">
                          {option.maxSpeed} top
                        </span>
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.tagline}</span>
                      <div className="mt-2 space-y-1.5">
                        <StatBar label="Speed" value={(option.maxSpeed / 77) * 100} />
                        <StatBar label="Accel" value={(option.acceleration / 33) * 100} />
                        <StatBar label="Handling" value={(option.handling / 2.1) * 100} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <Target className="h-3.5 w-3.5" aria-hidden="true" /> {track.name} medal targets
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(['author', 'gold', 'silver', 'bronze'] as const).map((tier) => (
                  <span
                    key={tier}
                    className={`rounded-xl border px-2 py-1.5 text-center text-[10px] ${MEDAL_STYLE[tier]}`}
                  >
                    <span className="block uppercase tracking-[0.14em]">{MEDAL_LABEL[tier]}</span>
                    <span className="mt-0.5 block font-mono text-xs">{formatRaceTime(track.medals[tier])}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted/70">{track.description}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Run setup</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                3D · WebGL
              </span>
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
              <p className="mt-1">{track.tagline}</p>
              <ul className="mt-2 space-y-1">
                <li>
                  {track.laps} laps · {track.checkpoints.length} checkpoints per lap
                </li>
                <li>{Math.round(track.width)} m wide · {Math.round(track.length)} m long</li>
                {track.surfaces
                  .filter((zone) => zone.kind !== 'asphalt')
                  .map((zone) => (
                    <li key={`${zone.kind}-${zone.from}`}>
                      {SURFACE_LABEL[zone.kind]} sector {Math.round(zone.from * 100)}–
                      {Math.round(zone.to * 100)}% · lower grip
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] text-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Ghost className="h-3.5 w-3.5 text-electric-300" aria-hidden="true" /> Ghost
                </span>
                {ghost ? (
                  <button
                    type="button"
                    onClick={removeGhost}
                    aria-label="Clear saved ghost"
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-muted transition hover:border-white/30 hover:text-white"
                  >
                    Clear saved ghost
                  </button>
                ) : null}
              </div>
              <p className="mt-1">
                {ghost
                  ? `Ghost ready · ${formatRaceTime(ghost.time)}`
                  : 'No ghost yet. Set a personal best and it saves automatically.'}
              </p>
              <p className="mt-2 flex items-center justify-between">
                <span>Personal best</span>
                <span className="font-mono text-ink">
                  {bestRecord ? formatRaceTime(bestRecord.time) : '—'}
                </span>
              </p>
              <p className="flex items-center justify-between">
                <span>Runs stored</span>
                <span className="font-mono text-ink">{records.runs}</span>
              </p>
              {bestRecord ? (
                <p className="mt-1 flex items-center justify-between">
                  <span>Best medal</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${MEDAL_STYLE[bestRecord.medal]}`}>
                    {MEDAL_LABEL[bestRecord.medal]}
                  </span>
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={startRun}
              className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white shadow-[0_14px_40px_-14px_rgba(76,141,255,0.9)] transition hover:brightness-110 active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start time trial
            </button>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted/80">
              <span><b className="text-ink">W / ↑</b> accelerate</span>
              <span><b className="text-ink">S / ↓</b> brake</span>
              <span><b className="text-ink">A D / ← →</b> steer</span>
              <span><b className="text-ink">Space</b> handbrake</span>
              <span><b className="text-ink">P</b> pause</span>
              <span><b className="text-ink">C</b> camera</span>
              <span><b className="text-ink">R</b> respawn</span>
              <span><b className="text-ink">M</b> mute</span>
            </div>
            <p className="text-[10px] leading-4 text-muted/60">
              The clock starts when you cross the start line. Records and ghosts are stored locally
              in this browser only.
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

  const nextSplitLabel =
    hud.nextSplit === 'finish'
      ? 'Finish line'
      : hud.nextSplit === 'done'
        ? 'Complete'
        : `Checkpoint ${hud.sector}`;

  return (
    <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        aria-label="Apex Time Trial 3D. Use arrow keys or WASD to drive, Space for handbrake, R to respawn, P to pause, C to change camera and M to mute."
      />
      <WebGLContextNotice lost={contextLost} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-night-950/80 to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Lap</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.lap}
              <span className="ml-0.5 text-xs text-muted">/{hud.totalLaps}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Sector</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.sector}
              <span className="ml-0.5 text-xs text-muted">/{hud.totalSectors}</span>
            </p>
          </div>
          <div className="hidden rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md sm:block">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Next</p>
            <p className="text-xs font-semibold leading-tight text-white">{nextSplitLabel}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-night-950/65 px-4 py-1.5 text-center backdrop-blur-md">
          <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Clock className="h-3 w-3" aria-hidden="true" /> Run time
          </p>
          <p className="font-mono text-lg font-semibold leading-tight text-white">
            {formatRaceTime(hud.clock)}
          </p>
          <p className="text-[9px] text-muted">
            Best {hud.bestTime ? formatRaceTime(hud.bestTime) : '—'}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {phase === 'racing' ? (
            <button
              type="button"
              onClick={respawn}
              aria-label="Respawn at last checkpoint"
              className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-night-950/70 text-white backdrop-blur-md transition hover:bg-white/15"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={togglePause}
            aria-label={phase === 'paused' ? 'Resume time trial' : 'Pause time trial'}
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
            {hud.ghostProgress ? (
              <circle cx={hud.ghostProgress.x} cy={hud.ghostProgress.y} r="2.8" fill="#9fd8ff" opacity="0.85" />
            ) : null}
            <circle cx={hud.progress.x} cy={hud.progress.y} r="3.4" fill="#ffffff" stroke="#38e8ff" strokeWidth="2" />
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
          <p
            aria-label={`Current speed ${Math.round(hud.speed)} kilometres per hour`}
            className="font-display text-3xl font-semibold leading-none text-white"
          >
            {Math.round(hud.speed)}
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
            <Timer className="h-3 w-3" aria-hidden="true" /> {SURFACE_LABEL[hud.surface]}
          </p>
        </div>
      </div>

      {hud.splitDelta !== null && phase === 'racing' && !hud.awaitingStart ? (
        <p
          role="status"
          className={`pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold backdrop-blur-md ${
            hud.splitDelta <= 0
              ? 'border-mint/40 bg-mint/10 text-mint'
              : 'border-coral/40 bg-coral/10 text-coral'
          }`}
        >
          {formatSplitDelta(hud.splitDelta)}
        </p>
      ) : null}

      {hud.offTrack && phase === 'racing' ? (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md"
        >
          Off track — return to the course. Cuts over 1.5 s invalidate the run.
        </p>
      ) : null}

      {phase === 'racing' && hud.awaitingStart ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="rounded-2xl border border-white/15 bg-night-950/75 px-5 py-4 text-center backdrop-blur-md">
            <p className="text-[10px] uppercase tracking-[0.28em] text-electric-300">Clock armed</p>
            <p className="mt-1 font-display text-xl font-semibold text-white">
              Cross the start line to begin
            </p>
            <p className="mt-1 text-xs text-muted">The timer starts on your first crossing.</p>
          </div>
        </div>
      ) : null}

      {phase === 'countdown' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/20">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-electric-300">Ready</p>
            <p key={countdownLabel(hud.countdown)} className="animate-pop font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(56,232,255,0.8)]">
              {countdownLabel(hud.countdown)}
            </p>
            <p className="mt-2 text-xs text-muted">
              {track.name} · {track.laps} laps · {cameraLabels[camera]} camera
            </p>
          </div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="absolute inset-0 grid place-items-center bg-night-950/75 backdrop-blur-sm">
          <div className="w-[min(92%,360px)] rounded-3xl border border-white/12 bg-night-900/95 p-6 text-center shadow-2xl">
            <Pause className="mx-auto h-8 w-8 text-electric-300" aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-white">Time trial paused</h3>
            <p className="mt-1 text-sm text-muted">The clock is stopped. Your run is safe.</p>
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
                onClick={startRun}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart run
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

      {phase === 'invalid' ? (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-night-950/85 p-3 backdrop-blur-md">
          <div className="my-auto w-full max-w-sm rounded-3xl border border-coral/30 bg-night-900/95 p-5 text-center shadow-2xl">
            <Flag className="mx-auto h-8 w-8 text-coral" aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-white">Run invalidated</h3>
            <p className="mt-1 text-sm text-muted">{hud.invalidReason ?? 'The run is no longer valid.'}</p>
            <p className="mt-2 text-[11px] text-muted/70">
              Checkpoints must be taken in order. Leaving the course for more than 1.5 seconds also
              ends the run.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={startRun}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
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
                <p className="text-[10px] uppercase tracking-[0.22em] text-electric-300">
                  {isBest ? 'New personal best' : 'Run complete'}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  {formatRaceTime(result.time)}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {track.name} · {bestRecord ? `best ${formatRaceTime(bestRecord.time)}` : 'first recorded run'}
                </p>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${MEDAL_STYLE[result.medal]}`}>
                {result.medal === 'none' ? <Flag className="h-6 w-6" aria-hidden="true" /> : <Medal className="h-6 w-6" aria-hidden="true" />}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Medal</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">{MEDAL_LABEL[result.medal]}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Respawns</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{result.respawns}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Runs</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{records.runs}</dd>
              </div>
            </dl>

            <ol className="mt-4 space-y-1" aria-label="Sector splits">
              {result.splits.map((split, index) => {
                const lap = Math.floor(index / gatesPerLap) + 1;
                const sector = (index % gatesPerLap) + 1;
                const previous = baseline?.splits[index];
                const delta = previous === undefined ? null : split - previous;
                return (
                  <li
                    key={`${lap}-${sector}`}
                    className="flex items-center gap-2 rounded-xl bg-white/[0.025] px-3 py-1.5 text-sm text-muted"
                  >
                    <span className="w-16 text-[10px] uppercase tracking-[0.12em] text-muted/70">
                      L{lap} S{sector}
                    </span>
                    <span className="flex-1 font-mono text-xs text-ink">{formatRaceTime(split)}</span>
                    {delta !== null ? (
                      <span
                        className={`font-mono text-[11px] ${delta <= 0 ? 'text-mint' : 'text-coral'}`}
                      >
                        {formatSplitDelta(delta)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={startRun}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-electric-500 to-plasma-500 text-sm font-semibold text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Race again
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/5 text-sm font-medium text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change setup
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted/70">
              <Trophy className="h-3 w-3" aria-hidden="true" />
              {ghost ? 'Your next run races this ghost.' : 'A ghost saves with your next personal best.'}
            </p>
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
