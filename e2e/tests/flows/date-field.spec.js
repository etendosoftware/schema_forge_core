import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../helpers/auth.js';

/**
 * DateField — interactive behaviour (mocked).
 *
 * Covers what cannot be asserted at source level:
 *   - The wrapper input is text-editable (not the native <input type="date">).
 *   - Clicking inside the input does NOT open the calendar popover; only the
 *     calendar icon button does.
 *   - Typing letters is silently dropped — the mask only accepts digits.
 *   - Typing 8 digits auto-inserts the locale separators (DD/MM/YYYY for
 *     es_ES, MM/DD/YYYY for en_US).
 *   - The placeholder hint adapts to the active locale.
 *   - Typing a valid date and then opening the calendar reflects that date
 *     (calendar header shows the right month, the day is highlighted).
 *
 * Companion source-level coverage:
 *   packages/app-shell-core/src/components/ui/__tests__/date-field.test.js
 *
 * Target page: Sales Order detail (New Order). The form renders an
 * orderDate field which mounts a DateField via EntityForm. The input
 * exposes data-testid="field-orderDate".
 */

const ORDER_DATE_INPUT = 'field-orderDate';

/** Seed the active locale before React boots so useLocaleSwitch reads it. */
async function seedLocale(page, locale) {
  await page.addInitScript((loc) => {
    localStorage.setItem('schema-forge-locale', loc);
  }, locale);
}

/** Open the New Order form and return a Locator pointing at the orderDate input. */
async function openOrderDateField(page) {
  // Navigate directly to the create route — avoids brittleness of locating
  // the (locale-dependent) "+ Nuevo" button on the list view.
  await page.goto('/sales-order/new');
  const input = page.getByTestId(ORDER_DATE_INPUT);
  await expect(input).toBeVisible({ timeout: 10_000 });
  return input;
}

test.describe('DateField — manual typing', () => {

  test('renders an editable text input (not the native browser date picker)', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).not.toBeDisabled();
  });

  test('clicking the input does NOT open the calendar popover', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    await input.click();
    // The Radix popover content is portaled to body; if it opened we'd see it.
    // Allow a short tick for any opening animation.
    await page.waitForTimeout(200);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test('only the calendar icon button opens the popover', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    await openOrderDateField(page);
    // The icon button sits next to the input and carries the localized aria-label.
    const iconButton = page.getByRole('button', { name: /abrir calendario|open calendar/i }).first();
    await iconButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('rejects letters and accepts only digits, masking to DD/MM/YYYY (es_ES)', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    await input.click();
    await input.fill(''); // clear whatever default the form preset
    await input.pressSequentially('asas08052026qwe');
    // Letters dropped; digits formatted.
    await expect(input).toHaveValue('08/05/2026');
  });

  test('masks to MM/DD/YYYY when locale is en_US', async ({ page }) => {
    await seedLocale(page, 'en_US');
    await login(page);
    const input = await openOrderDateField(page);
    await input.click();
    await input.fill('');
    await input.pressSequentially('05082026');
    // en_US is month-first; the same 8 digits are split as MM/DD/YYYY.
    await expect(input).toHaveValue('05/08/2026');
  });

  test('placeholder hint adapts to locale (focus-only)', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    // Placeholder is empty until focused (per Figma — show only the icon when empty).
    await input.fill('');
    await input.blur();
    await expect(input).toHaveAttribute('placeholder', '');
    await input.focus();
    await expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa');
  });

  test('placeholder is mm/dd/yyyy when locale is en_US (focus-only)', async ({ page }) => {
    await seedLocale(page, 'en_US');
    await login(page);
    const input = await openOrderDateField(page);
    await input.fill('');
    await input.focus();
    await expect(input).toHaveAttribute('placeholder', 'mm/dd/yyyy');
  });

  test('reverts to last valid value when blurred with garbage', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    await input.click();
    await input.fill('');
    await input.pressSequentially('08052026');
    await input.blur();
    await expect(input).toHaveValue('08/05/2026');

    // Now type something that the parser will reject (impossible day 32/13).
    await input.click();
    await input.fill('');
    await input.pressSequentially('32132026');
    await input.blur();
    // The blur commit fails → value reverts to the last valid 08/05/2026.
    await expect(input).toHaveValue('08/05/2026');
  });

  test('typed date is reflected in the calendar header when opening via icon', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    const input = await openOrderDateField(page);
    await input.click();
    await input.fill('');
    await input.pressSequentially('08052026');
    await expect(input).toHaveValue('08/05/2026');

    const iconButton = page.getByRole('button', { name: /abrir calendario|open calendar/i }).first();
    await iconButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The header is rendered as a clickable button — Intl in es_ES outputs
    // exactly "mayo de 2026". Use exact match so day-cell aria-labels
    // (which also contain "mayo de 2026") don't trigger strict-mode collisions.
    await expect(dialog.getByRole('button', { name: 'mayo de 2026', exact: true })).toBeVisible();
  });
});

/**
 * ListFilterBar — date range filter (mocked).
 *
 * Companion source-level coverage already asserts the wrapper has the fixed
 * w-[244px] / min-h-[244px] classes. These E2E tests verify the runtime
 * behaviour those classes enable: the panel does not visibly resize when the
 * user toggles into the month/year picker, and the picker dimensions stay
 * stable when switching between the Mes / Año tabs.
 */

test.describe('ListFilterBar — date range filter', () => {

  /** Open the date filter popover on the Sales Order list. The two calendars
   *  render immediately alongside the preset list (no extra Custom click). */
  async function openCustomDateRange(page) {
    await navigateTo(page, 'sales-order');
    // The pill button label is locale-dependent ("Cualquier fecha" / "Any date" / "Last year"...).
    // The reliable identifier is the lucide calendar-days icon it contains.
    const dateFilterPill = page.locator('button:has(svg.lucide-calendar-days)').first();
    await dateFilterPill.click();
    // Wait for at least one weekday header from a calendar grid (es: lu/ma/.., en: Mo/Tu/..).
    await expect(page.getByText(/^(lu|mo)$/i).first()).toBeVisible({ timeout: 5_000 });
  }

  test('panel keeps the same dimensions when switching from days view to month picker', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    await openCustomDateRange(page);

    // Pick the LEFT calendar wrapper — it has the fixed w-[244px]/min-h-[244px].
    // We locate it by the header label "month YYYY" button it contains.
    const leftHeader = page.locator('button.capitalize').first();
    await expect(leftHeader).toBeVisible();
    const wrapperBefore = leftHeader.locator('xpath=ancestor::div[contains(@class,"w-[244px]")][1]');
    const beforeBox = await wrapperBefore.boundingBox();

    // Open the month/year picker on the left calendar.
    await leftHeader.click();
    // The picker's "Mes" / "Año" tabs appear inside the wrapper.
    await expect(page.getByRole('button', { name: /^(mes|month)$/i }).first()).toBeVisible();
    const afterBox = await wrapperBefore.boundingBox();

    // Same wrapper, same dimensions (within 1px rounding tolerance).
    expect(Math.abs(afterBox.width - beforeBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThanOrEqual(1);
  });

  test('panel keeps the same dimensions when switching between Mes and Año tabs', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    await openCustomDateRange(page);

    const leftHeader = page.locator('button.capitalize').first();
    await leftHeader.click();
    const wrapper = leftHeader.locator('xpath=ancestor::div[contains(@class,"w-[244px]")][1]');

    const monthTabBox = await wrapper.boundingBox();
    await page.getByRole('button', { name: /^(año|year)$/i }).first().click();
    const yearTabBox = await wrapper.boundingBox();

    expect(Math.abs(yearTabBox.width - monthTabBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(yearTabBox.height - monthTabBox.height)).toBeLessThanOrEqual(1);
  });

  test('clicking a month in the picker immediately returns to the days view', async ({ page }) => {
    await seedLocale(page, 'es_ES');
    await login(page);
    await openCustomDateRange(page);

    const leftHeader = page.locator('button.capitalize').first();
    const beforeLabel = (await leftHeader.textContent())?.trim();
    await leftHeader.click();
    // Click a different month so the change is observable.
    // The grid shows short month names (Ene/Feb/Mar/Abr/May/Jun/...) — pick "Mar".
    const targetMonth = page.getByRole('button', { name: /^(mar|march)$/i }).first();
    await targetMonth.click();
    // Picker collapses; "Mes/Año" tabs are no longer visible.
    await expect(page.getByRole('button', { name: /^(mes|month)$/i }).first()).toBeHidden();
    const afterLabel = (await leftHeader.textContent())?.trim();
    expect(afterLabel).not.toEqual(beforeLabel);
    expect(afterLabel?.toLowerCase()).toContain('mar');
  });
});
