// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftLifeGame from './RiftLifeGame';
import { ENDING_GALLERY_KEY } from './endings';
import type { LifeState } from './simulation';

const { created } = vi.hoisted(() => ({ created: [] as LifeState[] }));

vi.mock('./simulation', async () => {
  const actual = await vi.importActual<typeof import('./simulation')>('./simulation');
  return {
    ...actual,
    createLife: (seed: number) => {
      const state = actual.createLife(seed);
      created.push(state);
      return state;
    },
  };
});

describe('RiftLifeGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let cancelSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    created.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    cancelSpy = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelSpy);
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

  const mount = (props: { onStart?: () => void; onComplete?: (event: unknown) => void } = {}) =>
    act(() => root.render(<RiftLifeGame onStart={props.onStart} onComplete={props.onComplete} />));

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) =>
      (candidate.getAttribute('aria-label') ?? candidate.textContent ?? '').includes(label),
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  }

  function maybeButton(label: string): HTMLButtonElement | null {
    return (
      [...container.querySelectorAll('button')].find((candidate) =>
        (candidate.getAttribute('aria-label') ?? candidate.textContent ?? '').includes(label),
      ) ?? null
    );
  }

  const click = (label: string) => act(() => button(label).click());
  const dialog = () => container.querySelector('[role="dialog"]');
  const start = () => click('Start the 21 days');
  const life = (index = 0): LifeState => created[index] as LifeState;

  it('opens on the briefing without starting a run', () => {
    const onStart = vi.fn();
    mount({ onStart });
    expect(dialog()?.getAttribute('aria-label')).toBe('Rift Life');
    expect(button('Start the 21 days')).toBeTruthy();
    expect(created).toHaveLength(0);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts the run and reports onStart once', () => {
    const onStart = vi.fn();
    mount({ onStart });
    start();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(dialog()).toBeNull();
    expect(container.querySelector('canvas')?.getAttribute('aria-label')).toBe('Rift town');
  });

  it('spends a time slot and raises job progress on a shift', () => {
    mount();
    start();
    click('Rig shift');
    expect(life().slot).toBe(1);
    expect(life().jobProgress).toBeGreaterThan(0);
    expect(life().energy).toBeLessThan(70);
    expect(container.textContent).toContain('Job');
  });

  it('applies a conversation choice without spending another slot', () => {
    mount();
    start();
    click('Visit Sena Ahn');
    expect(life().relationships.sena).toBe(9);
    const slot = life().slot;
    click('Choice: Report the signal');
    expect(life().relationships.sena).toBe(12);
    expect(life().community).toBe(4);
    expect(life().slot).toBe(slot);
  });

  it('rolls the calendar after the day is spent', () => {
    mount();
    start();
    click('Pass time');
    click('Pass time');
    click('Pass time');
    expect(life().slot).toBe(3);
    click('Next day');
    expect(life().day).toBe(2);
    expect(life().slot).toBe(0);
    expect(container.textContent).toContain('Day 2');
  });

  it('finishes on day 21, saves the ending and completes once', () => {
    const onComplete = vi.fn();
    mount({ onComplete });
    start();
    click('Pass time');
    click('Pass time');
    click('Pass time');
    life().day = 21;
    click('Next day');

    expect(life().status).toBe('finished');
    expect(life().endingId).not.toBeNull();
    expect(dialog()?.getAttribute('aria-label')).toBe('Your ending');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ outcome: 'complete' });

    const stored = JSON.parse(window.localStorage.getItem(ENDING_GALLERY_KEY) ?? '[]') as string[];
    expect(stored).toContain(life().endingId);
  });

  it('restarts with a fresh run from the ending screen', () => {
    mount();
    start();
    click('Pass time');
    click('Pass time');
    click('Pass time');
    life().day = 21;
    click('Next day');
    click('Start again');

    expect(created).toHaveLength(2);
    expect(life(1).day).toBe(1);
    expect(life(1).slot).toBe(0);
    expect(life(1).status).toBe('playing');
    expect(dialog()).toBeNull();
  });

  it('cancels the draw loop on unmount', () => {
    mount();
    start();
    act(() => root.unmount());
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('shows a "Next day" control once the day is spent', () => {
    mount();
    start();
    expect(maybeButton('Next day')).toBeNull();
    click('Pass time');
    click('Pass time');
    click('Pass time');
    expect(maybeButton('Next day')).not.toBeNull();
  });
});
