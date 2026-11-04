import {
  CircleDollarSign,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  PARK_DAYS,
  PARK_TARGET,
  adjustTicket,
  advanceParkDay,
  buildRide,
  createParkState,
  cycleParkSpeed,
  hireParkStaff,
  parkCapacity,
  parkDemand,
  runCampaign,
  startPark,
  toggleParkPause,
  type ParkState,
} from './simulation';

const BEST_KEY = 'neonrift:game:park-pulse:best';
const DAY_MS = 3000;

export default function ParkPulseGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<ParkState>(createParkState);
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
    onTick: () => setState((current) => advanceParkDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= PARK_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startPark(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createParkState());
  }, []);

  const capacity = parkCapacity(state);
  const visitors = parkDemand(state);
  const win = state.credits >= PARK_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Park ready. Set the ticket price and open the gates.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalVisitors} visitors.`
        : `Day ${state.day} of ${PARK_DAYS}. ${visitors} visitors expected, ${capacity} ride capacity.`;

  return (
    <GameFrame
      title="Park Pulse"
      subtitle="Price the day. Keep the queues moving."
      icon={Sparkles}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${PARK_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Reputation" value={`${state.reputation}%`} tone={state.reputation < 50 ? 'coral' : 'mint'} />
          <GameStat label="Ticket" value={`${state.ticket}c`} tone="electric" />
          <GameStat label="Rides" value={state.rides} tone="plasma" />
          <GameStat label="Staff" value={state.staff} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleParkPause(current))}
              aria-label={state.paused ? 'Resume park' : 'Pause park'}
              title={state.paused ? 'Resume park' : 'Pause park'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleParkSpeed(current))}
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
          <span>Visitors spend an extra 6 credits on food and games.</span>
          <span>Best season: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {PARK_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Ticket pricing" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <Ticket className="h-3 w-3 text-plasma-300" aria-hidden="true" />
                  Day ticket
                </h3>
                <span className="text-[10px] text-muted">Forecast {visitors} · capacity {capacity}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-display text-4xl font-semibold text-ink">{state.ticket}<span className="text-lg text-muted">c</span></p>
                <div className="flex gap-1.5">
                  <GameButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setState((current) => adjustTicket(current, -2))}
                    disabled={state.phase !== 'running' || state.ticket <= 8}
                    aria-label="Lower ticket price by 2 credits"
                  >
                    −2
                  </GameButton>
                  <GameButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setState((current) => adjustTicket(current, 2))}
                    disabled={state.phase !== 'running' || state.ticket >= 45}
                    aria-label="Raise ticket price by 2 credits"
                  >
                    +2
                  </GameButton>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-plasma-500 to-mint" style={{ width: `${Math.min(100, (visitors / Math.max(1, capacity)) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Higher prices raise revenue per visitor but reduce demand. Yesterday: {state.served} served.
              </p>
            </section>

            <section aria-label="Park upgrades" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Midway</h3>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-plasma-300">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-ink">Build a ride · {state.rides}</span>
                    <span className="block text-[10px] text-muted">+32 capacity · 55c/day</span>
                  </span>
                  <GameButton
                    size="sm"
                    variant="secondary"
                    disabled={state.rides >= 10 || state.credits < 140 || state.phase !== 'running'}
                    onClick={() => setState((current) => buildRide(current))}
                    aria-label="Build a new ride for 140 credits"
                  >
                    140c
                  </GameButton>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-mint">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-ink">Hire attendant · {state.staff}</span>
                    <span className="block text-[10px] text-muted">+6 capacity · 22c/day</span>
                  </span>
                  <GameButton
                    size="sm"
                    variant="secondary"
                    disabled={state.staff >= 16 || state.credits < 50 || state.phase !== 'running'}
                    onClick={() => setState((current) => hireParkStaff(current))}
                    aria-label="Hire a park attendant for 50 credits"
                  >
                    50c
                  </GameButton>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-electric-300">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-ink">Marketing campaign · {state.marketing}</span>
                    <span className="block text-[10px] text-muted">+18 demand · 90c</span>
                  </span>
                  <GameButton
                    size="sm"
                    variant="secondary"
                    disabled={state.marketing >= 3 || state.credits < 90 || state.phase !== 'running'}
                    onClick={() => setState((current) => runCampaign(current))}
                    aria-label="Run a marketing campaign for 90 credits"
                  >
                    90c
                  </GameButton>
                </div>
              </div>
            </section>
          </div>

          <section aria-label="Park log" className="mt-3 rounded-2xl border border-white/10 bg-night-900/70 p-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Park log</h3>
            <ul className="mt-1.5 space-y-1 text-[10px] leading-4 text-muted">
              {state.log.map((entry, index) => (
                <li key={`${entry}-${index}`} className="flex gap-2">
                  <CircleDollarSign className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              20-day season · {PARK_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A neon park with a queue problem</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Set the ticket, balance ride capacity against staff, and keep the midway busy without
              letting queues ruin your reputation.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Open park
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Park paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The queues are holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleParkPause(current))}>
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
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-plasma-500/10 text-plasma-300">
              <Sparkles className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Park in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalVisitors}{' '}
              visitors.
            </p>
            <p className="text-[11px] text-muted">
              Target: {PARK_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reopen
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Sparkles aria-hidden="true" /> Ticket {state.ticket} credits; {visitors} visitors expected;{' '}
        {capacity} ride capacity.
      </span>
    </GameFrame>
  );
}
