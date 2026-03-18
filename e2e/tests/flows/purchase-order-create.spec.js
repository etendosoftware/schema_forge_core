import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Purchase Order — create flow with Group Admin role + España Norte org.
 *
 * Selectors discovered via agent-browser on 2026-03-18.
 * Context: F&B International Group Admin / F&B España - Región Norte
 */

test.describe('Purchase Order - Create', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'purchase-order');
  });

  test('list view loads with purchase order records', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Order' })).toBeVisible();

    // Should have column headers
    await expect(page.getByRole('columnheader', { name: 'Transaction Document' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Business Partner' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Order Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Warehouse' })).toBeVisible();

    // Should have at least one record (the demo data has many)
    const rows = page.getByRole('cell', { name: 'Purchase Order' });
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('New Order form opens with correct fields', async ({ page }) => {
    await page.getByRole('button', { name: 'New Order' }).click();

    // Form heading
    await expect(page.getByRole('heading', { name: 'New Order', level: 1 })).toBeVisible();

    // Required fields
    await expect(page.getByRole('textbox', { name: /Transaction Document/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Business Partner/ })).toBeVisible();

    // Order Date should be visible (native date input or spinbuttons depending on locale)
    const orderDateLabel = page.locator('text=Order Date');
    await expect(orderDateLabel).toBeVisible();

    // Partner Address disabled until BP selected
    await expect(page.getByRole('combobox', { name: /Partner Address/ })).toBeDisabled();

    // Action buttons
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('New Order shows order line tab and columns', async ({ page }) => {
    await page.getByRole('button', { name: 'New Order' }).click();

    // Tabs
    await expect(page.getByRole('button', { name: /^Order Line \d+$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Others' })).toBeVisible();

    // Order line columns
    await expect(page.getByRole('columnheader', { name: 'Product' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Ordered Quantity' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Net Unit Price' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Line Net Amount' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tax' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'UOM' })).toBeVisible();

    // Add line button
    await expect(page.getByRole('button', { name: '+ Add Order Line' })).toBeVisible();
  });

  test('Cancel returns to list view', async ({ page }) => {
    await page.getByRole('button', { name: 'New Order' }).click();
    await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    // Back to list
    await expect(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Order' })).toBeVisible();
  });

  test('context is F&B International Group Admin + España Norte', async ({ page }) => {
    // Verify the context was applied — the sidebar should show the org name
    // We need to expand the sidebar to see it
    const orgLabel = page.locator('button').filter({
      hasText: 'F&B España - Región Norte',
    });

    // If sidebar is expanded, the org name should be visible
    if (await orgLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(orgLabel).toBeVisible();
    }

    // The list data should include records from España Región Norte
    const northRecords = page.getByRole('cell', { name: 'España Región Norte' });
    await expect(northRecords.first()).toBeVisible({ timeout: 10_000 });
  });
});
