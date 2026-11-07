import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

async function createWorld(page: Page, name: string, seed: string): Promise<void> {
  await page.getByRole('button', { name: 'Create world' }).first().click();
  await page.getByLabel('World name').fill(name);
  await page.getByLabel('Seed (optional)').fill(seed);
  await page.getByRole('button', { name: 'Create and enter' }).click();
}

test.describe('neon craft world lifecycle', () => {
  test('creates, plays, crafts, saves and resumes a world', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.goto('/game/neon-craft');
    await expect(page.getByRole('heading', { name: 'Neon Craft', level: 2 })).toBeVisible();
    await createWorld(page, 'Rift QA', 'rift-qa-seed');

    await expect(page.getByRole('heading', { name: 'World paused' })).toBeVisible({
      timeout: 40_000,
    });

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const sized = await canvas.evaluate(
      (element) => (element as HTMLCanvasElement).width > 0 && (element as HTMLCanvasElement).height > 0,
    );
    expect(sized, 'the voxel canvas has a render size').toBe(true);

    await page.getByRole('button', { name: 'Sound is on' }).click();
    await expect(page.getByRole('button', { name: 'Sound is muted' })).toBeVisible();
    await page.getByRole('button', { name: 'Sound is muted' }).click();
    await expect(page.getByRole('button', { name: 'Sound is on' })).toBeVisible();

    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'World paused' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause world' })).toBeVisible();

    await page.keyboard.press('e');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByText('33 recipes · press E while playing to reopen this bag.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Storage slot 1: empty' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hotbar slot 1: empty' }).last()).toBeVisible();

    await page.getByRole('button', { name: 'Crafting', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Crafting' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hand', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Craft Workbench' })).toBeDisabled();

    await page.getByRole('button', { name: 'Workbench', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Craft Stone Pickaxe' })).toBeDisabled();

    await page.getByRole('button', { name: 'Kiln', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Craft Glass' })).toBeDisabled();

    await page.getByRole('button', { name: 'Back to world' }).click();
    await expect(page.getByRole('button', { name: 'Pause world' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'World paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and quit' }).click();

    await expect(page.getByRole('heading', { name: 'Worlds', level: 3 })).toBeVisible();
    await expect(page.getByText('Rift QA', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('Rift QA', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'World paused' })).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText(/Rift QA/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Save and quit' }).click();
    await page.getByRole('button', { name: 'Delete world in slot 1' }).click();
    await page.getByRole('button', { name: 'Yes, delete world' }).click();
    await expect(page.getByText('Rift QA', { exact: true })).toHaveCount(0);
    await expect(page.getByText('A fresh seeded world.').first()).toBeVisible();

    expectNoErrors(errors);
  });

  test('falls back to an unsaved world when IndexedDB is unavailable', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined });
    });

    await page.goto('/game/neon-craft');
    await expect(page.getByText('Saving is unavailable in this browser.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create world' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Start unsaved world' }).click();
    await expect(page.getByRole('heading', { name: 'World paused' })).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByText(/Unsaved world/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Save and quit' }).click();
    await expect(page.getByText('Saving is unavailable in this browser.')).toBeVisible();

    expectNoErrors(errors);
  });
});

test.describe('neon craft on touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('exposes a stick, look pad and action buttons', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.goto('/game/neon-craft');
    await createWorld(page, 'Touch Rift', 'touch-seed');

    await expect(page.getByRole('button', { name: 'Pause world' })).toBeVisible({
      timeout: 40_000,
    });
    await expect(page.getByRole('group', { name: 'Movement stick' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Look area/ })).toBeVisible();
    for (const label of ['Inventory', 'Sneak', 'Sprint', 'Place block or use item', 'Mine or attack', 'Jump']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Jump', exact: true }).click();
    await page.getByRole('button', { name: 'Inventory', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to world' }).click();
    await expect(page.getByRole('button', { name: 'Pause world' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause world' }).click();
    await expect(page.getByRole('heading', { name: 'World paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Save and quit' }).click();
    await expect(page.getByRole('heading', { name: 'Worlds', level: 3 })).toBeVisible();

    expectNoErrors(errors);
  });
});