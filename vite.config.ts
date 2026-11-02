import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const SITE_URL = (
  process.env.SITE_URL ??
  process.env.VITE_SITE_URL ??
  'https://neonrift.pages.dev'
).replace(/\/+$/, '');

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function seoFiles(): Plugin {
  return {
    name: 'neonrift-seo-files',
    apply: 'build',
    generateBundle() {
      const raw = readFileSync(new URL('./src/data/games.json', import.meta.url), 'utf-8');
      const games = JSON.parse(raw) as Array<{
        slug: string;
        category: string;
        secondaryCategories?: string[];
        published: boolean;
        createdAt: string;
      }>;
      const published = games.filter((game) => game.published);

      const staticPaths = [
        { path: '/', lastmod: undefined },
        { path: '/games', lastmod: undefined },
        { path: '/popular', lastmod: undefined },
        { path: '/new', lastmod: undefined },
        { path: '/categories', lastmod: undefined },
        { path: '/about', lastmod: undefined },
        { path: '/contact', lastmod: undefined },
        { path: '/privacy', lastmod: undefined },
        { path: '/terms', lastmod: undefined },
      ];

      const categoryIds = new Set<string>();
      for (const game of published) {
        categoryIds.add(game.category);
        for (const extra of game.secondaryCategories ?? []) categoryIds.add(extra);
      }

      const urls = [
        ...staticPaths.map((entry) => ({ ...entry, priority: '0.7' })),
        ...[...categoryIds].sort().map((id) => ({
          path: `/category/${id}`,
          lastmod: undefined,
          priority: '0.6',
        })),
        ...published.map((game) => ({
          path: `/game/${game.slug}`,
          lastmod: game.createdAt.slice(0, 10),
          priority: '0.8',
        })),
      ];

      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((entry) => {
          const loc = escapeXml(`${SITE_URL}${entry.path}`);
          const lastmod = entry.lastmod
            ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>`
            : '';
          return `  <url><loc>${loc}</loc>${lastmod}<priority>${entry.priority}</priority></url>`;
        }),
        '</urlset>',
        '',
      ].join('\n');

      const robots = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /favorites',
        'Disallow: /recently-played',
        '',
        `Sitemap: ${SITE_URL}/sitemap.xml`,
        '',
      ].join('\n');

      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
