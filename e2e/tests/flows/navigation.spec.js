import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';
import { dashboard } from '../helpers/selectors.js';

/**
 * Navigation flow tests.
 * Selectors discovered via agent-browser on 2026-03-18.
 */

test.describe('Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads after login', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
  });

  test('dashboard shows quick-action links', async ({ page }) => {
    await expect(page.getByRole('link', { name: '+ Order' })).toBeVisible();
    await expect(page.getByRole('link', { name: '+ Invoice' })).toBeVisible();
    await expect(page.getByRole('link', { name: '+ Contact' })).toBeVisible();
    await expect(page.getByRole('link', { name: '+ Product' })).toBeVisible();
  });

  test('quick-action link navigates to window', async ({ page }) => {
    await page.getByRole('link', { name: '+ Order' }).click();
    await expect(page).toHaveURL(/sales-order/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('browser back/forward works', async ({ page }) => {
    // Dashboard → sales-order → back → forward
    await page.getByRole('link', { name: '+ Order' }).click();
    await expect(page).toHaveURL(/sales-order/);

    await page.goBack();
    await expect(page).toHaveURL(/dashboard/);

    await page.goForward();
    await expect(page).toHaveURL(/sales-order/);
  });
});
