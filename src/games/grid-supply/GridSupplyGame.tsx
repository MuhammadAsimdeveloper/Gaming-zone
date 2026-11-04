import {
  BatteryCharging,
  CloudSun,
  Factory,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Wind,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  PLANT_ORDER,
  PLANTS,
  SUPPLY_DAYS,
  SUPPLY_TARGET,
  adjustOutput,
  advanceSupplyDay,
  averageReliability,
  buyCapacity,
  createSupplyState,
  cycleSupplySpeed,
  demandForecast,
  plantCapacity,
  startSupply,
  toggleSupplyPause,
  totalOutput,
  type PlantId,
  type SupplyState,
} from './simulation';

const BEST_KEY = 'neonrift:game:grid-supply:best';
const DAY_MS = 3000;

function plantIcon(id: PlantId) {
  if (id === 'solar') return CloudSun;
  if (id === 'wind') return Wind;
  return Factory;
}

export default function GridSupplyGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<SupplyState>(createSupplyState);
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
    onTick: () => setState((current) => advanceSupplyDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= SUPPLY_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startSupply(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createSupplyState());
  }, []);

  const supply = totalOutput(state);
  const demand = demandForecast(state.day);
  const reliability = state.day > 1 ? state.reliability : 1;
  const average = averageReliability(state);
  const win = state.credits >= SUPPLY_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Grid ready. Match generation to demand and start the day.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${Math.round(average * 100)} percent reliability.`
        : `Day ${state.day} of ${SUPPLY_DAYS}. Demand ${demand} megawatts, supply ${supply}. Reliability ${Math.round(reliability * 100)} percent.`;

  return (
    <GameFrame
      title="Grid Supply"
      subtitle="Balance the city. Keep the lights on."
      icon={BatteryCharging}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${state.day} / ${SUPPLY_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Demand" value={`${demand} MW`} tone="coral" />
          <GameStat label="Supply" value={`${supply} MW`} tone="electric" />
          <GameStat label="Reliability" value={`${Math.round(reliability * 100)}%`} tone={reliability < 0.9 ? 'coral' : 'mint'} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleSupplyPause(current))}
              aria-label={state.paused ? 'Resume grid' : 'Pause grid'}
              title={state.paused ? 'Resume grid' : 'Pause grid'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleSupplySpeed(current))}
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
          <span>Set each plant before the day ends; unused output still costs credits.</span>
          <span>Best grid: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {SUPPLY_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLANT_ORDER.map((id) => {
              const spec = PLANTS[id];
              const Icon = plantIcon(id);
              const capacity = plantCapacity(state, id);
              const output = state.output[id];
              return (
                <section key={id} aria-label={spec.name} className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5" style={{ color: spec.color }}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-ink">{spec.name}</h3>
                        <p className="text-[10px] text-muted">{spec.costPerUnit.toFixed(1)}c / MWh</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-ink">
                      {output} MW
                    </span>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((output / capacity) * 100)}%`, backgroundColor: spec.color }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    Online {output} / {capacity} MW
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => adjustOutput(current, id, -10))}
                      disabled={output <= 0}
                      aria-label={`Reduce ${spec.name} output by 10 megawatts`}
                    >
                      −10
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => adjustOutput(current, id, 10))}
                      disabled={output >= capacity}
                      aria-label={`Increase ${spec.name} output by 10 megawatts`}
                    >
                      +10
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => setState((current) => buyCapacity(current, id))}
                      disabled={state.capacityLevel[id] >= 3 || state.credits < 90 + state.capacityLevel[id] * 35 || state.phase !== 'running'}
                      aria-label={`Expand ${spec.name} capacity`}
                    >
                      +15 cap
                    </GameButton>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Demand and supply" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">City demand</p>
                  <p className="font-display text-2xl font-semibold text-ink">{demand} MW</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Supply {supply} MW</p>
                  <p className={cn('text-sm font-semibold', supply < demand ? 'text-coral' : 'text-mint')}>
                    {supply < demand ? `${demand - supply} MW short` : `${supply - demand} MW reserve`}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex h-8 overflow-hidden rounded-lg border border-white/10">
                <div className="bg-gradient-to-r from-electric-500 to-plasma-500" style={{ width: `${Math.min(100, (demand / 200) * 100)}%` }} />
                <div className="flex-1 bg-white/5" />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                <span>Average reliability {Math.round(average * 100)}%</span>
                <span>Next forecast {demandForecast(state.day + 1)} MW</span>
              </div>
            </section>

            <section aria-label="Grid log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Dispatch log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0 text-plasma-300" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-plasma-300">
              20-day season · {SUPPLY_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Keep a city's grid in balance</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Solar and wind are cheap but capped; the gas peaker is flexible and expensive. Every
              blackout carries a penalty, and unused generation still costs credits.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start grid
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Grid paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The city is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleSupplyPause(current))}>
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
              <BatteryCharging className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Grid in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits at{' '}
              {Math.round(average * 100)}% average reliability.
            </p>
            <p className="text-[11px] text-muted">
              Target: {SUPPLY_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Run again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <BatteryCharging aria-hidden="true" /> Current supply {supply} megawatts against {demand} megawatts of demand.
      </span>
    </GameFrame>
  );
}
