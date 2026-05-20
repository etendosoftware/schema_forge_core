import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => 'USD',
}));

vi.mock('@/lib/formatCurrency', () => ({
  formatCurrency: (_curr, val) => `$${Number(val).toFixed(2)}`,
}));

// Mock selectorCatalog so we can inject options per-test through the
// `catalogs` prop using getSelectorCatalogKeys' real key scheme.
vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: (catalogs, entityName, field = {}) => {
    const keys = [];
    if (entityName && field.column) keys.push(`${entityName}:${field.column}`);
    if (entityName && field.key) keys.push(`${entityName}:${field.key}`);
    if (entityName && field.field) keys.push(`${entityName}:${field.field}`);
    if (field.reference) keys.push(field.reference);
    for (const key of keys) {
      const options = catalogs?.[key];
      if (Array.isArray(options)) return options;
    }
    return [];
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Loader2: (props) => <span data-testid="loader" {...props} />,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// --- Import under test ----------------------------------------------------

import ProductPriceBar from '../ProductPriceBar.jsx';

// --- Helpers --------------------------------------------------------------

function renderBar(overrides = {}) {
  const defaults = {
    data: { id: 'prod-1' },
    token: 'tok',
    apiBaseUrl: '/api/product',
    catalogs: {},
    api: { selectors: [] },
  };
  return render(<ProductPriceBar {...defaults} {...overrides} />);
}

// --- Tests ----------------------------------------------------------------

describe('ProductPriceBar', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    renderBar();
    expect(screen.getByText('pricing')).toBeInTheDocument();
  });

  it('shows save-first message when no record id', () => {
    renderBar({ data: {} });
    expect(screen.getByText('saveProductFirstPricing')).toBeInTheDocument();
  });

  it('shows pricing title and configure subtitle', () => {
    renderBar();
    expect(screen.getByText('pricing')).toBeInTheDocument();
    expect(screen.getByText('configureMainSaleAndPurchasePrice')).toBeInTheDocument();
  });

  it('renders set pricing button when there are no price rows', async () => {
    renderBar();
    // After fetch resolves with empty data, button should show setPricing
    await screen.findByText('setPricing');
    expect(screen.getByText('setPricing')).toBeInTheDocument();
  });

  it('renders price tables when rows exist', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              data: [
                {
                  id: 'price-1',
                  standardPrice: 10,
                  listPrice: 12,
                  'priceListVersion$_identifier': 'Sales List v1',
                  'priceListVersion$salesPriceList': true,
                },
                {
                  id: 'price-2',
                  standardPrice: 8,
                  listPrice: 9,
                  'priceListVersion$_identifier': 'Purchase List v1',
                  'priceListVersion$salesPriceList': false,
                },
              ],
            },
          }),
      }),
    );

    renderBar();

    await screen.findByText('Sales List v1');
    expect(screen.getByText('Sales List v1')).toBeInTheDocument();
    expect(screen.getByText('Purchase List v1')).toBeInTheDocument();
  });

  it('shows formatted currency for price rows', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              data: [
                {
                  id: 'price-1',
                  standardPrice: 25.5,
                  listPrice: 30,
                  'priceListVersion$_identifier': 'My List',
                  'priceListVersion$salesPriceList': true,
                },
              ],
            },
          }),
      }),
    );

    renderBar();

    await screen.findByText('$25.50');
    expect(screen.getByText('$25.50')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
  });

  it('shows editPricing button when rows exist', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              data: [
                {
                  id: 'price-1',
                  standardPrice: 10,
                  listPrice: 12,
                  'priceListVersion$_identifier': 'List',
                  'priceListVersion$salesPriceList': true,
                },
              ],
            },
          }),
      }),
    );

    renderBar();
    await screen.findByText('editPricing');
    expect(screen.getByText('editPricing')).toBeInTheDocument();
  });

  it('renders sales and purchase table sections with correct titles', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            response: {
              data: [
                {
                  id: 'p1',
                  standardPrice: 10,
                  listPrice: 12,
                  'priceListVersion$_identifier': 'S1',
                  'priceListVersion$salesPriceList': true,
                },
                {
                  id: 'p2',
                  standardPrice: 5,
                  listPrice: 6,
                  'priceListVersion$_identifier': 'P1',
                  'priceListVersion$salesPriceList': false,
                },
              ],
            },
          }),
      }),
    );

    renderBar();
    await screen.findByText('priceSalesLists');
    expect(screen.getByText('priceSalesLists')).toBeInTheDocument();
    expect(screen.getByText('pricePurchaseLists')).toBeInTheDocument();
  });

  // ===================================================================
  // ETP-4010 — Pricing footer create + edit-dialog fixes
  // ===================================================================

  // Shared helpers for the new scenarios.

  const SALES_PLV_ID = 'plv-sales-1';
  const PURCHASE_PLV_ID = 'plv-purchase-1';

  /**
   * Build a fetch dispatcher that routes calls by URL + method.
   * The keys in `routes` are 'METHOD <url-pattern>'. The handler returns
   * the JSON body. URL match is `url.includes(pattern)` for flexibility.
   */
  function buildFetch(routes, callLog = []) {
    return vi.fn((url, init = {}) => {
      const method = (init.method || 'GET').toUpperCase();
      callLog.push({ url, method, body: init.body });
      for (const key of Object.keys(routes)) {
        const [m, ...rest] = key.split(' ');
        const pattern = rest.join(' ');
        if (m === method && url.includes(pattern)) {
          const result = routes[key];
          const payload = typeof result === 'function' ? result({ url, init }) : result;
          if (payload && typeof payload.then === 'function') {
            return payload.then((p) => ({
              ok: p?.ok !== false,
              status: p?.status ?? 200,
              json: () => Promise.resolve(p?.body ?? p),
            }));
          }
          return Promise.resolve({
            ok: payload?.ok !== false,
            status: payload?.status ?? 200,
            json: () => Promise.resolve(payload?.body ?? payload),
          });
        }
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });
  }

  /** Returns mocked items for the lazy /price/selectors/<col> endpoint. */
  function selectorItemsPayload() {
    return {
      items: [
        { id: SALES_PLV_ID, label: 'Sales PLV', salesPriceList: true },
        { id: PURCHASE_PLV_ID, label: 'Purchase PLV', salesPriceList: false },
      ],
    };
  }

  /** Catalog options array matching the dispatcher schema. */
  function catalogOptions() {
    return [
      { id: SALES_PLV_ID, name: 'Sales PLV', salesPriceList: true },
      { id: PURCHASE_PLV_ID, name: 'Purchase PLV', salesPriceList: false },
    ];
  }

  /** Catalogs prop that injects PLV options under the price column key. */
  function catalogsWithPlv() {
    return { 'price:M_PriceList_Version_ID': catalogOptions() };
  }

  /** API selector descriptor consumed by ProductPriceBar. */
  function apiWithPriceSelector(column = 'M_PriceList_Version_ID') {
    return { selectors: [{ entity: 'price', field: 'priceListVersion', column }] };
  }

  /** Helper to enter create mode and return the 4 number inputs in DOM order. */
  async function enterCreateMode(user) {
    const setBtn = await screen.findByText('setPricing');
    await user.click(setBtn);
    const inputs = screen.getAllByRole('spinbutton');
    // DOM order: [saleUnit, saleList, purchaseUnit, purchaseList]
    return {
      saleUnit: inputs[0],
      saleList: inputs[1],
      purchaseUnit: inputs[2],
      purchaseList: inputs[3],
    };
  }

  // -------------------------------------------------------------------
  // Create-mode tests
  // -------------------------------------------------------------------

  describe('create mode — independent POST per side', () => {
    it('posts only the sale row when only sale inputs are filled', async () => {
      const calls = [];
      const fetchMock = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );
      global.fetch = fetchMock;

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const inputs = await enterCreateMode(user);
      await user.type(inputs.saleUnit, '10');
      await user.type(inputs.saleList, '12');

      await user.click(screen.getByText('savePricing'));

      await waitFor(() => {
        const posts = calls.filter(
          (c) => c.method === 'POST' && c.url.endsWith('/price'),
        );
        expect(posts).toHaveLength(1);
      });

      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/price'),
      );
      const body = JSON.parse(post.body);
      expect(body.priceListVersion).toBe(SALES_PLV_ID);
      expect(body.standardPrice).toBe('10');
      expect(body.listPrice).toBe('12');
      expect(body.priceLimit).toBe('12');
    });

    it('posts only the purchase row when only purchase inputs are filled', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const inputs = await enterCreateMode(user);
      await user.type(inputs.purchaseUnit, '5');
      await user.type(inputs.purchaseList, '6');

      await user.click(screen.getByText('savePricing'));

      await waitFor(() => {
        const posts = calls.filter(
          (c) => c.method === 'POST' && c.url.endsWith('/price'),
        );
        expect(posts).toHaveLength(1);
      });

      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/price'),
      );
      const body = JSON.parse(post.body);
      expect(body.priceListVersion).toBe(PURCHASE_PLV_ID);
      expect(body.standardPrice).toBe('5');
      expect(body.listPrice).toBe('6');
    });

    it('posts both rows when both sides are filled and keeps their values independent', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const inputs = await enterCreateMode(user);
      await user.type(inputs.saleUnit, '10');
      await user.type(inputs.saleList, '12');
      await user.type(inputs.purchaseUnit, '5');
      await user.type(inputs.purchaseList, '6');

      await user.click(screen.getByText('savePricing'));

      await waitFor(() => {
        const posts = calls.filter(
          (c) => c.method === 'POST' && c.url.endsWith('/price'),
        );
        expect(posts).toHaveLength(2);
      });

      const posts = calls
        .filter((c) => c.method === 'POST' && c.url.endsWith('/price'))
        .map((c) => JSON.parse(c.body));

      const salePost = posts.find((p) => p.priceListVersion === SALES_PLV_ID);
      const purchasePost = posts.find(
        (p) => p.priceListVersion === PURCHASE_PLV_ID,
      );

      expect(salePost).toBeDefined();
      expect(salePost.standardPrice).toBe('10');
      expect(salePost.listPrice).toBe('12');

      expect(purchasePost).toBeDefined();
      expect(purchasePost.standardPrice).toBe('5');
      expect(purchasePost.listPrice).toBe('6');

      // Each side independent — sale POST must NOT carry purchase values.
      expect(salePost.standardPrice).not.toBe('5');
      expect(salePost.listPrice).not.toBe('6');
      expect(purchasePost.standardPrice).not.toBe('10');
      expect(purchasePost.listPrice).not.toBe('12');
    });

    it('shows a toast and skips POST when no inputs are filled', async () => {
      const { toast } = await import('sonner');
      toast.info.mockClear();

      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      await enterCreateMode(user);
      await user.click(screen.getByText('savePricing'));

      // Wait a tick so any potential async work flushes.
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('enterAtLeastOneValueCreatePricing');
      });

      const posts = calls.filter(
        (c) => c.method === 'POST' && c.url.endsWith('/price'),
      );
      expect(posts).toHaveLength(0);
    });

    it('falls back to the entered unit price when only unit is provided on a side', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const inputs = await enterCreateMode(user);
      await user.type(inputs.saleUnit, '7');

      await user.click(screen.getByText('savePricing'));

      await waitFor(() => {
        const posts = calls.filter(
          (c) => c.method === 'POST' && c.url.endsWith('/price'),
        );
        expect(posts).toHaveLength(1);
      });

      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/price'),
      );
      const body = JSON.parse(post.body);
      expect(body.standardPrice).toBe('7');
      expect(body.listPrice).toBe('7');
      expect(body.priceLimit).toBe('7');
    });

    it('falls back to the entered list price when only list is provided on a side', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price/defaults': { defaults: {} },
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new-row' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const inputs = await enterCreateMode(user);
      await user.type(inputs.saleList, '9');

      await user.click(screen.getByText('savePricing'));

      await waitFor(() => {
        const posts = calls.filter(
          (c) => c.method === 'POST' && c.url.endsWith('/price'),
        );
        expect(posts).toHaveLength(1);
      });

      const post = calls.find(
        (c) => c.method === 'POST' && c.url.endsWith('/price'),
      );
      const body = JSON.parse(post.body);
      expect(body.standardPrice).toBe('9');
      expect(body.listPrice).toBe('9');
      expect(body.priceLimit).toBe('9');
    });
  });

  // -------------------------------------------------------------------
  // Edit-mode dialog tests
  // -------------------------------------------------------------------

  describe('edit-mode dialog — lazy selector fetch', () => {
    function rowsPayload() {
      return {
        response: {
          data: [
            {
              id: 'price-existing-1',
              standardPrice: 10,
              listPrice: 12,
              priceListVersion: 'plv-other',
              'priceListVersion$_identifier': 'Existing Sales List',
              'priceListVersion$salesPriceList': true,
            },
          ],
        },
      };
    }

    it('lazily fetches /price/selectors/<col> when dialog opens with empty options', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': rowsPayload(),
          'GET /price/selectors/': { body: selectorItemsPayload() },
        },
        calls,
      );

      const user = userEvent.setup();
      // No catalogs prop -> selectorOptions starts empty -> dialog lazy-fetches.
      renderBar({ api: apiWithPriceSelector() });

      await screen.findByText('editPricing');
      await user.click(screen.getByText('editPricing'));

      // Lazy selector fetch should fire.
      await waitFor(() => {
        const selectorCalls = calls.filter((c) =>
          c.url.includes('/price/selectors/M_PriceList_Version_ID'),
        );
        expect(selectorCalls.length).toBeGreaterThan(0);
      });

      // Click "+" on the sales card (the section title is rendered as 'priceSalesLists').
      // There are two "+" buttons (sales + purchase); the first one is the sales card.
      const plusButtons = screen.getAllByRole('button', { name: '+' });
      expect(plusButtons.length).toBeGreaterThanOrEqual(2);
      await user.click(plusButtons[0]);

      // The select for adding a sales row must contain only sales-flagged options.
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
      const select = screen.getByRole('combobox');
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o) => o.value,
      );
      // Placeholder option has empty value; the rest must be sales-flagged.
      expect(optionValues).toContain(SALES_PLV_ID);
      expect(optionValues).not.toContain(PURCHASE_PLV_ID);
    });

    it('skips the lazy /price/selectors fetch when selectorOptions is pre-populated', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': rowsPayload(),
          'GET /price/selectors/': { body: selectorItemsPayload() },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({
        catalogs: catalogsWithPlv(),
        api: apiWithPriceSelector(),
      });

      await screen.findByText('editPricing');
      await user.click(screen.getByText('editPricing'));

      // Open the add-row form on the sales card.
      const plusButtons = await screen.findAllByRole('button', { name: '+' });
      await user.click(plusButtons[0]);

      // Select must be populated from injected catalogs (no lazy fetch needed).
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
      const select = screen.getByRole('combobox');
      const optionValues = Array.from(select.querySelectorAll('option')).map(
        (o) => o.value,
      );
      expect(optionValues).toContain(SALES_PLV_ID);

      // Give any pending async a chance to land, then assert no selector fetch.
      await new Promise((r) => setTimeout(r, 30));
      const selectorCalls = calls.filter((c) =>
        c.url.includes('/price/selectors/'),
      );
      expect(selectorCalls).toHaveLength(0);
    });

    it('disables the select with loadingPricing placeholder while lazy fetch is pending', async () => {
      let resolveSelector;
      const selectorPromise = new Promise((resolve) => {
        resolveSelector = resolve;
      });

      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': rowsPayload(),
          'GET /price/selectors/': () =>
            selectorPromise.then(() => ({ body: selectorItemsPayload() })),
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ api: apiWithPriceSelector() });

      await screen.findByText('editPricing');
      await user.click(screen.getByText('editPricing'));

      // Open the add-row form on the sales card while selector fetch is still pending.
      const plusButtons = await screen.findAllByRole('button', { name: '+' });
      await user.click(plusButtons[0]);

      const select = await screen.findByRole('combobox');
      // While pending: disabled + loadingPricing placeholder.
      expect(select).toBeDisabled();
      expect(select.querySelector('option').textContent).toBe('loadingPricing');

      // Resolve the pending fetch and wait for the select to enable.
      await act(async () => {
        resolveSelector();
        await selectorPromise;
      });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });
      const updated = screen.getByRole('combobox');
      expect(updated.querySelector('option').textContent).toBe('priceSelectVersion');
    });

    it('honors the selectorColumn prop derived from api.selectors[*].column', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': rowsPayload(),
          'GET /price/selectors/CUSTOM_COL': { body: selectorItemsPayload() },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({
        api: {
          selectors: [
            { entity: 'price', field: 'priceListVersion', column: 'CUSTOM_COL' },
          ],
        },
      });

      await screen.findByText('editPricing');
      await user.click(screen.getByText('editPricing'));

      await waitFor(() => {
        const selectorCalls = calls.filter((c) =>
          c.url.includes('/price/selectors/CUSTOM_COL'),
        );
        expect(selectorCalls.length).toBeGreaterThan(0);
      });

      // And the default column endpoint must NOT have been called.
      const defaultCalls = calls.filter(
        (c) =>
          c.url.includes('/price/selectors/M_PriceList_Version_ID')
          && !c.url.includes('CUSTOM_COL'),
      );
      expect(defaultCalls).toHaveLength(0);
    });
  });
});
