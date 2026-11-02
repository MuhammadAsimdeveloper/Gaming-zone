import { useEffect, useRef, useState } from 'react';
import {
  Brain,
  Flame,
  Gem,
  Heart,
  Moon,
  Music,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import {
  GameButton,
  GameFrame,
  GameOverlay,
  GameSegmented,
  GameStat,
  type SegmentOption,
} from '../shared/GameFrame';
import { useBestScore } from '../shared/useBestScore';

type BoardSize = 6 | 8;
type PairChoice = '6' | '8';
type Phase = 'ready' | 'playing' | 'won';

interface Card {
  id: string;
  face: number;
  matched: boolean;
}

interface Face {
  name: string;
  Icon: LucideIcon;
}

const FACES: ReadonlyArray<Face> = [
  { name: 'Star', Icon: Star },
  { name: 'Zap', Icon: Zap },
  { name: 'Heart', Icon: Heart },
  { name: 'Moon', Icon: Moon },
  { name: 'Flame', Icon: Flame },
  { name: 'Rocket', Icon: Rocket },
  { name: 'Gem', Icon: Gem },
  { name: 'Music', Icon: Music },
];

const SIZE_OPTIONS: ReadonlyArray<SegmentOption<PairChoice>> = [
  { value: '6', label: '6 pairs' },
  { value: '8', label: '8 pairs' },
];

const BEST_KEYS: Record<BoardSize, string> = {
  6: 'neonrift:game:memory:best:6',
  8: 'neonrift:game:memory:best:8',
};

function shuffle<T>(items: ReadonlyArray<T>): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = next[i];
    next[i] = next[j];
    next[j] = temp;
  }
  return next;
}

function buildDeck(pairs: BoardSize): Card[] {
  const deck: Card[] = [];
  for (let face = 0; face < pairs; face += 1) {
    deck.push({ id: `${face}-a`, face, matched: false });
    deck.push({ id: `${face}-b`, face, matched: false });
  }
  return shuffle(deck);
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MemoryGame({ onStart, onComplete }: GameComponentProps) {
  const bestSix = useBestScore(BEST_KEYS[6], true);
  const bestEight = useBestScore(BEST_KEYS[8], true);

  const [pairs, setPairs] = useState<BoardSize>(6);
  const [cards, setCards] = useState<Card[]>(() => buildDeck(6));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [locked, setLocked] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [newRecord, setNewRecord] = useState(false);

  const flipTimerRef = useRef<number | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(
    () => () => {
      if (flipTimerRef.current !== null) window.clearTimeout(flipTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'playing') return undefined;

    const interval = window.setInterval(() => {
      if (timerStartRef.current !== null) {
        setSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing' || matchedPairs === 0 || matchedPairs !== pairs) return;
    if (finishedRef.current) return;
    finishedRef.current = true;

    const elapsed =
      timerStartRef.current !== null
        ? Math.max(1, Math.round((Date.now() - timerStartRef.current) / 1000))
        : seconds;
    const score = Math.max(0, 1000 - moves * 10 - elapsed * 2);
    const currentBest = pairs === 6 ? bestSix.best : bestEight.best;

    setSeconds(elapsed);
    setFinalScore(score);
    setNewRecord(currentBest === null || moves < currentBest);
    setPhase('won');

    if (pairs === 6) {
      bestSix.submit(moves);
    } else {
      bestEight.submit(moves);
    }

    onCompleteRef.current?.({ score, outcome: 'win' });
  }, [bestEight, bestSix, matchedPairs, moves, pairs, phase, seconds]);

  const activeBest = pairs === 6 ? bestSix.best : bestEight.best;

  const clearFlipTimer = () => {
    if (flipTimerRef.current !== null) {
      window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = null;
    }
  };

  const resetBoard = (size: BoardSize) => {
    clearFlipTimer();
    timerStartRef.current = null;
    startedRef.current = false;
    finishedRef.current = false;
    setCards(buildDeck(size));
    setFlipped([]);
    setMatchedPairs(0);
    setMoves(0);
    setSeconds(0);
    setLocked(false);
    setFinalScore(null);
    setNewRecord(false);
    setPhase('ready');
  };

  const handleSizeChange = (choice: PairChoice) => {
    if (choice === String(pairs)) return;
    const size: BoardSize = choice === '6' ? 6 : 8;
    setPairs(size);
    resetBoard(size);
  };

  const handleCardClick = (index: number) => {
    if (locked || phase === 'won') return;

    const card = cards[index];
    if (!card || card.matched || flipped.includes(index)) return;

    if (phase === 'ready') {
      timerStartRef.current = Date.now();
      setSeconds(0);
      setPhase('playing');
      if (!startedRef.current) {
        startedRef.current = true;
        onStartRef.current?.();
      }
    }

    if (flipped.length === 0) {
      setFlipped([index]);
      return;
    }

    const firstIndex = flipped[0];
    const firstCard = cards[firstIndex];
    if (!firstCard) return;

    setFlipped([firstIndex, index]);
    setMoves((current) => current + 1);
    setLocked(true);

    if (firstCard.face === card.face) {
      flipTimerRef.current = window.setTimeout(() => {
        flipTimerRef.current = null;
        setCards((current) =>
          current.map((item) =>
            item.id === firstCard.id || item.id === card.id ? { ...item, matched: true } : item,
          ),
        );
        setFlipped([]);
        setMatchedPairs((current) => current + 1);
        setLocked(false);
      }, 430);
    } else {
      flipTimerRef.current = window.setTimeout(() => {
        flipTimerRef.current = null;
        setFlipped([]);
        setLocked(false);
      }, 780);
    }
  };

  const bestLabel = activeBest === null ? '—' : `${activeBest} moves`;
  const matchedLabel = `${matchedPairs} / ${pairs}`;
  const statusLabel =
    phase === 'won'
      ? `Board cleared in ${moves} moves and ${seconds} seconds.`
      : phase === 'playing'
        ? `${matchedPairs} of ${pairs} pairs matched.`
        : 'Ready to play. Flip two cards to find a pair.';

  return (
    <GameFrame
      title="Memory Match"
      subtitle="Flip, match, remember."
      icon={Brain}
      accent="plasma"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Moves" value={moves} tone="plasma" />
          <GameStat label="Time" value={formatTime(seconds)} />
          <GameStat label="Best moves" value={bestLabel} tone="mint" />
        </div>
      }
      toolbar={
        <GameButton size="icon" variant="ghost" onClick={() => resetBoard(pairs)} aria-label="Restart game" title="Restart game">
          <RotateCcw className="h-4 w-4" />
        </GameButton>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Flip two cards per turn. Matched pairs stay face up.</span>
          <span>Fewer moves and a faster clear mean a higher score.</span>
          <span className="text-muted/80">Best moves are saved per board size.</span>
        </div>
      }
    >
      <p className="sr-only" role="status" aria-live="polite">
        {statusLabel}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <GameSegmented label="Board size" options={SIZE_OPTIONS} value={String(pairs) as PairChoice} onChange={handleSizeChange} />
        <span className="text-xs text-muted">
          Pairs <span className="font-semibold text-ink">{matchedLabel}</span>
        </span>
      </div>

      <div className={cn('relative mx-auto w-full', pairs === 6 ? 'max-w-[300px] sm:max-w-[325px]' : 'max-w-[340px] sm:max-w-[370px]')}>
        <div className={cn('grid gap-2', pairs === 6 ? 'grid-cols-3' : 'grid-cols-4')}>
          {cards.map((card, index) => {
            const face = FACES[card.face];
            const Icon = face.Icon;
            const isUp = flipped.includes(index) || card.matched;
            const label = card.matched
              ? `${face.name}, matched`
              : isUp
                ? `${face.name}, face up`
                : `Hidden card ${index + 1}`;

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(index)}
                disabled={card.matched || locked}
                aria-label={label}
                className="flip-card aspect-square w-full rounded-2xl p-0 transition active:scale-[0.97] disabled:cursor-default"
                data-flipped={isUp ? 'true' : 'false'}
              >
                <span className="flip-inner block">
                  <span className="flip-face flex items-center justify-center border border-white/10 bg-gradient-to-br from-night-800 to-night-850">
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-muted">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flip-face flip-back flex items-center justify-center border',
                      card.matched
                        ? 'border-mint/40 bg-mint/10 text-mint shadow-[0_0_24px_-12px_rgba(74,222,157,0.9)]'
                        : 'border-electric-500/25 bg-electric-500/10 text-electric-300',
                    )}
                  >
                    <Icon className={cn('h-6 w-6 sm:h-7 sm:w-7', !card.matched && isUp && 'animate-pop')} aria-hidden="true" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {phase === 'won' ? (
          <GameOverlay tone="win">
            <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">
              Board cleared
            </span>
            <p className="font-display text-3xl font-semibold tabular-nums text-ink">{finalScore ?? 0}</p>
            <p className="text-xs text-muted">
              {moves} moves · {formatTime(seconds)}
            </p>
            {newRecord ? (
              <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">
                New best moves
              </span>
            ) : (
              <p className="text-xs text-muted">Best · {bestLabel}</p>
            )}
            <GameButton variant="primary" onClick={() => resetBoard(pairs)}>
              <RotateCcw className="h-4 w-4" />
              Play again
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
