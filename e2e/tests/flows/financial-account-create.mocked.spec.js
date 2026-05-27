import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Offline financial account creation — smoke (mocked).
 *
 * Validates the ETP-4096 (T2) "New Account" wizard reachable from the Cuentas
 * page: type picker → (Bank) connection toggle → bank picker → institution →
 * form → submit. The create POST is mocked to 201 and the defaults GET to a
 * single-currency list so the wizard can pre-select EUR.
 *
 * Mock mode only: installs the `financial-account` defaults + create handlers
 * and the `financial-accounts-page` list AFTER the generic /sws/** stub seeded
 * by login() so the specific handlers win (Playwright matches routes in reverse
 * registration order).
 *
 * Default app locale is es_ES (see useLocaleState.DEFAULT_LOCALE), so the copy
 * assertions target the Spanish strings.
 *
 * Status: authored to follow the existing mocked-spec patterns; run with
 *   cd e2e && npm test -- tests/flows/financial-account-create.mocked.spec.js
 * (requires the same dev server the sibling financial-account specs use).
 */

const ACCOUNTS = [
  {
    id: 'acc-1',
    name: 'BBVA',
    type: 'B',
    currentBalance: 1000,
    currencyId: '102',
    currencyIso: 'EUR',
    iban: 'ES1212340000000000000001',
    isDefault: true,
    pendingCount: 0,
    psd2Connected: false,
  },
];

const SUMMARY = {
  totalBalance: 1000,
  byCurrency: [{ currencyIso: 'EUR', total: 1000 }],
  pending: { accountsWithPending: 0, suggestionsReady: 0, byRule: 0 },
};

const DEFAULTS = {
  defaultCurrencyId: '102',
  defaultCurrencyIso: 'EUR',
  currencies: [{ id: '102', iso: 'EUR', symbol: '€' }],
};

/**
 * Installs the financial-account mocks. The defaults + create handlers must be
 * registered before the broader list handler so the action routes are matched
 * first, and all of them after login()'s generic /sws/** stub.
 *
 * @param {import('@playwright/test').Page} page the test page
 * @param {() => void} onCreate called when the create POST is intercepted
 */
async function installCreateMocks(page, onCreate) {
  // GET ?action=defaults → currency list + session default.
  await page.route('**/sws/neo/financial-account?action=defaults', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: DEFAULTS } }),
    });
  });

  // POST /financial-account (no action) → 201 created.
  await page.route('**/sws/neo/financial-account', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') {
      await route.fallback();
      return;
    }
    onCreate?.();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: { id: 'acc-new', name: 'Cuenta BBVA' } } }),
    });
  });

  // List endpoint — used by the Cuentas page (and re-fetched after create).
  await page.route('**/sws/neo/financial-accounts-page', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: { accounts: ACCOUNTS, summary: SUMMARY } } }),
    });
  });
}

test.describe('Financial Account Create (T2) — mocked', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('walks Bank → Sin conexión → Santander → institution → form → submit', async ({ page }) => {
    let created = false;
    await installCreateMocks(page, () => {
      created = true;
    });

    await page.goto('/finance/accounts');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Open the wizard from the Cuentas toolbar.
    await page.getByTestId('cuentas-new-account-button').click();
    await expect(page.getByTestId('new-account-wizard')).toBeVisible();

    // Step 1: pick the Bank type.
    await page.getByTestId('new-account-type-B').click();

    // Step 2: connection toggle — "Con conexión" is disabled, pick "Sin conexión".
    await expect(page.getByTestId('account-connection-toggle')).toBeVisible();
    await expect(page.getByTestId('account-connection-online')).toBeDisabled();
    await page.getByTestId('account-connection-offline').click();

    // Step 3: bank picker — search then pick Santander.
    await expect(page.getByTestId('new-account-bank-search')).toBeVisible();
    await page.getByTestId('new-account-bank-search').fill('santander');
    await page.getByTestId('new-account-bank-santander').click();

    // Step 4: institution list — pick the first variant.
    await expect(page.getByTestId('new-account-institution-add')).toBeVisible();
    await page.getByTestId('new-account-institution-santander-default').click();

    // Step 5: the form. Currency is pre-selected from defaults (EUR).
    await expect(page.getByTestId('account-form')).toBeVisible();
    await page.getByTestId('account-form-name').fill('Cuenta BBVA');
    await page.getByTestId('account-form-iban').fill('ES9121000418450200051332');

    // Submit must be enabled and fire the create POST.
    const submit = page.getByTestId('account-form-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    // Success toast (es_ES) + the create POST landed.
    await expect(page.getByText('Cuenta creada')).toBeVisible();
    expect(created).toBe(true);

    // The wizard closes after a successful create.
    await expect(page.getByTestId('new-account-wizard')).toHaveCount(0);
  });

  test('blocks submit and shows the IBAN error for an invalid IBAN', async ({ page }) => {
    await installCreateMocks(page);

    await page.goto('/finance/accounts');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    await page.getByTestId('cuentas-new-account-button').click();
    await page.getByTestId('new-account-type-B').click();
    await page.getByTestId('account-connection-offline').click();
    await page.getByTestId('new-account-bank-santander').click();
    await page.getByTestId('new-account-institution-santander-default').click();

    await page.getByTestId('account-form-name').fill('Cuenta BBVA');
    await page.getByTestId('account-form-iban').fill('ES00INVALID0000');
    // Blur the IBAN to surface the inline error.
    await page.getByTestId('account-form-name').click();

    await expect(page.getByTestId('account-form-iban-error')).toBeVisible();
    await expect(page.getByTestId('account-form-submit')).toBeDisabled();
  });

  test('Caja type goes straight to the cash form (no IBAN)', async ({ page }) => {
    await installCreateMocks(page);

    await page.goto('/finance/accounts');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    await page.getByTestId('cuentas-new-account-button').click();
    await page.getByTestId('new-account-type-C').click();

    await expect(page.getByTestId('account-form')).toBeVisible();
    await expect(page.getByTestId('account-form-iban')).toHaveCount(0);
  });
});
