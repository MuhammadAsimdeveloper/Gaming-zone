import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const RECORDS_KEY = 'neonrift:game:penalty-protocol:records:v1';
const SETTINGS_KEY = 'neonrift:game:penalty-protocol:settings:v1';

test.describe('penalty protocol', () => {
  test('takes a keyboard kick, then hands the turn to the CPU keeper', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto('/game/penalty-protocol');
    await expect(page.getByRole('heading', { name: 'Penalty Protocol', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Start shootout' }).click();
    await expect(page.getByRole('button', { name: 'Shoot top left' })).toBeEnabled();
    await page.keyboard.press('KeyQ');

    const history = page.getByRole('list', { name: 'Kick history' });
    await expect(history.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Dive top left' })).toBeEnabled({ timeout: 10_000 });

    await page.keyboard.press('KeyS');
    await expect(history.getByRole('listitem')).toHaveCount(2);
    expectNoErrors(errors);
  });

  test('remembers keeper difficulty across reloads', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/penalty-protocol');
    await page.getByRole('button', { name: 'Elite' }).click();
    await expect(page.getByRole('button', { name: 'Elite' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('button', { name: 'Elite' })).toHaveAttribute('aria-pressed', 'true');
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY);
    expect(stored).toContain('elite');
    expectNoErrors(errors);
  });

  test('shows browser-local records from storage', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          wins: 3,
          losses: 1,
          bestScore: 960,
          bestSaves: 4,
          streak: 2,
          bestStreak: 3,
          shootouts: 4,
        }),
      );
    }, RECORDS_KEY);

    await page.goto('/game/penalty-protocol');
    await expect(page.getByText('3–1')).toBeVisible();
    await expect(page.getByText('960')).toBeVisible();
    await expect(page.getByText(/4 shootouts played/i)).toBeVisible();
    expectNoErrors(errors);
  });
});
