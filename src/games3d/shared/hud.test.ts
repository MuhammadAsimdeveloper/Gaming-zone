import { describe, expect, it } from 'vitest';
import { HudPump, hudEqual } from './hud';

describe('HudPump', () => {
  it('emits at a bounded rate when the payload changes', () => {
    const seen: Array<{ speed: number }> = [];
    const pump = new HudPump<{ speed: number }>((hud) => seen.push(hud), 0.1);

    for (let frame = 0; frame < 60; frame += 1) {
      const speed = frame;
      pump.push(1 / 60, () => ({ speed }));
    }
    expect(seen.length).toBe(10);
  });

  it('skips identical payloads until forced', () => {
    const seen: Array<{ speed: number }> = [];
    const pump = new HudPump<{ speed: number }>((hud) => seen.push(hud), 0.1);
    const speed = 0;

    for (let frame = 0; frame < 6; frame += 1) {
      pump.push(1 / 60, () => ({ speed }));
    }
    expect(seen.length).toBe(1);

    for (let frame = 0; frame < 30; frame += 1) {
      pump.push(1 / 60, () => ({ speed }));
    }
    expect(seen.length).toBe(1);

    pump.push(1 / 60, () => ({ speed }), true);
    expect(seen.length).toBe(2);
  });

  it('compares nested payloads structurally', () => {
    expect(hudEqual({ a: 1, list: [1, 2] }, { a: 1, list: [1, 2] })).toBe(true);
    expect(hudEqual({ a: 1, list: [1, 2] }, { a: 1, list: [1, 3] })).toBe(false);
  });
});
