import { expect, test } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

test('no analytics or advertising loads before consent', async ({ page }) => {
  const errors = collectErrors(page);
  const externalRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      externalRequests.push(request.url());
    }
  });

  await page.goto('/game/neon-snake');
  await page.getByRole('button', { name: 'Start run', exact: true }).click();

  await expect(page.locator('script[src*="adsbygoogle"]')).toHaveCount(0);
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  await expect(page.locator('script[src*="google-analytics"]')).toHaveCount(0);
  await expect(page.getByLabel('Privacy choices')).toHaveCount(0);

  const consentKeys = await page.evaluate(() => ({
    advertising: localStorage.getItem('neonrift:advertising-consent'),
    analytics: localStorage.getItem('neonrift:analytics-consent'),
  }));
  expect(consentKeys).toEqual({ advertising: null, analytics: null });
  expect(externalRequests).toEqual([]);
  expectNoErrors(errors);
});
