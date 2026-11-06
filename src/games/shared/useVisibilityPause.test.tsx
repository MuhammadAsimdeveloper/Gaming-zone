// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibilityPause } from './useVisibilityPause';

let container: HTMLDivElement;
let root: Root;

function Harness({ onHidden, active }: { onHidden: () => void; active: boolean }) {
  useVisibilityPause(onHidden, active);
  return null;
}

async function render(props: { onHidden: () => void; active: boolean }) {
  await act(async () => {
    root.render(<Harness {...props} />);
  });
}

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  Object.defineProperty(document, 'hidden', { configurable: true, value: value === 'hidden' });
}

async function dispatchVisibility() {
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('useVisibilityPause', () => {
  it('calls the pause callback when the tab becomes hidden', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: true });
    setVisibility('hidden');

    await dispatchVisibility();

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the tab is still visible', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: true });
    setVisibility('visible');

    await dispatchVisibility();

    expect(onHidden).not.toHaveBeenCalled();
  });

  it('does not subscribe while the game is not active', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: false });
    setVisibility('hidden');

    await dispatchVisibility();

    expect(onHidden).not.toHaveBeenCalled();
  });

  it('pauses when the window loses focus', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: true });

    await act(async () => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('pauses when the page is being unloaded', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: true });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it('removes its listener on unmount', async () => {
    const onHidden = vi.fn();
    await render({ onHidden, active: true });
    await act(async () => {
      root.unmount();
    });
    setVisibility('hidden');

    document.dispatchEvent(new Event('visibilitychange'));

    expect(onHidden).not.toHaveBeenCalled();
  });
});
