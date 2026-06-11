import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Product Pricing footer — ETP-4010 (N-05) mocked spec.
 *
 * Covers the `ProductPriceBar` redesign (form footer of the Product detail
 * window — `tools/app-shell/src/windows/custom/product/ProductPriceBar.jsx`):
 *
 *   Suite A — Tables always rendered (product with zero M_ProductPrice rows)
 *     Both Sales and Purchase PriceTables are always visible, each with a
 *     pencil icon button. Clicking the sales pencil opens the "Manage Pricing"
 *     dialog with focusedSection='sales' (only the sales section is shown).
 *     Pressing "Save changes" posts exactly one row per staged add. After save,
 *     the UI rerenders showing the new row label.
 *
 *   Suite B — Edit dialog with lazy-loaded options
 *     Whether or not rows exist, both tables show pencil buttons. Clicking the
 *     purchase pencil opens the dialog with focusedSection='purchase' (only the
 *     purchase section is shown). The dialog lazily fetches
 *     `/price/selectors/M_PriceList_Version_ID` on open and populates the
 *     purchase `+` row dropdown from that response (filtered by the
 *     `salesPriceList` flag).
 *
 * Mock mode only: routes are installed AFTER login() so they win over the
 * generic /sws/** catch-all (Playwright LIFO route matching).
 */

// ── Synthetic data ───────────────────────────────────────────────────────────

const PLV_SALE = {
  id: 'plv-sale',
  label: 'Lista venta 2026',
  name: 'Lista venta 2026',
  salesPriceList: true,
};

const PLV_PURCHASE = {
  id: 'plv-purchase',
  label: 'Lista compra 2026',
  name: 'Lista compra 2026',
  salesPriceList: false,
};

const SELECTOR_PAYLOAD = {
  items: [PLV_SALE, PLV_PURCHASE],
};

const PRODUCT_NO_PRICES = {
  id: 'PROD-1',
  searchKey: 'PROD-1',
  name: 'Product without prices',
  '_identifier': 'Product without prices',
  productType: 'I',
  'productType$_identifier': 'Item',
  purchase: true,
  sale: true,
  stocked: true,
  returnable: false,
  organization: 'org-1',
  client: 'client-1',
};

const EXISTING_SALES_ROW = {
  id: 'price-existing-sales-1',
  product: 'PROD-2',
  priceListVersion: 'plv-sale',
  'priceListVersion$_identifier': 'Lista venta 2026',
  'priceListVersion$salesPriceList': true,
  standardPrice: '8',
  listPrice: '10',
  priceLimit: '10',
};

const PRODUCT_WITH_SALES_PRICE = {
  ...PRODUCT_NO_PRICES,
  id: 'PROD-2',
  searchKey: 'PROD-2',
  name: 'Product with existing sales price',
  '_identifier': 'Product with existing sales price',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Install the product detail GET mock so navigating to /product/<id>
 * resolves a synthetic product record.
 */
async function mockProductDetail(page, product) {
  await page.route('**/sws/neo/product/product/**', async (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.fallback();
    const url = req.url();
    // Match detail GETs `/product/product/<id>` — selectors live under
    // `/product/product/selectors/...` and must fall through to the generic
    // catch-all installed by login().
    if (/\/product\/product\/selectors\//.test(url)) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: { data: [product] } }),
    });
  });
}

/**
 * Install the M_PriceList_Version_ID selector mock and capture each call so
 * tests can assert the lazy fetch actually fired.
 */
async function mockSelector(page, calls) {
  await page.route('**/sws/neo/product/price/selectors/M_PriceList_Version_ID**', async (route) => {
    calls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SELECTOR_PAYLOAD),
    });
  });
}

/**
 * Install the /price/defaults mock (called by ProductPriceBar.resolveCreateDefaults).
 * Returns no defaults so the component falls back to the selector endpoint to
 * pick a PLV per side.
 */
async function mockPriceDefaults(page) {
  await page.route('**/sws/neo/product/price/defaults**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ defaults: {} }),
    });
  });
}

// ── Suite A — Create flow ────────────────────────────────────────────────────

test.describe('Product pricing — create flow (no existing rows)', () => {
  let postBodies;
  let selectorCalls;
  let priceListRows;

  test.beforeEach(async ({ page }) => {
    postBodies = [];
    selectorCalls = [];
    priceListRows = []; // start empty so the create flow is triggered

    await login(page);

    // Catch-all for /price endpoints — list GET + POST + per-id PATCH/DELETE.
    // Installed AFTER login() so it wins over the generic catch-all.
    await page.route('**/sws/neo/product/price**', async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      // Selector and defaults endpoints handled by dedicated mocks below.
      if (/\/price\/selectors\//.test(url)) return route.fallback();
      if (/\/price\/defaults/.test(url)) return route.fallback();

      // List GET: `/price?parentId=...`
      if (method === 'GET' && !/\/price\/[^/?]+/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: { data: priceListRows, totalRows: priceListRows.length },
          }),
        });
        return;
      }

      // POST `/price` — create new row.
      if (method === 'POST' && !/\/price\/[^/?]+/.test(url)) {
        const body = req.postData() ? JSON.parse(req.postData()) : {};
        postBodies.push(body);

        // Build a saved row that mirrors what the next list GET should return.
        const isSales = String(body.priceListVersion) === 'plv-sale';
        const newRow = {
          id: `price-new-${postBodies.length}`,
          product: body.product,
          priceListVersion: body.priceListVersion,
          'priceListVersion$_identifier': isSales ? PLV_SALE.label : PLV_PURCHASE.label,
          'priceListVersion$salesPriceList': isSales,
          standardPrice: body.standardPrice,
          listPrice: body.listPrice,
          priceLimit: body.priceLimit,
        };
        priceListRows = [...priceListRows, newRow];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, response: { data: [{ id: newRow.id }] } }),
        });
        return;
      }

      return route.fallback();
    });

    await mockSelector(page, selectorCalls);
    await mockPriceDefaults(page);
    await mockProductDetail(page, PRODUCT_NO_PRICES);

    await page.goto(`/product/${PRODUCT_NO_PRICES.id}`);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('empty pricing tables show pencil icons; clicking sales pencil opens the dialog with sales section', async ({ page }) => {
    // Both PriceTable components are always rendered — assert the sales table
    // title is visible using the i18n value "Sales Price Lists".
    await expect(
      page.getByText(/sales price lists|listas de precios de venta/i),
    ).toBeVisible({ timeout: 10_000 });

    // Click the sales pencil button via its data-testid.
    await page.locator('[data-testid="price-sales-edit"]').click();

    // The "Manage Pricing" dialog should open.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: /manage pricing|gestionar precios/i }),
    ).toBeVisible();

    // Sales section is visible inside the dialog.
    await expect(
      dialog.getByText(/sales price lists|listas de precios de venta/i),
    ).toBeVisible();

    // Purchase section must NOT be present (focusedSection='sales').
    await expect(
      dialog.getByText(/purchase price lists|listas de precios de compra/i),
    ).toHaveCount(0);

    // Click "+" inside the dialog to add a pending row — a select dropdown appears.
    await dialog.getByRole('button', { name: '+' }).click();
    await expect(dialog.locator('select')).toBeVisible({ timeout: 10_000 });
  });

  test('saving sale-only values posts exactly one sales row and rerenders the UI', async ({ page }) => {
    // Open the sales pricing dialog via the pencil button.
    await page.locator('[data-testid="price-sales-edit"]').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click "+" to add a pending row.
    await dialog.getByRole('button', { name: '+' }).click();

    // Wait for 'Lista venta 2026' option to appear in the select (lazy fetch
    // returns SELECTOR_PAYLOAD which includes PLV_SALE).
    const select = dialog.locator('select');
    await expect(
      select.locator('option', { hasText: 'Lista venta 2026' }),
    ).toHaveCount(1, { timeout: 10_000 });

    await select.selectOption({ label: 'Lista venta 2026' });

    // Fill unit price and list price in the two number inputs.
    const numberInputs = dialog.locator('input[type="number"]');
    await numberInputs.nth(0).fill('10');
    await numberInputs.nth(1).fill('12');

    // Confirm the staged add by clicking "✓".
    await dialog.locator('button', { hasText: '✓' }).click();

    // Set up POST intercept promise before clicking Save.
    const postPromise = page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        /\/sws\/neo\/product\/price(\?|$)/.test(req.url()),
      { timeout: 10_000 },
    );

    // Click "Save changes" button.
    await dialog
      .getByRole('button', { name: /save changes|guardar cambios/i })
      .click();

    await postPromise;

    // After save the dialog closes and the list rerenders with the new row.
    await expect(page.getByText('Lista venta 2026')).toBeVisible({ timeout: 10_000 });

    // Exactly one POST was made.
    expect(postBodies).toHaveLength(1);

    const sentBody = postBodies[0];
    expect(sentBody.priceListVersion).toBe('plv-sale');
    expect(sentBody.standardPrice).toBe('10');
    expect(sentBody.listPrice).toBe('12');
    expect(sentBody.product).toBe(PRODUCT_NO_PRICES.id);

    // Purchase panel must remain empty — assert no purchase PLV name appears.
    await expect(page.getByText('Lista compra 2026')).toHaveCount(0);
  });
});

// ── Suite B — Edit dialog with lazy-loaded options ───────────────────────────

test.describe('Product pricing — edit dialog populates dropdown from lazy fetch', () => {
  let selectorCalls;

  test.beforeEach(async ({ page }) => {
    selectorCalls = [];

    await login(page);

    // Return ONE existing sales row so the footer shows "Edit pricing".
    await page.route('**/sws/neo/product/price**', async (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (/\/price\/selectors\//.test(url)) return route.fallback();
      if (/\/price\/defaults/.test(url)) return route.fallback();

      if (method === 'GET' && !/\/price\/[^/?]+/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: { data: [EXISTING_SALES_ROW], totalRows: 1 },
          }),
        });
        return;
      }

      return route.fallback();
    });

    await mockSelector(page, selectorCalls);
    await mockPriceDefaults(page);
    await mockProductDetail(page, PRODUCT_WITH_SALES_PRICE);

    await page.goto(`/product/${PRODUCT_WITH_SALES_PRICE.id}`);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  });

  test('clicking purchase pencil opens dialog with purchase section only; dropdown is populated by the lazy fetch', async ({ page }) => {
    // Set up the selector fetch promise BEFORE clicking the pencil, because
    // PricingDialog lazy-fetches as soon as open=true.
    const selectorRequestPromise = page.waitForRequest(
      (req) =>
        req.method() === 'GET' &&
        req.url().includes('/sws/neo/product/price/selectors/M_PriceList_Version_ID'),
      { timeout: 10_000 },
    );

    // Click the purchase pencil button via its data-testid.
    await expect(
      page.locator('[data-testid="price-purchase-edit"]'),
    ).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="price-purchase-edit"]').click();

    // Dialog opens — title is "Manage Pricing" / "Gestionar precios".
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: /manage pricing|gestionar precios/i }),
    ).toBeVisible();

    // Purchase section is visible (focusedSection='purchase').
    await expect(
      dialog.getByText(/purchase price lists|listas de precios de compra/i),
    ).toBeVisible();

    // Sales section must NOT be present in the dialog (focusedSection='purchase').
    await expect(
      dialog.getByText(/sales price lists|listas de precios de venta/i),
    ).toHaveCount(0);

    // Click "+" inside the purchase section to reveal the select dropdown.
    await dialog.getByRole('button', { name: '+' }).click();

    // Only one select is present since only the purchase section is rendered.
    const purchaseSelect = dialog.locator('select');
    await expect(purchaseSelect).toBeVisible({ timeout: 10_000 });

    // After the lazy fetch resolves, the purchase-flagged option must appear.
    await expect(
      purchaseSelect.locator('option', { hasText: 'Lista compra 2026' }),
    ).toHaveCount(1, { timeout: 10_000 });

    // The sales-flagged option must NOT be offered (filtered by salesPriceList=false).
    await expect(
      purchaseSelect.locator('option', { hasText: 'Lista venta 2026' }),
    ).toHaveCount(0);

    // Confirm the lazy fetch actually fired.
    await selectorRequestPromise;
    expect(selectorCalls.length).toBeGreaterThanOrEqual(1);
  });
});
