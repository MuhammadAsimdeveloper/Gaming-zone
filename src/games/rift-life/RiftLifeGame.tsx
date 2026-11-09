import { BookOpen, CalendarDays, Heart, Home, RotateCcw, Sparkles, Users, Zap } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { useReducedMotion } from '../shared/motion';
import {
  ENDING_IDS,
  endingById,
  readEndingGallery,
  saveEndingToGallery,
  type EndingId,
} from './endings';
import { NPCS, npcById, type ConversationChoice, type NpcId } from './npcs';
import { drawTown } from './render';
import {
  DAYS,
  SLOTS_PER_DAY,
  activitiesFor,
  advanceDay,
  applyChoice,
  createLife,
  performActivity,
  type ActivityId,
  type LifeEvent,
  type LifeState,
  type Weather,
} from './simulation';

type ShellPhase = 'menu' | 'playing' | 'finished';

const MAX_DPR = 2;

const WEATHER_LABEL: Record<Weather, string> = {
  clear: 'Clear dusk',
  rain: 'Low rain',
  storm: 'Storm front',
};

interface PendingConversation {
  npcId: NpcId;
  choices: readonly ConversationChoice[];
}

function totalScore(life: LifeState): number {
  const bonds = Object.values(life.relationships).reduce((sum, value) => sum + value, 0);
  return life.jobProgress + life.community + bonds;
}

export default function RiftLifeGame({ onStart, onComplete }: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lifeRef = useRef<LifeState | null>(null);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const reduceRef = useRef(false);
  const [, refresh] = useReducer((value: number) => value + 1, 0);

  const [phase, setPhase] = useState<ShellPhase>('menu');
  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingConversation | null>(null);
  const [gallery, setGallery] = useState<EndingId[]>(() => readEndingGallery());
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    reduceRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current;
      const life = lifeRef.current;
      if (!canvas || !life) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round((rect.width || 720) * dpr));
      const height = Math.max(1, Math.round((rect.height || 400) * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      drawTown(context, canvas, { life, time: now }, { reducedMotion: reduceRef.current });
    };

    raf = requestAnimationFrame(frame);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pushEvents = useCallback((events: LifeEvent[]) => {
    if (events.length > 0) {
      setLog((current) => [...events.map((event) => event.message), ...current].slice(0, 8));
    }
    const conversation = events.find((event) => event.type === 'conversation' && event.choices);
    if (conversation?.npcId && conversation.choices) {
      setPending({ npcId: conversation.npcId, choices: conversation.choices });
    }
  }, []);

  const begin = useCallback((seed: number) => {
    finishedRef.current = false;
    const life = createLife(seed >>> 0);
    lifeRef.current = life;
    setPending(null);
    setLog([`Day 1. ${WEATHER_LABEL[life.weather]}. Twenty-one days ahead.`]);
    setPhase('playing');
    refresh();
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    begin(Date.now() >>> 0);
  }, [begin]);

  const backToMenu = useCallback(() => {
    lifeRef.current = null;
    setPending(null);
    setLog([]);
    setGallery(readEndingGallery());
    setPhase('menu');
    refresh();
  }, []);

  const runActivity = useCallback(
    (activity: ActivityId) => {
      const life = lifeRef.current;
      if (!life || phase !== 'playing') return;
      pushEvents(performActivity(life, activity));
      refresh();
    },
    [phase, pushEvents],
  );

  const chooseAnswer = useCallback(
    (index: number) => {
      const life = lifeRef.current;
      if (!life || !pending) return;
      const events = applyChoice(life, pending.npcId, index);
      setLog((current) => [...events.map((event) => event.message), ...current].slice(0, 8));
      setPending(null);
      refresh();
    },
    [pending],
  );

  const passTime = useCallback(() => {
    const life = lifeRef.current;
    if (!life || phase === 'menu') return;
    pushEvents(advanceDay(life));
    refresh();

    if (life.status === 'finished' && !finishedRef.current) {
      finishedRef.current = true;
      if (life.endingId) setGallery(saveEndingToGallery(life.endingId));
      setPending(null);
      setPhase('finished');
      onCompleteRef.current?.({ outcome: 'complete', score: totalScore(life) });
    }
  }, [phase, pushEvents]);

  const life = lifeRef.current;
  const options = life ? activitiesFor(life) : [];
  const day = life?.day ?? 1;
  const slot = life?.slot ?? 0;
  const daySpent = slot >= SLOTS_PER_DAY;
  const ending = life?.endingId ? endingById(life.endingId) : null;
  const conversation = pending ? npcById(pending.npcId) : null;

  const status =
    phase === 'menu' || !life
      ? `Rift Life. Twenty-one days in a small town. ${gallery.length} of ${ENDING_IDS.length} endings discovered.`
      : phase === 'finished' && ending
        ? `Day ${DAYS} complete. ${ending.title}. ${ending.description}`
        : `Day ${day} of ${DAYS}. ${SLOTS_PER_DAY - slot} time blocks left. Energy ${life.energy}. Job ${life.jobProgress}. Community ${life.community}.`;

  return (
    <GameFrame
      title="Rift Life"
      subtitle="Twenty-one days. Three blocks a day. One small town."
      icon={Users}
      accent="mint"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${day} / ${DAYS}`} tone="mint" />
          <GameStat label="Blocks" value={`${slot} / ${SLOTS_PER_DAY}`} />
          <GameStat label="Energy" value={life?.energy ?? 0} tone={(life?.energy ?? 0) < 20 ? 'coral' : 'ink'} />
          <GameStat label="Job" value={life?.jobProgress ?? 0} tone="electric" />
          <GameStat label="Community" value={life?.community ?? 0} tone="plasma" />
        </div>
      }
      toolbar={
        <>
          {phase !== 'menu' ? (
            <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart life" title="Restart life">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
          {phase !== 'menu' ? (
            <GameButton size="icon" variant="ghost" onClick={backToMenu} aria-label="Quit to menu" title="Quit to menu">
              <Home className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Kbd>Day</Kbd> {DAYS} days, {SLOTS_PER_DAY} blocks each
          </span>
          <span>One activity per block. Rest restores energy; the clock rolls the day.</span>
          <span>Every townsperson has a scene at 25 and an arc at 75.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-2">
            <div className="relative h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-night-950 sm:h-[380px]">
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Rift town" />
              {life ? (
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-night-950/90 to-transparent p-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-night-950/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                    <Sparkles className="h-3 w-3 text-mint" aria-hidden="true" />
                    {WEATHER_LABEL[life.weather]}
                  </span>
                  <span className="rounded-full border border-white/10 bg-night-950/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">
                    {life.flags.filter((flag) => flag.startsWith('scene:')).length} scenes unlocked
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-night-900/70 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
                <CalendarDays className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                <span className="truncate">
                  {phase === 'menu'
                    ? 'Start a life to open the planner.'
                    : daySpent
                      ? 'The day is spent. Roll to tomorrow.'
                      : `${SLOTS_PER_DAY - slot} time block${SLOTS_PER_DAY - slot === 1 ? '' : 's'} left today.`}
                </span>
              </div>
              <GameButton variant="secondary" size="sm" onClick={passTime} disabled={phase !== 'playing'}>
                {daySpent ? 'Next day' : 'Pass time'}
              </GameButton>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Journal</p>
              <ul className="mt-1 space-y-0.5 text-[11px] leading-5 text-ink">
                {log.length === 0 ? (
                  <li className="text-muted">The page is blank.</li>
                ) : (
                  log.map((entry, index) => (
                    <li key={`${index}-${entry}`} className={index === 0 ? 'text-white' : 'text-muted'}>
                      {entry}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Zap className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Planner
              </p>
              <div className="mt-2 space-y-1.5">
                {options.map((option) => {
                  const npc = option.id !== 'work' && option.id !== 'rest' && option.id !== 'community'
                    ? npcById(option.id)
                    : null;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-label={option.label}
                      disabled={!option.available}
                      title={option.reason ?? option.description}
                      onClick={() => runActivity(option.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] transition',
                        option.available
                          ? 'border-white/10 bg-white/[0.04] hover:border-mint/40 hover:bg-mint/5'
                          : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-muted opacity-60',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                          {npc ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: npc.color }}
                              aria-hidden="true"
                            />
                          ) : null}
                          {option.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted">{option.description}</span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-plasma-300">
                        {option.energyCost === 0 ? 'free' : `-${option.energyCost}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Heart className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
                Bonds
              </p>
              <ul className="mt-2 space-y-1">
                {NPCS.map((npc) => {
                  const bond = life?.relationships[npc.id] ?? 0;
                  return (
                    <li key={npc.id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: npc.color }}
                        aria-hidden="true"
                      />
                      <span className="w-20 shrink-0 truncate text-ink">{npc.name}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-mint to-plasma-400"
                          style={{ width: `${bond}%` }}
                        />
                      </span>
                      <span className="w-7 shrink-0 text-right tabular-nums text-muted">{bond}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {phase === 'menu' ? (
          <GameOverlay
            className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
            label="Rift Life"
          >
            <div className="mx-auto w-full max-w-2xl space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                  NeonRift Arcade · Roleplay
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  Twenty-one days. <span className="text-gradient">One life to spend.</span>
                </h3>
                <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                  Three time blocks a day. Work the rig, help the town, or sit with one of five people
                  who each carry a story. Energy limits how much you can do; the weather changes what
                  the days cost. Day twenty-one resolves your ending.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GameButton variant="primary" onClick={restart}>
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Start the 21 days
                </GameButton>
                <span className="text-[11px] text-muted">
                  Endings found: {gallery.length} / {ENDING_IDS.length}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {NPCS.map((npc) => (
                  <div key={npc.id} className="rounded-2xl border border-white/10 bg-night-900/70 px-3 py-2">
                    <p className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: npc.color }} aria-hidden="true" />
                      {npc.name}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">{npc.role}</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted">{npc.tagline}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-white/10 bg-night-900/70 px-3 py-2 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Ending gallery</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {ENDING_IDS.map((id) => {
                      const found = gallery.includes(id);
                      return (
                        <span
                          key={id}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px]',
                            found ? 'border-mint/40 bg-mint/10 text-mint' : 'border-white/10 text-muted',
                          )}
                        >
                          {found ? endingById(id).title : '???'}
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {pending && conversation && phase === 'playing' ? (
          <GameOverlay label={`Talking with ${conversation.name}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              {conversation.role} · bond {life?.relationships[conversation.id] ?? 0}
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">{conversation.name}</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">{conversation.choices[0]?.reply}</p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {conversation.choices.map((choice, index) => (
                <button
                  key={choice.label}
                  type="button"
                  aria-label={`Choice: ${choice.label}`}
                  onClick={() => chooseAnswer(index)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-ink transition hover:border-mint/40 hover:bg-mint/5"
                >
                  <span className="block font-semibold">{choice.label}</span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    bond {choice.relationship >= 0 ? '+' : ''}
                    {choice.relationship} · community +{choice.community} · energy{' '}
                    {choice.energy >= 0 ? '+' : ''}
                    {choice.energy}
                  </span>
                </button>
              ))}
              <GameButton variant="ghost" size="sm" onClick={() => setPending(null)}>
                Step away
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'finished' && ending && life ? (
          <GameOverlay tone="win" className="items-stretch justify-start overflow-y-auto text-left sm:justify-center" label="Your ending">
            <div className="mx-auto w-full max-w-xl space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">Day 21 · Ending</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">{ending.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted">{ending.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <GameStat label="Job" value={life.jobProgress} tone="electric" />
                <GameStat label="Community" value={life.community} tone="plasma" />
                <GameStat label="Energy" value={life.energy} />
                <GameStat
                  label="Bonds"
                  value={Object.values(life.relationships).reduce((sum, value) => sum + value, 0)}
                  tone="mint"
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Ending gallery · {gallery.length} / {ENDING_IDS.length}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {ENDING_IDS.map((id) => {
                    const found = gallery.includes(id);
                    return (
                      <span
                        key={id}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px]',
                          found ? 'border-mint/40 bg-mint/10 text-mint' : 'border-white/10 text-muted',
                        )}
                      >
                        {found ? endingById(id).title : '???'}
                      </span>
                    );
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <GameButton variant="primary" onClick={restart}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Start again
                </GameButton>
                <GameButton variant="secondary" onClick={backToMenu}>
                  Back to menu
                </GameButton>
              </div>
            </div>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
