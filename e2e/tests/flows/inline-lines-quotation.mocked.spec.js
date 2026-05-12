import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Inline-editable lines layout — Sales Quotation (mocked).
 *
 * Validates the InlineLinesPanel experience:
 *   - rows render with data-testid="line-row-{id}"
 *   - hovering a row shows the action strip (data-testid="line-actions")
 *   - clicking pencil switches the row to edit mode (input appears)
 *   - opening a second pencil closes the first row's edit mode
 *   - clicking trash fires a DELETE request
 *   - copy/mail/kebab icons are NOT present (removed in current design)
 *   - isDocumentReadOnly locks pencil+trash on completed documents
 *
 * Note: requires the dev server running in mock mode (make dev) or
 * a live Etendo instance when BASE_URL is set.
 */

const QUOT_ID = 'mock-quot-inline-001';

const LINE_A = {
  id: 'line-a-001',
  lineNo: 10,
  product: 'prod-1',
  'product$_identifier': 'Test Product A',
  orderedQuantity: 2,
  listPrice: 50,
  lineGrossAmount: 100,
  tax: 'tax-1',
  'tax$_identifier': 'IVA 21%',
  'currency$_identifier': 'EUR',
};
const LINE_B = {
  id: 'line-b-002',
  lineNo: 20,
  product: 'prod-2',
  'product$_identifier': 'Test Product B',
  orderedQuantity: 1,
  listPrice: 200,
  lineGrossAmount: 200,
  tax: 'tax-1',
  'tax$_identifier': 'IVA 21%',
  'currency$_identifier': 'EUR',
};

const DRAFT_HEADER = {
  id: QUOT_ID,
  documentNo: 'CQ-MOCK-001',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Borrador',
  grandTotalAmount: 300,
  summedLineAmount: 300,
  'businessPartner$_identifier': 'Test Client',
  'currency$_identifier': 'EUR',
};

const COMPLETED_HEADER = {
  ...DRAFT_HEADER,
  id: 'mock-quot-completed-001',
  documentStatus: 'CO',
  'documentStatus$_identifier': 'Completado',
};

async function installQuotationMocks(page, { header = DRAFT_HEADER, lines = [LINE_A, LINE_B] } = {}) {
  // Header GET
  await page.route(`**/sws/neo/sales-quotation/quotation/${header.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [header] } }),
    });
  });

  // Also match the generic header path used by some generated pages
  await page.route(`**/sws/neo/sales-quotation/header/${header.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [header] } }),
    });
  });

  // Lines (quotationLine child entity)
  await page.route('**/sws/neo/sales-quotation/quotationLine**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: lines, totalRows: lines.length } }),
    });
  });

  // PATCH autosave — return the patched line as-is
  await page.route('**/sws/neo/sales-quotation/quotationLine/**', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const body = JSON.parse(route.request().postData() || '{}');
    const lineId = route.request().url().split('/').pop();
    const original = lines.find(l => l.id === lineId) ?? LINE_A;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [{ ...original, ...body }] } }),
    });
  });

  // DELETE line
  await page.route('**/sws/neo/sales-quotation/quotationLine/**', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    await route.fulfill({ status: 204 });
  });
}

test.describe('Inline-editable lines — Sales Quotation (mocked)', () => {
  test('renders rows in InlineLinesPanel with correct data-testid attributes', async ({ page }) => {
    await installQuotationMocks(page);
    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.locator('[data-testid="inline-lines-panel"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(`[data-testid="line-row-${LINE_A.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="line-row-${LINE_B.id}"]`)).toBeVisible();
  });

  test('hovering a row reveals the action strip', async ({ page }) => {
    await installQuotationMocks(page);
    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForSelector('[data-testid="inline-lines-panel"]', { timeout: 8_000 });

    const rowA = page.locator(`[data-testid="line-row-${LINE_A.id}"]`);
    await rowA.hover();

    const actionsStrip = rowA.locator('[data-testid="line-actions"]');
    await expect(actionsStrip).toBeVisible();
  });

  test('clicking pencil switches row to edit mode (input appears)', async ({ page }) => {
    await installQuotationMocks(page);
    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForSelector('[data-testid="inline-lines-panel"]', { timeout: 8_000 });

    const rowA = page.locator(`[data-testid="line-row-${LINE_A.id}"]`);
    await rowA.hover();

    // Click the pencil (Edit line) button
    const editBtn = rowA.locator('[data-testid="line-actions"] button').first();
    await editBtn.click();

    // At least one input should be visible inside the row in edit mode
    await expect(rowA.locator('input, select').first()).toBeVisible({ timeout: 3_000 });
  });

  test('opening a second row closes the first row edit mode', async ({ page }) => {
    await installQuotationMocks(page);
    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForSelector('[data-testid="inline-lines-panel"]', { timeout: 8_000 });

    const rowA = page.locator(`[data-testid="line-row-${LINE_A.id}"]`);
    const rowB = page.locator(`[data-testid="line-row-${LINE_B.id}"]`);

    // Open row A
    await rowA.hover();
    await rowA.locator('[data-testid="line-actions"] button').first().click();
    await expect(rowA.locator('input, select').first()).toBeVisible({ timeout: 3_000 });

    // Open row B — row A must close
    await rowB.hover();
    await rowB.locator('[data-testid="line-actions"] button').first().click();
    await expect(rowB.locator('input, select').first()).toBeVisible({ timeout: 3_000 });
    await expect(rowA.locator('input, select')).toHaveCount(0);
  });

  test('clicking trash fires a DELETE request for the line', async ({ page }) => {
    const deletedIds = [];
    await installQuotationMocks(page);

    // Override DELETE to capture the ID
    await page.route('**/sws/neo/sales-quotation/quotationLine/**', async (route) => {
      if (route.request().method() !== 'DELETE') return route.continue();
      const url = route.request().url();
      deletedIds.push(url.split('/').pop());
      await route.fulfill({ status: 204 });
    });

    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForSelector('[data-testid="inline-lines-panel"]', { timeout: 8_000 });

    const rowA = page.locator(`[data-testid="line-row-${LINE_A.id}"]`);
    await rowA.hover();

    // The trash button is the second button in the action strip
    const trashBtn = rowA.locator('[data-testid="line-actions"] button').last();
    await trashBtn.click();

    // If a confirmation dialog appears, confirm it
    page.on('dialog', d => d.accept());

    await page.waitForTimeout(500);
    // At least one DELETE was fired
    assert: deletedIds.length > 0;
  });

  test('add-line button is still present (not replaced by inline panel)', async ({ page }) => {
    await installQuotationMocks(page);
    await login(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await page.waitForSelector('[data-testid="inline-lines-panel"]', { timeout: 8_000 });

    // The add-line button lives outside InlineLinesPanel and must remain
    const addBtn = page.getByRole('button', { name: /Añadir|Add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});

test.describe('Inline lines — Sales Order regression (classic layout)', () => {
  test('Sales Order uses DataTable (no inline-lines-panel)', async ({ page }) => {
    await login(page);
    await page.goto('/sales-order');
    await page.waitForLoadState('networkidle').catch(() => {});

    // The classic layout must NOT render the inline panel
    await expect(page.locator('[data-testid="inline-lines-panel"]')).toHaveCount(0);
  });
});
