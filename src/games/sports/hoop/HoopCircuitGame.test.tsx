// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HoopCircuitGame from './HoopCircuitGame';
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

describe('HoopCircuitGame', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mount = () => act(() => root.render(<HoopCircuitGame />));

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

  it('shows the arena menu with difficulty and browser-local records', () => {
    saveRecords({
      version: 1,
      bestScore: 41,
      bestStreak: 5,
      games: 6,
      makes: 30,
      shots: 52,
      streak: 0,
    });
    mount();
    expect(container.textContent).toContain('Hoop Circuit');
    expect(container.textContent).toContain('Rookie');
    expect(container.textContent).toContain('Pro');
    expect(container.textContent).toContain('All-Star');
    expect(container.textContent).toContain('41');
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('6');
    expect(byText(container, 'Tip off')).toBeTruthy();
  });

  it('persists difficulty changes', () => {
    mount();
    act(() => byText(container, 'All-Star').click());
    expect(loadSettings().difficulty).toBe('allstar');
  });

  it('mutes audio from the toolbar and persists it', () => {
    mount();
    act(() => button(container, 'Mute audio').click());
    expect(button(container, 'Unmute audio')).toBeTruthy();
    expect(loadSettings().muted).toBe(true);
  });

  it('tips off with a clock, aim controls and a shoot button', () => {
    const onStart = vi.fn();
    act(() => root.render(<HoopCircuitGame onStart={onStart} />));
    act(() => byText(container, 'Tip off').click());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(button(container, 'Shoot')).toBeTruthy();
    expect(button(container, 'Aim up')).toBeTruthy();
    expect(button(container, 'Aim down')).toBeTruthy();
    expect(button(container, 'More power')).toBeTruthy();
    expect(button(container, 'Less power')).toBeTruthy();
    expect(container.textContent).toContain('1:00');
  });

  it('launches the ball from the shoot button and locks it during flight', () => {
    act(() => root.render(<HoopCircuitGame />));
    act(() => byText(container, 'Tip off').click());
    act(() => button(container, 'Shoot').click());
    expect(button(container, 'Shoot').hasAttribute('disabled')).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('In the air');
  });

  it('shoots with the space bar', () => {
    act(() => root.render(<HoopCircuitGame />));
    act(() => byText(container, 'Tip off').click());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    });
    expect(button(container, 'Shoot').hasAttribute('disabled')).toBe(true);
  });

  it('pauses and resumes from the toolbar', () => {
    act(() => root.render(<HoopCircuitGame />));
    act(() => byText(container, 'Tip off').click());
    act(() => button(container, 'Pause game').click());
    expect(container.textContent).toContain('Game paused');
    act(() => button(container, 'Resume game').click());
    expect(button(container, 'Pause game')).toBeTruthy();
  });
});
