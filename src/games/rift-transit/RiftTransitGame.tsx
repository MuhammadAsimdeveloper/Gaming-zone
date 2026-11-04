import {
  ArrowLeftRight,
  Bus,
  CircleDollarSign,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Route,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  TRANSIT_DAYS,
  TRANSIT_ROUTE_ORDER,
  TRANSIT_ROUTES,
  TRANSIT_TARGET,
  TRANSIT_UPGRADES,
  TRANSIT_UPGRADE_ORDER,
  advanceTransitDay,
  assignBus,
  averageSatisfaction,
  buyTransitUpgrade,
  busCapacity,
  createTransitState,
  cycleTransitSpeed,
  fare,
  recallBus,
  routeDemand,
  startTransit,
  toggleTransitPause,
  totalBuses,
  type TransitState,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-transit:best';
const DAY_MS = 3000;

export default function RiftTransitGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<TransitState>(createTransitState);
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
    onTick: () => setState((current) => advanceTransitDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= TRANSIT_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startTransit(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createTransitState());
  }, []);

  const win = state.credits >= TRANSIT_TARGET;
  const buses = totalBuses(state);
  const satisfaction = averageSatisfaction(state);
  const capacity = busCapacity(state);
  const price = fare(state);
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Transit dispatch ready. Start the season to open the network.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalServed} passengers.`
        : `Day ${state.day} of ${TRANSIT_DAYS}. ${state.credits} credits. ${Math.round(satisfaction * 100)} percent ridership served.`;

  return (
    <GameFrame
      title="Rift Transit"
      subtitle="Move the city. Keep the lines moving."
      icon={Bus}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${state.day} / ${TRANSIT_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Buses" value={`${buses} + ${state.reserve}`} tone="electric" />
          <GameStat label="Fare" value={`${price.toFixed(2)}c`} />
          <GameStat label="Service" value={`${Math.round(satisfaction * 100)}%`} tone={satisfaction < 0.6 ? 'coral' : 'mint'} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleTransitPause(current))}
              aria-label={state.paused ? 'Resume service' : 'Pause service'}
              title={state.paused ? 'Resume service' : 'Pause service'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleTransitSpeed(current))}
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
          <span>Each bus carries {capacity} passengers; operations cost 22 credits per bus per day.</span>
          <span>Best season: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {TRANSIT_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-3">
            {TRANSIT_ROUTE_ORDER.map((id) => {
              const spec = TRANSIT_ROUTES[id];
              const route = state.routes[id];
              const forecast = routeDemand(state, id);
              return (
                <section
                  key={id}
                  aria-label={spec.name}
                  className="rounded-2xl border border-white/10 bg-night-900/75 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted/70">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: spec.color }} />
                        Route
                      </p>
                      <h3 className="mt-0.5 font-display text-sm font-semibold text-ink">{spec.name}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-ink">
                      {route.buses} buses
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <p className="text-muted/70">Forecast</p>
                      <p className="font-display text-sm font-semibold text-ink">{forecast}</p>
                    </div>
                    <div>
                      <p className="text-muted/70">Served yesterday</p>
                      <p className="font-display text-sm font-semibold text-ink">{route.served}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-muted">
                      <span>Service level</span>
                      <span className="text-ink">{Math.round(route.satisfaction * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          route.satisfaction < 0.6 ? 'bg-coral' : 'bg-mint',
                        )}
                        style={{ width: `${Math.round(route.satisfaction * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => recallBus(current, id))}
                      disabled={route.buses <= 0}
                      aria-label={`Recall a bus from ${spec.name}`}
                    >
                      −
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => assignBus(current, id))}
                      disabled={state.reserve <= 0}
                      aria-label={`Assign a reserve bus to ${spec.name}`}
                    >
                      +
                    </GameButton>
                    <span className="ml-auto text-[10px] text-muted">
                      {route.buses * capacity} seats
                    </span>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <section aria-label="Transit upgrades" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Network upgrades</h3>
              <div className="mt-2 space-y-2">
                {TRANSIT_UPGRADE_ORDER.map((id) => {
                  const spec = TRANSIT_UPGRADES[id];
                  const level = id === 'fleet' ? state.fleetLevel : id === 'marketing' ? state.marketingLevel : state.fareLevel;
                  const full = level >= spec.max;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-electric-300">
                        {id === 'fleet' ? (
                          <Bus className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : id === 'marketing' ? (
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-ink">
                          {spec.name} · {level}/{spec.max}
                        </span>
                        <span className="block truncate text-[10px] text-muted">{spec.description}</span>
                      </span>
                      <GameButton
                        size="sm"
                        variant="secondary"
                        disabled={full || state.credits < spec.cost || state.phase !== 'running'}
                        onClick={() => setState((current) => buyTransitUpgrade(current, id))}
                        aria-label={`Upgrade ${spec.name} for ${spec.cost} credits`}
                      >
                        {full ? 'Max' : `${spec.cost}c`}
                      </GameButton>
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-label="Dispatch log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Dispatch log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <ArrowLeftRight className="mt-0.5 h-3 w-3 shrink-0 text-electric-300" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[10px] text-muted">
                <Route className="h-3.5 w-3.5 text-plasma-300" aria-hidden="true" />
                {state.reserve > 0
                  ? `${state.reserve} reserve bus${state.reserve === 1 ? '' : 'es'} ready to assign.`
                  : 'No reserve buses. Buy a fleet depot to add two.'}
              </div>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-electric-300">
              20-day season · {TRANSIT_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Run the rift's night bus network</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Assign buses to three lines, watch the rush-hour curve, and upgrade the fleet before
              service levels collapse. Every bus costs credits to run.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start service
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Service paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The depot is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleTransitPause(current))}>
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
              <Bus className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Network in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalServed}{' '}
              passengers carried.
            </p>
            <p className="text-[11px] text-muted">
              Target: {TRANSIT_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Run again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Gauge aria-hidden="true" /> Fleet {buses} buses plus {state.reserve} reserve; fare {price.toFixed(2)} credits.
      </span>
    </GameFrame>
  );
}
