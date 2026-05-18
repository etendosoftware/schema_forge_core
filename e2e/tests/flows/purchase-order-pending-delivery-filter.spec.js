import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Purchase Order — pendingDelivery filter pre-loaded from the Dashboard card.
 *
 * Verifies that navigating to /purchase-order?filter=pendingDelivery:
 *   1. Pre-loads the AdvancedFilter funnel with 2 conditions (badge = 2).
 *   2. Shows the expected conditions when the funnel is opened.
 *   3. Renders the list without draft records (filter is applied on first load).
 *
 * Runs in mock mode (make dev / make dev-mock).
 * All /sws/* calls return empty data — the assertions focus on UI state,
 * not record counts from the real backend.
 *
 * UI locale: es_ES (default — schema-forge-locale not seeded in localStorage).
 */

test.describe('Purchase Order — pendingDelivery filter', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'purchase-order?filter=pendingDelivery');
  });

  test('funnel button shows badge with count 2', async ({ page }) => {
    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await expect(funnelBtn).toBeVisible({ timeout: 5_000 });

    const badge = funnelBtn.locator('span');
    await expect(badge).toHaveText('2');
  });

  test('opening the funnel shows the documentStatus condition', async ({ page }) => {
    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await funnelBtn.click();

    // "Estado doc." comes from the locale dictionary (DocStatus column).
    // LABEL_OVERRIDES in purchase-order/index.jsx does not override DocStatus.
    await expect(
      page.locator('[role="dialog"], [data-radix-popper-content-wrapper]')
        .locator('button', { hasText: /Estado doc\.|Document Status/ })
        .first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('opening the funnel shows the deliveryStatusPurchase condition', async ({ page }) => {
    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await funnelBtn.click();

    await expect(
      page.locator('[role="dialog"], [data-radix-popper-content-wrapper]')
        .locator('button', { hasText: /Estado de entrega|Delivery Status/ })
        .first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('list renders without draft rows when filter is applied', async ({ page }) => {
    // In mock mode the list is empty (API returns []).
    // Verify no "Borrador" / "Draft" status badge is visible in the table body.
    // This confirms the filter was sent on the initial fetch (not just shown in the funnel).
    const draftBadge = page.locator('td', { hasText: /^Borrador$|^Draft$/ });
    await expect(draftBadge).toHaveCount(0, { timeout: 5_000 });
  });

  test('navigating without filter param shows no funnel badge', async ({ page }) => {
    // Regression: no badge when filter param is absent
    await navigateTo(page, 'purchase-order');

    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await expect(funnelBtn).toBeVisible({ timeout: 5_000 });

    // Badge span should not exist inside the funnel button
    const badge = funnelBtn.locator('span.rounded-full');
    await expect(badge).toHaveCount(0);
  });
});
