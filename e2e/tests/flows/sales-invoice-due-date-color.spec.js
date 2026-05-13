import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Sales Invoice — Due Date column color rules.
 *
 * Regression for ETP-3893 follow-up: overdue invoices used to render the
 * date text in red (#D50B3E). Product feedback: the date text must always
 * be black, only the leading dot encodes the state (red for overdue,
 * green for paid, yellow for soon, gray otherwise).
 *
 * Wires synthetic rows over the mocked /sws/neo/sales-invoice/header
 * endpoint so the Due Date renderer can be exercised without a backend.
 */

const OVERDUE_DOT = 'rgb(245, 61, 107)';   // #F53D6B — red-500
const PAID_DOT    = 'rgb(38, 169, 95)';    // #26A95F — green-600
const FORBIDDEN_TEXT_RED = 'rgb(213, 11, 62)'; // #D50B3E — must NOT appear

function isoDaysFromToday(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

const ROWS = [
  {
    id: 'overdue-1',
    documentNo: 'INV-OVERDUE',
    invoiceDate: isoDaysFromToday(-30),
    eTGODueDate: isoDaysFromToday(-10),
    outstandingAmount: 100,
    grandTotalAmount: 100,
    documentStatus: 'CO',
    'documentStatus$_identifier': 'Completed',
    businessPartner: 'bp-1',
    'businessPartner$_identifier': 'Test Customer',
    transactionDocument: 'doc-1',
    'transactionDocument$_identifier': 'AR Invoice',
    eTGODeliveryStatus: 100,
    paymentComplete: false,
  },
  {
    id: 'paid-1',
    documentNo: 'INV-PAID',
    invoiceDate: isoDaysFromToday(-20),
    eTGODueDate: isoDaysFromToday(-5),
    outstandingAmount: 0,
    grandTotalAmount: 100,
    documentStatus: 'CO',
    'documentStatus$_identifier': 'Completed',
    businessPartner: 'bp-1',
    'businessPartner$_identifier': 'Test Customer',
    transactionDocument: 'doc-1',
    'transactionDocument$_identifier': 'AR Invoice',
    eTGODeliveryStatus: 100,
    paymentComplete: true,
  },
];

async function seedInvoiceRows(page) {
  // Registered after login() so this handler wins over the catch-all in auth.js
  // for the sales-invoice list endpoint. All other /sws/** calls keep falling
  // through to the helper's defaults (selectors, defaults, callouts, etc.).
  await page.route('**/sws/neo/sales-invoice/header**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: ROWS, totalRows: ROWS.length } }),
    });
  });
}

async function getRow(page, id) {
  const row = page.getByTestId(`row-${id}`);
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  return row;
}

async function getDueDateWrapper(page, id) {
  // The Due Date cell renders <span.inline-flex>(<span.dot/> + date)</span>.
  // The wrapper is the only inline-flex span inside the row that contains a
  // sibling rounded-full dot.
  const row = await getRow(page, id);
  return row.locator('span.inline-flex:has(span.rounded-full)').first();
}

test.describe('Sales Invoice — Due Date column color', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await seedInvoiceRows(page);
    await navigateTo(page, 'sales-invoice');
  });

  test('overdue row: red dot, but date text has NO inline red override', async ({ page }) => {
    const wrapper = await getDueDateWrapper(page, 'overdue-1');
    const dot = wrapper.locator('span.rounded-full').first();

    // Dot keeps its red background — that's the ONLY differentiator now.
    await expect(dot).toHaveCSS('background-color', OVERDUE_DOT);

    // Wrapper must NOT carry an inline color: ... override.
    const inlineStyle = (await wrapper.getAttribute('style')) || '';
    expect(inlineStyle, 'overdue wrapper must not set inline text color').not.toMatch(/(^|[\s;])color\s*:/i);

    // Computed color must not equal the previously-used red-700.
    const computed = await wrapper.evaluate(el => getComputedStyle(el).color);
    expect(computed).not.toBe(FORBIDDEN_TEXT_RED);
  });

  test('paid row: green dot, no inline text color', async ({ page }) => {
    const wrapper = await getDueDateWrapper(page, 'paid-1');
    const dot = wrapper.locator('span.rounded-full').first();

    await expect(dot).toHaveCSS('background-color', PAID_DOT);

    const inlineStyle = (await wrapper.getAttribute('style')) || '';
    expect(inlineStyle).not.toMatch(/(^|[\s;])color\s*:/i);
  });

  test('overdue and paid rows render the date text in the same computed color', async ({ page }) => {
    const overdueWrapper = await getDueDateWrapper(page, 'overdue-1');
    const paidWrapper = await getDueDateWrapper(page, 'paid-1');

    const [overdueColor, paidColor] = await Promise.all([
      overdueWrapper.evaluate(el => getComputedStyle(el).color),
      paidWrapper.evaluate(el => getComputedStyle(el).color),
    ]);

    expect(overdueColor, 'overdue date text inherits the table default color').toBe(paidColor);
  });
});
