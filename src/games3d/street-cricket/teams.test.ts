import { describe, expect, it } from 'vitest';
import { DISTRICTS, battingModifier, districtById, opponentFor } from './teams';

describe('districts', () => {
  it('fields six original districts with unique identities', () => {
    expect(DISTRICTS).toHaveLength(6);
    expect(new Set(DISTRICTS.map((district) => district.id)).size).toBe(6);
    expect(new Set(DISTRICTS.map((district) => district.name)).size).toBe(6);
  });

  it('keeps every modifier modest, inside five percent', () => {
    for (const district of DISTRICTS) {
      expect(district.power).toBeGreaterThan(0.3);
      expect(district.power).toBeLessThan(0.7);
      expect(district.control).toBeGreaterThan(0.3);
      expect(district.control).toBeLessThan(0.7);
      expect(battingModifier(district)).toBeGreaterThanOrEqual(0.95);
      expect(battingModifier(district)).toBeLessThanOrEqual(1.05);
    }
  });

  it('turns district power into a small batting edge', () => {
    const strongest = [...DISTRICTS].sort((a, b) => b.power - a.power)[0]!;
    const weakest = [...DISTRICTS].sort((a, b) => a.power - b.power)[0]!;
    expect(battingModifier(strongest)).toBeGreaterThan(battingModifier(weakest));
  });

  it('looks districts up by id with a safe fallback', () => {
    expect(districtById('harbour-row').name).toBe('Harbour Row');
    expect(districtById('missing-district').id).toBe(DISTRICTS[0]!.id);
  });

  it('picks a deterministic opponent that is never the player district', () => {
    const opponent = opponentFor('mint-terrace', () => 0.999);
    expect(opponent).not.toBe('mint-terrace');
    expect(opponentFor('mint-terrace', () => 0.999)).toBe(opponent);
    for (const roll of [0, 0.2, 0.5, 0.8, 0.999]) {
      expect(opponentFor('harbour-row', () => roll)).not.toBe('harbour-row');
    }
  });
});
