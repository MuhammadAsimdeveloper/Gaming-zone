import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors, GAMES } from './helpers';

test.describe('player shell and local preferences', () => {
  test('launch, pause, resume, visibility pause and restart a game', async ({ page }) => {
    const errors = collectErrors(page);

    await page.addInitScript(() => {
      let visibility = 'visible';
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => visibility,
      });
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => visibility === 'hidden',
      });
      (window as unknown as { __setVisibility: (value: string) => void }).__setVisibility = (
        value,
      ) => {
        visibility = value;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });

    // Rift Breaker keeps running while idle, so the visibility transition is deterministic.
    await page.goto('/game/rift-breaker');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();

    await page.getByRole('button', { name: 'Pause game' }).click();
    await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume game' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();

    await page.evaluate(() => {
      const toggle = (window as unknown as { __setVisibility: (value: string) => void })
        .__setVisibility;
      toggle('hidden');
    });
    await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();

    await page.getByRole('button', { name: 'Restart run' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('favorites survive a reload and appear in the favorites page', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/neon-snake');
    await page.getByRole('button', { name: 'Add Neon Snake to favorites' }).click();

    await page.reload();
    const remove = page.getByRole('button', { name: 'Remove Neon Snake from favorites' });
    await expect(remove).toBeVisible();
    await expect(remove).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/favorites');
    await expect(page.getByRole('link', { name: /Neon Snake/ }).first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('launching a game records it in recently played', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/neon-snake');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await page.goto('/recently-played');

    await expect(page.getByRole('heading', { name: /Recently played/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Neon Snake/ }).first()).toBeVisible();
    expectNoErrors(errors);
  });

  test('the player shell toggles fullscreen state', async ({ page }) => {
    const errors = collectErrors(page);

    await page.addInitScript(() => {
      let fullscreen: Element | null = null;
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreen,
      });
      Element.prototype.requestFullscreen = function requestFullscreen() {
        fullscreen = this;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
      Document.prototype.exitFullscreen = function exitFullscreen() {
        fullscreen = null;
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
    });

    await page.goto('/game/neon-snake');
    await page.getByRole('button', { name: 'Enter fullscreen' }).click();
    await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit fullscreen' }).click();
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
    expectNoErrors(errors);
  });
});

test.describe('all thirty games boot and accept input', () => {
  test.describe.configure({ timeout: 150_000 });

  for (const game of GAMES) {
    test(`${game.title} loads, starts and unmounts cleanly`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/game/${game.slug}`);
      await expect(page.getByRole('heading', { name: game.title, level: 1 })).toBeVisible();

      switch (game.slug) {
        case 'neon-snake':
          await page.getByRole('button', { name: 'Start run', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
          break;
        case 'tic-tac-toe': {
          const board = page.getByRole('group', { name: 'Tic-tac-toe board' });
          await expect(board).toBeVisible();
          await board.getByRole('button', { name: /Row 1, column 1/ }).click();
          await expect(board.getByRole('button', { name: /Row 1, column 1: .*X/ })).toBeVisible();
          break;
        }
        case 'memory-match':
          await expect(page.getByRole('button', { name: /Hidden card/ }).first()).toBeVisible();
          await page.getByRole('button', { name: /Hidden card 1$/ }).click();
          await expect(page.getByRole('button', { name: /face up/ }).first()).toBeVisible();
          break;
        case 'rock-paper-scissors':
          await page.getByRole('button', { name: /Throw Rock/ }).click();
          await expect(page.getByRole('button', { name: /Throw Rock/ })).toBeVisible();
          break;
        case 'reaction-time-challenge':
          await page.getByRole('button', { name: 'Start run', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Restart run' })).toBeVisible();
          break;
        case 'rift-breaker':
          await page.getByRole('button', { name: 'Start run', exact: true }).click();
          await page.getByRole('button', { name: 'Pause game' }).click();
          await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
          await page.getByRole('button', { name: 'Resume game' }).click();
          await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
          await page.getByRole('button', { name: 'Restart run' }).click();
          await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
          break;
        case 'math-sprint':
          await page.getByRole('button', { name: 'Start sprint', exact: true }).click();
          await expect(page.getByRole('button', { name: /^Answer / })).toHaveCount(4);
          break;
        case 'neon-apex':
          await page.getByRole('button', { name: 'Start race', exact: true }).click();
          await assertSizedCanvas(page);
          await assertMuteToggle(page);
          await pauseUntilPaused(page, 'Race paused');
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause race' })).toBeVisible();
          await pauseUntilPaused(page, 'Race paused');
          await page.getByRole('button', { name: 'Restart race' }).click();
          await expect(page.getByText('Get ready')).toBeVisible();
          break;
        case 'rift-striker':
          await page.getByRole('button', { name: 'Kick off', exact: true }).click();
          await assertSizedCanvas(page);
          await assertMuteToggle(page);
          await pauseUntilPaused(page, 'Match paused');
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause match' })).toBeVisible();
          await pauseUntilPaused(page, 'Match paused');
          await page.getByRole('button', { name: 'Restart match' }).click();
          break;
        case 'neon-city-drive':
          await page.getByRole('button', { name: 'Start drive', exact: true }).click();
          await assertSizedCanvas(page);
          await assertMuteToggle(page);
          await pauseUntilPaused(page, 'Drive paused');
          await page.getByRole('button', { name: 'Resume', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause drive' })).toBeVisible();
          await pauseUntilPaused(page, 'Drive paused');
          await page.getByRole('button', { name: 'Restart run' }).click();
          break;
        case 'neon-harvest':
          await page.getByRole('button', { name: 'Start season', exact: true }).click();
          await page.getByRole('button', { name: /^Plant Rift Lettuce in plot 1/ }).click();
          await expect(page.getByRole('button', { name: /^Water plot 1/ })).toBeVisible();
          break;
        case 'rift-transit':
          await page.getByRole('button', { name: 'Start service', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause service' })).toBeVisible();
          break;
        case 'grid-supply':
          await page.getByRole('button', { name: 'Start grid', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause grid' })).toBeVisible();
          break;
        case 'rift-colony':
          await page.getByRole('button', { name: 'Start colony', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause colony' })).toBeVisible();
          break;
        case 'orbit-market':
          await page.getByRole('button', { name: 'Start trading', exact: true }).click();
          await expect(page.getByText('Current dock', { exact: true })).toBeVisible();
          break;
        case 'neon-diner':
          await page.getByRole('button', { name: 'Open diner', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause service' })).toBeVisible();
          break;
        case 'skyport':
          await page.getByRole('button', { name: 'Start tower', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause tower' })).toBeVisible();
          break;
        case 'rift-hospital':
          await page.getByRole('button', { name: 'Open clinic', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause clinic' })).toBeVisible();
          break;
        case 'park-pulse':
          await page.getByRole('button', { name: 'Open park', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause park' })).toBeVisible();
          break;
        case 'factory-line':
          await page.getByRole('button', { name: 'Start line', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause line' })).toBeVisible();
          break;
        case 'cargo-ring':
          await page.getByRole('button', { name: 'Open depot', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause depot' })).toBeVisible();
          break;
        case 'aqua-grid':
          await page.getByRole('button', { name: 'Start grid', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause water grid' })).toBeVisible();
          break;
        case 'signal-stack':
          await page.getByRole('button', { name: 'Start stacking', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Drop', exact: true })).toBeEnabled();
          break;
        case 'rift-runner':
          await page.getByRole('button', { name: 'Start run', exact: true }).click();
          await expect(page.getByRole('button', { name: 'Pause run' })).toBeVisible();
          break;
        case 'rift-tactics':
          await page.getByRole('button', { name: 'Start battle', exact: true }).click();
          await page.getByRole('button', { name: /^Cell 1,5: squad Vanguard/ }).click();
          await page.getByRole('button', { name: /^Cell 1,4: empty/ }).click();
          await expect(page.getByRole('button', { name: /^Cell 1,4: squad Vanguard/ })).toBeVisible();
          break;
        case 'rift-chess':
          await expect(page.getByRole('grid', { name: /Chess board/ })).toBeVisible();
          await page.locator('[data-square="e2"]').click();
          await page.locator('[data-square="e4"]').click();
          await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', 'e4, white pawn');
          break;
        case 'neon-rush':
          await page.getByRole('button', { name: 'Start endless' }).click();
          await expect(page.getByRole('button', { name: 'Pause run' })).toBeVisible();
          await page.getByRole('button', { name: 'Pause run' }).click();
          await expect(page.getByRole('button', { name: 'Resume run' })).toBeVisible();
          await page.getByRole('button', { name: 'Resume run' }).click();
          break;
        case 'penalty-protocol':
          await page.getByRole('button', { name: 'Start shootout' }).click();
          await expect(page.getByRole('button', { name: 'Shoot top left' })).toBeEnabled();
          await page.getByRole('button', { name: 'Shoot top left' }).click();
          await expect(page.getByRole('list', { name: 'Kick history' }).getByRole('listitem')).toHaveCount(1);
          await page.getByRole('button', { name: 'Pause shootout' }).click();
          await expect(page.getByRole('button', { name: 'Resume shootout' })).toBeVisible();
          await page.getByRole('button', { name: 'Resume shootout' }).click();
          break;
        case 'hoop-circuit':
          await page.getByRole('button', { name: 'Tip off' }).click();
          await expect(page.getByRole('button', { name: 'Aim up' })).toBeEnabled();
          await expect(page.getByRole('button', { name: 'Shoot' })).toBeEnabled();
          await page.getByRole('button', { name: 'Shoot' }).click();
          await expect(page.getByRole('button', { name: 'Shoot' })).toBeDisabled();
          await page.getByRole('button', { name: 'Pause game' }).click();
          await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
          await page.getByRole('button', { name: 'Resume game' }).click();
          break;
        case 'lawn-protocol':
          await page.getByRole('button', { name: 'Deploy level' }).click();
          await expect(page.getByRole('button', { name: 'Pause defense' })).toBeVisible();
          await page.getByRole('button', { name: 'Select Photofern, 50 light' }).click();
          await page.getByRole('button', { name: 'Lane 3 column 2, empty' }).click();
          await expect(page.getByRole('button', { name: 'Lane 3 column 2, Photofern' })).toBeVisible();
          await page.getByRole('button', { name: 'Pause defense' }).click();
          await expect(page.getByRole('button', { name: 'Resume defense' })).toBeVisible();
          await page.getByRole('button', { name: 'Resume defense' }).click();
          break;
      }

      await page.waitForTimeout(600);
      await page.goto('/games');
      await expect(page.getByRole('heading', { name: /All games/i })).toBeVisible();
      expectNoErrors(errors);
    });
  }
});

test.describe('mobile input and hidden-tab fairness', () => {
  test('neon apex exposes working touch controls on a mobile viewport', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/game/neon-apex');
    await page.getByRole('button', { name: 'Start race', exact: true }).click();

    for (const label of ['Steer left', 'Steer right', 'Handbrake', 'Brake', 'Accelerate']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Accelerate', exact: true }).click();
    await page.getByRole('button', { name: 'Steer left', exact: true }).click();
    expectNoErrors(errors);
  });

  test('math sprint freezes the clock while the tab is hidden', async ({ page }) => {
    const errors = collectErrors(page);
    await stubVisibility(page);

    await page.goto('/game/math-sprint');
    await page.getByRole('button', { name: 'Start sprint', exact: true }).click();
    await expect(page.getByText(/\d+ seconds left/)).toBeVisible();

    const before = await readRemainingSeconds(page);
    await setVisibility(page, 'hidden');
    await page.waitForTimeout(2500);
    await setVisibility(page, 'visible');

    await expect
      .poll(() => readRemainingSeconds(page), { timeout: 2500 })
      .toBeGreaterThanOrEqual(before - 1);
    expectNoErrors(errors);
  });

  test('reaction time re-arms the round after the tab is hidden', async ({ page }) => {
    const errors = collectErrors(page);
    await stubVisibility(page);

    await page.goto('/game/reaction-time-challenge');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Wait for green/ })).toBeVisible();

    await setVisibility(page, 'hidden');
    await page.waitForTimeout(4000);
    await setVisibility(page, 'visible');

    await expect(page.getByRole('button', { name: /^Wait for green/ })).toBeVisible();
    await page.getByRole('button', { name: /^Wait for green/ }).click();
    await expect(page.getByText(/^False start — 500 ms/)).toBeVisible();
    expectNoErrors(errors);
  });
});

async function stubVisibility(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => visibility === 'hidden',
    });
    (window as unknown as { __setVisibility: (value: string) => void }).__setVisibility = (
      value,
    ) => {
      visibility = value;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
}

async function setVisibility(
  page: import('@playwright/test').Page,
  value: 'hidden' | 'visible',
): Promise<void> {
  await page.evaluate((state) => {
    const setter = (window as unknown as { __setVisibility: (value: string) => void })
      .__setVisibility;
    setter(state);
  }, value);
}

async function readRemainingSeconds(page: import('@playwright/test').Page): Promise<number> {
  const status = await page.getByText(/\d+ seconds left/).first().textContent();
  const match = status?.match(/(\d+) seconds left/);
  return match ? Number(match[1]) : -1;
}

async function assertSizedCanvas(page: import('@playwright/test').Page): Promise<void> {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(800);
  const sized = await canvas.evaluate(
    (element) => (element as HTMLCanvasElement).width > 0 && (element as HTMLCanvasElement).height > 0,
  );
  expect(sized, 'canvas has a render size').toBe(true);
}

async function assertMuteToggle(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Mute sound' }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible();
  await page.getByRole('button', { name: 'Unmute sound' }).click();
  await expect(page.getByRole('button', { name: 'Mute sound' })).toBeVisible();
}

async function pauseUntilPaused(
  page: import('@playwright/test').Page,
  pausedHeading: string,
): Promise<void> {
  await expect(async () => {
    const heading = page.getByRole('heading', { name: pausedHeading });
    if (await heading.isVisible()) return;
    await page.keyboard.press('p');
    await expect(heading).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000, intervals: [500] });
}

test.describe('game end states, keyboard and touch', () => {
  test('snake ends the run on a wall hit and restarts from the overlay', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/neon-snake');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();

    // No steering: the snake runs straight into the right wall.
    await expect(page.getByText('Run ended', { exact: true })).toBeVisible({ timeout: 6000 });
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('snake responds to keyboard steering and Space pause', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/game/neon-snake');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByText('Paused', { exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByText('Paused', { exact: true })).toBeHidden();
    expectNoErrors(errors);
  });

  test('snake on-screen direction pad works on a mobile viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/game/neon-snake');
    const pad = page.getByLabel('On-screen direction pad');
    await expect(pad).toBeVisible();
    await page.getByRole('button', { name: 'Start run', exact: true }).click();

    await pad.getByRole('button', { name: 'Move up' }).click();
    await pad.getByRole('button', { name: 'Pause game' }).click();
    await expect(pad.getByRole('button', { name: 'Resume game' })).toBeVisible();
    await pad.getByRole('button', { name: 'Resume game' }).click();
    await expect(pad.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('tic-tac-toe plays a full best-of-five match and rematches', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);

    await page.goto('/game/tic-tac-toe');
    await page.getByRole('button', { name: '2 players' }).click();

    async function playCell(row: number, column: number) {
      const cell = page.getByRole('button', {
        name: new RegExp(`^Row ${row}, column ${column}: empty$`),
      });
      await expect(cell).toBeEnabled({ timeout: 8000 });
      await cell.click();
    }

    // X takes the top row three times; O answers on the middle row.
    for (let round = 0; round < 3; round += 1) {
      await playCell(1, 1);
      await playCell(2, 1);
      await playCell(1, 2);
      await playCell(2, 2);
      await playCell(1, 3);
    }

    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible({ timeout: 6000 });
    await expect(page.getByText('Match complete', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Rematch' }).click();
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeHidden();
    await expect(
      page.getByRole('button', { name: /^Row 1, column 1: empty$/ }),
    ).toBeEnabled();
    expectNoErrors(errors);
  });

  test('reaction time completes all five rounds and offers another run', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);

    await page.goto('/game/reaction-time-challenge');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();

    for (let round = 1; round <= 5; round += 1) {
      const go = page.getByRole('button', { name: /^Green panel/ });
      await expect(go).toBeVisible({ timeout: 8000 });
      await go.click();
      await expect(page.getByRole('button', { name: /^Round result/ })).toBeVisible({
        timeout: 4000,
      });
    }

    await expect(page.getByText('Run complete', { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('rock paper scissors plays until the first to three and rematches', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.goto('/game/rock-paper-scissors');
    const matchBadge = page.getByText('Match complete', { exact: true });
    const rock = page.getByRole('button', { name: /Throw Rock/ });

    let throws = 0;
    while (!(await matchBadge.isVisible()) && throws < 30) {
      await expect(rock).toBeEnabled({ timeout: 3000 });
      await rock.click();
      throws += 1;
      await expect(async () => {
        if (await matchBadge.isVisible()) return;
        await expect(rock).toBeEnabled({ timeout: 1000 });
      }).toPass({ timeout: 6000, intervals: [100] });
    }

    await expect(matchBadge).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/First to three round wins/)).toBeVisible();
    await page.getByRole('button', { name: 'Rematch' }).click();
    await expect(matchBadge).toBeHidden();
    await expect(rock).toBeEnabled();
    expectNoErrors(errors);
  });

  test('memory match clears every pair and offers another game', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.goto('/game/memory-match');
    await expect(page.getByRole('button', { name: /^Hidden card/ }).first()).toBeVisible();
    const cards = page.locator('button[data-flipped]');
    await expect(cards).toHaveCount(12);

    interface CardState {
      index: number;
      label: string;
      matched: boolean;
      face: string | null;
    }

    async function readCards(): Promise<CardState[]> {
      return cards.evaluateAll((nodes) =>
        nodes.map((node, index) => {
          const label = node.getAttribute('aria-label') ?? '';
          const hidden = label.startsWith('Hidden card');
          return {
            index,
            label,
            matched: label.endsWith(', matched'),
            face: hidden ? null : (label.split(',')[0] ?? null),
          };
        }),
      );
    }

    async function clickCard(index: number): Promise<void> {
      const card = cards.nth(index);
      await expect(card).toBeEnabled({ timeout: 3000 });
      await card.click();
    }

    const known = new Map<number, string>();
    let moves = 0;

    while (moves < 40) {
      const state = await readCards();
      const unmatched = state.filter((card) => !card.matched);
      if (unmatched.length === 0) break;
      for (const card of unmatched) {
        if (card.face) known.set(card.index, card.face);
      }

      const byFace = new Map<string, number[]>();
      for (const card of unmatched) {
        const face = known.get(card.index);
        if (!face) continue;
        byFace.set(face, [...(byFace.get(face) ?? []), card.index]);
      }
      const pair = [...byFace.values()].find((indices) => indices.length >= 2);

      if (pair) {
        await clickCard(pair[0]);
        await clickCard(pair[1]);
        await expect(cards.nth(pair[0])).toHaveAttribute('aria-label', /, matched/, {
          timeout: 5000,
        });
        moves += 1;
        continue;
      }

      const unknown = unmatched.filter((card) => !known.has(card.index));
      const first = unknown[0] ?? unmatched[0];
      if (!first) break;
      await clickCard(first.index);
      await expect(cards.nth(first.index)).not.toHaveAttribute('aria-label', /^Hidden card/, {
        timeout: 3000,
      });
      const learned = (await cards.nth(first.index).getAttribute('aria-label'))?.split(',')[0];
      if (learned) known.set(first.index, learned);

      const partner = unmatched.find(
        (card) => card.index !== first.index && known.get(card.index) === learned,
      );
      const second =
        partner ?? unknown.find((card) => card.index !== first.index) ?? unmatched.find((card) => card.index !== first.index);
      if (!second) break;
      await clickCard(second.index);

      await expect(async () => {
        const after = await readCards();
        const a = after[first.index];
        const b = after[second.index];
        if (!a || !b) throw new Error('card state missing');
        const resolved =
          (a.matched && b.matched) ||
          (!a.matched && !b.matched && !a.label.includes('face up') && !b.label.includes('face up'));
        if (!resolved) throw new Error('cards are still resolving');
      }).toPass({ timeout: 5000, intervals: [100] });
      moves += 1;
    }

    await expect(page.getByText('Board cleared', { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Board cleared in \d+ moves/)).toBeVisible();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByText('Board cleared', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /Hidden card 1$/ })).toBeVisible();
    expectNoErrors(errors);
  });

  test('math sprint ends when the sixty-second clock runs out', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);

    await page.goto('/game/math-sprint');
    await page.clock.install();
    await page.getByRole('button', { name: 'Start sprint', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Answer / })).toHaveCount(4);

    await page.clock.runFor(61_500);

    await expect(page.getByText('Sprint complete', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Sprint again' })).toBeVisible();
    expectNoErrors(errors);
  });

  test('brick breaker loses three lives and offers a replay', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);

    await page.goto('/game/rift-breaker');
    await page.getByRole('button', { name: 'Start run', exact: true }).click();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('breakout canvas has no layout box');
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);

    await expect(page.getByText('Run ended', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('0', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeVisible();
    expectNoErrors(errors);
  });
});
