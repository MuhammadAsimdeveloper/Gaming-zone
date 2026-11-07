import { useRef, useState, type KeyboardEvent } from 'react';
import type { Color, Square } from 'chess.js';
import { cn } from '../../lib/cn';
import type { BoardPiece } from './rules';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

const PIECE_LABEL: Record<BoardPiece['type'], string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};

const PIECE_GLYPH: Record<Color, Record<BoardPiece['type'], string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

export interface ChessBoardProps {
  pieces: BoardPiece[];
  orientation: Color;
  selectedSquare: Square | null;
  legalTargets: Square[];
  lastMove: { from: Square; to: Square } | null;
  checkedKing: Square | null;
  turn: Color;
  onSquareClick: (square: Square) => void;
  onClearSelection: () => void;
}

export function ChessBoard({
  pieces,
  orientation,
  selectedSquare,
  legalTargets,
  lastMove,
  checkedKing,
  turn,
  onSquareClick,
  onClearSelection,
}: ChessBoardProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pieceAt = new Map(pieces.map((piece) => [piece.square, piece]));
  const files = orientation === 'w' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'w' ? RANKS : [...RANKS].reverse();
  const squares = ranks.flatMap((rank) => files.map((file) => `${file}${rank}` as Square));
  const rows = Array.from({ length: 8 }, (_, index) => squares.slice(index * 8, index * 8 + 8));
  const [focusedSquare, setFocusedSquare] = useState<Square | null>(squares[0] ?? null);

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      if (selectedSquare) {
        event.preventDefault();
        onClearSelection();
      }
      return;
    }

    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = movement[event.key];
    if (!delta) return;

    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const current = target.dataset.square as Square | undefined;
    if (!current) return;

    const currentFile = files.indexOf(current[0] as (typeof FILES)[number]);
    const currentRank = ranks.indexOf(Number(current[1]) as (typeof RANKS)[number]);
    const nextFile = currentFile + delta[0];
    const nextRank = currentRank + delta[1];
    if (nextFile < 0 || nextFile >= 8 || nextRank < 0 || nextRank >= 8) return;

    event.preventDefault();
    const nextSquare = squares[nextRank * 8 + nextFile];
    if (nextSquare) {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-square="${nextSquare}"]`)
        ?.focus();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,36rem)]">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
        <span>{orientation === 'w' ? 'Black' : 'White'} side</span>
        <span>{turn === 'w' ? 'White to move' : 'Black to move'}</span>
      </div>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Rift Chess board"
        aria-rowcount={8}
        aria-colcount={8}
        onKeyDown={handleGridKeyDown}
        className="grid overflow-hidden rounded-xl border border-white/20 shadow-[0_16px_48px_-28px_rgba(0,0,0,0.9)]"
      >
        {rows.map((rowSquares, rowIndex) => (
          <div key={rowIndex} role="row" className="grid grid-cols-8">
            {rowSquares.map((square, columnIndex) => {
          const index = rowIndex * 8 + columnIndex;
          const piece = pieceAt.get(square);
          const selected = square === selectedSquare;
          const target = legalTargets.includes(square);
          const last = lastMove?.from === square || lastMove?.to === square;
          const checked = checkedKing === square;
          const fileIndex = index % 8;
          const rankIndex = Math.floor(index / 8);
          const isLight = (fileIndex + rankIndex) % 2 === 1;
          const label = piece
            ? `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_LABEL[piece.type]}`
            : `${square}, empty square`;

          return (
            <button
              key={square}
              type="button"
              role="gridcell"
              data-square={square}
              data-legal-target={target ? 'true' : undefined}
              aria-label={label}
              aria-selected={selected}
              aria-current={checked ? 'true' : undefined}
              tabIndex={focusedSquare === square ? 0 : -1}
              onFocus={() => setFocusedSquare(square)}
              onClick={() => {
                setFocusedSquare(square);
                onSquareClick(square);
              }}
              className={cn(
                'relative flex aspect-square min-w-0 touch-manipulation items-center justify-center outline-none transition-colors focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-cyan-300',
                isLight ? 'bg-[#d9e2e9]' : 'bg-[#53677a]',
                last && 'bg-[#91a8b2]',
                checked && 'bg-rose-500/80',
                selected && 'z-[1] bg-cyan-300/80 ring-4 ring-inset ring-cyan-200',
              )}
            >
              {rankIndex === 7 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute bottom-0.5 left-1 text-[8px] font-bold sm:text-[10px]',
                    isLight ? 'text-slate-600' : 'text-slate-100',
                  )}
                >
                  {square[0]}
                </span>
              ) : null}
              {fileIndex === 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-1 top-0.5 text-[8px] font-bold sm:text-[10px]',
                    isLight ? 'text-slate-600' : 'text-slate-100',
                  )}
                >
                  {square[1]}
                </span>
              ) : null}
              {piece ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'select-none text-[clamp(1.45rem,7vw,3.55rem)] leading-none sm:text-[clamp(2rem,5.5vw,3.7rem)]',
                    piece.color === 'w'
                      ? 'text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.45)]'
                      : 'text-slate-950 [text-shadow:0_1px_0_rgba(255,255,255,0.3)]',
                  )}
                >
                  {PIECE_GLYPH[piece.color][piece.type]}
                </span>
              ) : null}
              {target ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute rounded-full',
                    piece ? 'inset-[8%] border-[3px] border-emerald-600/80' : 'h-[22%] w-[22%] bg-emerald-700/55',
                  )}
                />
              ) : null}
            </button>
          );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
