// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftChessGame from './RiftChessGame';

let container: HTMLDivElement;
let root: Root;

async function render(initialFen?: string) {
  await act(async () => {
    root.render(<RiftChessGame initialFen={initialFen} onStart={vi.fn()} onComplete={vi.fn()} />);
  });
}

async function clickButton(name: string) {
  const button = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name);
  if (!button) throw new Error(`Button not found: ${name}`);
  await act(async () => button.click());
}

async function clickSquare(square: string) {
  const button = container.querySelector<HTMLButtonElement>(`[data-square="${square}"]`);
  if (!button) throw new Error(`Square not found: ${square}`);
  await act(async () => button.click());
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('Rift Chess playable board', () => {
  it('opens a local two-player board and applies a legal move', async () => {
    await render();
    await clickButton('Play local game');

    expect(container.querySelector('[role="grid"]')).not.toBeNull();

    await clickSquare('e2');
    await clickSquare('e4');

    expect(container.textContent).toContain('e4');
    expect(container.textContent).toContain('Black to move');
  });

  it('undoes a local move and restores the starting position', async () => {
    await render();
    await clickButton('Play local game');
    await clickSquare('e2');
    await clickSquare('e4');
    await clickButton('Undo move');

    expect(container.querySelector('[aria-label="e2, white pawn"]')).not.toBeNull();
    expect(container.textContent).toContain('White to move');
    expect(container.textContent).not.toContain('e4');
  });

  it('offers all four promotion choices and applies the selected piece', async () => {
    await render('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    await clickButton('Play local game');
    await clickSquare('a7');
    await clickSquare('a8');

    expect(container.querySelector('[role="dialog"][aria-labelledby="promotion-title"]')).not.toBeNull();
    const knight = container.querySelector<HTMLButtonElement>('button[aria-label="Knight"]');
    expect(knight).not.toBeNull();
    await act(async () => knight!.click());

    expect(container.querySelector('[aria-label="a8, white knight"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
