import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Row Quick Actions — smoke (mocked).
 *
 * Validates the ETP-3914 overlay on the four pilot windows: hover reveals the
 * overlay, Edit navigates to detail, Delete opens the confirm modal.
 *
 * Mock mode only: this spec installs window-specific routes on top of the
 * generic /sws/** mock that login() seeds, so it does not need a backend.
 */

const ROWS = [
  { id: 'row-001', documentNo: 'DOC-001', documentStatus: 'DR', 'documentStatus$_identifier': 'Borrador' },
  { id: 'row-002', documentNo: 'DOC-002', documentStatus: 'CO', 'documentStatus$_identifier': 'Completado' },
];

/**
 * Per-window expected buttons (canonical RowQuickActions) derived from each
 * window's custom wiring in `tools/app-shell/src/windows/custom/<w>/index.jsx`.
 *
 *   clone   → window passes `onClone`
 *   email   → window declares `documentPreview: true` + passes `onEmail`
 *   more    → window passes `menuActions` (kebab)
 *
 * Edit and Delete are always expected (Delete fully visible because the test
 * rows do not set `hideDeleteWhenComplete` on draft state).
 */
const FIELDS = {
  'sales-order': {
    extra: { 'businessPartner$_identifier': 'Test BP', grandTotalAmount: 100, deliveryStatus: 50, invoiceStatus: 50, orderDate: '2026-01-15' },
    expects: { clone: true, email: true, more: true },
  },
  'purchase-order': {
    extra: { 'businessPartner$_identifier': 'Test BP', grandTotalAmount: 100, deliveryStatus: 50, invoiceStatus: 50, orderDate: '2026-01-15' },
    expects: { clone: true, email: true, more: true },
  },
  'sales-invoice': {
    extra: { 'businessPartner$_identifier': 'Test BP', grandTotalAmount: 100, invoiceDate: '2026-01-15' },
    expects: { clone: true, email: true, more: false },
  },
  'purchase-invoice': {
    // List shows orderReference (POReference) instead of documentNo — keep the
    // same display text so the row locator works across all four windows.
    extra: { 'businessPartner$_identifier': 'Test BP', grandTotalAmount: 100, invoiceDate: '2026-01-15' },
    docNoField: 'orderReference',
    expects: { clone: true, email: false, more: false },
  },
};

/**
 * Install a list-endpoint mock that returns two synthetic rows for the given
 * spec. Must run AFTER login() — Playwright matches routes in reverse order.
 */
async function installListMock(page, spec) {
  const cfg = FIELDS[spec];
  const docNoField = cfg.docNoField || 'documentNo';
  const rows = ROWS.map(r => ({
    ...r,
    [docNoField]: r.documentNo, // some windows use a different key (e.g. orderReference)
    ...cfg.extra,
  }));
  await page.route(`**/sws/neo/${spec}/header**`, async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'GET' && !/\/header\/[^/?]+/.test(url)) {
      // List fetch
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: rows, totalRows: rows.length } }),
      });
      return;
    }
    // Detail GET — return the matching row so the detail page renders
    if (req.method() === 'GET') {
      const m = url.match(/\/header\/([^/?]+)/);
      const found = rows.find(r => r.id === m?.[1]) ?? rows[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [found] } }),
      });
      return;
    }
    route.fallback();
  });
}

const SPECS = ['sales-order', 'purchase-order', 'sales-invoice', 'purchase-invoice'];

for (const spec of SPECS) {
  test.describe(`Row Quick Actions — ${spec}`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
      await installListMock(page, spec);
      await page.goto(`/${spec}`);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    });

    test('hover reveals the overlay with the expected canonical buttons', async ({ page }) => {
      const firstRow = page.locator('tbody tr').filter({ hasText: 'DOC-001' }).first();
      await expect(firstRow).toBeVisible();
      await firstRow.hover();

      const overlay = firstRow.getByTestId('row-quick-actions');
      await expect(overlay).toBeVisible();

      // Always-on canonical buttons.
      await expect(firstRow.getByTestId('row-quick-action-edit')).toBeVisible();
      await expect(firstRow.getByTestId('row-quick-action-delete')).toBeVisible();

      // Per-window wiring: assert each conditional button is present or absent
      // as declared in the custom window file. Catches regressions where a
      // window stops passing onClone / onEmail / menuActions.
      const { expects } = FIELDS[spec];
      const clone = firstRow.getByTestId('row-quick-action-clone');
      const email = firstRow.getByTestId('row-quick-action-email');
      const more  = firstRow.getByTestId('row-quick-action-more');

      if (expects.clone) await expect(clone).toBeVisible();
      else               await expect(clone).toHaveCount(0);

      if (expects.email) await expect(email).toBeVisible();
      else               await expect(email).toHaveCount(0);

      if (expects.more)  await expect(more).toBeVisible();
      else               await expect(more).toHaveCount(0);
    });

    test('Edit button navigates to detail view', async ({ page }) => {
      const firstRow = page.locator('tbody tr').filter({ hasText: 'DOC-001' }).first();
      await firstRow.hover();
      await firstRow.getByTestId('row-quick-action-edit').click();
      await expect(page).toHaveURL(new RegExp(`/${spec}/row-001`));
    });

    test('Delete button opens confirm modal and Cancel dismisses it', async ({ page }) => {
      const firstRow = page.locator('tbody tr').filter({ hasText: 'DOC-001' }).first();
      await firstRow.hover();
      const deleteBtn = firstRow.getByTestId('row-quick-action-delete');
      if (await deleteBtn.count() === 0) test.skip(true, 'Delete hidden for this row state');

      await deleteBtn.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button').filter({ hasNotText: /delete|eliminar/i }).first().click();
      await expect(dialog).toBeHidden();
    });
  });
}
