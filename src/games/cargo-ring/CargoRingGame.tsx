import {
  Fuel,
  Gauge,
  PackageCheck,
  Pause,
  Play,
  RotateCcw,
  Route,
  Truck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  CARGO_DAYS,
  CARGO_ROUTE_ORDER,
  CARGO_ROUTES,
  CARGO_TARGET,
  assignTruck,
  advanceCargoDay,
  buyTruck,
  cargoDemand,
  cargoTrucks,
  createCargoState,
  cycleCargoSpeed,
  recallTruck,
  startCargo,
  toggleCargoPause,
  upgradeContracts,
  upgradeFuel,
  type CargoState,
} from './simulation';

const BEST_KEY = 'neonrift:game:cargo-ring:best';
const DAY_MS = 3000;

export default function CargoRingGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<CargoState>(createCargoState);
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
    onTick: () => setState((current) => advanceCargoDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= CARGO_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startCargo(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createCargoState());
  }, []);

  const trucks = cargoTrucks(state);
  const win = state.credits >= CARGO_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Depot ready. Assign trucks and open the contracts.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalHauled} crates hauled.`
        : `Day ${state.day} of ${CARGO_DAYS}. ${trucks} trucks active, ${state.reserve} in reserve.`;

  return (
    <GameFrame
      title="Cargo Ring"
      subtitle="Fill the contracts. Keep the fleet rolling."
      icon={Truck}
      accent="mint"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${CARGO_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Trucks" value={`${trucks} + ${state.reserve}`} tone="electric" />
          <GameStat label="Contracts" value={`${state.contractLevel}/3`} />
          <GameStat label="Fuel" value={`${state.fuelLevel}/3`} tone="plasma" />
          <GameStat label="Crates" value={state.totalHauled} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleCargoPause(current))}
              aria-label={state.paused ? 'Resume depot' : 'Pause depot'}
              title={state.paused ? 'Resume depot' : 'Pause depot'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleCargoSpeed(current))}
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
          <span>Every truck carries 12 crates and costs 22 credits per day.</span>
          <span>Best run: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {CARGO_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-3">
            {CARGO_ROUTE_ORDER.map((id) => {
              const spec = CARGO_ROUTES[id];
              const route = state.routes[id];
              const demand = cargoDemand(state, id);
              return (
                <section key={id} aria-label={spec.name} className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted/70">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: spec.color }} />
                        Contract
                      </p>
                      <h3 className="mt-0.5 font-display text-sm font-semibold text-ink">{spec.name}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-ink">
                      {route.trucks} trucks
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <p className="text-muted/70">Demand</p>
                      <p className="font-display text-sm font-semibold text-ink">{demand}</p>
                    </div>
                    <div>
                      <p className="text-muted/70">Hauled</p>
                      <p className="font-display text-sm font-semibold text-ink">{route.hauled}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((route.hauled / Math.max(1, demand)) * 100))}%`,
                        backgroundColor: spec.color,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => recallTruck(current, id))}
                      disabled={route.trucks <= 0}
                      aria-label={`Recall a truck from ${spec.name}`}
                    >
                      −
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => assignTruck(current, id))}
                      disabled={state.reserve <= 0}
                      aria-label={`Assign a reserve truck to ${spec.name}`}
                    >
                      +
                    </GameButton>
                    <span className="ml-auto text-[10px] text-muted">{route.trucks * 12} crates</span>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <section aria-label="Depot upgrades" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Depot</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <GameButton
                  size="sm"
                  variant="secondary"
                  disabled={state.credits < 110 || state.phase !== 'running'}
                  onClick={() => setState((current) => buyTruck(current))}
                  aria-label="Buy a truck for 110 credits"
                >
                  <Truck className="h-3 w-3" aria-hidden="true" />
                  Truck · 110c
                </GameButton>
                <GameButton
                  size="sm"
                  variant="secondary"
                  disabled={state.contractLevel >= 3 || state.credits < 95 || state.phase !== 'running'}
                  onClick={() => setState((current) => upgradeContracts(current))}
                  aria-label="Upgrade contracts for 95 credits"
                >
                  <Route className="h-3 w-3" aria-hidden="true" />
                  Contracts · 95c
                </GameButton>
                <GameButton
                  size="sm"
                  variant="secondary"
                  disabled={state.fuelLevel >= 3 || state.credits < 85 || state.phase !== 'running'}
                  onClick={() => setState((current) => upgradeFuel(current))}
                  aria-label="Improve fuel efficiency for 85 credits"
                >
                  <Fuel className="h-3 w-3" aria-hidden="true" />
                  Fuel · 85c
                </GameButton>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted">
                Bought trucks wait in reserve — assign each one for 12 crates of capacity. Contracts
                raise demand. Fuel improvements raise the rate per crate.
              </p>
            </section>

            <section aria-label="Depot log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Depot log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <PackageCheck className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">
              20-day season · {CARGO_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A freight depot with three hungry lanes</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Six trucks already run the inner, outer and deep contracts. Demand moves every day —
              buy spare trucks and assign them to the busiest lane before it leaves crates on the
              dock.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Open depot
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Depot paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">Trucks are holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleCargoPause(current))}>
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
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-mint">
              <Truck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Depot in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalHauled}{' '}
              crates hauled.
            </p>
            <p className="text-[11px] text-muted">
              Target: {CARGO_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Haul again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Truck aria-hidden="true" /> {trucks} trucks active, {state.reserve} in reserve.
      </span>
    </GameFrame>
  );
}
