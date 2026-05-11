import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Physical Inventory — flow tests.
 *
 * Requires the dev server running (make dev or make dev-mock).
 * Auth is seeded via localStorage; /sws/* API calls are intercepted to return empty lists.
 *
 * Selectors use stable data-testid attributes instead of localized labels.
 * Column headers are sortable <button> elements in list views.
 */

test.describe('Physical Inventory', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'physical-inventory');
  });

  // --- List view ---

  test('list view shows window title and New button', async ({ page }) => {
    await expect(page.getByTestId('list-view')).toBeVisible();
    await expect(page.getByTestId('action-new')).toBeVisible();
  });

  test('list view shows correct sortable column headers', async ({ page }) => {
    await expect(page.getByTestId('column-header-movementDate')).toBeVisible();
    await expect(page.getByTestId('column-header-name')).toBeVisible();
    await expect(page.getByTestId('column-header-warehouse')).toBeVisible();
    await expect(page.getByTestId('column-header-inventoryType')).toBeVisible();
  });

  // --- New form ---

  test('clicking New opens detail form with required fields', async ({ page }) => {
    await page.getByTestId('action-new').click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    await expect(page.getByTestId('detail-view')).toBeVisible();

    // Required fields present
    await expect(page.getByTestId('field-movementDate')).toBeVisible();
    await expect(page.getByTestId('field-name')).toBeVisible();
    await expect(page.getByTestId('field-warehouse')).toBeVisible();
    await expect(page.getByTestId('action-cancel')).toBeVisible();
    await expect(page.getByTestId('action-save')).toBeVisible();
  });

  test('New form shows Lines tab with correct columns', async ({ page }) => {
    await page.getByTestId('action-new').click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    await expect(page.getByTestId('detail-view')).toBeVisible();

    // Line columns are <th> elements (not sortable buttons in detail view)
    await expect(page.getByTestId('column-header-lineNo')).toBeVisible();
    await expect(page.getByTestId('column-header-product')).toBeVisible();
    await expect(page.getByTestId('column-header-quantityCount')).toBeVisible();
    await expect(page.getByTestId('column-header-uOM')).toBeVisible();
    await expect(page.getByTestId('column-header-bookQuantity')).toBeVisible();
  });

  test('Cancel returns to list view', async ({ page }) => {
    await page.getByTestId('action-new').click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    await page.getByTestId('action-cancel').click();

    await page.waitForURL('**/physical-inventory', { timeout: 5_000 });
    await expect(page.getByTestId('list-view')).toBeVisible();
  });

  // --- Inline add line ---

  test('Add line button opens inline row with product and count fields', async ({ page }) => {
    await page.getByTestId('action-new').click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });

    // Clicking Add Line saves the header first, then shows the inline add row.
    await page.getByTestId('action-add-line').click();

    // Wait for the inline row to appear. Current UI renders numeric inputs without placeholders.
    await expect(page.getByTestId('inline-add-row')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('inline-add-field-lineNo')).toBeVisible();
    await expect(page.getByTestId('inline-add-field-product')).toBeVisible();
    await expect(page.getByTestId('inline-add-field-quantityCount')).toBeVisible();
  });

  // --- forceCalloutFields invariant ---
  // Verifies ETP-3585: selecting a product must overwrite user-typed userCount,
  // even if the user pre-filled it manually (forceCalloutFields bypasses the touch guard).
  // The route intercept in auth.js returns a synthetic product suggestion and callout
  // response ({ quantityCount: 42 }), so this test runs without VITE_MOCK=true.
  test('selecting a product overwrites user-typed userCount (forceCalloutFields)', async ({ page }) => {
    await page.getByTestId('action-new').click();
    await page.waitForURL('**/physical-inventory/new', { timeout: 5_000 });
    await page.getByTestId('action-add-line').click();

    // Wait for inline add row (POST saves the header first, then row appears)
    await expect(page.getByTestId('inline-add-row')).toBeVisible({ timeout: 5_000 });
    const userCountInput = page.getByTestId('inline-add-field-quantityCount');
    await expect(userCountInput).toBeVisible({ timeout: 5_000 });

    // User manually types 999 in userCount BEFORE selecting a product
    await userCountInput.fill('999');

    // The product field is a PopupSearchInput: a button that opens a drawer dialog.
    // Click the button to open it, then type in the inner search input.
    const productButton = page.getByTestId('inline-add-field-product');
    await expect(productButton).toBeVisible({ timeout: 3_000 });
    await productButton.click();

    const drawerInput = page.locator('[role="dialog"] input[type="text"]');
    await expect(drawerInput).toBeVisible({ timeout: 3_000 });
    await drawerInput.fill('a');

    // Select first result — route intercept ensures "Test Product" appears
    const firstResult = page.locator('[role="dialog"] li button').first();
    await expect(firstResult).toBeVisible({ timeout: 3_000 });
    await firstResult.click();

    // forceCalloutFields: callout returns quantityCount=42, must overwrite the 999
    await expect(userCountInput).not.toHaveValue('999', { timeout: 3_000 });
  });
});
