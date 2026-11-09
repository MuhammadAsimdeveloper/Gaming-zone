import { defineConfig, devices } from '@playwright/test';

const PORT = 4175;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CONSENT_PORT = 4176;
const CONSENT_BASE_URL = `http://127.0.0.1:${CONSENT_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: [
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Second production build with analytics and advertising configured, used
      // by the configured-consent matrix.
      command: `npm run build:consent && npm run preview:consent -- --host 127.0.0.1 --port ${CONSENT_PORT} --strictPort`,
      url: CONSENT_BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
