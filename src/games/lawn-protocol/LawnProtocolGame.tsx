import {
  ArrowRight,
  FastForward,
  Layers,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Shovel,
  Sprout,
  Star,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { LawnAudio } from './audio';
import {
  COLS,
  LANES,
  LEVELS,
  MODULES,
  MODULE_ORDER,
  type LevelDef,
  type ModuleId,
} from './content';
import {
  cellIndex,
  collectLight,
  createGame,
  freeRecharge,
  plant,
  shovel,
  starsFor,
  stepGame,
  type LawnEvent,
  type LawnMode,
  type LawnState,
  type LawnStatus,
} from './simulation';
import {
  isLevelUnlocked,
  loadProgress,
  loadSettings,
  recordCampaign,
  recordEndless,
  saveProgress,
  saveSettings,
  type LawnProgress,
} from './persistence';
import { PLAYFIELD, drawScene } from './renderer';

type Phase = 'menu' | 'playing' | 'paused' | 'finished';

interface CellSnapshot {
  moduleId: ModuleId | null;
  token: boolean;
  healthRatio: number;
}

interface Snapshot {
  light: number;
  score: number;
  kills: number;
  wave: number;
  totalWaves: number;
  alive: number;
  purgesLeft: number;
  recharge: Record<ModuleId, number>;
  cells: CellSnapshot[];
  status: LawnStatus;
}

interface RunResult {
  won: boolean;
  endless: boolean;
  stars: number;
  score: number;
  kills: number;
  wave: number;
  improvedWave: boolean;
  improvedScore: boolean;
}

const STEP = 1 / 60;

const ENDLESS_TEMPLATE: LevelDef = {
  ...LEVELS[0],
  id: 'endless-defense',
  name: 'Endless Defense',
  blurb: 'The rust never stops. Hold one roof for as long as the light lasts.',
  startingLight: 225,
  skyInterval: 7,
  hpScale: 1,
  speedScale: 1,
};

const EMPTY_SNAPSHOT: Snapshot = {
  light: 0,
  score: 0,
  kills: 0,
  wave: 0,
  totalWaves: 0,
  alive: 0,
  purgesLeft: LANES,
  recharge: freeRecharge(),
  cells: Array.from({ length: LANES * COLS }, () => ({ moduleId: null, token: false, healthRatio: 0 })),
  status: 'running',
};

function snapshotOf(state: LawnState): Snapshot {
  const tokenCells = new Set(state.tokens.map((token) => cellIndex(token.lane, token.col)));
  return {
    light: state.light,
    score: state.score,
    kills: state.kills,
    wave: state.mode === 'endless' ? Math.max(1, state.endless?.wave ?? 1) : state.nextWaveIndex,
    totalWaves: state.waveStartTimes.length,
    alive: state.enemies.length,
    purgesLeft: state.purges.filter(Boolean).length,
    recharge: { ...state.recharge },
    cells: state.grid.map((module, index) => ({
      moduleId: module?.moduleId ?? null,
      token: tokenCells.has(index),
      healthRatio: module ? module.health / module.maxHealth : 0,
    })),
    status: state.status,
  };
}

function failureMessage(reason: string | undefined, moduleId: ModuleId | null): string {
  const name = moduleId ? MODULES[moduleId].name : 'That module';
  switch (reason) {
    case 'light':
      return `Not enough light for ${name}.`;
    case 'recharge':
      return `${name} is still recharging.`;
    case 'occupied':
      return 'That cell already holds a module.';
    case 'bounds':
      return 'That cell is off the roof.';
    case 'empty':
      return 'There is nothing to shovel there.';
    case 'missing':
      return 'That light already drifted away.';
    default:
      return 'The rooftop is not accepting orders right now.';
  }
}

function waveLabel(mode: LawnMode, snapshot: Snapshot): string {
  if (mode === 'endless') return String(snapshot.wave);
  return `${snapshot.wave}/${snapshot.totalWaves}`;
}

export default function LawnProtocolGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<LawnState | null>(null);
  const audioRef = useRef<LawnAudio | null>(null);
  const finishedRef = useRef(false);
  const speedRef = useRef(1);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<LawnMode>('campaign');
  const [levelIndex, setLevelIndex] = useState(0);
  const [selectedModule, setSelectedModule] = useState<ModuleId | null>(null);
  const [shovelMode, setShovelMode] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [settings, setSettings] = useState(() => loadSettings());
  const [progress, setProgress] = useState<LawnProgress>(() => loadProgress());
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [result, setResult] = useState<RunResult | null>(null);
  const [message, setMessage] = useState('Pick a roof, then deploy the line.');

  const muted = settings.muted;

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => () => audioRef.current?.dispose(), []);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const handleEvents = useCallback((events: LawnEvent[]) => {
    const audio = audioRef.current;
    for (const event of events) {
      switch (event.type) {
        case 'light':
          audio?.collect();
          setMessage(`Collected ${event.amount} light.`);
          break;
        case 'plant':
          audio?.plant();
          setMessage(`${MODULES[event.moduleId].name} planted in lane ${event.lane + 1}.`);
          break;
        case 'shovel':
          audio?.shovel();
          setMessage(`Shovelled ${MODULES[event.moduleId].name} for ${event.refund} light.`);
          break;
        case 'shot':
          audio?.shot();
          break;
        case 'enemy-down':
          break;
        case 'module-down':
          audio?.down();
          setMessage(`${MODULES[event.moduleId].name} was destroyed.`);
          break;
        case 'purge':
          audio?.purge();
          setMessage(`Lane ${event.lane + 1} purge triggered.`);
          break;
        case 'purge-reed':
          audio?.purge();
          setMessage(`Purge reed cleared lane ${event.lane + 1}.`);
          break;
        case 'wave':
          audio?.wave();
          setMessage(event.final ? 'Final wave incoming!' : `Wave ${event.wave} incoming.`);
          break;
        case 'win':
          audio?.win();
          break;
        case 'lose':
          audio?.lose();
          break;
        default:
          break;
      }
    }
  }, []);

  const finishGame = useCallback((state: LawnState) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const campaignWin = state.mode === 'campaign' && state.status === 'won';
    const stars = campaignWin ? starsFor(state) : 0;
    let nextProgress = loadProgress();
    let improvedWave = false;
    let improvedScore = false;

    if (campaignWin) {
      nextProgress = recordCampaign(nextProgress, state.levelId, stars).progress;
    } else if (state.mode === 'endless') {
      const outcome = recordEndless(nextProgress, state.endless?.wave ?? 1, state.score);
      nextProgress = outcome.progress;
      improvedWave = outcome.improvedWave;
      improvedScore = outcome.improvedScore;
    }

    saveProgress(nextProgress);
    setProgress(nextProgress);
    setSnapshot(snapshotOf(state));
    setResult({
      won: campaignWin,
      endless: state.mode === 'endless',
      stars,
      score: state.score,
      kills: state.kills,
      wave: state.mode === 'endless' ? Math.max(1, state.endless?.wave ?? 1) : Math.max(1, state.nextWaveIndex),
      improvedWave,
      improvedScore,
    });
    setPhase('finished');
    audioRef.current?.suspend();
    onCompleteRef.current?.({
      score: state.score,
      outcome: campaignWin ? 'win' : state.mode === 'endless' ? 'complete' : 'loss',
    });
  }, []);

  const startRun = useCallback(
    (nextMode: LawnMode, nextLevelIndex: number) => {
      const level = nextMode === 'endless' ? ENDLESS_TEMPLATE : LEVELS[nextLevelIndex] ?? LEVELS[0];
      const seed = (Date.now() ^ (nextLevelIndex * 7919) ^ (nextMode === 'endless' ? 104729 : 0)) >>> 0;
      const state = createGame({ level, seed, mode: nextMode });

      stateRef.current = state;
      finishedRef.current = false;
      setMode(nextMode);
      setLevelIndex(nextLevelIndex);
      setSelectedModule(null);
      setShovelMode(false);
      setSpeed(1);
      speedRef.current = 1;
      setResult(null);
      setSnapshot(snapshotOf(state));
      setPhase('playing');
      setMessage(
        nextMode === 'endless'
          ? 'Endless defense. Collect light and keep every lane covered.'
          : `${level.name}: ${level.blurb}`,
      );

      const audio = audioRef.current ?? new LawnAudio();
      audioRef.current = audio;
      audio.start();
      if (muted && !audio.isMuted) audio.toggleMute();
      if (!muted && audio.isMuted) audio.toggleMute();

      onStartRef.current?.();
    },
    [muted],
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof requestAnimationFrame !== 'function') return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssWidth = 0;
    let cssHeight = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssWidth = rect.width;
      cssHeight = rect.height;
      if (rect.width <= 0 || rect.height <= 0) return;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let snapshotAt = 0;

    const frame = (now: number) => {
      const state = stateRef.current;
      if (!state) return;

      let delta = (now - last) / 1000;
      last = now;
      if (!Number.isFinite(delta) || delta < 0) delta = 0;
      delta = Math.min(delta, 0.25);
      accumulator += delta * speedRef.current;

      let guard = 0;
      while (accumulator >= STEP && guard < 120 && state.status === 'running') {
        const events = stepGame(state, STEP);
        accumulator -= STEP;
        guard += 1;
        if (events.length > 0) handleEvents(events);
      }

      if (state.status !== 'running' && !finishedRef.current) finishGame(state);

      if (ctx && cssWidth > 0 && cssHeight > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawScene(ctx, state, cssWidth, cssHeight);
      }

      if (now - snapshotAt > 120) {
        snapshotAt = now;
        setSnapshot(snapshotOf(state));
      }

      if (state.status === 'running') raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [finishGame, handleEvents, phase]);

  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      setPhase('paused');
      audioRef.current?.suspend();
      if (stateRef.current) setSnapshot(snapshotOf(stateRef.current));
    } else if (phase === 'paused') {
      setPhase('playing');
      audioRef.current?.resume();
    }
  }, [phase]);

  useVisibilityPause(togglePause, phase === 'playing');

  const toggleMute = useCallback(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new LawnAudio();
      audioRef.current = audio;
      audio.start();
    }
    const next = audio.toggleMute();
    const updated = { ...settings, muted: next };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  const changeSpeed = useCallback(() => {
    setSpeed((current) => (current === 1 ? 2 : 1));
  }, []);

  const returnToMenu = useCallback(() => {
    setPhase('menu');
    setResult(null);
    setSelectedModule(null);
    setShovelMode(false);
    setSnapshot(EMPTY_SNAPSHOT);
    setMessage('Pick a roof, then deploy the line.');
    audioRef.current?.suspend();
  }, []);

  const refresh = useCallback(() => {
    const state = stateRef.current;
    if (state) setSnapshot(snapshotOf(state));
  }, []);

  const actOnCell = useCallback(
    (lane: number, col: number) => {
      const state = stateRef.current;
      if (!state || phase !== 'playing') return;

      const token = state.tokens.find((candidate) => candidate.lane === lane && candidate.col === col);
      if (token) {
        const result = collectLight(state, token.id);
        if (result.ok) handleEvents(result.events);
        refresh();
        return;
      }

      if (shovelMode) {
        const result = shovel(state, lane, col);
        if (result.ok) handleEvents(result.events);
        else setMessage(failureMessage(result.reason, null));
        refresh();
        return;
      }

      if (!selectedModule) {
        setMessage('Choose a seed card first, then tap a grid cell.');
        return;
      }

      const result = plant(state, selectedModule, lane, col);
      if (result.ok) handleEvents(result.events);
      else setMessage(failureMessage(result.reason, selectedModule));
      refresh();
    },
    [handleEvents, phase, refresh, selectedModule, shovelMode],
  );

  const selectModule = useCallback((moduleId: ModuleId) => {
    setSelectedModule(moduleId);
    setShovelMode(false);
    setMessage(`${MODULES[moduleId].name}: ${MODULES[moduleId].summary}`);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      const digit = event.code.startsWith('Digit') ? Number(event.code.slice(5)) : 0;
      if (digit >= 1 && digit <= MODULE_ORDER.length) {
        event.preventDefault();
        if (phase === 'playing') selectModule(MODULE_ORDER[digit - 1]);
        return;
      }
      if (event.code === 'KeyX') {
        event.preventDefault();
        setShovelMode((current) => !current);
      }
      if (event.code === 'KeyP' || event.code === 'Escape') {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'KeyM') {
        event.preventDefault();
        toggleMute();
      }
      if (event.code === 'KeyF') {
        event.preventDefault();
        changeSpeed();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeSpeed, phase, selectModule, toggleMute, togglePause]);

  const activeDef = selectedModule ? MODULES[selectedModule] : null;
  const selectedLevel = LEVELS[levelIndex] ?? LEVELS[0];
  const selectedStars = progress.stars[selectedLevel.id] ?? 0;

  return (
    <GameFrame
      title="Lawn Protocol"
      subtitle="Grow the grid. Hold the line."
      icon={Sprout}
      accent="mint"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label="Light" value={snapshot.light} tone="plasma" />
          <GameStat label="Wave" value={waveLabel(mode, snapshot)} />
          <GameStat label="Lane purges" value={snapshot.purgesLeft} tone={snapshot.purgesLeft <= 1 ? 'coral' : 'mint'} />
          <GameStat label="Score" value={snapshot.score.toLocaleString()} tone="electric" />
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
              aria-label={phase === 'paused' ? 'Resume defense' : 'Pause defense'}
              title={phase === 'paused' ? 'Resume defense' : 'Pause defense'}
            >
              {phase === 'paused' ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          {phase !== 'menu' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={changeSpeed}
              aria-label={speed === 1 ? 'Set speed to 2x' : 'Set speed to 1x'}
              title={speed === 1 ? 'Set speed to 2x' : 'Set speed to 1x'}
            >
              <FastForward className="h-4 w-4" aria-hidden="true" />
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
              onClick={returnToMenu}
              aria-label="Back to level select"
              title="Back to level select"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Pick a seed card (1–8), then tap a grid cell. X shovels, P pauses, F doubles speed, M mutes.</span>
          <span>Light tokens are collected by tapping their cell. Every lane has one emergency purge.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="min-h-4 text-[11px] text-muted">
        {message}
      </p>

      <div className="relative">
        <div className="relative h-[400px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[500px]">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            aria-hidden="true"
          />

          <div
            role="group"
            aria-label="Roof grid"
            inert={phase === 'playing' ? undefined : true}
            className="absolute z-10"
            style={{
              left: `${PLAYFIELD.left * 100}%`,
              top: `${PLAYFIELD.top * 100}%`,
              width: `${PLAYFIELD.width * 100}%`,
              height: `${PLAYFIELD.height * 100}%`,
            }}
          >
            <div className="grid h-full w-full grid-cols-9 grid-rows-5">
              {snapshot.cells.map((cell, index) => {
                const lane = Math.floor(index / COLS);
                const col = index % COLS;
                const label = `Lane ${lane + 1} column ${col + 1}, ${
                  cell.moduleId ? MODULES[cell.moduleId].name : 'empty'
                }${cell.token ? ', light ready' : ''}`;
                return (
                  <button
                    key={index}
                    type="button"
                    aria-label={label}
                    onClick={() => actOnCell(lane, col)}
                    className="h-full w-full rounded-sm border border-transparent bg-transparent transition hover:border-white/30 hover:bg-white/10 focus-visible:border-electric-400 focus-visible:bg-white/15 focus-visible:outline-none"
                  >
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {phase === 'menu' ? (
            <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
              <div className="mx-auto w-full max-w-2xl space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">NeonRift 2D · Lane defence</p>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                      Grow the grid. <span className="text-gradient">Hold the line.</span>
                    </h3>
                    <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                      Plant bio-modules across five lanes, collect drifting light and keep the district&apos;s solar core
                      online through twelve rust waves.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Roofs cleared</p>
                      <p className="font-display text-lg font-semibold text-mint">
                        {Object.keys(progress.stars).length}/{LEVELS.length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Endless best</p>
                      <p className="font-display text-lg font-semibold text-ink">Wave {progress.endlessBestWave}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Campaign roofs</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {LEVELS.map((level, index) => {
                      const unlocked = isLevelUnlocked(index, progress);
                      const stars = progress.stars[level.id] ?? 0;
                      const active = mode === 'campaign' && levelIndex === index;
                      return (
                        <button
                          key={level.id}
                          type="button"
                          aria-pressed={active}
                          aria-label={`Level ${index + 1}: ${level.name}${stars > 0 ? `, ${stars} star${stars === 1 ? '' : 's'}` : ''}`}
                          disabled={!unlocked}
                          onClick={() => {
                            setMode('campaign');
                            setLevelIndex(index);
                          }}
                          className={cn(
                            'relative rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                            active
                              ? 'border-mint/60 bg-mint/10'
                              : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">Level {index + 1}</span>
                            {unlocked ? <Stars count={stars} /> : <Lock className="h-3 w-3 text-muted" aria-hidden="true" />}
                          </span>
                          <span className="mt-0.5 block truncate text-xs font-semibold text-ink">{level.name}</span>
                          <span className="block text-[10px] text-muted">{level.theme} roof</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Endless defense"
                  aria-pressed={mode === 'endless'}
                  onClick={() => setMode('endless')}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition',
                    mode === 'endless' ? 'border-plasma-400/60 bg-plasma-500/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                  )}
                >
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Trophy className="h-4 w-4 text-plasma-300" aria-hidden="true" />
                      Endless defense
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      Escalating waves, browser-local best wave {progress.endlessBestWave} and score{' '}
                      {progress.endlessBestScore.toLocaleString()}.
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </button>

                {mode === 'campaign' ? (
                  <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                    <p className="text-sm font-semibold text-ink">
                      Level {levelIndex + 1}: {selectedLevel.name}
                      {selectedStars > 0 ? <span className="ml-2 text-[11px] text-mint">Best {selectedStars} star{selectedStars === 1 ? '' : 's'}</span> : null}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">{selectedLevel.blurb}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                      {selectedLevel.waves.length} waves · {selectedLevel.startingLight} starting light ·{' '}
                      {Math.round((selectedLevel.hpScale - 1) * 100)}% rust health bonus
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <GameButton variant="primary" onClick={() => startRun(mode, levelIndex)}>
                    <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                    {mode === 'endless' ? 'Start endless' : 'Deploy level'}
                  </GameButton>
                  <span className="text-[11px] text-muted">Progress and bests are stored only in this browser.</span>
                </div>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'paused' ? (
            <GameOverlay>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Defense paused</p>
              <h3 className="font-display text-xl font-semibold text-ink">The rust can wait</h3>
              <p className="max-w-xs text-xs leading-5 text-muted">
                Wave {waveLabel(mode, snapshot)} · {snapshot.alive} rust on the roof · {snapshot.purgesLeft} lane purges left
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <GameButton variant="primary" onClick={togglePause}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Resume
                </GameButton>
                <GameButton variant="secondary" onClick={returnToMenu}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Level select
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'finished' && result ? (
            <GameOverlay tone={result.won ? 'win' : 'loss'}>
              <span
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-2xl',
                  result.won ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral',
                )}
              >
                {result.won ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Sprout className="h-6 w-6" aria-hidden="true" />}
              </span>
              <h3 className="font-display text-xl font-semibold text-ink">
                {result.endless
                  ? result.improvedWave || result.improvedScore
                    ? 'New endless best'
                    : 'The rust broke through'
                  : result.won
                    ? 'Roof held'
                    : 'The core is overrun'}
              </h3>
              {result.won ? <Stars count={result.stars} large /> : null}
              <p className="text-sm text-muted">
                <b className="text-ink">{result.score.toLocaleString()}</b> points · {result.kills} rust defeated · wave{' '}
                {result.wave}
              </p>
              <p className="text-[11px] text-muted">
                {result.endless
                  ? `Browser-local best: wave ${progress.endlessBestWave}, ${progress.endlessBestScore.toLocaleString()} points.`
                  : `Best on this roof: ${progress.stars[selectedLevel.id] ?? 0} star${(progress.stars[selectedLevel.id] ?? 0) === 1 ? '' : 's'}.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <GameButton variant="primary" onClick={() => startRun(result.endless ? 'endless' : 'campaign', levelIndex)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  {result.endless ? 'Defend again' : 'Retry mission'}
                </GameButton>
                {!result.endless && result.won && levelIndex + 1 < LEVELS.length ? (
                  <GameButton variant="secondary" onClick={() => startRun('campaign', levelIndex + 1)}>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Next roof
                  </GameButton>
                ) : null}
                <GameButton variant="secondary" onClick={returnToMenu}>
                  <Layers className="h-4 w-4" aria-hidden="true" />
                  Level select
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}
        </div>
      </div>

      {phase !== 'menu' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {MODULE_ORDER.map((moduleId, index) => {
              const def = MODULES[moduleId];
              const recharge = snapshot.recharge[moduleId] ?? 0;
              const active = selectedModule === moduleId;
              const affordable = snapshot.light >= def.cost;
              return (
                <button
                  key={moduleId}
                  type="button"
                  aria-label={`Select ${def.name}, ${def.cost} light`}
                  aria-pressed={active}
                  title={`${def.name}: ${def.summary}`}
                  onClick={() => selectModule(moduleId)}
                  className={cn(
                    'relative overflow-hidden rounded-xl border px-2 py-1.5 text-left transition',
                    active ? 'border-mint/60 bg-mint/10' : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                  )}
                >
                  <span className="block truncate text-[11px] font-semibold text-ink">{def.name}</span>
                  <span className={cn('block text-[10px]', affordable ? 'text-muted' : 'text-coral')}>
                    {def.cost} light · {index + 1}
                  </span>
                  {recharge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1 bg-electric-400/70"
                      style={{ width: `${Math.min(100, (recharge / def.recharge) * 100)}%` }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-5 text-muted">
              {shovelMode
                ? 'Shovel mode: tap a planted module to recover half its light.'
                : activeDef
                  ? `${activeDef.name}: ${activeDef.summary}`
                  : 'Select a seed card, then tap a grid cell. Tap light tokens to collect them.'}
            </p>
            <GameButton
              size="sm"
              variant={shovelMode ? 'primary' : 'secondary'}
              aria-label="Shovel mode"
              aria-pressed={shovelMode}
              onClick={() => {
                setShovelMode((current) => !current);
                setSelectedModule(null);
              }}
            >
              <Shovel className="h-3.5 w-3.5" aria-hidden="true" />
              Shovel
            </GameButton>
          </div>
        </div>
      ) : null}
    </GameFrame>
  );
}

function Stars({ count, large = false }: { count: number; large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            large ? 'h-5 w-5' : 'h-3 w-3',
            index < count ? 'fill-mint text-mint' : 'text-white/20',
          )}
        />
      ))}
    </span>
  );
}
