// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useBestScore, type BestScoreState } from './useBestScore';

let container: HTMLDivElement;
let root: Root;
let current: BestScoreState;

function Probe({ storageKey, lowerIsBetter = false }: { storageKey: string; lowerIsBetter?: boolean }) {
  current = useBestScore(storageKey, lowerIsBetter);
  return null;
}

function renderProbe(storageKey: string, lowerIsBetter = false) {
  act(() => {
    root.render(<Probe storageKey={storageKey} lowerIsBetter={lowerIsBetter} />);
  });
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useBestScore', () => {
  it('stores a negative final balance instead of clamping to zero', () => {
    renderProbe('diner');

    act(() => current.submit(-1100));

    expect(current.best).toBe(-1100);
    expect(localStorage.getItem('diner')).toBe('-1100');
  });

  it('keeps the better score when another tab has written a higher value', () => {
    localStorage.setItem('shared', '50');
    renderProbe('shared');
    expect(current.best).toBe(50);

    localStorage.setItem('shared', '80');
    act(() => current.submit(70));

    expect(current.best).toBe(80);
    expect(localStorage.getItem('shared')).toBe('80');
  });

  it('keeps the lower value for lower-is-better records', () => {
    renderProbe('moves', true);

    act(() => current.submit(42));
    act(() => current.submit(31));
    act(() => current.submit(39));

    expect(current.best).toBe(31);
    expect(localStorage.getItem('moves')).toBe('31');
  });
});
