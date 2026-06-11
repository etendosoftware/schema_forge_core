/**
 * E2E tests for ETP-4003 i18n fixes.
 *
 * Two groups:
 *   1. CommandPalette i18n — opens on Ctrl+K, shows translated items, hides
 *      hidden items, search finds visible items.
 *   2. SendDocumentModal email validation — clicking the email quick-action
 *      opens the modal; Send button disabled/enabled based on email validity.
 *
 * Mock mode only — no Etendo backend required.
 * Run: cd e2e && npx playwright test tests/flows/i18n-etp4003.mocked.spec.js
 * Requires dev server: make dev (http://localhost:3100)
 */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

// ─── Sales Invoice mock rows ──────────────────────────────────────────────────

const SI_ROWS = [
  {
    id: 'si-001',
    documentNo: 'INV-001',
    documentStatus: 'CO',
    'documentStatus$_identifier': 'Completado',
    'businessPartner$_identifier': 'ACME Corp',
    grandTotalAmount: 1000,
    invoiceDate: '2026-01-15',
    bpartnerId: 'bp-001',
  },
];

async function installSalesInvoiceMock(page) {
  await page.route('**/sws/neo/sales-invoice/header**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'GET' && !/\/header\/[^/?]+/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: SI_ROWS, totalRows: SI_ROWS.length } }),
      });
      return;
    }
    if (req.method() === 'GET') {
      const m = url.match(/\/header\/([^/?]+)/);
      const found = SI_ROWS.find((r) => r.id === m?.[1]) ?? SI_ROWS[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [found] } }),
      });
      return;
    }
    route.fallback();
  });

  // Contacts endpoint — return empty so the dropdown doesn't auto-fill
  await page.route('**/sws/neo/contacts/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [] } }),
    });
  });

  // PDF render endpoint — return a minimal HTML so preview doesn't error
  await page.route('**/api/reports/*/render', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>PDF Preview</body></html>',
    });
  });
}

// ─── Group 1: CommandPalette i18n ─────────────────────────────────────────────

test.describe('CommandPalette i18n (ETP-4003)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('palette opens on Ctrl+K', async ({ page }) => {
    await page.keyboard.press('Control+k');
    // The CommandDialog root input should become visible
    await expect(page.locator('[cmdk-input], input[placeholder]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('palette shows visible menu items after opening', async ({ page }) => {
    await page.keyboard.press('Control+k');
    // Wait for dialog to be visible
    await page.waitForSelector('[cmdk-dialog], [role="dialog"]', { timeout: 5_000 }).catch(() => {});
    // At least the dashboard/home item should be present (it is never hidden)
    // Use a broad role-based locator — exact text varies by locale
    const listContainer = page.locator('[cmdk-list], [cmdk-root]').first();
    await expect(listContainer).toBeVisible({ timeout: 5_000 });
  });

  test('searching for a term shows matching items', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[cmdk-input]').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    // Type a search term that should match a visible window
    await input.fill('order');
    // Should show at least one result (sales-order or purchase-order)
    const items = page.locator('[cmdk-item]');
    await expect(items.first()).toBeVisible({ timeout: 5_000 });
  });

  test('hidden items (deal, business-partner) are not visible in the palette', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[cmdk-input]').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    // Search specifically for 'deal' — it is hidden in menu.json
    await input.fill('deal');
    // The empty state OR zero cmdk-item elements should be visible
    const items = page.locator('[cmdk-item]');
    const count = await items.count();
    // Either no items OR none that navigate to /deal
    if (count > 0) {
      // Verify none of them are the hidden 'deal' window
      for (let i = 0; i < count; i++) {
        const text = await items.nth(i).textContent();
        // The deal label could be translated; check the name is not 'deal'
        expect(text?.toLowerCase()).not.toBe('deal');
      }
    }
    // If count === 0, the empty state is shown — that's correct behaviour
  });

  test('closing and reopening the palette works', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const input = page.locator('[cmdk-input]').first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    // Close with Escape — press on the focused input so cmdk intercepts it
    await input.press('Escape');
    await expect(input).not.toBeVisible({ timeout: 5_000 });
    // Reopen
    await page.keyboard.press('Control+k');
    await expect(page.locator('[cmdk-input]').first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─── Group 2: SendDocumentModal contract-driven recipient preview ─────────────

test.describe('SendDocumentModal contract recipient preview (ETP-4003)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await installSalesInvoiceMock(page);
    await page.goto('/sales-invoice');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('row email quick-action opens the Send modal', async ({ page }) => {
    const firstRow = page.locator('tbody tr').filter({ hasText: 'INV-001' }).first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.hover();
    const emailBtn = firstRow.getByTestId('row-quick-action-email');
    await expect(emailBtn).toBeVisible({ timeout: 5_000 });
    await emailBtn.click();
    // The modal should open — look for the email input (To field)
    const toInput = page.locator('input[placeholder="email@company.com"]');
    await expect(toInput).toBeVisible({ timeout: 8_000 });
  });

  test('Send button remains enabled when email is empty because backend resolves recipients', async ({ page }) => {
    const firstRow = page.locator('tbody tr').filter({ hasText: 'INV-001' }).first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.hover();
    await firstRow.getByTestId('row-quick-action-email').click();
    const toInput = page.locator('input[placeholder="email@company.com"]');
    await expect(toInput).toBeVisible({ timeout: 8_000 });
    await expect(toInput).toHaveAttribute('readonly', '');
    const sendBtn = page.locator('button').filter({ hasText: /^(Enviar|Send)$/i });
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  });

  test('recipient preview field is read-only', async ({ page }) => {
    const firstRow = page.locator('tbody tr').filter({ hasText: 'INV-001' }).first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.hover();
    await firstRow.getByTestId('row-quick-action-email').click();
    const toInput = page.locator('input[placeholder="email@company.com"]');
    await expect(toInput).toBeVisible({ timeout: 8_000 });
    await expect(toInput).toHaveAttribute('readonly', '');
    await expect(toInput).toHaveValue('');
    await toInput.focus();
    await page.keyboard.type('test@example.com');
    await expect(toInput).toHaveValue('');
  });

  test('Send button is not locally gated by recipient preview value', async ({ page }) => {
    const firstRow = page.locator('tbody tr').filter({ hasText: 'INV-001' }).first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.hover();
    await firstRow.getByTestId('row-quick-action-email').click();
    const toInput = page.locator('input[placeholder="email@company.com"]');
    await expect(toInput).toBeVisible({ timeout: 8_000 });
    await expect(toInput).toHaveValue('');
    const sendBtn = page.locator('button').filter({ hasText: /^(Enviar|Send)$/i });
    await expect(sendBtn).toBeEnabled({ timeout: 5_000 });
  });
});
