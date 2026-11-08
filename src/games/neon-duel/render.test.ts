import { describe, expect, it } from 'vitest';
import { createFighterState, type FighterAction, type FighterState } from './combat';
import { FIGHTERS } from './fighters';
import { drawDuelScene, type DuelBanner, type DuelEffect, type DuelView } from './render';

interface FakeContext {
  ctx: CanvasRenderingContext2D;
  calls: number;
  texts: string[];
  translations: Array<[number, number]>;
}

function createFakeContext(): FakeContext {
  const state: Record<string, unknown> = {};
  const texts: string[] = [];
  const translations: Array<[number, number]> = [];
  let calls = 0;

  const gradient = { addColorStop: () => {} };
  const methods: Record<string, (...args: unknown[]) => unknown> = {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: (x, y) => {
      translations.push([Number(x), Number(y)]);
    },
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fill: () => {},
    stroke: () => {},
    arc: () => {},
    ellipse: () => {},
    setLineDash: () => {},
    fillText: (text) => {
      texts.push(String(text));
    },
    strokeText: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };

  const ctx = new Proxy(state as unknown as CanvasRenderingContext2D, {
    get(target, prop: string) {
      if (prop in methods) {
        return (...args: unknown[]) => {
          calls += 1;
          return methods[prop](...args);
        };
      }
      return (target as unknown as Record<string, unknown>)[prop];
    },
    set(target, prop: string, value) {
      (target as unknown as Record<string, unknown>)[prop] = value;
      return true;
    },
  });

  return {
    ctx,
    get calls() {
      return calls;
    },
    texts,
    translations,
  };
}

function canvasOf(width = 960, height = 540): HTMLCanvasElement {
  return { width, height } as unknown as HTMLCanvasElement;
}

function baseView(a: FighterState, b: FighterState): DuelView {
  return {
    a,
    b,
    timerTicks: 3600,
    roundTicks: 0,
    round: 1,
    wins: { player: 0, rival: 0 },
    banner: null,
    shake: 0,
    effects: [],
    training: false,
    rivalName: FIGHTERS.mako.name,
    clock: 0,
  };
}

function withAction(state: FighterState, action: FighterAction): FighterState {
  return { ...state, action };
}

describe('drawDuelScene', () => {
  it('renders every fighter pose and the HUD without throwing', () => {
    const fake = createFakeContext();
    const canvas = canvasOf();
    const volt = createFighterState(FIGHTERS.volt, -2.4, 1);
    const mako = createFighterState(FIGHTERS.mako, 2.4, -1);
    const view = baseView(volt, mako);

    const actions: FighterAction[] = [
      { kind: 'idle' },
      { kind: 'move' },
      { kind: 'jump' },
      { kind: 'dash' },
      { kind: 'block' },
      { kind: 'attack', move: 'light', frame: 2, hasHit: false },
      { kind: 'attack', move: 'light', frame: 5, hasHit: false },
      { kind: 'attack', move: 'light', frame: 9, hasHit: true },
      { kind: 'attack', move: 'heavy', frame: 8, hasHit: false },
      { kind: 'attack', move: 'special', frame: 12, hasHit: false },
    ];

    for (const action of actions) {
      drawDuelScene(fake.ctx, canvas, { ...view, a: withAction(volt, action) }, { reducedMotion: false, time: 1200 });
    }

    const stunned: FighterState = { ...volt, hitstun: 4 };
    drawDuelScene(fake.ctx, canvas, { ...view, a: stunned, b: { ...mako, y: 0.9 } }, { reducedMotion: true, time: 2400 });

    expect(fake.calls).toBeGreaterThan(0);
    expect(fake.texts).toContain('VOLT');
    expect(fake.texts).toContain('MAKO');
    expect(fake.texts).toContain('60');
    expect(fake.texts).toContain('ROUND 1');
  });

  it('renders banners, every effect kind and the training marker', () => {
    const fake = createFakeContext();
    const canvas = canvasOf(1280, 720);
    const volt = createFighterState(FIGHTERS.volt, -2, 1);
    const mako = createFighterState(FIGHTERS.mako, 2, -1);

    const banners: DuelBanner[] = [
      { title: 'K.O.', subtitle: 'Volt takes the round', tone: 'win' },
      { title: 'TIME UP', subtitle: '', tone: 'loss' },
      { title: '3', subtitle: '', tone: 'neutral' },
    ];
    const effects: DuelEffect[] = (['hit', 'block', 'ko', 'land', 'special'] as const).map((kind, index) => ({
      kind,
      x: -2 + index,
      y: 0,
      life: 14,
      maxLife: 28,
      strength: 0.8,
    }));

    for (const banner of banners) {
      drawDuelScene(
        fake.ctx,
        canvas,
        { ...baseView(volt, mako), banner, effects, shake: 0.8, training: true },
        { reducedMotion: false, time: 8000 },
      );
    }

    expect(fake.texts).toContain('TRAINING DUMMY');
    expect(fake.texts).toContain('K.O.');
    expect(fake.texts).toContain('TIME UP');
  });

  it('skips work when the canvas has no drawable size', () => {
    const fake = createFakeContext();
    const volt = createFighterState(FIGHTERS.volt, -2, 1);
    const mako = createFighterState(FIGHTERS.mako, 2, -1);

    drawDuelScene(fake.ctx, canvasOf(0, 540), baseView(volt, mako), { reducedMotion: false, time: 0 });
    drawDuelScene(fake.ctx, canvasOf(960, 0), baseView(volt, mako), { reducedMotion: false, time: 0 });

    expect(fake.calls).toBe(0);
  });

  it('drops screen shake when reduced motion is requested', () => {
    const volt = createFighterState(FIGHTERS.volt, -2, 1);
    const mako = createFighterState(FIGHTERS.mako, 2, -1);
    const view = { ...baseView(volt, mako), shake: 1 };

    const shaken = createFakeContext();
    drawDuelScene(shaken.ctx, canvasOf(), view, { reducedMotion: false, time: 100 });
    const calm = createFakeContext();
    drawDuelScene(calm.ctx, canvasOf(), view, { reducedMotion: true, time: 100 });

    expect(shaken.translations.length).toBe(calm.translations.length + 1);
    expect(calm.translations.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
