import { expect, test } from '@playwright/test';

test.describe('Rift Chess', () => {
  test('loads from the public catalogue and supports legal moves, undo and 320px layout', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/new');
    await page.getByRole('link', { name: /Rift Chess/ }).first().click();

    await expect(page.getByRole('heading', { name: 'Rift Chess' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Play local game', exact: true }).click();
    const board = page.getByRole('grid', { name: 'Rift Chess board' });
    await expect(board).toBeVisible();
    await expect(board.getByRole('row')).toHaveCount(8);
    await expect(board.getByRole('gridcell')).toHaveCount(64);

    await page.locator('[data-square="e2"]').click();
    await expect(page.locator('[data-square="e4"]')).toHaveAttribute('data-legal-target', 'true');
    await page.locator('[data-square="e4"]').click();
    await expect(page.getByText('Black to move', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('e4', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Undo move', exact: true }).click();
    await expect(page.locator('[aria-label="e2, white pawn"]')).toBeVisible();
    await expect(page.getByText('White to move', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('computer mode responds after the human move', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/game/rift-chess');
    await page.getByRole('button', { name: 'vs Computer' }).click();
    await page.getByRole('button', { name: 'Play computer game', exact: true }).click();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();

    await expect(page.getByText('White to move', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('aside li').first()).toContainText('e4');
    await expect(page.locator('aside li').first().locator('span').nth(2)).not.toBeEmpty();
    expect(errors).toEqual([]);
  });

  test('timed local games save and resume from the browser', async ({ page }) => {
    await page.goto('/game/rift-chess');
    await page.getByRole('button', { name: '5 min', exact: true }).click();
    await page.getByRole('button', { name: 'Play local game', exact: true }).click();
    await expect(page.getByText('White clock')).toBeVisible();
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('neonrift:rift-chess:save:v1'))).not.toBeNull();

    await page.getByRole('button', { name: 'Back to setup' }).click();
    await page.getByRole('button', { name: 'Resume saved game', exact: true }).click();
    await expect(page.getByText('Black to move')).toBeVisible();
    await expect(page.getByText('e4', { exact: true })).toBeVisible();
  });
});
