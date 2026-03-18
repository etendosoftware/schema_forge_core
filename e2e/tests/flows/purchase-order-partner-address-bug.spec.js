import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Bug: Partner Address dropdown is empty after selecting Business Partner.
 *
 * Recorded flow: login → switch to Group Admin + España Norte →
 *   Purchase Order → New Order → select "Bebidas Alegres, S.L." →
 *   Partner Address combobox has no options (should list BP locations).
 *
 * Expected: after selecting a Business Partner, the Partner Address
 * dropdown should load that BP's locations and auto-select the first one
 * (or at least show available options).
 */

test.describe('Purchase Order - Partner Address Bug', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateTo(page, 'purchase-order');
  });

  test('Partner Address loads options after selecting Business Partner', async ({ page }) => {
    // Open new order form
    await page.getByTestId('action-new').click();
    await expect(page.getByTestId('detail-view')).toBeVisible();

    // Partner Address should be disabled before BP selection
    const partnerAddress = page.getByTestId('field-partnerAddress');
    await expect(partnerAddress).toBeDisabled();

    // Search and select a Business Partner via data-testid
    const bpField = page.getByTestId('field-businessPartner');
    await bpField.fill('Bebidas');
    await page.waitForTimeout(1_500);

    // Click the suggestion
    await page.getByRole('button', { name: 'Bebidas Alegres, S.L.' }).click();
    await page.waitForTimeout(2_000);

    // Partner Address should now be enabled
    await expect(partnerAddress).toBeEnabled({ timeout: 5_000 });

    // BUG: The dropdown should have options, not be empty
    // Open the dropdown and check for options
    await partnerAddress.click();
    await page.waitForTimeout(1_000);

    // There should be at least one selectable option (a BP location)
    const options = page.getByRole('option');
    const optionCount = await options.count();

    expect(optionCount, 'Partner Address should have at least one location option').toBeGreaterThan(0);
  });
});
