import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Discount field max-100 autocorrection (mocked) — ETP-4277.
 *
 * Verifies that the `max` constraint introduced in ETP-4277 is wired end-to-end
 * in the sales-order inline-add row:
 *   - Entering a value above max (e.g. 150) and blurring autocorrects to 100.
 *   - Entering a value at max (100) leaves it unchanged.
 *   - Entering a value below max (50) leaves it unchanged.
 *
 * The discount field in sales-order addLineFields carries `max: 100` through
 * the pipeline: decisions.json → resolve-curated.js → generate-contract.js →
 * generate-frontend.js → HeaderPage.jsx addLineFields → DataTable renderInputCell
 * onBlur handler.
 *
 * Mock mode only — no Etendo backend required.
 * Specific routes are installed AFTER login() so they win over the generic
 * /sws/** catch-all that login() seeds (Playwright LIFO route matching).
 */

const ORDER_ID = 'so-etp4277-001';

const DRAFT_ORDER = {
  id: ORDER_ID,
  documentNo: 'SO-ETP4277',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Borrador',
  orderDate: '2026-06-25',
  'businessPartner$_identifier': 'Test Client',
  grandTotalAmount: 0,
  summedLineAmount: 0,
  'currency$_identifier': 'EUR',
};

async function installSalesOrderMocks(page) {
  // Header list
  await page.route('**/sws/neo/sales-order/header**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() !== 'GET') return route.fallback();
    const detailMatch = url.match(/\/header\/([^/?]+)/);
    if (detailMatch) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [DRAFT_ORDER] } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [DRAFT_ORDER], totalRows: 1 } }),
    });
  });

  // Lines — return empty so no existing rows compete with the inline-add row
  await page.route('**/sws/neo/sales-order/lines**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [], totalRows: 0 } }),
    });
  });
}

/**
 * Navigate to the draft order detail, click "+ Add line", wait for the
 * inline-add row to appear, and return the discount input locator.
 */
async function openAddRowDiscountField(page) {
  await page.goto(`/sales-order/${ORDER_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const addLineBtn = page.getByTestId('action-add-line');
  await expect(addLineBtn).toBeVisible({ timeout: 8_000 });
  await addLineBtn.click();

  const inlineAddRow = page.getByTestId('inline-add-row');
  await expect(inlineAddRow).toBeVisible({ timeout: 5_000 });

  const discountInput = inlineAddRow.getByTestId('inline-add-field-discount');
  await expect(discountInput).toBeVisible({ timeout: 3_000 });
  return discountInput;
}

test.describe('Discount field max-100 autocorrection in sales-order inline-add row (ETP-4277)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await installSalesOrderMocks(page);
  });

  test('entering a value above max (150) autocorrects to 100 on blur', async ({ page }) => {
    const discountInput = await openAddRowDiscountField(page);

    await discountInput.fill('150');
    await discountInput.blur();

    await expect(discountInput).toHaveValue('100');
  });

  test('entering the exact max value (100) leaves it unchanged on blur', async ({ page }) => {
    const discountInput = await openAddRowDiscountField(page);

    await discountInput.fill('100');
    await discountInput.blur();

    await expect(discountInput).toHaveValue('100');
  });

  test('entering a value below max (50) leaves it unchanged on blur', async ({ page }) => {
    const discountInput = await openAddRowDiscountField(page);

    await discountInput.fill('50');
    await discountInput.blur();

    await expect(discountInput).toHaveValue('50');
  });
});
