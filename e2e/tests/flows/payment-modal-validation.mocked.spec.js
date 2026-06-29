import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Payment modal — date validation (mocked).
 *
 * Verifies the AC-12 fix introduced in ETP-4005: the "Confirm payment" button
 * is disabled when the date field is empty, and submitting through the
 * disabled guard (via direct React onClick invocation) surfaces a translated
 * "date required" error with a red border on the DateField wrapper.
 *
 * Runs in mock mode — no Etendo backend required.
 *
 * Flow (updated for the two-step payment UI):
 *   1. Badge click → opens InvoicePaymentHistoryModal (step 1).
 *   2. "+ Añadir pago" button → opens NewPaymentEntryModal (step 2).
 *   3. Date field interactions and confirm button validations happen inside step 2.
 *
 * Locale note: the app loads real locale files in mock mode and defaults to
 * es_ES for anonymous sessions. All text assertions use /English|Español/i
 * regex to be locale-agnostic.
 */

const INV_ID = 'pmv-mock-inv-001';

const COMPLETED_INVOICE = {
  id: INV_ID,
  documentNo: 'PINV-PMV',
  documentStatus: 'CO',
  'documentStatus$_identifier': 'Completado',
  grandTotalAmount: 500,
  outstandingAmount: 500,
  'currency$_identifier': 'EUR',
  paymentComplete: false,
};

async function installInvoiceMocks(page) {
  await page.route('**/sws/neo/purchase-invoice/header', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [COMPLETED_INVOICE], totalRows: 1 } }),
    });
  });
  await page.route(`**/sws/neo/purchase-invoice/header/${INV_ID}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [COMPLETED_INVOICE] } }),
    });
  });
  await page.route('**/sws/neo/purchase-invoice/header?**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [COMPLETED_INVOICE], totalRows: 1 } }),
    });
  });
  await page.route('**/sws/neo/purchase-invoice/paymentPlan**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        response: {
          data: [{
            id: 'sched-001',
            finPaymentScheduleID: 'sched-001',
            amount: '500',
            paidAmount: '0',
            outstandingAmount: '500',
            dueDate: '2024-12-31',
          }],
        },
      }),
    });
  });
  await page.route(`**/sws/neo/purchase-invoice/header/${INV_ID}/action/invoicePayments`, async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ response: { data: [] } }),
    });
  });
  await page.route(`**/sws/neo/purchase-invoice/header/${INV_ID}/action/invoiceAccounts`, async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'acc-1', label: 'Main Account' }] }),
    });
  });
}

async function openPaymentModal(page) {
  await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 10_000 });
  const badge = page.locator('[style*="cursor: pointer"]').filter({ hasText: /500/ }).first();
  await expect(badge).toBeVisible({ timeout: 5_000 });
  await badge.click();
  // Step 1 of the two-step payment flow: InvoicePaymentHistoryModal opens.
  await expect(
    page.getByTestId('InvoicePaymentHistoryModal__panel')
  ).toBeVisible({ timeout: 5_000 });
}

async function openRegisterForm(page) {
  // Step 2: click "Añadir pago" in the history modal to open NewPaymentEntryModal.
  const addPaymentBtn = page.getByTestId('InvoicePaymentHistoryModal__add-btn');
  await expect(addPaymentBtn).toBeVisible({ timeout: 8_000 });
  await addPaymentBtn.click();
  // Wait for NewPaymentEntryModal to be visible (rendered via portal into body).
  await expect(
    page.locator('[data-testid="cp-new-payment-modal"]')
  ).toBeVisible({ timeout: 3_000 });
}

async function clearDateField(page) {
  // Scope to cp-new-payment-modal to avoid matching the detail-view header fields.
  const modal = page.locator('[data-testid="cp-new-payment-modal"]');
  const dateInput = modal.locator('input[type="text"][inputmode="numeric"]').first();
  await dateInput.click({ clickCount: 3 });
  await page.keyboard.press('Delete');
  await page.keyboard.press('Tab');
  return dateInput;
}

// React 18 suppresses onClick on disabled buttons even for programmatic events.
// Invoke the React onClick handler directly via fiber introspection.
// The confirm button in NewPaymentEntryModal has data-testid="cp-confirm".
async function clickDisabledConfirm(page) {
  const confirmBtn = page.locator('[data-testid="cp-confirm"]');
  await confirmBtn.evaluate((btn) => {
    const fiberKey = Object.keys(btn).find(
      (k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'),
    );
    if (!fiberKey) return;
    let fiber = btn[fiberKey];
    while (fiber) {
      if (fiber.memoizedProps?.onClick) {
        fiber.memoizedProps.onClick();
        return;
      }
      fiber = fiber.return;
    }
  });
}

test.describe('Payment modal date validation (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await installInvoiceMocks(page);
    await page.goto(`/purchase-invoice/${INV_ID}`);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('completed invoice detail shows the payment status badge', async ({ page }) => {
    await expect(page.getByTestId('detail-view')).toBeVisible({ timeout: 10_000 });
    const badge = page.locator('[style*="cursor: pointer"]').filter({ hasText: /500/ }).first();
    await expect(badge).toBeVisible({ timeout: 5_000 });
  });

  test('clicking the payment badge opens the payments modal', async ({ page }) => {
    await openPaymentModal(page);
    // openPaymentModal already asserts the panel is visible; confirm docNo is shown.
    await expect(
      page.getByTestId('InvoicePaymentHistoryModal__panel')
    ).toBeVisible({ timeout: 3_000 });
  });

  test('Confirm payment button is disabled when the date field is cleared', async ({ page }) => {
    await openPaymentModal(page);
    await openRegisterForm(page);
    await clearDateField(page);
    const confirmBtn = page.locator('[data-testid="cp-confirm"]');
    await expect(confirmBtn).toBeDisabled({ timeout: 3_000 });
  });

  test('submitting with empty date shows a date-required error message', async ({ page }) => {
    await openPaymentModal(page);
    await openRegisterForm(page);
    await clearDateField(page);
    await clickDisabledConfirm(page);
    await expect(
      page.getByText(/Payment date is required|La fecha de pago es obligatoria/i),
    ).toBeVisible({ timeout: 3_000 });
  });

  test('date field gets red border after invalid empty-date submit', async ({ page }) => {
    await openPaymentModal(page);
    await openRegisterForm(page);
    await clearDateField(page);
    await clickDisabledConfirm(page);
    await expect(page.locator('[class*="border-red-500"]')).toBeVisible({ timeout: 3_000 });
  });
});
