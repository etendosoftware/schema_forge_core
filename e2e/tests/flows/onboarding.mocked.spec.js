import { test, expect } from '@playwright/test';

async function installOnboardingMocks(page, { invalidDocumentType = false } = {}) {
  await page.route('**/sws/go/me', async route => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'invalid' } }),
    });
  });

  await page.route('**/sws/go/register', async route => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      name: 'QA Onboarding User',
      email: /qa-onboarding-.+@example\.com/,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'platform-token',
        account: { name: body.name, email: body.email },
      }),
    });
  });

  await page.route('**/sws/go/onboarding', async route => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      clientName: 'QA Mock Company',
      currency: 'EUR',
      language: 'es_ES',
      countryCode: 'ES',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: [
        JSON.stringify({ type: 'progress', step: 'setup', status: 'done', ms: 5 }),
        JSON.stringify({ type: 'progress', step: 'client', status: 'done', ms: 10 }),
        JSON.stringify({ type: 'progress', step: 'organization', status: 'done', ms: 15 }),
        JSON.stringify({ type: 'progress', step: 'finalize', status: 'done', ms: 20 }),
        JSON.stringify({ type: 'result', success: true }),
        '',
      ].join('\n'),
    });
  });

  await page.route('**/sws/go/environments', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        environments: [{
          clientId: 'CLIENT_1',
          clientName: 'QA Mock Company',
          adminUserId: 'USER_1',
          adminUserName: 'QA Admin',
        }],
      }),
    });
  });

  await page.route('**/sws/go/login?userId=USER_1', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'env-token',
        roleList: [{
          id: 'ROLE_1',
          name: 'Admin',
          orgList: [{ id: 'ORG_1', name: 'QA Mock Org' }],
        }],
      }),
    });
  });

  await page.route('**/sws/neo/session', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: 'QA Admin' }),
    });
  });

  await page.route('**/sws/neo/sales-invoice/header/defaults', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documentType: invalidDocumentType ? '0' : 'DOC_TYPE_1' }),
    });
  });

  await page.route('**/sws/neo/sales-invoice/header/selectors/C_PaymentTerm_ID**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'TERM_1', label: 'Immediate' }] }),
    });
  });

  await page.route('**/sws/neo/sales-invoice/header/selectors/C_BPartner_ID**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'BP_1', label: 'QA Customer' }] }),
    });
  });
}

function buildDisposablePassword(suffix) {
  return `Qa-${suffix}-Pass!42`;
}

async function completeOnboardingForm(page, emailPrefix) {
  const suffix = Date.now();
  const password = buildDisposablePassword(suffix);
  await page.goto('/onboarding');

  await page.getByRole('textbox', { name: 'Nombre*' }).fill('QA Onboarding User');
  await page.getByRole('textbox', { name: 'Correo electrónico*' }).fill(`${emailPrefix}-${suffix}@example.com`);
  await page.getByRole('textbox', { name: 'Contraseña*' }).fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByText(/Vamos a dejar todo listo/i)).toBeVisible();
  await page.getByRole('button', { name: /Continuar/ }).click();

  await page.getByRole('textbox', { name: 'Nombre de la empresa*' }).fill('QA Mock Company');
  await page.locator('#fiscalIdValue').fill('B12345678');
  await page.getByRole('textbox', { name: /Dirección/ }).fill('QA Street 123');
  await page.getByRole('button', { name: /Empezar/ }).click();
}

test.describe('Onboarding with mocked Schema Forge backend boundary', () => {

  test('registers, creates environment, verifies readiness, and redirects to dashboard', async ({ page }) => {
    await installOnboardingMocks(page);
    await completeOnboardingForm(page, 'qa-onboarding');

    await page.waitForURL('**/dashboard');
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('sf_auth_token'))).toBe('env-token');
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('sf_auth_selected_org')).id)).toBe('ORG_1');
  });

  test('shows readiness failure instead of redirecting when invoice defaults are invalid', async ({ page }) => {
    await installOnboardingMocks(page, { invalidDocumentType: true });
    await completeOnboardingForm(page, 'qa-onboarding-negative');

    await expect(page.getByText(/todavía no está listo para facturar/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/dashboard/);
  });
});
