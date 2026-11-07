import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

/**
 * These tests run against a second production build in which analytics and
 * advertising are actually configured (see scripts/build-consent.mjs). Provider
 * hosts are intercepted, so the matrix proves what the app requests without
 * contacting Google.
 */
const CONSENT_BASE_URL = 'http://127.0.0.1:4176';
const GA_MEASUREMENT_ID = 'G-TEST00000';
const ADSENSE_CLIENT = 'ca-pub-0000000000000000';

test.use({ baseURL: CONSENT_BASE_URL });

interface ProviderRequests {
  analytics: string[];
  advertising: string[];
}

async function interceptProviders(page: Page): Promise<ProviderRequests> {
  const requests: ProviderRequests = { analytics: [], advertising: [] };

  await page.route(/googletagmanager\.com/, async (route) => {
    requests.analytics.push(route.request().url());
    await route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.route(/googlesyndication\.com/, async (route) => {
    requests.advertising.push(route.request().url());
    await route.fulfill({ contentType: 'application/javascript', body: '' });
  });

  return requests;
}

function banner(page: Page) {
  return page.getByRole('region', { name: 'Privacy choices' });
}

async function decide(
  page: Page,
  category: 'analytics' | 'advertising',
  choice: 'Allow' | 'No',
): Promise<void> {
  const name = category === 'analytics' ? 'Optional analytics' : 'Optional advertising';
  await page
    .getByRole('group', { name, exact: true })
    .getByRole('button', { name: choice, exact: true })
    .click();
}

async function storedChoices(page: Page) {
  return page.evaluate(() => ({
    analytics: window.localStorage.getItem('neonrift:analytics-consent'),
    advertising: window.localStorage.getItem('neonrift:advertising-consent'),
  }));
}

async function waitForHome(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Privacy policy' })).toBeVisible();
}

test('no provider is requested before the visitor decides', async ({ page }) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await expect(banner(page)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Optional analytics', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Optional advertising', exact: true })).toBeVisible();

  // The home page renders both ad regions when advertising is allowed, so a
  // premature loader would have fired by now.
  await page.waitForTimeout(500);

  expect(providers).toEqual({ analytics: [], advertising: [] });
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  expect(await storedChoices(page)).toEqual({ analytics: null, advertising: null });
  expectNoErrors(errors);
});

test('allowing analytics loads only the analytics provider', async ({ page }) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await decide(page, 'analytics', 'Allow');

  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);
  await expect.poll(() => providers.analytics.length).toBe(1);
  expect(providers.analytics[0]).toContain(`id=${GA_MEASUREMENT_ID}`);
  expect(providers.advertising).toEqual([]);

  await expect(page.getByRole('group', { name: 'Optional analytics', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Optional advertising', exact: true })).toBeVisible();
  await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  expect(await storedChoices(page)).toEqual({ analytics: 'granted', advertising: null });
  expectNoErrors(errors);
});

test('allowing advertising loads only the advertising provider', async ({ page }) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await decide(page, 'advertising', 'Allow');

  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);
  await expect.poll(() => providers.advertising.length).toBe(1);
  expect(providers.advertising[0]).toContain(`client=${ADSENSE_CLIENT}`);
  expect(providers.analytics).toEqual([]);

  await expect(page.getByRole('group', { name: 'Optional advertising', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Optional analytics', exact: true })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Advertisement' }).first()).toBeVisible();
  expect(await storedChoices(page)).toEqual({ analytics: null, advertising: 'granted' });
  expectNoErrors(errors);
});

test('denying both keeps every provider off across a reload', async ({ page }) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await banner(page).getByRole('button', { name: 'Keep both off' }).click();

  await expect(banner(page)).toHaveCount(0);
  expect(await storedChoices(page)).toEqual({ analytics: 'denied', advertising: 'denied' });

  await page.reload();
  await waitForHome(page);
  await page.waitForTimeout(500);

  await expect(banner(page)).toHaveCount(0);
  expect(providers).toEqual({ analytics: [], advertising: [] });
  expect(await storedChoices(page)).toEqual({ analytics: 'denied', advertising: 'denied' });
  expectNoErrors(errors);
});

test('granted choices survive a reload and load both providers', async ({ page }) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await decide(page, 'analytics', 'Allow');
  await expect(page.getByRole('group', { name: 'Optional advertising', exact: true })).toBeVisible();
  await decide(page, 'advertising', 'Allow');

  await expect.poll(() => providers.analytics.length).toBe(1);
  await expect.poll(() => providers.advertising.length).toBe(1);
  await expect(banner(page)).toHaveCount(0);

  await page.reload();
  await waitForHome(page);
  await expect.poll(() => providers.analytics.length).toBe(2);
  await expect.poll(() => providers.advertising.length).toBe(2);
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);
  await expect(banner(page)).toHaveCount(0);
  expect(await storedChoices(page)).toEqual({ analytics: 'granted', advertising: 'granted' });
  expectNoErrors(errors);
});

test('clearing analytics on the privacy page revokes it without touching advertising', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await decide(page, 'analytics', 'Allow');
  await decide(page, 'advertising', 'Allow');
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);

  await page.getByRole('link', { name: 'Privacy policy' }).click();
  const section = page.getByRole('region', { name: 'Optional analytics' });
  await expect(section.getByText('allowed', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Clear choice' }).click();

  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(0);
  await expect(banner(page).getByRole('group', { name: 'Optional analytics', exact: true })).toBeVisible();
  expect(await storedChoices(page)).toEqual({ analytics: null, advertising: 'granted' });
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);

  await page.waitForTimeout(500);
  expect(providers.analytics.length).toBe(1);
  expect(providers.advertising.length).toBe(1);
  expectNoErrors(errors);
});

test('clearing advertising on the privacy page revokes it without touching analytics', async ({
  page,
}) => {
  const errors = collectErrors(page);
  const providers = await interceptProviders(page);

  await page.goto('/');
  await decide(page, 'analytics', 'Allow');
  await decide(page, 'advertising', 'Allow');
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);

  await page.getByRole('link', { name: 'Privacy policy' }).click();
  const section = page.getByRole('region', { name: 'Advertising' });
  await expect(section.getByText('allowed', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Clear choice' }).click();

  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(0);
  await expect(
    banner(page).getByRole('group', { name: 'Optional advertising', exact: true }),
  ).toBeVisible();
  expect(await storedChoices(page)).toEqual({ analytics: 'granted', advertising: null });
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);

  await page.waitForTimeout(500);
  expect(providers.analytics.length).toBe(1);
  expect(providers.advertising.length).toBe(1);
  expectNoErrors(errors);
});
