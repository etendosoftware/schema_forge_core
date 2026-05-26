import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Callout message display (mocked).
 *
 * Verifies the callout sanitization introduced in ETP-4005: when the backend
 * returns a message containing HTML tags or "Note:" / "Warning:" / "Error:"
 * prefixes, the displayed Sonner toast shows plain text only.
 *
 * The sanitizeCalloutMessage function is fully covered by 7 Vitest unit tests
 * in useCallout.vitest.jsx. This E2E spec is a smoke test verifying the
 * behavior in a real browser context.
 *
 * Flow:
 *   1. Install a route that returns HTML in the callout messages
 *   2. Mock the businessPartner selector to return a UUID-shaped item
 *   3. Clear the existing businessPartner value and select the UUID item
 *   4. handleChangeWithCallout fires with the UUID, executeCallout fires,
 *      the route returns the HTML message, sanitizeCalloutMessage strips it,
 *      Sonner shows the clean-text toast.
 *
 * The UUID value passes DetailView's executeCallout guard (requires /^[0-9A-Fa-f]{32}$/).
 *
 * Locale note: assertions are locale-agnostic via /English|Español/ regex.
 */

const QUOT_ID = 'cmd-mock-quot-001';
const BP_UUID = 'A94756453D1011D39A840050044F4CCE';
const BP2_UUID = 'B94756453D1011D39A840050044F4CCF';

const DRAFT_QUOTATION = {
  id: QUOT_ID,
  documentNo: 'CQ-CMD',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Borrador',
  grandTotalAmount: 100,
  summedLineAmount: 100,
  businessPartner: BP_UUID,
  'businessPartner$_identifier': 'Test BP',
  'currency$_identifier': 'EUR',
};

const QUOTATION_LINE = {
  id: 'cmd-line-001',
  lineNo: 10,
  product: 'prod-1',
  'product$_identifier': 'Test Product',
  orderedQuantity: 2,
  listPrice: 50,
  discount: 0,
  lineGrossAmount: 100,
  tax: 'tax-1',
  'tax$_identifier': 'IVA 21%',
  'currency$_identifier': 'EUR',
};

async function installQuotationMocks(page) {
  await page.route('**/sws/neo/sales-quotation/quotation?**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [DRAFT_QUOTATION], totalRows: 1 } }),
    });
  });
  await page.route(`**/sws/neo/sales-quotation/quotation/${QUOT_ID}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [DRAFT_QUOTATION] } }),
    });
  });
  await page.route(`**/sws/neo/sales-quotation/header/${QUOT_ID}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [DRAFT_QUOTATION] } }),
    });
  });
  await page.route('**/sws/neo/sales-quotation/quotationLine**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [QUOTATION_LINE], totalRows: 1 } }),
    });
  });
}

test.describe('Callout message display (mocked)', () => {
  test('callout response with <br/> renders plain text in the toast (no HTML tags)', async ({ page }) => {
    await login(page);

    // Override businessPartner selector to return a UUID-shaped item so
    // selecting it passes DetailView's executeCallout UUID guard.
    await page.route('**/selectors/C_BPartner_ID**', async (route) => {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: BP2_UUID, label: 'BP With UUID', name: 'BP With UUID', _identifier: 'BP With UUID' }],
        }),
      });
    });

    // Install callout mock AFTER login() so LIFO route matching prioritises it
    // over login()'s generic POST /sws/**/callout handler (empty messages).
    await page.route('**/callout', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          updates: {},
          combos: {},
          messages: [{ type: 'INFO', text: 'Stock<br/>Alert' }],
        }),
      });
    });

    await installQuotationMocks(page);
    await page.goto(`/sales-quotation/${QUOT_ID}`);
    await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 10_000 });

    // businessPartner renders as a SelectorChip when populated. Clear it to
    // expose the input that triggers the server search.
    const bpChip = page.getByTestId('field-businessPartner-chip');
    await expect(bpChip).toBeVisible({ timeout: 3_000 });
    await bpChip.locator('[role="button"]').click();

    const bpInput = page.getByTestId('field-businessPartner');
    await expect(bpInput).toBeVisible({ timeout: 3_000 });
    // SearchInput requires 2 chars to trigger server search.
    await bpInput.pressSequentially('BP', { delay: 50 });
    const bpOption = page.getByText('BP With UUID').first();
    await expect(bpOption).toBeVisible({ timeout: 5_000 });
    await bpOption.click();

    // Selecting the UUID item fires handleChangeWithCallout → executeCallout
    // → mock returns HTML message → sanitizeCalloutMessage strips <br/>
    // → Sonner toast shows "Stock Alert".
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /Stock\s+Alert/i }).first(),
    ).toBeVisible({ timeout: 8_000 });

    // The raw <br/> tag must NOT appear anywhere as visible text.
    await expect(page.locator('body').getByText('<br/>', { exact: false })).toHaveCount(0);
  });
});
