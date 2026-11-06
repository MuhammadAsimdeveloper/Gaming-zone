import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

test.describe('rift chess', () => {
  test('plays the opening by keyboard and mouse in two-player mode', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');
    await expect(page.getByRole('heading', { name: 'Rift Chess', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: '2 players', exact: true }).click();

    await page.locator('[data-square="e2"]').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', 'e4, white pawn');
    await expect(page.getByText('1 plies')).toBeVisible();

    await move(page, 'e7', 'e5');
    await expect(page.locator('[data-square="e5"]')).toHaveAttribute('aria-label', 'e5, black pawn');
    await expect(page.getByText('2 plies')).toBeVisible();
    await expect(page.getByText('White to move.')).toBeVisible();

    expectNoErrors(errors);
  });

  test('undoes the last local move', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');
    await page.getByRole('button', { name: '2 players', exact: true }).click();

    await move(page, 'e2', 'e4');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();

    await expect(page.locator('[data-square="e2"]')).toHaveAttribute('aria-label', 'e2, white pawn');
    await expect(page.getByText('No moves yet.')).toBeVisible();
    expectNoErrors(errors);
  });

  test('promotes a pawn through the chooser', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');
    await page.getByRole('button', { name: '2 players', exact: true }).click();

    await move(page, 'a2', 'a4');
    await move(page, 'b8', 'c6');
    await move(page, 'a4', 'a5');
    await move(page, 'g8', 'f6');
    await move(page, 'a5', 'a6');
    await move(page, 'f6', 'g8');
    await move(page, 'a6', 'b7');
    await move(page, 'g8', 'f6');
    await move(page, 'b7', 'b8');

    await expect(page.getByText('Promote to')).toBeVisible();
    await page.getByRole('button', { name: 'Promote to white queen' }).click();
    await expect(page.locator('[data-square="b8"]')).toHaveAttribute('aria-label', 'b8, white queen');
    expectNoErrors(errors);
  });

  test('resumes a saved computer game after a reload', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');

    await move(page, 'e2', 'e4');
    await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', 'e4, white pawn');
    await expect(page.getByText('2 plies')).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByText('Saved game restored')).toBeVisible();
    await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', 'e4, white pawn');
    expectNoErrors(errors);
  });

  test('solves the first original puzzle', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');
    await page.getByRole('button', { name: 'Puzzles', exact: true }).click();

    await expect(page.getByText('Back-rank finish', { exact: true })).toBeVisible();
    await move(page, 'f2', 'f8');

    await expect(page.getByText('Puzzle solved', { exact: true })).toBeVisible();
    await expect(page.getByText(/1 of 40 solved/).first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('keeps the board usable at 320 px', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/game/rift-chess');

    const board = page.getByRole('grid', { name: /Chess board/ });
    await expect(board).toBeVisible();
    await expect(page.locator('[role="gridcell"]')).toHaveCount(64);

    const width = await board.evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(320);
    expect(width).toBeGreaterThan(240);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', 'e4, white pawn');
    expectNoErrors(errors);
  });

  test('mutes and restores sound cues', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/rift-chess');

    await page.getByRole('button', { name: 'Mute sound' }).click();
    await expect(page.getByRole('button', { name: 'Enable sound' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Enable sound' }).click();
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'false');
    expectNoErrors(errors);
  });
});
