import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Grid3x3, RotateCcw, Sparkles, X } from 'lucide-react';
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

type Mark = 'X' | 'O';
type Cell = Mark | null;
type Mode = 'ai' | 'local';
type Difficulty = 'easy' | 'medium' | 'impossible';
type RoundStatus = 'playing' | 'won' | 'draw';
type MatchOutcome = 'win' | 'loss' | 'draw';

interface MatchSummary {
  outcome: MatchOutcome;
  winner: Mark | null;
  xWins: number;
  oWins: number;
}

const WIN_LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const MODE_OPTIONS: ReadonlyArray<SegmentOption<Mode>> = [
  { value: 'ai', label: 'Vs computer' },
  { value: 'local', label: '2 players' },
];

const DIFFICULTY_OPTIONS: ReadonlyArray<SegmentOption<Difficulty>> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'impossible', label: 'Impossible' },
];

function emptyBoard(): Cell[] {
  return Array.from({ length: 9 }, () => null);
}

function otherMark(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X';
}

function findWinner(board: Cell[]): { mark: Mark; line: number[] } | null {
  for (const [a, b, c] of WIN_LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { mark, line: [a, b, c] };
    }
  }
  return null;
}

function availableMoves(board: Cell[]): number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
}

function minimax(board: Cell[], ai: Mark, turn: Mark, depth: number): number {
  const winner = findWinner(board);
  if (winner) return winner.mark === ai ? 10 - depth : depth - 10;
  if (board.every((cell) => cell !== null)) return 0;

  const moves = availableMoves(board);

  if (turn === ai) {
    let bestScore = -Infinity;
    for (const move of moves) {
      board[move] = ai;
      bestScore = Math.max(bestScore, minimax(board, ai, otherMark(ai), depth + 1));
      board[move] = null;
    }
    return bestScore;
  }

  let bestScore = Infinity;
  for (const move of moves) {
    board[move] = turn;
    bestScore = Math.min(bestScore, minimax(board, ai, otherMark(turn), depth + 1));
    board[move] = null;
  }
  return bestScore;
}

function findBestMove(board: Cell[], ai: Mark): number {
  const moves = availableMoves(board);
  if (moves.length === 0) return -1;

  let bestScore = -Infinity;
  let candidates: number[] = [];

  for (const move of moves) {
    const trial = board.slice();
    trial[move] = ai;
    const score = minimax(trial, ai, otherMark(ai), 0);
    if (score > bestScore) {
      bestScore = score;
      candidates = [move];
    } else if (score === bestScore) {
      candidates.push(move);
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)] ?? moves[0];
}

function chooseAiMove(board: Cell[], difficulty: Difficulty): number | null {
  const moves = availableMoves(board);
  if (moves.length === 0) return null;

  if (difficulty === 'impossible') return findBestMove(board, 'O');

  if (difficulty === 'easy') {
    if (Math.random() < 0.25) return findBestMove(board, 'O');
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (Math.random() < 0.5) return findBestMove(board, 'O');
  return moves[Math.floor(Math.random() * moves.length)];
}

export default function TicTacToeGame({ onStart, onComplete }: GameComponentProps) {
  const [mode, setMode] = useState<Mode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [turn, setTurn] = useState<Mark>('X');
  const [roundStatus, setRoundStatus] = useState<RoundStatus>('playing');
  const [winningLine, setWinningLine] = useState<number[]>([]);
  const [results, setResults] = useState<Array<Mark | 'draw'>>([]);
  const [matchOver, setMatchOver] = useState<MatchSummary | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const resultsRef = useRef<Array<Mark | 'draw'>>([]);
  const timerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);
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
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const clearRoundTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    tokenRef.current += 1;
  }, []);

  const beginRound = useCallback(() => {
    clearRoundTimer();
    setBoard(emptyBoard());
    setTurn('X');
    setRoundStatus('playing');
    setWinningLine([]);
    setAiThinking(false);
  }, [clearRoundTimer]);

  const resetMatch = useCallback(() => {
    clearRoundTimer();
    resultsRef.current = [];
    setResults([]);
    setMatchOver(null);
    setBoard(emptyBoard());
    setTurn('X');
    setRoundStatus('playing');
    setWinningLine([]);
    setAiThinking(false);
    startedRef.current = false;
    finishedRef.current = false;
  }, [clearRoundTimer]);

  const endRound = (winner: Mark | null, line: number[]) => {
    const nextResults: Array<Mark | 'draw'> = [...resultsRef.current, winner ?? 'draw'];
    resultsRef.current = nextResults;
    setResults(nextResults);
    setRoundStatus(winner ? 'won' : 'draw');
    setWinningLine(line);
    setAiThinking(false);

    const xWins = nextResults.filter((result) => result === 'X').length;
    const oWins = nextResults.filter((result) => result === 'O').length;
    const matchFinished = xWins >= 3 || oWins >= 3 || nextResults.length >= 5;
    const outcome: MatchOutcome = xWins > oWins ? 'win' : xWins < oWins ? 'loss' : 'draw';

    if (matchFinished && !finishedRef.current) {
      finishedRef.current = true;
      onCompleteRef.current?.({ score: xWins, outcome });
    }

    clearRoundTimer();
    timerRef.current = window.setTimeout(
      () => {
        timerRef.current = null;
        if (matchFinished) {
          setMatchOver({ outcome, winner, xWins, oWins });
        } else {
          beginRound();
        }
      },
      matchFinished ? 1400 : 1050,
    );
  };

  const commitMove = (index: number, mark: Mark, sourceBoard: Cell[]) => {
    if (sourceBoard[index] !== null) return;

    const nextBoard = sourceBoard.slice();
    nextBoard[index] = mark;
    setBoard(nextBoard);

    const winner = findWinner(nextBoard);
    const full = nextBoard.every((cell) => cell !== null);

    if (winner || full) {
      endRound(winner ? winner.mark : null, winner ? winner.line : []);
      return;
    }

    const nextTurn = otherMark(mark);
    setTurn(nextTurn);

    if (mode === 'ai' && nextTurn === 'O') {
      setAiThinking(true);
      const token = tokenRef.current;
      timerRef.current = window.setTimeout(
        () => {
          timerRef.current = null;
          if (token !== tokenRef.current) return;
          const move = chooseAiMove(nextBoard, difficulty);
          setAiThinking(false);
          if (move !== null) commitMove(move, 'O', nextBoard);
        },
        360 + Math.random() * 320,
      );
    }
  };

  const handleCellClick = (index: number) => {
    if (matchOver || roundStatus !== 'playing' || board[index] !== null) return;
    if (mode === 'ai' && turn !== 'X') return;

    if (!startedRef.current) {
      startedRef.current = true;
      onStartRef.current?.();
    }

    commitMove(index, turn, board);
  };

  const changeMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    resetMatch();
    setMode(nextMode);
  };

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    if (nextDifficulty === difficulty) return;
    resetMatch();
    setDifficulty(nextDifficulty);
  };

  const xWins = results.filter((result) => result === 'X').length;
  const oWins = results.filter((result) => result === 'O').length;
  const matchDecided = xWins >= 3 || oWins >= 3 || results.length >= 5;
  const roundNumber = Math.min(results.length + 1, 5);
  const xLabel = mode === 'ai' ? 'You (X)' : 'Player X';
  const oLabel = mode === 'ai' ? 'CPU (O)' : 'Player O';
  const roundWinner = winningLine.length > 0 ? board[winningLine[0]] : null;

  const turnLabel = matchOver
    ? 'Match complete'
    : roundStatus === 'won'
      ? `${roundWinner ?? 'X'} takes the round`
      : roundStatus === 'draw'
        ? 'Round drawn'
        : mode === 'ai'
          ? turn === 'X'
            ? 'Your turn'
            : 'CPU thinking'
          : `Player ${turn}'s turn`;

  return (
    <GameFrame
      title="Tic-Tac-Toe"
      subtitle="Best of five. Three in a row takes it."
      icon={Grid3x3}
      accent="electric"
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label={xLabel} value={xWins} tone="electric" />
          <GameStat label="Round" value={matchOver ? 'Final' : `${roundNumber} / 5`} />
          <GameStat label={oLabel} value={oWins} tone="plasma" />
        </div>
      }
      toolbar={
        <>
          <GameButton size="sm" variant="secondary" onClick={beginRound} disabled={matchDecided || Boolean(matchOver)}>
            New round
          </GameButton>
          <GameButton size="icon" variant="ghost" onClick={resetMatch} aria-label="Reset match" title="Reset match">
            <RotateCcw className="h-4 w-4" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Click or tap a square to place your mark.</span>
          <span>First to 3 round wins takes the match; 5 rounds maximum.</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-plasma-300" aria-hidden="true" />
            Impossible uses perfect minimax play.
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GameSegmented label="Game mode" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
        {mode === 'ai' ? (
          <GameSegmented
            label="Computer difficulty"
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={changeDifficulty}
          />
        ) : (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted">
            Share one device
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted" aria-live="polite">
          {aiThinking ? (
            <span className="inline-flex items-center gap-1.5 text-electric-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric-400" aria-hidden="true" />
              CPU thinking…
            </span>
          ) : (
            turnLabel
          )}
        </p>
        <div className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => {
            const result = results[index];
            return (
              <span
                key={index}
                className={cn(
                  'h-1.5 w-5 rounded-full transition',
                  result === 'X'
                    ? 'bg-electric-400'
                    : result === 'O'
                      ? 'bg-plasma-400'
                      : result === 'draw'
                        ? 'bg-muted/60'
                        : 'bg-white/10',
                )}
              />
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[370px]">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Tic-tac-toe board">
          {board.map((cell, index) => {
            const row = Math.floor(index / 3) + 1;
            const column = (index % 3) + 1;
            const isWinning = winningLine.includes(index);
            const cellLabel = cell === 'X' ? xLabel : cell === 'O' ? oLabel : 'empty';
            const isDisabled =
              cell !== null || roundStatus !== 'playing' || matchOver !== null || (mode === 'ai' && turn === 'O');

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleCellClick(index)}
                disabled={isDisabled}
                aria-label={`Row ${row}, column ${column}: ${cellLabel}`}
                className={cn(
                  'group relative grid aspect-square place-items-center rounded-2xl border transition duration-200',
                  isWinning
                    ? 'border-mint/40 bg-mint/10 shadow-[0_0_28px_-12px_rgba(74,222,157,0.8)]'
                    : 'border-white/10 bg-night-850/80',
                  !isDisabled && 'hover:border-electric-500/40 hover:bg-night-800 active:scale-[0.98]',
                  isDisabled && 'cursor-default',
                )}
              >
                {cell === 'X' ? (
                  <X className="h-9 w-9 text-electric-300 sm:h-10 sm:w-10" strokeWidth={2.1} aria-hidden="true" />
                ) : cell === 'O' ? (
                  <Circle className="h-8 w-8 text-plasma-300 sm:h-9 sm:w-9" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-white/10 transition group-hover:bg-electric-400/40"
                  />
                )}
              </button>
            );
          })}
        </div>

        {matchOver ? (
          <GameOverlay tone={matchOver.outcome === 'win' ? 'win' : matchOver.outcome === 'loss' ? 'loss' : 'default'}>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Match complete
            </span>
            <p className="font-display text-2xl font-semibold text-ink">
              {mode === 'ai'
                ? matchOver.outcome === 'win'
                  ? 'You win the match'
                  : matchOver.outcome === 'loss'
                    ? 'CPU takes the match'
                    : 'Match drawn'
                : matchOver.winner
                  ? `Player ${matchOver.winner} wins`
                  : 'Match drawn'}
            </p>
            <p className="font-display text-xl font-semibold tabular-nums text-ink">
              <span className="text-electric-300">{matchOver.xWins}</span>
              <span className="mx-2 text-muted">–</span>
              <span className="text-plasma-300">{matchOver.oWins}</span>
            </p>
            <p className="text-xs text-muted">Best of five · rounds won</p>
            <GameButton variant="primary" onClick={resetMatch}>
              <RotateCcw className="h-4 w-4" />
              Rematch
            </GameButton>
          </GameOverlay>
        ) : null}
      </div>
    </GameFrame>
  );
}
