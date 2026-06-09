import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Onboarding — Real integration E2E: register a new user, complete profile,
 * select "Autónomo" business type, and verify the greeting.
 *
 * Requires a running Etendo GO backend (localhost:3100 by default).
 * Skipped unless E2E_ONBOARDING_INTEGRATION=1 is set.
 *
 * Each run creates a unique user (random suffix) so the test is repeatable.
 */

const RUN_INTEGRATION = process.env.E2E_ONBOARDING_INTEGRATION === '1';
const SLOW_MS = Number(process.env.E2E_SLOW_MS || 0);

function uniqueSuffix() {
  return randomBytes(4).toString('hex');
}

async function slow(page) {
  if (SLOW_MS > 0) await page.waitForTimeout(SLOW_MS);
}

test.describe('Onboarding — Register new user (integration)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    !RUN_INTEGRATION,
    'Set E2E_ONBOARDING_INTEGRATION=1 to run this live onboarding integration test.',
  );

  test('registers a new user, selects Autónomo, and verifies greeting', async ({ page }) => {
    const suffix = uniqueSuffix();
    const userName = `E2E User ${suffix}`;
    const userEmail = `e2e-${suffix}@test-onboarding.com`;
    const userPassword = `E2e-${suffix}-Pass!99`;

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Navigate to onboarding and fill registration form
    // ═══════════════════════════════════════════════════════════════════════

    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /crea tu cuenta gratis/i })).toBeVisible();

    await page.locator('#reg-name').fill(userName);
    await slow(page);
    await page.locator('#reg-email').fill(userEmail);
    await slow(page);
    await page.locator('#reg-password').fill(userPassword);
    await slow(page);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Click "Crear cuenta"
    // ═══════════════════════════════════════════════════════════════════════

    await page.getByTestId('action-register-submit').click();
    await slow(page);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Profile step — verify greeting contains the user name
    // ═══════════════════════════════════════════════════════════════════════

    await expect(page.getByText(/vamos a dejar todo listo/i)).toBeVisible({ timeout: 15_000 });

    // The greeting should include the user's first name (first word of userName)
    const firstName = userName.split(' ')[0];
    await expect(page.getByRole('heading', { name: new RegExp(`Hola ${firstName}`, 'i') })).toBeVisible();

    // Full name should be pre-filled
    const fullNameInput = page.locator('#fullName');
    await expect(fullNameInput).toHaveValue(userName);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Select "Autónomo" business type
    // ═══════════════════════════════════════════════════════════════════════

    await page.getByText(/autónomo|autonomo/i).first().click();
    await slow(page);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Click "Continuar"
    // ═══════════════════════════════════════════════════════════════════════

    const continueBtn = page.getByRole('button', { name: /continuar|continue/i });
    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();
    await slow(page);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Company step — fill company name, NIF, and click "Empezar"
    // ═══════════════════════════════════════════════════════════════════════

    await expect(page.locator('#clientName')).toBeVisible({ timeout: 10_000 });

    await page.locator('#clientName').fill(`Empresa E2E ${suffix}`);
    await slow(page);
    await page.locator('#fiscalIdValue').fill('12345678Z');
    await slow(page);

    const startBtn = page.getByRole('button', { name: /empezar|start/i });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await slow(page);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 7: Provisioning progress + success message
    // ═══════════════════════════════════════════════════════════════════════

    // A progress/success screen should appear while the environment is created
    await expect(
      page.getByText(/listo|completado|creando|configurando|todo listo|ready|success/i).first()
    ).toBeVisible({ timeout: 60_000 });

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 8: Redirect to dashboard
    // ═══════════════════════════════════════════════════════════════════════

    await page.waitForURL('**/dashboard', { timeout: 60_000 });
    await expect(page).toHaveURL(/dashboard/);

    // Save credentials so downstream integration tests (e.g. contacts) can reuse this user
    const credentialsPath = resolve(import.meta.dirname, '../../.auth-credentials.json');
    writeFileSync(credentialsPath, JSON.stringify({ email: userEmail, password: userPassword }, null, 2));
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CORNER CASE 1: Duplicate email — register the same email twice
  // ═════════════════════════════════════════════════════════════════════════

  test('shows error when registering with an already used email', async ({ page, context }) => {
    const suffix = uniqueSuffix();
    const email = `e2e-dup-${suffix}@test-onboarding.com`;
    const password = `E2e-${suffix}-Pass!99`;

    // First registration — should succeed
    await page.goto('/onboarding');
    await page.locator('#reg-name').fill('Dup User');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill(password);
    await page.getByTestId('action-register-submit').click();
    await expect(page.getByText(/vamos a dejar todo listo/i)).toBeVisible({ timeout: 15_000 });
    await slow(page);

    // Clear session so we land on the register form again
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Second registration — same email, fresh session
    await page.goto('/onboarding');
    await expect(page.locator('#reg-name')).toBeVisible({ timeout: 10_000 });
    await page.locator('#reg-name').fill('Dup User Again');
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill(password);
    await slow(page);
    await page.getByTestId('action-register-submit').click();

    // Should show an error (email already registered)
    const errorBox = page.locator('.border-rose-200');
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
    await expect(errorBox).toContainText(/ya está registrado|already registered/i);
    await slow(page);

    // Should stay on the register page
    await expect(page.getByRole('heading', { name: /crea tu cuenta gratis/i })).toBeVisible();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CORNER CASE 2: Empty fields — submit button disabled or validation
  // ═════════════════════════════════════════════════════════════════════════

  test('cannot submit registration with empty fields', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { name: /crea tu cuenta gratis/i })).toBeVisible();

    const submitBtn = page.getByTestId('action-register-submit');

    // Try clicking with all fields empty
    await submitBtn.click();
    await slow(page);

    // Should still be on register page — no navigation happened
    await expect(page.getByRole('heading', { name: /crea tu cuenta gratis/i })).toBeVisible();
    // Profile step should NOT be visible
    await expect(page.getByText(/vamos a dejar todo listo/i)).not.toBeVisible();

    // Fill only name — still should not advance
    await page.locator('#reg-name').fill('Only Name');
    await submitBtn.click();
    await slow(page);
    await expect(page.getByText(/vamos a dejar todo listo/i)).not.toBeVisible();

    // Fill name + email but no password — still should not advance
    await page.locator('#reg-email').fill('nopass@test.com');
    await submitBtn.click();
    await slow(page);
    await expect(page.getByText(/vamos a dejar todo listo/i)).not.toBeVisible();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CORNER CASE 3: Invalid email format — browser validation prevents submit
  // ═════════════════════════════════════════════════════════════════════════

  test('does not advance with an invalid email format', async ({ page }) => {
    await page.goto('/onboarding');

    await page.locator('#reg-name').fill('Bad Email User');
    await page.locator('#reg-email').fill('not-an-email');
    await page.locator('#reg-password').fill('ValidPass!99');
    await slow(page);

    await page.getByTestId('action-register-submit').click();
    await slow(page);

    // Should NOT advance to profile step — HTML5 email validation blocks it
    await expect(page.getByText(/vamos a dejar todo listo/i)).not.toBeVisible({ timeout: 3_000 });
    // Should still be on the register page
    await expect(page.getByRole('heading', { name: /crea tu cuenta gratis/i })).toBeVisible();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CORNER CASE 4: Empty name on profile step — Continuar disabled
  // ═════════════════════════════════════════════════════════════════════════

  test('cannot continue on profile step with empty name', async ({ page }) => {
    const suffix = uniqueSuffix();
    await page.goto('/onboarding');

    await page.locator('#reg-name').fill(`Profile User ${suffix}`);
    await page.locator('#reg-email').fill(`e2e-profile-${suffix}@test-onboarding.com`);
    await page.locator('#reg-password').fill(`E2e-${suffix}-Pass!99`);
    await page.getByTestId('action-register-submit').click();

    await expect(page.getByText(/vamos a dejar todo listo/i)).toBeVisible({ timeout: 15_000 });

    // Clear the pre-filled name
    const fullNameInput = page.locator('#fullName');
    await fullNameInput.clear();
    await slow(page);

    // Continuar should be disabled
    const continueBtn = page.getByRole('button', { name: /continuar|continue/i });
    await expect(continueBtn).toBeDisabled();
    await slow(page);

    // Fill name back — should be enabled again
    await fullNameInput.fill('Recovered Name');
    await expect(continueBtn).toBeEnabled();
  });
});
