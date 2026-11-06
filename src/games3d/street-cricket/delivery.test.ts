import { describe, expect, it } from 'vitest';
import {
  bounceDistance,
  contactTimingGrade,
  createDelivery,
  deliveryLabel,
  lineOffset,
  type BowlingInput,
} from './delivery';

const STOCK: BowlingInput = { line: 'middle', length: 'good', variation: 'stock' };

describe('bowling geometry', () => {
  it('puts off line on the off side of middle and leg line on the leg side', () => {
    expect(lineOffset('off')).toBeGreaterThan(lineOffset('middle'));
    expect(lineOffset('middle')).toBe(0);
    expect(lineOffset('leg')).toBeLessThan(lineOffset('middle'));
  });

  it('pitches a short ball further from the batter than a good length, and a full ball closer', () => {
    expect(bounceDistance('short')).toBeGreaterThan(bounceDistance('good'));
    expect(bounceDistance('good')).toBeGreaterThan(bounceDistance('full'));
    expect(bounceDistance('full')).toBeGreaterThan(0);
  });
});

describe('createDelivery', () => {
  it('is deterministic for a given seed', () => {
    const a = createDelivery(STOCK, () => 0.42);
    const b = createDelivery(STOCK, () => 0.42);
    expect(a).toEqual(b);
  });

  it('maps line and length onto the delivery', () => {
    const delivery = createDelivery({ line: 'leg', length: 'short', variation: 'spin' }, () => 0.5);
    expect(delivery.line).toBe('leg');
    expect(delivery.length).toBe('short');
    expect(delivery.lineX).toBe(lineOffset('leg'));
    expect(delivery.bounceZ).toBe(bounceDistance('short'));
  });

  it('makes pace quicker than stock and spin slower', () => {
    const stock = createDelivery(STOCK, () => 0.5);
    const pace = createDelivery({ ...STOCK, variation: 'pace' }, () => 0.5);
    const spin = createDelivery({ ...STOCK, variation: 'spin' }, () => 0.5);
    expect(pace.speedKph).toBeGreaterThan(stock.speedKph);
    expect(spin.speedKph).toBeLessThan(stock.speedKph);
  });

  it('caps swing so no delivery becomes unplayable', () => {
    const wild = createDelivery({ ...STOCK, variation: 'spin' }, () => 0.999);
    expect(Math.abs(wild.swing)).toBeLessThanOrEqual(0.35);
  });

  it('derives an arrival time that a good-length ball reaches before a short one', () => {
    const good = createDelivery({ ...STOCK, length: 'good' }, () => 0.5);
    const short = createDelivery({ ...STOCK, length: 'short' }, () => 0.5);
    expect(good.arrivalSeconds).toBeLessThan(short.arrivalSeconds);
    expect(good.arrivalSeconds).toBeGreaterThan(0.3);
  });

  it('describes itself in plain commentary language', () => {
    expect(deliveryLabel({ ...STOCK, length: 'full', variation: 'spin' })).toMatch(/full/i);
    expect(deliveryLabel({ ...STOCK, line: 'leg' })).toMatch(/leg/i);
  });
});

describe('contactTimingGrade', () => {
  it('is perfect on the ideal instant', () => {
    expect(contactTimingGrade(0)).toBe('perfect');
  });

  it('grades a 70 ms perfect window symmetrically', () => {
    expect(contactTimingGrade(0.03)).toBe('perfect');
    expect(contactTimingGrade(-0.03)).toBe('perfect');
    expect(contactTimingGrade(0.05)).toBe('good');
    expect(contactTimingGrade(-0.05)).toBe('good');
  });

  it('falls off through ok and edge before a miss', () => {
    expect(contactTimingGrade(0.12)).toBe('ok');
    expect(contactTimingGrade(0.22)).toBe('edge');
    expect(contactTimingGrade(0.4)).toBe('miss');
    expect(contactTimingGrade(-0.4)).toBe('miss');
  });
});
