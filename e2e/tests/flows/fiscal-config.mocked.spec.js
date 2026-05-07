import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';
import { t } from '../helpers/i18n.js';

// ── NEO API response envelope ─────────────────────────────────────────────────

function neoOk(records) {
  return {
    response: { status: 0, data: records, totalRows: records.length },
  };
}

// ── Fixture records ───────────────────────────────────────────────────────────

const SII_RECORD = {
  configuracinSII: 'e2e-sii-001',
  acogidaAlSII: 'N',
  entornoDeProduccin: 'N',
  navarra: 'N',
  guipuzcoa: 'N',
};

const SII_NAVARRA_RECORD = { ...SII_RECORD, navarra: 'Y' };

const TBAI_RECORD = {
  tbaiConfigID: 'e2e-tbai-001',
  etsgSifTerritory: 'ARABA',
  entornoDeProduccin: 'N',
};

const VERIFACTU_RECORD = {
  verifactuConfig: 'e2e-vf-001',
  tAXType: '01',
  defaultQR: 'N',
};

// ── Route helpers ─────────────────────────────────────────────────────────────

async function installFiscalConfigMocks(page, { sii = null, tbai = null, verifactu = null } = {}) {
  await page.route('**/sws/neo/sii-config/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(neoOk(sii ? [sii] : [])),
    });
  });

  await page.route('**/sws/neo/tbai-config/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(neoOk(tbai ? [tbai] : [])),
    });
  });

  await page.route('**/sws/neo/verifactu-config/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(neoOk(verifactu ? [verifactu] : [])),
    });
  });
}

async function loginWithOrg(page) {
  await page.addInitScript(() => {
    localStorage.setItem('sf_auth_selected_role', JSON.stringify({ id: 'r1', name: 'Admin', orgList: [] }));
    localStorage.setItem('sf_auth_rolelist', JSON.stringify([{ id: 'r1', name: 'Admin', orgList: [] }]));
    localStorage.setItem('sf_auth_selected_org', JSON.stringify({ id: 'ORG_E2E', name: 'E2E Test Org' }));
  });
  await login(page);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Fiscal Config — no org selected', () => {
  test('shows the no-org message when session has no selected organisation', async ({ page }) => {
    await login(page);
    await navigateTo(page, 'fiscal-config');
    await expect(page.getByText(t('fiscal.noOrg'))).toBeVisible();
  });
});

test.describe('Fiscal Config — unconfigured (wizard)', () => {
  test('shows the onboarding wizard territory screen when no fiscal records exist', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page); // all null → unconfigured
    await navigateTo(page, 'fiscal-config');

    await expect(
      page.getByText(t('fiscal.onboarding.territory.title')),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('WIP badge is visible on the wizard screen', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page);
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.wip.badge'))).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Fiscal Config — SII profile', () => {
  test('shows the SII configuration section when an SII record exists', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { sii: SII_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.sii.field.enrolled'))).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(t('fiscal.wip.badge'))).toBeVisible();
  });

  test('shows the Navarra SII section when the SII record has navarra=Y', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { sii: SII_NAVARRA_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.sii.field.enrolled'))).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(t('fiscal.sii.badge.navarra'))).toBeVisible();
  });
});

test.describe('Fiscal Config — TBAI profile', () => {
  test('shows the TBAI configuration section when a TBAI record exists', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { tbai: TBAI_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.tbai.field.enrollDate'))).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Fiscal Config — Verifactu profile', () => {
  test('shows the Verifactu configuration section when a Verifactu record exists', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { verifactu: VERIFACTU_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(
      page.getByText(t('fiscal.verifactu.unlocked.badge')).or(page.getByText(t('fiscal.verifactu.locked.badge'))),
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Fiscal Config — SII+TBAI combined profile', () => {
  test('shows both SII and TBAI sections when both records exist', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { sii: SII_RECORD, tbai: TBAI_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.sii.field.enrolled'))).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(t('fiscal.tbai.field.enrollDate'))).toBeVisible();
  });
});

test.describe('Fiscal Config — conflict state', () => {
  test('shows the conflict warning when both Verifactu and SII records exist', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { sii: SII_RECORD, verifactu: VERIFACTU_RECORD });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.conflict.title'))).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Fiscal Config — wizard interaction', () => {
  test('selecting a territory and clicking Continuar advances to the confirm screen', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page); // unconfigured → wizard
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.onboarding.territory.title'))).toBeVisible({ timeout: 8_000 });

    // Click the Navarra territory card (no sub-question → goes straight to confirm)
    await page.getByRole('button', { name: new RegExp(t('fiscal.territory.navarra')) }).click();
    await page.getByRole('button', { name: t('fiscal.onboarding.continue') }).click();

    await expect(page.getByText(t('fiscal.onboarding.confirm.title'))).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(t('fiscal.territory.navarra'), { exact: true }).first()).toBeVisible();
  });

  test('Back button on confirm screen returns to territory selection', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page);
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.onboarding.territory.title'))).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: new RegExp(t('fiscal.territory.navarra')) }).click();
    await page.getByRole('button', { name: t('fiscal.onboarding.continue') }).click();
    await expect(page.getByText(t('fiscal.onboarding.confirm.title'))).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: t('fiscal.onboarding.back') }).click();
    await expect(page.getByText(t('fiscal.onboarding.territory.title'))).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Fiscal Config — certificate upload modal', () => {
  test('clicking Subir certificado opens the cert modal for the SII section', async ({ page }) => {
    await loginWithOrg(page);
    await installFiscalConfigMocks(page, { sii: SII_RECORD });
    await page.route('**/certificate**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false }),
      });
    });
    await navigateTo(page, 'fiscal-config');

    await expect(page.getByText(t('fiscal.cert.section.legend'))).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: t('fiscal.cert.upload') })).toBeVisible();

    await page.getByRole('button', { name: t('fiscal.cert.upload') }).click();

    await expect(page.getByText(t('fiscal.cert.modal.title'))).toBeVisible({ timeout: 4_000 });
    await expect(page.getByText(t('fiscal.cert.dropzone.drag'))).toBeVisible();
  });
});
