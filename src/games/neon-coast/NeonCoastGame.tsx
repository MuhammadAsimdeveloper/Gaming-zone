import {
  ArrowRight,
  Car,
  ListChecks,
  Lock,
  MapPin,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useReducedMotion } from '../shared/motion';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { TouchControls } from './controls';
import {
  NeonCoastEngine,
  type NeonCoastHud,
  type NeonCoastHudMission,
} from './engine';
import {
  MISSIONS,
  definitionFor,
  rankFor,
  type MissionId,
} from './missions';
import {
  applyEvent,
  defaultSave,
  loadSave,
  saveProgress,
  type NeonCoastSave,
  type ProgressEvent,
} from './persistence';
import type { MoveInput } from './player';
import type { WorldEvent } from './simulation';
import type { DriveInput } from './vehicle';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

type Phase = 'menu' | 'playing' | 'paused' | 'results';

interface RunResult {
  id: MissionId;
  name: string;
  completed: boolean;
  reward: number;
  elapsed: number;
  shards: number;
  bestTime: number | null;
  newBest: boolean;
  rank: string;
}

const NEUTRAL_MOVE: MoveInput = { up: false, down: false, left: false, right: false, sprint: false };
const NEUTRAL_DRIVE: DriveInput = { forward: false, back: false, left: false, right: false, handbrake: false };

function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function objectiveFor(mission: NeonCoastHudMission | null): string {
  if (!mission) return 'Choose a mission';
  switch (mission.id) {
    case 'tideglass-courier':
      return mission.pickedUp
        ? 'Deliver the tideglass to Coral Radio Tower'
        : 'Collect the tideglass at Tideglass Market';
    case 'lantern-circuit':
      return `Drive through gate ${Math.min(mission.gateIndex + 1, mission.gateCount)} of ${mission.gateCount}`;
    case 'landmark-trail':
      return `Discover ${mission.discovered}/5 Solara landmarks`;
    case 'glow-run':
      return `Collect ${mission.shards}/${mission.shardCount} glow shards`;
  }
}

function isMissionUnlocked(index: number, save: NeonCoastSave): boolean {
  if (index === 0) return true;
  const previous = MISSIONS[index - 1];
  return previous ? save.completed.includes(previous.id) : false;
}

function Minimap({ hud }: { hud: NeonCoastHud }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const width = 132;
    const height = 110;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const scale = Math.min((width - 16) / WORLD_WIDTH, (height - 16) / WORLD_HEIGHT);
    const offsetX = (width - WORLD_WIDTH * scale) / 2;
    const offsetY = (height - WORLD_HEIGHT * scale) / 2;
    const mapX = (x: number) => offsetX + x * scale;
    const mapY = (y: number) => offsetY + y * scale;

    ctx.fillStyle = 'rgba(12, 18, 34, 0.9)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeRect(offsetX, offsetY, WORLD_WIDTH * scale, WORLD_HEIGHT * scale);

    ctx.fillStyle = 'rgba(157, 183, 214, 0.55)';
    for (const car of hud.traffic) {
      ctx.fillRect(mapX(car.x) - 1, mapY(car.y) - 1, 2, 2);
    }

    if (hud.target) {
      ctx.strokeStyle = '#ffb35c';
      ctx.beginPath();
      ctx.arc(mapX(hud.target.x), mapY(hud.target.y), 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (hud.inVehicle) {
      ctx.fillStyle = '#7ef0c1';
      ctx.fillRect(mapX(hud.vehicle.x) - 3, mapY(hud.vehicle.y) - 3, 6, 6);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mapX(hud.position.x), mapY(hud.position.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [hud]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute right-2 top-2 z-10 h-[110px] w-[132px] rounded-xl border border-white/10 bg-night-950/80"
    />
  );
}

function Tutorial({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="absolute left-2 top-2 z-10 max-w-[260px] rounded-2xl border border-mint/30 bg-night-950/90 p-3 text-left shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">First lap</p>
      <ol className="mt-1 list-decimal space-y-1 pl-4 text-[11px] leading-4 text-ink">
        <li>Walk with WASD or the arrow keys.</li>
        <li>Press E beside the Vela to drive.</li>
        <li>Follow the mint marker and beat the clock.</li>
      </ol>
      <GameButton size="sm" variant="primary" className="mt-2" aria-label="Got it" onClick={onDismiss}>
        Got it
      </GameButton>
    </div>
  );
}

export default function NeonCoastGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NeonCoastEngine | null>(null);
  const saveRef = useRef<NeonCoastSave>(defaultSave());
  const hudRef = useRef<NeonCoastHud | null>(null);
  const missionRef = useRef<MissionId | null>(null);
  const moveRef = useRef<MoveInput>({ ...NEUTRAL_MOVE });
  const driveRef = useRef<DriveInput>({ ...NEUTRAL_DRIVE });
  const finishTimerRef = useRef<number>(0);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [save, setSave] = useState<NeonCoastSave>(() => loadSave());
  const [phase, setPhase] = useState<Phase>('menu');
  const [hud, setHud] = useState<NeonCoastHud | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [notice, setNotice] = useState('Pick a mission and follow the mint marker.');
  const [logOpen, setLogOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    function handleFullscreen() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = 0;
    }
  }, []);

  const commitEvent = useCallback((event: ProgressEvent): NeonCoastSave => {
    const next = applyEvent(saveRef.current, event);
    saveRef.current = next;
    saveProgress(next);
    setSave(next);
    engineRef.current?.setProgress(next);
    return next;
  }, []);

  const handleHud = useCallback((next: NeonCoastHud) => {
    hudRef.current = next;
    setHud(next);
  }, []);

  const handleEvent = useCallback(
    (event: WorldEvent) => {
      switch (event.type) {
        case 'mission-complete':
        case 'mission-failed': {
          const previousBest = saveRef.current.bestTimes[event.id] ?? null;
          const next = commitEvent(event);
          const completed = event.type === 'mission-complete';
          setResult({
            id: event.id,
            name: definitionFor(event.id).name,
            completed,
            reward: event.reward,
            elapsed: event.elapsed,
            shards: event.shards,
            bestTime: next.bestTimes[event.id] ?? null,
            newBest: completed && (previousBest === null || event.elapsed < previousBest),
            rank: rankFor(next.completed),
          });
          setNotice(completed ? 'Mission complete — reward banked.' : 'The clock ran out. Retry to keep the reward.');
          setLogOpen(false);
          setPhase('results');
          clearFinishTimer();
          const finishedEngine = engineRef.current;
          finishTimerRef.current = window.setTimeout(() => finishedEngine?.pause(), 400);
          onCompleteRef.current?.({ score: event.reward, outcome: completed ? 'complete' : 'loss' });
          break;
        }
        case 'discover':
          commitEvent(event);
          setNotice('Landmark discovered.');
          break;
        case 'mission-accepted':
          setNotice(`${event.name} active — follow the mint marker.`);
          break;
        case 'checkpoint':
          setNotice('Checkpoint cleared.');
          break;
        case 'shard':
          setNotice(`Glow shard ${event.index + 1} collected.`);
          break;
        case 'enter-car':
          setNotice('Vela engaged. W accelerates, S brakes, A/D steer, Space drifts.');
          break;
        case 'exit-car':
          setNotice('Back on foot.');
          break;
      }
    },
    [clearFinishTimer, commitEvent],
  );

  const disposeEngine = useCallback(() => {
    clearFinishTimer();
    engineRef.current?.dispose();
    engineRef.current = null;
  }, [clearFinishTimer]);

  const resetInputs = useCallback(() => {
    moveRef.current = { ...NEUTRAL_MOVE };
    driveRef.current = { ...NEUTRAL_DRIVE };
    engineRef.current?.setInput({ move: moveRef.current, drive: driveRef.current });
  }, []);

  const startMission = useCallback(
    (id: MissionId) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      disposeEngine();
      const engine = new NeonCoastEngine(
        canvas,
        (Date.now() ^ (id.length * 7919)) >>> 0,
        { onHud: handleHud, onEvent: handleEvent },
        { reducedMotion },
      );
      engineRef.current = engine;
      missionRef.current = id;
      moveRef.current = { ...NEUTRAL_MOVE };
      driveRef.current = { ...NEUTRAL_DRIVE };
      engine.setProgress(saveRef.current);
      if (!saveRef.current.soundOn) engine.toggleMute();
      setResult(null);
      setLogOpen(false);
      setHud(null);
      setNotice(`${definitionFor(id).name} active — follow the mint marker.`);
      setPhase('playing');
      engine.setInput({ acceptMission: id });
      engine.start();
      onStartRef.current?.();
    },
    [disposeEngine, handleEvent, handleHud, reducedMotion],
  );

  const pauseGame = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    resetInputs();
    setPhase('paused');
  }, [resetInputs]);

  const resumeGame = useCallback(() => {
    engineRef.current?.resume();
    setPhase('playing');
  }, []);

  const leaveToMenu = useCallback(() => {
    disposeEngine();
    missionRef.current = null;
    setPhase('menu');
    setHud(null);
    setResult(null);
    setLogOpen(false);
    setNotice('Pick a mission and follow the mint marker.');
  }, [disposeEngine]);

  const restartMission = useCallback(() => {
    const id = missionRef.current;
    if (id) startMission(id);
  }, [startMission]);

  const toggleMute = useCallback(() => {
    const next = !saveRef.current.soundOn;
    commitEvent({ type: 'sound', on: next });
    engineRef.current?.toggleMute();
  }, [commitEvent]);

  const dismissTutorial = useCallback(() => {
    commitEvent({ type: 'tutorial-seen' });
  }, [commitEvent]);

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void frame.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  useVisibilityPause(pauseGame, phase === 'playing');

  useEffect(() => () => disposeEngine(), [disposeEngine]);

  const applyDirection = useCallback(
    (moveKey: 'up' | 'down' | 'left' | 'right', driveKey: 'forward' | 'back' | 'left' | 'right', pressed: boolean) => {
      moveRef.current = { ...moveRef.current, [moveKey]: pressed };
      driveRef.current = { ...driveRef.current, [driveKey]: pressed };
      engineRef.current?.setInput({ move: moveRef.current, drive: driveRef.current });
    },
    [],
  );

  const applySprint = useCallback((pressed: boolean) => {
    moveRef.current = { ...moveRef.current, sprint: pressed };
    driveRef.current = { ...driveRef.current, handbrake: pressed };
    engineRef.current?.setInput({ move: moveRef.current, drive: driveRef.current });
  }, []);

  const applyDrive = useCallback((key: keyof DriveInput, pressed: boolean) => {
    driveRef.current = { ...driveRef.current, [key]: pressed };
    engineRef.current?.setInput({ drive: driveRef.current });
  }, []);

  const interact = useCallback(() => {
    engineRef.current?.setInput({ interact: true });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (logOpen) setLogOpen(false);
        else if (phase === 'playing') pauseGame();
        else if (phase === 'paused') resumeGame();
        return;
      }
      if (phase !== 'playing') return;
      if (isInteractiveTarget(event.target)) return;
      if (event.code === 'KeyM') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if (event.code === 'KeyE') {
        event.preventDefault();
        interact();
        return;
      }
      const direction =
        event.code === 'KeyW' || event.code === 'ArrowUp'
          ? (['up', 'forward'] as const)
          : event.code === 'KeyS' || event.code === 'ArrowDown'
            ? (['down', 'back'] as const)
            : event.code === 'KeyA' || event.code === 'ArrowLeft'
              ? (['left', 'left'] as const)
              : event.code === 'KeyD' || event.code === 'ArrowRight'
                ? (['right', 'right'] as const)
                : null;
      if (direction) {
        event.preventDefault();
        applyDirection(direction[0], direction[1], true);
        return;
      }
      if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault();
        applySprint(true);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (phase !== 'playing') return;
      const direction =
        event.code === 'KeyW' || event.code === 'ArrowUp'
          ? (['up', 'forward'] as const)
          : event.code === 'KeyS' || event.code === 'ArrowDown'
            ? (['down', 'back'] as const)
            : event.code === 'KeyA' || event.code === 'ArrowLeft'
              ? (['left', 'left'] as const)
              : event.code === 'KeyD' || event.code === 'ArrowRight'
                ? (['right', 'right'] as const)
                : null;
      if (direction) applyDirection(direction[0], direction[1], false);
      else if (event.code === 'Space' || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        applySprint(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [applyDirection, applySprint, interact, logOpen, pauseGame, phase, resumeGame, toggleMute]);

  const mission = hud?.mission ?? null;
  const activeDefinition = mission ? definitionFor(mission.id) : null;
  const objective = objectiveFor(mission);
  const rank = hud?.rank ?? rankFor(save.completed);
  const nextUnlock = result?.completed ? definitionFor(result.id).unlocks : null;

  return (
    <div
      ref={frameRef}
      className="overscroll-contain touch-none select-none"
      onKeyDown={(event) => {
        if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
      }}
    >
      <GameFrame
        title="Neon Coast: After Hours"
        subtitle="Solara Bay · Vela District"
        icon={Car}
        accent="plasma"
        hud={
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <GameStat label="Cash" value={`$${save.cash.toLocaleString()}`} tone="mint" />
            <GameStat label="Rank" value={rank} tone="plasma" />
            <GameStat
              label="Objective"
              value={
                hud && mission
                  ? `${objective} · ${Math.round(hud.distanceToTarget)} m`
                  : objective
              }
              className="col-span-2 sm:col-span-2"
            />
            <GameStat label="Timer" value={mission ? formatTime(mission.timeLeft) : '—'} tone={mission && mission.timeLeft < 20 ? 'coral' : 'ink'} />
            <GameStat label="Speed" value={hud?.inVehicle ? `${hud.speedKph} km/h` : hud ? 'On foot' : '—'} tone="electric" />
          </div>
        }
        toolbar={
          <>
            {phase !== 'menu' ? (
              <GameButton
                size="icon"
                variant="ghost"
                onClick={phase === 'paused' ? resumeGame : pauseGame}
                disabled={phase === 'results'}
                aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
                title={phase === 'paused' ? 'Resume game' : 'Pause game'}
              >
                {phase === 'paused' ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
              </GameButton>
            ) : null}
            {phase === 'playing' || phase === 'paused' ? (
              <GameButton
                size="icon"
                variant="ghost"
                onClick={() => setLogOpen(true)}
                aria-label="Mission log"
                title="Mission log"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" />
              </GameButton>
            ) : null}
            <GameButton
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              aria-label={save.soundOn ? 'Mute audio' : 'Unmute audio'}
              aria-pressed={!save.soundOn}
              title={save.soundOn ? 'Mute audio' : 'Unmute audio'}
            >
              {save.soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
            <GameButton
              size="icon"
              variant="ghost"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <Maximize className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          </>
        }
        footer={
          <>
            Desktop: WASD or arrows, E to drive, Space drift, Esc pause, M mute. Touch: drag the pad, hold the
            pedals. Cash, ranks and best times are browser-local and never leave this device.
          </>
        }
      >
        <p role="status" aria-live="polite" className="min-h-4 text-[11px] text-muted">
          {notice}
        </p>

        <div className="relative h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[480px] lg:h-[540px]">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Solara Bay playfield"
            className="absolute inset-0 h-full w-full touch-none"
          />

          {hud && phase !== 'menu' ? <Minimap hud={hud} /> : null}

          {phase === 'playing' && !save.tutorialSeen ? <Tutorial onDismiss={dismissTutorial} /> : null}

          {phase === 'playing' && hud ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
              <p className="rounded-full border border-white/15 bg-night-950/85 px-4 py-1.5 text-[11px] font-medium text-ink shadow-lg">
                {hud.canEnterCar
                  ? 'E — drive the Vela'
                  : hud.inVehicle
                    ? 'E — step out'
                    : `${objective} · ${Math.round(hud.distanceToTarget)} m`}
              </p>
            </div>
          ) : null}

          {phase === 'menu' ? (
            <GameOverlay label="Mission select" className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
              <div className="mx-auto w-full max-w-2xl space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-plasma-300">
                      NeonRift 2D · Solara Bay
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                      After hours. <span className="text-gradient">Your coast.</span>
                    </h3>
                    <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                      <b className="text-ink">15-second briefing:</b> pick one mission, follow the mint marker, and beat
                      the clock. Walk with WASD, press E beside the Vela to drive, and finish before the timer runs out.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Missions cleared</p>
                      <p className="font-display text-lg font-semibold text-plasma-300">{save.completed.length}/4</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Glow best</p>
                      <p className="font-display text-lg font-semibold text-mint">{save.bestGlowScore}/8</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MISSIONS.map((missionDefinition, index) => {
                    const unlocked = isMissionUnlocked(index, save);
                    const best = save.bestTimes[missionDefinition.id] ?? null;
                    const cleared = save.completed.includes(missionDefinition.id);
                    return (
                      <button
                        key={missionDefinition.id}
                        type="button"
                        aria-label={`Start ${missionDefinition.name}`}
                        disabled={!unlocked}
                        onClick={() => startMission(missionDefinition.id)}
                        className={cn(
                          'group relative rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                          cleared
                            ? 'border-mint/40 bg-mint/5'
                            : unlocked
                              ? 'border-white/10 bg-white/[0.03] hover:border-plasma-400/50 hover:bg-white/[0.06]'
                              : 'border-white/10 bg-white/[0.02]',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
                            {missionDefinition.kind} · {missionDefinition.timeLimit}s
                          </span>
                          {unlocked ? (
                            <span className="flex items-center gap-1 text-[10px] text-plasma-300">
                              {cleared ? <Trophy className="h-3 w-3" aria-hidden="true" /> : null}
                              ${missionDefinition.reward}
                            </span>
                          ) : (
                            <Lock className="h-3 w-3 text-muted" aria-hidden="true" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-ink">{missionDefinition.name}</span>
                        <span className="mt-0.5 block text-[11px] leading-4 text-muted">{missionDefinition.brief}</span>
                        <span className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                          {unlocked ? (
                            <>
                              <MapPin className="h-3 w-3" aria-hidden="true" />
                              {missionDefinition.repeatable
                                ? `Best ${save.bestGlowScore}/8 shards`
                                : best !== null
                                  ? `Best ${formatTime(best)}`
                                  : 'No record yet'}
                            </>
                          ) : (
                            <>Complete {MISSIONS[index - 1]?.name} to unlock</>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted">
                    Cash, ranks and best times are browser-local — this slice has no cloud saves or leaderboards.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-plasma-300">
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    Start with Tideglass Courier
                  </span>
                </div>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'paused' ? (
            <GameOverlay label="Coast paused">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Coast paused</p>
              <h3 className="font-display text-xl font-semibold text-ink">{mission?.name ?? 'Free roam'}</h3>
              <p className="max-w-xs text-xs leading-5 text-muted">
                {objective}
                {hud && mission ? ` · ${Math.round(hud.distanceToTarget)} m · ${formatTime(mission.timeLeft)} left` : ''}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <GameButton variant="primary" onClick={resumeGame}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Resume drive
                </GameButton>
                <GameButton variant="secondary" aria-label="Restart mission" onClick={restartMission}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restart mission
                </GameButton>
                <GameButton variant="secondary" aria-label="Mission select" onClick={leaveToMenu}>
                  Mission select
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {phase === 'results' && result ? (
            <GameOverlay tone={result.completed ? 'win' : 'loss'} label="Mission results">
              <span
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-2xl',
                  result.completed ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral',
                )}
              >
                {result.completed ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <MapPin className="h-6 w-6" aria-hidden="true" />}
              </span>
              <h3 className="font-display text-xl font-semibold text-ink">
                {result.name} {result.completed ? 'complete' : 'out of time'}
              </h3>
              <p className="text-sm text-muted">
                <b className="text-mint">+{result.reward}</b> cash · time {formatTime(result.elapsed)}
                {result.id === 'glow-run' ? ` · ${result.shards} shards` : ''}
              </p>
              <p className="text-[11px] text-muted">
                Best {formatTime(result.bestTime)}
                {result.newBest ? ' — new personal best!' : ''} · Rank {result.rank}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <GameButton variant="primary" onClick={() => startMission(result.id)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Retry {result.name}
                </GameButton>
                {result.completed && nextUnlock ? (
                  <GameButton variant="secondary" onClick={() => startMission(nextUnlock)}>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    Next: {definitionFor(nextUnlock).name}
                  </GameButton>
                ) : null}
                <GameButton variant="secondary" aria-label="Mission select" onClick={leaveToMenu}>
                  Mission select
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {logOpen ? (
            <GameOverlay label="Mission log" className="items-stretch justify-start overflow-y-auto text-left">
              <div className="mx-auto w-full max-w-md space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-ink">Mission log</h3>
                  <GameButton size="sm" variant="secondary" aria-label="Close mission log" onClick={() => setLogOpen(false)}>
                    Close
                  </GameButton>
                </div>
                {MISSIONS.map((missionDefinition) => {
                  const cleared = save.completed.includes(missionDefinition.id);
                  const best = save.bestTimes[missionDefinition.id] ?? null;
                  return (
                    <div key={missionDefinition.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <p className="flex items-center justify-between gap-2 text-xs font-semibold text-ink">
                        {missionDefinition.name}
                        <span className={cleared ? 'text-mint' : 'text-muted'}>{cleared ? 'Cleared' : 'Open'}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted">{missionDefinition.brief}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">
                        {missionDefinition.timeLimit}s · ${missionDefinition.reward} · Best {formatTime(best)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </GameOverlay>
          ) : null}
        </div>

        {phase === 'playing' && hud ? (
          <TouchControls
            inVehicle={hud.inVehicle}
            canEnterCar={hud.canEnterCar}
            onMove={(key, pressed) => applyDirection(key, key === 'up' ? 'forward' : key === 'down' ? 'back' : key, pressed)}
            onSprint={applySprint}
            onDrive={applyDrive}
            onInteract={interact}
          />
        ) : null}

        {activeDefinition && mission ? (
          <p className="text-[11px] leading-5 text-muted">
            <b className="text-ink">{activeDefinition.name}:</b> {activeDefinition.brief}
          </p>
        ) : null}
      </GameFrame>
    </div>
  );
}
