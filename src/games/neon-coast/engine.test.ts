// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NeonCoastEngine, type NeonCoastHud } from './engine';
import type { WorldEvent } from './simulation';

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    clientWidth: 800,
    clientHeight: 600,
    parentElement: null,
    getContext: () => null,
    getBoundingClientRect: () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as unknown as HTMLCanvasElement;
}

interface Harness {
  engine: NeonCoastEngine;
  requestFrame: ReturnType<typeof vi.fn>;
  cancelFrame: ReturnType<typeof vi.fn>;
  starts: number[];
  lastCallback: () => FrameRequestCallback | undefined;
  runFrames: (count: number, stepMs?: number) => void;
  hudCalls: NeonCoastHud[];
  eventCalls: WorldEvent[];
  audio: {
    muted: boolean;
    start: ReturnType<typeof vi.fn>;
    suspend: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    toggleMute: ReturnType<typeof vi.fn>;
    updateEngine: ReturnType<typeof vi.fn>;
    cue: ReturnType<typeof vi.fn>;
  };
}

function harness(seed = 7): Harness {
  const callbacks = new Map<number, FrameRequestCallback>();
  const handles: number[] = [];
  let nextHandle = 1;
  let clock = 0;

  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle++;
    callbacks.set(handle, callback);
    handles.push(handle);
    return handle;
  });
  const cancelFrame = vi.fn((handle: number) => {
    callbacks.delete(handle);
  });

  const hudCalls: NeonCoastHud[] = [];
  const eventCalls: WorldEvent[] = [];
  const audio = {
    muted: false,
    start: vi.fn(),
    suspend: vi.fn(),
    resume: vi.fn(),
    dispose: vi.fn(),
    toggleMute: vi.fn(() => {
      audio.muted = !audio.muted;
      return audio.muted;
    }),
    updateEngine: vi.fn(),
    cue: vi.fn(),
  };

  const engine = new NeonCoastEngine(
    fakeCanvas(),
    seed,
    { onHud: (hud) => hudCalls.push(hud), onEvent: (event) => eventCalls.push(event) },
    { now: () => clock, requestFrame, cancelFrame, audio, renderer: null },
  );

  return {
    engine,
    requestFrame,
    cancelFrame,
    starts: handles,
    lastCallback: () => {
      const handle = handles[handles.length - 1];
      return handle ? callbacks.get(handle) : undefined;
    },
    runFrames: (count, stepMs = 1000 / 60) => {
      for (let index = 0; index < count; index += 1) {
        const handle = handles[handles.length - 1];
        if (!handle) return;
        const callback = callbacks.get(handle);
        if (!callback) return;
        callbacks.delete(handle);
        clock += stepMs;
        callback(clock);
      }
    },
    hudCalls,
    eventCalls,
    audio,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Neon Coast engine loop', () => {
  it('schedules one frame, cancels on pause and reschedules on resume', () => {
    const app = harness();
    app.engine.start();
    expect(app.requestFrame).toHaveBeenCalledTimes(1);
    const first = app.starts[0]!;

    app.engine.pause();
    expect(app.cancelFrame).toHaveBeenCalledWith(first);
    expect(app.audio.suspend).toHaveBeenCalled();

    app.engine.resume();
    expect(app.requestFrame).toHaveBeenCalledTimes(2);
    expect(app.audio.resume).toHaveBeenCalled();
    const second = app.starts[1]!;

    app.engine.dispose();
    expect(app.cancelFrame).toHaveBeenCalledWith(second);
    expect(app.audio.dispose).toHaveBeenCalled();
  });

  it('releases the resize listener on dispose', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const app = harness();
    app.engine.start();
    app.engine.dispose();
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('advances the fixed-step world and emits HUD at ten hertz', () => {
    const app = harness();
    app.engine.start();
    app.runFrames(36);

    expect(app.engine.getWorld().tick).toBeGreaterThanOrEqual(30);
    expect(app.engine.getWorld().tick).toBeLessThanOrEqual(40);
    expect(app.hudCalls.length).toBeGreaterThan(0);
    expect(app.hudCalls.length).toBeLessThanOrEqual(7);
    expect(app.hudCalls[0]!.phase).toBe('day');
    expect(app.hudCalls[0]!.mission).toBeNull();
  });

  it('does not tick while paused', () => {
    const app = harness();
    app.engine.start();
    app.runFrames(10);
    const tick = app.engine.getWorld().tick;
    expect(tick).toBeGreaterThan(0);

    const pending = app.lastCallback();
    app.engine.pause();
    pending?.(5000);
    expect(app.engine.getWorld().tick).toBe(tick);
  });

  it('stops ticking after dispose', () => {
    const app = harness();
    app.engine.start();
    app.runFrames(5);
    const tick = app.engine.getWorld().tick;
    const pending = app.lastCallback();
    app.engine.dispose();
    pending?.(5000);
    expect(app.engine.getWorld().tick).toBe(tick);
  });

  it('drives and accepts missions from engine input', () => {
    const app = harness();
    app.engine.start();

    app.engine.setInput({ interact: true });
    app.runFrames(2);
    expect(app.engine.getWorld().inVehicle).toBe(true);
    expect(app.eventCalls).toContainEqual({ type: 'enter-car' });

    app.engine.setInput({
      drive: { forward: true, back: false, left: false, right: false, handbrake: false },
      interact: false,
    });
    app.runFrames(30);
    expect(app.engine.getWorld().vehicle.speed).toBeGreaterThan(0);
    expect(app.hudCalls.some((hud) => hud.inVehicle)).toBe(true);

    app.engine.setInput({ acceptMission: 'tideglass-courier' });
    app.runFrames(2);
    expect(app.eventCalls).toContainEqual({
      type: 'mission-accepted',
      id: 'tideglass-courier',
      name: 'Tideglass Courier',
    });
  });

  it('delegates mute to the audio channel', () => {
    const app = harness();
    expect(app.engine.muted).toBe(false);
    expect(app.engine.toggleMute()).toBe(true);
    expect(app.engine.muted).toBe(true);
    expect(app.engine.toggleMute()).toBe(false);
  });
});
