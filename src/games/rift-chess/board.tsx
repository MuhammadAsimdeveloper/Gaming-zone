import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { Color, Square } from 'chess.js';
import { cn } from '../../lib/cn';
import { PieceGlyph, pieceLabel } from './pieces';
import type { MoveView, PieceView } from './rules';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;

export interface ChessBoardProps {
  pieces: PieceView[];
  turn: Color;
  selected: Square | null;
  targets: MoveView[];
  lastMove: { from: Square; to: Square } | null;
  checkedKing: Square | null;
  flipped?: boolean;
  disabled?: boolean;
  onSquareActivate: (square: Square) => void;
  onDragMove: (from: Square, to: Square) => void;
  onEscape: () => void;
}

export function ChessBoard({
  pieces,
  turn,
  selected,
  targets,
  lastMove,
  checkedKing,
  flipped = false,
  disabled = false,
  onSquareActivate,
  onDragMove,
  onEscape,
}: ChessBoardProps) {
  const [focused, setFocused] = useState<Square>('e2');
  const buttons = useRef(new Map<Square, HTMLButtonElement>());
  const dragFrom = useRef<Square | null>(null);
  const pieceBySquare = new Map(pieces.map((piece) => [piece.square, piece]));

  const targetMap = new Map<Square, MoveView>();
  for (const target of targets) {
    if (!targetMap.has(target.to)) targetMap.set(target.to, target);
  }

  const displayFiles = flipped ? [...FILES].reverse() : [...FILES];
  const displayRanks = flipped ? [...RANKS].reverse() : [...RANKS];

  function focusSquare(square: Square) {
    setFocused(square);
    buttons.current.get(square)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, square: Square) {
    const fileIndex = displayFiles.indexOf(square[0] as (typeof FILES)[number]);
    const rankIndex = displayRanks.indexOf(square[1] as (typeof RANKS)[number]);
    if (fileIndex === -1 || rankIndex === -1) return;

    let nextFile = fileIndex;
    let nextRank = rankIndex;

    switch (event.key) {
      case 'ArrowLeft':
        nextFile -= 1;
        break;
      case 'ArrowRight':
        nextFile += 1;
        break;
      case 'ArrowUp':
        nextRank -= 1;
        break;
      case 'ArrowDown':
        nextRank += 1;
        break;
      case 'Home':
        nextFile = 0;
        break;
      case 'End':
        nextFile = displayFiles.length - 1;
        break;
      case 'PageUp':
        nextRank = 0;
        break;
      case 'PageDown':
        nextRank = displayRanks.length - 1;
        break;
      case 'Escape':
        event.preventDefault();
        onEscape();
        return;
      default:
        return;
    }

    if (nextFile < 0 || nextFile > 7 || nextRank < 0 || nextRank > 7) return;
    event.preventDefault();
    focusSquare(`${displayFiles[nextFile]}${displayRanks[nextRank]}` as Square);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, square: Square, piece: PieceView | undefined) {
    if (disabled || !piece || piece.color !== turn) {
      event.preventDefault();
      return;
    }
    dragFrom.current = square;
    event.dataTransfer.setData('text/plain', square);
    event.dataTransfer.effectAllowed = 'move';
    onSquareActivate(square);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    if (!dragFrom.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, square: Square) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (!from) return;
    event.preventDefault();
    if (from !== square) onDragMove(from, square);
  }

  return (
    <div
      role="grid"
      aria-label={`Chess board, ${turn === 'w' ? 'White' : 'Black'} to move`}
      aria-rowcount={8}
      aria-colcount={8}
      className="w-full overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_0_40px_rgba(3,6,16,0.6)]"
    >
      {displayRanks.map((rank, rowIndex) => (
        <div role="row" key={rank} className="grid grid-cols-8">
          {displayFiles.map((file, columnIndex) => {
            const square = `${file}${rank}` as Square;
            const piece = pieceBySquare.get(square);
            const isSelected = selected === square;
            const target = targetMap.get(square);
            const isLastMove = lastMove?.from === square || lastMove?.to === square;
            const isChecked = checkedKing === square;
            const isLight = (FILES.indexOf(file as (typeof FILES)[number]) + RANKS.indexOf(rank as (typeof RANKS)[number])) % 2 === 0;

            return (
              <button
                key={square}
                ref={(element) => {
                  if (element) buttons.current.set(square, element);
                  else buttons.current.delete(square);
                }}
                type="button"
                role="gridcell"
                data-square={square}
                aria-label={`${square}, ${piece ? pieceLabel(piece.color, piece.type) : 'empty'}${isSelected ? ', selected' : ''}${target ? ', legal move' : ''}`}
                aria-selected={isSelected}
                disabled={disabled}
                draggable={!disabled && Boolean(piece) && piece?.color === turn}
                tabIndex={focused === square ? 0 : -1}
                onClick={() => onSquareActivate(square)}
                onFocus={() => setFocused(square)}
                onKeyDown={(event) => handleKeyDown(event, square)}
                onDragStart={(event) => handleDragStart(event, square, piece)}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(event, square)}
                onDragEnd={() => {
                  dragFrom.current = null;
                }}
                className={cn(
                  'relative aspect-square touch-manipulation select-none outline-none transition-colors duration-150 motion-reduce:transition-none',
                  isLight
                    ? 'bg-[#1c2644] contrast-more:bg-[#2c3b6b]'
                    : 'bg-[#0e1529] contrast-more:bg-[#050914]',
                  'focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-electric-300 contrast-more:focus-visible:outline-white',
                  isSelected && 'shadow-[inset_0_0_0_2px_rgba(76,141,255,0.95)] contrast-more:shadow-[inset_0_0_0_3px_#ffffff]',
                  disabled
                    ? 'cursor-default'
                    : piece && piece.color === turn
                      ? 'cursor-grab hover:bg-[#243055] active:cursor-grabbing'
                      : 'cursor-pointer hover:bg-[#243055]',
                )}
              >
                {isLastMove ? (
                  <span aria-hidden="true" className="absolute inset-0 bg-electric-400/12" />
                ) : null}
                {isChecked ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,110,110,0.5),transparent_72%)]"
                  />
                ) : null}

                {piece ? (
                  <span className="pointer-events-none absolute inset-[5%]">
                    <PieceGlyph type={piece.type} color={piece.color} />
                  </span>
                ) : null}

                {target && !piece ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-electric-300/85 shadow-[0_0_10px_rgba(76,141,255,0.9)] contrast-more:bg-white"
                  />
                ) : null}
                {target && piece ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[8%] rounded-[6px] border-2 border-coral/85 contrast-more:border-white"
                  />
                ) : null}

                {rowIndex === 7 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-0.5 right-0.5 text-[8px] font-semibold uppercase text-white/40 sm:text-[9px]"
                  >
                    {file}
                  </span>
                ) : null}
                {columnIndex === 0 ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0.5 top-0.5 text-[8px] font-semibold text-white/40 sm:text-[9px]"
                  >
                    {rank}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
