import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

test.describe('error recovery', () => {
  test('a failed route chunk shows the app error screen and reload recovers', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /one click away/i })).toBeVisible();

    await page.route('**/assets/AboutPage-*.js', (route) => route.abort());
    await page.goto('/about');

    const alert = page.getByRole('alert');
    await expect(alert.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Reload page' })).toBeVisible();
    expect(errors.consoleErrors.length).toBeGreaterThan(0);

    await page.unroute('**/assets/AboutPage-*.js');
    await alert.getByRole('button', { name: 'Reload page' }).click();
    await expect(page.getByRole('heading', { name: /A small library with a sharp edge/i })).toBeVisible();
  });

  test('a failed game chunk is contained by the game boundary', async ({ page }) => {
    await page.goto('/');
    await page.route('**/assets/SnakeGame-*.js', (route) => route.abort());
    await page.goto('/game/neon-snake');

    await expect(page.getByRole('heading', { name: 'This game hit a snag' })).toBeVisible();
    await expect(page.getByText(/Your saved scores were not affected/i)).toBeVisible();

    await page.unroute('**/assets/SnakeGame-*.js');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeVisible();
  });
});
