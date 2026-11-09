// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftfallGame from './RiftfallGame';
import type { RunState } from './simulation';

const { created, configs } = vi.hoisted(() => ({
  created: [] as unknown[],
  configs: [] as Array<{ seed: number; weapon: string }>,
}));

vi.mock('./simulation', async () => {
  const actual = await vi.importActual<typeof import('./simulation')>('./simulation');
  return {
    ...actual,
    createRun: (config: Parameters<typeof actual.createRun>[0]) => {
      const run = actual.createRun(config);
      created.push(run);
      configs.push({ seed: config.seed, weapon: config.weapon });
      return run;
    },
  };
});

describe('RiftfallGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let frameMap: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let clock: number;
  let cancelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    created.length = 0;
    configs.length = 0;
    frameMap = new Map();
    nextFrameId = 0;
    clock = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrameId += 1;
      frameMap.set(nextFrameId, callback);
      return nextFrameId;
    });
    cancelSpy = vi.fn((handle: number) => {
      frameMap.delete(handle);
    });
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mount = (props: { onStart?: () => void; onComplete?: (event: unknown) => void } = {}) =>
    act(() => root.render(<RiftfallGame onStart={props.onStart} onComplete={props.onComplete} />));

  const frame = (delta = 17) => {
    clock += delta;
    act(() => {
      const batch = [...frameMap.values()];
      frameMap.clear();
      for (const callback of batch) callback(clock);
    });
  };

  const latestRun = (index = 0): RunState => created[index] as RunState;

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) =>
      (candidate.getAttribute('aria-label') ?? candidate.textContent ?? '').includes(label),
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }

  function dialog(): HTMLElement | null {
    return container.querySelector('[role="dialog"]');
  }

  const start = () => {
    act(() => button('Start run').click());
    frame();
  };

  it('shows four weapons and a start control before a run', () => {
    mount();
    for (const name of ['Blade', 'Arc', 'Rail', 'Bloom']) {
      expect(button(`Select ${name}`)).toBeTruthy();
    }
    expect(button('Start run')).toBeTruthy();
    expect(created).toHaveLength(0);
    expect(dialog()?.getAttribute('aria-label')).toBe('Riftfall menu');
  });

  it('starts the chosen weapon and reports onStart once', () => {
    const onStart = vi.fn();
    mount({ onStart });
    act(() => button('Select Arc').click());
    act(() => button('Start run').click());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(configs[0]?.weapon).toBe('arc');
    expect(created).toHaveLength(1);
    expect(container.querySelector('canvas')?.getAttribute('aria-label')).toBe('Riftfall arena');
  });

  it('steps the simulation while fighting', () => {
    mount();
    start();
    const run = latestRun();
    frame();
    frame();
    frame();
    expect(run.tick).toBeGreaterThan(0);
    expect(container.textContent).toContain('Wave');
  });

  it('freezes the fight while paused and resumes it', () => {
    mount();
    start();
    const run = latestRun();
    frame();
    const tick = run.tick;
    act(() => button('Pause run').click());
    expect(dialog()?.getAttribute('aria-label')).toBe('Run paused');
    frame();
    frame();
    expect(run.tick).toBe(tick);
    act(() => button('Resume run').click());
    frame();
    frame();
    expect(run.tick).toBeGreaterThan(tick);
  });

  it('offers three upgrades between waves and applies the pick', () => {
    mount();
    start();
    const run = latestRun();
    run.status = 'betweenWaves';
    frame();
    expect(dialog()?.getAttribute('aria-label')).toBe('Choose an upgrade');
    const picks = [...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Pick "]')];
    expect(picks).toHaveLength(3);
    const wave = run.wave;
    const tick = run.tick;
    act(() => picks[0]?.click());
    expect(run.wave).toBe(wave + 1);
    expect(run.status).toBe('fighting');
    expect(Object.keys(run.upgrades)).toHaveLength(1);
    expect(dialog()).toBeNull();
    frame();
    frame();
    expect(run.tick).toBeGreaterThan(tick);
  });

  it('reports a loss exactly once', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    start();
    const run = latestRun();
    run.player.health = 0;
    frame();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ outcome: 'loss', score: run.score });
    expect(dialog()?.getAttribute('aria-label')).toBe('Run ended');
    frame();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('reports a win and can start a fresh run', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    start();
    const run = latestRun();
    run.score = 850;
    run.status = 'won';
    frame();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ outcome: 'win', score: 850 });
    expect(dialog()?.getAttribute('aria-label')).toBe('Rift complete');
    act(() => button('Run again').click());
    expect(created).toHaveLength(2);
    expect(latestRun(1).status).toBe('fighting');
    expect(dialog()).toBeNull();
  });

  it('cancels the frame loop on unmount', () => {
    mount();
    start();
    frame();
    expect(cancelSpy).not.toHaveBeenCalled();
    act(() => root.unmount());
    expect(cancelSpy).toHaveBeenCalled();
  });
});
