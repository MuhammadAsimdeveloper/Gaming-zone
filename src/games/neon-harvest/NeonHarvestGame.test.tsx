// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NeonHarvestGame from './NeonHarvestGame';

let container: HTMLDivElement;
let root: Root;

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

function findButton(name: RegExp): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    name.test(candidate.getAttribute('aria-label') ?? candidate.textContent ?? ''),
  );
  if (!button) throw new Error(`Button not found: ${name}`);
  return button;
}

describe('Neon Harvest game shell', () => {
  it('starts a season and plants the selected crop', async () => {
    await act(async () => {
      root.render(<NeonHarvestGame />);
    });

    await act(async () => {
      findButton(/Start season/).click();
    });

    await act(async () => {
      findButton(/Plant Rift Lettuce in plot 1/).click();
    });

    expect(findButton(/Water plot 1/)).toBeTruthy();
    expect(container.textContent).toContain('Neon Harvest');
  });

  it('calls onStart once when the season begins', async () => {
    const onStart = vi.fn();
    await act(async () => {
      root.render(<NeonHarvestGame onStart={onStart} />);
    });

    await act(async () => {
      findButton(/Start season/).click();
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
