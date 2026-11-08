// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftRallyGame from './RiftRallyGame';
import type { RallyHud, RallyResult, RallySetup } from './engine';
import { CAR_CLASSES } from './physics';
import { RALLY_TRACKS } from './track';

interface MockEngine {
  canvas: HTMLCanvasElement;
  setup: RallySetup;
  dispose: ReturnType<typeof vi.fn>;
  setMuted: ReturnType<typeof vi.fn>;
  setCamera: ReturnType<typeof vi.fn>;
  setTouch: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  emitHud: (patch: Partial<RallyHud>) => void;
  emitFinish: (result: RallyResult) => void;
}

const { engines } = vi.hoisted(() => ({ engines: [] as unknown[] }));

vi.mock('./engine', () => {
  class MockRallyEngine {
    readonly canvas: HTMLCanvasElement;
    readonly setup: RallySetup;
    readonly dispose = vi.fn();
    readonly setMuted = vi.fn();
    readonly setCamera = vi.fn();
    readonly setTouch = vi.fn();
    readonly pause = vi.fn();
    readonly resume = vi.fn();
    private readonly callbacks: {
      onHud: (hud: RallyHud) => void;
      onFinish: (result: RallyResult) => void;
    };

    constructor(
      canvas: HTMLCanvasElement,
      setup: RallySetup,
      callbacks: { onHud: (hud: RallyHud) => void; onFinish: (result: RallyResult) => void },
    ) {
      this.canvas = canvas;
      this.setup = setup;
      this.callbacks = callbacks;
      engines.push(this);
    }

    emitHud(patch: Partial<RallyHud>): void {
      this.callbacks.onHud({
        speed: 0,
        gear: 1,
        lap: 1,
        totalLaps: 3,
        position: 4,
        racers: 4,
        raceTime: 0,
        lastLap: null,
        bestLap: null,
        countdown: 0,
        phase: 'racing',
        offTrack: false,
        driftCharge: 0,
        boostTime: 0,
        weather: this.setup.weather,
        minimapPlayer: { x: 50, y: 50 },
        minimapRivals: [],
        ...patch,
      });
    }

    emitFinish(result: RallyResult): void {
      this.callbacks.onFinish(result);
    }
  }

  return {
    RallyEngine: MockRallyEngine,
    RALLY_BEST_LAP_KEY: 'neonrift:game:rift-rally:best-lap',
  };
});

function button(scope: HTMLElement, label: string): HTMLButtonElement {
  const found = scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

function option(scope: HTMLElement, group: string, label: string): HTMLButtonElement {
  const container = scope.querySelector<HTMLElement>(`[role="group"][aria-label="${group}"]`);
  if (!container) throw new Error(`Missing group ${group}`);
  const found = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing option ${label} in ${group}`);
  return found;
}

const RESULT: RallyResult = {
  rows: [
    { position: 1, name: 'Rook', isPlayer: false, finishTime: 96.2, bestLap: 31.4, lapsCompleted: 3 },
    { position: 2, name: 'You', isPlayer: true, finishTime: 98.7, bestLap: 32.1, lapsCompleted: 3 },
    { position: 3, name: 'Juno', isPlayer: false, finishTime: null, bestLap: 33.5, lapsCompleted: 2 },
    { position: 4, name: 'Piper', isPlayer: false, finishTime: null, bestLap: 34.2, lapsCompleted: 2 },
  ],
  playerPosition: 2,
  raceTime: 98.7,
  bestLap: 32.1,
  newBestLap: true,
  trackId: 'coastal-ring',
  carId: 'balanced',
  weather: 'clear',
};

describe('RiftRallyGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;

  beforeEach(() => {
    window.localStorage.clear();
    engines.length = 0;
    mounted = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const mount = (props: { onStart?: () => void; onComplete?: (event: unknown) => void } = {}) =>
    act(() => root.render(<RiftRallyGame onStart={props.onStart} onComplete={props.onComplete} />));

  it('renders every circuit, car class and weather option before a race', () => {
    mount();
    expect(container.textContent).toContain('Rift');
    expect(container.textContent).toContain('Rally');
    for (const [index, track] of RALLY_TRACKS.entries()) {
      expect(button(container, `Circuit ${index + 1}: ${track.name}`)).toBeTruthy();
    }
    for (const car of Object.values(CAR_CLASSES)) {
      expect(button(container, `Car class: ${car.name}`)).toBeTruthy();
    }
    expect(option(container, 'Weather', 'Clear')).toBeTruthy();
    expect(option(container, 'Weather', 'Rain')).toBeTruthy();
    expect(byText(container, 'Start race')).toBeTruthy();
  });

  it('reports the selected setup to the engine when a race starts', () => {
    const onStart = vi.fn();
    mount({ onStart });

    act(() => button(container, `Car class: ${CAR_CLASSES.drift.name}`).click());
    act(() => option(container, 'Weather', 'Rain').click());
    act(() => byText(container, 'Start race').click());

    expect(engines.length).toBe(1);
    const engine = engines[0] as MockEngine;
    expect(engine.setup).toMatchObject({ carId: 'drift', weather: 'rain', trackId: 'coastal-ring' });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('shows the finishing position and reports the result exactly once', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    act(() => byText(container, 'Start race').click());
    const engine = engines[0] as MockEngine;

    act(() => engine.emitHud({ phase: 'racing', lap: 2, position: 2 }));
    act(() => engine.emitFinish(RESULT));

    const dialog = container.querySelector('[role="dialog"][aria-label="Race result"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Finished P2');
    expect(dialog?.textContent).toContain('new personal best');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ outcome: 'loss', score: 2 });
  });

  it('reports a win as a winning outcome', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    act(() => byText(container, 'Start race').click());
    const engine = engines[0] as MockEngine;

    act(() => engine.emitFinish({ ...RESULT, playerPosition: 1, rows: RESULT.rows.map((row) => ({ ...row, isPlayer: row.position === 1 })) }));

    expect(container.querySelector('[role="dialog"][aria-label="Race result"]')?.textContent).toContain(
      'Race won',
    );
    expect(onComplete).toHaveBeenCalledWith({ outcome: 'win', score: 1 });
  });

  it('disposes the engine when the race screen unmounts', () => {
    mount();
    act(() => byText(container, 'Start race').click());
    const engine = engines[0] as MockEngine;

    act(() => root.unmount());
    mounted = false;

    expect(engine.dispose).toHaveBeenCalled();
  });
});
