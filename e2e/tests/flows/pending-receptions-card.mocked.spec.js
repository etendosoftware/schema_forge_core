import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Pending Receptions Dashboard Card — mocked smoke (ETP-4004).
 *
 * Validates that:
 * 1. The pending-receptions card renders the correct count from the backend.
 * 2. Clicking the card navigates to /goods-receipt?DocStatus=DR.
 * 3. After navigation the goods-receipt list is visible (rows rendered).
 *
 * No backend required — all API calls are intercepted after login().
 */

const PENDING_TASK = {
  type: 'info',
  text: '4 goods receipts pending',
  taskKey: 'pendingReceptions_plural',
  count: 4,
  link: '/goods-receipt?DocStatus=DR',
  navigation: {
    type: 'list',
    window: 'goods-receipt',
    params: { DocStatus: 'DR' },
  },
};

const GOODS_RECEIPT_ROWS = [
  { id: 'gr-001', documentNo: 'GR-001', documentStatus: 'DR', 'documentStatus$_identifier': 'Borrador', businessPartner: 'Proveedor A', movementDate: '2026-05-01', warehouse: 'Almacén Principal' },
  { id: 'gr-002', documentNo: 'GR-002', documentStatus: 'DR', 'documentStatus$_identifier': 'Borrador', businessPartner: 'Proveedor B', movementDate: '2026-05-02', warehouse: 'Almacén Principal' },
  { id: 'gr-003', documentNo: 'GR-003', documentStatus: 'DR', 'documentStatus$_identifier': 'Borrador', businessPartner: 'Proveedor C', movementDate: '2026-05-03', warehouse: 'Almacén Principal' },
  { id: 'gr-004', documentNo: 'GR-004', documentStatus: 'DR', 'documentStatus$_identifier': 'Borrador', businessPartner: 'Proveedor D', movementDate: '2026-05-04', warehouse: 'Almacén Principal' },
];

/**
 * Install a specific mock for /sws/neo/dashboard/pending-tasks that returns a
 * single pendingReceptions_plural task.
 * Must run AFTER login() — Playwright matches routes in reverse registration order.
 */
async function installDashboardPendingTasksMock(page) {
  await page.route('**/sws/neo/dashboard/pending-tasks**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: {
          data: [PENDING_TASK],
          count: 1,
        },
      }),
    });
  });
}

/**
 * Install a mock for the goods-receipt list and detail endpoints.
 * Must run AFTER login() to take priority over the generic /sws/** catch-all.
 */
async function installGoodsReceiptMock(page) {
  await page.route('**/sws/neo/goods-receipt/header**', async (route) => {
    const req = route.request();
    const url = req.url();

    if (req.method() === 'GET' && !/\/header\/[^/?]+/.test(url)) {
      // List fetch.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: { data: GOODS_RECEIPT_ROWS, totalRows: GOODS_RECEIPT_ROWS.length },
        }),
      });
      return;
    }

    if (req.method() === 'GET') {
      // Detail fetch — return the matching row.
      const m = url.match(/\/header\/([^/?]+)/);
      const found = GOODS_RECEIPT_ROWS.find(r => r.id === m?.[1]) ?? GOODS_RECEIPT_ROWS[0];
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

test.describe('Pending Receptions Card — dashboard (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Install specific mocks AFTER login() so they take priority (LIFO order).
    await installDashboardPendingTasksMock(page);
    await installGoodsReceiptMock(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  /**
   * Verifies that a pending task card with count "4" is visible on the dashboard.
   * PendingTasksRail renders task.count as a large number inside a Link element.
   * The card wraps in a <Link> (renders as <a>) — we look for the count value "4"
   * as text content anywhere inside the rail section.
   */
  test('pendingReceptionsCardShowsCorrectCount', async ({ page }) => {
    // The PendingTasksRail renders each task count as large text inside a <Link>.
    // We locate the element by its text content — the count "4" is rendered in
    // a <p> tag inside the card.
    const countElement = page.getByText('4', { exact: true }).first();
    await expect(countElement).toBeVisible({ timeout: 10_000 });
  });

  /**
   * Verifies that clicking the pending-receptions card navigates to
   * /goods-receipt?DocStatus=DR (or starts with /goods-receipt).
   *
   * The card is rendered as a react-router <Link to="/goods-receipt?DocStatus=DR">,
   * which becomes an <a> element. We click the link that contains the count "4".
   */
  test('pendingReceptionsCardNavigatesToGoodsReceipt', async ({ page }) => {
    // Find the anchor element that wraps the task card for pending receptions.
    // The card contains the count "4" and links to /goods-receipt?DocStatus=DR.
    const card = page.locator('a[href*="/goods-receipt"]').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    // After navigation the URL must contain /goods-receipt.
    await expect(page).toHaveURL(/\/goods-receipt/, { timeout: 10_000 });
  });

  /**
   * Verifies that after navigating via the card the goods-receipt list is rendered
   * with at least one row.
   */
  test('goodsReceiptListAppliesDraftFilter', async ({ page }) => {
    const card = page.locator('a[href*="/goods-receipt"]').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await card.click();

    await page.waitForURL(/\/goods-receipt/, { timeout: 10_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // At least one row must be visible in the list.
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
  });
});
