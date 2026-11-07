// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './motion';

function Probe() {
  return <span>{useReducedMotion() ? 'reduced' : 'full'}</span>;
}

let container: HTMLDivElement;
let root: Root;
let listeners: Array<() => void>;
let matches = false;

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_event: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners = listeners.filter((entry) => entry !== listener);
      },
    })),
  });
}

function text() {
  return container.textContent;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  listeners = [];
  matches = false;
  installMatchMedia();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useReducedMotion', () => {
  it('reports the stored preference on mount', () => {
    matches = true;

    act(() => root.render(<Probe />));

    expect(text()).toBe('reduced');
  });

  it('tracks preference changes while mounted', () => {
    act(() => root.render(<Probe />));
    expect(text()).toBe('full');

    matches = true;
    act(() => listeners.forEach((listener) => listener()));

    expect(text()).toBe('reduced');
  });

  it('stops listening after unmount', () => {
    act(() => root.render(<Probe />));
    const registered = listeners.length;

    act(() => root.unmount());

    expect(registered).toBeGreaterThan(0);
    expect(listeners).toHaveLength(0);
  });

  it('falls back to full motion when the browser has no matchMedia', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    act(() => root.render(<Probe />));

    expect(text()).toBe('full');
  });
});