import { describe, expect, it } from 'vitest';
import { BLOCK } from './blocks';
import { MUTE_STORAGE_KEY, footstepSurface, loadMuted, saveMuted } from './audio';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

describe('audio helpers', () => {
  it('picks a footstep surface from the block underfoot', () => {
    expect(footstepSurface(BLOCK.Grass)).toBe('grass');
    expect(footstepSurface(BLOCK.Farmland)).toBe('grass');
    expect(footstepSurface(BLOCK.Stone)).toBe('stone');
    expect(footstepSurface(BLOCK.IronOre)).toBe('stone');
    expect(footstepSurface(BLOCK.Sand)).toBe('sand');
    expect(footstepSurface(BLOCK.Gravel)).toBe('sand');
    expect(footstepSurface(BLOCK.RiftwoodLog)).toBe('wood');
    expect(footstepSurface(BLOCK.Planks)).toBe('wood');
    expect(footstepSurface(BLOCK.Water)).toBe('water');
  });

  it('falls back to stone for unknown or airborne blocks', () => {
    expect(footstepSurface(BLOCK.Air)).toBe('stone');
    expect(footstepSurface(9_999)).toBe('stone');
  });

  it('persists the mute preference', () => {
    const storage = memoryStorage();
    expect(MUTE_STORAGE_KEY).toBe('neonrift-craft:muted');
    expect(loadMuted(storage)).toBe(false);
    saveMuted(storage, true);
    expect(loadMuted(storage)).toBe(true);
    saveMuted(storage, false);
    expect(loadMuted(storage)).toBe(false);
  });

  it('treats a corrupt or missing mute value as unmuted', () => {
    expect(loadMuted(memoryStorage({ [MUTE_STORAGE_KEY]: 'yes' }))).toBe(false);
    expect(loadMuted(null)).toBe(false);
    expect(() => saveMuted(null, true)).not.toThrow();
  });

  it('survives storage that throws', () => {
    const hostile = {
      getItem(): string | null {
        throw new Error('blocked');
      },
      setItem(): void {
        throw new Error('blocked');
      },
    };
    expect(loadMuted(hostile)).toBe(false);
    expect(() => saveMuted(hostile, true)).not.toThrow();
  });
});