export const PLOT_COUNT = 9;
export const SEASON_DAYS = 20;
export const WIN_TARGET = 650;
export const WATER_COST = 2;
export const MOISTURE_MAX = 3;
export const WATER_CAP = 60;
export const ENERGY_CAP = 60;

export type CropId = 'lettuce' | 'tomato' | 'melon';
export type FacilityId = 'solar' | 'recycler' | 'market';
export type Phase = 'ready' | 'running' | 'over';
export type Speed = 1 | 2;

export interface CropSpec {
  id: CropId;
  name: string;
  tagline: string;
  seedCost: number;
  growthDays: number;
  energyPerDay: number;
  basePrice: number;
}

export const CROPS: Record<CropId, CropSpec> = {
  lettuce: {
    id: 'lettuce',
    name: 'Rift Lettuce',
    tagline: 'Quick, cheap, reliable.',
    seedCost: 12,
    growthDays: 3,
    energyPerDay: 2,
    basePrice: 34,
  },
  tomato: {
    id: 'tomato',
    name: 'Volt Tomato',
    tagline: 'Better margin, thirstier.',
    seedCost: 24,
    growthDays: 4,
    energyPerDay: 3,
    basePrice: 72,
  },
  melon: {
    id: 'melon',
    name: 'Glow Melon',
    tagline: 'Slow, hungry, lucrative.',
    seedCost: 42,
    growthDays: 6,
    energyPerDay: 5,
    basePrice: 160,
  },
};

export const CROP_ORDER: ReadonlyArray<CropId> = ['lettuce', 'tomato', 'melon'];

export interface FacilitySpec {
  id: FacilityId;
  name: string;
  description: string;
  cost: number;
  max: number;
}

export const FACILITIES: Record<FacilityId, FacilitySpec> = {
  solar: {
    id: 'solar',
    name: 'Solar canopy',
    description: '+7 energy every morning.',
    cost: 75,
    max: 3,
  },
  recycler: {
    id: 'recycler',
    name: 'Water recycler',
    description: '+6 water every morning.',
    cost: 70,
    max: 3,
  },
  market: {
    id: 'market',
    name: 'Market uplink',
    description: '+10% sale value per level.',
    cost: 110,
    max: 2,
  },
};

export const FACILITY_ORDER: ReadonlyArray<FacilityId> = ['solar', 'recycler', 'market'];

export interface Plot {
  crop: CropId | null;
  growth: number;
  moisture: number;
  health: number;
}

export interface Facilities {
  solar: number;
  recycler: number;
  market: number;
}

export interface GameState {
  day: number;
  credits: number;
  water: number;
  energy: number;
  plots: Plot[];
  facilities: Facilities;
  selectedCrop: CropId;
  phase: Phase;
  paused: boolean;
  speed: Speed;
  harvested: number;
  revenue: number;
  log: string[];
  seasonDays: number;
}

export function createEmptyPlot(): Plot {
  return { crop: null, growth: 0, moisture: 0, health: 100 };
}

export function createInitialState(): GameState {
  return {
    day: 1,
    credits: 150,
    water: 24,
    energy: 24,
    plots: Array.from({ length: PLOT_COUNT }, createEmptyPlot),
    facilities: { solar: 0, recycler: 0, market: 0 },
    selectedCrop: 'lettuce',
    phase: 'ready',
    paused: false,
    speed: 1,
    harvested: 0,
    revenue: 0,
    log: ['Season ready. Plant a crop, then keep the water and power flowing.'],
    seasonDays: SEASON_DAYS,
  };
}

export function startSeason(state: GameState): GameState {
  if (state.phase !== 'ready') return state;
  return {
    ...state,
    phase: 'running',
    paused: false,
    log: ['Season started. The market moves every day.'],
  };
}

export function togglePause(state: GameState): GameState {
  if (state.phase !== 'running') return state;
  return { ...state, paused: !state.paused };
}

export function cycleSpeed(state: GameState): GameState {
  return { ...state, speed: state.speed === 1 ? 2 : 1 };
}

export function selectCrop(state: GameState, crop: CropId): GameState {
  if (!CROPS[crop]) return state;
  return { ...state, selectedCrop: crop };
}

export function plant(state: GameState, index: number): GameState {
  const plot = state.plots[index];
  const spec = CROPS[state.selectedCrop];
  if (!plot || plot.crop || state.phase !== 'running' || state.credits < spec.seedCost) return state;

  const plots = state.plots.slice();
  plots[index] = { crop: spec.id, growth: 0, moisture: 2, health: 100 };

  return {
    ...state,
    credits: state.credits - spec.seedCost,
    plots,
    log: [`Planted ${spec.name} in plot ${index + 1}.`, ...state.log].slice(0, 4),
  };
}

export function waterPlot(state: GameState, index: number): GameState {
  const plot = state.plots[index];
  if (
    !plot?.crop ||
    state.phase !== 'running' ||
    plot.moisture >= MOISTURE_MAX ||
    state.water < WATER_COST
  ) {
    return state;
  }

  const plots = state.plots.slice();
  plots[index] = { ...plot, moisture: Math.min(MOISTURE_MAX, plot.moisture + 2) };

  return { ...state, water: state.water - WATER_COST, plots };
}

export function harvest(state: GameState, index: number): GameState {
  const plot = state.plots[index];
  if (!plot?.crop || state.phase !== 'running') return state;

  const spec = CROPS[plot.crop];
  if (plot.growth < spec.growthDays) return state;

  const payout = salePrice(state, plot);
  const plots = state.plots.slice();
  plots[index] = createEmptyPlot();

  return {
    ...state,
    credits: state.credits + payout,
    harvested: state.harvested + 1,
    revenue: state.revenue + payout,
    plots,
    log: [`Sold ${spec.name} for ${payout} credits.`, ...state.log].slice(0, 4),
  };
}

export function buyFacility(state: GameState, id: FacilityId): GameState {
  const spec = FACILITIES[id];
  const level = state.facilities[id];
  if (state.phase !== 'running' || level >= spec.max || state.credits < spec.cost) return state;

  return {
    ...state,
    credits: state.credits - spec.cost,
    facilities: { ...state.facilities, [id]: level + 1 },
    log: [`Built ${spec.name} (level ${level + 1}).`, ...state.log].slice(0, 4),
  };
}

export function advanceDay(state: GameState): GameState {
  if (state.phase !== 'running' || state.paused) return state;

  let water = Math.min(WATER_CAP, state.water + 6 + state.facilities.recycler * 6);
  let energy = Math.min(ENERGY_CAP, state.energy + 8 + state.facilities.solar * 7);
  let wilting = 0;
  let brownout = 0;
  let ready = 0;

  const plots = state.plots.map((plot) => {
    if (!plot.crop) return plot;
    const spec = CROPS[plot.crop];
    if (plot.moisture > 0 && energy >= spec.energyPerDay) {
      energy -= spec.energyPerDay;
      const growth = Math.min(spec.growthDays, plot.growth + 1);
      if (growth >= spec.growthDays && plot.growth < spec.growthDays) ready += 1;
      return {
        ...plot,
        growth,
        moisture: plot.moisture - 1,
        health: Math.min(100, plot.health + 3),
      };
    }

    if (plot.moisture <= 0) wilting += 1;
    else brownout += 1;
    return { ...plot, health: Math.max(0, plot.health - 18) };
  });

  const nextDay = state.day + 1;
  const finished = nextDay > state.seasonDays;
  const log = [...state.log];

  if (wilting > 0) log.unshift(`${wilting} crop${wilting === 1 ? '' : 's'} wilted without water.`);
  if (brownout > 0) log.unshift(`Power shortfall stalled ${brownout} crop${brownout === 1 ? '' : 's'}.`);
  if (ready > 0) log.unshift(`${ready} crop${ready === 1 ? '' : 's'} ready to harvest.`);
  if (finished) log.unshift(`Season closed. Final balance ${state.credits} credits.`);

  return {
    ...state,
    day: finished ? state.seasonDays : nextDay,
    water,
    energy,
    plots,
    phase: finished ? 'over' : 'running',
    paused: finished,
    log: log.slice(0, 4),
  };
}

/** Deterministic market cycle, so two players on the same day see the same price. */
export function marketMultiplier(day: number): number {
  const slow = Math.sin((day - 1) * 0.62) * 0.1;
  const fast = Math.sin((day - 1) * 0.21 + 1.3) * 0.07;
  return Math.round((1 + slow + fast) * 100) / 100;
}

export function salePrice(state: GameState, plot: Plot): number {
  if (!plot.crop) return 0;
  const spec = CROPS[plot.crop];
  const quality = 0.5 + (plot.health / 100) * 0.5;
  const terminal = 1 + state.facilities.market * 0.1;
  return Math.max(1, Math.round(spec.basePrice * marketMultiplier(state.day) * quality * terminal));
}

export function isMature(plot: Plot): boolean {
  return Boolean(plot.crop) && plot.growth >= CROPS[plot.crop as CropId].growthDays;
}

export function totalCropDemand(state: GameState, id: 'water' | 'energy'): number {
  return state.plots.reduce((total, plot) => {
    if (!plot.crop) return total;
    const spec = CROPS[plot.crop];
    return total + (id === 'energy' ? spec.energyPerDay : 1);
  }, 0);
}
