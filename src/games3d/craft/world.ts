import { BLOCK, BLOCKS, isSolidBlock, type BlockId } from './blocks';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  blockIndex,
  createTerrain,
  generateChunk,
  type TerrainSampler,
} from './terrain';

export interface Chunk {
  cx: number;
  cz: number;
  blocks: Uint8Array;
  dirty: boolean;
}

export interface VoxelEdit {
  x: number;
  y: number;
  z: number;
  id: BlockId;
}

export function worldToChunk(x: number, z: number): { cx: number; cz: number } {
  return { cx: Math.floor(x / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** Membership in `BLOCKS` is the runtime validity check (`blockSpec` silently falls back to Air). */
function isKnownBlock(id: number): id is BlockId {
  return Object.prototype.hasOwnProperty.call(BLOCKS, id);
}

export class VoxelWorld {
  readonly seed: string;
  private readonly terrain: TerrainSampler;
  private readonly chunks = new Map<string, Chunk>();
  /** Chunk key -> local block index -> edited id. Insertion ordered for deterministic saves. */
  private readonly edits = new Map<string, Map<number, BlockId>>();

  constructor(seed: string) {
    this.seed = seed;
    this.terrain = createTerrain(seed);
  }

  ensureChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    const cached = this.chunks.get(key);
    if (cached) return cached;

    const blocks = generateChunk(this.terrain, cx, cz);
    const pending = this.edits.get(key);
    if (pending) {
      for (const [index, id] of pending) blocks[index] = id;
    }
    const chunk: Chunk = { cx, cz, blocks, dirty: true };
    this.chunks.set(key, chunk);
    return chunk;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.Air;
    const { cx, cz } = worldToChunk(x, z);
    const chunk = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return chunk.blocks[blockIndex(lx, y, lz)] as BlockId;
  }

  setBlock(x: number, y: number, z: number, id: BlockId): boolean {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    if (!isKnownBlock(id)) return false;

    const { cx, cz } = worldToChunk(x, z);
    const chunk = this.ensureChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    const index = blockIndex(lx, y, lz);
    const current = chunk.blocks[index];
    if (current === id || current === BLOCK.Bedrock) return false;

    chunk.blocks[index] = id;
    this.recordEdit(cx, cz, index, id);
    chunk.dirty = true;
    this.markBorderNeighbours(cx, cz, lx, lz);
    return true;
  }

  isSolid(x: number, y: number, z: number): boolean {
    return isSolidBlock(this.getBlock(x, y, z));
  }

  unloadChunk(cx: number, cz: number): void {
    // Only the cache entry is dropped; edits stay so the chunk regenerates modified.
    this.chunks.delete(chunkKey(cx, cz));
  }

  takeDirtyChunks(): Chunk[] {
    const dirty: Chunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      chunk.dirty = false;
      dirty.push(chunk);
    }
    return dirty;
  }

  editsForSave(): VoxelEdit[] {
    const result: VoxelEdit[] = [];
    for (const [key, chunkEdits] of this.edits) {
      const comma = key.indexOf(',');
      const cx = Number(key.slice(0, comma));
      const cz = Number(key.slice(comma + 1));
      const indices = [...chunkEdits.keys()].sort((a, b) => a - b);
      for (const index of indices) {
        const id = chunkEdits.get(index);
        if (id === undefined) continue;
        const lx = index % CHUNK_SIZE;
        const lz = Math.floor(index / CHUNK_SIZE) % CHUNK_SIZE;
        const ly = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
        result.push({ x: cx * CHUNK_SIZE + lx, y: ly, z: cz * CHUNK_SIZE + lz, id });
      }
    }
    return result;
  }

  applyEdits(edits: readonly VoxelEdit[]): void {
    for (const edit of edits) {
      if (!isKnownBlock(edit.id)) continue;
      if (edit.y < 0 || edit.y >= CHUNK_HEIGHT) continue;
      const { cx, cz } = worldToChunk(edit.x, edit.z);
      const lx = edit.x - cx * CHUNK_SIZE;
      const lz = edit.z - cz * CHUNK_SIZE;
      this.recordEdit(cx, cz, blockIndex(lx, edit.y, lz), edit.id);
      this.chunks.delete(chunkKey(cx, cz));
    }
  }

  private recordEdit(cx: number, cz: number, index: number, id: BlockId): void {
    const key = chunkKey(cx, cz);
    let chunkEdits = this.edits.get(key);
    if (!chunkEdits) {
      chunkEdits = new Map<number, BlockId>();
      this.edits.set(key, chunkEdits);
    }
    chunkEdits.set(index, id);
  }

  /**
   * Border invalidation policy: an unloaded neighbour has no mesh to invalidate, so
   * high borders (+x / +z) load the neighbouring chunk eagerly and mark it dirty,
   * while low borders (-x / -z) only mark a neighbour that is already cached.
   */
  private markBorderNeighbours(cx: number, cz: number, lx: number, lz: number): void {
    if (lx === CHUNK_SIZE - 1) this.ensureChunk(cx + 1, cz).dirty = true;
    else if (lx === 0) this.markCachedDirty(cx - 1, cz);

    if (lz === CHUNK_SIZE - 1) this.ensureChunk(cx, cz + 1).dirty = true;
    else if (lz === 0) this.markCachedDirty(cx, cz - 1);
  }

  private markCachedDirty(cx: number, cz: number): void {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }
}
