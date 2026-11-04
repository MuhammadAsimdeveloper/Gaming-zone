import { describe, expect, it } from 'vitest';
import {
  GOODS,
  MARKET_CARGO,
  MARKET_DAYS,
  MARKET_FUEL_COST,
  MARKET_TARGET,
  buyGood,
  cargoUsed,
  createMarketState,
  generatePrices,
  refuel,
  sellGood,
  startMarket,
  travelTo,
} from './simulation';

function running() {
  return startMarket(createMarketState());
}

describe('Orbit Market simulation', () => {
  it('starts ready with credits, fuel and a price table', () => {
    const state = createMarketState();
    expect(state.phase).toBe('ready');
    expect(state.credits).toBeGreaterThan(0);
    expect(state.prices.helios.ore).toBeGreaterThan(0);
    expect(cargoUsed(state)).toBe(0);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startMarket(state)).toBe(state);
  });

  it('buys goods only when affordable and within cargo', () => {
    const state = running();
    const bought = buyGood(state, 'ore', 1);
    expect(bought.cargo.ore).toBe(1);
    expect(bought.credits).toBeLessThan(state.credits);

    const full = { ...bought, cargo: { ore: MARKET_CARGO, food: 0, tech: 0 } };
    expect(buyGood(full, 'ore', 1)).toBe(full);
  });

  it('sells goods for the current station price', () => {
    const state = { ...running(), cargo: { ore: 2, food: 0, tech: 0 } };
    const price = state.prices[state.station].ore;
    const sold = sellGood(state, 'ore', 1);
    expect(sold.credits).toBe(state.credits + price);
    expect(sold.cargo.ore).toBe(1);
  });

  it('refuels for credits and caps the tank', () => {
    const state = { ...running(), fuel: 2 };
    const filled = refuel(state);
    expect(filled.fuel).toBe(4);
    expect(filled.credits).toBe(state.credits - MARKET_FUEL_COST);

    const full = { ...state, fuel: 12 };
    expect(refuel(full)).toBe(full);
  });

  it('travels to a new station, spends fuel and advances the day', () => {
    const state = running();
    const next = travelTo(state, 'vesta');
    expect(next.station).toBe('vesta');
    expect(next.day).toBe(2);
    expect(next.fuel).toBe(state.fuel - 2);
    expect(next.prices).toEqual(generatePrices(2));
  });

  it('does not travel without fuel or to the same station', () => {
    const state = running();
    expect(travelTo(state, state.station)).toBe(state);
    const dry = { ...state, fuel: 1 };
    expect(travelTo(dry, 'vesta')).toBe(dry);
  });

  it('generates deterministic prices', () => {
    expect(generatePrices(4)).toEqual(generatePrices(4));
    expect(generatePrices(1)).not.toEqual(generatePrices(9));
  });

  it('closes the market after the last travel day', () => {
    let state = running();
    for (let day = 1; day <= MARKET_DAYS; day += 1) {
      state = travelTo({ ...state, fuel: 12 }, day % 2 === 0 ? 'vesta' : 'ceres');
    }
    expect(state.phase).toBe('over');
    expect(state.day).toBe(MARKET_DAYS);
  });

  it('keeps prices tied to real good definitions', () => {
    const state = running();
    for (const good of ['ore', 'food', 'tech'] as const) {
      expect(state.prices[state.station][good]).toBeGreaterThan(0);
      expect(GOODS[good].name.length).toBeGreaterThan(0);
    }
    expect(MARKET_TARGET).toBeGreaterThan(0);
  });
});
