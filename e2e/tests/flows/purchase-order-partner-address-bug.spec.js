import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * Bug: Partner Address dropdown is empty after selecting Business Partner.
 *
 * Recorded flow: login -> enter environment ->
 *   Purchase Order -> New Order -> select a Business Partner ->
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

    // Partner Address should be disabled before BP selection.
    // The chip overlay (`-chip`) is gated on !isDisabled, so the input is the
    // only rendering in this state — locating it is enough.
    const partnerAddressInput = page.getByTestId('field-partnerAddress');
    const partnerAddressChip  = page.getByTestId('field-partnerAddress-chip');
    await expect(partnerAddressInput).toBeDisabled();

    // Select the first real backend suggestion without depending on localized labels.
    const bpField = page.getByTestId('field-businessPartner');
    await bpField.click();
    await clickFirstStableOption(page, 'option-businessPartner-');

    // After BP selection, CreatableSearchSelect either:
    //   a) auto-selects the first BP location (FIC parity), which swaps the
    //      input for a Figma chip carrying the address label, or
    //   b) leaves the input enabled — the user opens the dropdown manually.
    // Both paths prove the bug ("empty dropdown") is fixed: in (a) an option
    // was picked, in (b) options are listable. Wait for either state.
    await Promise.race([
      partnerAddressChip.waitFor({ state: 'visible', timeout: 10_000 }),
      partnerAddressInput.waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => expect(partnerAddressInput).toBeEnabled({ timeout: 5_000 })),
    ]);

    if (await partnerAddressChip.isVisible()) {
      // Auto-selected an address → the chip label is the proof that options loaded.
      await expect(partnerAddressChip).toHaveText(/\S/);
    } else {
      // Manual mode → open the dropdown and assert at least one option.
      await partnerAddressInput.click();
      await expect(page.locator('[data-testid^="option-partnerAddress-"]').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

async function clickFirstStableOption(page, testIdPrefix) {
  const options = page.locator(`[data-testid^="${testIdPrefix}"]`);
  await expect(options.first()).toBeVisible({ timeout: 10_000 });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const option = options.first();
    try {
      await option.click({ timeout: 3_000 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(250);
    }
  }
}
