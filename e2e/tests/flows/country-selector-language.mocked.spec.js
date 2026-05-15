import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Country selector language parameter — smoke (mocked).
 *
 * Validates that when CreateContactModal opens, the country selector
 * endpoint is called with the active locale as the `language` query param
 * (e.g. `language=es_ES`). The backend uses this param to query CountryTrl
 * and return translated country names.
 *
 * Flow:
 * 1. Navigate to sales-invoice list.
 * 2. Click "+ Nueva factura" to open the new-invoice form.
 * 3. Focus the business partner field to reveal the "Create Contact" button.
 * 4. Click it — CreateContactModal mounts and immediately fetches countries.
 * 5. Assert the intercepted C_Country_ID selector URL contains `language=`.
 */

const COUNTRY_ITEMS = [
  { id: '47', label: 'España' },
  { id: '10', label: 'Argentina' },
  { id: '76', label: 'Francia' },
];

async function installMocks(page, { onCountryRequest = null } = {}) {
  // Sales-invoice list — empty payload so the list view mounts
  await page.route('**/sws/neo/sales-invoice/header**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' && !/\/header\/[^/?]+/.test(req.url())) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: { data: [], totalRows: 0 } }),
      });
    }
    route.fallback();
  });

  // Country selector — capture URL, return Spanish names
  await page.route('**/selectors/C_Country_ID**', async (route) => {
    if (onCountryRequest) onCountryRequest(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: COUNTRY_ITEMS, hasMore: false, totalCount: COUNTRY_ITEMS.length }),
    });
  });

  // Bank-account country fallback — same mock
  await page.route('**/bankAccount/selectors/C_Country_ID**', async (route) => {
    if (onCountryRequest) onCountryRequest(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: COUNTRY_ITEMS, hasMore: false, totalCount: COUNTRY_ITEMS.length }),
    });
  });
}

test.describe('Country selector — language parameter', () => {
  test('C_Country_ID selector URL includes language param when CreateContactModal opens', async ({ page }) => {
    let capturedCountryUrl = null;

    await login(page);
    await installMocks(page, {
      onCountryRequest: (url) => { capturedCountryUrl = capturedCountryUrl ?? url; },
    });

    await page.goto('/sales-invoice');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Open a new invoice form
    const newBtn = page.getByTestId('action-new');
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // Click the business partner field to open the dropdown
    const bpField = page.getByTestId('field-businessPartner');
    await expect(bpField).toBeVisible({ timeout: 10_000 });
    await bpField.click();

    // Click "Create Contact" inside the dropdown
    const createBtn = page.getByTestId('action-create-businessPartner');
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await createBtn.click();

    // Wait for CreateContactModal to mount and fire the country fetch
    await expect.poll(() => capturedCountryUrl, { timeout: 8_000 }).not.toBeNull();

    // The key assertion: language param must be present
    expect(capturedCountryUrl).toContain('language=');
  });

  // TODO: investigate the exact UI flow to trigger CreateContactModal in sales-invoice new form.
  // The first test already covers the key assertion (language param in URL).
  // This test exercises the full visual path — needs data-testid on the country select inside
  // EntityCreationModal before it can assert on translated option names.
  test.fixme('CreateContactModal mounts and country fetch resolves with mock data', async ({ page }) => {
    let countryFetched = false;

    await login(page);
    await installMocks(page, { onCountryRequest: () => { countryFetched = true; } });

    await page.goto('/sales-invoice');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const newBtn = page.getByTestId('action-new');
    await expect(newBtn).toBeVisible({ timeout: 10_000 });
    await newBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    const bpField = page.getByTestId('field-businessPartner');
    await expect(bpField).toBeVisible({ timeout: 10_000 });
    await bpField.click();

    const createBtn = page.getByTestId('action-create-businessPartner');
    await expect(createBtn).toBeVisible({ timeout: 5_000 });
    await createBtn.click();

    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 8_000 });

    await expect.poll(() => countryFetched, { timeout: 5_000 }).toBe(true);
  });
});
