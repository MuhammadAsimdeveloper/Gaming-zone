import {
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Flag,
  Gauge,
  Lock,
  Map,
  Pause,
  Play,
  RotateCcw,
  Route,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useVisibilityPause } from '../../games/shared/useVisibilityPause';
import type { GameComponentProps } from '../../types/game';
import {
  DRIVE_CARS,
  DRIVE_EXTENT,
  DRIVE_MISSIONS,
  ROAD_LINES,
  getDriveCar,
  getDriveMission,
  loadDriveRecord,
  saveDriveRecord,
  type DriveCameraMode,
  type DriveCarId,
  type DriveRecord,
} from './city';
import { DriveEngine, type DriveHud, type DriveResult } from './engine';

type Phase = 'menu' | 'drive' | 'paused' | 'finished';

const START_HUD: DriveHud = {
  speedKph: 0,
  phase: 'countdown',
  countdown: 3,
  missionName: '',
  checkpoint: 0,
  totalCheckpoints: 5,
  timeLeft: 85,
  elapsed: 0,
  clock: '08:38',
  crashes: 0,
  offRoad: false,
  distanceToTarget: 0,
  targetBearing: 0,
  message: null,
  playerHeading: 0,
  minimapPlayer: { x: 50, y: 87.5 },
  minimapTarget: null,
  minimapTraffic: [],
};

const cameraLabels: Record<DriveCameraMode, string> = {
  chase: 'Chase',
  far: 'Wide',
  hood: 'Hood',
};

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function mapX(worldX: number): number {
  return ((worldX + DRIVE_EXTENT) / (DRIVE_EXTENT * 2)) * 100;
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

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/50">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-mint to-electric-400"
          style={{ width: `${Math.max(6, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function NeonCityDriveGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DriveEngine | null>(null);
  const touchRef = useRef({ forward: false, back: false, left: false, right: false, handbrake: false });
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<DriveHud>(START_HUD);
  const [missionId, setMissionId] = useState(DRIVE_MISSIONS[0]!.id);
  const [carId, setCarId] = useState<DriveCarId>('nova-gt');
  const [camera, setCamera] = useState<DriveCameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<DriveResult | null>(null);
  const [record, setRecord] = useState<DriveRecord>(() => loadDriveRecord());
  const [error, setError] = useState<string | null>(null);

  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  const mission = useMemo(() => getDriveMission(missionId), [missionId]);
  const car = useMemo(() => getDriveCar(carId), [carId]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => () => disposeEngine(), [disposeEngine]);

  const resetTouch = useCallback(() => {
    touchRef.current = { forward: false, back: false, left: false, right: false, handbrake: false };
    engineRef.current?.setTouch(touchRef.current);
  }, []);

  const startMission = useCallback(
    (overrideMissionId?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const selectedMission = getDriveMission(overrideMissionId ?? missionId);
      disposeEngine();
      resetTouch();
      setMissionId(selectedMission.id);
      setResult(null);
      setError(null);
      setHud({
        ...START_HUD,
        missionName: selectedMission.name,
        totalCheckpoints: selectedMission.route.length,
        timeLeft: selectedMission.timeLimit,
      });
      setPhase('drive');

      try {
        const engine = new DriveEngine(
          canvas,
          { missionId: selectedMission.id, carId, camera },
          {
            onHud: (nextHud) => setHud(nextHud),
            onFinish: (runResult) => {
              setResult(runResult);
              setPhase('finished');
              setRecord((previous) => {
                const previousBest = previous.bestTimes[runResult.missionId];
                const bestTime =
                  runResult.outcome === 'win' &&
                  (previousBest === undefined || runResult.elapsed < previousBest)
                    ? runResult.elapsed
                    : previousBest;
                const completed =
                  runResult.outcome === 'win' && !previous.completed.includes(runResult.missionId)
                    ? [...previous.completed, runResult.missionId]
                    : previous.completed;
                const next: DriveRecord = {
                  runs: previous.runs + 1,
                  completed,
                  bestTimes:
                    bestTime !== undefined
                      ? { ...previous.bestTimes, [runResult.missionId]: bestTime }
                      : previous.bestTimes,
                };
                saveDriveRecord(next);
                return next;
              });
              const remaining = Math.max(0, runResult.timeLimit - runResult.elapsed);
              const score = Math.round(
                (runResult.checkpoints / Math.max(1, runResult.totalCheckpoints)) * 1200 +
                  remaining * 22 +
                  (runResult.outcome === 'win' ? 600 : 0) -
                  runResult.crashes * 40,
              );
              onCompleteRef.current?.({
                score: Math.max(0, score),
                outcome: runResult.outcome === 'win' ? 'win' : 'loss',
              });
            },
          },
        );
        if (muted) engine.toggleMute();
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
    },
    [camera, carId, disposeEngine, missionId, muted, resetTouch],
  );

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === 'drive') {
      engine.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      engine.resume();
      setPhase('drive');
    }
  }, [phase]);

  useVisibilityPause(togglePause, phase === 'drive');

  const toggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute();
    if (next !== undefined) setMuted(next);
  }, []);

  const cycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleCamera();
    if (next) setCamera(next);
  }, []);

  const chooseSetup = useCallback(() => {
    disposeEngine();
    resetTouch();
    setResult(null);
    setPhase('menu');
    setHud(START_HUD);
  }, [disposeEngine, resetTouch]);

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
      if (phase !== 'drive' && phase !== 'paused') return;
      if (event.code === 'KeyP' || (event.code === 'Escape' && phase === 'paused')) {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'KeyC') {
        event.preventDefault();
        cycleCamera();
      }
      if (event.code === 'KeyM') {
        toggleMute();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleCamera, phase, toggleMute, togglePause]);

  const applyTouch = useCallback((patch: Partial<typeof touchRef.current>) => {
    touchRef.current = { ...touchRef.current, ...patch };
    engineRef.current?.setTouch(touchRef.current);
  }, []);

  const missionIndex = DRIVE_MISSIONS.findIndex((option) => option.id === missionId);
  const nextMission = DRIVE_MISSIONS[missionIndex + 1];

  if (phase === 'menu') {
    return (
      <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 420px at 85% -10%, rgba(56,232,255,0.16), transparent 65%), radial-gradient(700px 420px at 5% 10%, rgba(160,107,255,0.16), transparent 65%), linear-gradient(180deg, #050814 0%, #07101d 100%)',
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                <Route className="h-3.5 w-3.5" aria-hidden="true" />
                NeonRift 3D · Open world
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Neon <span className="text-gradient">City Drive</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                A compact city grid with live traffic, a moving day-night cycle and checkpoint runs.
                Every building, road and car is original procedural geometry — no map downloads.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Missions</h3>
                <span className="text-[11px] text-muted/70">Finish a mission to unlock the next</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {DRIVE_MISSIONS.map((option, index) => {
                  const locked =
                    index > 0 &&
                    !record.completed.includes(DRIVE_MISSIONS[index - 1]!.id) &&
                    !record.completed.includes(option.id);
                  const selected = missionId === option.id;
                  const best = record.bestTimes[option.id];
                  const finished = record.completed.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (!locked) setMissionId(option.id);
                      }}
                      disabled={locked}
                      aria-pressed={selected}
                      className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-mint/50 bg-mint/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      } ${locked ? 'cursor-not-allowed opacity-55' : ''}`}
                    >
                      <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
                        <span>Run {index + 1}</span>
                        {locked ? (
                          <Lock className="h-3 w-3" aria-hidden="true" />
                        ) : finished ? (
                          <Trophy className="h-3 w-3 text-amber-300" aria-hidden="true" />
                        ) : (
                          <Flag className="h-3 w-3" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-muted">{option.brief}</span>
                      <span className="mt-2 flex items-center gap-3 text-[10px] text-muted/80">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" /> {option.timeLimit}s</span>
                        <span className="inline-flex items-center gap-1"><Flag className="h-3 w-3" aria-hidden="true" /> {option.route.length} gates</span>
                        {best !== undefined ? <span className="text-mint">Best {formatTime(best)}</span> : null}
                      </span>
                      {locked ? (
                        <span className="mt-2 block text-[10px] text-amber-300/90">
                          Finish {DRIVE_MISSIONS[index - 1]!.name} first
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Vehicle</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {DRIVE_CARS.map((option) => {
                  const selected = carId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCarId(option.id)}
                      aria-pressed={selected}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-plasma-400/60 bg-plasma-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <Car className="h-4 w-4" style={{ color: option.accent }} aria-hidden="true" />
                      <span className="mt-2 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.tagline}</span>
                      <div className="mt-2 space-y-1.5">
                        <StatBar label="Speed" value={(option.maxSpeed / 31) * 100} />
                        <StatBar label="Accel" value={(option.acceleration / 15.5) * 100} />
                        <StatBar label="Handling" value={(option.handling / 2.2) * 100} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Drive setup</h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                3D · WebGL
              </span>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Camera</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-night-900/80 p-1">
                {(['chase', 'far', 'hood'] as DriveCameraMode[]).map((value) => (
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
              <p className="font-medium text-ink">{mission.name}</p>
              <p className="mt-1">{mission.brief}</p>
              <p className="mt-2 text-mint/90">
                {car.name} · {formatTime(mission.timeLimit)} on the clock
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] text-muted">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted/70">
                <Trophy className="h-3 w-3" aria-hidden="true" /> Driver log
              </p>
              <p className="mt-1.5 text-sm font-semibold text-white">
                {record.runs} run{record.runs === 1 ? '' : 's'} · {record.completed.length}/{DRIVE_MISSIONS.length} missions
              </p>
              <p className="mt-0.5">{record.completed.length === 0 ? 'No mission finished yet' : `Cleared: ${record.completed.map((id) => getDriveMission(id).name).join(', ')}`}</p>
            </div>

            <button
              type="button"
              onClick={() => startMission()}
              className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950 shadow-[0_14px_40px_-14px_rgba(110,231,255,0.8)] transition hover:brightness-110 active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start drive
            </button>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted/80">
              <span><b className="text-ink">W / ↑</b> accelerate</span>
              <span><b className="text-ink">S / ↓</b> brake / reverse</span>
              <span><b className="text-ink">A D / ← →</b> steer</span>
              <span><b className="text-ink">Space</b> handbrake</span>
              <span><b className="text-ink">C</b> camera</span>
              <span><b className="text-ink">P</b> pause</span>
            </div>
            <p className="text-[10px] leading-4 text-muted/60">
              Touch pads appear while driving. Records and unlocks stay in this browser.
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

  const clockHour = Number(hud.clock.slice(0, 2));
  const isNight = clockHour < 6 || clockHour >= 19;

  return (
    <div className="relative min-h-[520px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        aria-label="Neon City Drive. Use WASD or arrow keys to drive, Space for handbrake, C to change camera and P to pause."
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-night-950/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-night-950/85 to-transparent" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="max-w-[42%] rounded-xl border border-white/10 bg-night-950/70 px-3 py-2 backdrop-blur-md">
          <p className="truncate text-[9px] uppercase tracking-[0.2em] text-muted/70">{hud.missionName}</p>
          <p className="mt-0.5 font-display text-sm font-semibold leading-tight text-white">
            Gate {Math.min(hud.checkpoint + 1, hud.totalCheckpoints)}
            <span className="ml-1 text-[11px] font-normal text-muted">/ {hud.totalCheckpoints}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-mint">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-mint/15">
              <ChevronUp
                className="h-3 w-3"
                aria-hidden="true"
                style={{ transform: `rotate(${(-hud.targetBearing * 180) / Math.PI}deg)` }}
              />
            </span>
            {Math.round(hud.distanceToTarget)} m
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-night-950/70 px-4 py-1.5 text-center backdrop-blur-md">
          <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Clock className="h-3 w-3" aria-hidden="true" /> {hud.clock}
          </p>
          <p className={`font-mono text-xl font-semibold leading-tight ${hud.timeLeft <= 15 ? 'text-coral' : 'text-white'}`}>
            {formatTime(hud.timeLeft)}
          </p>
          <p className="text-[9px] uppercase tracking-[0.16em] text-muted/60">{isNight ? 'Night' : 'Day'} run</p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePause}
            aria-label={phase === 'paused' ? 'Resume drive' : 'Pause drive'}
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
        <div className="rounded-2xl border border-white/10 bg-night-950/70 p-2 backdrop-blur-md">
          <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label="City minimap with your car, traffic and the next gate">
            <rect x="0" y="0" width="100" height="100" rx="6" fill="#050a14" />
            {ROAD_LINES.map((line) => (
              <g key={line}>
                <line x1="0" y1={mapX(line)} x2="100" y2={mapX(line)} stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
                <line x1={mapX(line)} y1="0" x2={mapX(line)} y2="100" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
              </g>
            ))}
            {hud.minimapTraffic.map((traffic, index) => (
              <circle key={index} cx={traffic.x} cy={traffic.y} r="1.2" fill="#cbd5f5" opacity="0.55" />
            ))}
            {hud.minimapTarget ? (
              <g>
                <circle cx={hud.minimapTarget.x} cy={hud.minimapTarget.y} r="5" fill="none" stroke="#ffd166" strokeWidth="1.2" opacity="0.5" />
                <circle cx={hud.minimapTarget.x} cy={hud.minimapTarget.y} r="2.6" fill="#ffd166" />
              </g>
            ) : null}
            <g transform={`translate(${hud.minimapPlayer.x} ${hud.minimapPlayer.y}) rotate(${(-hud.playerHeading * 180) / Math.PI})`}>
              <polygon points="0,-4 2.8,3 -2.8,3" fill="#ffffff" stroke="#4c8dff" strokeWidth="1" />
            </g>
          </svg>
          <p className="flex items-center gap-1 px-1 text-[9px] uppercase tracking-[0.18em] text-muted/70">
            <Map className="h-3 w-3" aria-hidden="true" /> City grid
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 hidden text-right sm:block">
        <div className="rounded-2xl border border-white/10 bg-night-950/70 px-4 py-2 backdrop-blur-md">
          <p className="flex items-center justify-end gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Gauge className="h-3 w-3" aria-hidden="true" /> km/h
          </p>
          <p className="font-display text-3xl font-semibold leading-none text-white">{Math.round(hud.speedKph)}</p>
          <p className="mt-1 text-[10px] text-muted">
            {hud.offRoad ? <span className="text-amber-300">Off road · slow</span> : `Crashes ${hud.crashes}`}
          </p>
        </div>
      </div>

      {hud.offRoad && hud.phase === 'driving' ? (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md"
        >
          Off the asphalt — return to a road
        </p>
      ) : null}

      {hud.message ? (
        <p className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 rounded-full border border-mint/30 bg-night-950/80 px-4 py-1.5 text-xs font-semibold text-mint backdrop-blur-md">
          {hud.message}
        </p>
      ) : null}

      {phase === 'drive' && hud.phase === 'countdown' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/25">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-mint">Engine hot</p>
            <p key={hud.countdown} className="animate-pop font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(110,231,255,0.8)]">
              {hud.countdown > 0 ? hud.countdown : 'GO'}
            </p>
            <p className="mt-2 text-xs text-muted">{hud.missionName} · {car.name}</p>
          </div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="absolute inset-0 grid place-items-center bg-night-950/75 backdrop-blur-sm">
          <div className="w-[min(92%,360px)] rounded-3xl border border-white/12 bg-night-900/95 p-6 text-center shadow-2xl">
            <Pause className="mx-auto h-8 w-8 text-mint" aria-hidden="true" />
            <h3 className="mt-3 font-display text-xl font-semibold text-white">Drive paused</h3>
            <p className="mt-1 text-sm text-muted">The clock, traffic and day-night cycle are frozen.</p>
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
                onClick={() => startMission()}
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

      {phase === 'finished' && result ? (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-night-950/85 p-3 backdrop-blur-md">
          <div className="my-auto w-full max-w-md rounded-3xl border border-white/12 bg-night-900/95 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-mint">
                  {result.outcome === 'win' ? 'Route complete' : 'Time expired'}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  {result.outcome === 'win' ? result.missionName : 'Run failed'}
                </h3>
              </div>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${result.outcome === 'win' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-muted'}`}>
                {result.outcome === 'win' ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Timer className="h-6 w-6" aria-hidden="true" />}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Gates</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">
                  {result.checkpoints}/{result.totalCheckpoints}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Elapsed</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{formatTime(result.elapsed)}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <dt className="text-[9px] uppercase tracking-[0.16em] text-muted/70">Crashes</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold text-white">{result.crashes}</dd>
              </div>
            </dl>

            <p className="mt-3 text-center text-[11px] text-muted">
              {result.outcome === 'win' && record.bestTimes[result.missionId] !== undefined
                ? `Best time for this route: ${formatTime(record.bestTimes[result.missionId]!)}`
                : 'Drive clean, follow the rooftops and brake early for corners.'}
            </p>

            <div className="mt-5 space-y-2">
              {result.outcome === 'win' && nextMission ? (
                <button
                  type="button"
                  onClick={() => startMission(nextMission.id)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-electric-500 text-sm font-semibold text-night-950"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" /> Next: {nextMission.name}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => startMission()}
                className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                  result.outcome === 'win' && nextMission
                    ? 'border border-white/12 bg-white/5 text-white'
                    : 'bg-gradient-to-r from-mint to-electric-500 text-night-950'
                }`}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry {result.missionName}
              </button>
              <button
                type="button"
                onClick={chooseSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-muted hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Mission select
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'drive' || phase === 'paused' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-end justify-between px-3 sm:hidden">
          <div className="pointer-events-auto flex gap-2">
            <TouchButton
              label="Steer left"
              onPress={() => applyTouch({ left: true })}
              onRelease={() => applyTouch({ left: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Steer right"
              onPress={() => applyTouch({ right: true })}
              onRelease={() => applyTouch({ right: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </TouchButton>
          </div>
          <div className="pointer-events-auto flex items-end gap-2">
            <TouchButton
              label="Handbrake"
              onPress={() => applyTouch({ handbrake: true })}
              onRelease={() => applyTouch({ handbrake: false })}
              className="h-12 w-12 rounded-2xl text-[9px] uppercase tracking-wider"
            >
              Drift
            </TouchButton>
            <TouchButton
              label="Brake"
              onPress={() => applyTouch({ back: true })}
              onRelease={() => applyTouch({ back: false })}
              className="h-14 w-14 rounded-2xl"
            >
              <Timer className="h-5 w-5" aria-hidden="true" />
            </TouchButton>
            <TouchButton
              label="Accelerate"
              onPress={() => applyTouch({ forward: true })}
              onRelease={() => applyTouch({ forward: false })}
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
