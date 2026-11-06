import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from './chunkError';

describe('isChunkLoadError', () => {
  it('detects Chromium dynamic import failures', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/game.js')),
    ).toBe(true);
  });

  it('detects Firefox and WebKit module script failures', () => {
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 42 failed.'))).toBe(true);
  });

  it('ignores ordinary render and gameplay errors', () => {
    expect(isChunkLoadError(new Error('synthetic render failure'))).toBe(false);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
