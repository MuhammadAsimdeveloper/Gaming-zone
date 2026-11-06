import {
  Crosshair,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Target,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { GameComponentProps } from '../../../types/game';
import { cn } from '../../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameSegmented, GameStat, type SegmentOption } from '../../shared/GameFrame';
import { isInteractiveTarget } from '../../shared/keyboard';
import { useVisibilityPause } from '../../shared/useVisibilityPause';
import { SportsAudio } from '../shared/audio';
import {
  REGULATION_KICKS,
  ZONE_LABELS,
  createShootout,
  dive,
  isSuddenDeath,
  roundLabel,
  savedCount,
  scoreValue,
  shoot,
  stepShootout,
  type Difficulty,
  type ShootoutEvent,
  type ShootoutPhase,
  type ShootoutState,
  type Shooter,
  type Zone,
} from './simulation';
import { drawPenaltyScene, zoneFromCanvas } from './renderer';
import {
  EMPTY_RECORDS,
  loadRecords,
  loadSettings,
  recordShootout,
  saveRecords,
  saveSettings,
  type PenaltyRecords,
  type PenaltySettings,
} from './persistence';

type Phase = 'menu' | 'playing' | 'paused' | 'finished';
type AimMode = 'shoot' | 'dive';

interface HistoryEntry {
  shooter: Shooter;
  result: 'goal' | 'save' | 'wide';
}

interface Snapshot {
  phase: ShootoutPhase;
  scorePlayer: number;
  scoreAi: number;
  kicksPlayer: number;
  kicksAi: number;
  round: string;
  message: string;
  saves: number;
  history: HistoryEntry[];
}

interface ShootoutResult {
  winner: 'player' | 'ai';
  score: number;
  saves: number;
  scorePlayer: number;
  scoreAi: number;
  suddenDeath: boolean;
}

const EMPTY_SNAPSHOT: Snapshot = {
  phase: 'player-aim',
  scorePlayer: 0,
  scoreAi: 0,
  kicksPlayer: 0,
  kicksAi: 0,
  round: `Kick 1 of ${REGULATION_KICKS}`,
  message: 'Pick your corner.',
  saves: 0,
  history: [],
};

const DIFFICULTY_OPTIONS: ReadonlyArray<SegmentOption<Difficulty>> = [
  { value: 'casual', label: 'Casual' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
];

const ZONE_SHORT = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR'] as const;
const ZONE_KEYS = ['Q', 'W', 'E', 'A', 'S', 'D'] as const;
const KEY_ZONES: Record<string, Zone | undefined> = {
  KeyQ: 0,
  KeyW: 1,
  KeyE: 2,
  KeyA: 3,
  KeyS: 4,
  KeyD: 5,
};

function displayMessage(state: ShootoutState): string {
  if (state.phase === 'player-flight') return 'Shot away…';
  if (state.phase === 'ai-flight') return 'CPU steps up…';
  return state.message;
}

function snapshotOf(state: ShootoutState): Snapshot {
  return {
    phase: state.phase,
    scorePlayer: state.scorePlayer,
    scoreAi: state.scoreAi,
    kicksPlayer: state.kicksPlayer,
    kicksAi: state.kicksAi,
    round: roundLabel(state),
    message: displayMessage(state),
    saves: savedCount(state),
    history: state.history.map((attempt) => ({
      shooter: attempt.shooter,
      result: attempt.offTarget ? 'wide' : attempt.saved ? 'save' : 'goal',
    })),
  };
}

function aimModeOf(phase: ShootoutPhase): AimMode | null {
  if (phase === 'player-aim') return 'shoot';
  if (phase === 'ai-aim') return 'dive';
  return null;
}

function zoneFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): Zone | null {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return zoneFromCanvas(x, y, canvas.width, canvas.height);
}

export default function PenaltyProtocolGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<ShootoutState | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const hoverRef = useRef<Zone | null>(null);
  const audioRef = useRef<SportsAudio | null>(null);
  const finishedRef = useRef(false);
  const lastPhaseRef = useRef<ShootoutPhase>('player-aim');
  const phaseRef = useRef<Phase>('menu');
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<Phase>('menu');
  const [settings, setSettings] = useState<PenaltySettings>(() => loadSettings());
  const [records, setRecords] = useState<PenaltyRecords>(EMPTY_RECORDS);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [hoverZone, setHoverZone] = useState<Zone | null>(null);
  const [result, setResult] = useState<ShootoutResult | null>(null);
  const [isBest, setIsBest] = useState(false);

  if (stateRef.current === null) {
    stateRef.current = createShootout(settings.difficulty);
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
    const aiming = state.phase === 'player-aim' || state.phase === 'ai-aim';
    drawPenaltyScene(context, width, height, state, aiming ? hoverRef.current : null);
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

  const setHover = useCallback((zone: Zone | null) => {
    if (hoverRef.current === zone) return;
    hoverRef.current = zone;
    setHoverZone(zone);
  }, []);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    const state = stateRef.current;
    if (!state || !state.winner) return;
    finishedRef.current = true;
    const outcome = state.winner === 'player' ? 'win' : 'loss';
    const score = scoreValue(state);
    const saves = savedCount(state);
    const summary = recordShootout(loadRecords(), { outcome, score, saves });
    saveRecords(summary.records);
    setRecords(summary.records);
    setIsBest(summary.isBest);
    setResult({
      winner: state.winner,
      score,
      saves,
      scorePlayer: state.scorePlayer,
      scoreAi: state.scoreAi,
      suddenDeath: isSuddenDeath(state) && state.kicksPlayer > REGULATION_KICKS,
    });
    setSnapshot(snapshotOf(state));
    setPhase('finished');
    onCompleteRef.current?.({ score, outcome });
  }, []);

  const handleEvent = useCallback(
    (event: ShootoutEvent, state: ShootoutState) => {
      const audio = audioRef.current;
      if (event === 'settle') {
        const attempt = state.current;
        if (audio && attempt) {
          if (attempt.shooter === 'player') {
            if (attempt.scored) audio.goal();
            else audio.save();
          } else if (attempt.saved) {
            audio.save();
          } else {
            audio.miss();
          }
        }
        setSnapshot(snapshotOf(state));
        return;
      }
      audio?.whistle();
      if (state.winner === 'player') audio?.goal();
      finishGame();
    },
    [finishGame],
  );

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const delta = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const state = stateRef.current;
      if (!state) return;
      if (phase === 'playing') {
        const events = stepShootout(state, delta);
        for (const event of events) handleEvent(event, state);
        if (state.phase !== lastPhaseRef.current) {
          lastPhaseRef.current = state.phase;
          setSnapshot(snapshotOf(state));
        }
      }
      draw();
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, draw, handleEvent]);

  const start = useCallback(() => {
    const state = createShootout(settings.difficulty);
    stateRef.current = state;
    lastPhaseRef.current = state.phase;
    finishedRef.current = false;
    setHover(null);
    setSnapshot(snapshotOf(state));
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
  }, [settings.difficulty, settings.muted, setHover]);

  const chooseSetup = useCallback(() => {
    finishedRef.current = false;
    stateRef.current = createShootout(settings.difficulty);
    lastPhaseRef.current = 'player-aim';
    setHover(null);
    setSnapshot(EMPTY_SNAPSHOT);
    setResult(null);
    setIsBest(false);
    setPhase('menu');
    draw();
  }, [draw, setHover, settings.difficulty]);

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

  const act = useCallback((zone: Zone) => {
    const state = stateRef.current;
    if (!state || phaseRef.current !== 'playing') return;
    if (state.phase === 'player-aim') {
      const attempt = shoot(state, zone);
      if (!attempt) return;
      audioRef.current?.kick(0.8);
      lastPhaseRef.current = state.phase;
      setSnapshot(snapshotOf(state));
    } else if (state.phase === 'ai-aim') {
      const attempt = dive(state, zone);
      if (!attempt) return;
      audioRef.current?.bounce();
      lastPhaseRef.current = state.phase;
      setSnapshot(snapshotOf(state));
    }
  }, []);

  const toggleMute = useCallback(() => {
    const nextMuted = !settings.muted;
    const audio = audioRef.current;
    if (audio && audio.isMuted !== nextMuted) audio.toggleMute();
    const updated = { ...settings, muted: nextMuted };
    setSettings(updated);
    saveSettings(updated);
  }, [settings]);

  const changeDifficulty = useCallback((difficulty: Difficulty) => {
    setSettings((current) => {
      const updated = { ...current, difficulty };
      saveSettings(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      const zone = KEY_ZONES[event.code];
      if (zone !== undefined) {
        event.preventDefault();
        act(zone);
        return;
      }
      if (event.code === 'KeyP' || (event.code === 'Escape' && phaseRef.current === 'paused')) {
        event.preventDefault();
        togglePause();
      } else if (event.code === 'KeyM') {
        event.preventDefault();
        toggleMute();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [act, toggleMute, togglePause]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      if (phaseRef.current !== 'playing' || !state) return;
      if (state.phase !== 'player-aim' && state.phase !== 'ai-aim') {
        setHover(null);
        return;
      }
      const zone = zoneFromEvent(event);
      setHover(zone);
    },
    [setHover],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const state = stateRef.current;
      if (phaseRef.current !== 'playing' || !state) return;
      if (state.phase !== 'player-aim' && state.phase !== 'ai-aim') return;
      const zone = zoneFromEvent(event);
      if (zone !== null) act(zone);
    },
    [act],
  );

  const onPointerLeave = useCallback(() => setHover(null), [setHover]);

  const aiming = phase === 'playing' ? aimModeOf(snapshot.phase) : null;
  const aimingActive = phase === 'playing' && aiming !== null;

  const status =
    phase === 'menu'
      ? 'Choose a difficulty, then start the shootout.'
      : phase === 'finished' && result
        ? `Shootout ${result.winner === 'player' ? 'won' : 'lost'} ${result.scorePlayer} to ${result.scoreAi}.`
        : `${snapshot.message} You ${snapshot.scorePlayer}, CPU ${snapshot.scoreAi}.`;

  return (
    <GameFrame
      title="Penalty Protocol"
      subtitle="Five kicks. Six corners. One keeper read."
      icon={Target}
      accent="mint"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label="You" value={snapshot.scorePlayer} tone="mint" />
          <GameStat label="CPU" value={snapshot.scoreAi} tone="coral" />
          <GameStat label="Round" value={snapshot.round} />
          <GameStat label="Saves" value={snapshot.saves} tone="electric" />
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
              aria-label={phase === 'paused' ? 'Resume shootout' : 'Pause shootout'}
              title={phase === 'paused' ? 'Resume shootout' : 'Pause shootout'}
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
              aria-label="Back to shootout setup"
              title="Back to shootout setup"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Q W E aim high, A S D aim low. Click or tap the goal to pick a corner. P pauses, M mutes.</span>
          <span>Level after five kicks goes to sudden death. Bests are stored only in this browser.</span>
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
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              onPointerCancel={onPointerLeave}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Penalty shootout pitch. Click or tap a corner of the goal to shoot, then pick where to dive when the CPU shoots."
            />

            {phase === 'playing' || phase === 'paused' ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
                <span className="rounded-full border border-mint/30 bg-night-950/80 px-2.5 py-1 text-[11px] font-semibold text-mint">
                  You {snapshot.scorePlayer} · CPU {snapshot.scoreAi}
                </span>
                <span className="rounded-full border border-white/10 bg-night-950/80 px-2.5 py-1 text-[11px] text-muted">
                  {snapshot.round}
                </span>
              </div>
            ) : null}

            {phase === 'playing' && aiming ? (
              <div className="pointer-events-none absolute inset-x-0 top-11 flex justify-center">
                <span className="rounded-full border border-white/10 bg-night-950/80 px-3 py-1 text-[11px] text-ink">
                  {snapshot.message}
                </span>
              </div>
            ) : null}

            {aimingActive ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
                <span className="rounded-full border border-electric-400/30 bg-night-950/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-electric-200">
                  {aiming === 'dive' ? 'Pick your dive' : 'Pick your corner'}
                </span>
              </div>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            <div
              role="group"
              aria-label={aiming === 'dive' ? 'Choose where to dive' : 'Choose a shot corner'}
              className="grid grid-cols-3 gap-2"
            >
              {ZONE_SHORT.map((short, index) => {
                const zone = index as Zone;
                return (
                  <ZoneButton
                    key={short}
                    short={short}
                    hint={ZONE_KEYS[index] ?? ''}
                    label={`${aiming === 'dive' ? 'Dive' : 'Shoot'} ${ZONE_LABELS[zone].toLowerCase()}`}
                    active={hoverZone === zone}
                    disabled={!aimingActive}
                    onClick={() => act(zone)}
                  />
                );
              })}
            </div>

            {snapshot.history.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kicks</span>
                <ol className="flex flex-wrap items-center gap-1.5" aria-label="Kick history">
                  {snapshot.history.map((entry, index) => (
                    <li
                      key={index}
                      className={cn(
                        'grid h-5 w-5 place-items-center rounded-full border text-[9px] font-bold',
                        entry.result === 'goal'
                          ? 'border-mint/40 bg-mint/15 text-mint'
                          : entry.result === 'save'
                            ? 'border-coral/40 bg-coral/15 text-coral'
                            : 'border-white/15 bg-white/5 text-muted',
                      )}
                    >
                      <span aria-hidden="true">{entry.shooter === 'player' ? 'Y' : 'C'}</span>
                      <span className="sr-only">
                        {`Kick ${index + 1}: ${entry.shooter === 'player' ? 'you' : 'CPU'} ${entry.result}`}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>

        {phase === 'menu' ? (
          <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center">
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">NeonRift Sports · Shootout</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Hold your nerve. <span className="text-gradient">Read the keeper.</span>
                  </h3>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    Best of five from twelve yards, then sudden death. Pick a corner to shoot, then pick where
                    to dive as the CPU steps up. The keeper learns your favourite corner.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <RecordTile label="Best" value={records.bestScore.toLocaleString()} />
                  <RecordTile label="Record" value={`${records.wins}–${records.losses}`} />
                  <RecordTile label="Streak" value={records.streak} />
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Keeper skill</p>
                  <GameSegmented
                    options={DIFFICULTY_OPTIONS}
                    value={settings.difficulty}
                    onChange={changeDifficulty}
                    label="Keeper difficulty"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  {records.shootouts} shootout{records.shootouts === 1 ? '' : 's'} played · best {records.bestSaves} save
                  {records.bestSaves === 1 ? '' : 's'}
                </p>
              </div>

              <p className="text-[11px] text-muted">{difficultyBlurb(settings.difficulty)}</p>

              <div className="flex flex-wrap items-center gap-2">
                <GameButton variant="primary" onClick={start}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Start shootout
                </GameButton>
                <span className="text-[11px] text-muted">Scores and streaks stay inside this browser.</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Guide icon={<Crosshair className="h-3.5 w-3.5" aria-hidden="true" />} label="Shoot" value="Q W E high · A S D low" />
                <Guide icon={<Hand className="h-3.5 w-3.5" aria-hidden="true" />} label="Keep" value="Dive to the CPU corner" />
                <Guide icon={<Trophy className="h-3.5 w-3.5" aria-hidden="true" />} label="Win" value="Outscore five kicks" />
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'paused' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Shootout paused</p>
            <h3 className="font-display text-xl font-semibold text-ink">Take a breath</h3>
            <p className="max-w-xs text-xs leading-5 text-muted">
              You {snapshot.scorePlayer} · CPU {snapshot.scoreAi} · {snapshot.round.toLowerCase()}
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
          <GameOverlay tone={result.winner === 'player' ? 'win' : 'loss'}>
            <span
              className={cn(
                'grid h-12 w-12 place-items-center rounded-2xl',
                result.winner === 'player' ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral',
              )}
            >
              {result.winner === 'player' ? (
                <Trophy className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Hand className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {result.winner === 'player'
                ? result.suddenDeath
                  ? 'Won in sudden death'
                  : 'Shootout won'
                : result.suddenDeath
                  ? 'Lost in sudden death'
                  : 'Shootout lost'}
            </h3>
            <p className="font-display text-2xl font-bold tabular-nums text-ink">
              {result.scorePlayer}–{result.scoreAi}
            </p>
            <p className="text-sm text-muted">
              {result.saves} save{result.saves === 1 ? '' : 's'} · {result.score.toLocaleString()} points
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Trophy className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
              Browser-local best {records.bestScore.toLocaleString()} · streak {records.streak}
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

function difficultyBlurb(difficulty: Difficulty): string {
  if (difficulty === 'casual') return 'Casual keeps the keeper honest but forgiving, and the CPU drags more shots wide.';
  if (difficulty === 'elite') return 'Elite reads your patterns aggressively and rarely misses the target.';
  return 'Pro sits in the middle: a keeper who punishes repeated corners and a CPU that hits most chances.';
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
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-mint">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className="block truncate text-[11px] text-ink">{value}</span>
      </span>
    </div>
  );
}

function ZoneButton({
  short,
  hint,
  label,
  active,
  disabled,
  onClick,
}: {
  short: string;
  hint: string;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick();
        event.currentTarget.blur();
      }}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-xl border text-[11px] font-semibold transition active:scale-[0.98] disabled:opacity-40',
        active
          ? 'border-mint/50 bg-mint/15 text-mint'
          : 'border-white/10 bg-white/[0.03] text-ink hover:border-white/25',
      )}
    >
      <span>{short}</span>
      <span className={cn('rounded border px-1 py-0.5 text-[9px] font-medium', active ? 'border-mint/30 text-mint/80' : 'border-white/10 text-muted')}>
        {hint}
      </span>
    </button>
  );
}
