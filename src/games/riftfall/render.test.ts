import { describe, expect, it, vi } from 'vitest';
import { createRun, type EnemyKind, type EnemyState, type ProjectileState } from './simulation';
import { drawRiftfall } from './render';

interface FakeContext extends CanvasRenderingContext2D {
  calls: Record<string, number>;
}

function fakeContext(): FakeContext {
  const calls: Record<string, number> = {};
  const record =
    (name: string) =>
    (..._args: unknown[]) => {
      calls[name] = (calls[name] ?? 0) + 1;
    };
  const gradient = { addColorStop: record('addColorStop') };
  const ctx = {
    calls,
    save: record('save'),
    restore: record('restore'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    ellipse: record('ellipse'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    setLineDash: record('setLineDash'),
    translate: record('translate'),
    scale: record('scale'),
    rotate: record('rotate'),
    fillText: record('fillText'),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    globalCompositeOperation: 'source-over',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  };
  return ctx as unknown as FakeContext;
}

function canvas(width: number, height: number): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

function enemy(kind: EnemyKind, x: number, y: number, health = 30): EnemyState {
  return {
    id: 500,
    kind,
    x,
    y,
    health,
    maxHealth: 40,
    radius: 16,
    speed: 0,
    damage: 8,
    attackCooldown: 0,
    stunTicks: 0,
    phase: 1,
    chargeTicks: 0,
    fireCooldown: 90,
  };
}

function shot(hostile: boolean): ProjectileState {
  return { id: 600, x: 480, y: 300, vx: 10, vy: 0, radius: 6, damage: 8, hostile, life: 100 };
}

describe('drawRiftfall', () => {
  it('draws the arena, every enemy kind and the player', () => {
    const run = createRun({ seed: 8, weapon: 'arc' });
    run.enemies = [
      enemy('grunt', 200, 200),
      enemy('runner', 300, 220),
      enemy('brute', 400, 240),
      enemy('elite', 500, 260),
      enemy('boss', 600, 280, 200),
    ];
    const ctx = fakeContext();
    drawRiftfall(ctx, canvas(640, 400), { run, time: 1.25 }, { reducedMotion: false });
    expect(ctx.calls.clearRect ?? 0).toBeGreaterThan(0);
    expect(ctx.calls.fillRect ?? 0).toBeGreaterThan(0);
    expect(ctx.calls.arc ?? 0).toBeGreaterThan(0);
    expect(ctx.calls.stroke ?? 0).toBeGreaterThan(0);
  });

  it('draws projectiles, parry state and dash state', () => {
    const run = createRun({ seed: 9, weapon: 'blade' });
    run.projectiles = [shot(true), shot(false)];
    run.player.parryTicks = 6;
    const parryCtx = fakeContext();
    drawRiftfall(parryCtx, canvas(640, 400), { run, time: 0.4 }, { reducedMotion: true });
    expect(parryCtx.calls.arc ?? 0).toBeGreaterThan(2);

    run.player.parryTicks = 0;
    run.player.dashTicks = 6;
    const dashCtx = fakeContext();
    drawRiftfall(dashCtx, canvas(640, 400), { run, time: 0.5 }, { reducedMotion: false });
    expect(dashCtx.calls.arc ?? 0).toBeGreaterThan(0);
  });

  it('skips a zero-sized canvas without throwing', () => {
    const run = createRun({ seed: 10, weapon: 'rail' });
    const ctx = fakeContext();
    drawRiftfall(ctx, canvas(0, 0), { run, time: 0 }, { reducedMotion: false });
    expect(ctx.calls.save ?? 0).toBe(0);
  });
});
