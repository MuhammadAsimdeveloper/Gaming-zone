import { describe, expect, it } from 'vitest';
import { directionAngle, resolveContact, type ContactInput } from './batting';

const SWEET: ContactInput = {
  timingOffset: 0,
  direction: 'cover',
  shotType: 'drive',
  line: 'off',
  length: 'good',
};

describe('resolveContact', () => {
  it('awards near-full quality to a perfectly timed, well-matched shot', () => {
    const contact = resolveContact(SWEET);
    expect(contact.grade).toBe('perfect');
    expect(contact.missed).toBe(false);
    expect(contact.quality).toBeGreaterThan(0.9);
    expect(contact.power).toBeGreaterThan(0.7);
  });

  it('is symmetric around the ideal instant', () => {
    const early = resolveContact({ ...SWEET, timingOffset: -0.05 });
    const late = resolveContact({ ...SWEET, timingOffset: 0.05 });
    expect(early.grade).toBe('good');
    expect(late.grade).toBe('good');
    expect(early.quality).toBeCloseTo(late.quality, 6);
  });

  it('misses entirely when the swing is badly timed', () => {
    const contact = resolveContact({ ...SWEET, timingOffset: 0.42 });
    expect(contact.missed).toBe(true);
    expect(contact.quality).toBe(0);
    expect(contact.power).toBe(0);
  });

  it('turns a barely-timed swing into a weak edge', () => {
    const contact = resolveContact({ ...SWEET, timingOffset: 0.24 });
    expect(contact.grade).toBe('edge');
    expect(contact.edge).toBe(true);
    expect(contact.quality).toBeLessThan(0.3);
    expect(contact.launchAngle).toBeGreaterThan(30);
  });

  it('penalises aiming away from the line of the ball', () => {
    const matched = resolveContact(SWEET);
    const mistimed = resolveContact({ ...SWEET, direction: 'leg' });
    expect(mistimed.quality).toBeLessThan(matched.quality);
  });

  it('rewards driving a full ball over blocking it', () => {
    const drive = resolveContact({ ...SWEET, length: 'full', direction: 'straight', shotType: 'drive' });
    const block = resolveContact({ ...SWEET, length: 'full', direction: 'straight', shotType: 'block' });
    expect(drive.quality).toBeGreaterThan(block.quality);
  });

  it('launches a lofted shot higher than a drive and a drive higher than a block', () => {
    const loft = resolveContact({ ...SWEET, shotType: 'loft' });
    const drive = resolveContact(SWEET);
    const block = resolveContact({ ...SWEET, shotType: 'block' });
    expect(loft.launchAngle).toBeGreaterThan(drive.launchAngle);
    expect(drive.launchAngle).toBeGreaterThan(block.launchAngle);
  });

  it('narrates the result with an original one-liner', () => {
    expect(resolveContact(SWEET).note.length).toBeGreaterThan(4);
    expect(resolveContact({ ...SWEET, timingOffset: 0.42 }).note).toMatch(/beat|miss/i);
  });
});

describe('directionAngle', () => {
  it('points straight down the ground at zero', () => {
    expect(directionAngle('straight')).toBe(0);
  });

  it('orders the off side negative and the leg side positive', () => {
    expect(directionAngle('fine')).toBeLessThan(directionAngle('point'));
    expect(directionAngle('point')).toBeLessThan(directionAngle('cover'));
    expect(directionAngle('cover')).toBeLessThan(directionAngle('straight'));
    expect(directionAngle('straight')).toBeLessThan(directionAngle('midwicket'));
    expect(directionAngle('midwicket')).toBeLessThan(directionAngle('leg'));
  });
});
