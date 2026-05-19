import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Purchase Invoice — read-only fields when processed (mocked).
 *
 * Verifies ETP-4012: businessPartner, partnerAddress, paymentMethod,
 * paymentTerms, and priceList are disabled when the invoice has
 * processed=true (documentStatus='CO').
 *
 * Regression guard: orderReference has NO readOnlyLogic in decisions.json
 * by design — it must stay editable even on completed invoices.
 *
 * Routing note: login() installs a catch-all for /sws/**, so installMocks()
 * must run AFTER login() so specific routes win.
 */

const INV_CO_ID = 'inv-co-001';
const INV_DR_ID = 'inv-dr-001';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPLETED_INVOICE = {
  id: INV_CO_ID,
  orderReference: 'SUPPLIER-REF-123',
  documentNo: 'PC-00042',
  invoiceDate: '2026-05-01',
  businessPartner: 'bp-001',
  'businessPartner$_identifier': 'Test Supplier S.A.',
  partnerAddress: 'addr-001',
  'partnerAddress$_identifier': 'Calle Test 1',
  paymentMethod: 'pm-001',
  'paymentMethod$_identifier': 'Efectivo',
  paymentTerms: 'pt-001',
  'paymentTerms$_identifier': '30 Días',
  priceList: 'pl-001',
  'priceList$_identifier': 'Lista de compra',
  documentStatus: 'CO',
  'documentStatus$_identifier': 'Completado',
  documentAction: '--',
  processed: true,
  posted: 'N',
  grandTotalAmount: 100.0,
  summedLineAmount: 100.0,
  outstandingAmount: 100.0,
};

const DRAFT_INVOICE = {
  id: INV_DR_ID,
  orderReference: 'SUPPLIER-REF-456',
  documentNo: 'PC-00043',
  invoiceDate: '2026-05-10',
  businessPartner: 'bp-002',
  'businessPartner$_identifier': 'Draft Supplier S.L.',
  partnerAddress: 'addr-002',
  'partnerAddress$_identifier': 'Calle Draft 2',
  paymentMethod: 'pm-001',
  'paymentMethod$_identifier': 'Efectivo',
  paymentTerms: 'pt-001',
  'paymentTerms$_identifier': '30 Días',
  priceList: 'pl-001',
  'priceList$_identifier': 'Lista de compra',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Borrador',
  documentAction: 'CO',
  processed: false,
  posted: 'N',
  grandTotalAmount: 0.0,
  summedLineAmount: 0.0,
  outstandingAmount: 0.0,
};

// ---------------------------------------------------------------------------
// Mock installer
// ---------------------------------------------------------------------------

/**
 * Install mocks for the purchase-invoice detail endpoint.
 * Routes are installed AFTER login() so they take precedence over the
 * catch-all /sws/** stub.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} invoice - The invoice fixture to serve on detail GET
 */
async function installMocks(page, invoice) {
  // Detail endpoint
  await page.route(`**/sws/neo/purchase-invoice/header/${invoice.id}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [invoice] } }),
      });
      return;
    }
    route.fallback();
  });

  // Lines endpoint — return empty so the form renders cleanly
  await page.route('**/sws/neo/purchase-invoice/lines**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [], totalRows: 0 } }),
    });
  });

  // evaluate-display — return {} so client-side readOnlyLogic drives the UI
  await page.route('**/sws/neo/purchase-invoice/evaluate-display**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Purchase Invoice — readOnlyLogic when processed (mocked)', () => {
  test('businessPartner is disabled when processed', async ({ page }) => {
    await login(page);
    await installMocks(page, COMPLETED_INVOICE);

    await page.goto(`/purchase-invoice/${INV_CO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const fieldRoot = page.getByTestId('field-businessPartner');
    await expect(fieldRoot).toBeVisible({ timeout: 8_000 });

    const control = fieldRoot.locator('input, button').first();
    await expect(control).toBeDisabled({ timeout: 5_000 });
  });

  test('partnerAddress is disabled when processed', async ({ page }) => {
    await login(page);
    await installMocks(page, COMPLETED_INVOICE);

    await page.goto(`/purchase-invoice/${INV_CO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const fieldRoot = page.getByTestId('field-partnerAddress');
    await expect(fieldRoot).toBeVisible({ timeout: 8_000 });

    const control = fieldRoot.locator('input, button').first();
    await expect(control).toBeDisabled({ timeout: 5_000 });
  });

  test('paymentMethod is disabled when processed', async ({ page }) => {
    await login(page);
    await installMocks(page, COMPLETED_INVOICE);

    await page.goto(`/purchase-invoice/${INV_CO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const fieldRoot = page.getByTestId('field-paymentMethod');
    await expect(fieldRoot).toBeVisible({ timeout: 8_000 });

    const control = fieldRoot.locator('input, button').first();
    await expect(control).toBeDisabled({ timeout: 5_000 });
  });

  test('paymentTerms is disabled when processed', async ({ page }) => {
    await login(page);
    await installMocks(page, COMPLETED_INVOICE);

    await page.goto(`/purchase-invoice/${INV_CO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const fieldRoot = page.getByTestId('field-paymentTerms');
    await expect(fieldRoot).toBeVisible({ timeout: 8_000 });

    const control = fieldRoot.locator('input, button').first();
    await expect(control).toBeDisabled({ timeout: 5_000 });
  });

  test('orderReference remains editable when processed (regression guard)', async ({ page }) => {
    await login(page);
    await installMocks(page, COMPLETED_INVOICE);

    await page.goto(`/purchase-invoice/${INV_CO_ID}`);
    await page.waitForLoadState('domcontentloaded');

    const fieldRoot = page.getByTestId('field-orderReference');
    await expect(fieldRoot).toBeVisible({ timeout: 8_000 });

    // The testid is placed directly on the <input> element for text-type fields,
    // so fieldRoot itself is the control to assert against.
    await expect(fieldRoot).toBeEnabled({ timeout: 5_000 });
  });

  test('draft invoice has editable businessPartner (contrast check)', async ({ page }) => {
    await login(page);
    await installMocks(page, DRAFT_INVOICE);

    await page.goto(`/purchase-invoice/${INV_DR_ID}`);
    await page.waitForLoadState('domcontentloaded');

    // When the FK has a preselected value, CreatableSearchSelect renders a chip
    // (`field-${key}-chip`) instead of the bare input (`field-${key}`). The chip
    // being enabled means the user can click to clear/edit — i.e. the field is editable.
    const chip = page.getByTestId('field-businessPartner-chip');
    await expect(chip).toBeVisible({ timeout: 8_000 });
    await expect(chip).toBeEnabled({ timeout: 5_000 });
  });
});
