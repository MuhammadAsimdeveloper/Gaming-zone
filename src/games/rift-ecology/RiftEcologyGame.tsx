import { CalendarDays, Home, Leaf, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameStat, Kbd } from '../shared/GameFrame';
import { SCENARIOS, scenarioById, type Scenario, type ScenarioId } from './scenarios';
import { SPECIES, SPECIES_IDS, speciesById, type SpeciesId } from './species';
import {
  DAYS,
  INTERVENTIONS,
  INTERVENTION_COSTS,
  SEASON_LENGTH,
  START_BUDGET,
  aliveSpecies,
  createEcology,
  scoreRun,
  stepDay,
  type EcologyScore,
  type EcologyState,
  type InterventionId,
} from './simulation';
import { buildHabitatLayout, buildLinePath } from './render';

type ShellPhase = 'menu' | 'playing' | 'finished';

type PopulationHistory = Record<SpeciesId, number[]>;

function seedHistory(state: EcologyState): PopulationHistory {
  return {
    kelp: [state.populations.kelp],
    glowmoss: [state.populations.glowmoss],
    grazer: [state.populations.grazer],
    burrower: [state.populations.burrower],
    skimmer: [state.populations.skimmer],
    'reef-hunter': [state.populations['reef-hunter']],
  };
}

function seasonIndex(day: number): number {
  return Math.floor((((day - 1) % (SEASON_LENGTH * 4)) + SEASON_LENGTH * 4) % (SEASON_LENGTH * 4) / SEASON_LENGTH);
}

const SEASON_LABELS = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

const ROLE_LABEL: Record<'producer' | 'herbivore' | 'predator', string> = {
  producer: 'Producer',
  herbivore: 'Herbivore',
  predator: 'Predator',
};

function biomassOf(state: EcologyState): number {
  return SPECIES.reduce((total, species) => total + state.populations[species.id], 0);
}

export default function RiftEcologyGame({ onStart, onComplete }: GameComponentProps) {
  const ecologyRef = useRef<EcologyState | null>(null);
  const historyRef = useRef<PopulationHistory | null>(null);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const [, refresh] = useReducer((value: number) => value + 1, 0);

  const [phase, setPhase] = useState<ShellPhase>('menu');
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('kelp-forest');
  const [selectedTool, setSelectedTool] = useState<InterventionId | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId | null>(null);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  const begin = useCallback((scenarioId: ScenarioId) => {
    const ecology = createEcology(scenarioId);
    ecologyRef.current = ecology;
    historyRef.current = seedHistory(ecology);
    finishedRef.current = false;
    setSelectedTool(null);
    setSelectedSpecies(null);
    setPhase('playing');
    refresh();
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    begin(selectedScenario);
  }, [begin, selectedScenario]);

  const backToMenu = useCallback(() => {
    ecologyRef.current = null;
    historyRef.current = null;
    setPhase('menu');
    refresh();
  }, []);

  const passDay = useCallback(() => {
    const ecology = ecologyRef.current;
    if (!ecology || ecology.status !== 'running') return;

    stepDay(ecology, selectedTool ?? undefined, selectedSpecies ?? undefined);

    const history = historyRef.current;
    if (history) {
      for (const id of SPECIES_IDS) history[id].push(ecology.populations[id]);
    }

    setSelectedTool(null);
    setSelectedSpecies(null);
    refresh();

    if (ecology.status !== 'running' && !finishedRef.current) {
      finishedRef.current = true;
      setPhase('finished');
      const score = scoreRun(ecology).total;
      onCompleteRef.current?.({
        outcome: ecology.status === 'finished' ? 'complete' : 'loss',
        score,
      });
    }
  }, [selectedTool, selectedSpecies]);

  const ecology = ecologyRef.current;
  const scenario = ecology ? scenarioById(ecology.scenarioId) : scenarioById(selectedScenario);
  const history = historyRef.current;
  const habitat = buildHabitatLayout(scenario);
  const day = ecology?.day ?? 1;
  const budget = ecology?.budget ?? START_BUDGET;
  const alive = ecology ? aliveSpecies(ecology) : [];
  const biomass = ecology ? (ecology.biomass.at(-1) ?? biomassOf(ecology)) : 0;
  const season = SEASON_LABELS[seasonIndex(day)] ?? 'Spring';
  const score = phase === 'finished' && ecology ? scoreRun(ecology) : null;

  const status =
    phase === 'menu' || !ecology
      ? `Rift Ecology. Choose a habitat and start a sixty-day season.`
      : phase === 'finished'
        ? `Season over after ${ecology.day - 1} days. ${ecology.status === 'crashed' ? 'The ecosystem collapsed.' : 'The season is complete.'} Grade ${score?.grade ?? 'D'}.`
        : `Day ${day} of ${DAYS}. ${alive.length} of ${SPECIES.length} species alive. Budget ${budget}. Biomass ${Math.round(biomass)}.`;

  const populationFor = (id: SpeciesId): number => Math.round(ecology?.populations[id] ?? 0);
  const targetFor = (id: SpeciesId): number | undefined => scenario.targets[id];
  const markerScale = (id: SpeciesId): number => {
    const start = Math.max(1, scenario.start[id]);
    const current = ecology?.populations[id] ?? scenario.start[id];
    return Math.max(0.18, Math.min(1.6, Math.sqrt(Math.max(0.01, current / start))));
  };

  return (
    <GameFrame
      title="Rift Ecology"
      subtitle="Sixty days. Six species. One fragile food web."
      icon={Leaf}
      accent="mint"
      hud={
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${Math.min(day, DAYS)} / ${DAYS}`} tone="mint" />
          <GameStat label="Season" value={season} />
          <GameStat label="Species" value={`${alive.length} / ${SPECIES.length}`} tone={alive.length < 4 ? 'coral' : 'ink'} />
          <GameStat label="Budget" value={budget} tone={budget <= 5 ? 'coral' : 'electric'} />
          <GameStat label="Biomass" value={Math.round(biomass)} tone="plasma" />
        </div>
      }
      toolbar={
        <>
          {phase !== 'menu' ? (
            <GameButton size="icon" variant="ghost" onClick={restart} aria-label="Restart season" title="Restart season">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
          {phase !== 'menu' ? (
            <GameButton size="icon" variant="ghost" onClick={backToMenu} aria-label="Quit to menu" title="Quit to menu">
              <Home className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          ) : null}
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <Kbd>Step</Kbd> intervene, then advance one day
          </span>
          <span>Producers grow to carrying capacity; each season reshapes the water.</span>
          <span>Every intervention costs budget. Unspent budget still counts at scoring.</span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-950">
              <svg
                viewBox={`0 0 ${habitat.width} ${habitat.height}`}
                className="h-[220px] w-full"
                role="img"
                aria-label={`${scenario.name} habitat`}
              >
                <defs>
                  <linearGradient id="rift-ecology-water" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b1a2b" />
                    <stop offset="100%" stopColor="#06101c" />
                  </linearGradient>
                  <linearGradient id="rift-ecology-ridge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1b3b4a" />
                    <stop offset="100%" stopColor="#0c2029" />
                  </linearGradient>
                </defs>
                <rect width={habitat.width} height={habitat.height} fill="url(#rift-ecology-water)" />
                <path d={habitat.ridge} fill="url(#rift-ecology-ridge)" opacity="0.85" />
                {habitat.markers.map((marker) => {
                  const current = ecology?.populations[marker.id] ?? scenario.start[marker.id];
                  const extinct = ecology ? current <= 0 : false;
                  const radius = Math.max(3, marker.radius * markerScale(marker.id));
                  return (
                    <g key={marker.id} opacity={extinct ? 0.25 : 1}>
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={radius}
                        fill={marker.color}
                        fillOpacity="0.68"
                        stroke={marker.color}
                        strokeOpacity="0.9"
                        strokeWidth="1"
                      />
                      <circle cx={marker.x} cy={marker.y} r={radius * 1.9} fill={marker.color} fillOpacity="0.08" />
                    </g>
                  );
                })}
              </svg>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                <span>{scenario.name}</span>
                <span>
                  {ecology?.status === 'crashed'
                    ? 'Collapsed'
                    : ecology?.status === 'finished'
                      ? 'Season complete'
                      : phase === 'playing'
                        ? `Day ${Math.min(day, DAYS)}`
                        : 'Briefing'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Sparkles className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Population trends
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {SPECIES.map((species) => {
                  const values = history?.[species.id] ?? [];
                  const path = buildLinePath(values, 120, 36);
                  return (
                    <li key={species.id} className="rounded-xl border border-white/5 bg-white/[0.02] px-2 py-1.5">
                      <p className="flex items-center gap-1.5 text-[10px] text-muted">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: species.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{species.name}</span>
                      </p>
                      <svg viewBox="0 0 120 36" className="mt-1 h-9 w-full" aria-hidden="true">
                        <path d={path} fill="none" stroke={species.color} strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Field log</p>
              <ul className="mt-1 space-y-0.5 text-[11px] leading-5">
                {ecology && ecology.log.length > 0 ? (
                  [...ecology.log]
                    .reverse()
                    .slice(0, 12)
                    .map((entry, index) => (
                      <li key={`${index}-${entry}`} className={index === 0 ? 'text-white' : 'text-muted'}>
                        {entry}
                      </li>
                    ))
                ) : (
                  <li className="text-muted">No observations yet.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                <Leaf className="h-3.5 w-3.5 text-mint" aria-hidden="true" />
                Species
              </p>
              <ul className="mt-2 space-y-1">
                {SPECIES.map((species) => {
                  const population = populationFor(species.id);
                  const extinct = ecology ? (ecology.populations[species.id] ?? 0) <= 0 : false;
                  const target = targetFor(species.id);
                  const met = target !== undefined && population >= target;
                  return (
                    <li key={species.id}>
                      <button
                        type="button"
                        aria-label={species.name}
                        aria-pressed={selectedSpecies === species.id}
                        disabled={!ecology || ecology.status !== 'running' || extinct}
                        onClick={() => setSelectedSpecies(species.id)}
                        title={`${ROLE_LABEL[species.role]} · ${species.diet ? `eats ${speciesById(species.diet).name}` : 'photosynthetic'}`}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-[11px] transition',
                          selectedSpecies === species.id
                            ? 'border-mint/50 bg-mint/10 text-ink'
                            : 'border-white/10 bg-white/[0.03] text-ink hover:border-white/20 hover:bg-white/[0.06]',
                          (!ecology || ecology.status !== 'running' || extinct) && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: species.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{species.name}</span>
                        {target !== undefined ? (
                          <span className={cn('shrink-0 text-[9px] uppercase tracking-[0.1em]', met ? 'text-mint' : 'text-muted')}>
                            ≥{target}
                          </span>
                        ) : null}
                        <span className={cn('w-10 shrink-0 text-right tabular-nums', extinct ? 'text-coral' : 'text-muted')}>
                          {extinct ? 'gone' : population}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Interventions</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {INTERVENTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.name}
                    aria-pressed={selectedTool === option.id}
                    disabled={!ecology || ecology.status !== 'running'}
                    onClick={() => setSelectedTool(option.id)}
                    title={option.description}
                    className={cn(
                      'rounded-xl border px-2 py-1.5 text-left text-[11px] transition',
                      selectedTool === option.id
                        ? 'border-electric-400/50 bg-electric-500/10 text-ink'
                        : 'border-white/10 bg-white/[0.03] text-ink hover:border-white/20 hover:bg-white/[0.06]',
                      (!ecology || ecology.status !== 'running') && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="block font-semibold">{option.name}</span>
                    <span className="mt-0.5 block text-[9px] uppercase tracking-[0.1em] text-muted">
                      −{INTERVENTION_COSTS[option.id]} budget
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-muted">
                {selectedTool
                  ? `${INTERVENTIONS.find((option) => option.id === selectedTool)?.name}: pick a species, then advance the day.`
                  : 'Optional. Pick a tool and a species before advancing.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-night-900/70 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted">
                <CalendarDays className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                <span className="truncate">
                  {!ecology
                    ? 'Start a season to open the field.'
                    : ecology.status !== 'running'
                      ? 'The season is closed.'
                      : `Budget ${budget} · ${alive.length} species alive.`}
                </span>
              </div>
              <GameButton
                variant="primary"
                size="sm"
                onClick={passDay}
                disabled={!ecology || ecology.status !== 'running'}
              >
                Advance day
              </GameButton>
            </div>

            <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Model assumptions</p>
              <ul className="mt-1 space-y-0.5 text-[10px] leading-4 text-muted">
                <li>Populations are fractional, aggregated counts — not individual animals.</li>
                <li>Feeding uses a saturating response: abundant prey is harder to exploit fully.</li>
                <li>Producers follow logistic growth capped by season and scenario modifiers.</li>
                <li>Crowding and small-population penalties are simplified, deterministic terms.</li>
              </ul>
            </div>
          </div>
        </div>

        {phase === 'menu' ? (
          <GameOverlay
            className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
            label="Rift Ecology"
          >
            <div className="mx-auto w-full max-w-2xl space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-mint">
                  NeonRift Arcade · Simulation
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white">
                  Keep the web alive. <span className="text-gradient">Sixty days at a time.</span>
                </h3>
                <p className="mt-1 max-w-lg text-xs leading-5 text-muted">
                  Two producers, two herbivores and two predators share each habitat. Growth, predation and
                  seasons run on their own; your budget buys planting, culling, shelter and flow. Lose both
                  producers, or three species, and the web collapses.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {SCENARIOS.map((candidate) => {
                  const active = selectedScenario === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-label={`Choose ${candidate.name}`}
                      aria-pressed={active}
                      onClick={() => setSelectedScenario(candidate.id)}
                      className={cn(
                        'rounded-2xl border px-3 py-2 text-left transition',
                        active
                          ? 'border-mint/50 bg-mint/10'
                          : 'border-white/10 bg-night-900/70 hover:border-white/20 hover:bg-white/[0.05]',
                      )}
                    >
                      <p className="text-xs font-semibold text-ink">{candidate.name}</p>
                      <p className="mt-1 text-[10px] leading-4 text-muted">{candidate.blurb}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <GameButton variant="primary" onClick={() => begin(selectedScenario)}>
                  <Leaf className="h-4 w-4" aria-hidden="true" />
                  Start season
                </GameButton>
                <span className="text-[11px] text-muted">
                  {scenarioById(selectedScenario).name} · {DAYS} days · {START_BUDGET} budget
                </span>
              </div>
            </div>
          </GameOverlay>
        ) : null}

        {phase === 'finished' && ecology && score ? (
          <GameOverlay
            tone={ecology.status === 'crashed' ? 'loss' : 'win'}
            className="items-stretch justify-start overflow-y-auto text-left sm:justify-center"
            label="Season debrief"
          >
            <Debrief
              scenario={scenario}
              state={ecology}
              score={score}
              onRestart={restart}
              onMenu={backToMenu}
            />
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}

function Debrief({
  scenario,
  state,
  score,
  onRestart,
  onMenu,
}: {
  scenario: Scenario;
  state: EcologyState;
  score: EcologyScore;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const crashed = state.status === 'crashed';
  const targetIds = Object.keys(scenario.targets) as SpeciesId[];

  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted">
          {scenario.name} · {crashed ? 'Collapse' : 'Season complete'}
        </p>
        <h3 className="mt-1 font-display text-2xl font-semibold text-white">
          Grade <span className="text-gradient">{score.grade}</span>
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted">
          {crashed
            ? `The ecosystem collapsed on day ${state.day} after ${state.extinct.length} species were lost.`
            : `Sixty days held. ${state.extinct.length === 0 ? 'No species were lost.' : `${state.extinct.length} species went extinct along the way.`}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <GameStat label="Total" value={score.total} tone="mint" />
        <GameStat label="Survival" value={score.survival} tone="mint" />
        <GameStat label="Biodiversity" value={score.biodiversity} tone="plasma" />
        <GameStat label="Stability" value={score.stability} tone="electric" />
        <GameStat label="Budget kept" value={score.budget} />
        <GameStat label="Targets" value={`${score.targetsMet} / ${score.targetCount}`} tone="coral" />
        <GameStat label="Days" value={`${Math.min(state.day, DAYS)} / ${DAYS}`} />
        <GameStat label="Species left" value={`${SPECIES.length - state.extinct.length} / ${SPECIES.length}`} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Targets</p>
        <ul className="mt-1 grid gap-1 sm:grid-cols-3">
          {targetIds.map((id) => {
            const population = Math.round(state.populations[id]);
            const target = scenario.targets[id] ?? 0;
            const met = population >= target;
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: speciesById(id).color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-ink">{speciesById(id).name}</span>
                </span>
                <span className={cn('shrink-0 tabular-nums', met ? 'text-mint' : 'text-coral')}>
                  {population} / {target}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <GameButton variant="primary" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Run it again
        </GameButton>
        <GameButton variant="secondary" onClick={onMenu}>
          Change habitat
        </GameButton>
      </div>
    </div>
  );
}
