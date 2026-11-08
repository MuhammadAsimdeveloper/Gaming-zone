import { expect, test } from '@playwright/test';

test('configured analytics and ads remain idle until each category is allowed', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.hostname === 'www.googletagmanager.com' ||
      url.hostname === 'pagead2.googlesyndication.com'
    ) {
      externalRequests.push(request.url());
    }
  });

  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.__neonriftAnalyticsTestLoaded = true;',
    }),
  );
  await page.route('https://pagead2.googlesyndication.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.adsbygoogle = window.adsbygoogle || [];',
    }),
  );

  await page.goto('/');
  await expect(page.getByLabel('Privacy choices')).toBeVisible();
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(0);
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(0);
  expect(externalRequests).toEqual([]);

  await page.getByRole('button', { name: 'Allow', exact: true }).first().click();
  await expect(page.locator('script[data-neonrift-analytics]')).toHaveCount(1);
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(0);
  expect(externalRequests.some((url) => url.includes('googletagmanager.com'))).toBe(true);
  expect(externalRequests.some((url) => url.includes('googlesyndication.com'))).toBe(false);

  await page.getByRole('button', { name: 'Allow', exact: true }).first().click();
  await expect(page.locator('script[data-neonrift-adsense]')).toHaveCount(1);
  await expect(page.getByLabel('Privacy choices')).toHaveCount(0);
  expect(externalRequests.some((url) => url.includes('googlesyndication.com'))).toBe(true);
});
