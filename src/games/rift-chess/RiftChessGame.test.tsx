// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RiftChessGame from './RiftChessGame';
import { loadPuzzleProgress, saveGame } from './persistence';

function cell(container: HTMLElement, square: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(`[data-square="${square}"]`);
  if (!element) throw new Error(`Missing cell ${square}`);
  return element;
}

function group(container: HTMLElement, label: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`);
  if (!element) throw new Error(`Missing group ${label}`);
  return element;
}

function clickText(scope: HTMLElement, text: string) {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!button) throw new Error(`Missing button ${text}`);
  act(() => button.click());
}

function drag(source: HTMLElement, target: HTMLElement) {
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };
  const dispatch = (element: HTMLElement, type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    act(() => element.dispatchEvent(event));
  };
  dispatch(source, 'dragstart');
  dispatch(target, 'dragover');
  dispatch(target, 'drop');
}

describe('RiftChessGame', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  function renderGame() {
    act(() => root.render(<RiftChessGame />));
  }

  function renderLocal() {
    renderGame();
    clickText(group(container, 'Game mode'), '2 players');
  }

  describe('board', () => {
    it('renders sixty-four accessible cells with the starting position', () => {
      renderLocal();

      expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(64);
      expect(cell(container, 'e1').getAttribute('aria-label')).toBe('e1, white king');
      expect(cell(container, 'e2').getAttribute('aria-label')).toBe('e2, white pawn');
      expect(cell(container, 'd8').getAttribute('aria-label')).toBe('d8, black queen');
      expect(cell(container, 'e4').getAttribute('aria-label')).toBe('e4, empty');
      expect(container.textContent).toContain('White to move.');
    });

    it('selects a piece, shows targets and announces the legal count', () => {
      renderLocal();
      act(() => cell(container, 'e2').click());

      expect(cell(container, 'e2').getAttribute('aria-selected')).toBe('true');
      expect(cell(container, 'e4').getAttribute('aria-label')).toContain('legal move');
      expect(container.textContent).toContain('2 legal moves.');
    });

    it('plays a pawn move and updates the move list and turn', () => {
      renderLocal();
      act(() => cell(container, 'e2').click());
      act(() => cell(container, 'e4').click());

      expect(cell(container, 'e4').getAttribute('aria-label')).toBe('e4, white pawn');
      expect(cell(container, 'e2').getAttribute('aria-label')).toBe('e2, empty');
      expect(container.textContent).toContain('e4');
      expect(container.textContent).toContain('Black to move.');
      expect(container.textContent).toContain('1 plies');
    });

    it('keeps the selection and announces an illegal move', () => {
      renderLocal();
      act(() => cell(container, 'e2').click());
      act(() => cell(container, 'e5').click());

      expect(cell(container, 'e2').getAttribute('aria-selected')).toBe('true');
      expect(container.textContent).toContain('That move is not legal');
    });

    it('undoes the last move and restores the starting square', () => {
      renderLocal();
      act(() => cell(container, 'e2').click());
      act(() => cell(container, 'e4').click());

      clickText(container, 'Undo');

      expect(cell(container, 'e2').getAttribute('aria-label')).toBe('e2, white pawn');
      expect(container.textContent).toContain('No moves yet.');
    });

    it('moves keyboard focus with the arrow keys', () => {
      renderLocal();
      act(() => cell(container, 'e2').focus());
      act(() => {
        cell(container, 'e2').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
        );
      });

      expect(document.activeElement).toBe(cell(container, 'e3'));
    });

    it('flips the board so the first cell becomes h1', () => {
      renderLocal();
      const flip = container.querySelector<HTMLButtonElement>('button[aria-label="Flip board"]');
      expect(flip).not.toBeNull();
      act(() => flip!.click());

      const cells = container.querySelectorAll('[role="gridcell"]');
      expect(cells[0].getAttribute('data-square')).toBe('h1');
    });

    it('moves a piece by dragging it to a legal square', () => {
      renderLocal();
      drag(cell(container, 'e2'), cell(container, 'e4'));

      expect(cell(container, 'e4').getAttribute('aria-label')).toBe('e4, white pawn');
      expect(container.textContent).toContain('Black to move.');
    });

    it('rejects a drop on an illegal square and keeps the piece selected', () => {
      renderLocal();
      drag(cell(container, 'e2'), cell(container, 'e5'));

      expect(cell(container, 'e2').getAttribute('aria-selected')).toBe('true');
      expect(container.textContent).toContain('That move is not legal');
    });
  });

  describe('sound', () => {
    it('toggles the mute control', () => {
      renderLocal();
      const button = container.querySelector<HTMLButtonElement>('button[aria-label="Mute sound"]');
      expect(button?.getAttribute('aria-pressed')).toBe('false');

      act(() => button!.click());

      expect(
        container.querySelector<HTMLButtonElement>('button[aria-label="Enable sound"]')?.getAttribute('aria-pressed'),
      ).toBe('true');
    });
  });

  describe('modes', () => {
    it('opens on the computer mode with colour and level choices', () => {
      renderGame();

      const modeGroup = group(container, 'Game mode');
      expect([...modeGroup.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
        'Vs computer',
        '2 players',
        'Puzzles',
        'Free board',
      ]);
      expect(modeGroup.querySelector('[aria-pressed="true"]')?.textContent).toBe('Vs computer');
      expect(group(container, 'Play as')).toBeTruthy();
      expect(group(container, 'Computer level')).toBeTruthy();
      expect(container.textContent).toContain('Casual');
    });

    it('shows the local clock and draw offer in two-player mode', () => {
      renderLocal();

      expect(group(container, 'Local clock')).toBeTruthy();
      expect(container.textContent).toContain('Offer draw');
      expect(container.querySelector('[role="group"][aria-label="Computer level"]')).toBeNull();
    });

    it('allows both sides to move on a free board without setup controls', () => {
      renderGame();
      clickText(group(container, 'Game mode'), 'Free board');

      expect(container.querySelector('[role="group"][aria-label="Play as"]')).toBeNull();
      expect(container.querySelector('[role="group"][aria-label="Local clock"]')).toBeNull();

      act(() => cell(container, 'e2').click());
      act(() => cell(container, 'e4').click());
      act(() => cell(container, 'e7').click());
      act(() => cell(container, 'e5').click());

      expect(cell(container, 'e5').getAttribute('aria-label')).toBe('e5, black pawn');
      expect(container.textContent).toContain('White to move.');
    });

    it('starts the local clock at five minutes when selected', () => {
      renderLocal();
      clickText(group(container, 'Local clock'), '5 min');

      expect(container.textContent).toContain('5:00');
      expect(container.textContent).toContain('White clock');
      expect(container.textContent).toContain('Black clock');
    });
  });

  describe('puzzles', () => {
    it('loads the first puzzle and accepts its key move', () => {
      renderGame();
      clickText(group(container, 'Game mode'), 'Puzzles');

      expect(container.textContent).toContain('Back-rank finish');
      expect(cell(container, 'f2').getAttribute('aria-label')).toBe('f2, white rook');

      act(() => cell(container, 'f2').click());
      act(() => cell(container, 'f8').click());

      expect(container.textContent).toContain('Puzzle solved');
      expect(loadPuzzleProgress().solved).toContain('p01');
    });

    it('rejects a legal move that is not the mating line', () => {
      renderGame();
      clickText(group(container, 'Game mode'), 'Puzzles');

      act(() => cell(container, 'd7').click());
      act(() => cell(container, 'a7').click());

      expect(container.textContent).toContain('That is not the mating move');
      expect(cell(container, 'd7').getAttribute('aria-label')).toBe('d7, white rook');
      expect(container.textContent).not.toContain('Puzzle solved');
    });
  });

  describe('persistence and endings', () => {
    it('restores a saved computer game on mount', () => {
      saveGame({
        version: 1,
        mode: 'ai',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        moves: ['e4', 'e5'],
        playerColor: 'w',
        level: 'club',
        clocks: null,
        baseMinutes: null,
        savedAt: Date.now(),
      });

      renderGame();

      expect(container.textContent).toMatch(/resumed/i);
      expect(container.textContent).toContain('e4');
      expect(container.textContent).toContain('e5');
      expect(cell(container, 'e4').getAttribute('aria-label')).toBe('e4, white pawn');
    });

    it('confirms a resignation and ends the game', () => {
      renderLocal();
      clickText(container, 'Resign');

      const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.textContent).toContain('White resigns?');
      clickText(dialog!, 'Resign');

      expect(container.textContent).toContain('Black wins by resignation');
      expect(container.textContent).toContain('New game');
    });
  });
});
