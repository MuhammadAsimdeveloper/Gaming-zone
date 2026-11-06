import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors, GAMES } from './helpers';

test.describe('catalogue and navigation', () => {
  test('home page presents the library', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /one click away/i })).toBeVisible();
    await expect(page.getByText(/32 original games/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Neon Snake/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse all games/i }).first()).toBeVisible();

    expectNoErrors(errors);
  });

  test('all thirty-two published games appear in the catalogue', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/games');
    await expect(page.getByRole('heading', { name: /All games/i })).toBeVisible();

    const loadMore = page.getByRole('button', { name: /Load more games/i });
    while (await loadMore.isVisible()) await loadMore.click();

    for (const game of GAMES) {
      await expect(page.getByRole('link', { name: new RegExp(game.title) }).first(), game.title).toBeVisible();
    }
    expectNoErrors(errors);
  });

  test('search filters the catalogue', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/games');

    await page.getByPlaceholder('Search the library...').fill('snake');
    await expect(page.getByRole('link', { name: /Neon Snake/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Neon Apex/ })).toHaveCount(0);
    await expect(page.getByText(/^1 game$/)).toBeVisible();

    await page.getByRole('button', { name: /Clear search/i }).click();
    await expect(page.getByRole('link', { name: /Neon Apex/ }).first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('header search submits to the catalogue', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    const search = page.getByRole('search').filter({ has: page.locator('#header-search') });
    await search.getByRole('combobox').fill('neon apex');
    await search.getByRole('combobox').press('Enter');

    await expect(page).toHaveURL(/\/games\?q=neon(%20|\+)apex/);
    await expect(page.getByRole('link', { name: /Neon Apex/ }).first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('search suggestions are keyboard navigable', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    const search = page.getByRole('search').filter({ has: page.locator('#header-search') });
    const combobox = search.getByRole('combobox');
    await combobox.fill('neon');
    await combobox.press('ArrowDown');

    await expect(search.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await combobox.press('Enter');

    await expect(page).toHaveURL(/\/game\/neon-(apex|city-drive|snake)/);
    expectNoErrors(errors);
  });

  test('category filter narrows the catalogue', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/games');

    await page.getByRole('button', { name: /^Racing/ }).click();
    await expect(page).toHaveURL(/category=racing/);
    await expect(page.getByRole('link', { name: /Neon Apex/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Neon Snake/ })).toHaveCount(0);
    expectNoErrors(errors);
  });

  test('every published game page renders its runtime', async ({ page }) => {
    test.setTimeout(120_000);
    for (const game of GAMES) {
      const errors = collectErrors(page);
      await page.goto(`/game/${game.slug}`);
      await expect(page.getByRole('heading', { name: game.title, level: 1 })).toBeVisible();
      await expect(page.getByText('No account · progress stays in this browser')).toBeVisible();
      expectNoErrors(errors);
    }
  });

  test('unknown routes show the 404 page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/this-level-does-not-exist');

    await expect(page.getByRole('heading', { name: /This level does not exist/i })).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('menu opens, navigates and closes', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Mobile', exact: true });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'All Games' })).toBeVisible();

    await menu.getByRole('link', { name: 'All Games' }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.getByRole('heading', { name: /All games/i })).toBeVisible();
    await expect(menu).toHaveCount(0);
    expectNoErrors(errors);
  });
});
