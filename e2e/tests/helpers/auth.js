/**
 * Authentication and navigation helpers for E2E tests.
 *
 * Login flow discovered via agent-browser:
 *   - /login page: textbox "Username", textbox "Password", button "Sign in"
 *   - After login: redirects to /dashboard
 *
 * Context switch discovered via agent-browser:
 *   - Click Etendo logo (always visible) → opens popover
 *   - Popover has two <select>: Role + Organization, and an "Apply" button
 */

/** Default role/org for all E2E tests */
export const DEFAULT_ROLE = 'F&B International Group Admin';
export const DEFAULT_ORG = 'F&B España - Región Norte';

/**
 * Login and switch to the default role/org context.
 */
export async function login(page, {
  user = 'admin',
  password = 'admin',
  role = DEFAULT_ROLE,
  org = DEFAULT_ORG,
} = {}) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Username' }).fill(user);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard', { timeout: 10_000 });

  // Switch role/org context
  await switchContext(page, role, org);
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
  await page.waitForTimeout(300);

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
  if (await applyButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await applyButton.click();
    await page.waitForTimeout(1_000);
  }

  // Close the popover by clicking outside
  await page.locator('body').click({ position: { x: 600, y: 400 } });
  await page.waitForTimeout(300);
}

/**
 * Navigate to a specific window by slug.
 * Uses path-based routing (not hash-based).
 */
export async function navigateTo(page, windowSlug) {
  await page.goto(`/${windowSlug}`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}
