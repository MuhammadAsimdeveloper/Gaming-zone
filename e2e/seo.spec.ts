import { expect, test, type APIRequestContext } from '@playwright/test';
import { GAMES } from './helpers';

const STATIC_PATHS = [
  '/',
  '/games',
  '/popular',
  '/new',
  '/categories',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
];

async function sitemapLocs(request: APIRequestContext) {
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  expect(xml.startsWith('<?xml')).toBe(true);

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const origin = locs[0]?.match(/^https?:\/\/[^/]+/)?.[0];
  expect(origin, 'sitemap must use absolute URLs').toBeTruthy();
  return { xml, locs, origin: origin as string };
}

test('sitemap lists every published game and static page exactly once', async ({ request }) => {
  const { locs, origin } = await sitemapLocs(request);

  for (const game of GAMES) {
    expect(locs, `${game.slug} missing from sitemap`).toContain(`${origin}/game/${game.slug}`);
  }
  for (const path of STATIC_PATHS) {
    expect(locs, `${path} missing from sitemap`).toContain(`${origin}${path}`);
  }
  expect(locs.some((loc) => loc.startsWith(`${origin}/category/`))).toBe(true);
  expect(new Set(locs).size, 'sitemap must not repeat URLs').toBe(locs.length);
});

test('every sitemap game route is served', async ({ request }) => {
  const { locs, origin } = await sitemapLocs(request);
  const gameUrls = locs.filter((loc) => loc.startsWith(`${origin}/game/`));

  expect(gameUrls).toHaveLength(GAMES.length);
  for (const url of gameUrls) {
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
  }
});

test('robots.txt allows browsing, blocks private routes and points at the sitemap', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expect(response.status()).toBe(200);
  const lines = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  expect(lines).toContain('User-agent: *');
  expect(lines).toContain('Allow: /');
  for (const path of ['/admin', '/favorites', '/recently-played']) {
    expect(lines).toContain(`Disallow: ${path}`);
  }
  expect(lines.some((line) => /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/.test(line))).toBe(true);
  expect(lines).not.toContain('Disallow: /');
});
