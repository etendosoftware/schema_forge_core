import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { login } from '../helpers/auth.js';

/**
 * General Ledger Configuration ("Configuración contable", AD window 125) —
 * visual-capture spec (mocked).
 *
 * PURPOSE: this is the Phase-4 G11 *capture seed*, NOT the full acceptance suite.
 * The backend is greenfield (no NEO spec serves window 125), so the window draws
 * entirely from its local `mockCatalogs.js`. login() seeds a fake token + a
 * generic /sws/** stub; no window-specific NEO mock is needed because the hook
 * never fetches on mount.
 *
 * It switches to each of the 4 tabs (General · Valores por defecto · Dimensiones ·
 * Documentos), waits for that tab's content to render, runs a light sanity check
 * (no pixel/layout fidelity assertion — a human compares the PNGs to the Figma),
 * and writes a full-page screenshot per tab to e2e/test-results/.
 *
 * Selectors used are the stable data-testids already emitted by the window:
 *   glc-tab-0..3, glc-save, glc-section-identity, glc-defaults-group-*,
 *   glc-section-dimensions, glc-doc-*.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Spec lives in e2e/tests/flows/ → test-results is two levels up.
const OUT_DIR = path.resolve(__dirname, '..', '..', 'test-results');

const TABS = [
  { index: 0, file: 'glc-01-general.png',     anchor: (p) => p.getByTestId('glc-section-identity') },
  { index: 1, file: 'glc-02-valores.png',     anchor: (p) => p.locator('[data-testid^="glc-defaults-group-"]').first() },
  { index: 2, file: 'glc-03-dimensiones.png', anchor: (p) => p.getByTestId('glc-section-dimensions') },
  { index: 3, file: 'glc-04-documentos.png',  anchor: (p) => p.locator('[data-testid^="glc-doc-"]').first() },
];

test.describe('General Ledger Configuration — visual capture (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/general-ledger-configuration');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    // The window shell renders once the tab bar is present.
    await expect(page.getByTestId('glc-tab-0')).toBeVisible({ timeout: 15_000 });
    // No React error boundary leaked through.
    await expect(page.getByText(/Something went wrong|Algo salió mal/i)).toHaveCount(0);
  });

  for (const tab of TABS) {
    test(`captures tab ${tab.index} → ${tab.file}`, async ({ page }) => {
      await page.getByTestId(`glc-tab-${tab.index}`).click();

      // Wait for this tab's content to mount (each tab swaps the panel).
      const anchor = tab.anchor(page);
      await expect(anchor).toBeVisible({ timeout: 10_000 });

      // The dirty-state save button is part of the window chrome on every tab.
      await expect(page.getByTestId('glc-save')).toBeVisible();

      // Let fonts/transitions settle, then capture the full page for human review.
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT_DIR, tab.file), fullPage: true });
    });
  }
});
