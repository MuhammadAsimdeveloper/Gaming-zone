const CHUNK_ERROR_PATTERN =
  /dynamically imported module|module script failed|loading chunk|loading css chunk/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR_PATTERN.test(error.message);
}
