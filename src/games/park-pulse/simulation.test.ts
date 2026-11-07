import { describe, expect, it } from 'vitest';
import {
  PARK_DAYS,
  PARK_TARGET,
  adjustTicket,
  advanceParkDay,
  buildRide,
  createParkState,
  hireParkStaff,
  parkCapacity,
  parkDemand,
  runCampaign,
  startPark,
  type ParkState,
} from './simulation';

function running() {
  return startPark(createParkState());
}

function playSeason(act: (state: ParkState) => ParkState): ParkState {
  let state = act(running());
  while (state.phase === 'running') state = advanceParkDay(act(state));
  return state;
}

function runThePark(ticket: number, campaigns: number) {
  return (state: ParkState): ParkState => {
    let next = state;
    for (let step = 0; step < 3; step += 1) {
      if (next.ticket < ticket) {
        next = adjustTicket(next, 2);
        continue;
      }
      if (next.marketing < campaigns && next.credits >= 150) {
        next = runCampaign(next);
        continue;
      }
      if (parkCapacity(next) < parkDemand(next) * 1.15 && next.credits >= 400) {
        next = next.rides < 10 && next.rides * 32 <= next.staff * 6 ? buildRide(next) : hireParkStaff(next);
        continue;
      }
      break;
    }
    return next;
  };
}

describe('Park Pulse simulation', () => {
  it('starts ready with four rides and five staff', () => {
    const state = createParkState();
    expect(state.phase).toBe('ready');
    expect(state.rides).toBe(4);
    expect(parkCapacity(state)).toBe(158);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startPark(state)).toBe(state);
  });

  it('adjusts the ticket within bounds', () => {
    const state = running();
    expect(adjustTicket(state, 2).ticket).toBe(24);
    expect(adjustTicket(state, -100).ticket).toBe(8);
    expect(adjustTicket(state, 100).ticket).toBe(45);
  });

  it('builds rides, hires staff and runs campaigns', () => {
    const state = { ...running(), credits: 500 };
    const ride = buildRide(state);
    expect(ride.rides).toBe(5);
    expect(ride.credits).toBe(360);
    const staff = hireParkStaff(ride);
    expect(staff.staff).toBe(6);
    expect(staff.credits).toBe(310);
    const campaign = runCampaign(staff);
    expect(campaign.marketing).toBe(1);
    expect(campaign.credits).toBe(220);
  });

  it('reduces demand when the ticket gets expensive', () => {
    const state = running();
    expect(parkDemand(adjustTicket(state, 15))).toBeLessThan(parkDemand(state));
  });

  it('serves at most the ride capacity and records revenue', () => {
    const state = running();
    const next = advanceParkDay(state);
    expect(next.visitors).toBeGreaterThan(0);
    expect(next.served).toBeLessThanOrEqual(parkCapacity(state));
    expect(next.revenue).toBeGreaterThan(0);
  });

  it('keeps reputation in range', () => {
    const next = advanceParkDay(running());
    expect(next.reputation).toBeGreaterThanOrEqual(0);
    expect(next.reputation).toBeLessThanOrEqual(100);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= PARK_DAYS; day += 1) state = advanceParkDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(PARK_DAYS);
    expect(PARK_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceParkDay(paused)).toBe(paused);
  });

  it('rewards pricing, marketing and capacity over idling through the season', () => {
    const passive = playSeason((state) => state);
    const active = playSeason(runThePark(30, 2));

    expect(passive.credits).toBeLessThan(PARK_TARGET);
    expect(active.credits).toBeGreaterThanOrEqual(PARK_TARGET);
  });
});
