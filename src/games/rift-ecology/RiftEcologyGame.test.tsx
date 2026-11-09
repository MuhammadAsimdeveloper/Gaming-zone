// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftEcologyGame from './RiftEcologyGame';
import type { EcologyState } from './simulation';

const captured = vi.hoisted(() => ({
  created: [] as EcologyState[],
}));

vi.mock('./simulation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./simulation')>();
  return {
    ...actual,
    createEcology: (scenarioId: Parameters<typeof actual.createEcology>[0]) => {
      const state = actual.createEcology(scenarioId);
      captured.created.push(state);
      return state;
    },
  };
});

let container: HTMLDivElement;
let root: Root;
let errorSpy: ReturnType<typeof vi.spyOn>;
let didUnmount = false;

beforeEach(() => {
  captured.created.length = 0;
  didUnmount = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  if (!didUnmount) {
    await act(async () => {
      root.unmount();
    });
  }
  container.remove();
  errorSpy.mockRestore();
  vi.restoreAllMocks();
});

function button(label: string, rootElement: ParentNode = container): HTMLButtonElement {
  const match = Array.from(rootElement.querySelectorAll('button')).find((candidate) =>
    (candidate.getAttribute('aria-label') ?? candidate.textContent ?? '').includes(label),
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

function dialog(): HTMLElement | null {
  return container.querySelector('[role="dialog"]');
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

async function start(): Promise<void> {
  await click(button('Start season'));
}

function state(): EcologyState {
  const created = captured.created.at(-1);
  if (!created) throw new Error('No ecology run was created.');
  return created;
}

describe('Rift Ecology shell', () => {
  it('briefs all three scenarios before a run starts', async () => {
    await act(async () => {
      root.render(<RiftEcologyGame onStart={vi.fn()} />);
    });

    expect(dialog()?.getAttribute('aria-label')).toBe('Rift Ecology');
    const text = container.textContent ?? '';
    expect(text).toContain('Kelp Forest');
    expect(text).toContain('Rift Marsh');
    expect(text).toContain('Ember Ridge');
    expect(captured.created).toHaveLength(0);
  });

  it('starts the selected scenario and shows the habitat', async () => {
    const onStart = vi.fn();
    await act(async () => {
      root.render(<RiftEcologyGame onStart={onStart} />);
    });

    await click(button('Choose Rift Marsh'));
    await start();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(state().scenarioId).toBe('rift-marsh');
    expect(dialog()).toBeNull();
    expect(container.textContent).toContain('Day 1');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('advances a day and appends to the event log', async () => {
    await act(async () => {
      root.render(<RiftEcologyGame />);
    });
    await start();

    const before = state().populations.kelp;
    await click(button('Advance day'));

    expect(state().day).toBe(2);
    expect(container.textContent).toContain('Day 2');
    expect(container.textContent).toContain('Day 1:');
    const shown = Math.round(state().populations.kelp);
    expect(container.textContent).toContain(String(shown));
    expect(shown).not.toBe(Math.round(before));
  });

  it('spends budget when an intervention is applied', async () => {
    await act(async () => {
      root.render(<RiftEcologyGame />);
    });
    await start();

    await click(button('Plant'));
    await click(button('Glow Kelp'));
    await click(button('Advance day'));

    expect(state().budget).toBe(21);
    expect(container.textContent).toContain('Planted Glow Kelp');
  });

  it('shows a debrief when the season completes', async () => {
    const onComplete = vi.fn();
    await act(async () => {
      root.render(<RiftEcologyGame onComplete={onComplete} />);
    });
    await start();
    state().day = 60;

    await click(button('Advance day'));

    expect(state().status).toBe('finished');
    expect(dialog()?.getAttribute('aria-label')).toBe('Season debrief');
    expect(container.textContent).toMatch(/grade/i);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ outcome: 'complete' });
    expect(typeof onComplete.mock.calls[0]?.[0]?.score).toBe('number');
  });

  it('shows the crash debrief when the ecosystem collapses', async () => {
    const onComplete = vi.fn();
    await act(async () => {
      root.render(<RiftEcologyGame onComplete={onComplete} />);
    });
    await start();
    for (const key of Object.keys(state().populations) as Array<keyof EcologyState['populations']>) {
      state().populations[key] = 0;
    }

    await click(button('Advance day'));

    expect(state().status).toBe('crashed');
    expect(dialog()?.getAttribute('aria-label')).toBe('Season debrief');
    expect(container.textContent?.toLowerCase()).toContain('collapse');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({ outcome: 'loss' });
  });

  it('tears down without errors', async () => {
    await act(async () => {
      root.render(<RiftEcologyGame />);
    });
    await start();

    await act(async () => {
      root.unmount();
    });
    didUnmount = true;

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
