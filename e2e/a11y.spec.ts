import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const ROUTES = ['/', '/games', '/about', '/game/neon-apex'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`axe WCAG AA: ${route} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.addScriptTag({ path: axePath });

      const violations = await page.evaluate(async () => {
        // @ts-expect-error axe is injected by addScriptTag
        const results = await window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
          },
        });
        return results.violations
          .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target.join(' ')),
          }));
      });

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}

test('browsing routes use the day theme and game routes use night', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

  await page.goto('/games');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

  await page.goto('/game/neon-snake');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

  expectNoErrors(errors);
});

for (const width of [390, 768, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    for (const route of ['/', '/games', '/categories', '/about', '/game/neon-snake']) {
      await page.goto(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test('footer links meet the 24px target minimum', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('footer a');
  await links.first().waitFor({ state: 'attached' });
  const heights = await links.evaluateAll((elements) =>
    elements.map((link) => Math.round(link.getBoundingClientRect().height)),
  );

  expect(heights.length).toBeGreaterThan(0);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
});
