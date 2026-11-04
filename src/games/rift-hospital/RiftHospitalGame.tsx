import {
  Activity,
  BedDouble,
  Gauge,
  HeartPulse,
  Pause,
  Play,
  RotateCcw,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat } from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  HOSPITAL_DAYS,
  HOSPITAL_TARGET,
  addBed,
  advanceHospitalDay,
  createHospitalState,
  cycleHospitalSpeed,
  hireDoctor,
  hireNurse,
  hospitalCapacity,
  patientDemand,
  startHospital,
  toggleHospitalPause,
  type HospitalState,
} from './simulation';

const BEST_KEY = 'neonrift:game:rift-hospital:best';
const DAY_MS = 3200;

export default function RiftHospitalGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<HospitalState>(createHospitalState);
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
    onTick: () => setState((current) => advanceHospitalDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= HOSPITAL_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const begin = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startHospital(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createHospitalState());
  }, []);

  const capacity = hospitalCapacity(state);
  const patients = patientDemand(state.day);
  const win = state.credits >= HOSPITAL_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Clinic ready. Expand capacity and start the shift.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.totalTreated} patients treated.`
        : `Day ${state.day} of ${HOSPITAL_DAYS}. ${patients} patients expected, ${capacity} treatment slots. Reputation ${state.reputation} percent.`;

  return (
    <GameFrame
      title="Rift Hospital"
      subtitle="Triage the rush. Keep the clinic open."
      icon={HeartPulse}
      accent="coral"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <GameStat label="Day" value={`${state.day} / ${HOSPITAL_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Reputation" value={`${state.reputation}%`} tone={state.reputation < 50 ? 'coral' : 'mint'} />
          <GameStat label="Beds" value={state.beds} tone="electric" />
          <GameStat label="Doctors" value={state.doctors} tone="plasma" />
          <GameStat label="Nurses" value={state.nurses} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => toggleHospitalPause(current))}
              aria-label={state.paused ? 'Resume clinic' : 'Pause clinic'}
              title={state.paused ? 'Resume clinic' : 'Pause clinic'}
            >
              {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleHospitalSpeed(current))}
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
          <span>Capacity = min(beds, doctors × 4, nurses × 3). Critical cases are treated first.</span>
          <span>Best clinic: <b className="text-mint">{best === null ? '—' : `${best}c`}</b></span>
          <span>Target: {HOSPITAL_TARGET} credits.</span>
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
                key: 'beds',
                label: 'Beds',
                value: state.beds,
                max: 20,
                cost: 80,
                detail: '+2 capacity · 8c/day',
                icon: BedDouble,
                action: addBed,
                aria: 'Add two beds for 80 credits',
              },
              {
                key: 'doctors',
                label: 'Doctors',
                value: state.doctors,
                max: 8,
                cost: 100,
                detail: '+4 capacity · 35c/day',
                icon: Stethoscope,
                action: hireDoctor,
                aria: 'Hire a doctor for 100 credits',
              },
              {
                key: 'nurses',
                label: 'Nurses',
                value: state.nurses,
                max: 12,
                cost: 55,
                detail: '+3 capacity · 18c/day',
                icon: Users,
                action: hireNurse,
                aria: 'Hire a nurse for 55 credits',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <section key={item.key} aria-label={item.label} className="rounded-2xl border border-white/10 bg-night-900/75 p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-coral">
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
                    {item.value >= item.max ? 'At capacity' : `Expand · ${item.cost}c`}
                  </GameButton>
                </section>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section aria-label="Patient forecast" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Patients today</p>
                  <p className="font-display text-2xl font-semibold text-ink">{patients}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted">Treatment slots {capacity}</p>
                  <p className={cn('text-sm font-semibold', patients > capacity ? 'text-coral' : 'text-mint')}>
                    {patients > capacity ? `${patients - capacity} waiting` : `${capacity - patients} spare`}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-8 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <div
                  className="h-full bg-gradient-to-r from-coral to-plasma-500"
                  style={{ width: `${Math.min(100, (capacity / 20) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Yesterday: {state.treated} treated · {state.critical} critical cases · total {state.totalTreated}.
              </p>
            </section>

            <section aria-label="Clinic log" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Clinic log</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-muted">
                {state.log.map((entry, index) => (
                  <li key={`${entry}-${index}`} className="flex gap-2">
                    <Activity className="mt-0.5 h-3 w-3 shrink-0 text-coral" aria-hidden="true" />
                    <span>{entry}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-coral">
              20-day season · {HOSPITAL_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">A clinic at the edge of the rift</h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Beds, doctors and nurses all cap how many patients you can treat. Critical cases are
              seen first; every untreated patient costs reputation and credits.
            </p>
            <GameButton variant="primary" onClick={begin}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Open clinic
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Clinic paused</p>
            <h3 className="font-display text-lg font-semibold text-ink">The waiting room is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton variant="primary" onClick={() => setState((current) => toggleHospitalPause(current))}>
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
              <HeartPulse className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Clinic funded' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and {state.totalTreated}{' '}
              patients treated.
            </p>
            <p className="text-[11px] text-muted">
              Target: {HOSPITAL_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reopen
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <HeartPulse aria-hidden="true" /> {patients} patients expected, {capacity} treatment slots.
      </span>
    </GameFrame>
  );
}
