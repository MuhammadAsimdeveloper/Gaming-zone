import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectNoErrors } from './helpers';

/**
 * The app ships a Content-Security-Policy in report-only mode so violations are
 * collected without breaking the page. These tests prove where the policy comes
 * from, that the default build is clean, and that the configured build is clean
 * once analytics and advertising are allowed.
 */

type Violation = {
  directive: string;
  blocked: string;
  source: string;
  line: number;
  sample: string;
};

const CONSENT_BASE_URL = 'http://127.0.0.1:4176';
const STORAGE_KEY = 'csp-violations';

async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    // Each navigation gets a fresh window, so violations are carried across the
    // route list in sessionStorage instead of a per-document array.
    const read = (): Array<Record<string, unknown>> => {
      try {
        return JSON.parse(sessionStorage.getItem(key) ?? '[]') as Array<Record<string, unknown>>;
      } catch {
        return [];
      }
    };
    document.addEventListener('securitypolicyviolation', (event) => {
      const violations = read();
      violations.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: event.sourceFile,
        line: event.lineNumber,
        sample: event.sample,
      });
      sessionStorage.setItem(key, JSON.stringify(violations));
    });
  }, STORAGE_KEY);
}

async function violations(page: Page): Promise<Violation[]> {
  return page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as Violation[],
    STORAGE_KEY,
  );
}

test('serves the policy in report-only mode', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  const policy = headers['content-security-policy-report-only'] ?? '';

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain('https://www.googletagmanager.com');
  expect(policy).toContain('https://pagead2.googlesyndication.com');
  expect(headers['content-security-policy']).toBeUndefined();
});

test('key routes raise no CSP violations in the default build', async ({ page }) => {
  const errors = collectErrors(page);
  await watchViolations(page);

  for (const route of ['/', '/games', '/privacy', '/game/neon-snake', '/game/neon-apex']) {
    await page.goto(route);
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForTimeout(300);
  }

  expect(await violations(page)).toEqual([]);
  expectNoErrors(errors);
});

test.describe('configured build', () => {
  test.use({ baseURL: CONSENT_BASE_URL });

  test('allowed analytics and advertising raise no CSP violations', async ({ page }) => {
    const errors = collectErrors(page);
    const providerScripts: string[] = [];
    await page.route(/googletagmanager\.com|googlesyndication\.com/, async (route) => {
      providerScripts.push(route.request().url());
      await route.fulfill({ contentType: 'application/javascript', body: '' });
    });
    await watchViolations(page);

    await page.goto('/');
    await page
      .getByRole('group', { name: 'Optional analytics', exact: true })
      .getByRole('button', { name: 'Allow', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Optional advertising', exact: true })
      .getByRole('button', { name: 'Allow', exact: true })
      .click();

    await expect.poll(() => providerScripts.length).toBe(2);
    await expect(page.locator('ins.adsbygoogle').first()).toBeAttached();
    await page.waitForTimeout(300);

    expect(await violations(page)).toEqual([]);
    expectNoErrors(errors);
  });
});