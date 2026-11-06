import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const RECORDS_KEY = 'neonrift:game:hoop-circuit:records:v1';
const SETTINGS_KEY = 'neonrift:game:hoop-circuit:settings:v1';

test.describe('hoop circuit', () => {
  test('tips off, runs the clock and pauses with the keyboard', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/game/hoop-circuit');
    await expect(page.getByRole('heading', { name: 'Hoop Circuit', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Tip off' }).click();
    await expect(page.getByRole('button', { name: 'Shoot' })).toBeEnabled();
    await expect(page.getByText(/^[01]:\d\d$/).first()).toBeVisible();
    await expect(page.getByText(/^0:5\d$/).first()).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Shoot' })).toBeDisabled();

    await page.keyboard.press('KeyP');
    await expect(page.getByText('Game paused')).toBeVisible();
    await page.keyboard.press('KeyP');
    await expect(page.getByText('Game paused')).toBeHidden();

    await page.getByRole('button', { name: 'Back to setup' }).click();
    await expect(page.getByRole('button', { name: 'Tip off' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('exposes aim, power and shoot controls that survive rapid input', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/game/hoop-circuit');
    await page.getByRole('button', { name: 'Tip off' }).click();

    const aimUp = page.getByRole('button', { name: 'Aim up' });
    const aimDown = page.getByRole('button', { name: 'Aim down' });
    const morePower = page.getByRole('button', { name: 'More power' });
    const lessPower = page.getByRole('button', { name: 'Less power' });
    await expect(aimUp).toBeEnabled();
    await expect(aimDown).toBeEnabled();
    await expect(morePower).toBeEnabled();
    await expect(lessPower).toBeEnabled();

    for (let index = 0; index < 3; index += 1) {
      await aimUp.click();
      await aimDown.click();
      await morePower.click();
      await lessPower.click();
    }

    await page.getByRole('button', { name: 'Shoot' }).click();
    await expect(page.getByRole('button', { name: 'Shoot' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('shows browser-local records and persists rim difficulty', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(
      ({ recordsKey, settingsKey }) => {
        window.localStorage.setItem(
          recordsKey,
          JSON.stringify({ version: 1, bestScore: 41, bestStreak: 5, games: 6, makes: 30, shots: 52, streak: 0 }),
        );
        window.localStorage.setItem(settingsKey, JSON.stringify({ version: 1, difficulty: 'allstar', muted: true }));
      },
      { recordsKey: RECORDS_KEY, settingsKey: SETTINGS_KEY },
    );

    await page.goto('/game/hoop-circuit');
    await expect(page.getByText(/30 makes on 52 shots/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'All-Star' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Unmute audio' })).toBeVisible();
    expectNoErrors(errors);
  });
});
