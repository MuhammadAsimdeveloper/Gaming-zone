import {
  Cog,
  Factory,
  Gauge,
  Package,
  Pause,
  Play,
  RotateCcw,
  Users,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  FACTORY_DAYS,
  FACTORY_TARGET,
  advanceFactoryDay,
  buyMachine,
  createFactoryState,
  cycleFactorySpeed,
  factoryOutput,
  hireOperator,
  installAutomation,
  orderDemand,
  startFactory,
  toggleFactoryPause,
  type FactoryState,
} from './simulation';

const BEST_KEY = 'neonrift:game:factory-line:best';
const DAY_MS = 3000;

export default function FactoryLineGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<FactoryState>(createFactoryState);
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
    onTick: () => setState((current) => advanceFactoryDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= FACTORY_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startFactory(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createFactoryState());
  }, []);

  const output = factoryOutput(state);
  const orders = orderDemand(state.day);
  const win = state.credits >= FACTORY_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Factory ready. Expand the line and start production.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalProduced} units produced.`
        : `Day ${state.day} of ${FACTORY_DAYS}. ${orders} orders due, ${output} units capacity.`;

  return (
    <GameFrame
      title="Factory Line"
      subtitle="Keep the line fed. Ship every order."
      icon={Factory}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${FACTORY_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Machines" value={state.machines} tone="electric" />
          <GameStat label="Operators" value={state.workers} tone="plasma" />
          <GameStat label="Automation" value={`${state.automation}/3`} />
          <GameStat label="Output" value={`${output} u`} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleFactoryPause(current))}
              aria-label={state.paused ? 'Resume line' : 'Pause line'}
              title={state.paused ? 'Resume line' : 'Pause line'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleFactorySpeed(current))}
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
          <span>Output = machines × 8 + operators × 4, boosted by automation.</span>
          <span>Best line: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {FACTORY_TARGET} credits.</span>
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
                key: 'machines',
                label: 'Machines',
                value: state.machines,
                max: 9,
                cost: 120,
                detail: '+8 units · 25c/day',
                icon: Cog,
                action: buyMachine,
                aria: 'Buy another machine for 120 credits',
              },
              {
                key: 'workers',
                label: 'Operators',
                value: state.workers,
                max: 14,
                cost: 45,
                detail: '+4 units · 18c/day',
                icon: Users,
                action: hireOperator,
                aria: 'Hire an operator for 45 credits',
              },
              {
                key: 'automation',
                label: 'Automation',
                value: state.automation,
                max: 3,
                cost: 110,
                detail: '+10% total output',
                icon: Wrench,
                action: installAutomation,
                aria: 'Install automation for 110 credits',
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
                    {item.value >= item.max ? 'At capacity' : `Upgrade · ${item.cost}c`}
                  </GameButton>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Order forecast" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Orders today</p>
                  <p className="font-display text-2xl font-semibold text-ink">{orders}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Line capacity {output}</p>
                  <p className={cn('text-sm font-semibold', orders > output ? 'text-coral' : 'text-mint')}>
                    {orders > output ? `${orders - output} backlog` : `${output - orders} spare`}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-8 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-electric-500 to-mint"
                  style={{ width: `${Math.min(100, (output / 70) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Yesterday: {state.produced} produced · total {state.totalProduced} units.
              </p>
            </section>

            <section aria-label="Production log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Line log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Package className="mt-0.5 h-3 w-3 shrink-0 text-electric-300" aria-hidden="true" />
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
              20-day season · {FACTORY_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A factory with a moving order book</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Machines and operators set the line's capacity. Automation multiplies everything.
              Backlogged orders lose credits, so expand before the wave arrives.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start line
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Line paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">Production is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleFactoryPause(current))}>
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
              <Factory className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Line in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalProduced}{' '}
              units shipped.
            </p>
            <p className="text-[11px] text-muted">
              Target: {FACTORY_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Run again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Factory aria-hidden="true" /> {orders} orders due, {output} units of capacity.
      </span>
    </GameFrame>
  );
}
