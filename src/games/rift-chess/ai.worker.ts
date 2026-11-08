import { findBestMove, type AiWorkerRequest, type AiWorkerResponse } from './ai';

interface WorkerScope {
  onmessage: ((event: MessageEvent<AiWorkerRequest>) => void) | null;
  postMessage: (message: AiWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
  const request = event.data;
  try {
    scope.postMessage({
      requestId: request.requestId,
      fen: request.fen,
      move: findBestMove(request.fen, { level: request.level }),
    });
  } catch (error) {
    scope.postMessage({
      requestId: request.requestId,
      fen: request.fen,
      move: null,
      error: error instanceof Error ? error.message : 'Computer search failed.',
    });
  }
};
