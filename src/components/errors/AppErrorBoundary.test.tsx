// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;
let shouldThrow = true;
let errorMessage = 'synthetic render failure';

function Unstable() {
  if (shouldThrow) throw new Error(errorMessage);
  return <p>Recovered content</p>;
}

async function renderBoundary(reload?: () => void) {
  await act(async () => {
    root.render(
      <AppErrorBoundary reload={reload}>
        <Unstable />
      </AppErrorBoundary>,
    );
  });
}

async function clickButton(label: RegExp) {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    label.test(candidate.textContent ?? ''),
  );
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  shouldThrow = true;
  errorMessage = 'synthetic render failure';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  consoleError.mockRestore();
});

describe('AppErrorBoundary', () => {
  it('replaces a crashed tree with a recoverable error screen', async () => {
    await renderBoundary();

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('Try again');
    expect(container.textContent).toContain('Reload page');
    expect(container.textContent).not.toContain('Recovered content');
  });

  it('shows developer diagnostics in development', async () => {
    await renderBoundary();

    const details = container.querySelector('details');
    expect(details).toBeTruthy();
    expect(details?.textContent).toContain('synthetic render failure');
  });

  it('retries and renders the recovered tree', async () => {
    await renderBoundary();
    shouldThrow = false;

    await clickButton(/try again/i);

    expect(container.textContent).toContain('Recovered content');
    expect(container.textContent).not.toContain('Something went wrong');
  });

  it('reloads instead of retrying when the failure is a missing chunk', async () => {
    errorMessage = 'Failed to fetch dynamically imported module: /assets/game.js';
    const reload = vi.fn();
    await renderBoundary(reload);

    await clickButton(/try again/i);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Something went wrong');
  });

  it('logs the crash for diagnostics', async () => {
    await renderBoundary();
    expect(consoleError).toHaveBeenCalled();
  });
});
