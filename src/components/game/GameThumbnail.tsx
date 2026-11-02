import { Gamepad2 } from 'lucide-react';
import { useState } from 'react';
import type { Game } from '../../types/game';

export function GameThumbnail({
  game,
  priority = false,
  className,
}: {
  game: Game;
  priority?: boolean;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === game.thumbnail;

  return (
    <div
      className={className ?? 'absolute inset-0'}
      style={{
        background: `radial-gradient(120% 100% at 18% 0%, ${game.accent}40, #0a1122 64%)`,
      }}
    >
      <Gamepad2
        className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/15"
        aria-hidden="true"
      />
      {!failed ? (
        <img
          src={game.thumbnail}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedSrc(game.thumbnail)}
          className="relative h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
        />
      ) : null}
    </div>
  );
}
