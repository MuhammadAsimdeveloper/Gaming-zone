// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import NeonRushGame from './NeonRushGame';
import { loadSettings, saveRecords } from './persistence';

function button(scope: HTMLElement, label: string): HTMLButtonElement {
  const found = scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.includes(text),
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

describe('NeonRushGame', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = () => act(() => root.render(<NeonRushGame />));

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the run setup with mode cards and browser-local records', () => {
    saveRecords({
      version: 1,
      bestScore: 6400,
      bestDistance: 1800,
      bestShards: 88,
      runs: 9,
    });
    mount();
    expect(container.textContent).toContain('Neon Rush');
    expect(container.textContent).toContain('Endless');
    expect(container.textContent).toContain('Time attack');
    expect(container.textContent).toContain('6,400');
    expect(container.textContent).toContain('Browser-local bests');
    expect(byText(container, 'Start endless')).toBeTruthy();
  });

  it('switches to time attack and updates the start action', () => {
    mount();
    act(() => byText(container, 'Time attack').click());
    expect(byText(container, 'Start time attack')).toBeTruthy();
    expect(byText(container, 'Time attack').getAttribute('aria-pressed')).toBe('true');
  });

  it('persists quality changes', () => {
    mount();
    act(() => byText(container, 'High').click());
    expect(loadSettings().quality).toBe('high');
  });

  it('mutes audio from the toolbar and persists it', () => {
    mount();
    act(() => button(container, 'Mute audio').click());
    expect(button(container, 'Unmute audio')).toBeTruthy();
    expect(loadSettings().muted).toBe(true);
  });

  it('keeps the start button reachable inside the setup overlay', () => {
    mount();
    const start = byText(container, 'Start endless');
    expect(start.closest('[role="dialog"]')).not.toBeNull();
    expect(start.hasAttribute('disabled')).toBe(false);
  });
});
