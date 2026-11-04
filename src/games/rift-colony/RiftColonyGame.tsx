import {
  Atom,
  FlaskConical,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sprout,
  Users,
  Utensils,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  BUILD_ORDER,
  COLONY_BUILDS,
  COLONY_DAYS,
  COLONY_TARGET,
  JOBS,
  JOB_ORDER,
  advanceColonyDay,
  assignWorker,
  buildColony,
  colonyScore,
  createColonyState,
  cycleColonySpeed,
  jobOutput,
  recallWorker,
  startColony,
  toggleColonyPause,
  unassignedWorkers,
  type ColonyState,
  type JobId,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-colony:best';
const DAY_MS = 3200;

function jobIcon(id: JobId) {
  if (id === 'farm') return Sprout;
  if (id === 'power') return Zap;
  if (id === 'mine') return Atom;
  return FlaskConical;
}

export default function RiftColonyGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<ColonyState>(createColonyState);
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
    onTick: () => setState((current) => advanceColonyDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    const score = colonyScore(state);
    submit(score);
    onCompleteRef.current?.({ score, outcome: score >= COLONY_TARGET ? 'win' : 'loss' });
  }, [state, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startColony(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createColonyState());
  }, []);

  const score = colonyScore(state);
  const win = score >= COLONY_TARGET;
  const unassigned = unassignedWorkers(state);
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Colony ready. Assign workers and build the first habitat ring.'
      : state.phase === 'over'
        ? `Season complete with ${state.population} colonists and a score of ${score}.`
        : `Day ${state.day} of ${COLONY_DAYS}. Population ${state.population}, morale ${state.morale} percent, ${unassigned} unassigned.`;

  return (
    <GameFrame
      title="Rift Colony"
      subtitle="Six colonists. One fragile habitat."
      icon={Users}
      accent="mint"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${COLONY_DAYS}`} />
          <GameStat label="Population" value={`${state.population} / ${state.capacity}`} tone="mint" />
          <GameStat label="Morale" value={`${state.morale}%`} tone={state.morale < 50 ? 'coral' : 'mint'} />
          <GameStat label="Food" value={state.food} tone="electric" />
          <GameStat label="Power" value={state.power} tone="plasma" />
          <GameStat label="Materials" value={state.materials} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleColonyPause(current))}
              aria-label={state.paused ? 'Resume colony' : 'Pause colony'}
              title={state.paused ? 'Resume colony' : 'Pause colony'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleColonySpeed(current))}
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
          <span>Colonists eat 1 food and draw 1 power each day.</span>
          <span>Best colony score: <b className="text-mint">{best === null ? '—' : `${best}`}</b></span>
          <span>Target: {COLONY_TARGET} points.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {JOB_ORDER.map((id) => {
              const spec = JOBS[id];
              const Icon = jobIcon(id);
              const workers = state.workers[id];
              return (
                <section key={id} aria-label={spec.name} className="rounded-2xl border border-white/10 bg-night-900/75 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/5" style={{ color: spec.color }}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <h3 className="min-w-0 truncate text-[11px] font-semibold text-ink">{spec.name}</h3>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-4 text-muted">
                    {workers} workers · +{jobOutput(state, id)} / day
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => recallWorker(current, id))}
                      disabled={workers <= 0}
                      aria-label={`Recall a worker from ${spec.name}`}
                    >
                      −
                    </GameButton>
                    <GameButton
                      size="sm"
                      variant="secondary"
                      onClick={() => setState((current) => assignWorker(current, id))}
                      disabled={unassigned <= 0}
                      aria-label={`Assign a worker to ${spec.name}`}
                    >
                      +
                    </GameButton>
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Colony construction" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Construction</h3>
                <span className="text-[10px] text-muted">
                  {unassigned} unassigned · {state.research} research
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {BUILD_ORDER.map((id) => {
                  const spec = COLONY_BUILDS[id];
                  const level = id === 'habitat' ? Math.max(0, (state.capacity - 8) / 4) : state.upgrades[id];
                  const full = id === 'habitat' ? state.capacity >= 24 : state.upgrades[id] >= spec.max;
                  return (
                    <div key={id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                      <p className="text-[11px] font-medium text-ink">
                        {spec.name} · {level}/{spec.max}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-muted">{spec.description}</p>
                      <GameButton
                        size="sm"
                        variant="secondary"
                        className="mt-1.5"
                        disabled={full || state.materials < spec.cost || state.phase !== 'running'}
                        onClick={() => setState((current) => buildColony(current, id))}
                        aria-label={`Build ${spec.name} for ${spec.cost} materials`}
                      >
                        {full ? 'Max' : `${spec.cost} mat`}
                      </GameButton>
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-label="Colony log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Habitat log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Utensils className="mt-0.5 h-3 w-3 shrink-0 text-mint" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[10px] text-muted">
                Score preview: <b className="text-ink">{score}</b> · {state.population} colonists ·{' '}
                {state.research} research · {state.materials} materials
              </div>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">
              24-day season · {COLONY_TARGET} point target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">Keep six colonists alive</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Assign workers between food, power, ore and research. Build a habitat ring to grow,
              keep morale above 50, and reach the target score before the season closes.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start colony
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Colony paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The habitat is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleColonyPause(current))}>
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
              <Users className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Colony established' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.population}</b> colonists and a score of{' '}
              {score}.
            </p>
            <p className="text-[11px] text-muted">
              Target: {COLONY_TARGET} points · best {best === null ? '—' : `${best} points`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Grow again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <Users aria-hidden="true" /> Population {state.population}; food {state.food}; power {state.power};
        materials {state.materials}; morale {state.morale} percent.
      </span>
    </GameFrame>
  );
}
