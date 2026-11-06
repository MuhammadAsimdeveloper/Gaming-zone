import { describe, expect, it } from 'vitest';
import {
  DINER_DAYS,
  DINER_TARGET,
  MENU,
  addTables,
  adjustPrice,
  advanceDinerDay,
  averagePrice,
  createDinerState,
  customerDemand,
  hireStaff,
  seatCapacity,
  startDiner,
} from './simulation';

function running() {
  return startDiner(createDinerState());
}

describe('Neon Diner simulation', () => {
  it('starts ready with a menu, staff and tables', () => {
    const state = createDinerState();
    expect(state.phase).toBe('ready');
    expect(state.credits).toBe(200);
    expect(seatCapacity(state)).toBe(26);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startDiner(state)).toBe(state);
  });

  it('adjusts prices within their bounds', () => {
    const state = running();
    expect(adjustPrice(state, 'burger', 1).prices.burger).toBe(13);
    expect(adjustPrice(state, 'burger', -100).prices.burger).toBe(MENU.burger.cost + 1);
    expect(adjustPrice(state, 'burger', 100).prices.burger).toBe(25);
  });

  it('hires staff and adds tables for credits', () => {
    const state = { ...running(), credits: 500 };
    const hired = hireStaff(state);
    expect(hired.staff).toBe(3);
    expect(hired.credits).toBe(420);
    const added = addTables(hired);
    expect(added.tables).toBe(6);
    expect(added.credits).toBe(350);
  });

  it('raises demand when prices are lower', () => {
    const state = running();
    const cheaper = { ...state, prices: { burger: 8, noodles: 7, shake: 5 } };
    expect(customerDemand(cheaper)).toBeGreaterThan(customerDemand(state));
  });

  it('serves at most the seat capacity and records revenue', () => {
    const state = running();
    const next = advanceDinerDay(state);
    expect(next.customers).toBeGreaterThan(0);
    expect(next.served).toBeLessThanOrEqual(seatCapacity(state));
    expect(next.revenue).toBeGreaterThan(0);
    expect(next.totalServed).toBe(next.served);
  });

  it('keeps reputation in a valid range after service', () => {
    const state = { ...running(), reputation: 70 };
    const next = advanceDinerDay(state);
    expect(next.reputation).toBeGreaterThanOrEqual(0);
    expect(next.reputation).toBeLessThanOrEqual(100);
  });

  it('computes an average menu price', () => {
    const state = running();
    expect(averagePrice(state)).toBe(9);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= DINER_DAYS; day += 1) state = advanceDinerDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(DINER_DAYS);
    expect(DINER_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceDinerDay(paused)).toBe(paused);
  });

  it('does not let maxed prices beat a balanced menu across the season', () => {
    const runSeason = (prices: { burger: number; noodles: number; shake: number }) => {
      let state = { ...running(), prices };
      for (let day = 1; day <= DINER_DAYS; day += 1) state = advanceDinerDay(state);
      return state;
    };

    const balanced = runSeason({ burger: 12, noodles: 9, shake: 6 });
    const gouged = runSeason({ burger: 25, noodles: 25, shake: 25 });

    expect(balanced.credits).toBeGreaterThan(gouged.credits);
  });

  it('drops reputation when the menu is priced at the cap', () => {
    let state = { ...running(), prices: { burger: 25, noodles: 25, shake: 25 } };
    for (let day = 1; day <= 5; day += 1) state = advanceDinerDay(state);

    expect(state.reputation).toBeLessThan(70);
  });
});
