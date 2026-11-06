// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LawnProtocolGame from './LawnProtocolGame';
import { saveProgress } from './persistence';

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

function click(element: HTMLButtonElement): void {
  act(() => element.click());
}

describe('LawnProtocolGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onStart = vi.fn();

  const mount = () =>
    act(() =>
      root.render(<LawnProtocolGame onStart={onStart} />),
    );

  beforeEach(() => {
    window.localStorage.clear();
    onStart.mockClear();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the level select with locked roofs and an endless option', () => {
    mount();
    expect(container.textContent).toContain('Lawn Protocol');
    expect(container.textContent).toContain('Grow the grid');
    expect(button(container, 'Level 1: First Light').disabled).toBe(false);
    expect(button(container, 'Level 2: Sidewalk Shuffle').disabled).toBe(true);
    expect(button(container, 'Endless defense')).toBeTruthy();
    expect(byText(container, 'Deploy level')).toBeTruthy();
  });

  it('unlocks the next roof and shows stored stars', () => {
    saveProgress({ version: 1, stars: { 'first-light': 3 }, endlessBestWave: 7, endlessBestScore: 1200 });
    mount();
    expect(button(container, 'Level 1: First Light, 3 stars')).toBeTruthy();
    expect(button(container, 'Level 2: Sidewalk Shuffle').disabled).toBe(false);
    expect(button(container, 'Level 3: Copper Line').disabled).toBe(true);
    expect(container.textContent).toContain('Endless best');
  });

  it('deploys level one, starts a run and plants a photofern', () => {
    mount();
    click(byText(container, 'Deploy level'));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(button(container, 'Pause defense')).toBeTruthy();
    expect(button(container, 'Select Photofern, 50 light')).toBeTruthy();
    expect(container.textContent).toContain('150');

    click(button(container, 'Select Photofern, 50 light'));
    click(button(container, 'Lane 3 column 2, empty'));
    expect(button(container, 'Lane 3 column 2, Photofern')).toBeTruthy();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Photofern planted');
    expect(container.textContent).toContain('100');
  });

  it('explains an unaffordable seed instead of planting it', () => {
    mount();
    click(byText(container, 'Deploy level'));
    click(button(container, 'Select Photofern, 50 light'));
    click(button(container, 'Lane 1 column 1, empty'));

    click(button(container, 'Select Mortar Moss, 150 light'));
    click(button(container, 'Lane 2 column 2, empty'));
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Not enough light for Mortar Moss');
    expect(button(container, 'Lane 2 column 2, empty')).toBeTruthy();
  });

  it('shovels a module for a half refund', () => {
    mount();
    click(byText(container, 'Deploy level'));
    click(button(container, 'Select Photofern, 50 light'));
    click(button(container, 'Lane 1 column 1, empty'));
    click(button(container, 'Shovel mode'));
    click(button(container, 'Lane 1 column 1, Photofern'));
    expect(button(container, 'Lane 1 column 1, empty')).toBeTruthy();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('25 light');
  });

  it('pauses, resumes and toggles simulation speed', () => {
    mount();
    click(byText(container, 'Deploy level'));
    click(button(container, 'Pause defense'));
    expect(button(container, 'Resume defense')).toBeTruthy();
    click(button(container, 'Resume defense'));
    expect(button(container, 'Pause defense')).toBeTruthy();

    click(button(container, 'Set speed to 2x'));
    expect(button(container, 'Set speed to 1x')).toBeTruthy();
  });

  it('starts endless mode with its own status line', () => {
    mount();
    click(button(container, 'Endless defense'));
    click(byText(container, 'Start endless'));
    expect(button(container, 'Pause defense')).toBeTruthy();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Endless defense');
  });
});
