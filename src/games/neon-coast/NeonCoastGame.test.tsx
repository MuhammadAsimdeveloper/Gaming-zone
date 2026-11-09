// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NeonCoastHud } from './engine';
import { SAVE_KEY, defaultSave, loadSave, saveProgress } from './persistence';

interface MockEngine {
  seed: number;
  callbacks: { onHud: (hud: NeonCoastHud) => void; onEvent: (event: unknown) => void };
  options: Record<string, unknown>;
  progress: unknown;
  muted: boolean;
  inputs: unknown[];
  started: boolean;
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  setInput: ReturnType<typeof vi.fn>;
  setProgress: ReturnType<typeof vi.fn>;
  toggleMute: ReturnType<typeof vi.fn>;
}

const engineState = vi.hoisted(() => {
  const instances: MockEngine[] = [];
  return { instances };
});

vi.mock('./engine', () => {
  class MockNeonCoastEngine {
    seed: number;
    callbacks: MockEngine['callbacks'];
    options: Record<string, unknown>;
    progress: unknown = null;
    muted = false;
    inputs: unknown[] = [];
    started = false;
    start = vi.fn(() => {
      this.started = true;
    });
    pause = vi.fn();
    resume = vi.fn();
    dispose = vi.fn();
    setInput = vi.fn((patch: unknown) => {
      this.inputs.push(patch);
    });
    setProgress = vi.fn((save: unknown) => {
      this.progress = save;
    });
    toggleMute = vi.fn(() => {
      this.muted = !this.muted;
      return this.muted;
    });

    constructor(
      _canvas: HTMLCanvasElement,
      seed: number,
      callbacks: MockEngine['callbacks'],
      options: Record<string, unknown> = {},
    ) {
      this.seed = seed;
      this.callbacks = callbacks;
      this.options = options;
      engineState.instances.push(this as unknown as MockEngine);
    }
  }
  return { NeonCoastEngine: MockNeonCoastEngine };
});

import NeonCoastGame from './NeonCoastGame';

function button(scope: HTMLElement, label: string): HTMLButtonElement {
  const found = scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function dialog(scope: HTMLElement, label: string): HTMLElement {
  const found = scope.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]`);
  if (!found) throw new Error(`Missing dialog ${label}`);
  return found;
}

function click(element: HTMLElement): void {
  act(() => element.click());
}

function hud(overrides: Partial<NeonCoastHud> = {}): NeonCoastHud {
  return {
    tick: 60,
    timeOfDay: 0.42,
    phase: 'day',
    position: { x: 1220, y: 1560 },
    heading: 0,
    inVehicle: false,
    canEnterCar: true,
    speed: 0,
    speedKph: 0,
    vehicle: { x: 1160, y: 1560, heading: 0, speed: 0 },
    mission: {
      id: 'tideglass-courier',
      name: 'Tideglass Courier',
      status: 'active',
      elapsed: 12,
      timeLeft: 88,
      timeLimit: 100,
      pickedUp: false,
      gateIndex: 0,
      gateCount: 0,
      discovered: 0,
      shards: 0,
      shardCount: 0,
      reward: 450,
    },
    target: { x: 560, y: 510 },
    distanceToTarget: 420,
    traffic: [{ x: 860, y: 260 }],
    pedestrians: [{ x: 300, y: 400 }],
    shards: [],
    gates: [],
    cash: 0,
    rank: 'Newcomer',
    ...overrides,
  };
}

describe('NeonCoastGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onStart = vi.fn();
  const onComplete = vi.fn();

  const mount = () =>
    act(() =>
      root.render(<NeonCoastGame onStart={onStart} onComplete={onComplete} />),
    );

  const startCourier = () => {
    mount();
    click(button(container, 'Start Tideglass Courier'));
    return engineState.instances[0]!;
  };

  beforeEach(() => {
    window.localStorage.clear();
    engineState.instances.length = 0;
    onStart.mockClear();
    onComplete.mockClear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows a 15-second briefing, three missions and browser-local records', () => {
    mount();

    expect(container.textContent).toContain('Neon Coast');
    expect(container.textContent).toContain('15-second briefing');
    expect(button(container, 'Start Tideglass Courier').disabled).toBe(false);
    expect(button(container, 'Start Lantern Circuit').disabled).toBe(true);
    expect(button(container, 'Start Landmark Trail').disabled).toBe(true);
    expect(button(container, 'Start Glow Run').disabled).toBe(true);
    expect(container.textContent).toContain('Tideglass Courier');
    expect(container.textContent).toContain('Lantern Circuit');
    expect(container.textContent).toContain('Landmark Trail');
    expect(container.textContent).toContain('browser-local');
  });

  it('starts a mission, reports onStart and shows the tutorial and HUD', () => {
    const engine = startCourier();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(engine.started).toBe(true);
    expect(engine.inputs).toContainEqual({ acceptMission: 'tideglass-courier' });

    act(() => engine.callbacks.onHud(hud()));

    expect(container.textContent).toContain('Collect the tideglass at Tideglass Market');
    expect(container.textContent).toContain('1:28');
    expect(container.textContent).toContain('On foot');
    expect(container.textContent).toContain('420 m');
    expect(container.textContent).toContain('Walk with WASD or the arrow keys');
    expect(button(container, 'Pause game')).toBeTruthy();
  });

  it('walks with real keys and stops page scrolling while playing', () => {
    const engine = startCourier();
    act(() => engine.callbacks.onHud(hud()));

    const down = new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(down);
    });
    expect(down.defaultPrevented).toBe(true);
    expect(engine.inputs).toContainEqual({
      move: { up: true, down: false, left: false, right: false, sprint: false },
      drive: { forward: true, back: false, left: false, right: false, handbrake: false },
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp', bubbles: true }));
    });
    expect(engine.inputs).toContainEqual({
      move: { up: false, down: false, left: false, right: false, sprint: false },
      drive: { forward: false, back: false, left: false, right: false, handbrake: false },
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    });
    expect(engine.inputs).toContainEqual({ interact: true });
  });

  it('pauses into a labelled dialog and resumes with Escape', () => {
    const engine = startCourier();
    act(() => engine.callbacks.onHud(hud()));

    click(button(container, 'Pause game'));
    const paused = dialog(container, 'Coast paused');
    expect(paused.textContent).toContain('Tideglass Courier');
    expect(engine.pause).toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    });
    expect(engine.resume).toHaveBeenCalled();
  });

  it('keeps the game paused when the window loses focus and never auto-resumes', () => {
    const engine = startCourier();
    act(() => engine.callbacks.onHud(hud()));

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(engine.pause).toHaveBeenCalled();
    dialog(container, 'Coast paused');
    expect(engine.resume).not.toHaveBeenCalled();
  });

  it('shows reward, best time and rank when a mission completes', () => {
    const engine = startCourier();
    act(() => engine.callbacks.onHud(hud()));

    act(() =>
      engine.callbacks.onEvent({
        type: 'mission-complete',
        id: 'tideglass-courier',
        reward: 450,
        elapsed: 63.4,
        shards: 0,
      }),
    );

    const results = dialog(container, 'Mission results');
    expect(results.textContent).toContain('Tideglass Courier');
    expect(results.textContent).toContain('450');
    expect(results.textContent).toContain('1:03');
    expect(results.textContent).toContain('Local');
    expect(onComplete).toHaveBeenCalledWith({ score: 450, outcome: 'complete' });

    const saved = loadSave();
    expect(saved.cash).toBe(450);
    expect(saved.completed).toContain('tideglass-courier');
    expect(saved.bestTimes['tideglass-courier']).toBeCloseTo(63.4, 5);

    click(button(container, 'Mission select'));
    expect(button(container, 'Start Lantern Circuit').disabled).toBe(false);
  });

  it('retries on a fresh engine and keeps the saved mute state', () => {
    saveProgress({ ...defaultSave(), soundOn: false });

    const first = startCourier();
    expect(first.toggleMute).toHaveBeenCalledTimes(1);
    expect(first.muted).toBe(true);

    click(button(container, 'Pause game'));
    click(button(container, 'Restart mission'));

    expect(engineState.instances).toHaveLength(2);
    const second = engineState.instances[1]!;
    expect(first.dispose).toHaveBeenCalled();
    expect(second.started).toBe(true);
    expect(second.toggleMute).toHaveBeenCalledTimes(1);
    expect(second.muted).toBe(true);
  });

  it('falls back to defaults when the stored save is corrupt', () => {
    window.localStorage.setItem(SAVE_KEY, '{"version": 9, "cash": -50}');

    mount();
    expect(container.textContent).toContain('$0');
    expect(container.textContent).toContain('Newcomer');

    click(button(container, 'Start Tideglass Courier'));
    expect(engineState.instances[0]!.started).toBe(true);
  });

  it('keeps the tutorial dismissed after the first visit', () => {
    startCourier();
    click(button(container, 'Got it'));

    expect(container.textContent).not.toContain('Walk with WASD or the arrow keys');
    expect(loadSave().tutorialSeen).toBe(true);
  });

  it('offers 44-pixel touch controls on foot and while driving', () => {
    const engine = startCourier();
    act(() => engine.callbacks.onHud(hud()));

    const walk = button(container, 'Walk joystick');
    expect(walk.className).toContain('h-28');

    act(() =>
      engine.callbacks.onHud(hud({ inVehicle: true, canEnterCar: false, speedKph: 128 })),
    );

    for (const label of ['Steer left', 'Steer right', 'Accelerate', 'Brake', 'Drift', 'Step out of the Vela']) {
      const control = button(container, label);
      expect(control.className).toContain('h-12');
    }
    expect(container.textContent).toContain('128 km/h');
  });

  it('opens a mission log during play', () => {
    startCourier();
    click(button(container, 'Mission log'));

    const log = dialog(container, 'Mission log');
    expect(log.textContent).toContain('Tideglass Courier');
    expect(log.textContent).toContain('Lantern Circuit');
    expect(log.textContent).toContain('Landmark Trail');
    click(button(container, 'Close mission log'));
    expect(container.querySelector('[role="dialog"][aria-label="Mission log"]')).toBeNull();
  });
});
