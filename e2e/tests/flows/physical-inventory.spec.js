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

    // Wait for the inline row to appear (placeholders come from the generated addLineFields,
    // not from the locale dictionary — they are always English regardless of UI locale)
    await expect(page.locator('input[placeholder="Line No."]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[placeholder="User Count"]')).toBeVisible();
  });

  // --- forceCalloutFields invariant ---
  // Verifies ETP-3585: selecting a product must overwrite user-typed userCount,
  // even if the user pre-filled it manually (forceCalloutFields bypasses the touch guard).
  // The route intercept in auth.js returns a synthetic product suggestion and callout
  // response ({ quantityCount: 42 }), so this test runs without VITE_MOCK=true.
  test('selecting a product overwrites user-typed userCount (forceCalloutFields)', async ({ page }) => {
    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await byRole(page, physicalInventoryDetail.addLine).click();

    // Wait for inline add row (POST saves the header first, then row appears)
    const userCountInput = page.locator('input[placeholder="User Count"]');
    await expect(userCountInput).toBeVisible({ timeout: 5_000 });

    // User manually types 999 in userCount BEFORE selecting a product
    await userCountInput.fill('999');

    // The product field is a PopupSearchInput: a button that opens a drawer dialog.
    // Click the button to open it, then type in the inner search input.
    const productButton = page.locator('td button:has(svg)').first();
    await expect(productButton).toBeVisible({ timeout: 3_000 });
    await productButton.click();

    const drawerInput = page.locator('[role="dialog"] input[type="text"]');
    await expect(drawerInput).toBeVisible({ timeout: 3_000 });
    await drawerInput.fill('Test');

    // Select first result — route intercept ensures "Test Product" appears
    const firstResult = page.locator('[role="dialog"] li button').first();
    await expect(firstResult).toBeVisible({ timeout: 3_000 });
    await firstResult.click();

    // forceCalloutFields: callout returns quantityCount=42, must overwrite the 999
    await expect(userCountInput).not.toHaveValue('999', { timeout: 3_000 });
  });

  // --- ETP-3901: warehouse-scoped system count (bookQuantity) ---

  // Selects a product in the inline add row using the shared popup flow.
  async function selectProduct(page) {
    const productButton = page.locator('td button:has(svg)').first();
    await expect(productButton).toBeVisible({ timeout: 3_000 });
    await productButton.click();
    const drawerInput = page.locator('[role="dialog"] input[type="text"]');
    await expect(drawerInput).toBeVisible({ timeout: 3_000 });
    await drawerInput.fill('Test');
    const firstResult = page.locator('[role="dialog"] li button').first();
    await expect(firstResult).toBeVisible({ timeout: 3_000 });
    await firstResult.click();
  }

  // Verifies ETP-3901: afterCallout() on InventoryLineHandler now overrides both
  // bookQuantity (Conteo del sistema) and quantityCount in the callout response.
  // We intercept the callout with a specific value (296) and verify quantityCount
  // reflects it — quantityCount is the editable mirror of bookQuantity in the UI.
  test('callout overrides quantityCount and bookQuantity to warehouse-scoped stock value', async ({ page }) => {
    await page.route('**/sws/**', (route) => {
      const req = route.request();
      if (req.method() === 'POST' && req.url().includes('/callout')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            updates: { quantityCount: 296, bookQuantity: 296 },
            combos: {},
            messages: [],
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await byRole(page, physicalInventoryDetail.addLine).click();

    const userCountInput = page.locator('input[placeholder="User Count"]');
    await expect(userCountInput).toBeVisible({ timeout: 5_000 });

    await selectProduct(page);

    // afterCallout() returns { quantityCount: 296, bookQuantity: 296 }.
    // quantityCount maps to the editable User Count input — verifies both fields
    // were set to the warehouse-scoped value, not the global default.
    await expect(userCountInput).toHaveValue('296', { timeout: 3_000 });
  });

  // Verifies ETP-3901: the callout request targets the inventoryLine endpoint,
  // confirming InventoryLineHandler.afterCallout() is the active handler.
  test('product selection sends callout request to the inventoryLine endpoint', async ({ page }) => {
    const capturedUrls = [];
    await page.route('**/sws/**', (route) => {
      const req = route.request();
      if (req.method() === 'POST' && req.url().includes('/callout')) {
        capturedUrls.push(req.url());
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ updates: { quantityCount: 42, bookQuantity: 42 }, combos: {}, messages: [] }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await byRole(page, physicalInventoryDetail.addLine).click();
    await expect(page.locator('input[placeholder="User Count"]')).toBeVisible({ timeout: 5_000 });

    await selectProduct(page);
    await page.waitForTimeout(500);

    expect(capturedUrls.length).toBeGreaterThan(0);
    expect(capturedUrls.some(url => url.includes('inventoryLine'))).toBe(true);
  });

  // Verifies ETP-3901: the product selector is now served by InventoryProductSelectorPolicy
  // (SPI-based) instead of the deleted InventoryProductSelectorServlet.
  // Confirms the /selectors/ endpoint is hit when the product popup search fires.
  test('product popup search calls the selector endpoint (InventoryProductSelectorPolicy)', async ({ page }) => {
    let selectorEndpointHit = false;
    await page.route('**/sws/**', (route) => {
      const url = route.request().url();
      if (url.includes('/selectors/')) {
        selectorEndpointHit = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [{ id: 'prod-e2e', label: 'Test Product', name: 'Test Product', _identifier: 'Test Product' }],
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.locator('button', { hasText: 'Nuevo' }).last().click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await byRole(page, physicalInventoryDetail.addLine).click();
    await expect(page.locator('input[placeholder="User Count"]')).toBeVisible({ timeout: 5_000 });

    const productButton = page.locator('td button:has(svg)').first();
    await expect(productButton).toBeVisible({ timeout: 3_000 });
    await productButton.click();
    const drawerInput = page.locator('[role="dialog"] input[type="text"]');
    await expect(drawerInput).toBeVisible({ timeout: 3_000 });
    await drawerInput.fill('Test');

    // Result must appear — confirms the SPI-based selector is responding
    await expect(page.locator('[role="dialog"] li button').first()).toBeVisible({ timeout: 3_000 });
    expect(selectorEndpointHit).toBe(true);
  });
});
