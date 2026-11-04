import {
  ArrowRight,
  Coins,
  Fuel,
  Package,
  Play,
  RotateCcw,
  Rocket,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import {
  GOODS,
  GOOD_ORDER,
  MARKET_CARGO,
  MARKET_DAYS,
  MARKET_FUEL_COST,
  MARKET_FUEL_MAX,
  MARKET_TARGET,
  MARKET_TRAVEL_FUEL,
  STATIONS,
  STATION_ORDER,
  bestSale,
  buyGood,
  cargoUsed,
  createMarketState,
  refuel,
  sellGood,
  startMarket,
  travelTo,
  type MarketState,
} from './simulation';

const BEST_KEY = 'neonrift:game:orbit-market:best';

export default function OrbitMarketGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<MarketState>(createMarketState);
  const { best, submit } = useBestScore(BEST_KEY);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= MARKET_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startMarket(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createMarketState());
  }, []);

  const station = STATIONS[state.station];
  const used = cargoUsed(state);
  const hint = bestSale(state);
  const win = state.credits >= MARKET_TARGET;
  const overlayOpen = state.phase !== 'running';
  const status =
    state.phase === 'ready'
      ? 'Market ready. Start trading to unlock the exchange.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits.`
        : `Day ${state.day} of ${MARKET_DAYS} at ${station.name}. ${state.credits} credits, ${used} of ${MARKET_CARGO} cargo, ${state.fuel} fuel.`;

  return (
    <GameFrame
      title="Orbit Market"
      subtitle="Buy low. Jump far. Sell high."
      icon={Rocket}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${state.day} / ${MARKET_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Fuel" value={`${state.fuel} / ${MARKET_FUEL_MAX}`} tone="electric" />
          <GameStat label="Cargo" value={`${used} / ${MARKET_CARGO}`} />
          <GameStat label="Dock" value={station.name.split(' ')[0]} />
        </div>
      }
      toolbar={
        <>
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => refuel(current))}
            disabled={state.phase !== 'running' || state.fuel >= MARKET_FUEL_MAX || state.credits < MARKET_FUEL_COST}
            aria-label={`Refuel for ${MARKET_FUEL_COST} credits`}
            title="Refuel"
          >
            <Fuel className="h-3.5 w-3.5" aria-hidden="true" />
            Refuel
          </GameButton>
          <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart season" title="Restart season">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Every jump costs {MARKET_TRAVEL_FUEL} fuel and advances one day.</span>
          <span>Best run: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {MARKET_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <section aria-label="Station market" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-plasma-300">
                    Current dock
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-ink">{station.name}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">{station.blurb}</p>
                </div>
                {hint ? (
                  <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 text-[10px] font-medium text-mint">
                    Best sale: {GOODS[hint.good].name} {hint.price}c
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {GOOD_ORDER.map((good) => {
                  const spec = GOODS[good];
                  const price = state.prices[state.station][good];
                  return (
                    <div key={good} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: spec.color }} />
                          {spec.name}
                        </span>
                        <span className="font-display text-sm font-semibold text-ink">{price}c</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <GameButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setState((current) => buyGood(current, good, 1))}
                          disabled={state.phase !== 'running' || state.credits < price || used >= MARKET_CARGO}
                          aria-label={`Buy 1 ${spec.name} for ${price} credits`}
                        >
                          <ShoppingCart className="h-3 w-3" aria-hidden="true" />
                          Buy 1
                        </GameButton>
                        <GameButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setState((current) => buyGood(current, good, 5))}
                          disabled={state.phase !== 'running' || state.credits < price || used >= MARKET_CARGO}
                          aria-label={`Buy 5 ${spec.name}`}
                        >
                          Buy 5
                        </GameButton>
                        <GameButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setState((current) => sellGood(current, good, 1))}
                          disabled={state.phase !== 'running' || state.cargo[good] < 1}
                          aria-label={`Sell 1 ${spec.name} for ${price} credits`}
                        >
                          Sell 1
                        </GameButton>
                        <GameButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setState((current) => sellGood(current, good, 5))}
                          disabled={state.phase !== 'running' || state.cargo[good] < 1}
                          aria-label={`Sell 5 ${spec.name}`}
                        >
                          Sell 5
                        </GameButton>
                        <span className="ml-auto text-[10px] text-muted">Hold {state.cargo[good]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="space-y-3">
              <section aria-label="Jump routes" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Jump routes</h3>
                <div className="mt-2 space-y-2">
                  {STATION_ORDER.filter((id) => id !== state.station).map((id) => {
                    const target = STATIONS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setState((current) => travelTo(current, id))}
                        disabled={state.phase !== 'running' || state.fuel < MARKET_TRAVEL_FUEL}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-plasma-400/40 hover:bg-plasma-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>
                          <span className="block text-xs font-medium text-ink">{target.name}</span>
                          <span className="block text-[10px] text-muted">{target.blurb}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-plasma-300">
                          {MARKET_TRAVEL_FUEL} fuel
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-label="Cargo hold" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  <Package className="h-3 w-3 text-mint" aria-hidden="true" />
                  Cargo hold
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {GOOD_ORDER.map((good) => (
                    <div key={good} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-muted">{GOODS[good].name}</p>
                      <p className="font-display text-sm font-semibold text-ink">{state.cargo[good]}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  {MARKET_CARGO - used} slots free · {state.fuel} fuel aboard
                </p>
              </section>
            </div>
          </div>

          <section aria-label="Trade log" className="mt-3 rounded-2xl border border-white/10 bg-night-900/70 p-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Trade log</h3>
            <ul className="mt-1.5 space-y-1 text-[10px] leading-4 text-muted">
              {state.log.map((entry, index) => (
                <li key={`${entry}-${index}`} className="truncate">
                  · {entry}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              20 jumps · {MARKET_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A trader's loop through four docks</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Prices shift every jump. Buy where a good is cheap, carry eight units, and sell at the
              next dock before the trading window closes.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start trading
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'over' ? (
          <GameOverlay tone={win ? 'win' : 'loss'}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-plasma-500/10 text-plasma-300">
              <Coins className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Trade route profitable' : 'Window closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits docked at {station.name}.
            </p>
            <p className="text-[11px] text-muted">
              Target: {MARKET_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Trade again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Sparkles aria-hidden="true" /> Docked at {station.name}; {state.credits} credits, {state.fuel} fuel.
      </span>
    </GameFrame>
  );
}
