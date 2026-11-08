// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RiftChessGame from './RiftChessGame';

let container: HTMLDivElement;
let root: Root;

async function render(initialFen?: string, onComplete: (event: { outcome?: string }) => void = vi.fn()) {
  await act(async () => {
    root.render(<RiftChessGame initialFen={initialFen} onStart={vi.fn()} onComplete={onComplete} />);
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

  it('plays against the computer with configurable side and strength', async () => {
    await render();
    await clickButton('vs Computer');

    expect(container.textContent).toContain('Computer strength');
    expect(container.textContent).toContain('Play as');
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('vs Computer');
    const playAs = container.querySelector('[role="group"][aria-label="Play as"]');
    await clickButton('Black');
    expect(playAs?.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Black');
  });

  it('starts a timed game, autosaves it, and resumes the saved position', async () => {
    localStorage.clear();
    await render();
    await clickButton('5 min');
    await clickButton('Play local game');

    expect(container.textContent).toContain('White clock');
    expect(container.textContent).toContain('Black clock');

    await clickSquare('e2');
    await clickSquare('e4');
    expect(localStorage.getItem('neonrift:rift-chess:save:v1')).not.toBeNull();

    const back = container.querySelector<HTMLButtonElement>('button[aria-label="Back to setup"]');
    expect(back).not.toBeNull();
    await act(async () => back!.click());
    await clickButton('Resume saved game');

    expect(container.querySelector('[role="grid"]')).not.toBeNull();
    expect(container.textContent).toContain('e4');
    expect(container.textContent).toContain('Black to move');
    expect(container.textContent).toContain('White clock');
  });

  it('offers all four promotion choices and applies the selected piece', async () => {
    await render('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    await clickButton('Play local game');
    await clickSquare('a7');
    await clickSquare('a8');

    expect(container.querySelector('[role="dialog"][aria-labelledby="promotion-title"]')).not.toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Queen');
    const choices = ['Queen', 'Rook', 'Bishop', 'Knight'];
    expect(choices.every((label) => container.querySelector(`button[aria-label="${label}"]`))).toBe(true);
    const knight = container.querySelector<HTMLButtonElement>('button[aria-label="Knight"]');
    expect(knight).not.toBeNull();
    await act(async () => knight!.click());

    expect(container.querySelector('[aria-label="a8, white knight"]')).not.toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('traps promotion dialog focus and restores it to the source square on Escape', async () => {
    await render('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    await clickButton('Play local game');
    await clickSquare('a7');
    await clickSquare('a8');

    const queen = container.querySelector<HTMLButtonElement>('button[aria-label="Queen"]')!;
    const cancel = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancel')!;
    expect(document.activeElement).toBe(queen);

    await act(async () => {
      queen.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(queen);

    await act(async () => {
      queen.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.getAttribute('data-square')).toBe('a7');
  });

  it('reports a fifty-move-rule ending as a draw', async () => {
    const onComplete = vi.fn();
    await render('8/8/8/8/8/5k2/8/4K2R w - - 99 51', onComplete);
    await clickButton('Play local game');
    await clickSquare('h1');
    await clickSquare('h2');

    expect(container.textContent).toContain('Draw by the fifty-move rule');
    expect(onComplete).toHaveBeenCalledWith({ outcome: 'draw' });
  });

  it('uses the correct piece colour when black promotes', async () => {
    await render('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
    await clickButton('Play local game');
    await clickSquare('a2');
    await clickSquare('a1');

    const rook = container.querySelector<HTMLButtonElement>('button[aria-label="Rook"]');
    expect(rook?.textContent).toContain('♜');
    await act(async () => rook!.click());

    expect(container.querySelector('[aria-label="a1, black rook"]')).not.toBeNull();
  });
});
