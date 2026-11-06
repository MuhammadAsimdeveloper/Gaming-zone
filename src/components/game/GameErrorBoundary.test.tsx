// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameErrorBoundary } from './GameErrorBoundary';

let container: HTMLDivElement;
let root: Root;
let shouldThrow = true;
let errorMessage = 'synthetic game failure';

function UnstableGame() {
  if (shouldThrow) throw new Error(errorMessage);
  return <p>Game recovered</p>;
}

async function renderBoundary(options: { onReset?: () => void; reload?: () => void } = {}) {
  await act(async () => {
    root.render(
      <GameErrorBoundary onReset={options.onReset} reload={options.reload}>
        <UnstableGame />
      </GameErrorBoundary>,
    );
  });
}

async function clickRestart() {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    /restart game/i.test(candidate.textContent ?? ''),
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  shouldThrow = true;
  errorMessage = 'synthetic game failure';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe('GameErrorBoundary', () => {
  it('resets the game after an ordinary runtime error', async () => {
    const onReset = vi.fn();
    await renderBoundary({ onReset });
    shouldThrow = false;

    await clickRestart();

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Game recovered');
  });

  it('reloads the page when the game chunk failed to load', async () => {
    errorMessage = 'Failed to fetch dynamically imported module: /assets/game.js';
    const onReset = vi.fn();
    const reload = vi.fn();
    await renderBoundary({ onReset, reload });

    await clickRestart();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This game hit a snag');
  });
});
