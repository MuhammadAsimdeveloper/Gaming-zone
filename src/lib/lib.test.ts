import { describe, expect, it } from 'vitest';
import type { Game } from '../types/game';
import { filterGames, matchesQuery, pageSlice, sortGames } from './catalogue';
import { sanitizeThumbnailUrl, validateExternalGameUrl } from './embed';
import { formatDate, formatRelativeTime, formatScore } from './format';
import { parseCategory, parseSort } from './urlState';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 'test-game',
    slug: 'test-game',
    title: 'Test Game',
    tagline: 'A game for tests',
    description: 'A small fixture used by the unit tests.',
    category: 'arcade',
    thumbnail: '/art/test.svg',
    accent: '#22d3ee',
    type: 'internal',
    instructions: ['Play the game.'],
    controls: [{ label: 'Move', keys: 'Arrow keys' }],
    published: true,
    createdAt: '2026-01-05T12:00:00.000Z',
    featured: false,
    popularityRank: 10,
    ...overrides,
  };
}

describe('catalogue', () => {
  it('matches titles case-insensitively', () => {
    expect(matchesQuery(makeGame(), 'TEST')).toBe(true);
  });

  it('matches category labels rather than only ids', () => {
    const game = makeGame({ category: 'strategy' });
    expect(matchesQuery(game, 'strategy')).toBe(true);
  });

  it('requires every query token to match', () => {
    expect(matchesQuery(makeGame(), 'test game')).toBe(true);
    expect(matchesQuery(makeGame(), 'test missing')).toBe(false);
  });

  it('treats an empty query as a match', () => {
    expect(matchesQuery(makeGame(), '   ')).toBe(true);
  });

  it('filters by primary and secondary category', () => {
    const racing = makeGame({ id: 'racing', category: 'racing' });
    const hybrid = makeGame({ id: 'hybrid', category: 'arcade', secondaryCategories: ['racing'] });
    const puzzle = makeGame({ id: 'puzzle', category: 'puzzle' });

    const result = filterGames([racing, hybrid, puzzle], { category: 'racing' });

    expect(result.map((game) => game.id)).toEqual(['racing', 'hybrid']);
  });

  it('filters by query', () => {
    const other = makeGame({
      id: 'other',
      title: 'Different',
      tagline: 'An unrelated fixture',
      description: 'Nothing matching the query lives here.',
    });
    const result = filterGames([makeGame(), other], { query: 'test' });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('test-game');
  });

  it('sorts by popularity rank ascending', () => {
    const result = sortGames(
      [makeGame({ id: 'late', popularityRank: 9 }), makeGame({ id: 'early', popularityRank: 1 })],
      'popular',
    );
    expect(result.map((game) => game.id)).toEqual(['early', 'late']);
  });

  it('sorts featured games first without mutating the input', () => {
    const input = [
      makeGame({ id: 'normal', popularityRank: 1 }),
      makeGame({ id: 'featured', featured: true, popularityRank: 9 }),
    ];
    const result = sortGames(input, 'featured');

    expect(result.map((game) => game.id)).toEqual(['featured', 'normal']);
    expect(input[0]?.id).toBe('normal');
  });

  it('slices pages from the start', () => {
    expect(pageSlice([1, 2, 3, 4], 2, 2)).toEqual([1, 2, 3, 4]);
    expect(pageSlice([1, 2, 3, 4], 1, 2)).toEqual([1, 2]);
    expect(pageSlice([1, 2, 3, 4], 0, 2)).toEqual([]);
  });
});

describe('external embed validation', () => {
  const allowed = ['https://games.example.com'];

  it('accepts an HTTPS URL on an allowed origin', () => {
    const result = validateExternalGameUrl('https://games.example.com/play?x=1', allowed);
    expect(result).toMatchObject({ ok: true, origin: 'https://games.example.com' });
  });

  it('rejects HTTP URLs', () => {
    const result = validateExternalGameUrl('http://games.example.com/play', allowed);
    expect(result.ok).toBe(false);
  });

  it('rejects an origin outside the allowlist', () => {
    const result = validateExternalGameUrl('https://evil.example.com/play', allowed);
    expect(result.ok).toBe(false);
  });

  it('rejects URLs with embedded credentials', () => {
    const result = validateExternalGameUrl('https://user:pass@games.example.com/play', allowed);
    expect(result.ok).toBe(false);
  });

  it('rejects every URL when no origins are configured', () => {
    const result = validateExternalGameUrl('https://games.example.com/play', []);
    expect(result.ok).toBe(false);
  });

  it('rejects blank and malformed values', () => {
    expect(validateExternalGameUrl('', allowed).ok).toBe(false);
    expect(validateExternalGameUrl('not a url', allowed).ok).toBe(false);
  });

  it('allows localhost only when explicitly enabled', () => {
    const url = 'http://localhost:5173/play';
    expect(validateExternalGameUrl(url, ['http://localhost:5173']).ok).toBe(false);
    expect(
      validateExternalGameUrl(url, ['http://localhost:5173'], { allowLocalhost: true }).ok,
    ).toBe(true);
  });
});

describe('thumbnail sanitisation', () => {
  it('accepts local absolute paths', () => {
    expect(sanitizeThumbnailUrl('/art/game.webp')).toBe('/art/game.webp');
  });

  it('accepts HTTPS URLs', () => {
    expect(sanitizeThumbnailUrl('https://cdn.example.com/a.png')).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('rejects non-HTTPS, protocol-relative and script URLs', () => {
    expect(sanitizeThumbnailUrl('http://cdn.example.com/a.png')).toBeNull();
    expect(sanitizeThumbnailUrl('//cdn.example.com/a.png')).toBeNull();
    expect(sanitizeThumbnailUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeThumbnailUrl('')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats valid dates and marks invalid ones', () => {
    expect(formatDate('2026-01-05T12:00:00.000Z')).toContain('2026');
    expect(formatDate('not-a-date')).toBe('Unknown date');
  });

  it('formats relative times against a supplied clock', () => {
    const now = Date.parse('2026-01-05T12:00:00.000Z');
    expect(formatRelativeTime('2026-01-05T11:59:45.000Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-01-05T11:50:00.000Z', now)).toBe('10 minutes ago');
    expect(formatRelativeTime('2026-01-05T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('bad', now)).toBe('Unknown time');
  });

  it('formats scores with grouping', () => {
    expect(formatScore(1234567)).toBe('1,234,567');
  });
});

describe('URL state parsing', () => {
  it('accepts known sorts and falls back to featured', () => {
    expect(parseSort('newest')).toBe('newest');
    expect(parseSort('nonsense')).toBe('featured');
    expect(parseSort(null)).toBe('featured');
  });

  it('accepts known categories and falls back to all', () => {
    expect(parseCategory('racing')).toBe('racing');
    expect(parseCategory('nonsense')).toBe('all');
    expect(parseCategory(null)).toBe('all');
  });
});
