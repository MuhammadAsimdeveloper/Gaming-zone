import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  Gauge,
  Magnet,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Shield,
  Sparkles,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameSegmented, GameStat, type SegmentOption } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { useWebGLContextLoss } from '../../games3d/shared/useContextLoss';
import { NeonRushEngine, type NeonRushHud, type NeonRushResult } from './engine';
import type { PlayerAction } from './player';
import {
  EMPTY_RECORDS,
  loadRecords,
  loadSettings,
  recordRun,
  saveRecords,
  saveSettings,
  type NeonRushRecords,
  type QualityPreset,
} from './persistence';
import type { RunMode } from './run';

type Phase = 'menu' | 'playing' | 'paused' | 'finished';

const EMPTY_HUD: NeonRushHud = {
  phase: 'countdown',
  countdown: 3,
  mode: 'endless',
  score: 0,
  distance: 0,
  speedKph: 43,
  shards: 0,
  combo: 0,
  multiplier: 1,
  crashes: 0,
  timeLeft: 0,
  shield: false,
  magnet: 0,
  overdrive: 0,
  dronePressure: 0,
};

const QUALITY_OPTIONS: ReadonlyArray<SegmentOption<QualityPreset>> = [
  { value: 'high', label: 'High' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'performance', label: 'Performance' },
];

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')}`;
}

export default function NeonRushGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<NeonRushEngine | null>(null);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<RunMode>('endless');
  const [settings, setSettings] = useState(() => loadSettings());
  const [records, setRecords] = useState<NeonRushRecords>(EMPTY_RECORDS);
  const [hud, setHud] = useState<NeonRushHud>(EMPTY_HUD);
  const [result, setResult] = useState<NeonRushResult | null>(null);
  const [isBest, setIsBest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(settings.muted);
  const contextLost = useWebGLContextLoss(canvasRef);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

  useEffect(() => disposeEngine, [disposeEngine]);

  const finish = useCallback((next: NeonRushResult) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setResult(next);
    setPhase('finished');
    const outcome = recordRun(loadRecords(), next);
    saveRecords(outcome.records);
    setRecords(outcome.records);
    setIsBest(outcome.isBest);
    onCompleteRef.current?.({
      score: next.score,
      outcome: next.mode === 'time-attack' && next.endReason === 'time' ? 'complete' : 'loss',
    });
  }, []);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    disposeEngine();
    setError(null);
    setResult(null);
    setIsBest(false);
    finishedRef.current = false;
    setHud({ ...EMPTY_HUD, mode });
    setPhase('playing');

    try {
      const engine = new NeonRushEngine(
        canvas,
        { mode, seed: Math.floor(Math.random() * 2_147_483_647), quality: settings.quality },
        {
          onHud: (next) => setHud(next),
          onFinish: finish,
        },
      );
      engineRef.current = engine;
      if (settings.muted) engine.toggleMute();
      onStartRef.current?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `The 3D renderer could not start: ${cause.message}`
          : 'The 3D renderer could not start on this device.',
      );
      setPhase('menu');
    }
  }, [disposeEngine, finish, mode, settings.muted, settings.quality]);

  const chooseSetup = useCallback(() => {
    disposeEngine();
    setResult(null);
    setPhase('menu');
    setHud(EMPTY_HUD);
  }, [disposeEngine]);

  const togglePause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (phase === 'playing') {
      engine.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      engine.resume();
      setPhase('playing');
    }
  }, [phase]);

  useVisibilityPause(togglePause, phase === 'playing');

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (contextLost && phase === 'playing') {
      engine.pause();
      setPhase('paused');
    }
  }, [contextLost, phase]);

  const toggleMute = useCallback(() => {
    const next = engineRef.current?.toggleMute() ?? !muted;
    setMuted(next);
    const updated = { ...settings, muted: next };
    setSettings(updated);
    saveSettings(updated);
  }, [muted, settings]);

  const changeQuality = useCallback((quality: QualityPreset) => {
    setSettings((current) => {
      const updated = { ...current, quality };
      saveSettings(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      if (event.code === 'KeyP' || (event.code === 'Escape' && phase === 'paused')) {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'KeyM') {
        event.preventDefault();
        toggleMute();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, toggleMute, togglePause]);

  const perform = useCallback((action: PlayerAction) => {
    engineRef.current?.applyAction(action);
  }, []);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || phase !== 'playing') return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) perform(dx > 0 ? 'right' : 'left');
      else perform(dy > 0 ? 'roll' : 'jump');
    },
    [perform, phase],
  );

  const playing = phase === 'playing';
  const countdownVisible = playing && hud.phase === 'countdown';
  const status = error
    ? error
    : phase === 'menu'
      ? 'Choose Endless or Time Attack, then start the run.'
      : phase === 'finished' && result
        ? `Run ended with ${result.score} points over ${result.distance} metres.`
        : `${hud.score} points, ${hud.distance} metres, ${hud.shards} shards.`;

  const modeLabel = mode === 'endless' ? 'Endless' : 'Time attack';

  return (
    <GameFrame
      title="Neon Rush"
      subtitle="Three lanes. One runner. No finish line."
      icon={Zap}
      accent="electric"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label="Score" value={hud.score.toLocaleString()} tone="mint" />
          <GameStat label="Distance" value={`${hud.distance}m`} />
          <GameStat label="Shards" value={hud.shards} tone="electric" />
          <GameStat
            label={mode === 'time-attack' ? 'Time left' : 'Speed'}
            value={mode === 'time-attack' ? formatClock(hud.timeLeft) : `${hud.speedKph} km/h`}
            tone={mode === 'time-attack' && hud.timeLeft < 20 ? 'coral' : 'ink'}
          />
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
              aria-label={phase === 'paused' ? 'Resume run' : 'Pause run'}
              title={phase === 'paused' ? 'Resume run' : 'Pause run'}
            >
              {phase === 'paused' ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </GameButton>
          ) : null}
          <GameButton
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            aria-pressed={muted}
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </GameButton>
          {phase !== 'menu' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={chooseSetup}
              aria-label="Back to run setup"
              title="Back to run setup"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Arrows / WASD steer and jump or roll. P pauses. M mutes.</span>
          <span>Shards build a combo up to 6x. Shield, magnet and overdrive spawn on the track.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={phase === 'menu' || phase === 'paused' || phase === 'finished' ? true : undefined}>
          <div className="relative h-[440px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[520px]">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                swipeStart.current = null;
              }}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Neon Rush. Three-lane endless runner. Use arrow keys or WASD to switch lanes, jump and roll."
            />

            {playing || phase === 'paused' ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="flex flex-wrap gap-2">
                  {hud.combo > 0 ? (
                    <span className="rounded-full border border-mint/30 bg-night-950/80 px-2.5 py-1 text-[11px] font-semibold text-mint">
                      Combo {hud.combo} · {hud.multiplier.toFixed(2)}x
                    </span>
                  ) : null}
                  {hud.shield ? (
                    <span className="flex items-center gap-1 rounded-full border border-electric-400/40 bg-night-950/80 px-2.5 py-1 text-[11px] text-electric-200">
                      <Shield className="h-3 w-3" aria-hidden="true" /> Shield
                    </span>
                  ) : null}
                  {hud.magnet > 0 ? (
                    <span className="flex items-center gap-1 rounded-full border border-plasma-400/40 bg-night-950/80 px-2.5 py-1 text-[11px] text-plasma-200">
                      <Magnet className="h-3 w-3" aria-hidden="true" /> {hud.magnet.toFixed(1)}s
                    </span>
                  ) : null}
                  {hud.overdrive > 0 ? (
                    <span className="flex items-center gap-1 rounded-full border border-coral/40 bg-night-950/80 px-2.5 py-1 text-[11px] text-coral">
                      <Flame className="h-3 w-3" aria-hidden="true" /> {hud.overdrive.toFixed(1)}s
                    </span>
                  ) : null}
                </div>
                <span className="rounded-full border border-white/10 bg-night-950/80 px-2.5 py-1 text-[11px] text-muted">
                  {hud.crashes}/2 crashes
                </span>
              </div>
            ) : null}

            {countdownVisible ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/35">
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-electric-300">{modeLabel}</p>
                  <p className="font-display text-7xl font-bold tabular-nums text-white drop-shadow-[0_0_28px_rgba(76,141,255,0.8)]">
                    {Math.ceil(hud.countdown) || 'GO'}
                  </p>
                </div>
              </div>
            ) : null}

            {playing || phase === 'paused' ? (
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <TouchButton label="Left" onClick={() => perform('left')}>
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </TouchButton>
                  <TouchButton label="Right" onClick={() => perform('right')}>
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </TouchButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TouchButton label="Roll" onClick={() => perform('roll')}>
                    <ArrowDown className="h-5 w-5" aria-hidden="true" />
                  </TouchButton>
                  <TouchButton label="Jump" onClick={() => perform('jump')} accent>
                    <ArrowUp className="h-5 w-5" aria-hidden="true" />
                  </TouchButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {phase === 'menu' ? (
          <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-electric-300">
                    NeonRift 3D · Endless runner
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Pick a lane. <span className="text-gradient">Pick a pace.</span>
                  </h3>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    Dodge trains, vault barriers and roll under gates through a procedural neon corridor.
                    Every run is generated from a fresh seed and checked for a fair route.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Best</p>
                    <p className="font-display text-lg font-semibold text-mint">{records.bestScore.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Runs</p>
                    <p className="font-display text-lg font-semibold text-ink">{records.runs}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ModeCard
                  selected={mode === 'endless'}
                  title="Endless"
                  description="Two crashes and the hunter drone takes you. Chase the highest score."
                  icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setMode('endless')}
                />
                <ModeCard
                  selected={mode === 'time-attack'}
                  title="Time attack"
                  description="Two minutes on the clock. Every crash costs two seconds, not the run."
                  icon={<Timer className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => setMode('time-attack')}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Quality</p>
                  <GameSegmented options={QUALITY_OPTIONS} value={settings.quality} onChange={changeQuality} label="Render quality" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Browser-local bests</p>
                  <p className="text-[11px] text-muted">
                    {records.bestDistance}m · {records.bestShards} shards
                  </p>
                </div>
              </div>

              {error ? (
                <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-xs text-coral">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <GameButton variant="primary" onClick={start}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Start {modeLabel.toLowerCase()}
                </GameButton>
                <span className="text-[11px] text-muted">Best scores are stored only in this browser.</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Guide icon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />} label="Switch lanes" value="A / D or ← / →" />
                <Guide icon={<ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />} label="Jump barriers" value="W / ↑ / Space" />
                <Guide icon={<ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />} label="Roll under gates" value="S / ↓" />
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'paused' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Run paused</p>
            <h3 className="font-display text-xl font-semibold text-ink">Catch your breath</h3>
            <p className="max-w-xs text-xs leading-5 text-muted">
              {hud.distance}m covered · {hud.shards} shards · {hud.score.toLocaleString()} points
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
          <GameOverlay tone={isBest ? 'win' : 'loss'}>
            <span
              className={cn(
                'grid h-12 w-12 place-items-center rounded-2xl',
                isBest ? 'bg-mint/10 text-mint' : 'bg-electric-500/10 text-electric-300',
              )}
            >
              {isBest ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Gauge className="h-6 w-6" aria-hidden="true" />}
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {isBest ? 'New personal best' : result.endReason === 'time' ? 'Time up' : 'Drone caught you'}
            </h3>
            <p className="text-sm text-muted">
              <b className="text-ink">{result.score.toLocaleString()}</b> points · {result.distance}m ·{' '}
              {result.shards} shards · {result.crashes} crash{result.crashes === 1 ? '' : 'es'}
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Trophy className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
              Browser-local best {records.bestScore.toLocaleString()} · {records.runs} run{records.runs === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={start}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Run again
              </GameButton>
              <GameButton variant="secondary" onClick={chooseSetup}>
                Change setup
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

function TouchButton({
  label,
  onClick,
  accent = false,
  children,
}: {
  label: string;
  onClick: () => void;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'grid h-12 w-12 place-items-center rounded-2xl border text-ink backdrop-blur transition active:scale-95 sm:h-11 sm:w-11',
        accent
          ? 'border-electric-400/50 bg-electric-500/25 text-white'
          : 'border-white/15 bg-night-950/65 hover:bg-night-900/80',
      )}
    >
      {children}
    </button>
  );
}

function ModeCard({
  selected,
  title,
  description,
  icon,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl border p-3 text-left transition',
        selected
          ? 'border-electric-400/60 bg-electric-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg', selected ? 'bg-electric-500/20 text-electric-200' : 'bg-white/5 text-muted')}>
          {icon}
        </span>
        {title}
      </span>
      <span className="mt-1 block text-[11px] leading-5 text-muted">{description}</span>
    </button>
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
