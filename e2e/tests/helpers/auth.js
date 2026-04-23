/**
 * Authentication and navigation helpers for E2E tests.
 *
 * These helpers target the mock dev server (make dev-mock / VITE_MOCK=true).
 * The app has no login form in mock mode — authentication is done by seeding
 * localStorage with a fake token before React boots.
 *
 * API calls are intercepted via page.route() so that /sws/* requests return
 * empty-list responses (not 401), preventing useEntity from calling logout().
 *
 * Real Etendo mode (BASE_URL=http://localhost:8080/...) is not covered here.
 */

/** Default role/org — kept for future real-backend tests */
export const DEFAULT_ROLE = 'F&B International Group Admin';
export const DEFAULT_ORG = 'F&B España - Región Norte';

/**
 * Authenticate for E2E tests running against the mock dev server.
 *
 * Seeds localStorage before React boots and intercepts /sws/* API calls so
 * useEntity never receives a 401 and never calls logout().
 */
export async function login(page) {
  // Inject token before React boots so AuthContext.isAuthenticated = true.
  await page.addInitScript(() => {
    localStorage.setItem('sf_auth_token', 'e2e-mock-token');
    localStorage.setItem('sf_auth_user', 'admin');
  });

  // Intercept all /sws/* API calls to prevent the real Etendo backend from
  // receiving our fake token (which would return 401 and trigger logout()).
  // - GET → empty list
  // - POST/PUT/PATCH → synthetic saved record so the UI can transition to detail view
  await page.route('**/sws/**', (route) => {
    const method = route.request().method();
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-record-id', data: {}, success: true }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], totalRows: 0 }),
      });
    }
  });

  await page.goto('/dashboard');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

/**
 * Switch role and organization via the context switcher popover.
 *
 * The Etendo logo button (img[alt="Etendo"]) is always visible regardless
 * of sidebar state. Clicking it opens the context popover with Role/Org selects.
 */
export async function switchContext(page, role, org) {
  // Click the Etendo logo to open the context switcher popover
  const logoButton = page.locator('button:has(img[alt="Etendo"])');
  await logoButton.click({ timeout: 5_000 });

  // The popover renders two <select> elements: Role (first) and Organization (second)
  const roleSelect = page.locator('select').first();
  await roleSelect.waitFor({ state: 'visible', timeout: 5_000 });
  await roleSelect.selectOption({ label: role });
  await page.waitForTimeout(300);

  // Org select updates based on the selected role
  const orgSelect = page.locator('select').nth(1);
  await orgSelect.selectOption({ label: org });
  await page.waitForTimeout(300);

  // Click Apply (only appears when there are changes)
  const applyButton = page.getByRole('button', { name: 'Apply' });
  try {
    if (await applyButton.isVisible({ timeout: 2_000 })) {
      await applyButton.click();
      // Wait for the context to settle — Apply may trigger a re-render or reload
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch {
    // Apply not visible means context was already correct
  }

  // Close the popover by clicking outside (if still open)
  try {
    const backdrop = page.locator('.fixed.inset-0');
    if (await backdrop.isVisible({ timeout: 500 }).catch(() => false)) {
      await backdrop.click();
    }
  } catch {
    // Popover already closed
  }
  await page.waitForTimeout(200);
}

/**
 * Navigate to a specific window by slug.
 * Uses path-based routing (not hash-based).
 */
export async function navigateTo(page, windowSlug) {
  await page.goto(`/${windowSlug}`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}
