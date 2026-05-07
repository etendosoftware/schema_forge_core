import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Sales Order — pendingDelivery filter pre-loaded from the Dashboard card.
 *
 * Verifies that navigating to /sales-order?filter=pendingDelivery:
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

test.describe('Sales Order — pendingDelivery filter', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'sales-order?filter=pendingDelivery');
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

    await expect(
      page.locator('[role="dialog"], [data-radix-popper-content-wrapper]')
        .locator('button', { hasText: /Estado doc\.|Document Status/ })
        .first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('opening the funnel shows the deliveryStatus condition', async ({ page }) => {
    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await funnelBtn.click();

    await expect(
      page.locator('[role="dialog"], [data-radix-popper-content-wrapper]')
        .locator('button', { hasText: /Estado de entrega|Delivery Status|Shipment Status/ })
        .first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('list renders without draft rows when filter is applied', async ({ page }) => {
    const draftBadge = page.locator('td', { hasText: /^Borrador$|^Draft$/ });
    await expect(draftBadge).toHaveCount(0, { timeout: 5_000 });
  });

  test('navigating without filter param shows no funnel badge', async ({ page }) => {
    await navigateTo(page, 'sales-order');

    const funnelBtn = page.locator('button[title="Filtros avanzados"], button[title="Advanced filters"]');
    await expect(funnelBtn).toBeVisible({ timeout: 5_000 });

    const badge = funnelBtn.locator('span.rounded-full');
    await expect(badge).toHaveCount(0);
  });
});
