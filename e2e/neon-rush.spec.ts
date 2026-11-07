import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const RECORDS_KEY = 'neonrift:game:neon-rush:records:v1';

test.describe('neon rush', () => {
  test('boots a time attack, runs the clock and pauses with the keyboard', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/game/neon-rush');
    await expect(page.getByRole('heading', { name: 'Neon Rush', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: /Time attack/ }).click();
    await page.getByRole('button', { name: 'Start time attack' }).click();

    await expect(page.getByRole('button', { name: 'Pause run' })).toBeVisible();
    await expect(page.getByText(/^1:5\d$/)).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press('KeyP');
    await expect(page.getByText('Run paused')).toBeVisible();
    await page.keyboard.press('KeyP');
    await expect(page.getByText('Run paused')).toBeHidden();

    await page.getByRole('button', { name: 'Back to run setup' }).click();
    await expect(page.getByRole('button', { name: 'Start time attack' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('exposes touch controls and survives rapid lane changes', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/game/neon-rush');
    // Time attack keeps the run alive through crashes, so the whole rapid-input
    // sequence lands while the touch pad is interactive instead of racing the
    // endless-mode game-over overlay.
    await page.getByRole('button', { name: /Time attack/ }).click();
    await page.getByRole('button', { name: 'Start time attack' }).click();

    const left = page.getByRole('button', { name: 'Left' });
    const right = page.getByRole('button', { name: 'Right' });
    const jump = page.getByRole('button', { name: 'Jump' });
    const roll = page.getByRole('button', { name: 'Roll' });
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    await expect(jump).toBeVisible();
    await expect(roll).toBeVisible();

    await page.waitForTimeout(3_500);
    for (let index = 0; index < 4; index += 1) {
      await left.click();
      await right.click();
      await jump.click();
      await roll.click();
    }

    await expect(page.getByRole('button', { name: 'Pause run' })).toBeEnabled();
    expectNoErrors(errors);
  });

  test('shows browser-local records from storage', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ version: 1, bestScore: 12345, bestDistance: 2400, bestShards: 99, runs: 12 }),
      );
    }, RECORDS_KEY);

    await page.goto('/game/neon-rush');
    await expect(page.getByText('12,345')).toBeVisible();
    await expect(page.getByText(/Browser-local bests/i)).toBeVisible();
    expectNoErrors(errors);
  });
});
