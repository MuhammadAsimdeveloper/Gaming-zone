import {
  CalendarDays,
  Coins,
  Droplets,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Sprout,
  Sun,
  TrendingUp,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import {
  GameButton,
  GameFrame,
  GameOverlay,
  GameStat,
} from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';
import { useSimulationClock } from '../shared/useSimulationClock';
import {
  CROP_ORDER,
  CROPS,
  FACILITIES,
  FACILITY_ORDER,
  SEASON_DAYS,
  WATER_COST,
  WIN_TARGET,
  advanceDay,
  buyFacility,
  createInitialState,
  cycleSpeed,
  harvest,
  isMature,
  marketMultiplier,
  plant,
  salePrice,
  selectCrop,
  startSeason,
  togglePause,
  waterPlot,
  type CropId,
  type GameState,
  type Plot,
} from './simulation';

const BEST_KEY = 'neonrift:game:neon-harvest:best';
const DAY_MS = 3200;

function cropIcon(crop: CropId) {
  return crop === 'melon' ? '🍈' : crop === 'tomato' ? '🍅' : '🥬';
}

function moisturePips(plot: Plot) {
  return Array.from({ length: 3 }, (_, index) => (
    <span
      key={index}
      className={cn(
        'h-1.5 w-4 rounded-full',
        index < plot.moisture ? 'bg-sky-300' : 'bg-white/10',
      )}
    />
  ));
}

function growthPercent(plot: Plot): number {
  if (!plot.crop) return 0;
  return Math.min(100, Math.round((plot.growth / CROPS[plot.crop].growthDays) * 100));
}

function HarvestPlot({
  plot,
  state,
  index,
  onPlant,
  onWater,
  onHarvest,
}: {
  plot: Plot;
  state: GameState;
  index: number;
  onPlant: () => void;
  onWater: () => void;
  onHarvest: () => void;
}) {
  const crop = plot.crop ? CROPS[plot.crop] : null;
  const mature = isMature(plot);
  const price = crop ? salePrice(state, plot) : 0;
  const selected = CROPS[state.selectedCrop];

  return (
    <div
      className={cn(
        'flex min-h-[132px] flex-col rounded-2xl border p-2.5 transition',
        crop
          ? mature
            ? 'border-mint/40 bg-mint/10'
            : 'border-white/10 bg-night-900/80'
          : 'border-dashed border-white/15 bg-white/[0.025]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted/70">
          Plot {index + 1}
        </span>
        {crop ? (
          <span className="text-[10px] font-medium text-ink/80">
            {plot.health}% health
          </span>
        ) : (
          <span className="text-[10px] text-muted/60">Empty</span>
        )}
      </div>

      {crop ? (
        <>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span aria-hidden="true" className="text-base leading-none">
              {cropIcon(crop.id)}
            </span>
            <p className="truncate text-xs font-semibold text-ink">{crop.name}</p>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500',
                mature ? 'bg-mint' : 'bg-gradient-to-r from-sky-400 to-mint',
              )}
              style={{ width: `${growthPercent(plot)}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">
            {mature ? 'Ready to harvest' : `${plot.growth} / ${crop.growthDays} days`}
          </p>

          <div className="mt-auto flex items-center justify-between gap-1.5 pt-2">
            <span className="flex items-center gap-1" aria-label={`Moisture ${plot.moisture} of 3`}>
              {moisturePips(plot)}
            </span>
            {mature ? (
              <GameButton size="sm" variant="primary" onClick={onHarvest} aria-label={`Harvest plot ${index + 1} for ${price} credits`}>
                Sell {price}c
              </GameButton>
            ) : (
              <GameButton
                size="sm"
                variant="secondary"
                onClick={onWater}
                disabled={plot.moisture >= 3 || state.water < WATER_COST}
                aria-label={`Water plot ${index + 1} for ${WATER_COST} water`}
              >
                <Droplets className="h-3 w-3" aria-hidden="true" />
                Water
              </GameButton>
            )}
          </div>
        </>
      ) : (
        <div className="mt-auto space-y-2">
          <p className="text-[11px] leading-4 text-muted">
            Plant <span className="font-medium text-ink">{selected.name}</span> for{' '}
            {selected.seedCost}c.
          </p>
          <GameButton
            size="sm"
            variant="secondary"
            onClick={onPlant}
            disabled={state.credits < selected.seedCost}
            aria-label={`Plant ${selected.name} in plot ${index + 1} for ${selected.seedCost} credits`}
          >
            <Sprout className="h-3 w-3" aria-hidden="true" />
            Plant
          </GameButton>
        </div>
      )}
    </div>
  );
}

export default function NeonHarvestGame({ onStart, onComplete }: GameComponentProps) {
  const [state, setState] = useState<GameState>(createInitialState);
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
    onTick: () => setState((current) => advanceDay(current)),
  });

  useEffect(() => {
    if (state.phase !== 'over' || finishedRef.current) return;
    finishedRef.current = true;
    submit(state.credits);
    onCompleteRef.current?.({
      score: state.credits,
      outcome: state.credits >= WIN_TARGET ? 'win' : 'loss',
    });
  }, [state.phase, state.credits, submit]);

  const beginSeason = useCallback(() => {
    finishedRef.current = false;
    setState((current) => startSeason(current));
    onStartRef.current?.();
  }, []);

  const restart = useCallback(() => {
    finishedRef.current = false;
    setState(createInitialState());
  }, []);

  const selectedCrop = CROPS[state.selectedCrop];
  const market = marketMultiplier(state.day);
  const matureCount = state.plots.filter(isMature).length;
  const win = state.credits >= WIN_TARGET;
  const overlayOpen = state.phase !== 'running' || state.paused;
  const status =
    state.phase === 'ready'
      ? 'Season ready. Choose a crop and start the season.'
      : state.phase === 'over'
        ? `Season complete with ${state.credits} credits and ${state.harvested} harvests.`
        : `${state.day} of ${SEASON_DAYS} days. ${matureCount} crops ready. Water ${state.water}, energy ${state.energy}.`;

  return (
    <GameFrame
      title="Neon Harvest"
      subtitle="Grow the grid. Feed the rift."
      icon={Sprout}
      accent="mint"
      hud={
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <GameStat label="Day" value={`${state.day} / ${SEASON_DAYS}`} />
          <GameStat label="Credits" value={state.credits} tone="mint" />
          <GameStat label="Water" value={state.water} tone="electric" />
          <GameStat label="Energy" value={state.energy} tone="plasma" />
          <GameStat label="Market" value={`${market.toFixed(2)}x`} />
        </div>
      }
      toolbar={
        <>
          {state.phase === 'running' ? (
            <GameButton
              size="icon"
              variant="ghost"
              onClick={() => setState((current) => togglePause(current))}
              aria-label={state.paused ? 'Resume season' : 'Pause season'}
              title={state.paused ? 'Resume season' : 'Pause season'}
            >
              {state.paused ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </GameButton>
          ) : null}
          <GameButton
            size="sm"
            variant="ghost"
            onClick={() => setState((current) => cycleSpeed(current))}
            aria-label={`Simulation speed ${state.speed}x`}
            title="Change simulation speed"
          >
            <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
            {state.speed}x
          </GameButton>
          <GameButton
            size="icon"
            variant="ghost"
            onClick={restart}
            aria-label="Restart season"
            title="Restart season"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Days tick automatically while the season runs.</span>
          <span>
            Watering costs <b className="text-ink">{WATER_COST}</b> water; harvest mature crops before
            the season ends.
          </span>
          <span>
            Best balance: <b className="text-mint">{best === null ? '—' : `${best}c`}</b>
          </span>
        </div>
      }
    >
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <div className="relative flex-1">
        <div inert={overlayOpen ? true : undefined}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.plots.map((plot, index) => (
            <HarvestPlot
              key={index}
              plot={plot}
              state={state}
              index={index}
              onPlant={() => setState((current) => plant(current, index))}
              onWater={() => setState((current) => waterPlot(current, index))}
              onHarvest={() => setState((current) => harvest(current, index))}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <section aria-label="Seed selection" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Seeds
              </h3>
              <span className="text-[10px] text-muted/70">
                Selected: {selectedCrop.name}
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {CROP_ORDER.map((id) => {
                const crop = CROPS[id];
                const active = state.selectedCrop === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setState((current) => selectCrop(current, id))}
                    className={cn(
                      'rounded-xl border p-2.5 text-left transition',
                      active
                        ? 'border-mint/40 bg-mint/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <span aria-hidden="true">{cropIcon(id)}</span>
                      {crop.name}
                    </span>
                    <span className="mt-1 block text-[10px] leading-4 text-muted">
                      {crop.tagline} {crop.seedCost}c · {crop.growthDays} days
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-label="Farm upgrades" className="rounded-2xl border border-white/10 bg-night-900/70 p-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Upgrades
            </h3>
            <div className="mt-2 space-y-2">
              {FACILITY_ORDER.map((id) => {
                const spec = FACILITIES[id];
                const level = state.facilities[id];
                const full = level >= spec.max;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-mint">
                      {id === 'solar' ? (
                        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : id === 'recycler' ? (
                        <Waves className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
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
                      onClick={() => setState((current) => buyFacility(current, id))}
                      aria-label={`Build ${spec.name} for ${spec.cost} credits`}
                    >
                      {full ? 'Max' : `${spec.cost}c`}
                    </GameButton>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <ul className="mt-3 space-y-1 text-[10px] leading-4 text-muted" aria-label="Season log">
          {state.log.map((entry, index) => (
            <li key={`${entry}-${index}`} className="truncate">
              · {entry}
            </li>
          ))}
        </ul>
        </div>

        {state.phase === 'ready' ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mint">
              20-day season · {WIN_TARGET} credit target
            </p>
            <h3 className="font-display text-xl font-semibold text-ink">
              A rooftop farm on the rift grid
            </h3>
            <p className="max-w-sm text-xs leading-5 text-muted">
              Plant crops, keep them watered and powered, and sell before the season closes. Buy
              solar canopies, recyclers and a market uplink to scale up.
            </p>
            <GameButton variant="primary" onClick={beginSeason}>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start season
            </GameButton>
          </GameOverlay>
        ) : null}

        {state.phase === 'running' && state.paused ? (
          <GameOverlay>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
              Season paused
            </p>
            <h3 className="font-display text-lg font-semibold text-ink">The grid is holding</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <GameButton
                variant="primary"
                onClick={() => setState((current) => togglePause(current))}
              >
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
              <Coins className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-display text-xl font-semibold text-ink">
              {win ? 'Season profitable' : 'Season closed'}
            </h3>
            <p className="text-sm text-muted">
              Finished with <b className="text-ink">{state.credits}</b> credits and{' '}
              {state.harvested} harvest{state.harvested === 1 ? '' : 's'}.
            </p>
            <p className="text-[11px] text-muted">
              Target: {WIN_TARGET} credits · best {best === null ? '—' : `${best} credits`}
            </p>
            <GameButton variant="primary" onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Play again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>

      <span className="sr-only">
        <CalendarDays aria-hidden="true" /> Current day {state.day}; selected seed {selectedCrop.name};
        water {state.water}; energy {state.energy}.
      </span>
    </GameFrame>
  );
}
