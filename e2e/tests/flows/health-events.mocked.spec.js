import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Health Score events — sales-invoice (mocked).
 *
 * Validates that ETP-4209 health events are emitted to Mixpanel EU when:
 *   1. A new sales-invoice record is saved   → document_created
 *   2. An existing invoice is confirmed      → transaction_posted
 *
 * Mock mode only: intercepts Mixpanel traffic + the NEO sales-invoice endpoint.
 * Does not hit a real backend.
 *
 * Run:
 *   cd e2e && npm test -- tests/flows/health-events.mocked.spec.js --headed
 */

const RECORD_ID = 'inv-e2e-001';

// A minimal saved invoice returned by the header POST/GET mock.
const SAVED_HEADER = {
  id: RECORD_ID,
  documentNo: 'EINV-001',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Draft',
  invoiceDate: '2026-01-15',
  'businessPartner$_identifier': 'Test BP',
  grandTotalAmount: 100,
  processed: false,
};

// A minimal line so the Confirm button is not disabled (disableWhenEmpty: true).
const SAVED_LINE = {
  id: 'line-e2e-001',
  product: 'prod-e2e',
  'product$_identifier': 'Test Product',
  invoicedQuantity: 1,
  grossUnitPrice: 100,
};

/**
 * Decode a Mixpanel track payload from a POST body or query string.
 *
 * The Mixpanel browser SDK (v2.x) sends data URL-encoded in the POST body:
 *   data=%7B%22event%22%3A%22document_created%22%2C...%7D
 * After URL-decoding that is plain JSON (not base64).
 *
 * Returns an array of event objects, each with at minimum { event, properties }.
 * Returns [] if the payload cannot be decoded.
 */
function decodeMixpanelPayload(url, postData) {
  try {
    let raw;
    // Some Mixpanel paths encode data in the query string (legacy)
    const query = new URL(url).searchParams.get('data');
    if (query) {
      raw = decodeURIComponent(query);
    } else if (postData) {
      // POST body: "data=<url-encoded-json>"
      const match = postData.match(/(?:^|&)data=([^&]+)/);
      if (match) raw = decodeURIComponent(match[1]);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // SDK may wrap a single event or send an array
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/**
 * Install a route handler that intercepts all Mixpanel EU traffic, stubs it
 * with a 200 "1", and records decoded event objects in the returned array.
 *
 * Must be called AFTER login() so it wins the reverse-order match.
 */
async function installMixpanelCapture(page) {
  const events = [];
  await page.route('**/*mixpanel.com/**', async (route) => {
    const req = route.request();
    const rawBody = req.postData() || '';
    const decoded = decodeMixpanelPayload(req.url(), rawBody);
    for (const evt of decoded) {
      if (evt?.event) events.push(evt);
    }
    await route.fulfill({ status: 200, contentType: 'text/plain', body: '1' });
  });
  return events;
}

// Default field values used to bypass the client-side required-field validation
// when creating a new invoice.  The values need to be non-empty strings; the
// backend is mocked so FK resolution is irrelevant here.
const DEFAULTS = {
  invoiceDate: new Date().toISOString().slice(0, 10),
  cDocTypeTargetId: 'dt-e2e-001',
  'cDocTypeTargetId$_identifier': 'Standard Invoice',
  businessPartner: 'bp-e2e-001',
  'businessPartner$_identifier': 'Test BP',
  partnerAddress: 'addr-e2e-001',
  'partnerAddress$_identifier': 'Test Address',
  paymentTerms: 'pt-e2e-001',
  'paymentTerms$_identifier': '30 days',
  paymentMethod: 'pm-e2e-001',
  'paymentMethod$_identifier': 'Transfer',
  priceList: 'pl-e2e-001',
  'priceList$_identifier': 'EUR Price List',
};

/**
 * Install mocks for the sales-invoice NEO endpoint.
 *
 *   GET    /sws/neo/sales-invoice/header/defaults  → DEFAULTS (pre-fills required fields)
 *   POST   /sws/neo/sales-invoice/header           → SAVED_HEADER  (new record save)
 *   GET    /sws/neo/sales-invoice/header/:id       → SAVED_HEADER  (refetch after save)
 *   GET    /sws/neo/sales-invoice/lines?parentId=  → [SAVED_LINE]  (enables Confirm button)
 *   POST   /sws/neo/sales-invoice/header/:id/action/documentAction → 200 ok
 *   GET    /sws/neo/sales-invoice/header (list)    → empty
 *
 * Must be called AFTER login().
 */
async function installSalesInvoiceMocks(page) {
  await page.route('**/sws/neo/sales-invoice/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    // GET /header/defaults → pre-fill required FK fields so the client-side
    // required-field check passes without the user filling any dropdowns.
    if (method === 'GET' && url.includes('/header/defaults')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ defaults: DEFAULTS }),
      });
      return;
    }

    // POST /header → new record save → return saved header
    if (method === 'POST' && /\/sales-invoice\/header$/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [SAVED_HEADER] } }),
      });
      return;
    }

    // POST /header/:id/action/:field → document action (confirm)
    if (method === 'POST' && /\/header\/[^/]+\/action\//.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [{ ...SAVED_HEADER, documentStatus: 'CO', processed: true }] } }),
      });
      return;
    }

    // GET /header/new → return empty (this is the "virtual new" route; returning
    // a record with an id here would turn isNew=false and suppress trackDocumentCreated).
    if (method === 'GET' && /\/header\/new([?]|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [] } }),
      });
      return;
    }

    // GET /header/:id → return saved header (refetch after save / navigate).
    // The regex requires the ID to be the last path segment (no further slashes),
    // so selector URLs like /header/selectors/C_BPartner_Location_ID are NOT matched.
    if (method === 'GET' && /\/sales-invoice\/header\/[^/?]+([?]|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [SAVED_HEADER] } }),
      });
      return;
    }

    // GET /lines?parentId=… → return one line so Confirm is enabled
    if (method === 'GET' && url.includes('/sales-invoice/lines')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [SAVED_LINE] } }),
      });
      return;
    }

    // GET /header (list) → empty
    if (method === 'GET' && /\/sales-invoice\/header([?]|$)/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [], totalRows: 0 } }),
      });
      return;
    }

    // GET /header/selectors/C_BPartner_Location_ID → return the address so
    // CreatableSearchSelect validates the default value and doesn't auto-clear it.
    if (method === 'GET' && url.includes('/selectors/C_BPartner_Location_ID')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 'addr-e2e-001', label: 'Test Address', name: 'Test Address', _identifier: 'Test Address' }],
        }),
      });
      return;
    }

    await route.fallback();
  });
}

/**
 * Wait for a specific Mixpanel event to appear in the captured array.
 * Polls up to timeoutMs (default 6 s) in 100 ms increments.
 */
async function waitForEvent(events, eventName, timeoutMs = 6_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (events.some(e => e.event === eventName)) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

// ---------------------------------------------------------------------------

test.describe('Health Score events — sales-invoice (mocked)', () => {
  test('document_created fires when a new invoice is saved', async ({ page }) => {
    await login(page);
    await installSalesInvoiceMocks(page);
    const events = await installMixpanelCapture(page);

    // Navigate to the new-record form
    await page.goto('/sales-invoice/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Type into the description / notes field to mark the header dirty so the
    // Save Draft button is enabled.  If notes field is absent, fall back to any
    // visible text input inside the form.
    const notesArea = page.getByTestId('notes-textarea');
    if (await notesArea.count() > 0) {
      await notesArea.click();
      await page.keyboard.type('e2e test note');
    } else {
      // Try the first visible text input (e.g. documentNo or description field)
      const firstInput = page.getByTestId('detail-view').locator('input[type="text"], textarea').first();
      await firstInput.fill('e2e');
    }

    // In draftMode the "Save" button (action-save-draft) saves without processing.
    // The "Confirm" button (action-save) saves + processes.
    // We click Save Draft here to trigger just handleSave → trackDocumentCreated.
    const saveDraftBtn = page.getByTestId('action-save-draft');
    await expect(saveDraftBtn).toBeVisible({ timeout: 5_000 });
    await expect(saveDraftBtn).toBeEnabled();
    await saveDraftBtn.click();

    // Wait for Mixpanel to receive the event (the mock intercepts the XHR)
    const received = await waitForEvent(events, 'document_created');
    expect(received, 'Expected document_created event in Mixpanel').toBe(true);

    const evt = events.find(e => e.event === 'document_created');
    expect(evt.properties?.document_type).toBe('sales_invoice');
    expect(evt.properties?.functional_area).toBe('sales');
  });

  test('transaction_posted fires when an existing invoice is confirmed', async ({ page }) => {
    await login(page);
    await installSalesInvoiceMocks(page);
    const events = await installMixpanelCapture(page);

    // Navigate directly to an existing draft invoice that has a line (mocked above)
    await page.goto(`/sales-invoice/${RECORD_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // The Confirm button (action-save in draftMode) is enabled only when
    // children.length > 0 (disableWhenEmpty: true on the invoice draftMode config).
    // Our mock returns SAVED_LINE for the lines endpoint so the button should be enabled.
    const confirmBtn = page.getByTestId('action-save');
    await expect(confirmBtn).toBeVisible({ timeout: 8_000 });
    await expect(confirmBtn).toBeEnabled({ timeout: 8_000 });
    await confirmBtn.click();

    // handleSaveAndProcess → POST action → trackTransactionPosted → Mixpanel XHR
    const received = await waitForEvent(events, 'transaction_posted');
    expect(received, 'Expected transaction_posted event in Mixpanel').toBe(true);

    const evt = events.find(e => e.event === 'transaction_posted');
    expect(evt.properties?.document_type).toBe('sales_invoice');
    expect(evt.properties?.functional_area).toBe('sales');
  });
});
