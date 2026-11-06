import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Crown,
  HelpCircle,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Color, Square } from 'chess.js';
import type { GameComponentProps } from '../../types/game';
import { cn } from '../../lib/cn';
import { GameButton, GameFrame, GameOverlay, GameSegmented, GameStat, type SegmentOption } from '../shared/GameFrame';
import { ChessAi, AI_LEVELS, type AiLevel } from './ai';
import { createChessAudio, type ChessAudio } from './audio';
import { ChessBoard } from './board';
import {
  createClock,
  elapse,
  flaggedColor,
  formatClock,
  pauseClock,
  resumeClock,
  startTurn,
  type ChessClock,
} from './clock';
import { PieceGlyph, pieceLabel } from './pieces';
import {
  clearGame,
  loadGame,
  loadPuzzleProgress,
  loadRecords,
  recordResult,
  saveGame,
  savePuzzleProgress,
  type Records,
  type SavedGameV1,
} from './persistence';
import { PUZZLES, puzzleMoves, type Puzzle } from './puzzles';
import {
  RiftChess,
  START_FEN,
  type MoveView,
  type OutcomeView,
  type PositionView,
  type PromotionPiece,
} from './rules';

type Mode = 'ai' | 'local' | 'puzzles' | 'free';
type ClockOption = 'none' | '5' | '10' | '30';
type AiColorChoice = Color | 'random';
type ActionRequest = { kind: 'resign' | 'draw'; side: Color };
type EndState =
  | { kind: 'rules'; outcome: OutcomeView }
  | { kind: 'resign'; winner: Color }
  | { kind: 'flag'; winner: Color }
  | { kind: 'agreed-draw' };

interface PromotionRequest {
  from: Square;
  to: Square;
}

interface MoveOptions {
  fromAi?: boolean;
  timedOut?: boolean;
}

const MODE_OPTIONS: ReadonlyArray<SegmentOption<Mode>> = [
  { value: 'ai', label: 'Vs computer' },
  { value: 'local', label: '2 players' },
  { value: 'puzzles', label: 'Puzzles' },
  { value: 'free', label: 'Free board' },
];

const COLOR_OPTIONS: ReadonlyArray<SegmentOption<AiColorChoice>> = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
  { value: 'random', label: 'Random' },
];

const LEVEL_OPTIONS: ReadonlyArray<SegmentOption<AiLevel>> = AI_LEVELS.map((level) => ({
  value: level.value,
  label: level.label,
}));

const CLOCK_OPTIONS: ReadonlyArray<SegmentOption<ClockOption>> = [
  { value: 'none', label: 'No clock' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '30', label: '30 min' },
];

const PROMOTION_PIECES: ReadonlyArray<PromotionPiece> = ['q', 'r', 'b', 'n'];

function sideName(color: Color): string {
  return color === 'w' ? 'White' : 'Black';
}

function otherColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function describeOutcome(outcome: OutcomeView): { headline: string; detail: string } {
  switch (outcome.reason) {
    case 'checkmate':
      return {
        headline: 'Checkmate',
        detail: `${sideName(outcome.winner ?? 'w')} wins the game.`,
      };
    case 'stalemate':
      return {
        headline: 'Stalemate',
        detail: 'No legal moves and no check. The game is drawn.',
      };
    case 'insufficient-material':
      return {
        headline: 'Insufficient material',
        detail: 'Neither side can force a mate. The game is drawn.',
      };
    case 'fifty-move':
      return {
        headline: 'Fifty-move rule',
        detail: 'Fifty moves passed without a capture or pawn move. The game is drawn.',
      };
    case 'repetition':
      return {
        headline: 'Threefold repetition',
        detail: 'The same position appeared three times. The game is drawn.',
      };
  }
}

function describeEnd(end: EndState): { headline: string; detail: string } {
  switch (end.kind) {
    case 'rules':
      return describeOutcome(end.outcome);
    case 'resign':
      return {
        headline: 'Resignation',
        detail: `${sideName(end.winner)} wins by resignation.`,
      };
    case 'flag':
      return {
        headline: 'Time out',
        detail: `${sideName(end.winner)} wins on time.`,
      };
    case 'agreed-draw':
      return {
        headline: 'Draw agreed',
        detail: 'Both players agreed to a draw.',
      };
  }
}

function aiOutcomeOf(end: EndState, playerColor: Color): 'win' | 'loss' | 'draw' {
  if (end.kind === 'agreed-draw') return 'draw';
  if (end.kind === 'rules') {
    if (end.outcome.reason === 'checkmate') {
      return end.outcome.winner === playerColor ? 'win' : 'loss';
    }
    return 'draw';
  }
  return end.winner === playerColor ? 'win' : 'loss';
}

interface InitialState {
  save: SavedGameV1 | null;
  game: RiftChess;
}

function loadInitialState(): InitialState {
  const save = loadGame();
  const game = new RiftChess();
  if (save) {
    for (const san of save.moves) game.moveSan(san);
  }
  return { save, game };
}

export default function RiftChessGame({ onStart, onComplete }: GameComponentProps) {
  const [initial] = useState(loadInitialState);
  const positionRef = useRef<RiftChess>(initial.game);
  const [view, setView] = useState<PositionView>(() => initial.game.view());
  const [mode, setMode] = useState<Mode>('ai');
  const [level, setLevel] = useState<AiLevel>(initial.save?.level ?? 'casual');
  const [aiColor, setAiColor] = useState<AiColorChoice>(initial.save?.playerColor ?? 'w');
  const [playerColor, setPlayerColor] = useState<Color>(initial.save?.playerColor ?? 'w');
  const [clockOption, setClockOption] = useState<ClockOption>('none');
  const [clock, setClock] = useState<ChessClock | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const [end, setEnd] = useState<EndState | null>(null);
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [flipped, setFlipped] = useState(initial.save?.playerColor === 'b');
  const [resumed, setResumed] = useState(Boolean(initial.save));
  const [solvedIds, setSolvedIds] = useState<string[]>(() => loadPuzzleProgress().solved);
  const [records, setRecords] = useState<Records>(() => loadRecords());
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [puzzlePly, setPuzzlePly] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'playing' | 'solved'>('playing');
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  const [windowFocused, setWindowFocused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [announcement, setAnnouncement] = useState(() => {
    if (initial.save) {
      return `Saved game resumed. ${sideName(initial.save.playerColor ?? 'w') === 'White' ? 'White' : 'Black'} to move.`;
    }
    return 'White to move. You are White.';
  });

  const startedRef = useRef(Boolean(initial.save));
  const completedRef = useRef(false);
  const endRef = useRef<EndState | null>(null);
  const aiRef = useRef<ChessAi | null>(null);
  const audioRef = useRef<ChessAudio | null>(null);
  const clockHistoryRef = useRef<ChessClock[]>([]);
  const puzzleTimerRef = useRef<number | null>(null);
  const turnRef = useRef(view.turn);
  turnRef.current = view.turn;
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const applyMoveRef = useRef<(from: Square, to: Square, promotion?: PromotionPiece, options?: MoveOptions) => boolean>(
    () => false,
  );

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => {
    aiRef.current = new ChessAi();
    return () => {
      aiRef.current?.dispose();
      aiRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  function playCue(kind: 'move' | 'capture' | 'check' | 'end' | 'solved') {
    if (!audioRef.current) audioRef.current = createChessAudio();
    audioRef.current.setMuted(muted);
    audioRef.current.play(kind);
  }

  useEffect(
    () => () => {
      if (puzzleTimerRef.current !== null) window.clearTimeout(puzzleTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    const onBlur = () => setWindowFocused(false);
    const onFocus = () => setWindowFocused(true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pagehide', onBlur);
    window.addEventListener('pageshow', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pagehide', onBlur);
      window.removeEventListener('pageshow', onFocus);
    };
  }, []);

  const lastMove: MoveView | null = view.history.length > 0 ? view.history[view.history.length - 1] : null;
  const targets = selected ? positionRef.current.legalTargets(selected) : [];
  const puzzle = PUZZLES[puzzleIndex];
  const levelMeta = AI_LEVELS.find((entry) => entry.value === level) ?? AI_LEVELS[0];
  const record = records.byLevel[level];
  const hasClock = clock !== null;
  const clockPaused = Boolean(end || action || promotion) || hidden || !windowFocused;
  const sideLabel = sideName(view.turn);
  const puzzleBusy = mode === 'puzzles' && puzzlePly % 2 === 1;
  const boardDisabled =
    Boolean(promotion) ||
    Boolean(end) ||
    Boolean(action) ||
    puzzleStatus === 'solved' ||
    puzzleBusy ||
    (mode === 'ai' && (view.turn !== playerColor || aiThinking));

  function resetBoard(fen: string = START_FEN) {
    const position = new RiftChess(fen);
    positionRef.current = position;
    aiRef.current?.cancelPending();
    if (puzzleTimerRef.current !== null) {
      window.clearTimeout(puzzleTimerRef.current);
      puzzleTimerRef.current = null;
    }
    setView(position.view());
    setSelected(null);
    setPromotion(null);
    setEnd(null);
    setAction(null);
    setAiThinking(false);
    setPuzzlePly(0);
    setPuzzleStatus('playing');
    setResumed(false);
    endRef.current = null;
    clockHistoryRef.current = [];
    startedRef.current = false;
    completedRef.current = false;
  }

  function beginAiGame(colorChoice: AiColorChoice, nextLevel: AiLevel) {
    const actual = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice;
    resetBoard();
    clearGame();
    setPlayerColor(actual);
    setLevel(nextLevel);
    setFlipped(actual === 'b');
    setClock(null);
    setAnnouncement(
      actual === 'w'
        ? 'New game. You are White. White to move.'
        : 'New game. You are Black. The computer moves first.',
    );
  }

  function beginLocalGame(option: ClockOption) {
    resetBoard();
    setFlipped(false);
    setClock(
      option === 'none' ? null : startTurn(createClock(Number(option)), 'w', performance.now()),
    );
    setAnnouncement('New local game. White to move.');
  }

  function beginFreeGame() {
    resetBoard();
    setFlipped(false);
    setClock(null);
    setAnnouncement('Free board. Both sides can move. White to move.');
  }

  function loadPuzzle(index: number) {
    const next = PUZZLES[index];
    resetBoard(next.fen);
    setFlipped(false);
    setClock(null);
    setPuzzleIndex(index);
    setAnnouncement(
      `${next.title}. You play White. Find mate in ${next.mateIn === 1 ? 'one' : 'two'}.`,
    );
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    if (next === 'ai') {
      setMode('ai');
      beginAiGame(aiColor, level);
      return;
    }
    if (next === 'local') {
      setMode('local');
      beginLocalGame(clockOption);
      return;
    }
    if (next === 'puzzles') {
      const firstUnsolved = PUZZLES.findIndex((entry) => !solvedIds.includes(entry.id));
      setMode('puzzles');
      loadPuzzle(firstUnsolved === -1 ? 0 : firstUnsolved);
      return;
    }
    setMode('free');
    beginFreeGame();
  }

  function changeAiColor(next: AiColorChoice) {
    if (next === aiColor) return;
    setAiColor(next);
    beginAiGame(next, level);
  }

  function changeLevel(next: AiLevel) {
    if (next === level) return;
    setLevel(next);
    beginAiGame(aiColor, next);
  }

  function changeClockOption(next: ClockOption) {
    if (next === clockOption) return;
    setClockOption(next);
    beginLocalGame(next);
  }

  function finish(next: EndState) {
    if (endRef.current) return;
    endRef.current = next;
    setEnd(next);
    setSelected(null);
    setPromotion(null);
    setAction(null);
    setAiThinking(false);
    aiRef.current?.cancelPending();
    clearGame();

    const info = describeEnd(next);
    setAnnouncement(`${info.headline}. ${info.detail}`);
    playCue('end');

    if (!completedRef.current) {
      completedRef.current = true;
      if (mode === 'ai') {
        const outcome = aiOutcomeOf(next, playerColor);
        setRecords(recordResult(level, outcome));
        onCompleteRef.current?.({ outcome });
      } else if (next.kind === 'rules') {
        onCompleteRef.current?.({ outcome: 'complete' });
      }
    }
  }

  function selectSquare(square: Square) {
    const piece = positionRef.current.pieceAt(square);
    const legal = positionRef.current.legalTargets(square);
    setSelected(square);
    setAnnouncement(
      `${piece ? pieceLabel(piece.color, piece.type) : 'Piece'} on ${square}. ${legal.length} legal ${
        legal.length === 1 ? 'move' : 'moves'
      }.`,
    );
  }

  function applyMove(
    from: Square,
    to: Square,
    promotionPiece?: PromotionPiece,
    options?: MoveOptions,
  ): boolean {
    const position = positionRef.current;
    const move = position.move(from, to, promotionPiece);
    if (!move) return false;

    const now = performance.now();
    if (mode === 'local' && clock) clockHistoryRef.current.push(clock);

    const next = position.view();
    setView(next);
    setSelected(null);
    setPromotion(null);

    if (mode === 'local' && clock) {
      setClock((previous) =>
        previous ? startTurn(elapse(previous, now), next.turn, now) : previous,
      );
    }

    if (!startedRef.current) {
      startedRef.current = true;
      onStartRef.current?.();
    }

    if (next.outcome && mode !== 'puzzles') {
      finish({ kind: 'rules', outcome: next.outcome });
      return true;
    }

    if (!next.outcome) {
      playCue(next.inCheck ? 'check' : move.captured ? 'capture' : 'move');
    }

    const prefix = options?.fromAi ? 'Computer plays ' : '';
    const suffix = next.outcome
      ? 'Checkmate.'
      : next.inCheck
        ? `${sideName(next.turn)} is in check.`
        : `${sideName(next.turn)} to move.`;
    const timeoutNote = options?.timedOut ? ' The engine timed out and played a legal fallback.' : '';
    setAnnouncement(`${prefix}${move.san}. ${suffix}${timeoutNote}`);
    return true;
  }

  applyMoveRef.current = applyMove;

  function finishPuzzle(solved: Puzzle) {
    setPuzzleStatus('solved');
    setSelected(null);
    if (!solvedIds.includes(solved.id)) {
      const nextSolved = [...solvedIds, solved.id];
      setSolvedIds(nextSolved);
      savePuzzleProgress({ version: 1, solved: nextSolved });
    }
    setAnnouncement(`Puzzle solved: ${solved.title}.`);
    playCue('solved');
    if (!completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.({ outcome: 'complete' });
    }
  }

  function takePuzzleMove(from: Square, to: Square): boolean {
    const line = puzzleMoves(puzzle);
    const expected = line[puzzlePly];
    if (!expected || from !== expected.from || to !== expected.to) return false;
    if (!applyMove(from, to, expected.promotion)) return false;

    const nextPly = puzzlePly + 1;
    setPuzzlePly(nextPly);
    if (nextPly >= line.length) {
      finishPuzzle(puzzle);
    } else {
      setAnnouncement('Correct. Waiting for Black to reply.');
      const reply = line[nextPly];
      puzzleTimerRef.current = window.setTimeout(() => {
        puzzleTimerRef.current = null;
        applyMoveRef.current(reply.from, reply.to, reply.promotion);
        setPuzzlePly(nextPly + 1);
        setAnnouncement('Find the final mate.');
      }, 520);
    }
    return true;
  }

  function handleSquare(square: Square) {
    if (promotion || end || action || puzzleStatus === 'solved') return;

    if (mode === 'ai' && (view.turn !== playerColor || aiThinking)) {
      setAnnouncement('Wait for the computer.');
      return;
    }
    if (puzzleBusy) {
      setAnnouncement('Wait for Black to reply.');
      return;
    }

    const position = positionRef.current;
    const piece = position.pieceAt(square);

    if (mode === 'puzzles') {
      const line = puzzleMoves(puzzle);
      const expected = line[puzzlePly];
      if (!expected) return;

      if (selected) {
        if (!takePuzzleMove(selected, square)) {
          setSelected(null);
          setAnnouncement('That is not the mating move. Try again.');
        }
        return;
      }

      if (piece && piece.color === 'w') {
        selectSquare(square);
        return;
      }
      setAnnouncement('You play White in puzzles. Select a white piece.');
      return;
    }

    if (selected) {
      const target = position.legalTargets(selected).find((candidate) => candidate.to === square);
      if (target) {
        if (target.promotion) {
          setPromotion({ from: selected, to: square });
          setAnnouncement(`Choose a piece to promote the pawn on ${square}.`);
          return;
        }
        applyMove(selected, square);
        return;
      }
      if (piece && piece.color === view.turn) {
        selectSquare(square);
        return;
      }
      setAnnouncement('That move is not legal. The piece stays selected.');
      return;
    }

    if (piece && piece.color === view.turn) {
      selectSquare(square);
      return;
    }
    setAnnouncement(`Select a ${view.turn === 'w' ? 'white' : 'black'} piece first.`);
  }

  function handleDragMove(from: Square, to: Square) {
    if (promotion || end || action || puzzleStatus === 'solved') return;
    if (mode === 'ai' && (view.turn !== playerColor || aiThinking)) {
      setAnnouncement('Wait for the computer.');
      return;
    }
    if (puzzleBusy) {
      setAnnouncement('Wait for Black to reply.');
      return;
    }

    const position = positionRef.current;
    const piece = position.pieceAt(from);
    if (!piece) return;

    const canMove = mode === 'puzzles' ? piece.color === 'w' : piece.color === view.turn;
    if (!canMove) {
      setAnnouncement(
        mode === 'puzzles'
          ? 'You play White in puzzles. Select a white piece.'
          : `Select a ${view.turn === 'w' ? 'white' : 'black'} piece first.`,
      );
      return;
    }

    setSelected(from);

    if (mode === 'puzzles') {
      if (!takePuzzleMove(from, to)) {
        setSelected(null);
        setAnnouncement('That is not the mating move. Try again.');
      }
      return;
    }

    const target = position.legalTargets(from).find((candidate) => candidate.to === to);
    if (!target) {
      setAnnouncement('That move is not legal. The piece stays selected.');
      return;
    }
    if (target.promotion) {
      setPromotion({ from, to });
      setAnnouncement(`Choose a piece to promote the pawn on ${to}.`);
      return;
    }
    applyMove(from, to);
  }

  function clearSelection() {
    if (!selected) return;
    setSelected(null);
    setAnnouncement(`${sideLabel} to move.`);
  }

  function undoMove() {
    if (end || mode === 'puzzles') return;
    const position = positionRef.current;
    if (position.history().length === 0) return;

    aiRef.current?.cancelPending();
    setAiThinking(false);

    let plies = 1;
    if (mode === 'ai') plies = view.turn === playerColor ? 2 : 1;
    plies = Math.min(plies, position.history().length);

    position.undo(plies);
    const next = position.view();
    setView(next);
    setSelected(null);
    setPromotion(null);

    if (mode === 'local' && clockHistoryRef.current.length > 0) {
      const snapshot = clockHistoryRef.current.pop() ?? null;
      setClock(snapshot ? resumeClock(snapshot, next.turn, performance.now()) : null);
    }

    setAnnouncement(
      `${plies > 1 ? `${plies} moves` : 'Move'} undone. ${sideName(next.turn)} to move.`,
    );
  }

  function restartGame() {
    if (mode === 'ai') {
      beginAiGame(aiColor, level);
      return;
    }
    if (mode === 'local') {
      beginLocalGame(clockOption);
      return;
    }
    if (mode === 'puzzles') {
      loadPuzzle(puzzleIndex);
      return;
    }
    beginFreeGame();
  }

  function askResign() {
    if (end || mode === 'puzzles' || mode === 'free') return;
    setAction({ kind: 'resign', side: mode === 'ai' ? playerColor : view.turn });
  }

  function askDraw() {
    if (end || mode !== 'local') return;
    setAction({ kind: 'draw', side: view.turn });
  }

  function confirmAction() {
    if (!action) return;
    if (action.kind === 'resign') {
      finish({ kind: 'resign', winner: otherColor(action.side) });
    } else {
      finish({ kind: 'agreed-draw' });
    }
  }

  useEffect(() => {
    if (mode !== 'ai' || end) return;
    if (view.history.length === 0) {
      clearGame();
      return;
    }
    saveGame({
      version: 1,
      mode: 'ai',
      fen: view.fen,
      moves: view.history.map((move) => move.san),
      playerColor,
      level,
      clocks: null,
      baseMinutes: null,
      savedAt: Date.now(),
    });
  }, [mode, end, view.fen, view.history, playerColor, level]);

  useEffect(() => {
    if (mode !== 'ai' || end || action || promotion) return;
    if (view.turn === playerColor) return;
    const ai = aiRef.current;
    if (!ai) return;

    let cancelled = false;
    setAiThinking(true);
    setAnnouncement('Computer thinking…');
    void ai.think(view.fen, level).then((result) => {
      if (cancelled) return;
      setAiThinking(false);
      if (result.cancelled) return;
      if (!result.move) {
        setAnnouncement('The computer had no legal move.');
        return;
      }
      applyMoveRef.current(result.move.from, result.move.to, result.move.promotion, {
        fromAi: true,
        timedOut: result.timedOut,
      });
    });

    return () => {
      cancelled = true;
      ai.cancelPending();
    };
  }, [mode, end, action, promotion, view.fen, view.turn, playerColor, level]);

  useEffect(() => {
    if (!hasClock) return;
    setClock((previous) => {
      if (!previous) return previous;
      if (clockPaused) return pauseClock(previous, performance.now());
      return resumeClock(previous, turnRef.current, performance.now());
    });
  }, [hasClock, clockPaused]);

  useEffect(() => {
    if (!hasClock || clockPaused || end) return;
    const timer = window.setInterval(() => {
      setClock((previous) => (previous ? elapse(previous, performance.now()) : previous));
    }, 200);
    return () => window.clearInterval(timer);
  }, [hasClock, clockPaused, end]);

  useEffect(() => {
    if (!clock || end) return;
    const flagged = flaggedColor(clock);
    if (!flagged) return;
    finish({ kind: 'flag', winner: otherColor(flagged) });
  }, [clock, end]);

  const endInfo = end ? describeEnd(end) : null;
  const endTone: 'default' | 'win' | 'loss' =
    end && mode === 'ai'
      ? aiOutcomeOf(end, playerColor) === 'win'
        ? 'win'
        : aiOutcomeOf(end, playerColor) === 'loss'
          ? 'loss'
          : 'default'
      : 'default';

  const moveRows: Array<{ number: number; white?: MoveView; black?: MoveView }> = [];
  for (let index = 0; index < view.history.length; index += 2) {
    moveRows.push({
      number: index / 2 + 1,
      white: view.history[index],
      black: view.history[index + 1],
    });
  }

  return (
    <GameFrame
      title="Rift Chess"
      subtitle="Real rules, five levels and forty original puzzles."
      icon={Crown}
      accent="plasma"
      hud={
        mode === 'puzzles' ? (
          <div className="grid grid-cols-3 gap-2">
            <GameStat label="Puzzle" value={`${puzzleIndex + 1} / ${PUZZLES.length}`} />
            <GameStat label="Solved" value={`${solvedIds.length} / ${PUZZLES.length}`} tone="mint" />
            <GameStat label="Goal" value={`Mate in ${puzzle.mateIn}`} tone="plasma" />
          </div>
        ) : hasClock && clock ? (
          <div className="grid grid-cols-3 gap-2">
            <GameStat
              label="White clock"
              value={formatClock(clock.whiteMs)}
              tone="electric"
              className={clock.active === 'w' ? 'ring-1 ring-electric-500/40' : ''}
            />
            <GameStat
              label="Turn"
              value={end ? 'Game over' : sideLabel}
              tone={view.turn === 'w' ? 'electric' : 'plasma'}
            />
            <GameStat
              label="Black clock"
              value={formatClock(clock.blackMs)}
              tone="plasma"
              className={clock.active === 'b' ? 'ring-1 ring-plasma-500/40' : ''}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <GameStat
              label="Turn"
              value={end ? 'Game over' : sideLabel}
              tone={view.turn === 'w' ? 'electric' : 'plasma'}
            />
            <GameStat label="Full moves" value={Math.ceil(view.history.length / 2)} />
            <GameStat
              label="State"
              value={end ? 'Finished' : aiThinking ? 'Thinking' : view.inCheck ? 'Check' : 'Live'}
              tone={view.inCheck ? 'coral' : aiThinking ? 'plasma' : 'mint'}
            />
          </div>
        )
      }
      toolbar={
        <>
          <GameButton
            size="sm"
            variant="secondary"
            onClick={undoMove}
            disabled={view.history.length === 0 || Boolean(end) || mode === 'puzzles'}
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Undo
          </GameButton>
          <GameButton
            size="icon"
            variant="ghost"
            onClick={() => setFlipped((value) => !value)}
            aria-label="Flip board"
            title="Flip board"
          >
            <ArrowDownUp className="h-4 w-4" />
          </GameButton>
          <GameButton
            size="icon"
            variant="ghost"
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Enable sound' : 'Mute sound'}
            aria-pressed={muted}
            title={muted ? 'Enable sound' : 'Mute sound'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </GameButton>
          <GameButton
            size="sm"
            variant="danger"
            onClick={askResign}
            disabled={Boolean(end) || mode === 'puzzles' || mode === 'free'}
          >
            Resign
          </GameButton>
          {mode === 'local' ? (
            <GameButton size="sm" variant="secondary" onClick={askDraw} disabled={Boolean(end)}>
              Offer draw
            </GameButton>
          ) : null}
          <GameButton
            size="icon"
            variant="ghost"
            onClick={restartGame}
            aria-label="Restart game"
            title="Restart game"
          >
            <RotateCcw className="h-4 w-4" />
          </GameButton>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Tap or click a piece, then a highlighted square.</span>
          <span>Arrow keys move focus; Enter or Space selects.</span>
          {mode === 'puzzles' ? (
            <span>Each puzzle is an original composition made for NeonRift.</span>
          ) : mode === 'ai' ? (
            <span>Strength labels are internal levels, not Elo ratings. Records stay in this browser.</span>
          ) : mode === 'local' ? (
            <span>Clocks pause when this tab is hidden or a dialog is open.</span>
          ) : (
            <span>Free board: no clock and no saved result.</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <HelpCircle className="h-3 w-3 text-plasma-300" aria-hidden="true" />
            Castling, en passant and promotion follow standard chess.
          </span>
          <span>Sound cues are generated in this browser; the speaker button mutes them.</span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <GameSegmented label="Game mode" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
        {mode === 'ai' ? (
          <>
            <GameSegmented label="Play as" options={COLOR_OPTIONS} value={aiColor} onChange={changeAiColor} />
            <GameSegmented
              label="Computer level"
              options={LEVEL_OPTIONS}
              value={level}
              onChange={changeLevel}
            />
          </>
        ) : null}
        {mode === 'local' ? (
          <GameSegmented
            label="Local clock"
            options={CLOCK_OPTIONS}
            value={clockOption}
            onChange={changeClockOption}
          />
        ) : null}
      </div>

      {mode === 'ai' ? (
        <p className="text-[11px] leading-relaxed text-muted">
          {levelMeta.detail}. Browser-local record at this level: {record.win}W · {record.loss}L ·{' '}
          {record.draw}D.
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="min-h-5 text-xs text-muted">
        {announcement}
      </p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[560px]">
          <ChessBoard
            pieces={view.pieces}
            turn={view.turn}
            selected={selected}
            targets={targets}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
            checkedKing={view.checkedKing}
            flipped={flipped}
            disabled={boardDisabled}
            onSquareActivate={handleSquare}
            onDragMove={handleDragMove}
            onEscape={clearSelection}
          />

          {promotion ? (
            <GameOverlay label="Choose a promotion piece">
              <p className="text-sm font-medium text-ink">Promote to</p>
              <div role="group" aria-label="Promotion pieces" className="flex items-center gap-2">
                {PROMOTION_PIECES.map((piece) => (
                  <button
                    key={piece}
                    type="button"
                    autoFocus={piece === 'q'}
                    onClick={() => applyMove(promotion.from, promotion.to, piece)}
                    aria-label={`Promote to ${pieceLabel(view.turn, piece)}`}
                    className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-night-850/90 p-1.5 transition hover:border-electric-400/60 hover:bg-night-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-electric-300 [@media(pointer:coarse)]:h-16 [@media(pointer:coarse)]:w-16"
                  >
                    <PieceGlyph type={piece} color={view.turn} />
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted">Queen, rook, bishop or knight.</p>
            </GameOverlay>
          ) : null}

          {action ? (
            <GameOverlay
              label={action.kind === 'resign' ? 'Confirm resignation' : 'Confirm draw offer'}
            >
              <p className="font-display text-xl font-semibold text-ink">
                {action.kind === 'resign'
                  ? `${sideName(action.side)} resigns?`
                  : `${sideName(action.side)} offers a draw.`}
              </p>
              <p className="max-w-xs text-xs text-muted">
                {action.kind === 'resign'
                  ? `${sideName(otherColor(action.side))} wins if you confirm.`
                  : `Does ${sideName(otherColor(action.side))} accept?`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <GameButton
                  variant={action.kind === 'resign' ? 'danger' : 'primary'}
                  onClick={confirmAction}
                >
                  {action.kind === 'resign' ? 'Resign' : 'Accept draw'}
                </GameButton>
                <GameButton variant="secondary" onClick={() => setAction(null)}>
                  Keep playing
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}

          {endInfo ? (
            <GameOverlay tone={endTone} label="Game over">
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                Game over
              </span>
              <p className="font-display text-2xl font-semibold text-ink">{endInfo.headline}</p>
              <p className="max-w-xs text-xs text-muted">{endInfo.detail}</p>
              <GameButton variant="primary" onClick={restartGame}>
                <RotateCcw className="h-4 w-4" />
                New game
              </GameButton>
            </GameOverlay>
          ) : null}

          {mode === 'puzzles' && puzzleStatus === 'solved' ? (
            <GameOverlay tone="win" label="Puzzle solved">
              <Trophy className="h-7 w-7 text-mint" aria-hidden="true" />
              <p className="font-display text-2xl font-semibold text-ink">Puzzle solved</p>
              <p className="text-xs text-muted">{puzzle.title}</p>
              <p className="text-[11px] text-muted">
                {solvedIds.length} of {PUZZLES.length} solved in this browser.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <GameButton
                  variant="primary"
                  onClick={() => loadPuzzle((puzzleIndex + 1) % PUZZLES.length)}
                >
                  Next puzzle
                </GameButton>
                <GameButton variant="secondary" onClick={() => loadPuzzle(puzzleIndex)}>
                  Replay
                </GameButton>
              </div>
            </GameOverlay>
          ) : null}
        </div>

        <section
          aria-labelledby="rift-chess-moves-heading"
          className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-night-850/60 p-3"
        >
          {mode === 'puzzles' ? (
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="rift-chess-moves-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Puzzle {puzzleIndex + 1} of {PUZZLES.length}
                </h3>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
                  {puzzle.difficulty}
                </span>
              </div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                {puzzle.title}
                {puzzleStatus === 'solved' ? (
                  <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">
                    Solved
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted">
                You play White. {puzzle.mateIn === 1 ? 'Mate in one.' : 'Mate in two.'}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <GameButton
                  size="icon"
                  variant="ghost"
                  aria-label="Previous puzzle"
                  title="Previous puzzle"
                  onClick={() => loadPuzzle((puzzleIndex + PUZZLES.length - 1) % PUZZLES.length)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </GameButton>
                <GameButton
                  size="icon"
                  variant="ghost"
                  aria-label="Next puzzle"
                  title="Next puzzle"
                  onClick={() => loadPuzzle((puzzleIndex + 1) % PUZZLES.length)}
                >
                  <ChevronRight className="h-4 w-4" />
                </GameButton>
                <GameButton size="sm" variant="secondary" onClick={() => loadPuzzle(puzzleIndex)}>
                  Reset puzzle
                </GameButton>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-electric-500 to-mint transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${(solvedIds.length / PUZZLES.length) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-muted">
                {solvedIds.length} of {PUZZLES.length} solved. Progress stays in this browser.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <h3 id="rift-chess-moves-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Moves
                </h3>
                <span className="text-[10px] text-muted">{view.history.length} plies</span>
              </div>

              {resumed ? (
                <p className="mt-2 rounded-lg border border-mint/20 bg-mint/10 px-2 py-1 text-[10px] font-medium text-mint">
                  Saved game restored
                </p>
              ) : null}

              {moveRows.length === 0 ? (
                <p className="mt-3 text-xs text-muted">No moves yet. White opens.</p>
              ) : (
                <ol className="mt-2 max-h-[280px] space-y-1 overflow-y-auto pr-1 text-xs sm:max-h-[360px]">
                  {moveRows.map((row) => (
                    <li
                      key={row.number}
                      className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 rounded-lg px-1.5 py-1 odd:bg-white/[0.03]"
                    >
                      <span className="text-[10px] tabular-nums text-muted">{row.number}.</span>
                      <span className={cn('font-medium text-ink', row.white ? '' : 'text-muted')}>
                        {row.white?.san ?? '—'}
                      </span>
                      <span className={cn('font-medium text-ink', row.black ? '' : 'text-muted')}>
                        {row.black?.san ?? '—'}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-auto pt-3 text-[10px] leading-relaxed text-muted">
                Progress stays in this browser. No account, rating or online opponent.
              </div>
            </>
          )}
        </section>
      </div>
    </GameFrame>
  );
}
