import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

test.describe('3D games accept real input', () => {
  test.describe.configure({ timeout: 150_000 });

  test('Apex Time Trial accelerates on a real throttle press', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/apex-time-trial');
    await page.getByRole('button', { name: 'Start time trial', exact: true }).click();
    await expect(page.locator('p[aria-label="Current speed 0 kilometres per hour"]')).toBeVisible();
    await expect(page.getByText('Ready')).toBeHidden({ timeout: 8000 });

    await page.keyboard.down('KeyW');
    await expect
      .poll(
        async () => {
          const label = await page.locator('p[aria-label^="Current speed"]').getAttribute('aria-label');
          return Number(label?.match(/(\d+) kilometres/)?.[1] ?? 0);
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);
    await page.keyboard.up('KeyW');

    expectNoErrors(errors);
  });

  test('Neon City Drive reaches a real gate and restarts cleanly', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/neon-city-drive');
    await page.getByRole('button', { name: 'Start drive', exact: true }).click();
    await expect(page.locator('canvas[aria-label^="Neon City Drive"]')).toBeVisible();
    await expect(page.getByText('Engine hot')).toBeVisible();
    // Headless Chromium renders through software WebGL at ~5 fps, and the
    // engine clamps each frame to 50 ms, so game time runs well behind the
    // wall clock. These waits are generous for that environment only.
    await expect(page.getByText('Engine hot')).toBeHidden({ timeout: 45_000 });

    const minimap = page.locator('svg[aria-label="City minimap with your car, traffic and the next gate"] g[transform]');
    const before = await minimap.getAttribute('transform');

    await page.keyboard.down('KeyW');
    await expect.poll(async () => minimap.getAttribute('transform'), { timeout: 20_000 }).not.toBe(before);
    await expect(page.getByText(/^Gate 2/)).toBeVisible({ timeout: 60_000 });
    await page.keyboard.up('KeyW');

    await page.getByRole('button', { name: 'Pause drive' }).click();
    await expect(page.getByRole('dialog', { name: 'Drive paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause drive' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause drive' }).click();
    await page.getByRole('button', { name: 'Restart run' }).click();
    await expect(page.getByRole('button', { name: 'Pause drive' })).toBeVisible();
    await expect(page.getByText('Engine hot')).toBeVisible();

    expectNoErrors(errors);
  });

  test('the 3D mute choice survives a page reload', async ({ page }) => {
    await page.goto('/game/neon-city-drive');
    await page.getByRole('button', { name: 'Start drive', exact: true }).click();
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Start drive', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();
  });
});
