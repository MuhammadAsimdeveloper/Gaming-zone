import {
  CircleDot,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameSegmented, GameStat, type SegmentOption } from '../../games/shared/GameFrame';
import { isInteractiveTarget } from '../../games/shared/keyboard';
import { useVisibilityPause } from '../../games/shared/useVisibilityPause';
import { WebGLContextNotice } from '../shared/WebGLContextNotice';
import { useWebGLContextLoss } from '../shared/useContextLoss';
import type { ShotDirection, ShotType } from './batting';
import type { BowlingInput, BowlingLength, BowlingLine, BowlingVariation } from './delivery';
import {
  StreetCricketEngine,
  type CricketHud,
  type TimingFrame,
} from './engine';
import {
  DEFAULT_SETTINGS,
  EMPTY_RECORDS,
  loadRecords,
  loadSettings,
  recordMatch,
  saveRecords,
  saveSettings,
  type CricketRecords,
  type CricketSettings,
} from './persistence';
import { FORMAT_CONFIG, oversLabel, type MatchFormat, type MatchResult } from './rules';
import { DISTRICTS, opponentFor, type District } from './teams';
import type { TimingGrade } from './types';

type Phase = 'menu' | 'playing' | 'paused' | 'finished';

const FORMAT_OPTIONS: ReadonlyArray<SegmentOption<MatchFormat>> = [
  { value: 'super-over', label: 'Super Over' },
  { value: 'rooftop-chase', label: 'Rooftop Chase' },
  { value: 'nets', label: 'Nets' },
];

const DIRECTION_OPTIONS: ReadonlyArray<SegmentOption<ShotDirection>> = [
  { value: 'fine', label: 'Fine' },
  { value: 'point', label: 'Point' },
  { value: 'cover', label: 'Cover' },
  { value: 'straight', label: 'Straight' },
  { value: 'midwicket', label: 'Midwicket' },
  { value: 'leg', label: 'Leg' },
];

const SHOT_OPTIONS: ReadonlyArray<SegmentOption<ShotType>> = [
  { value: 'block', label: 'Block' },
  { value: 'drive', label: 'Drive' },
  { value: 'loft', label: 'Loft' },
];

const LINE_OPTIONS: ReadonlyArray<SegmentOption<BowlingLine>> = [
  { value: 'off', label: 'Off' },
  { value: 'middle', label: 'Middle' },
  { value: 'leg', label: 'Leg' },
];

const LENGTH_OPTIONS: ReadonlyArray<SegmentOption<BowlingLength>> = [
  { value: 'short', label: 'Short' },
  { value: 'good', label: 'Good' },
  { value: 'full', label: 'Full' },
];

const VARIATION_OPTIONS: ReadonlyArray<SegmentOption<BowlingVariation>> = [
  { value: 'stock', label: 'Stock' },
  { value: 'pace', label: 'Pace' },
  { value: 'spin', label: 'Spin' },
];

const EMPTY_HUD: CricketHud = {
  phase: 'ready',
  control: 'bat',
  format: 'super-over',
  message: 'Super Over. You bat first.',
  runs: 0,
  wickets: 0,
  balls: 0,
  target: null,
  battingTeam: 'Harbour',
  sixes: 0,
  fours: 0,
  aim: 'straight',
  shotType: 'drive',
  bowling: { line: 'middle', length: 'good', variation: 'stock' },
  lastGrade: null,
  canSwing: false,
  canBowl: false,
  deliveryLabel: null,
  matchResult: null,
};

const GRADE_TONE: Record<TimingGrade, 'ink' | 'mint' | 'coral' | 'electric' | 'plasma'> = {
  perfect: 'mint',
  good: 'electric',
  ok: 'ink',
  edge: 'coral',
  miss: 'coral',
};

function confidenceLabel(value: number): string {
  if (value >= 0.58) return 'High';
  if (value >= 0.5) return 'Balanced';
  return 'Steady';
}

function RecordTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night-850/70 px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function DistrictCard({
  district,
  selected,
  onSelect,
}: {
  district: District;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-3 text-left transition',
        selected
          ? 'border-mint/60 bg-white/[0.07] ring-1 ring-mint/40'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]',
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${district.primary}, ${district.secondary})` }}
      />
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink">{district.name}</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full" style={{ background: district.primary }} />
          <span className="h-2 w-2 rounded-full" style={{ background: district.secondary }} />
        </span>
      </span>
      <span className="mt-0.5 block text-[11px] leading-snug text-muted">{district.tagline}</span>
      <span className="mt-1.5 flex gap-3 text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>Power {confidenceLabel(district.power)}</span>
        <span>Control {confidenceLabel(district.control)}</span>
      </span>
    </button>
  );
}

export default function StreetCricketGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StreetCricketEngine | null>(null);
  const finishedRef = useRef(false);
  const phaseRef = useRef<Phase>('menu');
  const hudRef = useRef<CricketHud>(EMPTY_HUD);
  const activeFormatRef = useRef<MatchFormat>('super-over');
  const markerRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef<HTMLDivElement>(null);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<Phase>('menu');
  const [settings, setSettings] = useState<CricketSettings>(() => loadSettings());
  const [records, setRecords] = useState<CricketRecords>(EMPTY_RECORDS);
  const [hud, setHud] = useState<CricketHud>(EMPTY_HUD);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [isBest, setIsBest] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  phaseRef.current = phase;
  hudRef.current = hud;

  const contextLost = useWebGLContextLoss(canvasRef);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    setRecords(loadRecords());
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<CricketSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch, version: 1 as const };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleTiming = useCallback((frame: TimingFrame | null) => {
    const marker = markerRef.current;
    const zones = zonesRef.current;
    if (!marker || !zones) return;
    if (!frame) {
      marker.style.opacity = '0';
      return;
    }
    marker.style.opacity = '1';
    marker.style.left = `${Math.round(frame.position * 1000) / 10}%`;
    zones.style.setProperty('--z-perfect', `${(frame.perfect * 200).toFixed(2)}%`);
    zones.style.setProperty('--z-good', `${(frame.good * 200).toFixed(2)}%`);
    zones.style.setProperty('--z-ok', `${(frame.ok * 200).toFixed(2)}%`);
    zones.style.setProperty('--z-edge', `${(frame.edge * 200).toFixed(2)}%`);
  }, []);

  const handleHud = useCallback((next: CricketHud) => {
    setHud(next);
  }, []);

  const handleFinish = useCallback((matchResult: MatchResult) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const engine = engineRef.current;
    const totals = engine?.getPlayerTotals() ?? { sixes: 0, fours: 0 };
    const summary = recordMatch(loadRecords(), {
      format: activeFormatRef.current,
      runs: matchResult.playerRuns,
      outcome: matchResult.outcome,
      sixes: totals.sixes,
      fours: totals.fours,
    });
    saveRecords(summary.records);
    setRecords(summary.records);
    setIsBest(summary.isBest);
    setResult(matchResult);
    setPhase('finished');
    onCompleteRef.current?.({ score: matchResult.playerRuns, outcome: matchResult.outcome });
  }, []);

  const startMatch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.dispose();
    engineRef.current = null;
    finishedRef.current = false;
    setResult(null);
    setIsBest(false);
    setEngineError(null);
    activeFormatRef.current = settings.format;

    try {
      const engine = new StreetCricketEngine(
        canvas,
        {
          format: settings.format,
          districtId: settings.districtId,
          opponentId: opponentFor(settings.districtId),
          muted: settings.muted,
        },
        { onHud: handleHud, onFinish: handleFinish, onTiming: handleTiming },
      );
      engineRef.current = engine;
      setHud(engine.getHud());
      setPhase('playing');
      onStartRef.current?.();
    } catch {
      setEngineError('The 3D rooftop could not start. Try a browser or device with WebGL enabled.');
      setPhase('menu');
    }
  }, [handleFinish, handleHud, handleTiming, settings]);

  const backToSetup = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    handleTiming(null);
    setHud(EMPTY_HUD);
    setResult(null);
    setIsBest(false);
    setPhase('menu');
  }, [handleTiming]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      engineRef.current?.pause();
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      engineRef.current?.resume();
      setPhase('playing');
    }
  }, []);

  useVisibilityPause(togglePause, phase === 'playing');

  const toggleMute = useCallback(() => {
    const nextMuted = !settings.muted;
    updateSettings({ muted: nextMuted });
    const engine = engineRef.current;
    if (engine) engine.toggleMute();
  }, [settings.muted, updateSettings]);

  const swing = useCallback(() => {
    engineRef.current?.swing();
  }, []);

  const bowl = useCallback(() => {
    engineRef.current?.bowl();
  }, []);

  const setAim = useCallback((direction: ShotDirection) => {
    engineRef.current?.setAim(direction);
  }, []);

  const setShotType = useCallback((type: ShotType) => {
    engineRef.current?.setShotType(type);
  }, []);

  const setBowling = useCallback((patch: Partial<BowlingInput>) => {
    engineRef.current?.setBowling(patch);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      const engine = engineRef.current;
      const current = hudRef.current;
      const lineOrder: BowlingLine[] = ['off', 'middle', 'leg'];
      const lengthOrder: BowlingLength[] = ['short', 'good', 'full'];
      const variationOrder: BowlingVariation[] = ['stock', 'pace', 'spin'];

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (phaseRef.current !== 'playing') return;
          if (current.control === 'bat') engine?.swing();
          else engine?.bowl();
          return;
        case 'ArrowLeft':
        case 'KeyA':
          event.preventDefault();
          if (current.control === 'bat') engine?.cycleAim(-1);
          else if (engine) {
            const index = lineOrder.indexOf(current.bowling.line);
            engine.setBowling({ line: lineOrder[(index + lineOrder.length - 1) % lineOrder.length]! });
          }
          return;
        case 'ArrowRight':
        case 'KeyD':
          event.preventDefault();
          if (current.control === 'bat') engine?.cycleAim(1);
          else if (engine) {
            const index = lineOrder.indexOf(current.bowling.line);
            engine.setBowling({ line: lineOrder[(index + 1) % lineOrder.length]! });
          }
          return;
        case 'ArrowUp':
        case 'KeyW':
          event.preventDefault();
          if (current.control === 'bat') engine?.cycleShotType(1);
          else if (engine) {
            const index = lengthOrder.indexOf(current.bowling.length);
            engine.setBowling({ length: lengthOrder[(index + 1) % lengthOrder.length]! });
          }
          return;
        case 'ArrowDown':
        case 'KeyS':
          event.preventDefault();
          if (current.control === 'bat') engine?.cycleShotType(-1);
          else if (engine) {
            const index = lengthOrder.indexOf(current.bowling.length);
            engine.setBowling({ length: lengthOrder[(index + lengthOrder.length - 1) % lengthOrder.length]! });
          }
          return;
        case 'KeyQ':
        case 'KeyE':
          if (current.control !== 'bowl') return;
          event.preventDefault();
          if (engine) {
            const step = event.code === 'KeyE' ? 1 : -1;
            const index = variationOrder.indexOf(current.bowling.variation);
            engine.setBowling({ variation: variationOrder[(index + step + variationOrder.length) % variationOrder.length]! });
          }
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
  }, [toggleMute, togglePause]);

  const format = FORMAT_CONFIG[hud.format];
  const ballsRemaining = Math.max(0, format.balls - hud.balls);
  const overs = `${oversLabel(hud.balls)}/${Math.ceil(format.balls / 6)}`;
  const grade = hud.lastGrade;
  const isBatting = hud.control === 'bat';
  const status =
    phase === 'menu'
      ? 'Choose a format and district, then take the rooftop.'
      : phase === 'finished' && result
        ? `${result.headline}. ${result.detail}`
        : `${hud.battingTeam} ${hud.runs} for ${hud.wickets} after ${oversLabel(hud.balls)} overs. ${hud.message}`;

  return (
    <GameFrame
      title="Street Cricket"
      subtitle="Six balls. One rooftop. Timing over statistics."
      icon={CircleDot}
      accent="mint"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label={`${hud.battingTeam} score`} value={`${hud.runs}/${hud.wickets}`} tone="mint" />
          <GameStat label="Overs" value={overs} />
          <GameStat
            label={hud.target !== null ? 'Target' : 'Balls left'}
            value={hud.target !== null ? hud.target : ballsRemaining}
            tone={hud.target !== null ? 'plasma' : 'ink'}
          />
          <GameStat label="Last timing" value={grade ?? '—'} tone={grade ? GRADE_TONE[grade] : 'ink'} />
        </div>
      }
      toolbar={
        <>
          {phase === 'playing' || phase === 'paused' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={togglePause}
              aria-label={phase === 'paused' ? 'Resume match' : 'Pause match'}
              title={phase === 'paused' ? 'Resume match' : 'Pause match'}
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
            <GameButton size="icon" variant="ghost" onClick={backToSetup} aria-label="Back to setup" title="Back to setup">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Bat: ← → aim, ↑ ↓ shot type, Space swings. Bowl: ← → line, ↑ ↓ length, Q/E variation, Space bowls. P pauses, M mutes.
          </span>
          <span>All six districts and every player are invented. Records stay in this browser.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={phase === 'menu' || phase === 'paused' || phase === 'finished' ? true : undefined}>
          <div className="relative h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[450px]">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Floodlit rooftop cricket ground with a batter, bowler, fielders and boundary rope."
            />
            <WebGLContextNotice lost={contextLost} />

            {phase === 'playing' || phase === 'paused' ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
                  <span className="rounded-full border border-mint/30 bg-night-950/80 px-2.5 py-1 text-[11px] font-semibold text-mint">
                    {hud.battingTeam} {hud.runs}/{hud.wickets} · {oversLabel(hud.balls)} ov
                  </span>
                  <span className="rounded-full border border-white/10 bg-night-950/80 px-2.5 py-1 text-[11px] text-muted">
                    {isBatting ? 'You bat' : 'You bowl'}
                  </span>
                </div>

                {hud.deliveryLabel ? (
                  <div className="pointer-events-none absolute inset-x-0 top-11 flex justify-center">
                    <span className="rounded-full border border-white/10 bg-night-950/85 px-3 py-1 text-[11px] text-ink">
                      {hud.deliveryLabel}
                    </span>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
                  <span className="max-w-full truncate rounded-full border border-white/10 bg-night-950/85 px-3 py-1 text-[11px] text-ink">
                    {hud.message}
                  </span>
                </div>
              </>
            ) : null}

            {phase === 'paused' ? (
              <GameOverlay className="items-center justify-center text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">Match paused</p>
                <p className="max-w-sm text-sm text-muted">The rooftop waits. Resume when you are ready to face the next ball.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <GameButton variant="primary" onClick={togglePause}>
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Resume
                  </GameButton>
                  <GameButton variant="secondary" onClick={backToSetup}>
                    <Settings2 className="h-4 w-4" aria-hidden="true" />
                    Change setup
                  </GameButton>
                </div>
              </GameOverlay>
            ) : null}

            {phase === 'finished' && result ? (
              <GameOverlay
                tone={result.outcome === 'win' ? 'win' : result.outcome === 'loss' ? 'loss' : 'default'}
                className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
              >
                <div className="mx-auto w-full max-w-2xl space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                        {format.label} · full time
                      </p>
                      <h3 className="mt-1 font-display text-2xl font-semibold text-white">{result.headline}</h3>
                      <p className="mt-1 max-w-lg text-xs leading-5 text-muted">{result.detail}</p>
                    </div>
                    {isBest ? (
                      <span className="rounded-full border border-mint/40 bg-mint/10 px-3 py-1 text-[11px] font-semibold text-mint">
                        New best for this format
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <RecordTile label="Your runs" value={result.playerRuns} />
                    <RecordTile label="Wickets" value={result.playerWickets} />
                    <RecordTile label="Balls" value={result.playerBalls} />
                    <RecordTile
                      label={result.cpuRuns === null ? 'Result' : 'Runs conceded'}
                      value={result.cpuRuns === null ? 'Net' : result.cpuRuns}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <GameButton variant="primary" onClick={startMatch}>
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Play again
                    </GameButton>
                    <GameButton variant="secondary" onClick={backToSetup}>
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                      Change setup
                    </GameButton>
                  </div>
                </div>
              </GameOverlay>
            ) : null}
          </div>

          <div className="mt-3">
            <div
              ref={zonesRef}
              className="relative h-4 w-full overflow-hidden rounded-full border border-white/10 bg-night-950/90"
              style={{
                contentVisibility: 'auto',
              }}
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-coral/20"
                style={{ width: 'var(--z-edge, 56%)' }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-plasma-500/25"
                style={{ width: 'var(--z-ok, 34%)' }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-electric-400/30"
                style={{ width: 'var(--z-good, 18%)' }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full bg-mint/60"
                style={{ width: 'var(--z-perfect, 7%)' }}
              />
              <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/50" />
              <div
                ref={markerRef}
                aria-hidden="true"
                className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
                style={{ opacity: 0 }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted">
              <span>Early</span>
              <span>Perfect window</span>
              <span>Late</span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {isBatting ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <GameSegmented options={DIRECTION_OPTIONS} value={hud.aim} onChange={setAim} label="Shot direction" />
                  <GameSegmented options={SHOT_OPTIONS} value={hud.shotType} onChange={setShotType} label="Shot type" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GameButton
                    variant="primary"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={swing}
                    disabled={!hud.canSwing || phase !== 'playing'}
                    aria-label="Swing"
                  >
                    Swing
                  </GameButton>
                  <span className="text-[11px] text-muted">Time the swing as the marker crosses the perfect window.</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <GameSegmented
                    options={LINE_OPTIONS}
                    value={hud.bowling.line}
                    onChange={(line) => setBowling({ line })}
                    label="Bowling line"
                  />
                  <GameSegmented
                    options={LENGTH_OPTIONS}
                    value={hud.bowling.length}
                    onChange={(length) => setBowling({ length })}
                    label="Bowling length"
                  />
                  <GameSegmented
                    options={VARIATION_OPTIONS}
                    value={hud.bowling.variation}
                    onChange={(variation) => setBowling({ variation })}
                    label="Bowling variation"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <GameButton
                    variant="primary"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={bowl}
                    disabled={!hud.canBowl || phase !== 'playing'}
                    aria-label="Bowl delivery"
                  >
                    Bowl
                  </GameButton>
                  <span className="text-[11px] text-muted">Choose line, length and variation, then release.</span>
                </div>
              </>
            )}
          </div>

          {engineError ? (
            <p role="alert" className="mt-2 rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-xs text-coral">
              {engineError}
            </p>
          ) : null}
        </div>

        {phase === 'menu' ? (
          <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                    NeonRift Sports · Rooftop cricket
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Six balls. <span className="text-gradient">One rooftop.</span>
                  </h3>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-muted">
                    Read the delivery, pick a gap and time the swing. Defend a total in the Super Over, chase a
                    generated target on the rooftops, or find your rhythm in the nets. Every district is invented.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <RecordTile label="SO best" value={records.bestSuperOver} />
                  <RecordTile label="Chase best" value={records.bestChase} />
                  <RecordTile label="Nets best" value={records.bestNets} />
                  <RecordTile label="Wins" value={`${records.wins}/${records.games}`} />
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Format</p>
                  <GameSegmented
                    options={FORMAT_OPTIONS}
                    value={settings.format}
                    onChange={(value) => updateSettings({ format: value })}
                    label="Match format"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  {FORMAT_CONFIG[settings.format].balls} balls · {FORMAT_CONFIG[settings.format].wickets} wickets
                  {settings.format === 'rooftop-chase' ? ' · target generated at the toss' : ''}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Your district</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {DISTRICTS.map((district) => (
                    <DistrictCard
                      key={district.id}
                      district={district}
                      selected={settings.districtId === district.id}
                      onSelect={() => updateSettings({ districtId: district.id })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <GameButton variant="primary" onClick={startMatch}>
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  Take the rooftop
                </GameButton>
                <span className="text-[11px] text-muted">
                  Records are stored only in this browser. No accounts, no downloads.
                </span>
              </div>

              {engineError ? (
                <p role="alert" className="rounded-xl border border-coral/30 bg-coral/10 px-3 py-2 text-xs text-coral">
                  {engineError}
                </p>
              ) : null}

              <p className="text-[11px] leading-5 text-muted">
                Tip: the timing bar has four bands — perfect, good, ok and edge. Anything beyond is a miss, and a miss
                on line can bowl you. Loft clears the rope but risks a catch; drives find four more often on the ground.
              </p>

              {records.games > 0 ? (
                <p className="text-[11px] text-muted">
                  Across {records.games} match{records.games === 1 ? '' : 'es'} you have hit {records.sixes} six
                  {records.sixes === 1 ? '' : 'es'} and {records.fours} four{records.fours === 1 ? '' : 's'}.
                </p>
              ) : null}
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

export { DEFAULT_SETTINGS };
