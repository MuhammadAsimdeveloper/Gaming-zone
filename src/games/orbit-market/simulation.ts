export const MARKET_DAYS = 20;
export const MARKET_TARGET = 800;
export const MARKET_CARGO = 8;
export const MARKET_FUEL_MAX = 12;
export const MARKET_FUEL_COST = 10;
export const MARKET_TRAVEL_FUEL = 2;

export type GoodId = 'ore' | 'food' | 'tech';
export type StationId = 'helios' | 'vesta' | 'ceres' | 'nox';
export type MarketPhase = 'ready' | 'running' | 'over';

export interface GoodSpec {
  id: GoodId;
  name: string;
  basePrice: number;
  color: string;
}

export const GOODS: Record<GoodId, GoodSpec> = {
  ore: { id: 'ore', name: 'Rift ore', basePrice: 18, color: '#fbbf24' },
  food: { id: 'food', name: 'Hydro food', basePrice: 10, color: '#4ade9d' },
  tech: { id: 'tech', name: 'Sensor tech', basePrice: 45, color: '#b285ff' },
};

export const GOOD_ORDER: ReadonlyArray<GoodId> = ['ore', 'food', 'tech'];

export interface StationSpec {
  id: StationId;
  name: string;
  blurb: string;
  bias: Record<GoodId, number>;
}

export const STATIONS: Record<StationId, StationSpec> = {
  helios: {
    id: 'helios',
    name: 'Helios Station',
    blurb: 'Solar foundry — cheap ore, expensive food.',
    bias: { ore: 0.78, food: 1.32, tech: 0.95 },
  },
  vesta: {
    id: 'vesta',
    name: 'Vesta Market',
    blurb: 'Agricultural ring — cheap food, strong tech demand.',
    bias: { ore: 1.15, food: 0.72, tech: 1.28 },
  },
  ceres: {
    id: 'ceres',
    name: 'Ceres Yard',
    blurb: 'Shipbreaking yard — cheap tech, hungry for food.',
    bias: { ore: 1.05, food: 1.2, tech: 0.74 },
  },
  nox: {
    id: 'nox',
    name: 'Nox Exchange',
    blurb: 'Deep-space bazaar — volatile prices on everything.',
    bias: { ore: 1.18, food: 1.14, tech: 1.12 },
  },
};

export const STATION_ORDER: ReadonlyArray<StationId> = ['helios', 'vesta', 'ceres', 'nox'];

export type PriceTable = Record<StationId, Record<GoodId, number>>;

export interface MarketState {
  day: number;
  credits: number;
  fuel: number;
  cargo: Record<GoodId, number>;
  station: StationId;
  prices: PriceTable;
  phase: MarketPhase;
  seasonDays: number;
  log: string[];
}

export function generatePrices(day: number): PriceTable {
  const table = {} as PriceTable;
  for (const stationId of STATION_ORDER) {
    const station = STATIONS[stationId];
    const prices = {} as Record<GoodId, number>;
    GOOD_ORDER.forEach((goodId, goodIndex) => {
      const wave = 1 + Math.sin((day - 1) * 0.72 + goodIndex * 1.9 + STATION_ORDER.indexOf(stationId) * 1.1) * 0.12;
      prices[goodId] = Math.max(1, Math.round(GOODS[goodId].basePrice * station.bias[goodId] * wave));
    });
    table[stationId] = prices;
  }
  return table;
}

export function createMarketState(): MarketState {
  return {
    day: 1,
    credits: 250,
    fuel: 10,
    cargo: { ore: 0, food: 0, tech: 0 },
    station: 'helios',
    prices: generatePrices(1),
    phase: 'ready',
    seasonDays: MARKET_DAYS,
    log: ['Dock pass issued. Helios prices are on the board.'],
  };
}

export function cargoUsed(state: MarketState): number {
  return GOOD_ORDER.reduce((sum, good) => sum + state.cargo[good], 0);
}

export function startMarket(state: MarketState): MarketState {
  if (state.phase !== 'ready') return state;
  return { ...state, phase: 'running', log: ['Trading window open. Buy low, jump, sell high.'] };
}

export function buyGood(state: MarketState, good: GoodId, quantity: number): MarketState {
  if (state.phase !== 'running') return state;
  const price = state.prices[state.station][good];
  const affordable = Math.floor(state.credits / price);
  const space = MARKET_CARGO - cargoUsed(state);
  const amount = Math.max(0, Math.min(quantity, affordable, space));
  if (amount <= 0) return state;

  return {
    ...state,
    credits: state.credits - amount * price,
    cargo: { ...state.cargo, [good]: state.cargo[good] + amount },
    log: [`Bought ${amount} ${GOODS[good].name} at ${price}c each.`, ...state.log].slice(0, 5),
  };
}

export function sellGood(state: MarketState, good: GoodId, quantity: number): MarketState {
  if (state.phase !== 'running') return state;
  const amount = Math.max(0, Math.min(quantity, state.cargo[good]));
  if (amount <= 0) return state;
  const price = state.prices[state.station][good];

  return {
    ...state,
    credits: state.credits + amount * price,
    cargo: { ...state.cargo, [good]: state.cargo[good] - amount },
    log: [`Sold ${amount} ${GOODS[good].name} at ${price}c each.`, ...state.log].slice(0, 5),
  };
}

export function refuel(state: MarketState): MarketState {
  if (state.phase !== 'running' || state.credits < MARKET_FUEL_COST || state.fuel >= MARKET_FUEL_MAX) {
    return state;
  }
  return {
    ...state,
    credits: state.credits - MARKET_FUEL_COST,
    fuel: Math.min(MARKET_FUEL_MAX, state.fuel + 2),
    log: ['Refuelled at the dock.', ...state.log].slice(0, 5),
  };
}

export function travelTo(state: MarketState, station: StationId): MarketState {
  if (state.phase !== 'running' || station === state.station || state.fuel < MARKET_TRAVEL_FUEL) {
    return state;
  }

  const day = state.day + 1;
  const finished = day > state.seasonDays;
  const nextDay = finished ? state.seasonDays : day;

  return {
    ...state,
    day: nextDay,
    fuel: state.fuel - MARKET_TRAVEL_FUEL,
    station,
    prices: generatePrices(nextDay),
    phase: finished ? 'over' : 'running',
    log: [
      finished
        ? `Season closed at ${STATIONS[station].name} with ${state.credits} credits.`
        : `Jumped to ${STATIONS[station].name}. Day ${nextDay}.`,
      ...state.log,
    ].slice(0, 5),
  };
}

export function bestSale(state: MarketState): { good: GoodId; price: number } | null {
  let best: { good: GoodId; price: number } | null = null;
  for (const good of GOOD_ORDER) {
    const price = state.prices[state.station][good];
    if (!best || price > best.price) best = { good, price };
  }
  return best;
}
