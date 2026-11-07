import * as THREE from 'three';
import type { CraftMaterials } from './atlas';
import { computeChunkLight, type ChunkLight } from './light';
import { meshChunk, type MeshBuffers } from './mesher';
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from './terrain';
import { chunkId } from './streaming';
import type { VoxelWorld } from './world';

export interface ChunkMeshes {
  opaque: THREE.Mesh | null;
  cutout: THREE.Mesh | null;
  transparent: THREE.Mesh | null;
}

interface ChunkEntry extends ChunkMeshes {
  light: ChunkLight;
}

export function geometryFromBuffers(buffers: MeshBuffers): THREE.BufferGeometry | null {
  if (buffers.indices.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute('aTile', new THREE.Float32BufferAttribute(buffers.tiles, 1));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Owns the chunk meshes in the scene. A build regenerates the chunk through the world
 * (so pending edits apply), recomputes light from the 3 x 3 neighbourhood, meshes it and
 * swaps the three buckets in one go. Removal disposes every geometry it created.
 */
export class ChunkView {
  private readonly group = new THREE.Group();
  private readonly chunks = new Map<string, ChunkEntry>();

  constructor(
    scene: THREE.Scene,
    private readonly world: VoxelWorld,
    private readonly materials: CraftMaterials,
    private shadows: boolean,
  ) {
    this.group.name = 'craft-chunks';
    scene.add(this.group);
  }

  has(cx: number, cz: number): boolean {
    return this.chunks.has(chunkId(cx, cz));
  }

  keys(): string[] {
    return [...this.chunks.keys()];
  }

  build(cx: number, cz: number): void {
    this.remove(cx, cz);
    this.world.ensureChunk(cx, cz);
    const light = computeChunkLight(this.world, cx, cz);
    const mesh = meshChunk(this.world, cx, cz, light);
    const entry: ChunkEntry = {
      opaque: this.createMesh(mesh.opaque, this.materials.opaque, cx, cz, true),
      cutout: this.createMesh(mesh.cutout, this.materials.cutout, cx, cz, true),
      transparent: this.createMesh(
        mesh.transparent,
        this.materials.transparent,
        cx,
        cz,
        false,
      ),
      light,
    };
    this.chunks.set(chunkId(cx, cz), entry);
  }

  remove(cx: number, cz: number): boolean {
    const key = chunkId(cx, cz);
    const entry = this.chunks.get(key);
    if (!entry) return false;
    for (const mesh of [entry.opaque, entry.cutout, entry.transparent]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.chunks.delete(key);
    return true;
  }

  /** Combined light at a world block, or full daylight when the chunk is not meshed. */
  lightAt(x: number, y: number, z: number): number {
    const entry = this.entryAt(x, z);
    if (!entry) return 15;
    return Math.max(this.channelAt(entry.light.sky, x, y, z), this.channelAt(entry.light.block, x, y, z));
  }

  /**
   * Skylight is baked at full strength; callers scale it by the current sky light so the
   * night is dark even though the stored channel is 15 on an open surface.
   */
  skyLightAt(x: number, y: number, z: number): number {
    const entry = this.entryAt(x, z);
    return entry ? this.channelAt(entry.light.sky, x, y, z) : 15;
  }

  blockLightAt(x: number, y: number, z: number): number {
    const entry = this.entryAt(x, z);
    if (!entry) return 0;
    return this.channelAt(entry.light.block, x, y, z);
  }

  /** Shadow flags apply to the three buckets without touching geometry or light. */
  setShadows(enabled: boolean): void {
    this.shadows = enabled;
    for (const entry of this.chunks.values()) {
      for (const mesh of [entry.opaque, entry.cutout]) {
        if (mesh) mesh.castShadow = enabled;
      }
      for (const mesh of [entry.opaque, entry.cutout, entry.transparent]) {
        if (mesh) mesh.receiveShadow = enabled;
      }
    }
  }

  /** Visits every meshed chunk origin, for the once-a-day growth pass. */
  forEachChunk(visit: (cx: number, cz: number) => void): void {
    for (const key of this.chunks.keys()) {
      const comma = key.indexOf(',');
      visit(Number(key.slice(0, comma)), Number(key.slice(comma + 1)));
    }
  }

  dispose(): void {
    for (const key of [...this.chunks.keys()]) {
      const comma = key.indexOf(',');
      this.remove(Number(key.slice(0, comma)), Number(key.slice(comma + 1)));
    }
    this.group.removeFromParent();
  }

  private entryAt(x: number, z: number): ChunkEntry | undefined {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return this.chunks.get(chunkId(cx, cz));
  }

  private channelAt(channel: Uint8Array, x: number, y: number, z: number): number {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    if (!Number.isInteger(y) || y < 0 || y >= CHUNK_HEIGHT) return 0;
    return channel[blockIndex(lx, y, lz)];
  }

  private createMesh(
    buffers: MeshBuffers,
    material: THREE.Material,
    cx: number,
    cz: number,
    castsShadow: boolean,
  ): THREE.Mesh | null {
    const geometry = geometryFromBuffers(buffers);
    if (!geometry) return null;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.castShadow = this.shadows && castsShadow;
    mesh.receiveShadow = this.shadows;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.frustumCulled = true;
    this.group.add(mesh);
    return mesh;
  }
}