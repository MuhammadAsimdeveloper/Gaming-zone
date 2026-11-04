import {
  ChefHat,
  CircleDollarSign,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Star,
  Users,
  Utensils,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  DINER_DAYS,
  DINER_TARGET,
  MENU,
  MENU_ORDER,
  addTables,
  adjustPrice,
  advanceDinerDay,
  averagePrice,
  createDinerState,
  customerDemand,
  cycleDinerSpeed,
  hireStaff,
  seatCapacity,
  startDiner,
  toggleDinerPause,
  type DinerState,
} from './simulation';

const BEST_KEY = 'neonrift:game:neon-diner:best';
const DAY_MS = 3200;

export default function NeonDinerGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<DinerState>(createDinerState);
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
    onTick: () => setState((current) => advanceDinerDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= DINER_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startDiner(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createDinerState());
  }, []);

  const capacity = seatCapacity(state);
  const demand = customerDemand(state);
  const average = averagePrice(state);
  const win = state.credits >= DINER_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Diner ready. Set prices and start the service.'
      : state.phase === 'over'
        ? `Service complete with ${state.credits} credits and ${state.totalServed} covers.`
        : `Day ${state.day} of ${DINER_DAYS}. Forecast ${demand} covers, ${capacity} seats. Reputation ${state.reputation} percent.`;

  return (
    <GameFrame
      title="Neon Diner"
      subtitle="Set the menu. Fill the floor."
      icon={ChefHat}
      accent="coral"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${state.day} / ${DINER_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Reputation" value={`${state.reputation}%`} tone={state.reputation < 50 ? 'coral' : 'mint'} />
          <GameStat label="Staff" value={state.staff} tone="electric" />
          <GameStat label="Tables" value={state.tables} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleDinerPause(current))}
              aria-label={state.paused ? 'Resume service' : 'Pause service'}
              title={state.paused ? 'Resume service' : 'Pause service'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleDinerSpeed(current))}
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
          <span>Seats: {capacity} · average menu price {average.toFixed(1)}c.</span>
          <span>Best service: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {DINER_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <section aria-label="Menu pricing" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <Utensils className="h-3 w-3 text-coral" aria-hidden="true" />
                  Menu
                </h3>
                <span className="text-[10px] text-muted">Forecast {demand} covers · {capacity} seats</span>
              </div>

              <div className="mt-2 space-y-2">
                {MENU_ORDER.map((id) => {
                  const item = MENU[id];
                  const price = state.prices[id];
                  return (
                    <div key={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </span>
                        <span className="font-display text-sm font-semibold text-ink">{price}c</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <GameButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setState((current) => adjustPrice(current, id, -1))}
                          disabled={state.phase !== 'running' || price <= item.cost + 1}
                          aria-label={`Lower ${item.name} price by 1 credit`}
                        >
                          −1
                        </GameButton>
                        <GameButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setState((current) => adjustPrice(current, id, 1))}
                          disabled={state.phase !== 'running' || price >= 25}
                          aria-label={`Raise ${item.name} price by 1 credit`}
                        >
                          +1
                        </GameButton>
                        <GameButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setState((current) => adjustPrice(current, id, 2))}
                          disabled={state.phase !== 'running' || price >= 24}
                          aria-label={`Raise ${item.name} price by 2 credits`}
                        >
                          +2
                        </GameButton>
                        <span className="ml-auto text-[10px] text-muted">Ingredient {item.cost}c</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="space-y-3">
              <section aria-label="Diner upgrades" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Floor plan</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-electric-300">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-ink">Hire a server · {state.staff}</span>
                      <span className="block text-[10px] text-muted">+5 seats per service day.</span>
                    </span>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      disabled={state.staff >= 7 || state.credits < 80 || state.phase !== 'running'}
                      onClick={() => setState((current) => hireStaff(current))}
                      aria-label="Hire a server for 80 credits"
                    >
                      80c
                    </GameButton>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5 text-coral">
                      <Utensils className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium text-ink">Add tables · {state.tables}</span>
                      <span className="block text-[10px] text-muted">+8 seats per service day.</span>
                    </span>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      disabled={state.tables >= 14 || state.credits < 70 || state.phase !== 'running'}
                      onClick={() => setState((current) => addTables(current))}
                      aria-label="Add two tables for 70 credits"
                    >
                      70c
                    </GameButton>
                  </div>
                </div>
              </section>

              <section aria-label="Service log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Service log</h3>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                  {state.log.map((entry, index) => (
                    <li key={`${entry}-${index}`} className="flex gap-2">
                      <Star className="mt-0.5 h-3 w-3 shrink-0 text-coral" aria-hidden="true" />
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[10px] text-muted">
                  <span>Yesterday: {state.served} covers</span>
                  <span className="text-mint">{state.revenue}c revenue</span>
                </div>
              </section>
            </div>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">
              20-day season · {DINER_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A tiny diner with a big queue</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Raise prices to earn more per cover, but keep demand inside your seats. Hire servers,
              add tables, and protect your reputation during the lunch rush.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Open diner
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Service paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The kitchen is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleDinerPause(current))}>
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
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-coral/10 text-coral">
              <ChefHat className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Diner in profit' : 'Service closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalServed}{' '}
              covers served.
            </p>
            <p className="text-[11px] text-muted">
              Target: {DINER_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Open again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <CircleDollarSign aria-hidden="true" /> Average price {average.toFixed(1)} credits; reputation{' '}
        {state.reputation} percent; seats {capacity}.
      </span>
    </GameFrame>
  );
}
