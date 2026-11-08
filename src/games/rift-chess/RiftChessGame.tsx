import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowLeft, FlipHorizontal, RotateCcw, Undo2 } from 'lucide-react';
import { DEFAULT_POSITION, type Chess } from 'chess.js';
import { advanceClock, completeClockMove, createClock, pauseClock, resumeClock, startClock, type ChessClockState } from './clock';
import { clearSavedGame, loadGame, saveGame, type SavedGameOptions } from './persistence';
import type { GameComponentProps } from '../../types/game';
import {
  GameButton,
  GameFrame,
  GameSegmented,
  GameStat,
  type SegmentOption,
} from '../shared/GameFrame';
import { ChessBoard } from './board';
import { AI_LEVEL_LABELS, type AiLevel, type AiWorkerRequest, type AiWorkerResponse } from './ai';
import {
  createGame,
  getBoardPieces,
  getLegalMoves,
  getPositionStatus,
  makeMove,
  undoMove,
  type BoardPiece,
  type ChessMoveInput,
  type EndReason,
  type PromotionPiece,
} from './rules';

type Mode = 'local' | 'free' | 'computer';
type ClockPreset = 'off' | '5+0' | '10+0' | '10+5';

interface PromotionChoice {
  from: ChessMoveInput['from'];
  to: ChessMoveInput['to'];
}

interface RiftChessGameProps extends GameComponentProps {
  /** Optional position fixture, also useful for loading an analysis position. */
  initialFen?: string;
}

const MODE_OPTIONS: ReadonlyArray<SegmentOption<Mode>> = [
  { value: 'local', label: 'Local two-player' },
  { value: 'computer', label: 'vs Computer' },
  { value: 'free', label: 'Free board' },
];

type AiLevelOption = '1' | '2' | '3' | '4' | '5';

const AI_LEVEL_OPTIONS: ReadonlyArray<SegmentOption<AiLevelOption>> = [
  { value: '1', label: 'Novice' },
  { value: '2', label: 'Casual' },
  { value: '3', label: 'Club' },
  { value: '4', label: 'Expert' },
  { value: '5', label: 'Master' },
];

const CLOCK_OPTIONS: ReadonlyArray<SegmentOption<ClockPreset>> = [
  { value: 'off', label: 'No clock' },
  { value: '5+0', label: '5 min' },
  { value: '10+0', label: '10 min' },
  { value: '10+5', label: '10 + 5' },
];

function createPresetClock(preset: ClockPreset, firstSide: 'w' | 'b'): ChessClockState | null {
  if (preset === 'off') return null;
  const [minutes, incrementSeconds] = preset.split('+').map(Number);
  return startClock(createClock(minutes! * 60_000, incrementSeconds! * 1_000, firstSide), performance.now());
}

function formatClock(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function getBrowserStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

const PLAYER_COLOR_OPTIONS: ReadonlyArray<SegmentOption<'w' | 'b'>> = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
];

const PROMOTION_OPTIONS: ReadonlyArray<{ value: PromotionPiece; label: string; whiteGlyph: string; blackGlyph: string }> = [
  { value: 'q', label: 'Queen', whiteGlyph: '♕', blackGlyph: '♛' },
  { value: 'r', label: 'Rook', whiteGlyph: '♖', blackGlyph: '♜' },
  { value: 'b', label: 'Bishop', whiteGlyph: '♗', blackGlyph: '♝' },
  { value: 'n', label: 'Knight', whiteGlyph: '♘', blackGlyph: '♞' },
];

const DRAW_LABELS: Record<EndReason, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Draw by stalemate',
  'insufficient-material': 'Draw by insufficient material',
  'fifty-move': 'Draw by the fifty-move rule',
  'threefold-repetition': 'Draw by threefold repetition',
  draw: 'Draw',
};

function sideName(color: 'w' | 'b'): string {
  return color === 'w' ? 'White' : 'Black';
}

export default function RiftChessGame({
  onStart,
  onComplete,
  initialFen,
}: RiftChessGameProps) {
  const gameRef = useRef<Chess>(createGame(initialFen));
  const [mode, setMode] = useState<Mode>('local');
  const [aiLevel, setAiLevel] = useState<AiLevel>(2);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [clockPreset, setClockPreset] = useState<ClockPreset>('off');
  const [clock, setClock] = useState<ChessClockState | null>(null);
  const clockRef = useRef<ChessClockState | null>(null);
  const clockHistoryRef = useRef<ChessClockState[]>([]);
  const [savedAvailable, setSavedAvailable] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [positionVersion, setPositionVersion] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const aiRequestIdRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<'w' | 'b'>('w');
  const [pieces, setPieces] = useState<BoardPiece[]>(() => getBoardPieces(gameRef.current));
  const [turn, setTurn] = useState<'w' | 'b'>(() => gameRef.current.turn());
  const [selectedSquare, setSelectedSquare] = useState<ChessMoveInput['from'] | null>(null);
  const [legalTargets, setLegalTargets] = useState<ChessMoveInput['to'][]>([]);
  const [lastMove, setLastMove] = useState<{ from: ChessMoveInput['from']; to: ChessMoveInput['to'] } | null>(null);
  const [promotion, setPromotion] = useState<PromotionChoice | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [positionStatus, setPositionStatus] = useState(() => getPositionStatus(gameRef.current));
  const [announcement, setAnnouncement] = useState('White to move');
  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const onStartRef = useRef(onStart);
  const onCompleteRef = useRef(onComplete);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const promotionFirstButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocusSquareRef = useRef<ChessMoveInput['from'] | null>(null);

  useEffect(() => {
    const storage = getBrowserStorage();
    setSavedAvailable(storage ? loadGame(storage) !== null : false);
  }, []);

  useEffect(() => {
    onStartRef.current = onStart;
    onCompleteRef.current = onComplete;
  }, [onStart, onComplete]);

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    if (promotion) {
      promotionFirstButtonRef.current?.focus();
      return;
    }

    const squareToFocus = pendingFocusSquareRef.current;
    if (!squareToFocus) return;
    pendingFocusSquareRef.current = null;
    boardContainerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-square="${squareToFocus}"]`)
      ?.focus();
  }, [promotion]);

  const statusText = useMemo(() => {
    if (clock?.flagged) return `${sideName(clock.flagged)} ran out of time · ${sideName(clock.flagged === 'w' ? 'b' : 'w')} wins`;
    if (positionStatus.reason === 'checkmate') {
      return `${sideName(positionStatus.turn === 'w' ? 'b' : 'w')} wins by checkmate`;
    }
    if (positionStatus.reason) return DRAW_LABELS[positionStatus.reason];
    if (positionStatus.inCheck) return `${sideName(positionStatus.turn)} is in check`;
    return `${sideName(positionStatus.turn)} to move`;
  }, [positionStatus, clock?.flagged]);

  function updateClock(next: ChessClockState | null) {
    clockRef.current = next;
    setClock(next);
  }

  function recordFlag(flagged: 'w' | 'b') {
    setAnnouncement(`${sideName(flagged)} ran out of time. ${sideName(flagged === 'w' ? 'b' : 'w')} wins.`);
    const storage = getBrowserStorage();
    if (storage) clearSavedGame(storage);
    setSavedAvailable(false);
    if (mode !== 'free' && !finishedRef.current) {
      finishedRef.current = true;
      onCompleteRef.current?.({ outcome: mode === 'computer' ? (flagged === playerColor ? 'loss' : 'win') : 'complete' });
    }
  }

  function persistCurrentGame() {
    if (mode === 'free') return;
    const storage = getBrowserStorage();
    if (!storage) return;
    const now = performance.now();
    const pausedClock = clockRef.current ? pauseClock(clockRef.current, now) : null;
    const options: SavedGameOptions = {
      mode, playerColor, aiLevel, orientation, clockPreset,
      startFen: initialFen ?? DEFAULT_POSITION,
      clock: pausedClock,
      clockHistory: clockHistoryRef.current,
    };
    setSavedAvailable(saveGame(storage, gameRef.current, options));
  }

  function clearSelection() {
    setSelectedSquare(null);
    setLegalTargets([]);
  }

  function refreshPosition() {
    const game = gameRef.current;
    const nextStatus = getPositionStatus(game);
    setPieces(getBoardPieces(game));
    setTurn(game.turn());
    setMoveHistory(game.history());
    setPositionStatus(nextStatus);
    setPositionVersion((value) => value + 1);

    if (nextStatus.isGameOver) {
      if (clockRef.current) updateClock(pauseClock(clockRef.current, performance.now()));
      const storage = getBrowserStorage();
      if (storage) clearSavedGame(storage);
      setSavedAvailable(false);
    } else if (mode !== 'free') {
      persistCurrentGame();
    }

    if (nextStatus.reason === 'checkmate') {
      setAnnouncement(statusTextForCheckmate(nextStatus.turn));
    } else if (nextStatus.reason) {
      setAnnouncement(DRAW_LABELS[nextStatus.reason]);
    } else if (nextStatus.inCheck) {
      setAnnouncement(`${sideName(nextStatus.turn)} is in check`);
    } else {
      setAnnouncement(`${sideName(nextStatus.turn)} to move`);
    }

    if (nextStatus.isGameOver && mode !== 'free' && !finishedRef.current) {
      finishedRef.current = true;
      const outcome = nextStatus.reason === 'checkmate'
        ? mode === 'computer'
          ? (nextStatus.turn === playerColor ? 'loss' : 'win')
          : 'complete'
        : 'draw';
      onCompleteRef.current?.({ outcome });
    }
  }

  function statusTextForCheckmate(sideToMove: 'w' | 'b'): string {
    return `${sideName(sideToMove === 'w' ? 'b' : 'w')} wins by checkmate`;
  }

  function applyMove(input: ChessMoveInput) {
    const now = performance.now();
    const beforeClock = clockRef.current;
    if (beforeClock?.running) {
      const elapsed = advanceClock(beforeClock, now);
      if (elapsed.flagged) {
        updateClock(elapsed);
        recordFlag(elapsed.flagged);
        return;
      }
    }
    if (beforeClock?.flagged) return;
    const move = makeMove(gameRef.current, input);
    if (!move) {
      setAnnouncement('That move is not legal');
      return;
    }

    if (!startedRef.current) {
      startedRef.current = true;
      onStartRef.current?.();
    }

    if (beforeClock) {
      clockHistoryRef.current.push(pauseClock(beforeClock, now));
      const nextClock = completeClockMove(beforeClock, gameRef.current.turn(), now);
      updateClock(nextClock);
      if (nextClock.flagged) recordFlag(nextClock.flagged);
    }
    setLastMove({ from: move.from, to: move.to });
    clearSelection();
    setPromotion(null);
    refreshPosition();
  }

  useEffect(() => {
    if (!clock?.running) return;
    const timer = window.setInterval(() => {
      const current = clockRef.current;
      if (!current) return;
      const next = advanceClock(current, performance.now());
      if (next !== current) updateClock(next);
      if (next.flagged) recordFlag(next.flagged);
    }, 100);
    return () => window.clearInterval(timer);
  }, [clock?.running]);

  useEffect(() => {
    const pause = () => {
      const current = clockRef.current;
      if (current) updateClock(pauseClock(current, performance.now()));
    };
    const resume = () => {
      const current = clockRef.current;
      if (current && !document.hidden) updateClock(resumeClock(current, performance.now()));
    };
    const visibility = () => document.hidden ? pause() : resume();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
    };
  }, []);

  useEffect(() => {
    if (!ready || mode !== 'computer' || positionStatus.isGameOver || turn === playerColor || clock?.flagged) return;

    const fen = gameRef.current.fen();
    const requestId = ++aiRequestIdRef.current;
    const worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    setThinking(true);

    const playFallback = (message: string) => {
      if (gameRef.current.fen() !== fen) return;
      const fallback = getLegalMoves(gameRef.current)[0];
      setThinking(false);
      setAnnouncement(message);
      if (fallback) {
        applyMove({
          from: fallback.from,
          to: fallback.to,
          ...(fallback.promotion ? { promotion: fallback.promotion as PromotionPiece } : {}),
        });
      }
    };

    const timeoutId = window.setTimeout(() => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      playFallback('Computer search timed out; a legal fallback move was played.');
    }, 10_000);

    worker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestId || response.fen !== fen) return;
      window.clearTimeout(timeoutId);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (gameRef.current.fen() !== fen) return;
      setThinking(false);
      if (response.move) applyMove(response.move);
      else playFallback(response.error ?? 'Computer search returned no move; a legal fallback was played.');
    };

    worker.onerror = () => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      playFallback('Computer engine unavailable; a legal fallback move was played.');
    };

    const request: AiWorkerRequest = { requestId, fen, level: aiLevel };
    worker.postMessage(request);

    return () => {
      window.clearTimeout(timeoutId);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [ready, mode, turn, positionVersion, playerColor, aiLevel, positionStatus.isGameOver, clock?.flagged]);

  function handleSquareClick(square: ChessMoveInput['from']) {
    if (promotion || positionStatus.isGameOver || clock?.flagged || thinking || (mode === 'computer' && turn !== playerColor)) return;

    if (selectedSquare) {
      const matchingMoves = getLegalMoves(gameRef.current, selectedSquare).filter(
        (move) => move.to === square,
      );
      if (matchingMoves.length > 0) {
        if (matchingMoves.some((move) => move.promotion)) {
          setPromotion({ from: selectedSquare, to: square });
          return;
        }
        applyMove({ from: selectedSquare, to: square });
        return;
      }
    }

    const selectedPiece = pieces.find((piece) => piece.square === square);
    if (selectedPiece?.color === gameRef.current.turn()) {
      setSelectedSquare(square);
      setLegalTargets(getLegalMoves(gameRef.current, square).map((move) => move.to));
      setAnnouncement(`${square} selected. ${getLegalMoves(gameRef.current, square).length} legal moves`);
      return;
    }

    clearSelection();
  }

  function choosePromotion(piece: PromotionPiece) {
    if (!promotion) return;
    pendingFocusSquareRef.current = promotion.to;
    applyMove({ ...promotion, promotion: piece });
  }

  function handlePromotionDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!promotion) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      pendingFocusSquareRef.current = promotion.from;
      setPromotion(null);
      return;
    }
    if (event.key !== 'Tab') return;

    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
    const first = controls.item(0);
    const last = controls.item(controls.length - 1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function undo() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setThinking(false);
    const computerHadReplied = mode === 'computer' && gameRef.current.turn() === playerColor;
    const plies = computerHadReplied ? 2 : 1;
    let restoredClock: ChessClockState | null = null;
    let didUndo = false;
    for (let index = 0; index < plies; index += 1) {
      if (!undoMove(gameRef.current)) break;
      didUndo = true;
      restoredClock = clockHistoryRef.current.pop() ?? restoredClock;
    }
    if (!didUndo) return;
    if (restoredClock) updateClock(resumeClock(restoredClock, performance.now()));
    finishedRef.current = false;
    const history = gameRef.current.history({ verbose: true });
    const last = history[history.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    clearSelection();
    setPromotion(null);
    refreshPosition();
  }

  function startGame() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setThinking(false);
    gameRef.current = createGame(initialFen);
    setPositionVersion((value) => value + 1);
    clockHistoryRef.current = [];
    updateClock(mode === 'free' ? null : createPresetClock(clockPreset, 'w'));
    const storage = getBrowserStorage();
    if (storage) clearSavedGame(storage);
    setSavedAvailable(false);
    startedRef.current = false;
    finishedRef.current = false;
    setPieces(getBoardPieces(gameRef.current));
    setTurn(gameRef.current.turn());
    setMoveHistory([]);
    const initialStatus = getPositionStatus(gameRef.current);
    setPositionStatus(initialStatus);
    setAnnouncement(
      initialStatus.reason === 'checkmate'
        ? statusTextForCheckmate(initialStatus.turn)
        : initialStatus.reason
          ? DRAW_LABELS[initialStatus.reason]
          : initialStatus.inCheck
            ? `${sideName(initialStatus.turn)} is in check`
            : `${sideName(initialStatus.turn)} to move`,
    );
    setOrientation(mode === 'computer' ? playerColor : 'w');
    setLastMove(null);
    setPromotion(null);
    clearSelection();
    setReady(true);
  }

  function newGame() {
    startGame();
  }

  function resumeSavedGame() {
    const storage = getBrowserStorage();
    if (!storage) return;
    const saved = loadGame(storage);
    if (!saved) {
      setSavedAvailable(false);
      return;
    }

    workerRef.current?.terminate();
    workerRef.current = null;
    const game = saved.game;
    gameRef.current = game;
    setMode(saved.options.mode);
    setAiLevel(saved.options.aiLevel);
    setPlayerColor(saved.options.playerColor);
    setOrientation(saved.options.orientation);
    setClockPreset(saved.options.clockPreset ?? 'off');
    setPieces(getBoardPieces(game));
    setTurn(game.turn());
    setMoveHistory(game.history());
    const status = getPositionStatus(game);
    setPositionStatus(status);
    setAnnouncement(status.reason
      ? status.reason === 'checkmate' ? statusTextForCheckmate(status.turn) : DRAW_LABELS[status.reason]
      : `${sideName(game.turn())} to move · saved game restored`);
    const history = game.history({ verbose: true });
    const last = history[history.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    clockHistoryRef.current = saved.options.clockHistory ?? [];
    const storedClock = saved.options.clock;
    updateClock(storedClock && storedClock.flagged === null
      ? resumeClock(storedClock, performance.now())
      : storedClock ?? null);
    startedRef.current = history.length > 0;
    finishedRef.current = false;
    clearSelection();
    setPromotion(null);
    setThinking(false);
    setReady(true);
    setSavedAvailable(true);
    setPositionVersion((value) => value + 1);
  }

  function backToSetup() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setThinking(false);
    if (clockRef.current) updateClock(pauseClock(clockRef.current, performance.now()));
    setReady(false);
    clearSelection();
    setPromotion(null);
    persistCurrentGame();
  }

  const moveRows = [];
  for (let index = 0; index < moveHistory.length; index += 2) {
    moveRows.push({
      number: Math.floor(index / 2) + 1,
      white: moveHistory[index],
      black: moveHistory[index + 1],
    });
  }

  return (
    <GameFrame
      title="Rift Chess"
      subtitle="Real chess rules. No account. No shortcuts."
      icon={FlipHorizontal}
      accent="electric"
      toolbar={
        ready ? (
          <>
            <GameButton size="icon" aria-label="Back to setup" onClick={backToSetup}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </GameButton>
            <GameButton size="icon" aria-label="Flip board" onClick={() => setOrientation((value) => (value === 'w' ? 'b' : 'w'))}>
              <FlipHorizontal className="h-4 w-4" aria-hidden="true" />
            </GameButton>
            <GameButton size="icon" aria-label="Undo" onClick={undo} disabled={moveHistory.length === 0}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </GameButton>
            <GameButton size="icon" aria-label="New game" onClick={newGame}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </GameButton>
          </>
        ) : null
      }
      hud={
        <div className="grid grid-cols-3 gap-2">
          <GameStat label="Side to move" value={sideName(turn)} tone={turn === 'w' ? 'ink' : 'plasma'} />
          <GameStat label="Moves played" value={moveRows.length} />
          <GameStat
            label="Position"
            value={clock?.flagged || positionStatus.reason ? 'Finished' : positionStatus.inCheck ? 'Check' : 'Live'}
            tone={positionStatus.isGameOver ? 'mint' : positionStatus.inCheck ? 'coral' : 'electric'}
          />
        </div>
      }
      footer="Keyboard: arrow keys move focus · Enter or Space selects/moves · Escape clears selection. Computer search runs in a Worker; games stay on this device."
    >
      {!ready ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-electric-400/20 bg-electric-400/10 text-4xl text-electric-200">
            ♞
          </div>
          <div>
            <h3 className="text-xl font-semibold text-ink">The board is yours.</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Play a computer opponent, pass-and-play with someone beside you, or use the free board to explore legal positions.
            </p>
          </div>
          <GameSegmented
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            label="Game mode"
            className="mx-auto"
          />
          {mode !== 'free' ? (
            <GameSegmented
              options={CLOCK_OPTIONS}
              value={clockPreset}
              onChange={setClockPreset}
              label="Game clock"
              className="mx-auto"
            />
          ) : null}
          {mode === 'computer' ? (
            <div className="grid gap-3">
              <GameSegmented
                options={AI_LEVEL_OPTIONS}
                value={String(aiLevel) as AiLevelOption}
                onChange={(value) => setAiLevel(Number(value) as AiLevel)}
                label="Computer strength"
                className="mx-auto"
              />
              <GameSegmented
                options={PLAYER_COLOR_OPTIONS}
                value={playerColor}
                onChange={setPlayerColor}
                label="Play as"
                className="mx-auto"
              />
            </div>
          ) : null}
          {savedAvailable ? (
            <GameButton variant="secondary" size="md" onClick={resumeSavedGame} className="mx-auto min-w-48">
              Resume saved game
            </GameButton>
          ) : null}
          <GameButton variant="primary" size="md" onClick={startGame} className="mx-auto min-w-48">
            {mode === 'local' ? 'Play local game' : mode === 'computer' ? 'Play computer game' : 'Open free board'}
          </GameButton>
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(13rem,0.42fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-ink">
                {mode === 'local' ? 'Local two-player' : mode === 'computer' ? `You: ${sideName(playerColor)} · ${AI_LEVEL_LABELS[aiLevel]}` : 'Free board'}
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
                {positionStatus.inCheck ? 'King in check' : 'Standard chess'}
              </p>
            </div>
            <div ref={boardContainerRef} className="relative">
              <ChessBoard
                pieces={pieces}
                orientation={orientation}
                selectedSquare={selectedSquare}
                legalTargets={legalTargets}
                lastMove={lastMove}
                checkedKing={positionStatus.inCheck ? pieces.find((piece) => piece.type === 'k' && piece.color === turn)?.square ?? null : null}
                turn={turn}
                onSquareClick={handleSquareClick}
                onClearSelection={clearSelection}
              />
              {promotion ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="promotion-title"
                  onKeyDown={handlePromotionDialogKeyDown}
                  className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-night-950/90 p-4 backdrop-blur-sm"
                >
                  <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-night-900 p-4 text-center shadow-2xl">
                    <h3 id="promotion-title" className="text-sm font-semibold text-ink">Choose promotion</h3>
                    <p className="mt-1 text-xs text-muted">Choose the piece for your pawn.</p>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {PROMOTION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => choosePromotion(option.value)}
                          aria-label={option.label}
                          ref={option.value === "q" ? promotionFirstButtonRef : undefined}
                          className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 text-3xl text-ink transition hover:border-electric-300 hover:bg-electric-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-300"
                        >
                          <span aria-hidden="true">{turn === 'w' ? option.whiteGlyph : option.blackGlyph}</span>
                          <span className="mt-1 text-[9px] font-medium text-muted">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    <GameButton className="mt-3 w-full" size="sm" onClick={() => { pendingFocusSquareRef.current = promotion.from; setPromotion(null); }}>
                      Cancel
                    </GameButton>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-ink" aria-live="polite">{thinking ? "Computer is thinking…" : statusText}</p>
              <GameButton size="sm" variant="secondary" onClick={undo} disabled={moveHistory.length === 0}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Undo move
              </GameButton>
            </div>
            <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
            {positionStatus.isGameOver ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-mint/20 bg-mint/5 p-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{statusText}</p>
                  <p className="mt-1 text-xs text-muted">
                    {mode === 'local' ? 'The match is complete on this device.' : 'Free board positions are not recorded.'}
                  </p>
                </div>
                <GameButton size="sm" variant="primary" onClick={newGame}>Rematch</GameButton>
              </div>
            ) : null}
          </div>
          <aside className="min-w-0 rounded-2xl border border-white/10 bg-night-950/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Move list</h3>
              <span className="text-[10px] tabular-nums text-muted">{moveHistory.length} plies</span>
            </div>
            {moveRows.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-center text-xs leading-5 text-muted">
                Moves will appear here as the game unfolds.
              </p>
            ) : (
              <ol className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">
                {moveRows.map((row) => (
                  <li key={row.number} className="grid grid-cols-[2rem_1fr_1fr] gap-2 rounded-lg px-2 py-1.5 even:bg-white/[0.035]">
                    <span className="text-muted">{row.number}.</span>
                    <span className="font-medium text-ink">{row.white}</span>
                    <span className="font-medium text-ink">{row.black ?? '…'}</span>
                  </li>
                ))}
              </ol>
            )}
            {clock ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <GameStat label="White clock" value={formatClock(clock.remainingMs.w)} tone={clock.flagged === 'w' ? 'coral' : clock.active === 'w' ? 'mint' : 'ink'} />
                <GameStat label="Black clock" value={formatClock(clock.remainingMs.b)} tone={clock.flagged === 'b' ? 'coral' : clock.active === 'b' ? 'mint' : 'ink'} />
              </div>
            ) : null}
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Rules engine</p>
              <p className="mt-1 text-xs leading-5 text-muted">chess.js · worker-backed alpha-beta opponent · local clocks and versioned browser saves.</p>
              <p className="mt-2 text-[10px] text-muted">{mode !== 'free' && moveHistory.length > 0 ? 'This game is autosaved in this browser.' : 'No account or cloud storage required.'}</p>
            </div>
          </aside>
        </div>
      )}
    </GameFrame>
  );
}
