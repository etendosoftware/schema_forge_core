import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Sales Quotation — rejectReason surfaced on the form when DocStatus = CJ.
 *
 * Regression for ETP-3893 follow-up: feedback asked for the rejection reason
 * to appear as another field on the quotation so the user can see WHY a
 * quote was rejected. The field must:
 *   - render in the principal section ONLY when documentStatus === 'CJ'
 *   - stay disabled (read-only) when displayed
 *   - show the linked reason via _identifier
 *   - be hidden on non-rejected quotes (DR/UE/CO/...)
 *
 * Wires synthetic header records over the mocked
 * /sws/neo/sales-quotation/quotation/{id} endpoint so the displayLogic can
 * be exercised without a backend.
 */

const REJECTED_ID = 'cj-record';
const DRAFT_ID = 'dr-record';
const REJECTED_REASON_NAME = 'Precio muy alto';

const REJECTED_RECORD = {
  id: REJECTED_ID,
  documentNo: '1000999',
  documentStatus: 'CJ',
  'documentStatus$_identifier': 'Closed - Rejected',
  orderDate: '2026-04-29',
  validUntil: null,
  businessPartner: 'bp-1',
  'businessPartner$_identifier': 'Laura Morat',
  partnerAddress: 'addr-1',
  'partnerAddress$_identifier': 'Rio Cuarto, Santa Fe 488',
  priceList: 'pl-1',
  'priceList$_identifier': 'Lista de venta (sin impuestos)',
  paymentMethod: 'pm-1',
  'paymentMethod$_identifier': 'Efectivo',
  paymentTerms: 'pt-1',
  'paymentTerms$_identifier': '30 Días',
  rejectReason: 'reason-1',
  'rejectReason$_identifier': REJECTED_REASON_NAME,
  grandTotalAmount: 48.4,
  summedLineAmount: 44,
  description: '',
  processed: true,
};

const DRAFT_RECORD = {
  id: DRAFT_ID,
  documentNo: '1000998',
  documentStatus: 'DR',
  'documentStatus$_identifier': 'Draft',
  orderDate: '2026-05-01',
  validUntil: null,
  businessPartner: 'bp-1',
  'businessPartner$_identifier': 'Laura Morat',
  partnerAddress: 'addr-1',
  'partnerAddress$_identifier': 'Rio Cuarto, Santa Fe 488',
  priceList: 'pl-1',
  'priceList$_identifier': 'Lista de venta (sin impuestos)',
  paymentMethod: 'pm-1',
  'paymentMethod$_identifier': 'Efectivo',
  paymentTerms: 'pt-1',
  'paymentTerms$_identifier': '30 Días',
  rejectReason: null,
  grandTotalAmount: 0,
  summedLineAmount: 0,
  description: '',
  processed: false,
};

const RECORDS = { [REJECTED_ID]: REJECTED_RECORD, [DRAFT_ID]: DRAFT_RECORD };

async function seedQuotationDetail(page) {
  // Registered after login() so this handler wins over the catch-all in
  // auth.js for the sales-quotation header endpoint.
  await page.route('**/sws/neo/sales-quotation/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const segments = url.pathname.split('/').filter(Boolean);
    // /sws/neo/sales-quotation/{entity}/{id?}
    const idx = segments.indexOf('sales-quotation');
    const entity = segments[idx + 1];
    const idOrSubpath = segments[idx + 2];

    // Empty child list — the test focuses on the header form.
    if (entity === 'quotationLine') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [] } }),
      });
      return;
    }

    // GET /quotation/{id} — synthetic header record.
    if (entity === 'quotation' && req.method() === 'GET' && RECORDS[idOrSubpath]) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [RECORDS[idOrSubpath]] } }),
      });
      return;
    }

    // Anything else (defaults, selectors, callouts, actions) → fall through to
    // the auth.js catch-all so its synthetic responses keep the UI happy.
    route.fallback();
  });
}

test.describe('Sales Quotation — rejectReason field on rejected document', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await seedQuotationDetail(page);
  });

  test('rejected quote: rejectReason field is visible, disabled, with the reason value', async ({ page }) => {
    await navigateTo(page, `sales-quotation/${REJECTED_ID}`);

    const container = page.getByTestId('field-rejectReason');
    await expect(container).toBeVisible({ timeout: 10_000 });

    const input = container.locator('input').first();
    await expect(input).toBeDisabled({ timeout: 5_000 });
    await expect(input).toHaveValue(REJECTED_REASON_NAME);
  });

  test('draft quote: rejectReason field is NOT rendered (displayLogic gating)', async ({ page }) => {
    await navigateTo(page, `sales-quotation/${DRAFT_ID}`);

    // Wait for any field of the form to render so we know the page settled.
    await page.getByTestId('field-documentNo').waitFor({ state: 'visible', timeout: 10_000 });

    await expect(page.getByTestId('field-rejectReason')).toHaveCount(0);
  });

  test('rejected quote: rejectReason sits in the principal section (above the lines tab)', async ({ page }) => {
    await navigateTo(page, `sales-quotation/${REJECTED_ID}`);

    const rejectField = page.getByTestId('field-rejectReason');
    await expect(rejectField).toBeVisible({ timeout: 10_000 });

    // The field must appear before the "Lines" tab in DOM order — i.e., it is
    // part of the principal header card, not the secondary "more details" or
    // any tab body.
    const order = await page.evaluate(() => {
      const reject = document.querySelector('[data-testid="field-rejectReason"]');
      const linesTab = Array.from(document.querySelectorAll('button')).find(
        (b) => /^(Líneas|Lines)/i.test(b.textContent || ''),
      );
      if (!reject || !linesTab) return null;
      return reject.compareDocumentPosition(linesTab) & Node.DOCUMENT_POSITION_FOLLOWING ? 'before-lines' : 'after-lines';
    });
    expect(order).toBe('before-lines');
  });
});
