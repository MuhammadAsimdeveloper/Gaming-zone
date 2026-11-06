import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

test.describe('lawn protocol', () => {
  test('deploys level one, plants, shovels and pauses', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/lawn-protocol');
    await expect(page.getByRole('heading', { name: 'Lawn Protocol', level: 1 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Level 1: First Light' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Level 2: Sidewalk Shuffle' })).toBeDisabled();

    await page.getByRole('button', { name: 'Deploy level' }).click();
    await expect(page.getByRole('button', { name: 'Pause defense' })).toBeVisible();

    await page.getByRole('button', { name: 'Select Photofern, 50 light' }).click();
    await page.getByRole('button', { name: 'Lane 1 column 1, empty' }).click();
    await expect(page.getByRole('button', { name: 'Lane 1 column 1, Photofern' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Photofern planted' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause defense' }).click();
    await expect(page.getByRole('button', { name: 'Resume defense' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume defense' }).click();
    await expect(page.getByRole('button', { name: 'Pause defense' })).toBeVisible();

    await page.getByRole('button', { name: 'Shovel mode' }).click();
    // A Photofern can drop a light token on its own cell; collect it, then shovel.
    await expect(async () => {
      if (await page.getByRole('button', { name: 'Lane 1 column 1, empty' }).count()) return;
      await page.getByRole('button', { name: 'Lane 1 column 1, Photofern' }).click();
      await expect(page.getByRole('button', { name: 'Lane 1 column 1, empty' })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 8000, intervals: [250] });
    await expect(page.getByRole('status').filter({ hasText: '25 light' })).toBeVisible();

    expectNoErrors(errors);
  });

  test('starts endless defense and changes simulation speed', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/lawn-protocol');
    await page.getByRole('button', { name: 'Endless defense' }).click();
    await page.getByRole('button', { name: 'Start endless' }).click();

    await expect(page.getByRole('button', { name: 'Pause defense' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Endless defense' })).toBeVisible();

    await page.getByRole('button', { name: 'Set speed to 2x' }).click();
    await expect(page.getByRole('button', { name: 'Set speed to 1x' })).toBeVisible();

    expectNoErrors(errors);
  });
});
