import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';
import { INVOICE_GRID_COLUMNS } from '../helpers/selectors.js';

/**
 * Sales / Purchase Invoice — grid column tests.
 *
 * Locks the surface that depends on:
 *   - artifacts/{sales,purchase}-invoice/decisions.json (window.labelOverrides
 *     and entities.header.fields.eTGODeliveryStatus.gridOrder)
 *   - tools/app-shell/src/windows/custom/{sales,purchase}-invoice/index.jsx
 *     (LABEL_OVERRIDES constant — the wrapper bypasses the spec's overrides
 *     when listing, so this constant is what reaches DataTable)
 *   - artifacts/sales-invoice/custom/InvoiceHeaderTable.jsx
 *   - tools/app-shell/.../purchase-invoice/PurchaseInvoiceHeaderTable.jsx
 *
 * Locale-resilient: the grid renders in either es_ES or en_US depending on
 * the active session — the spec accepts either, but rejects mixed/raw labels
 * (e.g. the column key "eTGODeliveryStatus" leaking through unrenamed).
 */

const KNOWN_RAW_KEYS_THAT_MUST_NOT_LEAK = [
  'eTGODeliveryStatus',
  'em_etgo_delivery_status',
  'OutstandingAmt',
  'EM_Etgo_Due_Date',
];

async function readColumnHeaders(page) {
  // Wait for any columnheader to render before reading.
  await page.locator('role=columnheader').first().waitFor({ timeout: 15_000 });
  const texts = await page.getByRole('columnheader').allInnerTexts();
  return texts.map(t => t.trim()).filter(Boolean);
}

function detectLocale(headers) {
  const es = INVOICE_GRID_COLUMNS.es_ES.filter(h => headers.includes(h)).length;
  const en = INVOICE_GRID_COLUMNS.en_US.filter(h => headers.includes(h)).length;
  return en > es ? 'en_US' : 'es_ES';
}

function assertGridMatchesLocale(headers, locale) {
  const expected = INVOICE_GRID_COLUMNS[locale];
  const projected = headers.filter(h => expected.includes(h));
  expect(projected, `column order in locale ${locale}`).toEqual(expected);
}

for (const window of ['sales-invoice', 'purchase-invoice']) {
  test.describe(`${window} — grid columns`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await navigateTo(page, window);
    });

    test('renders the eight expected columns in order', async ({ page }) => {
      const headers = await readColumnHeaders(page);
      const locale = detectLocale(headers);
      assertGridMatchesLocale(headers, locale);
    });

    test('does not leak raw column keys (apiKey or AD column name)', async ({ page }) => {
      const headers = await readColumnHeaders(page);
      for (const raw of KNOWN_RAW_KEYS_THAT_MUST_NOT_LEAK) {
        expect(headers, `column key "${raw}" must be renamed by labelOverrides`)
          .not.toContain(raw);
      }
    });

    test('includes the delivery status column with a translated label', async ({ page }) => {
      const headers = await readColumnHeaders(page);
      const locale = detectLocale(headers);
      const label = locale === 'es_ES' ? 'Estado de entrega' : 'Delivery Status';
      expect(headers).toContain(label);
    });
  });
}
