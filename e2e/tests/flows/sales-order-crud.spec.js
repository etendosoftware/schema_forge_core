import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';
import { salesOrderList, salesOrderDetail, byRole } from '../helpers/selectors.js';

/**
 * Sales Order — flow tests.
 *
 * Selectors discovered via agent-browser on 2026-03-18.
 * See e2e/MCP-DISCOVERY-GUIDE.md for the discovery workflow.
 */

test.describe('Sales Order', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'sales-order');
  });

  test('list view renders with correct columns', async ({ page }) => {
    // Heading
    await expect(byRole(page, salesOrderList.heading)).toBeVisible();

    // Action buttons
    await expect(byRole(page, salesOrderList.newButton)).toBeVisible();

    // Column headers
    const cols = salesOrderList.columns;
    await expect(byRole(page, cols.businessPartner)).toBeVisible();
    await expect(byRole(page, cols.orderDate)).toBeVisible();
    await expect(byRole(page, cols.grossAmount)).toBeVisible();
  });

  test('filters are present', async ({ page }) => {
    await expect(byRole(page, salesOrderList.statusFilter)).toBeVisible();
    await expect(byRole(page, salesOrderList.dateFilter)).toBeVisible();
    await expect(byRole(page, salesOrderList.searchInput)).toBeVisible();
  });

  test('New Order opens form with required fields', async ({ page }) => {
    await byRole(page, salesOrderList.newButton).click();

    // Form heading
    await expect(byRole(page, salesOrderDetail.heading)).toBeVisible();

    // Required fields
    await expect(byRole(page, salesOrderDetail.businessPartner)).toBeVisible();
    await expect(byRole(page, salesOrderDetail.warehouse)).toBeVisible();

    // Actions
    await expect(byRole(page, salesOrderDetail.save)).toBeVisible();
    await expect(byRole(page, salesOrderDetail.saveDraft)).toBeVisible();
    await expect(byRole(page, salesOrderDetail.cancel)).toBeVisible();
  });

  test('New Order shows order line tab with columns', async ({ page }) => {
    await byRole(page, salesOrderList.newButton).click();

    // Order Line tab
    await expect(byRole(page, salesOrderDetail.orderLineTab)).toBeVisible();
    await expect(byRole(page, salesOrderDetail.addOrderLine)).toBeVisible();

    // Line columns
    const lineCols = salesOrderDetail.lineColumns;
    await expect(byRole(page, lineCols.product)).toBeVisible();
    await expect(byRole(page, lineCols.quantity)).toBeVisible();
    await expect(byRole(page, lineCols.price)).toBeVisible();
  });

  test('Cancel returns to list view', async ({ page }) => {
    await byRole(page, salesOrderList.newButton).click();
    await expect(byRole(page, salesOrderDetail.heading)).toBeVisible();

    await byRole(page, salesOrderDetail.cancel).click();

    // Back to list
    await expect(byRole(page, salesOrderList.heading)).toBeVisible();
  });

  test('Partner Address is disabled until Business Partner selected', async ({ page }) => {
    await byRole(page, salesOrderList.newButton).click();

    const partnerAddress = byRole(page, salesOrderDetail.partnerAddress);
    await expect(partnerAddress).toBeDisabled();
  });

  // --- TEMPLATE: Full create flow (requires backend running) ---
  // Uncomment when testing against Etendo with real data:
  //
  // test('can create and save a sales order', async ({ page }) => {
  //   await byRole(page, salesOrderList.newButton).click();
  //
  //   // Fill Business Partner (type to search)
  //   await byRole(page, salesOrderDetail.businessPartner).fill('Alimentos');
  //   await page.waitForTimeout(1000);
  //   // Click first suggestion...
  //
  //   // Select Warehouse
  //   await byRole(page, salesOrderDetail.warehouse).click();
  //   // Select first option...
  //
  //   // Save
  //   await byRole(page, salesOrderDetail.save).click();
  //   await expect(page.locator('[data-sonner-toast]')).toBeVisible();
  // });
});
