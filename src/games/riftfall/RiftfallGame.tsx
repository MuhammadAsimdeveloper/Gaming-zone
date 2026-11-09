import {
  Home,
  Pause,
  Play,
  RotateCcw,
  Shield,
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
import { readMutedPreference, writeMutedPreference } from '../../games3d/shared/mutePreference';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { isInteractiveTarget } from '../shared/keyboard';
import { useBestScore } from '../shared/useBestScore';
import { useReducedMotion } from '../shared/motion';
import { useVisibilityPause } from '../shared/useVisibilityPause';
import { RiftfallAudio } from './audio';
import { drawRiftfall } from './render';
import {
  DASH_TICKS,
  WAVE_COUNT,
  WEAPON_IDS,
  createRun,
  startNextWave,
  stepRun,
  type RunInput,
  type RunState,
  type WeaponId,
} from './simulation';
import { UPGRADES, WEAPONS, applyUpgrade, rollOffers, type Upgrade } from './upgrades';

export const RIFTFALL_BEST_KEY = 'neonrift:game:riftfall:records:v1';

type ShellPhase = 'menu' | 'fighting' | 'upgrades' | 'paused' | 'finished';

const TICK_MS = 1000 / 60;
const HUD_MS = 100;
const MAX_DPR = 2;
const MAX_STEPS = 4;

const WEAPON_LABELS: Record<WeaponId, string> = {
  blade: 'Blade',
  arc: 'Arc',
  rail: 'Rail',
  bloom: 'Bloom',
};

const WEAPON_TAGLINES: Record<WeaponId, string> = {
  blade: 'Short reach, heavy swings',
  arc: 'Mid-range energy fan',
  rail: 'Long lance, slow rhythm',
  bloom: 'Wide burst area',
};

interface DirectionInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

interface ActionInput {
  dash: boolean;
  parry: boolean;
}

interface RiftfallHud {
  wave: number;
  health: number;
  maxHealth: number;
  score: number;
  combo: number;
  kills: number;
  weapon: WeaponId;
}

interface RunResult {
  won: boolean;
  score: number;
  wave: number;
  kills: number;
}

const EMPTY_HUD: RiftfallHud = {
  wave: 1,
  health: 100,
  maxHealth: 100,
  score: 0,
  combo: 0,
  kills: 0,
  weapon: 'blade',
};

const MOVE_KEYS: Record<string, keyof DirectionInput> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const WEAPON_KEYS: Record<string, WeaponId> = {
  Digit1: 'blade',
  Digit2: 'arc',
  Digit3: 'rail',
  Digit4: 'bloom',
  KeyJ: 'blade',
  KeyK: 'arc',
  KeyL: 'rail',
};

function neutralDirections(): DirectionInput {
  return { up: false, down: false, left: false, right: false };
}

function neutralActions(): ActionInput {
  return { dash: false, parry: false };
}

function hudFrom(run: RunState): RiftfallHud {
  return {
    wave: run.wave,
    health: run.player.health,
    maxHealth: run.player.maxHealth,
    score: run.score,
    combo: run.combo,
    kills: run.kills,
    weapon: run.weapon,
  };
}

function inputFrom(held: DirectionInput, actions: ActionInput): RunInput {
  const moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  const moveY = (held.down ? 1 : 0) - (held.up ? 1 : 0);
  const diagonal = moveX !== 0 && moveY !== 0 ? Math.SQRT1_2 : 1;
  return {
    moveX: moveX * diagonal,
    moveY: moveY * diagonal,
    dash: actions.dash,
    parry: actions.parry,
  };
}

function nextSeed(): number {
  return (Math.imul(Date.now() & 0xffffffff, 1664525) + 1013904223) >>> 0;
}

export default function RiftfallGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runRef = useRef<RunState | null>(null);
  const audioRef = useRef<RiftfallAudio | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const hudClockRef = useRef(0);
  const phaseRef = useRef<ShellPhase>('menu');
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const heldRef = useRef<DirectionInput>(neutralDirections());
  const actionsRef = useRef<ActionInput>(neutralActions());
  const comboRef = useRef(0);
  const dashTicksRef = useRef(0);
  const parryTicksRef = useRef(0);
  const mutedRef = useRef(readMutedPreference());
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  const [phase, setPhase] = useState<ShellPhase>('menu');
  const [weapon, setWeapon] = useState<WeaponId>('blade');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(mutedRef.current);
  const [hud, setHud] = useState<RiftfallHud>(EMPTY_HUD);
  const [offers, setOffers] = useState<Upgrade[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const reduceFlashRef = useRef(prefersReducedMotion);
  const { best, submit } = useBestScore(RIFTFALL_BEST_KEY);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    reduceFlashRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const draw = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const run = runRef.current;
    if (!canvas || !run) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round((rect.width || 720) * dpr));
    const height = Math.max(1, Math.round((rect.height || 450) * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    drawRiftfall(context, canvas, { run, time: now }, { reducedMotion: reduceFlashRef.current });
  }, []);

  const finishRun = useCallback(
    (run: RunState, won: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      stopLoop();
      const summary: RunResult = { won, score: run.score, wave: run.wave, kills: run.kills };
      setResult(summary);
      setHud(hudFrom(run));
      submit(run.score);
      phaseRef.current = 'finished';
      setPhase('finished');
      if (won) audioRef.current?.victory();
      else audioRef.current?.ko();
      onCompleteRef.current?.({ outcome: won ? 'win' : 'loss', score: run.score });
    },
    [stopLoop, submit],
  );

  const enterUpgrades = useCallback((run: RunState) => {
    if (phaseRef.current !== 'fighting') return;
    const next = rollOffers(run, 3);
    if (next.length === 0) {
      startNextWave(run);
      return;
    }
    accumulatorRef.current = 0;
    setOffers(next);
    phaseRef.current = 'upgrades';
    setPhase('upgrades');
    audioRef.current?.wave();
  }, []);

  const resolveRun = useCallback(
    (run: RunState) => {
      if (run.status === 'won') finishRun(run, true);
      else if (run.status === 'lost') finishRun(run, false);
      else if (run.status === 'betweenWaves') enterUpgrades(run);
    },
    [enterUpgrades, finishRun],
  );

  const cues = useCallback((run: RunState) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (run.combo > comboRef.current) {
      audio.hit(Math.min(1, 0.35 + run.combo * 0.05));
    }
    comboRef.current = run.combo;
    if (run.player.parryTicks === run.parryWindow && parryTicksRef.current === 0) audio.parry();
    if (run.player.dashTicks === DASH_TICKS && dashTicksRef.current === 0) audio.dash();
    dashTicksRef.current = run.player.dashTicks;
    parryTicksRef.current = run.player.parryTicks;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const run = runRef.current;
      if (!run) return;

      const previous = lastTimeRef.current;
      lastTimeRef.current = now;

      if (phaseRef.current === 'fighting' && !pausedRef.current) {
        let delta = now - previous;
        if (!Number.isFinite(delta) || delta < 0 || delta > 250) delta = TICK_MS;
        accumulatorRef.current += delta;

        let steps = 0;
        while (accumulatorRef.current >= TICK_MS && steps < MAX_STEPS) {
          accumulatorRef.current -= TICK_MS;
          steps += 1;
          const input = inputFrom(heldRef.current, actionsRef.current);
          actionsRef.current = neutralActions();
          stepRun(run, input, 1);
          cues(run);
          if (run.status !== 'fighting') {
            accumulatorRef.current = 0;
            break;
          }
        }

        if (run.status !== 'fighting') resolveRun(run);
      }

      draw(now);

      if (now - hudClockRef.current >= HUD_MS) {
        hudClockRef.current = now;
        setHud(hudFrom(run));
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [cues, draw, resolveRun]);

  const startRun = useCallback(
    (nextWeapon: WeaponId) => {
      setWeapon(nextWeapon);
      stopLoop();
      const run = createRun({ seed: nextSeed(), weapon: nextWeapon });
      runRef.current = run;
      finishedRef.current = false;
      pausedRef.current = false;
      heldRef.current = neutralDirections();
      actionsRef.current = neutralActions();
      comboRef.current = 0;
      accumulatorRef.current = 0;
      hudClockRef.current = 0;
      lastTimeRef.current = performance.now();

      setHud(hudFrom(run));
      setOffers([]);
      setResult(null);
      setPaused(false);
      phaseRef.current = 'fighting';
      setPhase('fighting');

      audioRef.current ??= new RiftfallAudio();
      audioRef.current.setMuted(mutedRef.current);
      audioRef.current.start();
      audioRef.current.select();

      onStartRef.current?.();
      startLoop();
    },
    [startLoop, stopLoop],
  );

  const chooseUpgrade = useCallback(
    (upgrade: Upgrade) => {
      const run = runRef.current;
      if (!run || phaseRef.current !== 'upgrades') return;
      applyUpgrade(run, upgrade.id);
      audioRef.current?.select();
      setOffers([]);
      startNextWave(run);
      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
      phaseRef.current = 'fighting';
      setPhase('fighting');
      if (run.status !== 'fighting') resolveRun(run);
    },
    [resolveRun],
  );

  const skipUpgrade = useCallback(() => {
    const run = runRef.current;
    if (!run || phaseRef.current !== 'upgrades') return;
    startNextWave(run);
    setOffers([]);
    accumulatorRef.current = 0;
    lastTimeRef.current = performance.now();
    if (run.status === 'fighting') {
      phaseRef.current = 'fighting';
      setPhase('fighting');
    } else {
      resolveRun(run);
    }
  }, [resolveRun]);

  const togglePause = useCallback(() => {
    if (!runRef.current) return;
    if (phaseRef.current === 'fighting') {
      pausedRef.current = true;
      accumulatorRef.current = 0;
      phaseRef.current = 'paused';
      setPaused(true);
      setPhase('paused');
    } else if (phaseRef.current === 'paused') {
      pausedRef.current = false;
      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
      phaseRef.current = 'fighting';
      setPaused(false);
      setPhase('fighting');
    }
  }, []);

  const backToMenu = useCallback(() => {
    stopLoop();
    runRef.current = null;
    pausedRef.current = false;
    finishedRef.current = false;
    heldRef.current = neutralDirections();
    actionsRef.current = neutralActions();
    setPaused(false);
    setOffers([]);
    setResult(null);
    setHud(EMPTY_HUD);
    phaseRef.current = 'menu';
    setPhase('menu');
  }, [stopLoop]);

  const retry = useCallback(() => {
    startRun(weapon);
  }, [startRun, weapon]);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      writeMutedPreference(next);
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const switchWeapon = useCallback((next: WeaponId) => {
    const run = runRef.current;
    setWeapon(next);
    if (!run) return;
    run.weapon = next;
    run.player.weapon = next;
    audioRef.current?.select();
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioRef.current?.dispose();
    audioRef.current = null;
    runRef.current = null;
  }, []);

  const inFight = phase === 'fighting';
  const handleHidden = useCallback(() => {
    if (phaseRef.current === 'fighting' && !pausedRef.current) togglePause();
  }, [togglePause]);
  useVisibilityPause(handleHidden, inFight);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;

      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (runRef.current) {
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
      if (phaseRef.current !== 'fighting') return;

      const move = MOVE_KEYS[event.code];
      if (move) {
        event.preventDefault();
        heldRef.current = { ...heldRef.current, [move]: true };
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) actionsRef.current = { ...actionsRef.current, dash: true };
        return;
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault();
        if (!event.repeat) actionsRef.current = { ...actionsRef.current, parry: true };
        return;
      }

      const nextWeapon = WEAPON_KEYS[event.code];
      if (nextWeapon) {
        event.preventDefault();
        switchWeapon(nextWeapon);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      const move = MOVE_KEYS[event.code];
      if (move) heldRef.current = { ...heldRef.current, [move]: false };
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [switchWeapon, toggleMute, togglePause]);

  const setHold = (key: keyof DirectionInput, value: boolean): void => {
    heldRef.current = { ...heldRef.current, [key]: value };
  };

  const act = (key: keyof ActionInput): void => {
    actionsRef.current = { ...actionsRef.current, [key]: true };
  };

  const status =
    phase === 'menu'
      ? `Riftfall. Pick a weapon and start. ${WAVE_COUNT} waves, boss at 6 and 12.`
      : phase === 'upgrades'
        ? `Wave ${Math.min(WAVE_COUNT, hud.wave + 1)} incoming. Choose an upgrade.`
        : phase === 'finished' && result
          ? result.won
            ? `Rift sealed. Score ${result.score}, ${result.kills} kills.`
            : `Run over on wave ${result.wave}. Score ${result.score}.`
          : `Wave ${hud.wave} of ${WAVE_COUNT}. Health ${Math.ceil(hud.health)} of ${hud.maxHealth}. Score ${hud.score}. Combo ${hud.combo}.`;

  return (
    <GameFrame
      title="Riftfall"
      subtitle="Twelve waves. Four weapons. Hold the rift."
      icon={Swords}
      accent="plasma"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameStat label="Wave" value={`${hud.wave} / ${WAVE_COUNT}`} tone="plasma" />
          <GameStat
            label="Health"
            value={`${Math.max(0, Math.ceil(hud.health))} / ${hud.maxHealth}`}
            tone={hud.health <= hud.maxHealth * 0.3 ? 'coral' : 'mint'}
          />
          <GameStat label="Score" value={hud.score.toLocaleString()} tone="electric" />
          <GameStat label="Combo" value={`×${hud.combo}`} tone={hud.combo >= 10 ? 'coral' : 'ink'} />
        </div>
      }
      toolbar={
        <>
          {runRef.current && (phase === 'fighting' || phase === 'paused') ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={togglePause}
              aria-label={paused ? 'Resume run' : 'Pause run'}
              title={paused ? 'Resume run' : 'Pause run'}
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
          {runRef.current && phase !== 'menu' && phase !== 'finished' ? (
            <GameButton size="icon" variant="ghost" onClick={backToMenu} aria-label="Quit to menu" title="Quit to menu">
              <Home className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Space</Kbd> dash
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Shift</Kbd> parry
          </span>
          <span className="flex items-center gap-1">
            <Kbd>1</Kbd>–<Kbd>4</Kbd> swap weapon
          </span>
          <span>P pauses. M mutes. Attacks fire automatically in range.</span>
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
            aria-label="Riftfall arena"
          />

          {inFight ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
              <div className="pointer-events-auto grid grid-cols-3 gap-1.5">
                <span />
                <TouchHold label="Move up" onPress={() => setHold('up', true)} onRelease={() => setHold('up', false)}>
                  <span aria-hidden="true">▲</span>
                </TouchHold>
                <span />
                <TouchHold label="Move left" onPress={() => setHold('left', true)} onRelease={() => setHold('left', false)}>
                  <span aria-hidden="true">◀</span>
                </TouchHold>
                <TouchHold label="Move down" onPress={() => setHold('down', true)} onRelease={() => setHold('down', false)}>
                  <span aria-hidden="true">▼</span>
                </TouchHold>
                <TouchHold label="Move right" onPress={() => setHold('right', true)} onRelease={() => setHold('right', false)}>
                  <span aria-hidden="true">▶</span>
                </TouchHold>
              </div>
              <div className="pointer-events-auto grid grid-cols-2 gap-1.5">
                <TouchTap label="Dash" onClick={() => act('dash')}>
                  <Zap className="h-5 w-5" aria-hidden="true" />
                </TouchTap>
                <TouchTap label="Parry" onClick={() => act('parry')}>
                  <Shield className="h-5 w-5" aria-hidden="true" />
                </TouchTap>
                {WEAPON_IDS.slice(0, 2).map((id) => (
                  <TouchTap
                    key={id}
                    label={`Switch to ${WEAPON_LABELS[id]}`}
                    onClick={() => switchWeapon(id)}
                    accent={hud.weapon === id}
                  >
                    <span className="text-[10px] font-semibold uppercase" aria-hidden="true">
                      {WEAPON_LABELS[id].slice(0, 2)}
                    </span>
                  </TouchTap>
                ))}
                {WEAPON_IDS.slice(2).map((id) => (
                  <TouchTap
                    key={id}
                    label={`Switch to ${WEAPON_LABELS[id]}`}
                    onClick={() => switchWeapon(id)}
                    accent={hud.weapon === id}
                  >
                    <span className="text-[10px] font-semibold uppercase" aria-hidden="true">
                      {WEAPON_LABELS[id].slice(0, 2)}
                    </span>
                  </TouchTap>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {phase === 'menu' ? (
          <GameOverlay
            className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
            label="Riftfall menu"
          >
            <div className="mx-auto w-full max-w-3xl space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-plasma-300">
                    NeonRift Arcade · Action
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                    Hold the arena. <span className="text-gradient">Break the rift.</span>
                  </h3>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                    Twelve escalating waves, bosses at six and twelve. Dash through fire, parry it back,
                    and stack upgrades between waves. Your weapon swings on its own whenever an enemy
                    is in range.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-night-900/80 px-4 py-2 text-center">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted">Best score</p>
                  <p className="font-display text-lg font-semibold text-mint">
                    {best === null ? '—' : best.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Weapon</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {WEAPON_IDS.map((id) => {
                    const stats = WEAPONS[id];
                    const selected = weapon === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-label={`Select ${WEAPON_LABELS[id]}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setWeapon(id);
                          audioRef.current?.select();
                        }}
                        className={cn(
                          'rounded-2xl border p-3 text-left transition',
                          selected
                            ? 'border-plasma-400/60 bg-plasma-500/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Swords className="h-3.5 w-3.5" aria-hidden="true" />
                          {WEAPON_LABELS[id]}
                        </span>
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] text-muted">
                          {WEAPON_TAGLINES[id]}
                        </span>
                        <span className="mt-1 block text-[11px] tabular-nums text-muted">
                          {stats.damage} dmg · {Math.round((stats.cooldownTicks / 60) * 100) / 100}s ·{' '}
                          {stats.range} reach
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-2 text-[11px] text-muted sm:grid-cols-2">
                  <span className="rounded-xl border border-white/10 bg-night-900/70 px-3 py-1.5">
                    WASD or arrows to move. Space dashes, Shift parries.
                  </span>
                  <span className="rounded-xl border border-white/10 bg-night-900/70 px-3 py-1.5">
                    Enemies telegraph. Parry the glow to stun and reflect.
                  </span>
                </div>
                <GameButton variant="primary" onClick={() => startRun(weapon)}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                  Start run
                </GameButton>
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'upgrades' ? (
          <GameOverlay className="items-stretch justify-start overflow-y-auto text-left sm:justify-center" label="Choose an upgrade">
            <div className="mx-auto w-full max-w-2xl space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
                  Wave {hud.wave} cleared
                </p>
                <h3 className="font-display text-xl font-semibold text-ink">
                  Choose one upgrade for wave {Math.min(WAVE_COUNT, hud.wave + 1)}
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {offers.map((offer) => {
                  const stacks = runRef.current?.upgrades[offer.id] ?? 0;
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      aria-label={`Pick ${offer.name}`}
                      onClick={() => chooseUpgrade(offer)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-plasma-400/60 hover:bg-plasma-500/10"
                    >
                      <span className="block text-sm font-semibold text-white">{offer.name}</span>
                      <span className="mt-1 block text-[11px] leading-5 text-muted">{offer.description}</span>
                      <span className="mt-2 block text-[10px] uppercase tracking-[0.14em] text-plasma-300">
                        {stacks} / {offer.maxStacks}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GameButton variant="ghost" size="sm" onClick={skipUpgrade}>
                  Skip upgrade
                </GameButton>
                <span className="text-[11px] text-muted">
                  {UPGRADES.length} upgrades exist. Offers never repeat a maxed pick.
                </span>
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'paused' ? (
          <GameOverlay label="Run paused">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Run paused</p>
            <h3 className="font-display text-xl font-semibold text-ink">
              Wave {hud.wave} / {WAVE_COUNT} · {hud.score.toLocaleString()} points
            </h3>
            <p className="text-xs text-muted">
              {Math.max(0, Math.ceil(hud.health))} HP · {hud.combo} combo · {hud.kills} kills
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={togglePause}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Resume run
              </GameButton>
              <GameButton variant="secondary" onClick={backToMenu}>
                Quit to menu
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'finished' && result ? (
          <GameOverlay tone={result.won ? 'win' : 'loss'} label={result.won ? 'Rift complete' : 'Run ended'}>
            <span
              className={cn(
                'grid h-12 w-12 place-items-center rounded-2xl',
                result.won ? 'bg-mint/10 text-mint' : 'bg-coral/10 text-coral',
              )}
            >
              {result.won ? <Trophy className="h-6 w-6" aria-hidden="true" /> : <Swords className="h-6 w-6" aria-hidden="true" />}
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {result.won ? 'Rift complete' : 'Run ended'}
            </h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              {result.won
                ? `All ${WAVE_COUNT} waves cleared with the ${WEAPON_LABELS[hud.weapon]}. Final score ${result.score.toLocaleString()}.`
                : `Fell on wave ${result.wave} of ${WAVE_COUNT}. ${result.kills} kills, ${result.score.toLocaleString()} points.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={retry}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Run again
              </GameButton>
              <GameButton variant="secondary" onClick={backToMenu}>
                Back to menu
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
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
      className="grid h-11 w-11 select-none place-items-center rounded-2xl border border-white/15 bg-night-950/70 text-ink backdrop-blur transition active:scale-95"
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
        'grid h-11 w-11 select-none place-items-center rounded-2xl border text-ink backdrop-blur transition active:scale-95',
        accent
          ? 'border-plasma-400/60 bg-plasma-500/25 text-white'
          : 'border-white/15 bg-night-950/70 hover:bg-night-900/80',
      )}
    >
      {children}
    </button>
  );
}
