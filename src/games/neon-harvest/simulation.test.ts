import { describe, expect, it } from 'vitest';
import {
  CROPS,
  SEASON_DAYS,
  WIN_TARGET,
  advanceDay,
  buyFacility,
  createInitialState,
  harvest,
  isMature,
  marketMultiplier,
  plant,
  salePrice,
  selectCrop,
  startSeason,
  togglePause,
  waterPlot,
} from './simulation';

function running() {
  return startSeason(createInitialState());
}

describe('Neon Harvest simulation', () => {
  it('creates a ready season with nine empty plots', () => {
    const state = createInitialState();
    expect(state.phase).toBe('ready');
    expect(state.plots).toHaveLength(9);
    expect(state.plots.every((plot) => plot.crop === null)).toBe(true);
    expect(state.credits).toBeGreaterThan(0);
  });

  it('starts the season exactly once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startSeason(state)).toBe(state);
  });

  it('plants the selected crop and deducts its seed cost', () => {
    const state = plant(running(), 0);
    expect(state.plots[0]?.crop).toBe('lettuce');
    expect(state.credits).toBe(150 - CROPS.lettuce.seedCost);
    expect(state.plots[0]?.moisture).toBe(2);
  });

  it('refuses to plant when the plot is occupied or credits are short', () => {
    const planted = plant(running(), 0);
    expect(plant(planted, 0)).toBe(planted);
    expect(plant({ ...running(), credits: 0 }, 1).plots[1]?.crop).toBeNull();
  });

  it('waters a crop for two water and caps moisture at three', () => {
    const planted = plant(running(), 0);
    const watered = waterPlot(planted, 0);
    expect(watered.water).toBe(planted.water - 2);
    expect(watered.plots[0]?.moisture).toBe(3);
    expect(waterPlot(watered, 0)).toBe(watered);
  });

  it('advances a day, grows crops, and consumes water and energy', () => {
    const planted = plant(running(), 0);
    const next = advanceDay(planted);
    expect(next.day).toBe(2);
    expect(next.plots[0]?.growth).toBe(1);
    expect(next.plots[0]?.moisture).toBe(1);
    expect(next.energy).toBe(planted.energy + 8 - CROPS.lettuce.energyPerDay);
    expect(next.water).toBe(planted.water + 6);
  });

  it('stalls growth and damages health when a crop is dry', () => {
    const planted = plant(running(), 0);
    const dry = { ...planted, plots: planted.plots.map((plot) => ({ ...plot, moisture: 0 })) };
    const next = advanceDay(dry);
    expect(next.plots[0]?.growth).toBe(0);
    expect(next.plots[0]?.health).toBe(82);
  });

  it('harvests a mature crop for a market price', () => {
    const state = plant(running(), 0);
    const mature = {
      ...state,
      plots: state.plots.map((plot, index) =>
        index === 0 ? { ...plot, growth: CROPS.lettuce.growthDays, health: 100 } : plot,
      ),
    };
    const expected = salePrice(mature, mature.plots[0]!);
    const harvested = harvest(mature, 0);

    expect(harvested.credits).toBe(mature.credits + expected);
    expect(harvested.plots[0]?.crop).toBeNull();
    expect(harvested.harvested).toBe(1);
    expect(harvested.revenue).toBe(expected);
  });

  it('will not harvest an immature crop', () => {
    const planted = plant(running(), 0);
    expect(harvest(planted, 0)).toBe(planted);
    expect(isMature(planted.plots[0]!)).toBe(false);
  });

  it('buys facilities up to their maximum', () => {
    const state = { ...running(), credits: 500 };
    const bought = buyFacility(state, 'solar');
    expect(bought.facilities.solar).toBe(1);
    expect(bought.credits).toBe(425);

    const maxed = { ...bought, facilities: { ...bought.facilities, solar: 3 } };
    expect(buyFacility(maxed, 'solar')).toBe(maxed);
  });

  it('keeps market multipliers deterministic and near parity', () => {
    expect(marketMultiplier(3)).toBe(marketMultiplier(3));
    for (let day = 1; day <= SEASON_DAYS; day += 1) {
      expect(marketMultiplier(day)).toBeGreaterThan(0.7);
      expect(marketMultiplier(day)).toBeLessThan(1.3);
    }
  });

  it('closes the season after the last day and targets a win balance', () => {
    let state = running();
    for (let day = 1; day <= SEASON_DAYS; day += 1) state = advanceDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(SEASON_DAYS);
    expect(WIN_TARGET).toBeGreaterThan(0);
  });

  it('pauses and resumes without changing the day', () => {
    const state = running();
    const paused = togglePause(state);
    expect(paused.paused).toBe(true);
    expect(advanceDay(paused)).toBe(paused);
    expect(togglePause(paused).paused).toBe(false);
  });

  it('selects only known crops', () => {
    expect(selectCrop(running(), 'melon').selectedCrop).toBe('melon');
  });
});
