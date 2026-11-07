// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulationClock } from './useSimulationClock';

let container: HTMLDivElement;
let root: Root;

function Harness({ onTick, active }: { onTick: () => void; active: boolean }) {
  useSimulationClock({ active, intervalMs: 1000, onTick });
  return null;
}

async function render(props: { onTick: () => void; active: boolean }) {
  await act(async () => {
    root.render(<Harness {...props} />);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useSimulationClock', () => {
  it('does not advance a simulation while the browser window is blurred', async () => {
    const onTick = vi.fn();
    await render({ onTick, active: true });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(2000);
    });

    expect(onTick).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      vi.advanceTimersByTime(1000);
    });

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('does not advance a simulation while the document is hidden', async () => {
    const onTick = vi.fn();
    await render({ onTick, active: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(2000);
    });

    expect(onTick).not.toHaveBeenCalled();
  });
});
