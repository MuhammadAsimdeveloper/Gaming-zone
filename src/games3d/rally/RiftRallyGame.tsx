import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Flag,
  Gauge,
  Map,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameSegmented, Kbd } from '../../games/shared/GameFrame';
import { useBestScore } from '../../games/shared/useBestScore';
import { useVisibilityPause } from '../../games/shared/useVisibilityPause';
import { formatRaceTime } from '../shared/math';
import { readMutedPreference, writeMutedPreference } from '../shared/mutePreference';
import { WebGLContextNotice } from '../shared/WebGLContextNotice';
import { useWebGLContextLoss } from '../shared/useContextLoss';
import {
  RALLY_BEST_LAP_KEY,
  RallyEngine,
  type CameraMode,
  type RallyHud,
  type RallyResult,
  type RallySetup,
} from './engine';
import { CAR_CLASSES, type AiTier, type CarClassId, type Weather } from './physics';
import { RALLY_TRACKS, getRallyTrack, type RallyTrackId } from './track';

type Phase = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished';

const weatherOptions = [
  { value: 'clear', label: 'Clear' },
  { value: 'rain', label: 'Rain' },
] as const;

const tierOptions = [
  { value: 'rookie', label: 'Rookie' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
] as const;

const cameraOptions = [
  { value: 'chase', label: 'Chase' },
  { value: 'wide', label: 'Wide' },
  { value: 'hood', label: 'Hood' },
] as const;

const tierCopy: Record<AiTier, string> = {
  rookie: 'Relaxed rivals that leave the door open.',
  pro: 'Committed rivals with clean lines and late brakes.',
  elite: 'Maximum pace and almost no mistakes.',
};

const cameraLabels: Record<CameraMode, string> = {
  chase: 'Chase',
  wide: 'Wide',
  hood: 'Hood',
};

function makeStartHud(weather: Weather): RallyHud {
  return {
    speed: 0,
    gear: 1,
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
    driftCharge: 0,
    boostTime: 0,
    weather,
    minimapPlayer: { x: 50, y: 50 },
    minimapRivals: [],
  };
}

function StatBar({ label, value, tone = 'from-electric-400 to-plasma-400' }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/50">
        <span>{label}</span>
        <span>{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone}`}
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

function countdownLabel(value: number): string {
  return value > 0 ? String(value) : 'GO';
}

export default function RiftRallyGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RallyEngine | null>(null);
  const [phase, setPhase] = useState<Phase>('menu');
  const [trackId, setTrackId] = useState<RallyTrackId>('coastal-ring');
  const [carId, setCarId] = useState<CarClassId>('balanced');
  const [weather, setWeather] = useState<Weather>('clear');
  const [aiTier, setAiTier] = useState<AiTier>('pro');
  const [camera, setCamera] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(readMutedPreference);
  const [hud, setHud] = useState<RallyHud>(() => makeStartHud('clear'));
  const [result, setResult] = useState<RallyResult | null>(null);
  const [raceToken, setRaceToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { best, submit } = useBestScore(RALLY_BEST_LAP_KEY, true);
  const contextLost = useWebGLContextLoss(canvasRef);

  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  onStartRef.current = onStart;
  onCompleteRef.current = onComplete;

  const track = useMemo(() => getRallyTrack(trackId), [trackId]);
  const car = CAR_CLASSES[carId];
  const bestLap = hud.bestLap ?? best;

  const setupRef = useRef<RallySetup>({ trackId, carId, weather, aiTier, camera });
  setupRef.current = { trackId, carId, weather, aiTier, camera };
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => () => disposeEngine(), [disposeEngine]);

  useEffect(() => {
    if (raceToken === 0) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const setup = setupRef.current;
    let engine: RallyEngine;
    try {
      engine = new RallyEngine(canvas, setup, {
        onHud: setHud,
        onFinish: (finished) => {
          setResult(finished);
          setPhase('finished');
          if (finished.bestLap !== null) submit(finished.bestLap);
          onCompleteRef.current?.({
            outcome: finished.playerPosition === 1 ? 'win' : 'loss',
            score: finished.playerPosition,
          });
        },
      });
    } catch {
      setError('The 3D renderer could not start on this device. Try a browser with WebGL enabled.');
      setPhase('menu');
      return undefined;
    }

    engineRef.current = engine;
    engine.setMuted(mutedRef.current);
    onStartRef.current?.();
    return () => {
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [raceToken, submit]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (contextLost) engine.pause();
  }, [contextLost]);

  useEffect(() => {
    if (hud.phase === 'racing' && phase === 'countdown') setPhase('racing');
  }, [hud.phase, phase]);

  const startRace = useCallback(() => {
    disposeEngine();
    setResult(null);
    setError(null);
    setHud(makeStartHud(weather));
    setPhase('countdown');
    setRaceToken((token) => token + 1);
  }, [disposeEngine, weather]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === 'racing' || phase === 'countdown') {
      engine.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      engine.resume();
      setPhase(hud.phase === 'countdown' ? 'countdown' : 'racing');
    }
  }, [hud.phase, phase]);

  const toggleMute = useCallback(() => {
    setMuted((previous) => {
      const next = !previous;
      writeMutedPreference(next);
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const cycleCamera = useCallback(() => {
    const order: CameraMode[] = ['chase', 'wide', 'hood'];
    const next = order[(order.indexOf(camera) + 1) % order.length]!;
    setCamera(next);
    engineRef.current?.setCamera(next);
  }, [camera]);

  const leaveRace = useCallback(() => {
    disposeEngine();
    setResult(null);
    setPhase('menu');
  }, [disposeEngine]);

  const setTouch = useCallback((patch: Parameters<RallyEngine['setTouch']>[0]) => {
    engineRef.current?.setTouch(patch);
  }, []);

  const pauseOnHide = useCallback(() => {
    if (phase === 'racing' || phase === 'countdown') {
      engineRef.current?.pause();
      setPhase('paused');
    }
  }, [phase]);

  useVisibilityPause(pauseOnHide, phase === 'racing' || phase === 'countdown');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
      } else if (event.code === 'KeyM') {
        toggleMute();
      } else if (event.code === 'KeyC' && phase !== 'menu') {
        cycleCamera();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cycleCamera, phase, toggleMute, togglePause]);

  if (phase === 'menu') {
    return (
      <div className="relative min-h-[560px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(900px 460px at 12% -12%, rgba(56,232,255,0.18), transparent 65%), radial-gradient(720px 400px at 96% 4%, rgba(255,107,157,0.14), transparent 62%), linear-gradient(180deg, #040816 0%, #070d1f 100%)',
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-electric-300">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                NeonRift 3D · Arcade circuit racing
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Rift <span className="text-gradient">Rally</span>
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Three original circuits, three car classes, three AI tiers. Three laps against three
                rivals, in the dry or the rain, with a drift-charge boost and a ghost of your best
                lap saved in this browser.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Circuit</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {RALLY_TRACKS.map((option, index) => {
                  const selected = trackId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTrackId(option.id)}
                      aria-pressed={selected}
                      aria-label={`Circuit ${index + 1}: ${option.name}`}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-electric-400/60 bg-electric-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
                        <span>Circuit {index + 1}</span>
                        <Flag className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.tagline}</span>
                      <span className="mt-2 block text-[10px] text-electric-300/80">
                        {Math.round(option.length)} m · 3 laps · 6 gates
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Machine</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(Object.values(CAR_CLASSES) as typeof CAR_CLASSES[CarClassId][]).map((option) => {
                  const selected = carId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCarId(option.id)}
                      aria-pressed={selected}
                      aria-label={`Car class: ${option.name}`}
                      className={`rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-plasma-400/60 bg-plasma-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-muted/70">
                          {Math.round(option.maxSpeed * 3.6)} km/h top
                        </span>
                        <Gauge className="h-4 w-4 text-plasma-300" aria-hidden="true" />
                      </span>
                      <span className="mt-2 block text-sm font-semibold text-white">{option.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{option.tagline}</span>
                      <div className="mt-2 space-y-1.5">
                        <StatBar label="Speed" value={(option.maxSpeed / 62) * 100} />
                        <StatBar label="Accel" value={(option.accel / 24) * 100} tone="from-mint to-electric-400" />
                        <StatBar label="Drift" value={((1 - option.driftGrip) / 0.64) * 100} tone="from-coral to-plasma-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <Map className="h-3.5 w-3.5" aria-hidden="true" /> {track.name}
              </h3>
              <p className="mt-2 text-[11px] leading-5 text-muted">{track.description}</p>
              <p className="mt-2 text-[11px] text-muted">
                Personal best lap: <span className="font-mono text-mint">{best === null ? '—' : formatRaceTime(best / 60)}</span>
              </p>
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
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Weather</p>
              <GameSegmented
                label="Weather"
                options={weatherOptions}
                value={weather}
                onChange={setWeather}
                className="mt-2"
              />
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                {weather === 'clear' ? (
                  <Sun className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                ) : (
                  <CloudRain className="h-3.5 w-3.5 text-electric-300" aria-hidden="true" />
                )}
                {weather === 'clear' ? 'Full grip, dry curbs.' : 'Rain cuts grip by roughly a quarter and adds spray.'}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Rival tier</p>
              <GameSegmented
                label="Rival tier"
                options={tierOptions}
                value={aiTier}
                onChange={setAiTier}
                className="mt-2"
              />
              <p className="mt-1.5 text-[11px] text-muted">{tierCopy[aiTier]}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted/70">Camera</p>
              <GameSegmented
                label="Camera"
                options={cameraOptions}
                value={camera}
                onChange={setCamera}
                className="mt-2"
              />
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-night-950/60 p-3 text-[11px] leading-5 text-muted">
              <p className="font-medium text-ink">{car.name} · {track.name}</p>
              <ul className="mt-1 space-y-0.5">
                <li>3 laps · 6 checkpoint gates per lap · 3 rivals</li>
                <li>Drift on [Space], then release for a boost</li>
                <li>Touch: steer left/right, throttle, brake, drift</li>
              </ul>
            </div>

            <GameButton variant="primary" size="md" onClick={startRace} className="w-full">
              <Flag className="h-4 w-4" aria-hidden="true" /> Start race
            </GameButton>

            <div className="flex items-center justify-between text-[10px] text-muted/70">
              <span className="flex items-center gap-1">
                <Kbd>W</Kbd>
                <Kbd>A</Kbd>
                <Kbd>S</Kbd>
                <Kbd>D</Kbd> drive
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Space</Kbd> drift
              </span>
              <span className="flex items-center gap-1">
                <Kbd>C</Kbd> camera
              </span>
            </div>

            {error ? (
              <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-[11px] text-coral">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[560px] w-full overflow-hidden rounded-3xl border border-white/10 bg-night-950 text-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        tabIndex={0}
        aria-label={`${track.name} circuit. Use W A S D to drive, Space to drift, C to change camera.`}
      />

      <WebGLContextNotice lost={contextLost} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-none flex flex-wrap items-center gap-1.5">
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Lap</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.lap}
              <span className="ml-0.5 text-xs text-muted">/{hud.totalLaps}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Position</p>
            <p className="font-display text-xl font-semibold leading-none text-white">
              {hud.position}
              <span className="ml-0.5 text-xs text-muted">/{hud.racers}</span>
            </p>
          </div>
          <div className="hidden rounded-xl border border-white/10 bg-night-950/65 px-3 py-2 backdrop-blur-md sm:block">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted/70">Next gate</p>
            <p className="text-xs font-semibold leading-tight text-white">
              {hud.offTrack ? 'Return to the circuit' : `${track.name} · ${hud.weather}`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-night-950/65 px-4 py-1.5 text-center backdrop-blur-md">
          <p className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted/70">
            <Timer className="h-3 w-3" aria-hidden="true" /> Race time
          </p>
          <p className="font-mono text-lg font-semibold leading-tight text-white">
            {formatRaceTime(hud.raceTime)}
          </p>
          <p className="text-[9px] text-muted">
            Best {bestLap === null ? '—' : formatRaceTime(bestLap)}
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
          <svg viewBox="0 0 100 100" className="h-28 w-28" role="img" aria-label={`Minimap of ${track.name}`}>
            <polyline points={track.minimap} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" strokeLinejoin="round" />
            <polyline points={track.minimap} fill="none" stroke={track.accent} strokeWidth="1.6" strokeLinejoin="round" opacity="0.85" />
            {hud.minimapRivals.map((rival, index) => (
              <circle key={index} cx={rival.x} cy={rival.y} r="2.4" fill="#ff6b9d" opacity="0.9" />
            ))}
            <circle cx={hud.minimapPlayer.x} cy={hud.minimapPlayer.y} r="3.4" fill="#ffffff" stroke="#38e8ff" strokeWidth="2" />
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
          <p className="font-display text-3xl font-semibold leading-none text-white">{Math.round(hud.speed)}</p>
          <p className="mt-1 text-[10px] text-muted">Gear {hud.gear}</p>
          <div className="mt-2 w-28">
            <StatBar label="Drift" value={hud.driftCharge * 100} tone="from-coral to-plasma-400" />
            <div className="mt-1">
              <StatBar label="Boost" value={Math.min(100, hud.boostTime * 90)} tone="from-mint to-electric-400" />
            </div>
          </div>
        </div>
      </div>

      {hud.offTrack && phase === 'racing' ? (
        <p
          role="status"
          className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md"
        >
          Off the racing line — the grass is slow.
        </p>
      ) : null}

      {phase === 'countdown' ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/15">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.4em] text-electric-300">Get ready</p>
            <p className="animate-pop font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(56,232,255,0.8)]">
              {countdownLabel(hud.countdown)}
            </p>
            <p className="mt-1 text-xs text-muted">Three laps. Six gates. Three rivals.</p>
          </div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div role="dialog" aria-modal="true" aria-label="Race paused" className="absolute inset-0 z-20 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-night-900 p-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-electric-300">Paused</p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-white">{track.name}</h3>
            <p className="mt-1 text-xs text-muted">
              Lap {hud.lap} of {hud.totalLaps} · {formatRaceTime(hud.raceTime)}
            </p>
            <div className="mt-4 space-y-2">
              <GameButton variant="primary" size="md" className="w-full" onClick={togglePause}>
                <Play className="h-4 w-4" aria-hidden="true" /> Resume
              </GameButton>
              <GameButton variant="secondary" size="md" className="w-full" onClick={startRace}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart
              </GameButton>
              <GameButton variant="ghost" size="md" className="w-full" onClick={leaveRace}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change setup
              </GameButton>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'finished' && result ? (
        <div role="dialog" aria-modal="true" aria-label="Race result" className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-night-950/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-night-900 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-mint">Chequered flag</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  {result.playerPosition === 1 ? 'Race won' : `Finished P${result.playerPosition}`}
                </h3>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint ring-1 ring-mint/25">
                <Trophy className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {track.name} · {result.weather} · {formatRaceTime(result.raceTime)}
            </p>

            <ol className="mt-4 space-y-1.5">
              {result.rows.map((row) => (
                <li
                  key={row.name}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                    row.isPlayer ? 'border-electric-400/40 bg-electric-500/10 text-white' : 'border-white/10 text-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted/70">{row.position}</span>
                    {row.name}
                  </span>
                  <span className="font-mono">
                    {row.finishTime === null ? `Lap ${row.lapsCompleted}/3` : formatRaceTime(row.finishTime)}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-3 rounded-xl border border-white/10 bg-night-950/60 px-3 py-2 text-[11px] text-muted">
              Best lap {result.bestLap === null ? '—' : formatRaceTime(result.bestLap)}
              {result.newBestLap ? ' · new personal best' : ''}
            </p>

            <div className="mt-4 space-y-2">
              <GameButton variant="primary" size="md" className="w-full" onClick={startRace}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Race again
              </GameButton>
              <GameButton variant="secondary" size="md" className="w-full" onClick={leaveRace}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Change setup
              </GameButton>
            </div>
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
