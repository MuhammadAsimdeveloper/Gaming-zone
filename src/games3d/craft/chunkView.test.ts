import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { computeChunkLight } from './light';
import { meshChunk } from './mesher';
import { geometryFromBuffers } from './chunkView';
import { VoxelWorld } from './world';

describe('geometryFromBuffers', () => {
  it('returns null for an empty bucket', () => {
    expect(
      geometryFromBuffers({ positions: [], normals: [], uvs: [], tiles: [], colors: [], indices: [] }),
    ).toBeNull();
  });

  it('copies every buffer into a renderable geometry', () => {
    const world = new VoxelWorld('geometry-test');
    expect(world.setBlock(1, 58, 1, BLOCK.Stone)).toBe(true);
    const mesh = meshChunk(world, 0, 0, computeChunkLight(world, 0, 0));
    const geometry = geometryFromBuffers(mesh.opaque);
    expect(geometry).not.toBeNull();
    expect(geometry!.getAttribute('position').count).toBe(mesh.opaque.positions.length / 3);
    expect(geometry!.getAttribute('normal').count).toBe(mesh.opaque.positions.length / 3);
    expect(geometry!.getAttribute('uv').itemSize).toBe(2);
    expect(geometry!.getAttribute('aTile').count).toBe(mesh.opaque.positions.length / 3);
    expect(geometry!.getAttribute('color').itemSize).toBe(3);
    expect(geometry!.getIndex()?.count).toBe(mesh.opaque.indices.length);
    const sphere = geometry!.boundingSphere;
    expect(sphere).not.toBeNull();
    expect(Number.isFinite(sphere!.radius)).toBe(true);
    geometry!.dispose();
  });
});