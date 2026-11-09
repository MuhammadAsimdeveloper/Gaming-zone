import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

const SAVE_KEY = 'neonrift:game:neon-coast:save';

interface MinimapPoint {
  x: number;
  y: number;
}

interface MinimapState {
  player: MinimapPoint;
  target: MinimapPoint | null;
}

const COURIER_OBJECTIVE = /Collect the tideglass at Tideglass Market/;
const DELIVERY_OBJECTIVE = /Deliver the tideglass to Coral Radio Tower/;

async function startCourier(page: Page): Promise<void> {
  await page.goto('/game/neon-coast');
  await expect(page.getByRole('heading', { name: 'Neon Coast: After Hours', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Start Tideglass Courier' }).click();
  await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
}

function hudStat(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('..');
}

async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of [...keys].reverse()) await page.keyboard.up(key);
}

/**
 * Reads the minimap canvas the same way a player does. The district is drawn
 * at 132x110 with a 0.047 scale and an 8/9.6 unit letterbox; the white dot is
 * the person on foot and the coral ring is the active objective.
 */
function minimapState(page: Page): Promise<MinimapState | null> {
  return page.evaluate(() => {
    const canvas = document.querySelectorAll('canvas')[1] as HTMLCanvasElement | undefined;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    const dpr = canvas.width / 132;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let playerX = 0;
    let playerY = 0;
    let playerCount = 0;
    let targetX = 0;
    let targetY = 0;
    let targetCount = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index]!;
      const g = pixels[index + 1]!;
      const b = pixels[index + 2]!;
      const pixel = index / 4;
      const mapX = (pixel % canvas.width) / dpr;
      const mapY = Math.floor(pixel / canvas.width) / dpr;
      if (r > 240 && g > 240 && b > 240) {
        playerX += mapX;
        playerY += mapY;
        playerCount += 1;
      } else if (r > 200 && g >= 120 && g <= 210 && b <= 140) {
        targetX += mapX;
        targetY += mapY;
        targetCount += 1;
      }
    }
    if (playerCount === 0) return null;
    const toWorldX = (mapX: number) => (mapX - 9.6) / 0.047;
    const toWorldY = (mapY: number) => (mapY - 8) / 0.047;
    return {
      player: { x: toWorldX(playerX / playerCount), y: toWorldY(playerY / playerCount) },
      target:
        targetCount > 0 ? { x: toWorldX(targetX / targetCount), y: toWorldY(targetY / targetCount) } : null,
    };
  });
}

async function currentMinimap(page: Page): Promise<MinimapState> {
  await expect.poll(() => minimapState(page), { timeout: 10_000 }).not.toBeNull();
  const state = await minimapState(page);
  if (!state) throw new Error('Minimap has no player marker');
  return state;
}

/** Walks to a world waypoint using only real key events plus the minimap. */
async function walkTo(page: Page, waypoint: MinimapPoint, tolerance = 45): Promise<void> {
  const deadline = Date.now() + 25_000;
  let last: MinimapState | null = null;
  while (Date.now() < deadline) {
    last = await minimapState(page);
    if (!last) {
      await page.waitForTimeout(120);
      continue;
    }
    const dx = waypoint.x - last.player.x;
    const dy = waypoint.y - last.player.y;
    if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) return;
    const [key, delta] =
      Math.abs(dx) > tolerance ? [dx > 0 ? 'd' : 'a', dx] : [dy > 0 ? 's' : 'w', dy];
    const ms = Math.min(600, Math.max(180, (Math.abs(delta) / 175) * 1000));
    await hold(page, ['Shift', key], ms);
  }
  throw new Error(`Waypoint ${waypoint.x},${waypoint.y} not reached; last ${JSON.stringify(last)}`);
}

async function nudgeUntil(page: Page, matcher: RegExp, key: string, label: string): Promise<void> {
  const found = page.getByText(matcher).first();
  for (let attempt = 0; attempt < 14; attempt += 1) {
    if (await found.isVisible()) return;
    await hold(page, ['Shift', key], 200);
  }
  await expect(found, label).toBeVisible({ timeout: 10_000 });
}

test.describe('Neon Coast: After Hours', () => {
  test('launch shows the briefing and an understandable objective within fifteen seconds', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/game/neon-coast');

    await expect(page.getByRole('dialog', { name: 'Mission select' })).toBeVisible();
    await expect(page.getByText(/15-second briefing/i)).toBeVisible();
    await expect(page.getByText(/browser-local/).first()).toBeVisible();
    for (const name of ['Tideglass Courier', 'Lantern Circuit', 'Landmark Trail', 'Glow Run']) {
      await expect(page.getByRole('button', { name: `Start ${name}` })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Start Tideglass Courier' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start Lantern Circuit' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start Landmark Trail' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start Glow Run' })).toBeDisabled();

    await page.getByRole('button', { name: 'Start Tideglass Courier' }).click();
    await expect(page.getByText(COURIER_OBJECTIVE).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    await expect(page.getByText('On foot', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Walk joystick' })).toBeHidden();
    await expect(page.locator('canvas').first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('walking with real keys moves the minimap marker and closes the distance', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);
    const before = await currentMinimap(page);
    const startDistance = await readDistance(page);

    await hold(page, ['Shift', 'a'], 700);
    await expect
      .poll(async () => (await currentMinimap(page)).player.x, { timeout: 5000 })
      .toBeLessThan(before.player.x - 30);
    await expect.poll(() => readDistance(page), { timeout: 5000 }).toBeLessThan(startDistance);
    expectNoErrors(errors);
  });

  test('the Vela can be entered, driven and left with real keys', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);
    const distanceOnFoot = await readDistance(page);

    await page.keyboard.press('e');
    await expect(page.getByText('E — step out')).toBeVisible();
    await expect(page.getByText(/^\d+ km\/h$/)).toHaveText('0 km/h');

    await hold(page, ['w'], 1600);
    await expect.poll(async () => readSpeed(page), { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(() => readDistance(page), { timeout: 5000 }).toBeLessThan(distanceOnFoot);

    await page.keyboard.press('e');
    await expect(page.getByText('On foot', { exact: true })).toBeVisible();
    expectNoErrors(errors);
  });

  test('Tideglass Courier completes on foot with real input and persists browser-local progress', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const errors = collectErrors(page);
    await startCourier(page);
    await expect(page.getByText(COURIER_OBJECTIVE).first()).toBeVisible({ timeout: 15_000 });

    // Road-grid route: garage forecourt -> coast road -> 860 avenue -> 760 cross
    // street -> market -> back to the cross street -> tower avenue -> tower.
    await walkTo(page, { x: 1150, y: 1780 });
    await walkTo(page, { x: 860, y: 1780 });
    await walkTo(page, { x: 860, y: 760 });
    await walkTo(page, { x: 560, y: 760 });
    await walkTo(page, { x: 560, y: 560 });
    await nudgeUntil(page, DELIVERY_OBJECTIVE, 'w', 'courier pickup');

    await walkTo(page, { x: 560, y: 760 });
    await walkTo(page, { x: 1160, y: 760 });
    await walkTo(page, { x: 1160, y: 950 });

    const results = page.getByRole('dialog', { name: 'Mission results' });
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(results.getByText('Tideglass Courier complete')).toBeVisible();
    await expect(results.getByText('+450', { exact: true })).toBeVisible();
    await expect(results.getByText(/Rank Local/)).toBeVisible();
    await expect(results.getByText(/new personal best/)).toBeVisible();

    const save = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, unknown>,
      SAVE_KEY,
    );
    expect(save).toMatchObject({ version: 1, cash: 450, completed: ['tideglass-courier'] });
    expect((save.bestTimes as Record<string, number>)['tideglass-courier']).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Mission select' })).toBeVisible();
    await expect(hudStat(page, 'Cash').getByText('$450', { exact: true })).toBeVisible();
    await expect(hudStat(page, 'Rank').getByText('Local', { exact: true })).toBeVisible();
    await expect(page.getByText('1/4', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Lantern Circuit' })).toBeEnabled();
    expectNoErrors(errors);
  });

  test('pause, resume and restart keep the run controllable', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);

    await page.keyboard.press('Escape');
    const paused = page.getByRole('dialog', { name: 'Coast paused' });
    await expect(paused).toBeVisible();
    await expect(paused.getByText('Tideglass Courier')).toBeVisible();
    await page.getByRole('button', { name: 'Resume drive' }).click();
    await expect(paused).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause game' }).click();
    await expect(paused).toBeVisible();
    await page.getByRole('button', { name: 'Restart mission' }).click();
    await expect(paused).toBeHidden();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    await expect(page.getByText(/^1:(3\d|40)$/)).toBeVisible();
    expectNoErrors(errors);
  });

  test('a corrupt save is discarded and the slice still runs', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify({ version: 9, cash: -50, completed: ['nope'] }));
    }, SAVE_KEY);

    await page.goto('/game/neon-coast');
    await expect(page.getByRole('dialog', { name: 'Mission select' })).toBeVisible();
    await expect(hudStat(page, 'Cash').getByText('$0', { exact: true })).toBeVisible();
    await expect(hudStat(page, 'Rank').getByText('Newcomer', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Start Tideglass Courier' }).click();
    await expect(page.getByText(COURIER_OBJECTIVE).first()).toBeVisible({ timeout: 15_000 });
    expectNoErrors(errors);
  });

  test('resizing the viewport keeps the playfield sized', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);
    const canvas = page.locator('canvas').first();

    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
    const sized = await canvas.evaluate(
      (element) => (element as HTMLCanvasElement).width > 0 && (element as HTMLCanvasElement).height > 0,
    );
    expect(sized, 'canvas keeps a backing size after resize').toBe(true);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('fullscreen toggles without breaking the run', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);

    // The shell chrome also exposes a fullscreen toggle; the game's own button
    // carries a title attribute and is the one under test.
    await page.locator('button[title="Enter fullscreen"]').click();
    const entered = await page.evaluate(() => document.fullscreenElement !== null);
    if (!entered) {
      // Headless Chromium can refuse element fullscreen without a window
      // manager; the run must still be playable and error-free either way.
      await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    } else {
      await expect(page.locator('button[title="Exit fullscreen"]')).toBeVisible();
      await page.locator('button[title="Exit fullscreen"]').click();
      await expect
        .poll(() => page.evaluate(() => document.fullscreenElement === null), { timeout: 5000 })
        .toBe(true);
    }
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('leaving the route disposes the run and returning starts clean', async ({ page }) => {
    const errors = collectErrors(page);
    await startCourier(page);
    await page.waitForTimeout(800);

    await page.goto('/games');
    await expect(page.getByRole('heading', { name: /All games/i })).toBeVisible();
    await page.goto('/game/neon-coast');
    await expect(page.getByRole('dialog', { name: 'Mission select' })).toBeVisible();
    await page.getByRole('button', { name: 'Start Tideglass Courier' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('Neon Coast on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('touch controls are visible, 44 px and drive the Vela', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await startCourier(page);

    const joystick = page.getByRole('button', { name: 'Walk joystick' });
    await expect(joystick).toBeVisible();
    const joystickBox = await joystick.boundingBox();
    expect(joystickBox?.height ?? 0, 'joystick is at least 44 px').toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('button', { name: 'Sprint' })).toBeVisible();

    await page.getByRole('button', { name: 'Drive the Vela' }).click();
    const labels = ['Steer left', 'Steer right', 'Drift', 'Brake', 'Accelerate', 'Step out of the Vela'];
    for (const label of labels) {
      const control = page.getByRole('button', { name: label });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box?.width ?? 0, `${label} is at least 44 px`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${label} is at least 44 px tall`).toBeGreaterThanOrEqual(44);
    }

    const accelerate = page.getByRole('button', { name: 'Accelerate' });
    const box = (await accelerate.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1400);
    await page.mouse.up();
    await expect.poll(async () => readSpeed(page), { timeout: 5000 }).toBeGreaterThan(0);
    expectNoErrors(errors);
  });
});

async function readDistance(page: Page): Promise<number> {
  const text = await page.getByText(/· \d+ m/).first().textContent();
  const match = /·\s*(\d+)\s*m/.exec(text ?? '');
  if (!match) throw new Error(`No distance in "${text ?? ''}"`);
  return Number(match[1]);
}

async function readSpeed(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ km\/h$/).textContent();
  return Number((text ?? '').replace(/\D/g, ''));
}
