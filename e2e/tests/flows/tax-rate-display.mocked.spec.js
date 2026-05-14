import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Tax rate display — smoke (mocked).
 *
 * Validates the ETP-3894 fix: renderTaxRate must render three distinct Tag
 * variants depending on the numeric sign of the rate field.
 *
 *   rate > 0  → green Tag,   text "+<n> %"
 *   rate = 0  → neutral Tag, text "0 %"
 *   rate < 0  → red Tag,     text "<n> %" (no leading +)
 *
 * Mock mode only — no backend required.
 */

const ROWS = [
  { id: 'tax-pos',  name: 'IVA Normal',  rate: 21,  salesPurchaseType: 'B' },
  { id: 'tax-zero', name: 'Cero',        rate: 0,   salesPurchaseType: 'S' },
  { id: 'tax-neg',  name: 'Retención',   rate: -10, salesPurchaseType: 'P' },
];

/**
 * Install a /sws/neo/tax/tax** mock that returns the three synthetic rows.
 *
 * The tax window's primary entity is "tax", so the API path is
 * /sws/neo/tax/tax (spec=tax, entity=tax) — not /sws/neo/tax/header.
 *
 * Must be called AFTER login() — Playwright matches routes in reverse order,
 * so this handler takes priority over the generic /sws/** stub from login().
 */
async function installTaxMock(page) {
  await page.route('**/sws/neo/tax/tax**', async (route) => {
    const req = route.request();
    const url = req.url();

    if (req.method() === 'GET') {
      // Distinguish list vs detail:
      // List URL ends in /tax/tax?... (has query params, no trailing ID segment)
      // Detail URL ends in /tax/tax/<id> (path segment after the entity name)
      const pathOnly = url.split('?')[0];
      // The entity URL base is .../neo/tax/tax — a detail has an extra segment after it
      const isDetail = /\/neo\/tax\/tax\/[^/]+$/.test(pathOnly);

      if (!isDetail) {
        // List endpoint
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ response: { data: ROWS, totalRows: ROWS.length } }),
        });
        return;
      }

      // Detail endpoint — return the matching row
      const m = pathOnly.match(/\/neo\/tax\/tax\/([^/]+)$/);
      const found = ROWS.find(r => r.id === m?.[1]) ?? ROWS[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [found] } }),
      });
      return;
    }

    route.fallback();
  });
}

test.describe('Tax rate display — renderTaxRate variants', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await installTaxMock(page);
    await page.goto('/tax');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('positive rate renders green tag with + prefix', async ({ page }) => {
    const row = page.locator('tbody tr').filter({ hasText: 'IVA Normal' }).first();
    await expect(row).toBeVisible();

    // The Tag renders its label as visible text inside the row
    const tag = row.getByText('+21 %');
    await expect(tag).toBeVisible();

    // Must NOT show plain "21 %" without the + (old fallback text)
    await expect(row.getByText('21 %', { exact: true })).toHaveCount(0);
  });

  test('zero rate renders neutral tag without + prefix', async ({ page }) => {
    const row = page.locator('tbody tr').filter({ hasText: 'Cero' }).first();
    await expect(row).toBeVisible();

    const tag = row.getByText('0 %', { exact: true });
    await expect(tag).toBeVisible();

    // Must NOT show "+0 %" (which would be the buggy single-branch output)
    await expect(row.getByText('+0 %')).toHaveCount(0);
  });

  test('negative rate renders red tag with negative value and no + prefix', async ({ page }) => {
    const row = page.locator('tbody tr').filter({ hasText: 'Retención' }).first();
    await expect(row).toBeVisible();

    const tag = row.getByText('-10 %');
    await expect(tag).toBeVisible();

    // Must NOT show "+-10 %" (wrong prefix from the buggy single-branch)
    await expect(row.getByText('+-10 %')).toHaveCount(0);
    // Must NOT show "+10 %" either
    await expect(row.getByText('+10 %')).toHaveCount(0);
  });

  test('all three rows are visible in the list', async ({ page }) => {
    await expect(page.locator('tbody tr').filter({ hasText: 'IVA Normal' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Cero' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Retención' })).toBeVisible();
  });
});
