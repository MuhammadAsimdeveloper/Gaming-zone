import { describe, expect, it } from 'vitest';
import {
  HOSPITAL_DAYS,
  HOSPITAL_TARGET,
  addBed,
  advanceHospitalDay,
  createHospitalState,
  hireDoctor,
  hireNurse,
  hospitalCapacity,
  patientDemand,
  startHospital,
} from './simulation';

function running() {
  return startHospital(createHospitalState());
}

describe('Rift Hospital simulation', () => {
  it('starts ready with eight beds and a combined capacity of eight', () => {
    const state = createHospitalState();
    expect(state.phase).toBe('ready');
    expect(hospitalCapacity(state)).toBe(8);
  });

  it('starts once', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(startHospital(state)).toBe(state);
  });

  it('expands beds, doctors and nurses for credits', () => {
    const state = { ...running(), credits: 500 };
    const beds = addBed(state);
    expect(beds.beds).toBe(10);
    expect(beds.credits).toBe(420);
    const doctor = hireDoctor(beds);
    expect(doctor.doctors).toBe(4);
    expect(doctor.credits).toBe(320);
    const nurse = hireNurse(doctor);
    expect(nurse.nurses).toBe(5);
    expect(nurse.credits).toBe(265);
  });

  it('uses the tightest of beds, doctors and nurses', () => {
    const state = { ...running(), beds: 20, doctors: 1, nurses: 12 };
    expect(hospitalCapacity(state)).toBe(4);
  });

  it('computes deterministic patient demand', () => {
    expect(patientDemand(5)).toBe(patientDemand(5));
  });

  it('treats at most the clinic capacity and records critical cases', () => {
    const state = running();
    const next = advanceHospitalDay(state);
    expect(next.treated).toBeLessThanOrEqual(hospitalCapacity(state));
    expect(next.critical).toBeGreaterThan(0);
    expect(next.totalTreated).toBe(next.treated);
  });

  it('loses reputation when patients are left untreated', () => {
    const state = { ...running(), reputation: 70 };
    const next = advanceHospitalDay(state);
    expect(next.reputation).toBeLessThan(state.reputation);
  });

  it('closes the season after the final day', () => {
    let state = running();
    for (let day = 1; day <= HOSPITAL_DAYS; day += 1) state = advanceHospitalDay(state);

    expect(state.phase).toBe('over');
    expect(state.paused).toBe(true);
    expect(state.day).toBe(HOSPITAL_DAYS);
    expect(HOSPITAL_TARGET).toBeGreaterThan(0);
  });

  it('does not advance while paused', () => {
    const paused = { ...running(), paused: true };
    expect(advanceHospitalDay(paused)).toBe(paused);
  });

  it('closes early when the clinic cannot pay its bills', () => {
    const strained = { ...running(), credits: 10, beds: 1, doctors: 1, nurses: 1 };

    const next = advanceHospitalDay(strained);

    expect(next.credits).toBeLessThan(0);
    expect(next.phase).toBe('over');
    expect(next.log.some((entry) => /insolvent/i.test(entry))).toBe(true);
  });
});
