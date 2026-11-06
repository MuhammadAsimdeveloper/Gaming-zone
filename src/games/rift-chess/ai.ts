import type { Square } from 'chess.js';
import { RiftChess, type PromotionPiece } from './rules';

export type AiLevel = 'novice' | 'casual' | 'club' | 'expert' | 'master';

export interface AiMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface AiResult {
  move: AiMove | null;
  timedOut: boolean;
  cancelled: boolean;
  fallback: boolean;
}

export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  terminate(): void;
}

export const AI_LEVELS: ReadonlyArray<{ value: AiLevel; label: string; detail: string }> = [
  { value: 'novice', label: 'Novice', detail: 'Depth 1 · often plays a random legal move' },
  { value: 'casual', label: 'Casual', detail: 'Depth 2 · occasional slips' },
  { value: 'club', label: 'Club', detail: 'Depth 2 · no deliberate slips' },
  { value: 'expert', label: 'Expert', detail: 'Depth 3 · searches further ahead' },
  { value: 'master', label: 'Master', detail: 'Depth 4 · up to ten seconds per move' },
];

const PROMOTION_PIECES: ReadonlyArray<string> = ['q', 'r', 'b', 'n'];

function createDefaultWorker(): WorkerLike {
  return new Worker(new URL('./ai.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

function isPromotionPiece(value: unknown): value is PromotionPiece {
  return typeof value === 'string' && PROMOTION_PIECES.includes(value);
}

function toLegalMove(fen: string, candidate: unknown): AiMove | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const record = candidate as Record<string, unknown>;
  if (typeof record.from !== 'string' || typeof record.to !== 'string') return null;
  if (record.promotion !== undefined && !isPromotionPiece(record.promotion)) return null;

  const from = record.from as Square;
  const to = record.to as Square;
  const promotion = record.promotion as PromotionPiece | undefined;

  try {
    const position = new RiftChess(fen);
    const legal = position
      .legalTargets(from)
      .some((move) => move.to === to && move.promotion === promotion);
    return legal ? { from, to, promotion } : null;
  } catch {
    return null;
  }
}

interface Pending {
  resolve: (result: AiResult) => void;
  timer: ReturnType<typeof setTimeout>;
  fen: string;
}

export class ChessAi {
  private worker: WorkerLike | null = null;
  private readonly pending = new Map<string, Pending>();
  private sequence = 0;

  constructor(
    private readonly createWorker: () => WorkerLike = createDefaultWorker,
    private readonly timeoutMs = 10_000,
    private readonly random: () => number = Math.random,
  ) {}

  think(fen: string, level: AiLevel): Promise<AiResult> {
    let worker: WorkerLike;
    try {
      worker = this.ensureWorker();
    } catch {
      return Promise.resolve(this.fallbackResult(fen, false));
    }

    const id = `ai-${(this.sequence += 1)}`;

    return new Promise<AiResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.terminate();
        resolve(this.fallbackResult(fen, true));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, timer, fen });

      try {
        worker.postMessage({ type: 'think', id, fen, level });
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(this.fallbackResult(fen, false));
      }
    });
  }

  cancelPending(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.resolve({ move: null, timedOut: false, cancelled: true, fallback: false });
      this.pending.delete(id);
    }
  }

  dispose(): void {
    this.cancelPending();
    this.terminate();
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.addEventListener('message', this.handleMessage);
    this.worker = worker;
    return worker;
  }

  private terminate(): void {
    if (!this.worker) return;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.terminate();
    this.worker = null;
  }

  private handleMessage = (event: { data: unknown }): void => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const record = data as Record<string, unknown>;
    if (typeof record.id !== 'string') return;

    const pending = this.pending.get(record.id);
    if (!pending) return;

    this.pending.delete(record.id);
    clearTimeout(pending.timer);

    if (record.type === 'error') {
      pending.resolve(this.fallbackResult(pending.fen, false));
      return;
    }

    const move = toLegalMove(pending.fen, record.move);
    if (!move) {
      pending.resolve(this.fallbackResult(pending.fen, false));
      return;
    }

    pending.resolve({
      move,
      timedOut: record.timedOut === true,
      cancelled: false,
      fallback: false,
    });
  };

  private fallbackResult(fen: string, timedOut: boolean): AiResult {
    let move: AiMove | null = null;
    try {
      const position = new RiftChess(fen);
      const moves = position.view().legalMoves;
      if (moves.length > 0) {
        const index = Math.min(moves.length - 1, Math.floor(this.random() * moves.length));
        const pick = moves[Math.max(0, index)];
        move = { from: pick.from, to: pick.to, promotion: pick.promotion };
      }
    } catch {
      move = null;
    }

    return { move, timedOut, cancelled: false, fallback: true };
  }
}
