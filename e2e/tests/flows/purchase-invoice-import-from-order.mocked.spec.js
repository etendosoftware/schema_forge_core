import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Purchase Invoice — Import from Purchase Order (mocked).
 *
 * Covers:
 *   1. Single line — field values match the purchase order line exactly
 *   2. Multiple lines — both lines visible and both POSTed
 *   3. Line-level discount — etgoDiscount and adjusted unitPrice carried to the POST
 *   4. Order-level etgoTotalDiscount — PATCH sent to invoice header after import
 *
 * Routing note: login() installs a catch-all for /sws/**, so installMocks()
 * must run AFTER login() so specific routes win.
 */

const INV_ID = 'mock-pinv-001';
const BP_ID = 'bp-1';
const PO_ID = 'mock-po-import-001';
const PO_ID_2 = 'mock-po-import-002';

// ---------------------------------------------------------------------------
// Data fixtures
// ---------------------------------------------------------------------------

const DRAFT_INVOICE = {
  id: INV_ID,
  documentNo: 'PINV-001',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Borrador',
  businessPartner: BP_ID,
  'businessPartner$_identifier': 'Proveedor Test',
  // All required header fields must be present so DetailView sets canAddLine=true
  // which reveals the import buttons inside PurchaseInvoiceLinesEmptyState
  partnerAddress: 'addr-1',
  priceList: 'pl-1',
  paymentTerms: 'pt-1',
  paymentMethod: 'pm-1',
  invoiceDate: '2026-05-01',
  grandTotalAmount: 0,
  etgoTotalDiscount: 0,
  'currency$_identifier': 'EUR',
};

const PO_NO_DISCOUNT = {
  id: PO_ID,
  documentNo: 'PO-TEST-001',
  documentStatus: 'CO',
  businessPartner: BP_ID,
  'businessPartner$_identifier': 'Proveedor Test',
  invoiceStatus: 0,
  orderDate: '2026-05-01',
  grandTotalAmount: 200,
  summedLineAmount: 200,
};

const PO_WITH_ORDER_DISCOUNT = {
  id: PO_ID_2,
  documentNo: 'PO-TEST-002',
  documentStatus: 'CO',
  businessPartner: BP_ID,
  'businessPartner$_identifier': 'Proveedor Test',
  invoiceStatus: 0,
  orderDate: '2026-05-01',
  etgoTotalDiscount: 15,
  grandTotalAmount: 170,
  summedLineAmount: 200,
};

const PO_LINE_1 = {
  id: 'pol-001',
  product: 'prod-1',
  'product$_identifier': 'Queso Sardo',
  orderedQuantity: 2,
  unitPrice: 100,
  listPrice: 100,
  grossUnitPrice: 0,
  lineGrossAmount: 200,
  tax: 'tax-1',
  uOM: 'uom-1',
  discount: 0,
};

const PO_LINE_2 = {
  id: 'pol-002',
  product: 'prod-2',
  'product$_identifier': 'Leche Entera',
  orderedQuantity: 5,
  unitPrice: 50,
  listPrice: 50,
  grossUnitPrice: 0,
  lineGrossAmount: 250,
  tax: 'tax-1',
  uOM: 'uom-1',
  discount: 0,
};

const PO_LINE_WITH_DISCOUNT = {
  ...PO_LINE_1,
  id: 'pol-003',
  discount: 15,
  unitPrice: 85,
  lineGrossAmount: 170,
};

// ---------------------------------------------------------------------------
// Mock installer
// ---------------------------------------------------------------------------

/**
 * Install mocks for a single purchase order import flow.
 *
 * @param {object} opts
 * @param {object}   opts.po          - PO header
 * @param {Array}    opts.poLines     - PO lines to return when expanded
 * @param {Array}    opts.invLines    - existing invoice lines (for already-imported detection)
 * @param {object}   opts.state       - mutable object to capture intercepted requests
 */
async function installMocks(page, { po, poLines, invLines = [], state = {} }) {
  // Invoice header — GET (detail page fetch + post-import reload)
  await page.route(`**/sws/neo/purchase-invoice/header/${INV_ID}`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const invoice = state.updatedInvoice || DRAFT_INVOICE;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [invoice] } }),
      });
      return;
    }
    if (method === 'PATCH') {
      const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
      if (state.patchCalls) state.patchCalls.push(body);
      if (body.etgoTotalDiscount != null) {
        state.updatedInvoice = { ...DRAFT_INVOICE, etgoTotalDiscount: body.etgoTotalDiscount };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [{ ...DRAFT_INVOICE, ...body }] } }),
      });
      return;
    }
    if (method === 'PUT') {
      // handleSave() uses PUT for existing records — return the same invoice
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [DRAFT_INVOICE] } }),
      });
      return;
    }
    // Other methods fall through to the catch-all
    route.fallback();
  });

  // Invoice lines GET — returns existing lines (initially empty, populated after import)
  await page.route('**/sws/neo/purchase-invoice/lines**', async (route) => {
    const method = route.request().method();
    if (method !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: state.importedLines || invLines } }),
    });
  });

  // Invoice lines POST — captures each created line
  await page.route('**/sws/neo/purchase-invoice/lines', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postData() ? JSON.parse(route.request().postData()) : {};
    if (state.postBodies) state.postBodies.push(body);
    const created = { id: `inv-line-${Date.now()}`, ...body };
    if (state.importedLines) state.importedLines.push(created);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [created] } }),
    });
  });

  // Purchase order header list — used by ImportFromPurchaseOrderModal.fetchDocuments
  await page.route('**/sws/neo/purchase-order/header**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [po] } }),
    });
  });

  // Purchase order lines — used by ImportFromPurchaseOrderModal.fetchLines
  await page.route('**/sws/neo/purchase-order/lines**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: poLines } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: open the import-from-order modal via the empty-state button
// ---------------------------------------------------------------------------

async function openImportFromOrderModal(page) {
  // Button text: ui('importFromPurchaseOrder') = "Importar desde pedido" (es) / "Import from PO" (en)
  const btn = page.getByText(/Importar desde pedido|Import from PO/i).first();
  await expect(btn).toBeVisible({ timeout: 8_000 });
  await btn.click();
  // Modal opens — wait for the search placeholder to confirm
  // ui('searchPurchaseOrder') = "Buscar pedido de compra..." / "Search purchase order..."
  await expect(
    page.getByPlaceholder(/Buscar pedido de compra|Search purchase order/i)
  ).toBeVisible({ timeout: 8_000 });
}

// ---------------------------------------------------------------------------
// Helper: expand the first document row in the modal
// ---------------------------------------------------------------------------

async function expandFirstDocRow(page, docNo) {
  const docRow = page.getByText(docNo).first();
  await expect(docRow).toBeVisible({ timeout: 5_000 });
  await docRow.click();
}

// ---------------------------------------------------------------------------
// Helper: click the import-selected button
// ---------------------------------------------------------------------------

async function clickImportSelected(page) {
  const btn = page.getByRole('button', { name: /Importar seleccionadas|Import selected/i });
  await expect(btn).toBeEnabled({ timeout: 5_000 });
  await btn.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Purchase Invoice — Import from Purchase Order (mocked)', () => {
  test('single line — values match the purchase order line exactly', async ({ page }) => {
    const state = { postBodies: [], importedLines: [] };

    await login(page);
    await installMocks(page, { po: PO_NO_DISCOUNT, poLines: [PO_LINE_1], state });

    await page.goto(`/purchase-invoice/${INV_ID}`);
    await page.waitForLoadState('domcontentloaded');

    await openImportFromOrderModal(page);
    await expandFirstDocRow(page, 'PO-TEST-001');

    // Product visible in the expanded lines
    await expect(page.getByText('Queso Sardo').first()).toBeVisible({ timeout: 5_000 });

    // Price columns visible (showPriceColumns=true for PO import): 100.00
    await expect(page.getByText(/100\.00/).first()).toBeVisible({ timeout: 3_000 });

    // Qty input pre-filled with orderedQuantity=2
    const qtyInput = page.locator('input[type="number"]').first();
    await expect(qtyInput).toHaveValue('2', { timeout: 3_000 });

    await clickImportSelected(page);

    // Wait for the POST to be captured
    await expect.poll(() => state.postBodies.length, { timeout: 8_000 }).toBeGreaterThan(0);

    const posted = state.postBodies[0];
    expect(posted.salesOrderLine).toBe('pol-001');
    expect(Number(posted.invoicedQuantity)).toBe(2);
    expect(Number(posted.unitPrice)).toBe(100);

    // Modal should close
    await expect(page.locator('.fixed.inset-0.z-50')).toHaveCount(0, { timeout: 5_000 });
  });

  test('multiple lines — both visible and both POSTed', async ({ page }) => {
    const state = { postBodies: [], importedLines: [] };

    await login(page);
    await installMocks(page, { po: PO_NO_DISCOUNT, poLines: [PO_LINE_1, PO_LINE_2], state });

    await page.goto(`/purchase-invoice/${INV_ID}`);
    await page.waitForLoadState('domcontentloaded');

    await openImportFromOrderModal(page);
    await expandFirstDocRow(page, 'PO-TEST-001');

    // Both product lines must be visible
    await expect(page.getByText('Queso Sardo').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Leche Entera').first()).toBeVisible({ timeout: 5_000 });

    await clickImportSelected(page);

    // Expect exactly 2 POSTs
    await expect.poll(() => state.postBodies.length, { timeout: 8_000 }).toBe(2);

    const products = state.postBodies.map(b => b.product);
    expect(products).toContain('prod-1');
    expect(products).toContain('prod-2');
  });

  test('line with line-level discount — etgoDiscount and unitPrice carried to POST', async ({ page }) => {
    const state = { postBodies: [], importedLines: [] };

    await login(page);
    await installMocks(page, { po: PO_NO_DISCOUNT, poLines: [PO_LINE_WITH_DISCOUNT], state });

    await page.goto(`/purchase-invoice/${INV_ID}`);
    await page.waitForLoadState('domcontentloaded');

    await openImportFromOrderModal(page);
    await expandFirstDocRow(page, 'PO-TEST-001');

    // Product visible — price shows the discounted unit price (85.00)
    await expect(page.getByText('Queso Sardo').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/85\.00/).first()).toBeVisible({ timeout: 3_000 });

    await clickImportSelected(page);

    await expect.poll(() => state.postBodies.length, { timeout: 8_000 }).toBeGreaterThan(0);

    const posted = state.postBodies[0];
    expect(Number(posted.etgoDiscount)).toBe(15);
    expect(Number(posted.unitPrice)).toBe(85);
  });

  test('order with etgoTotalDiscount — PATCH sent to invoice header after import', async ({ page }) => {
    const state = {
      postBodies: [],
      patchCalls: [],
      importedLines: [],
      updatedInvoice: null,
    };

    await login(page);
    await installMocks(page, { po: PO_WITH_ORDER_DISCOUNT, poLines: [PO_LINE_1], state });

    await page.goto(`/purchase-invoice/${INV_ID}`);
    await page.waitForLoadState('domcontentloaded');

    await openImportFromOrderModal(page);
    await expandFirstDocRow(page, 'PO-TEST-002');

    await expect(page.getByText('Queso Sardo').first()).toBeVisible({ timeout: 5_000 });

    await clickImportSelected(page);

    // Wait for both the line POST and the discount PATCH
    await expect.poll(() => state.postBodies.length, { timeout: 8_000 }).toBeGreaterThan(0);
    // The discount PATCH is sent by afterImport() — wait for a PATCH containing etgoTotalDiscount
    await expect.poll(
      () => state.patchCalls.find(p => p.etgoTotalDiscount != null),
      { timeout: 8_000 }
    ).toBeDefined();

    const discountPatch = state.patchCalls.find(p => p.etgoTotalDiscount != null);
    expect(Number(discountPatch.etgoTotalDiscount)).toBe(15);

    // Modal closes after successful import
    await expect(page.locator('.fixed.inset-0.z-50')).toHaveCount(0, { timeout: 5_000 });
  });
});
