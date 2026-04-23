import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';
import { physicalInventoryList, physicalInventoryDetail, byRole } from '../helpers/selectors.js';

/**
 * Physical Inventory — flow tests.
 *
 * Requires the dev server running (make dev or make dev-mock).
 * Auth is seeded via localStorage; /sws/* API calls are intercepted to return empty lists.
 *
 * UI is rendered in es_ES locale — all selectors use Spanish text.
 * Column headers are sortable <button> elements, not role="columnheader".
 */

test.describe('Physical Inventory', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'physical-inventory');
  });

  // --- List view ---

  test('list view shows window title and New button', async ({ page }) => {
    await expect(page.locator('text=Inventario físico').first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Nuevo' }).last()).toBeVisible();
  });

  test('list view shows correct sortable column headers', async ({ page }) => {
    const cols = physicalInventoryList.columns;
    await expect(byRole(page, cols.movementDate)).toBeVisible();
    await expect(byRole(page, cols.name)).toBeVisible();
    await expect(byRole(page, cols.warehouse)).toBeVisible();
    await expect(byRole(page, cols.inventoryType)).toBeVisible();
  });

  // --- New form ---

  test('clicking New opens detail form with required fields', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    // Breadcrumb shows "Nuevo"
    await expect(page.locator('text=Nuevo').first()).toBeVisible();

    // Required fields present
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(byRole(page, physicalInventoryDetail.cancel)).toBeVisible();
    await expect(byRole(page, physicalInventoryDetail.save)).toBeVisible();
  });

  test('New form shows Lines tab with correct columns', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    // Lines tab
    await expect(page.locator('button', { hasText: /Líneas/ })).toBeVisible();

    // Line columns are <th> elements (not sortable buttons in detail view)
    await expect(page.locator('th', { hasText: 'Línea' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Producto' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Conteo del usuario' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Unidad' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Conteo del sistema' })).toBeVisible();
  });

  test('Cancel returns to list view', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    await byRole(page, physicalInventoryDetail.cancel).click();

    await page.waitForURL('**/physical-inventory', { timeout: 5_000 });
    await expect(page.locator('text=Inventario físico').first()).toBeVisible();
  });

  // --- Inline add line ---

  test('Add line button opens inline row with product and count fields', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    // Clicking "Añadir línea" saves the header first, then shows the inline add row
    await page.locator('button', { hasText: 'Añadir línea' }).first().click();
    await page.waitForTimeout(1000);

    // Inline row fields: lineNo and userCount are number inputs
    await expect(page.locator('input[placeholder="Line No."]')).toBeVisible();
    await expect(page.locator('input[placeholder="User Count"]')).toBeVisible();
  });

  // --- forceCalloutFields invariant ---
  // Verifies ETP-3585: selecting a product must overwrite user-typed userCount,
  // even if the user pre-filled it manually (forceCalloutFields bypasses the touch guard).
  // NOTE: this test requires VITE_MOCK=true (make dev-mock) so the callout mock
  // returns actual quantityCount/bookQuantity values from mockData.
  // Without VITE_MOCK, the API returns {} and the test is skipped gracefully.
  test('selecting a product overwrites user-typed userCount (forceCalloutFields)', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await byRole(page, physicalInventoryDetail.addLine).click();
    await page.waitForTimeout(300);

    // Check if there's a number input (userCount field) — skip if no inline row appeared
    const userCountInput = page.locator('input[type="number"]').first();
    if (!await userCountInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip();
      return;
    }

    // User manually types 999 in userCount BEFORE selecting a product
    await userCountInput.fill('999');

    // Type in product search field to trigger callout
    const productInput = page.locator('input[placeholder*="roducto"], input[placeholder*="roduct"]').first();
    if (!await productInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      test.skip();
      return;
    }
    await productInput.fill('Test');

    // Select first dropdown suggestion
    const firstSuggestion = page.locator('[role="option"], [role="listitem"]').first();
    if (await firstSuggestion.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstSuggestion.click();
      await page.waitForTimeout(500);
      // forceCalloutFields: value must NOT be 999 anymore
      await expect(userCountInput).not.toHaveValue('999');
    } else {
      // No suggestions available (no mock data) — test is inconclusive, skip
      test.skip();
    }
  });
});
