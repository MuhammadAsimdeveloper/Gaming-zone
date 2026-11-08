import {
  Eye,
  Home,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { readString } from '../../lib/storage';
import { readMutedPreference, writeMutedPreference } from '../../games3d/shared/mutePreference';
import {
  GameButton,
  GameFrame,
  GameOverlay,
  GameSegmented,
  GameStat,
  Kbd,
  type SegmentOption,
} from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useBestScore } from '../shared/useBestScore';
import { useReducedMotion } from '../shared/motion';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { DuelAudio } from './audio';
import { neutralInput, type CombatInput } from './combat';
import { DUEL_LADDER, FIGHTERS, FIGHTER_ORDER, type AiTier, type FighterId } from './fighters';
import { drawDuelScene } from './render';
import { DuelSession, type DuelCue, type DuelSnapshot, type StepResult } from './session';

export const LADDER_KEY = 'neonrift:game:neon-duel:ladder';

type ShellPhase = 'menu' | 'select' | 'intro' | 'fight' | 'roundOver' | 'matchOver' | 'runOver';
type GymMode = 'ladder' | 'training';

const TICK_MS = 1000 / 60;
const HUD_MS = 100;
const MAX_DPR = 2;

const MODE_OPTIONS: ReadonlyArray<SegmentOption<GymMode>> = [
  { value: 'ladder', label: 'Ladder' },
  { value: 'training', label: 'Training' },
];

const MATCH_PHASES: ReadonlySet<ShellPhase> = new Set(['intro', 'fight', 'roundOver']);

const HOLD_KEYS: Record<string, keyof CombatInput> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyS: 'block',
  ArrowDown: 'block',
};

const PULSE_KEYS: Record<string, keyof CombatInput> = {
  KeyW: 'jump',
  ArrowUp: 'jump',
  Space: 'jump',
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'special',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
};

interface DuelHud {
  playerHealth: number;
  rivalHealth: number;
  playerMeter: number;
  rivalMeter: number;
  timerTicks: number;
  round: number;
  playerWins: number;
  rivalWins: number;
}

interface MatchInfo {
  won: boolean;
  playerWins: number;
  rivalWins: number;
  nextRung: number;
}

interface RunResult {
  won: boolean;
  score: number;
}

const EMPTY_HUD: DuelHud = {
  playerHealth: 1000,
  rivalHealth: 1000,
  playerMeter: 0,
  rivalMeter: 0,
  timerTicks: 3600,
  round: 1,
  playerWins: 0,
  rivalWins: 0,
};

function readLadder(): number {
  const raw = readString(LADDER_KEY);
  const parsed = raw === null ? 0 : Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(DUEL_LADDER.length - 1, Math.round(parsed)));
}

function hudFrom(snapshot: DuelSnapshot): DuelHud {
  return {
    playerHealth: snapshot.a.health,
    rivalHealth: snapshot.b.health,
    playerMeter: snapshot.a.meter,
    rivalMeter: snapshot.b.meter,
    timerTicks: snapshot.timerTicks,
    round: snapshot.round,
    playerWins: snapshot.wins.player,
    rivalWins: snapshot.wins.rival,
  };
}

export default function NeonDuelGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<DuelSession | null>(null);
  const audioRef = useRef<DuelAudio | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const hudClockRef = useRef(0);
  const phaseRef = useRef<ShellPhase>('menu');
  const pausedRef = useRef(false);
  const heldRef = useRef<CombatInput>(neutralInput());
  const pulseRef = useRef<CombatInput>(neutralInput());
  const finishedRef = useRef(false);
  const reduceFlashRef = useRef(false);
  const setupRef = useRef<{ mode: GymMode; fighter: FighterId; rung: number }>({
    mode: 'ladder',
    fighter: 'volt',
    rung: 0,
  });
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const handlersRef = useRef({
    draw: (_now: number) => undefined as void,
    sync: (_session: DuelSession) => undefined as void,
    play: (_result: StepResult) => undefined as void,
  });

  const [phase, setPhase] = useState<ShellPhase>('menu');
  const [mode, setMode] = useState<GymMode>('ladder');
  const [fighter, setFighter] = useState<FighterId>('volt');
  const [opponentName, setOpponentName] = useState(FIGHTERS.volt.name);
  const [ladderIndex, setLadderIndex] = useState(readLadder);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => readMutedPreference());
  const [hud, setHud] = useState<DuelHud>(EMPTY_HUD);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [reduceFlash, setReduceFlash] = useState(prefersReducedMotion);
  const { best: bestLadder, submit: submitLadder } = useBestScore(LADDER_KEY);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    reduceFlashRef.current = reduceFlash;
  }, [reduceFlash]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const finishRun = useCallback((won: boolean, score: number) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopLoop();
    setRunResult({ won, score });
    phaseRef.current = 'runOver';
    setPhase('runOver');
    onCompleteRef.current?.({ outcome: won ? 'win' : 'loss', score });
  }, [stopLoop]);

  const draw = (now: number): void => {
    const canvas = canvasRef.current;
    const session = sessionRef.current;
    if (!canvas || !session) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round((rect.width || 720) * dpr));
    const height = Math.max(1, Math.round((rect.height || 420) * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    drawDuelScene(context, canvas, session.snapshot(), {
      reducedMotion: reduceFlashRef.current,
      time: now,
    });
  };

  const play = (result: StepResult): void => {
    const audio = audioRef.current;
    if (!audio) return;

    for (const event of result.events) {
      if (event.type === 'hit') audio.hit(event.amount / 150);
      else if (event.type === 'block') audio.block();
      else if (event.type === 'special') audio.whoosh();
    }

    for (const cue of result.cues as DuelCue[]) {
      if (cue.type === 'countdown') audio.countdown(cue.final);
      else if (cue.type === 'roundStart') audio.countdown(true);
      else if (cue.type === 'roundEnd' || cue.type === 'matchEnd') audio.ko();
      else if (cue.type === 'reset') audio.whoosh();
    }
  };

  const resolveMatch = (session: DuelSession): void => {
    if (setupRef.current.mode === 'training') return;
    const snapshot = session.snapshot();
    const cleared = setupRef.current.rung;

    if (snapshot.winner === 'player') {
      if (cleared >= DUEL_LADDER.length - 1) {
        finishRun(true, DUEL_LADDER.length);
        return;
      }
      const nextRung = cleared + 1;
      submitLadder(nextRung);
      setLadderIndex((current) => Math.max(current, nextRung));
      setMatchInfo({
        won: true,
        playerWins: snapshot.wins.player,
        rivalWins: snapshot.wins.rival,
        nextRung,
      });
      return;
    }

    finishRun(false, cleared);
  };

  const sync = (session: DuelSession): void => {
    const next = session.phase;
    if (phaseRef.current === 'runOver' || next === phaseRef.current) return;

    if (next === 'matchOver') {
      phaseRef.current = 'matchOver';
      setPhase('matchOver');
      resolveMatch(session);
      return;
    }

    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    handlersRef.current = { draw, sync, play };
  });

  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const session = sessionRef.current;
      if (!session) return;

      const previous = lastTimeRef.current;
      lastTimeRef.current = now;

      if (!pausedRef.current) {
        let delta = now - previous;
        if (!Number.isFinite(delta) || delta < 0 || delta > 250) delta = TICK_MS;
        accumulatorRef.current += delta;

        let steps = 0;
        while (accumulatorRef.current >= TICK_MS && steps < 8) {
          accumulatorRef.current -= TICK_MS;
          steps += 1;
          const held = heldRef.current;
          const pulse = pulseRef.current;
          const result = session.step({
            left: held.left,
            right: held.right,
            jump: pulse.jump,
            block: held.block,
            dash: pulse.dash,
            light: pulse.light,
            heavy: pulse.heavy,
            special: pulse.special,
          });
          pulseRef.current = neutralInput();
          handlersRef.current.play(result);
          handlersRef.current.sync(session);
          if (phaseRef.current === 'runOver') break;
        }
      }

      handlersRef.current.draw(now);

      if (now - hudClockRef.current >= HUD_MS) {
        hudClockRef.current = now;
        setHud(hudFrom(session.snapshot()));
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const beginMatch = useCallback(
    (nextMode: GymMode, nextFighter: FighterId, rungIndex: number) => {
      const rung = DUEL_LADDER[Math.max(0, Math.min(DUEL_LADDER.length - 1, rungIndex))]!;
      const rival: FighterId = nextMode === 'training' ? 'mako' : rung.fighter;
      const tier: AiTier = nextMode === 'training' ? 'rookie' : rung.tier;

      sessionRef.current?.dispose();
      const session = new DuelSession({
        player: nextFighter,
        rival,
        tier,
        seed: Math.floor(Math.random() * 2_000_000_000),
        training: nextMode === 'training',
      });
      sessionRef.current = session;
      setupRef.current = { mode: nextMode, fighter: nextFighter, rung: rungIndex };
      finishedRef.current = false;
      pausedRef.current = false;
      heldRef.current = neutralInput();
      pulseRef.current = neutralInput();
      accumulatorRef.current = 0;
      hudClockRef.current = 0;
      lastTimeRef.current = performance.now();

      setPaused(false);
      setMatchInfo(null);
      setRunResult(null);
      setOpponentName(FIGHTERS[rival].name);
      setHud({
        ...EMPTY_HUD,
        playerHealth: FIGHTERS[nextFighter].maxHealth,
        rivalHealth: FIGHTERS[rival].maxHealth,
        round: 1,
      });
      phaseRef.current = 'intro';
      setPhase('intro');

      audioRef.current ??= new DuelAudio();
      audioRef.current.setMuted(muted);
      audioRef.current.start();

      onStartRef.current?.();
      startLoop();
    },
    [muted, startLoop],
  );

  const quitToMenu = useCallback(() => {
    stopLoop();
    sessionRef.current?.dispose();
    sessionRef.current = null;
    pausedRef.current = false;
    setPaused(false);
    setMatchInfo(null);
    setRunResult(null);
    setHud(EMPTY_HUD);
    phaseRef.current = 'menu';
    setPhase('menu');
  }, [stopLoop]);

  const togglePause = useCallback(() => {
    if (!sessionRef.current || !MATCH_PHASES.has(phaseRef.current)) return;
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      writeMutedPreference(next);
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const toggleReduceFlash = useCallback(() => {
    setReduceFlash((current) => !current);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sessionRef.current?.dispose();
    sessionRef.current = null;
    audioRef.current?.dispose();
    audioRef.current = null;
  }, []);

  const inMatch = MATCH_PHASES.has(phase);
  const handleHidden = useCallback(() => {
    if (!pausedRef.current && sessionRef.current && MATCH_PHASES.has(phaseRef.current)) togglePause();
  }, [togglePause]);
  useVisibilityPause(handleHidden, inMatch);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;

      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (sessionRef.current) {
          event.preventDefault();
          togglePause();
        }
        return;
      }
      if (event.code === 'KeyM') {
        event.preventDefault();
        toggleMute();
        return;
      }

      const hold = HOLD_KEYS[event.code];
      if (hold) {
        event.preventDefault();
        heldRef.current = { ...heldRef.current, [hold]: true };
        return;
      }

      const pulse = PULSE_KEYS[event.code];
      if (pulse) {
        event.preventDefault();
        if (!event.repeat) pulseRef.current = { ...pulseRef.current, [pulse]: true };
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      const hold = HOLD_KEYS[event.code];
      if (hold) heldRef.current = { ...heldRef.current, [hold]: false };
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [toggleMute, togglePause]);

  const rung = DUEL_LADDER[ladderIndex]!;
  const rivalName = opponentName;
  const playerSpec = FIGHTERS[fighter];
  const timer = Math.max(0, Math.ceil(hud.timerTicks / 60));
  const status =
    phase === 'menu'
      ? 'Choose a fighter, then start the ladder or a training session.'
      : phase === 'select'
        ? `${playerSpec.name} challenges ${FIGHTERS[rung.fighter].name} at ${rung.name}.`
        : phase === 'runOver' && runResult
          ? runResult.won
            ? 'Ladder conquered. Every rung cleared.'
            : 'The run is over. Try the ladder again.'
          : `Round ${hud.round}. ${timer} seconds left. You ${hud.playerWins}, rival ${hud.rivalWins}.`;

  const setHold = (key: keyof CombatInput, value: boolean): void => {
    heldRef.current = { ...heldRef.current, [key]: value };
  };

  const pulse = (key: keyof CombatInput): void => {
    pulseRef.current = { ...pulseRef.current, [key]: true };
  };

  return (
    <GameFrame
      title="Neon Duel"
      subtitle="Four fighters. Five rungs. Best of three."
      icon={Swords}
      accent="plasma"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat
            label={playerSpec.name}
            value={`${Math.ceil(hud.playerHealth)}/${playerSpec.maxHealth}`}
            tone="electric"
          />
          <GameStat label="Rival" value={`${Math.ceil(hud.rivalHealth)} ${rivalName}`} tone="coral" />
          <GameStat label="Round" value={`${hud.round} · ${hud.playerWins}–${hud.rivalWins}`} />
          <GameStat label="Timer" value={`${timer}s`} tone={timer <= 10 ? 'coral' : 'ink'} />
        </div>
      }
      toolbar={
        <>
          {sessionRef.current && inMatch ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={togglePause}
              aria-label={paused ? 'Resume match' : 'Pause match'}
              title={paused ? 'Resume match' : 'Pause match'}
            >
              {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
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
          <GameButton
            size="icon"
            variant="ghost"
            onClick={toggleReduceFlash}
            aria-label="Reduce flash effects"
            aria-pressed={reduceFlash}
            title="Reduce flash effects"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </GameButton>
          {inMatch ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => beginMatch(setupRef.current.mode, setupRef.current.fighter, setupRef.current.rung)}
              aria-label="Restart match"
              title="Restart match"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
          {inMatch ? (
            <GameButton size="icon" variant="ghost" onClick={quitToMenu} aria-label="Quit to menu" title="Quit to menu">
              <Home className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Kbd>A</Kbd>
            <Kbd>D</Kbd> walk
          </span>
          <span className="flex items-center gap-1">
            <Kbd>W</Kbd> jump
          </span>
          <span className="flex items-center gap-1">
            <Kbd>S</Kbd> block
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Shift</Kbd> dash
          </span>
          <span className="flex items-center gap-1">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            <Kbd>L</Kbd> light · heavy · special
          </span>
          <span>P pauses. M mutes.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div className="relative h-[440px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[520px]">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            aria-label="Neon Duel arena. Two fighters face off. Use A and D to walk, W to jump, S to block, Shift to dash, and J, K, L to attack."
          />

          {inMatch ? (
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
              <div className="grid grid-cols-3 gap-2">
                <TouchHold label="Move left" onPress={() => setHold('left', true)} onRelease={() => setHold('left', false)}>
                  <span aria-hidden="true">◀</span>
                </TouchHold>
                <TouchHold label="Block" onPress={() => setHold('block', true)} onRelease={() => setHold('block', false)}>
                  <Shield className="h-5 w-5" aria-hidden="true" />
                </TouchHold>
                <TouchHold label="Move right" onPress={() => setHold('right', true)} onRelease={() => setHold('right', false)}>
                  <span aria-hidden="true">▶</span>
                </TouchHold>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <TouchTap label="Jump" onClick={() => pulse('jump')}>
                  <span className="text-xs font-semibold" aria-hidden="true">JMP</span>
                </TouchTap>
                <TouchTap label="Dash" onClick={() => pulse('dash')}>
                  <span className="text-xs font-semibold" aria-hidden="true">DSH</span>
                </TouchTap>
                <TouchTap label="Light attack" onClick={() => pulse('light')} accent>
                  <span className="text-xs font-semibold" aria-hidden="true">LT</span>
                </TouchTap>
                <TouchTap label="Heavy attack" onClick={() => pulse('heavy')} accent>
                  <span className="text-xs font-semibold" aria-hidden="true">HV</span>
                </TouchTap>
                <TouchTap label="Special attack" onClick={() => pulse('special')} accent>
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </TouchTap>
                <span />
              </div>
            </div>
          ) : null}
        </div>

        {phase === 'menu' ? (
          <GameOverlay
            className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
            label="Neon Duel setup"
          >
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-plasma-300">
                    NeonRift Arcade · Fighting
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Pick your fighter. <span className="text-gradient">Climb the ladder.</span>
                  </h3>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    Frame-perfect strikes, blocks and cancels. Win two rounds per match, then face the
                    next tier. Training mode keeps the dummy coming back.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Best rung</p>
                    <p className="font-display text-lg font-semibold text-mint">
                      {Math.min(DUEL_LADDER.length, (bestLadder ?? 0) + 1)} / {DUEL_LADDER.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2">
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Current</p>
                    <p className="font-display text-lg font-semibold text-ink">
                      {ladderIndex < DUEL_LADDER.length - 1 || bestLadder !== null
                        ? `${ladderIndex + 1} / ${DUEL_LADDER.length}`
                        : 'New run'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Fighters</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {FIGHTER_ORDER.map((id) => (
                      <FighterCard
                        key={id}
                        id={id}
                        selected={fighter === id}
                        onClick={() => setFighter(id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ladder</p>
                  <ol className="space-y-1.5">
                    {DUEL_LADDER.map((entry, index) => (
                      <li
                        key={entry.name}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-[11px]',
                          index === ladderIndex
                            ? 'border-plasma-400/50 bg-plasma-500/10 text-ink'
                            : 'border-white/10 bg-white/[0.03] text-muted',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 text-[10px] font-semibold">
                            {index + 1}
                          </span>
                          <span className="truncate">{entry.name}</span>
                        </span>
                        <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]">
                          {entry.tier}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Mode</p>
                  <GameSegmented options={MODE_OPTIONS} value={mode} onChange={setMode} label="Mode" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {mode === 'ladder' ? (
                    <GameButton
                      variant="primary"
                      onClick={() => {
                        phaseRef.current = 'select';
                        setPhase('select');
                      }}
                    >
                      <Swords className="h-4 w-4" aria-hidden="true" />
                      Start ladder
                    </GameButton>
                  ) : (
                    <GameButton variant="primary" onClick={() => beginMatch('training', fighter, ladderIndex)}>
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      Start training
                    </GameButton>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Guide label="Light" value="J · quick, cancels into heavy" />
                <Guide label="Heavy" value="K · punish blocked pressure" />
                <Guide label="Special" value="L · 50 meter, huge damage" />
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'select' ? (
          <GameOverlay label="Match setup">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              Rung {ladderIndex + 1} of {DUEL_LADDER.length} · {rung.tier}
            </p>
            <h3 className="font-display text-2xl font-semibold text-ink">
              {playerSpec.name} vs {FIGHTERS[rung.fighter].name}
            </h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              {rung.name}. {FIGHTERS[rung.fighter].tagline}. Best of three rounds; the higher health
              total wins a timeout.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton
                variant="primary"
                onClick={() => beginMatch('ladder', fighter, ladderIndex)}
              >
                <Swords className="h-4 w-4" aria-hidden="true" />
                Fight
              </GameButton>
              <GameButton
                variant="secondary"
                onClick={() => {
                  phaseRef.current = 'menu';
                  setPhase('menu');
                }}
              >
                Back
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {paused ? (
          <GameOverlay label="Match paused">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Match paused</p>
            <h3 className="font-display text-xl font-semibold text-ink">
              {hud.playerWins}–{hud.rivalWins} · Round {hud.round}
            </h3>
            <p className="text-xs text-muted">
              {playerSpec.name} {Math.ceil(hud.playerHealth)} HP · {rivalName} {Math.ceil(hud.rivalHealth)} HP
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={togglePause}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Resume
              </GameButton>
              <GameButton variant="secondary" onClick={quitToMenu}>
                Quit to menu
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'matchOver' && matchInfo ? (
          <GameOverlay tone="win" label="Match result">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">Match won</h3>
            <p className="text-sm text-muted">
              {matchInfo.playerWins}–{matchInfo.rivalWins} over {FIGHTERS[DUEL_LADDER[matchInfo.nextRung - 1]!.fighter].name}.
              Ladder advanced to {DUEL_LADDER[matchInfo.nextRung]!.name}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton
                variant="primary"
                onClick={() => beginMatch('ladder', fighter, matchInfo.nextRung)}
              >
                Next fighter
              </GameButton>
              <GameButton variant="secondary" onClick={quitToMenu}>
                Back to menu
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'runOver' && runResult ? (
          <GameOverlay tone={runResult.won ? 'win' : 'loss'} label="Run over">
            <span
              className={cn(
                'grid h-12 w-12 place-items-center rounded-2xl',
                runResult.won ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral',
              )}
            >
              {runResult.won ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Swords className="h-6 w-6" aria-hidden="true" />}
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {runResult.won ? 'Ladder conquered' : 'Run over'}
            </h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              {runResult.won
                ? `Every rung cleared with ${playerSpec.name}. ${DUEL_LADDER.length} of ${DUEL_LADDER.length} rivals beaten.`
                : `${playerSpec.name} fell at ${DUEL_LADDER[Math.min(DUEL_LADDER.length - 1, runResult.score)]!.name}. The ladder keeps your progress; try the rung again.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => beginMatch('ladder', fighter, ladderIndex)}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </GameButton>
              <GameButton variant="secondary" onClick={quitToMenu}>
                Back to menu
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

function FighterCard({
  id,
  selected,
  onClick,
}: {
  id: FighterId;
  selected: boolean;
  onClick: () => void;
}) {
  const spec = FIGHTERS[id];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Fighter: ${spec.name}`}
      aria-pressed={selected}
      className={cn(
        'rounded-2xl border p-3 text-left transition',
        selected
          ? 'border-plasma-400/60 bg-plasma-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: spec.color }}
          aria-hidden="true"
        />
        {spec.name}
      </span>
      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-muted">{spec.tagline}</span>
      <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-muted">{spec.description}</span>
    </button>
  );
}

function TouchHold({
  label,
  onPress,
  onRelease,
  children,
}: {
  label: string;
  onPress: () => void;
  onRelease: () => void;
  children: ReactNode;
}) {
  const press = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onPress();
  };
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={press}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onPointerLeave={onRelease}
      className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-night-950/65 text-ink backdrop-blur transition active:scale-95 sm:h-11 sm:w-11"
    >
      {children}
    </button>
  );
}

function TouchTap({
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
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid h-12 w-12 place-items-center rounded-2xl border text-ink backdrop-blur transition active:scale-95 sm:h-11 sm:w-11',
        accent
          ? 'border-plasma-400/50 bg-plasma-500/25 text-white'
          : 'border-white/15 bg-night-950/65 hover:bg-night-900/80',
      )}
    >
      {children}
    </button>
  );
}

function Guide({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-night-900/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="text-[11px] text-ink">{value}</p>
    </div>
  );
}
