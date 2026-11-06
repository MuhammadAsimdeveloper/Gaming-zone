import type { Color, PieceSymbol } from 'chess.js';
import { cn } from '../../lib/cn';

const COLOR_NAMES: Record<Color, string> = { w: 'white', b: 'black' };

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export function pieceLabel(color: Color, type: PieceSymbol): string {
  return `${COLOR_NAMES[color]} ${PIECE_NAMES[type]}`;
}

function Pawn() {
  return (
    <>
      <circle cx="22.5" cy="13" r="4.8" />
      <path d="M22.5 18.5C20 22 18.5 25.5 18.5 29L17 33h11l-1.5-4c0-3.5-1.5-7-4-10.5Z" />
      <rect x="14.5" y="33" width="16" height="3.2" rx="1.4" />
    </>
  );
}

function Rook() {
  return (
    <>
      <path d="M14 17h4v3h3v-3h3v3h3v-3h4v13H14Z" />
      <rect x="16" y="30" width="13" height="2.5" rx="0.8" />
      <rect x="13" y="32.5" width="19" height="3.5" rx="1.4" />
    </>
  );
}

function Knight() {
  return (
    <>
      <path d="M16 34v-5l4.5-3-1.5-3.5 4.5-6 4.5 2.5 3.5 6-3 2 2.5 7Z" />
      <circle cx="25.5" cy="21" r="0.9" fill="#0b1020" stroke="none" />
      <rect x="14" y="34" width="17" height="3" rx="1.4" />
    </>
  );
}

function Bishop() {
  return (
    <>
      <path d="M22.5 7 27.5 16l-5 5.5L17.5 16Z" />
      <path d="M22.5 10.5v7" fill="none" />
      <rect x="18" y="22.5" width="9" height="2" rx="1" />
      <path d="M19 24.5h7L28 32H17Z" />
      <rect x="14.5" y="32" width="16" height="3.2" rx="1.4" />
    </>
  );
}

function Queen() {
  return (
    <>
      <path d="M12 18l3.5 12h14L33 18l-5.5 5L26 13l-3.5 8L19 13l-1.5 10Z" />
      <circle cx="12" cy="16" r="1.4" />
      <circle cx="19" cy="11" r="1.4" />
      <circle cx="26" cy="11" r="1.4" />
      <circle cx="33" cy="16" r="1.4" />
      <rect x="13.5" y="31" width="18" height="3.5" rx="1.5" />
    </>
  );
}

function King() {
  return (
    <>
      <path d="M22.5 5v7M19 8h7" fill="none" />
      <path d="M14 18l3.5 12h10L31 18l-4.5 4L22.5 14l-4 8Z" />
      <rect x="13" y="31" width="19" height="3.5" rx="1.5" />
    </>
  );
}

function PieceShape({ type }: { type: PieceSymbol }) {
  switch (type) {
    case 'p':
      return <Pawn />;
    case 'n':
      return <Knight />;
    case 'b':
      return <Bishop />;
    case 'r':
      return <Rook />;
    case 'q':
      return <Queen />;
    case 'k':
      return <King />;
  }
}

export function PieceGlyph({
  type,
  color,
  className,
}: {
  type: PieceSymbol;
  color: Color;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 45 45"
      aria-hidden="true"
      className={cn(
        'h-full w-full drop-shadow-[0_2px_3px_rgba(3,6,16,0.55)]',
        color === 'w'
          ? 'fill-[#eaf0ff] stroke-[#7fa6ff]'
          : 'fill-[#101728] stroke-[#b18cff]',
        className,
      )}
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <PieceShape type={type} />
    </svg>
  );
}
