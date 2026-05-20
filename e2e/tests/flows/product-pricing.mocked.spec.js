import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth.js';

/**
 * Product Pricing footer — ETP-4010 (N-05) mocked spec.
 *
 * Covers two regressions on the `ProductPriceBar` (form footer of the Product
 * detail window — `tools/app-shell/src/windows/custom/product/ProductPriceBar.jsx`):
 *
 *   Suite A — Create flow (product with zero M_ProductPrice rows)
 *     The footer button reads "Set pricing" / "Establecer precios". Clicking it
 *     reveals an inline 4-input form (sale unit + list, purchase unit + list).
 *     Pressing "Save pricing" posts ONE row per side that has values, each row
 *     using its own price-list-version (sales-flagged vs purchase-flagged). No
 *     replication across sides. After save, the UI rerenders the new rows.
 *
 *   Suite B — Edit dialog with lazy-loaded options
 *     When rows exist the button reads "Edit pricing" / "Editar precios" and
 *     opens the "Manage pricing" dialog. The dialog now lazily fetches
 *     `/price/selectors/M_PriceList_Version_ID` on open and populates the
 *     sales/purchase `+` row dropdowns from that response (filtered by the
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

  test('opening "Set pricing" reveals the inline 4-input create form', async ({ page }) => {
    // The "Pricing" footer card should be visible — anchor on a string that
    // exists in both locales' values is hard; use the trigger button instead.
    const setButton = page.getByRole('button', { name: /set pricing|establecer precios/i });
    await expect(setButton).toBeVisible({ timeout: 10_000 });

    await setButton.click();

    // Exactly 4 number inputs should appear (sale unit + list, purchase unit + list).
    const numberInputs = page.getByRole('spinbutton');
    await expect(numberInputs).toHaveCount(4);

    // After opening the form the trigger should be replaced by Cancel + Save pricing.
    await expect(page.getByRole('button', { name: /save pricing|guardar precios/i })).toBeVisible();
  });

  test('saving sale-only values posts exactly one sales row and rerenders the UI', async ({ page }) => {
    await page
      .getByRole('button', { name: /set pricing|establecer precios/i })
      .click();

    const numberInputs = page.getByRole('spinbutton');
    await expect(numberInputs).toHaveCount(4);

    // Layout order in the component: sale unit, sale list, purchase unit, purchase list.
    await numberInputs.nth(0).fill('10');
    await numberInputs.nth(1).fill('12');
    // Leave purchase inputs blank.

    const postPromise = page.waitForRequest(
      (req) =>
        req.method() === 'POST' &&
        /\/sws\/neo\/product\/price(\?|$)/.test(req.url()),
      { timeout: 10_000 },
    );

    await page.getByRole('button', { name: /save pricing|guardar precios/i }).click();

    await postPromise;

    // Wait for the create flow to fold back to the list view and rerender rows.
    // The bar shows the new sales row inside a PriceTable; the row label is the
    // PLV identifier returned by the post handler.
    await expect(page.getByText('Lista venta 2026')).toBeVisible({ timeout: 10_000 });

    // Exactly one POST was made — purchase side was empty so no second call.
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

  test('Edit pricing opens dialog and the purchase + dropdown is populated by the lazy fetch', async ({ page }) => {
    // Wait for the selector lazy fetch the dialog will trigger.
    const selectorRequestPromise = page.waitForRequest(
      (req) =>
        req.method() === 'GET' &&
        req.url().includes('/sws/neo/product/price/selectors/M_PriceList_Version_ID'),
      { timeout: 10_000 },
    );

    // The footer shows "Edit pricing" because rows exist.
    const editButton = page.getByRole('button', { name: /edit pricing|editar precios/i });
    await expect(editButton).toBeVisible({ timeout: 10_000 });
    await editButton.click();

    // Dialog open — title is "Manage pricing" / "Gestionar precios".
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('heading', { name: /manage pricing|gestionar precios/i }),
    ).toBeVisible();

    // Lazy fetch must have fired (the dialog requested the selector endpoint).
    await selectorRequestPromise;
    expect(selectorCalls.length).toBeGreaterThanOrEqual(1);

    // Scope to the purchase panel — the renderSection wrapper is the unique
    // `.flex-1.min-w-0.rounded-2xl` div that contains the panel title. Using
    // `.last()` selects the right-side panel (purchase is rendered after sales
    // in the dialog body).
    const purchaseSection = dialog
      .locator('div.flex-1.min-w-0.rounded-2xl')
      .filter({ hasText: /purchase price lists|listas de precios de compra/i })
      .last();
    await expect(purchaseSection).toBeVisible();

    await purchaseSection.getByRole('button', { name: '+' }).click();

    // The `<select>` becomes visible inside the purchase section.
    const purchaseSelect = purchaseSection.locator('select');
    await expect(purchaseSelect).toBeVisible({ timeout: 10_000 });

    // After the lazy fetch resolves, the purchase-flagged option must appear.
    await expect(
      purchaseSelect.locator('option', { hasText: 'Lista compra 2026' }),
    ).toHaveCount(1, { timeout: 10_000 });

    // And the sales-flagged option must NOT be offered as a purchase option
    // (the dialog filters by salesPriceList flag).
    await expect(
      purchaseSelect.locator('option', { hasText: 'Lista venta 2026' }),
    ).toHaveCount(0);
  });
});
