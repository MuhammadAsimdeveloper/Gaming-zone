import {
  Gauge,
  Pause,
  Plane,
  Play,
  Radar,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  SKYPORT_DAYS,
  SKYPORT_TARGET,
  advanceSkyportDay,
  createSkyportState,
  cycleSkyportSpeed,
  flightDemand,
  hireCrew,
  openGate,
  openRunway,
  slotCapacity,
  startSkyport,
  toggleSkyportPause,
  type SkyportState,
} from './simulation';

const BEST_KEY = 'neonrift:game:skyport:best';
const DAY_MS = 3000;

export default function SkyportGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<SkyportState>(createSkyportState);
  const { best, submit } = useBestScore(BEST_KEY);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useSimulationClock({
    active: state.phase === 'running' && !state.paused,
    intervalMs: state.speed === 2 ? DAY_MS / 2 : DAY_MS,
    onTick: () => setState((current) => advanceSkyportDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= SKYPORT_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startSkyport(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createSkyportState());
  }, []);

  const capacity = slotCapacity(state);
  const inbound = flightDemand(state.day);
  const win = state.credits >= SKYPORT_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Skyport ready. Open capacity, then start the control tower.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalHandled} flights handled.`
        : `Day ${state.day} of ${SKYPORT_DAYS}. ${inbound} flights inbound, ${capacity} slots available.`;

  return (
    <GameFrame
      title="Skyport"
      subtitle="Every slot counts. Every delay shows."
      icon={Plane}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${SKYPORT_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Gates" value={state.gates} tone="electric" />
          <GameStat label="Runways" value={state.runways} tone="plasma" />
          <GameStat label="Crew" value={state.staff} />
          <GameStat label="Slots" value={`${capacity}`} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleSkyportPause(current))}
              aria-label={state.paused ? 'Resume tower' : 'Pause tower'}
              title={state.paused ? 'Resume tower' : 'Pause tower'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleSkyportSpeed(current))}
            aria-label={`Simulation speed ${state.speed}x`}
            title="Change simulation speed"
          >
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            {state.speed}x
          </GameButton>
          <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart season" title="Restart season">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Capacity = min(gates × 4, runways × 6, crew × 3).</span>
          <span>Best tower: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {SKYPORT_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                key: 'gates',
                label: 'Gates',
                value: state.gates,
                max: 5,
                cost: 100,
                detail: '+4 slots · 30c/day',
                icon: Plane,
                action: openGate,
                aria: 'Open another gate for 100 credits',
              },
              {
                key: 'runways',
                label: 'Runways',
                value: state.runways,
                max: 3,
                cost: 160,
                detail: '+6 slots · 60c/day',
                icon: Radar,
                action: openRunway,
                aria: 'Open a second runway for 160 credits',
              },
              {
                key: 'staff',
                label: 'Ground crew',
                value: state.staff,
                max: 10,
                cost: 45,
                detail: '+3 slots · 20c/day',
                icon: Users,
                action: hireCrew,
                aria: 'Hire another crew member for 45 credits',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <section key={item.key} aria-label={item.label} className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-electric-300">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{item.label}</h3>
                      <p className="text-[10px] text-muted">{item.detail}</p>
                    </div>
                    <span className="ml-auto font-display text-xl font-semibold text-ink">{item.value}</span>
                  </div>
                  <GameButton
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full"
                    disabled={item.value >= item.max || state.credits < item.cost || state.phase !== 'running'}
                    onClick={() => setState((current) => item.action(current))}
                    aria-label={item.aria}
                  >
                    {item.value >= item.max ? 'Max capacity' : `Expand · ${item.cost}c`}
                  </GameButton>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Traffic forecast" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Inbound today</p>
                  <p className="font-display text-2xl font-semibold text-ink">{inbound} flights</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Slots online {capacity}</p>
                  <p className={cn('text-sm font-semibold', inbound > capacity ? 'text-coral' : 'text-mint')}>
                    {inbound > capacity ? `${inbound - capacity} will divert` : `${capacity - inbound} spare`}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-8 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-electric-500 to-plasma-500"
                  style={{ width: `${Math.min(100, (capacity / 16) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Yesterday: {state.handled} handled, {state.missed} diverted. Total handled {state.totalHandled}.
              </p>
            </section>

            <section aria-label="Control log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Control log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Radar className="mt-0.5 h-3 w-3 shrink-0 text-electric-300" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-electric-300">
              20-day season · {SKYPORT_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Run a compact orbital skyport</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Gates, runways and ground crew each cap how many flights you can turn around. Expand
              before the inbound wave outgrows your slots.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start tower
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Tower paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">Traffic is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleSkyportPause(current))}>
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Resume
              </GameButton>
              <GameButton variant="secondary" onClick={restart}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restart
              </GameButton>
            </div>
          </GameOverlay>
        ) : null}

        {state.phase === 'over' ? (
          <GameOverlay tone={win ? 'win' : 'loss'}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-electric-500/10 text-electric-300">
              <Plane className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Skyport in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalHandled}{' '}
              flights handled.
            </p>
            <p className="text-[11px] text-muted">
              Target: {SKYPORT_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Fly again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Radar aria-hidden="true" /> {inbound} flights inbound, {capacity} slots online.
      </span>
    </GameFrame>
  );
}
