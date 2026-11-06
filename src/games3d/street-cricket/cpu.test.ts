import { describe, expect, it } from 'vitest';
import { resolveContact, type ShotDirection, type ShotType } from './batting';
import { planCpuShot } from './cpu';
import { createDelivery, type BowlingInput } from './delivery';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INPUT: BowlingInput = { line: 'middle', length: 'good', variation: 'stock' };
const DIRECTIONS: ReadonlyArray<ShotDirection> = ['fine', 'point', 'cover', 'straight', 'midwicket', 'leg'];
const TYPES: ReadonlyArray<ShotType> = ['block', 'drive', 'loft'];

describe('planCpuShot', () => {
  it('is deterministic for a seed', () => {
    const delivery = createDelivery(INPUT, mulberry32(1));
    const a = planCpuShot(delivery, 0.55, mulberry32(7));
    const b = planCpuShot(delivery, 0.55, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('keeps every plan inside the valid shot vocabulary', () => {
    const delivery = createDelivery(INPUT, mulberry32(2));
    const rng = mulberry32(3);
    for (let index = 0; index < 100; index += 1) {
      const plan = planCpuShot(delivery, 0.5, rng);
      expect(DIRECTIONS).toContain(plan.direction);
      expect(TYPES).toContain(plan.shotType);
      expect(Math.abs(plan.timingOffset)).toBeLessThanOrEqual(0.2);
    }
  });

  it('gives a skilled batter tighter timing than a weak one', () => {
    const delivery = createDelivery(INPUT, mulberry32(4));
    let skilledError = 0;
    let weakError = 0;
    const skilled = mulberry32(11);
    const weak = mulberry32(11);
    for (let index = 0; index < 300; index += 1) {
      skilledError += Math.abs(planCpuShot(delivery, 0.8, skilled).timingOffset);
      weakError += Math.abs(planCpuShot(delivery, 0.35, weak).timingOffset);
    }
    expect(skilledError).toBeLessThan(weakError);
  });

  it('produces better contact on average with more skill', () => {
    const delivery = createDelivery(INPUT, mulberry32(5));
    const score = (skill: number): number => {
      const rng = mulberry32(21);
      let total = 0;
      for (let index = 0; index < 200; index += 1) {
        total += resolveContact(planCpuShot(delivery, skill, rng)).quality;
      }
      return total / 200;
    };
    expect(score(0.8)).toBeGreaterThan(score(0.35));
  });

  it('attacks short balls in the air more often than full ones', () => {
    const countLofts = (length: BowlingInput['length']): number => {
      const delivery = createDelivery({ ...INPUT, length }, mulberry32(6));
      const rng = mulberry32(31);
      let lofts = 0;
      for (let index = 0; index < 400; index += 1) {
        if (planCpuShot(delivery, 0.5, rng).shotType === 'loft') lofts += 1;
      }
      return lofts;
    };
    expect(countLofts('short')).toBeGreaterThan(countLofts('full'));
  });
});
