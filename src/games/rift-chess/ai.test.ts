import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChessAi, type AiLevel, type AiMove, type WorkerLike } from './ai';
import { chooseMove } from './ai.worker';
import { RiftChess } from './rules';

class FakeWorker implements WorkerLike {
  messages: Array<Record<string, unknown>> = [];
  listeners: Array<(event: { data: unknown }) => void> = [];
  terminated = false;

  postMessage(message: unknown) {
    this.messages.push(message as Record<string, unknown>);
  }

  addEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
    this.listeners.push(listener);
  }

  removeEventListener(_type: 'message', listener: (event: { data: unknown }) => void) {
    this.listeners = this.listeners.filter((entry) => entry !== listener);
  }

  terminate() {
    this.terminated = true;
  }

  reply(data: unknown) {
    for (const listener of this.listeners) listener({ data });
  }
}

function isLegal(fen: string, move: AiMove): boolean {
  const position = new RiftChess(fen);
  return position
    .legalTargets(move.from)
    .some((candidate) => candidate.to === move.to && candidate.promotion === move.promotion);
}

describe('ChessAi worker client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts the position and resolves the engine move', async () => {
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker);
    const promise = ai.think('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'club');

    expect(worker.messages).toHaveLength(1);
    const request = worker.messages[0];
    expect(request.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(request.level).toBe('club');

    worker.reply({ id: request.id, move: { from: 'e2', to: 'e4' } });
    const result = await promise;

    expect(result.move).toEqual({ from: 'e2', to: 'e4' });
    expect(result.fallback).toBe(false);
    expect(result.timedOut).toBe(false);
    ai.dispose();
  });

  it('passes a promotion choice through', async () => {
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker);
    const fen = '8/P7/8/8/8/8/8/K6k w - - 0 1';
    const promise = ai.think(fen, 'club');
    worker.reply({ id: worker.messages[0].id, move: { from: 'a7', to: 'a8', promotion: 'q' } });

    const result = await promise;
    expect(result.move).toEqual({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(isLegal(fen, result.move!)).toBe(true);
    ai.dispose();
  });

  it('replaces an illegal engine reply with a legal fallback', async () => {
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker, 10_000, () => 0);
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const promise = ai.think(fen, 'club');
    worker.reply({ id: worker.messages[0].id, move: { from: 'e2', to: 'e5' } });

    const result = await promise;
    expect(result.fallback).toBe(true);
    expect(result.move).not.toBeNull();
    expect(isLegal(fen, result.move!)).toBe(true);
    ai.dispose();
  });

  it('times out, terminates the worker and returns a legal fallback', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker, 10_000, () => 0);
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const promise = ai.think(fen, 'master');

    vi.advanceTimersByTime(10_000);
    const result = await promise;

    expect(result.timedOut).toBe(true);
    expect(result.fallback).toBe(true);
    expect(worker.terminated).toBe(true);
    expect(result.move).not.toBeNull();
    expect(isLegal(fen, result.move!)).toBe(true);
  });

  it('falls back when the worker cannot be created', async () => {
    const ai = new ChessAi(() => {
      throw new Error('workers blocked');
    }, 10_000, () => 0);
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = await ai.think(fen, 'club');

    expect(result.fallback).toBe(true);
    expect(result.move).not.toBeNull();
    expect(isLegal(fen, result.move!)).toBe(true);
    ai.dispose();
  });

  it('resolves a pending request as cancelled', async () => {
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker);
    const promise = ai.think('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'master');
    ai.cancelPending();

    const result = await promise;
    expect(result.move).toBeNull();
    expect(result.cancelled).toBe(true);
    ai.dispose();
  });

  it('terminates the worker on dispose', () => {
    const worker = new FakeWorker();
    const ai = new ChessAi(() => worker);
    void ai.think('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'club');
    ai.dispose();
    expect(worker.terminated).toBe(true);
  });
});

describe('chooseMove engine', () => {
  it.each<AiLevel>(['novice', 'casual', 'club'])('returns a legal %s move', (level) => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = chooseMove(fen, level, Date.now() + 5_000, () => 0.9);
    expect(result.move).not.toBeNull();
    expect(isLegal(fen, result.move as AiMove)).toBe(true);
  });

  it('finds the back-rank mate in one', () => {
    const fen = '6k1/5ppp/8/8/8/8/1R6/K7 w - - 0 1';
    const result = chooseMove(fen, 'club', Date.now() + 5_000, () => 0.9);
    expect(result.move).not.toBeNull();
    const position = new RiftChess(fen);
    position.move(result.move!.from, result.move!.to, result.move!.promotion);
    expect(position.outcome()).toEqual({ reason: 'checkmate', winner: 'w' });
  });

  it('returns no move when the position is already over', () => {
    const fen = '7k/6Q1/6K1/8/8/8/8/8 b - - 0 1';
    const result = chooseMove(fen, 'club', Date.now() + 5_000, () => 0.9);
    expect(result.move).toBeNull();
  });

  it('never returns an illegal move across several fixture positions', () => {
    const fixtures = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
      '8/P7/8/8/8/8/8/K6k w - - 0 1',
      '4k3/8/8/4P3/8/8/8/4K3 w - - 0 1',
    ];

    for (const fen of fixtures) {
      const result = chooseMove(fen, 'casual', Date.now() + 5_000, () => 0.5);
      expect(result.move).not.toBeNull();
      expect(isLegal(fen, result.move as AiMove)).toBe(true);
    }
  });

  it('reports a timeout instead of blocking past the deadline', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = chooseMove(fen, 'master', Date.now() - 1, () => 0);
    expect(result.timedOut).toBe(true);
    expect(result.move).not.toBeNull();
    expect(isLegal(fen, result.move as AiMove)).toBe(true);
  });
});
