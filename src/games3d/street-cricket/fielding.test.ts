import { describe, expect, it } from 'vitest';
import { resolveContact, type ContactInput, type ShotType } from './batting';
import { FIELDERS, resolveShot } from './fielding';

const SWEET: ContactInput = {
  timingOffset: 0,
  direction: 'straight',
  shotType: 'drive',
  line: 'middle',
  length: 'good',
};

function shot(overrides: Partial<ContactInput> = {}, rng: () => number = () => 0.5) {
  return resolveShot(resolveContact({ ...SWEET, ...overrides }), { fielders: true }, rng);
}

describe('resolveShot', () => {
  it('deploys nine fielders inside the rooftop', () => {
    expect(FIELDERS).toHaveLength(9);
    expect(new Set(FIELDERS.map((fielder) => fielder.id)).size).toBe(9);
  });

  it('bowls the batter when the swing misses entirely', () => {
    const result = shot({ timingOffset: 0.5 });
    expect(result.wicket).toBe('bowled');
    expect(result.batRuns).toBe(0);
    expect(result.extras).toBe(0);
    expect(result.legal).toBe(true);
    expect(result.boundary).toBeNull();
  });

  it('rewards a perfectly timed lofted straight hit with six', () => {
    const result = shot({ shotType: 'loft' });
    expect(result.boundary).toBe(6);
    expect(result.batRuns).toBe(6);
    expect(result.wicket).toBeNull();
    expect(result.note).toMatch(/six/i);
  });

  it('drives a perfectly timed ball hard into the outfield for multiple runs', () => {
    const result = shot();
    expect(result.wicket).toBeNull();
    expect(result.distance).toBeGreaterThan(25);
    expect(result.batRuns).toBeGreaterThanOrEqual(2);
    expect(result.batRuns).toBeLessThanOrEqual(4);
  });

  it('keeps a perfectly defended ball to a single or nothing', () => {
    const result = shot({ shotType: 'block' });
    expect(result.wicket).toBeNull();
    expect(result.batRuns).toBeLessThanOrEqual(1);
  });

  it('catches a skied mistimed loft under the deep fielder', () => {
    const contact = resolveContact({ ...SWEET, shotType: 'loft', timingOffset: 0.12 });
    const result = resolveShot(contact, { fielders: true }, () => 0);
    expect(result.wicket).toBe('caught');
    expect(result.note).toMatch(/catch|settles|skied/i);
  });

  it('gives a thick edge a chance of being caught behind', () => {
    const contact = resolveContact({ ...SWEET, timingOffset: 0.24 });
    const caught = resolveShot(contact, { fielders: true }, () => 0);
    const survived = resolveShot(contact, { fielders: true }, () => 0.999);
    expect(caught.wicket).toBe('caught');
    expect(survived.wicket).toBeNull();
    expect(survived.batRuns).toBe(1);
  });

  it('never catches anyone in a nets session with no fielders', () => {
    const contact = resolveContact({ ...SWEET, shotType: 'loft', timingOffset: 0.12 });
    const result = resolveShot(contact, { fielders: false }, () => 0);
    expect(result.wicket).toBeNull();
    expect(result.fielder).toBeNull();
  });

  it('records four when a ground shot beats the rope', () => {
    const contact = { ...resolveContact(SWEET), power: 1, quality: 1, launchAngle: 8 };
    const result = resolveShot(contact, { fielders: true }, () => 0.5);
    expect(result.boundary).toBe(4);
    expect(result.batRuns).toBe(4);
  });

  it('keeps every run value legal cricket scoring', () => {
    const shots: ShotType[] = ['block', 'drive', 'loft'];
    for (const shotType of shots) {
      for (const timingOffset of [-0.3, -0.1, 0, 0.1, 0.3, 0.6]) {
        for (const roll of [0, 0.5, 0.99]) {
          const result = shot({ shotType, timingOffset }, () => roll);
          expect([0, 1, 2, 3, 4, 6]).toContain(result.batRuns);
          expect(result.legal).toBe(true);
        }
      }
    }
  });
});
