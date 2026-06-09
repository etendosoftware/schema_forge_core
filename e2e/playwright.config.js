import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Schema Forge E2E tests.
 *
 * Two modes:
 *   1. Dev server (default):  make dev → http://localhost:3100
 *   2. Deployed (Etendo):     BASE_URL=http://localhost:8080/etendo/web/com.etendoerp.go make test-e2e
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,           // sequential — UI flows depend on state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: '../artifacts/e2e-report' }],
    ['list'],
  ],
  timeout: 60_000,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    headless: !!process.env.CI,   // headless en CI, con ventana en local
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
