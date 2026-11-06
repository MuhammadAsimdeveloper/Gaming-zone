import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const RECORDS_KEY = 'neonrift:game:apex-time-trial:records:v1';
const GHOST_KEY = 'neonrift:game:apex-time-trial:ghost:v1:rift-loop:rift-gt';

test.describe('apex time trial', () => {
  test('arms the clock, pauses from the keyboard and returns to setup', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.goto('/game/apex-time-trial');
    await expect(page.getByRole('heading', { name: 'Apex Time Trial', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Start time trial', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause time trial' })).toBeVisible();
    // Software WebGL can take a while to finish the 1.2 s countdown in CI.
    await expect(page.getByText('Cross the start line to begin')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('0:00.00')).toBeVisible();

    await page.keyboard.press('KeyP');
    await expect(page.getByRole('heading', { name: 'Time trial paused' })).toBeVisible();
    await page.keyboard.press('KeyP');
    await expect(page.getByRole('heading', { name: 'Time trial paused' })).toBeHidden();

    await page.getByRole('button', { name: 'Pause time trial' }).click();
    await page.getByRole('button', { name: 'Change setup' }).click();
    await expect(page.getByRole('button', { name: 'Start time trial' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('shows browser-local personal bests and ghosts from storage', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(
      ({ recordsKey, ghostKey }) => {
        window.localStorage.setItem(
          recordsKey,
          JSON.stringify({
            version: 1,
            runs: 4,
            best: {
              'rift-loop:rift-gt': {
                time: 62.3,
                medal: 'silver',
                splits: [10, 20, 30, 40, 50, 62.3],
                setAt: '2026-11-06T12:00:00.000Z',
              },
            },
          }),
        );
        window.localStorage.setItem(
          ghostKey,
          JSON.stringify({
            version: 1,
            trackId: 'rift-loop',
            carId: 'rift-gt',
            time: 42.5,
            splits: [10, 20, 30, 35, 40, 42.5],
            samples: [
              { t: 0, x: 0, z: 0, heading: 0, speed: 0 },
              { t: 0.05, x: 1, z: 2, heading: 0.1, speed: 14 },
            ],
          }),
        );
      },
      { recordsKey: RECORDS_KEY, ghostKey: GHOST_KEY },
    );

    await page.goto('/game/apex-time-trial');
    await expect(page.getByText('PB 1:02.30')).toBeVisible();
    await expect(page.getByText('Ghost ready · 0:42.50')).toBeVisible();
    await expect(page.getByText('1:02.30').first()).toBeVisible();

    await page.getByRole('button', { name: 'Clear saved ghost' }).click();
    await expect(page.getByText('No ghost yet')).toBeVisible();
    const cleared = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      GHOST_KEY,
    );
    expect(cleared).toBeNull();
    expectNoErrors(errors);
  });
});

test.describe('apex time trial on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('exposes on-screen steering, drift and pedals', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/apex-time-trial');
    await page.getByRole('button', { name: 'Start time trial', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Steer left' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Steer right' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Handbrake', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Brake', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accelerate', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Pause time trial' })).toBeVisible();
    expectNoErrors(errors);
  });
});
