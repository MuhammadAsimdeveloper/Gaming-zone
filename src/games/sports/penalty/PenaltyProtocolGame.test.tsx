// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PenaltyProtocolGame from './PenaltyProtocolGame';
import { loadSettings, saveRecords } from './persistence';

function button(scope: HTMLElement, label: string): HTMLButtonElement {
  const found = scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`Missing button ${label}`);
  return found;
}

function byText(scope: HTMLElement, text: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(text));
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

describe('PenaltyProtocolGame', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = () => act(() => root.render(<PenaltyProtocolGame />));

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the shootout setup with difficulty and browser-local records', () => {
    saveRecords({
      version: 1,
      wins: 3,
      losses: 1,
      bestScore: 960,
      bestSaves: 4,
      streak: 2,
      bestStreak: 3,
      shootouts: 4,
    });
    mount();
    expect(container.textContent).toContain('Penalty Protocol');
    expect(container.textContent).toContain('Casual');
    expect(container.textContent).toContain('Pro');
    expect(container.textContent).toContain('Elite');
    expect(container.textContent).toContain('960');
    expect(container.textContent).toContain('3–1');
    expect(byText(container, 'Start shootout')).toBeTruthy();
  });

  it('persists keeper difficulty changes', () => {
    mount();
    act(() => byText(container, 'Elite').click());
    expect(loadSettings().difficulty).toBe('elite');
  });

  it('mutes audio from the toolbar and persists it', () => {
    mount();
    act(() => button(container, 'Mute audio').click());
    expect(button(container, 'Unmute audio')).toBeTruthy();
    expect(loadSettings().muted).toBe(true);
  });

  it('starts a shootout and exposes all six shot zones', () => {
    const onStart = vi.fn();
    act(() =>
      root.render(
        <PenaltyProtocolGame
          onStart={onStart}
        />,
      ),
    );
    act(() => byText(container, 'Start shootout').click());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(button(container, 'Shoot top left')).toBeTruthy();
    expect(button(container, 'Shoot top centre')).toBeTruthy();
    expect(button(container, 'Shoot top right')).toBeTruthy();
    expect(button(container, 'Shoot bottom left')).toBeTruthy();
    expect(button(container, 'Shoot bottom centre')).toBeTruthy();
    expect(button(container, 'Shoot bottom right')).toBeTruthy();
  });

  it('records a kick when a corner is chosen and locks the pad during flight', () => {
    act(() => root.render(<PenaltyProtocolGame />));
    act(() => byText(container, 'Start shootout').click());
    act(() => button(container, 'Shoot top left').click());
    const history = container.querySelector('[aria-label="Kick history"]');
    expect(history?.querySelectorAll('li')).toHaveLength(1);
    expect(button(container, 'Shoot top left').hasAttribute('disabled')).toBe(true);
  });

  it('shoots from the keyboard and blurs tapped zone buttons', () => {
    act(() => root.render(<PenaltyProtocolGame />));
    act(() => byText(container, 'Start shootout').click());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }));
    });
    expect(container.querySelector('[aria-label="Kick history"]')?.querySelectorAll('li')).toHaveLength(1);
  });

  it('pauses and resumes from the toolbar', () => {
    act(() => root.render(<PenaltyProtocolGame />));
    act(() => byText(container, 'Start shootout').click());
    act(() => button(container, 'Pause shootout').click());
    expect(container.textContent).toContain('Shootout paused');
    act(() => button(container, 'Resume shootout').click());
    expect(button(container, 'Pause shootout')).toBeTruthy();
  });
});
