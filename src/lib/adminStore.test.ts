import { describe, expect, it } from 'vitest';
import type { Game } from '../types/game';
import { emptyAdminState, mergeCatalogue, sanitizeAdminState } from './adminStore';

const baseGame: Game = {
  id: 'base',
  slug: 'base',
  title: 'Base Game',
  tagline: 'A fixture',
  description: 'A fixture game used by the admin-store tests.',
  category: 'arcade',
  thumbnail: '/art/base.svg',
  accent: '#4c8dff',
  type: 'internal',
  internalKey: 'snake',
  instructions: ['Play.'],
  controls: [{ label: 'Move', keys: 'Arrow keys' }],
  published: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  featured: false,
  popularityRank: 1,
};

describe('mergeCatalogue', () => {
  it('applies valid edits', () => {
    const games = mergeCatalogue([baseGame], {
      ...emptyAdminState,
      edits: { base: { title: 'Edited' } },
    });

    expect(games[0]?.title).toBe('Edited');
  });

  it('falls back to the base game when an edit corrupts its shape', () => {
    const games = mergeCatalogue([baseGame], {
      ...emptyAdminState,
      edits: { base: { instructions: null as unknown as string[] } },
    });

    expect(games[0]?.instructions).toEqual(['Play.']);
  });

  it('removes deleted games', () => {
    const games = mergeCatalogue([baseGame], {
      ...emptyAdminState,
      deletedIds: ['base'],
    });

    expect(games).toHaveLength(0);
  });
});

describe('sanitizeAdminState', () => {
  it('rejects unknown categories and ad placements', () => {
    const state = sanitizeAdminState({
      hiddenCategories: ['arcade', 'not-a-category'],
      adPlacements: { 'home-top': true, nope: true },
    });

    expect(state?.hiddenCategories).toEqual(['arcade']);
    expect(state?.adPlacements).toEqual({ 'home-top': true });
  });

  it('returns null for values that are not records', () => {
    expect(sanitizeAdminState(null)).toBeNull();
    expect(sanitizeAdminState('nope')).toBeNull();
  });
});
