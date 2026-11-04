import {
  Droplets,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Waves,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  AQUA_DAYS,
  AQUA_TARGET,
  advanceAquaDay,
  buildPump,
  createAquaState,
  cycleAquaSpeed,
  leakRate,
  repairPipes,
  startAqua,
  toggleAquaPause,
  waterDemand,
  type AquaState,
} from './simulation';

const BEST_KEY = 'neonrift:game:aqua-grid:best';
const DAY_MS = 3000;

export default function AquaGridGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<AquaState>(createAquaState);
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
    onTick: () => setState((current) => advanceAquaDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= AQUA_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startAqua(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createAquaState());
  }, []);

  const demand = waterDemand(state.day);
  const leak = leakRate(state);
  const win = state.credits >= AQUA_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Water grid ready. Repair the pipes and start the pumps.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalDelivered} units delivered.`
        : `Day ${state.day} of ${AQUA_DAYS}. Demand ${demand}, reservoir ${state.reservoir}, leak ${leak}.`;

  return (
    <GameFrame
      title="Aqua Grid"
      subtitle="Every drop has to reach the city."
      icon={Waves}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${AQUA_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Reservoir" value={state.reservoir} tone="electric" />
          <GameStat label="Pumps" value={state.pumps} tone="plasma" />
          <GameStat label="Pipes" value={`${state.condition}%`} tone={state.condition < 50 ? 'coral' : 'mint'} />
          <GameStat label="Demand" value={`${demand}`} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleAquaPause(current))}
              aria-label={state.paused ? 'Resume water grid' : 'Pause water grid'}
              title={state.paused ? 'Resume water grid' : 'Pause water grid'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleAquaSpeed(current))}
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
          <span>Pumps add 16 units/day; leaks grow as pipe condition drops.</span>
          <span>Best grid: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {AQUA_TARGET} credits.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid gap-3 sm:grid-cols-3">
            <section aria-label="Reservoir" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-electric-300">
                  <Droplets className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Reservoir</h3>
                  <p className="text-[10px] text-muted">Inflow {state.pumps * 16} · leak {leak}</p>
                </div>
                <span className="ml-auto font-display text-xl font-semibold text-ink">{state.reservoir}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-electric-500 to-mint" style={{ width: `${Math.min(100, (state.reservoir / 120) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-muted">Yesterday delivered {state.delivered} units.</p>
            </section>

            <section aria-label="Pump station" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-plasma-300">
                  <Waves className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Pump station</h3>
                  <p className="text-[10px] text-muted">{state.pumps} pumps · 22c/day each</p>
                </div>
              </div>
              <GameButton
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                disabled={state.pumps >= 6 || state.credits < 120 || state.phase !== 'running'}
                onClick={() => setState((current) => buildPump(current))}
                aria-label="Install a pump for 120 credits"
              >
                Install pump · 120c
              </GameButton>
            </section>

            <section aria-label="Pipe network" className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-mint">
                  <Wrench className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink">Pipe network</h3>
                  <p className="text-[10px] text-muted">Condition {state.condition}% · leaks {leak}/day</p>
                </div>
              </div>
              <GameButton
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                disabled={state.condition >= 100 || state.credits < 70 || state.phase !== 'running'}
                onClick={() => setState((current) => repairPipes(current))}
                aria-label="Repair pipes for 70 credits"
              >
                Repair pipes · 70c
              </GameButton>
            </section>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Water balance" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">City demand</p>
                  <p className="font-display text-2xl font-semibold text-ink">{demand}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Reservoir {state.reservoir}</p>
                  <p className={cn('text-sm font-semibold', state.reservoir + state.pumps * 16 - leak < demand ? 'text-coral' : 'text-mint')}>
                    {state.reservoir + state.pumps * 16 - leak < demand ? 'Shortfall risk' : 'Balanced'}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-8 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div className="h-full bg-gradient-to-r from-electric-500 to-mint" style={{ width: `${Math.min(100, (state.reservoir / 120) * 100)}%` }} />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Total delivered {state.totalDelivered} units. Keep the reservoir above demand.
              </p>
            </section>

            <section aria-label="Water log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Grid log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Droplets className="mt-0.5 h-3 w-3 shrink-0 text-electric-300" aria-hidden="true" />
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
              20-day season · {AQUA_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A water grid under pressure</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Pumps fill the reservoir, but aging pipes leak. Repair before the city demand outruns
              the supply and shortfalls eat your credits.
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
            <h3 className="font-display text-lg font-semibold text-ink">Pressure is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleAquaPause(current))}>
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
              <Waves className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Grid in profit' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalDelivered}{' '}
              units delivered.
            </p>
            <p className="text-[11px] text-muted">
              Target: {AQUA_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reopen grid
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Waves aria-hidden="true" /> Demand {demand} units; reservoir {state.reservoir}; leak {leak}.
      </span>
    </GameFrame>
  );
}
