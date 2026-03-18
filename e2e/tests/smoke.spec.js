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
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(`/${win.slug}`);

      // Should render a heading
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible({ timeout: 10_000 });

      // No critical JS errors (ignore common noise)
      const critical = errors.filter(
        (e) =>
          !e.includes('favicon') &&
          !e.includes('ResizeObserver') &&
          !e.includes('net::ERR') &&
          !e.includes('404') &&
          !e.includes('MIME type')
      );
      expect(critical).toHaveLength(0);
    });
  }
});
