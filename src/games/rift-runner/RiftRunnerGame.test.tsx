// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftRunnerGame from './RiftRunnerGame';
import { RUNNER_WIDTH } from './simulation';

let container: HTMLDivElement;
let root: Root;
let animationFrames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

const context2d = {
  createLinearGradient: () => ({ addColorStop: () => {} }),
  fillRect: () => {},
  beginPath: () => {},
  roundRect: () => {},
  fill: () => {},
  globalAlpha: 1,
  fillStyle: '',
  shadowColor: '',
  shadowBlur: 0,
};

function startButton(): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    /Start run/.test(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''),
  );
  if (!button) throw new Error('Start button not found');
  return button;
}

async function runFrames(count: number) {
  await act(async () => {
    const base = performance.now();
    for (let frame = 1; frame <= count; frame += 1) {
      const callbacks = [...animationFrames.values()];
      animationFrames.clear();
      for (const callback of callbacks) callback(base + frame * 16);
    }
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  animationFrames = new Map();
  nextFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrameId += 1;
    animationFrames.set(nextFrameId, callback);
    return nextFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    animationFrames.delete(handle);
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context2d as unknown as CanvasRenderingContext2D,
  );
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function hudValue(label: string): string {
  const labelNode = Array.from(container.querySelectorAll('p')).find(
    (candidate) => candidate.textContent === label,
  );
  return labelNode?.parentElement?.lastElementChild?.textContent ?? '';
}

describe('Rift Runner rendering', () => {
  it('sizes the canvas once instead of on every frame', async () => {
    await act(async () => {
      root.render(<RiftRunnerGame />);
    });
    await act(async () => {
      startButton().click();
    });

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBe(RUNNER_WIDTH);

    let widthWrites = 0;
    const prototypeWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width')!;
    Object.defineProperty(canvas!, 'width', {
      configurable: true,
      get() {
        return prototypeWidth.get!.call(this) as number;
      },
      set(value: number) {
        widthWrites += 1;
        prototypeWidth.set!.call(this, value);
      },
    });

    await runFrames(8);

    expect(widthWrites).toBe(0);
    expect(canvas!.width).toBe(RUNNER_WIDTH);
  });

  it('keeps the HUD moving while simulating on the animation frame', async () => {
    await act(async () => {
      root.render(<RiftRunnerGame />);
    });
    await act(async () => {
      startButton().click();
    });

    const distanceBefore = hudValue('Distance');
    await runFrames(12);
    const distanceAfter = hudValue('Distance');

    expect(distanceBefore).toBe('0m');
    expect(distanceAfter).not.toBe(distanceBefore);
  });
});
