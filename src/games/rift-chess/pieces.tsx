import type { Color, PieceSymbol } from 'chess.js';
import { cn } from '../../lib/cn';

export function ChessPiece({
  type,
  color,
  className,
}: {
  type: PieceSymbol;
  color: Color;
  className?: string;
}) {
  const fill = color === 'w' ? '#f8fbff' : '#111827';
  const stroke = color === 'w' ? '#263445' : '#d8e5f1';

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={cn('h-[78%] w-[78%] drop-shadow-[0_2px_1px_rgba(0,0,0,0.32)]', className)}
    >
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === 'p' ? (
          <>
            <circle cx="32" cy="17" r="8" />
            <path d="M24 28 L20 45 H44 L40 28 Z" />
            <path d="M17 49 H47 L51 55 H13 Z" />
            <path d="M23 34 H41" fill="none" opacity="0.7" />
          </>
        ) : null}
        {type === 'r' ? (
          <>
            <path d="M16 12 H25 V20 H39 V12 H48 V29 H44 L46 46 H18 L20 29 H16 Z" />
            <path d="M14 50 H50 L53 56 H11 Z" />
            <path d="M23 31 V43 M32 31 V43 M41 31 V43" fill="none" opacity="0.65" />
          </>
        ) : null}
        {type === 'n' ? (
          <>
            <path d="M17 49 L22 37 L17 28 L27 12 L43 16 L49 28 L43 34 L46 47 Z" />
            <path d="M26 20 L33 25 L39 23 L34 14" fill="none" />
            <circle cx="39" cy="28" r="2" fill={stroke} stroke="none" />
            <path d="M16 50 H49 L53 56 H12 Z" />
            <path d="M24 39 L39 39" fill="none" opacity="0.65" />
          </>
        ) : null}
        {type === 'b' ? (
          <>
            <path d="M32 8 L43 22 L38 29 L46 44 H18 L26 29 L21 22 Z" />
            <path d="M28 17 L37 30" fill="none" strokeWidth="3.2" />
            <path d="M16 49 H48 L52 56 H12 Z" />
            <path d="M22 44 H42" fill="none" opacity="0.65" />
          </>
        ) : null}
        {type === 'q' ? (
          <>
            <path d="M15 16 L23 29 L32 12 L41 29 L49 16 L45 43 H19 Z" />
            <circle cx="15" cy="13" r="3.2" />
            <circle cx="32" cy="9" r="3.2" />
            <circle cx="49" cy="13" r="3.2" />
            <path d="M16 48 H48 L52 56 H12 Z" />
            <path d="M21 35 H43" fill="none" opacity="0.65" />
          </>
        ) : null}
        {type === 'k' ? (
          <>
            <path d="M28 7 H36 V16 H45 V24 H36 V29 L43 43 H21 L28 29 V24 H19 V16 H28 Z" />
            <path d="M17 48 H47 L52 56 H12 Z" />
            <path d="M23 37 H41" fill="none" opacity="0.65" />
          </>
        ) : null}
      </g>
    </svg>
  );
}
