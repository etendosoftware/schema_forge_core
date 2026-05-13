import { test, expect } from '@playwright/test';
import { login } from './helpers/auth.js';

/**
 * Smoke tests — verify core windows load without JS errors.
 * Run: make test-e2e
 */

test.describe('Smoke: windows load correctly', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const windows = [
    { slug: 'sales-order', heading: 'Orders' },
    { slug: 'business-partner', heading: /Business Partner|Contacts/ },
    { slug: 'product', heading: /Product/ },
    { slug: 'purchase-order', heading: /Purchase|Order/ },
    { slug: 'warehouse', heading: /Warehouse/ },
  ];

  for (const win of windows) {
    test(`${win.slug} loads`, async ({ page }) => {
      // pageerror captures uncaught JS exceptions only — not network errors (HTTP 404/500
      // from backend or mocked APIs are expected noise in a dev/mock environment).
      const jsErrors = [];
      page.on('pageerror', (error) => jsErrors.push(error.message));

      await page.goto(`/${win.slug}`);

      // Should render the list view (h1 was replaced by a TopBar <span> — use stable testid)
      await expect(page.getByTestId('list-view')).toBeVisible({ timeout: 10_000 });

      // No uncaught JS exceptions
      expect(jsErrors).toHaveLength(0);
    });
  }
});
