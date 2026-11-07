// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChessBoard } from './board';
import { createGame, getBoardPieces } from './rules';

let container: HTMLDivElement;
let root: Root;

async function render(props: ComponentProps<typeof ChessBoard>) {
  await act(async () => {
    root.render(<ChessBoard {...props} />);
  });
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

describe('Rift Chess board', () => {
  it('renders 64 accessible grid cells with square names', async () => {
    const onSquareClick = vi.fn();
    await render({
      pieces: getBoardPieces(createGame()),
      orientation: 'w',
      selectedSquare: null,
      legalTargets: [],
      lastMove: null,
      checkedKing: null,
      turn: 'w',
      onSquareClick,
      onClearSelection: vi.fn(),
    });

    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
    expect(container.querySelector('[aria-label="e2, white pawn"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="e4, empty square"]')).not.toBeNull();
  });

  it('renders the selected square and legal destination markers', async () => {
    await render({
      pieces: getBoardPieces(createGame()),
      orientation: 'w',
      selectedSquare: 'e2',
      legalTargets: ['e3', 'e4'],
      lastMove: null,
      checkedKing: null,
      turn: 'w',
      onSquareClick: vi.fn(),
      onClearSelection: vi.fn(),
    });

    expect(container.querySelector('[data-square="e2"]')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-square="e3"]')?.getAttribute('data-legal-target')).toBe('true');
    expect(container.querySelector('[data-square="e4"]')?.getAttribute('data-legal-target')).toBe('true');
  });

  it('changes reading order when the board is flipped', async () => {
    const props = {
      pieces: getBoardPieces(createGame()),
      selectedSquare: null,
      legalTargets: [],
      lastMove: null,
      checkedKing: null,
      turn: 'w' as const,
      onSquareClick: vi.fn(),
      onClearSelection: vi.fn(),
    };
    await render({ ...props, orientation: 'w' });
    expect(container.querySelector('[role="gridcell"]')?.getAttribute('data-square')).toBe('a8');

    await render({ ...props, orientation: 'b' });
    expect(container.querySelector('[role="gridcell"]')?.getAttribute('data-square')).toBe('h1');
  });

  it('supports arrow-key focus movement across the board', async () => {
    await render({
      pieces: getBoardPieces(createGame()),
      orientation: 'w',
      selectedSquare: null,
      legalTargets: [],
      lastMove: null,
      checkedKing: null,
      turn: 'w',
      onSquareClick: vi.fn(),
      onClearSelection: vi.fn(),
    });

    const e2 = container.querySelector<HTMLButtonElement>('[data-square="e2"]')!;
    e2.focus();
    await act(async () => {
      e2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(document.activeElement?.getAttribute('data-square')).toBe('f2');
  });

  it('clears selection with Escape', async () => {
    const onClearSelection = vi.fn();
    await render({
      pieces: getBoardPieces(createGame()),
      orientation: 'w',
      selectedSquare: 'e2',
      legalTargets: ['e3', 'e4'],
      lastMove: null,
      checkedKing: null,
      turn: 'w',
      onSquareClick: vi.fn(),
      onClearSelection,
    });

    const selected = container.querySelector<HTMLButtonElement>('[data-square="e2"]')!;
    await act(async () => {
      selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
