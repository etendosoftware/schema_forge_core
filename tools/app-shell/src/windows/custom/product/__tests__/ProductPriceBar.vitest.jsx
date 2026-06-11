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
  Pencil: (props) => <span data-testid="pencil-icon" {...props} />,
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

  it('renders without crashing', async () => {
    renderBar();
    await screen.findByText('priceSalesLists');
    expect(screen.getByText('priceSalesLists')).toBeInTheDocument();
    expect(screen.getByText('pricePurchaseLists')).toBeInTheDocument();
  });

  it('shows save-first message when no record id', () => {
    renderBar({ data: {} });
    expect(screen.getByText('saveProductFirstPricing')).toBeInTheDocument();
  });

  it('renders both sales and purchase table titles', async () => {
    renderBar();
    await screen.findByText('priceSalesLists');
    expect(screen.getByText('priceSalesLists')).toBeInTheDocument();
    expect(screen.getByText('pricePurchaseLists')).toBeInTheDocument();
  });

  it('renders pencil edit buttons when there are no price rows', async () => {
    renderBar();
    await screen.findByTestId('price-sales-edit');
    expect(screen.getByTestId('price-sales-edit')).toBeInTheDocument();
    expect(screen.getByTestId('price-purchase-edit')).toBeInTheDocument();
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

  it('renders pencil edit buttons when rows exist', async () => {
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
    await screen.findByTestId('price-sales-edit');
    expect(screen.getByTestId('price-sales-edit')).toBeInTheDocument();
    expect(screen.getByTestId('price-purchase-edit')).toBeInTheDocument();
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

  // -------------------------------------------------------------------
  // Dialog staged-row create tests
  // -------------------------------------------------------------------

  describe('dialog — staged row create', () => {
    it('clicking sales pencil opens dialog with sales section only', async () => {
      global.fetch = buildFetch({
        'GET /price?parentId=': { response: { data: [] } },
      });

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const pencil = await screen.findByTestId('price-sales-edit');
      await user.click(pencil);

      const dialog = screen.getByTestId('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent('priceSalesLists');
      expect(dialog).not.toHaveTextContent('pricePurchaseLists');
    });

    it('clicking purchase pencil opens dialog with purchase section only', async () => {
      global.fetch = buildFetch({
        'GET /price?parentId=': { response: { data: [] } },
      });

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      const pencil = await screen.findByTestId('price-purchase-edit');
      await user.click(pencil);

      const dialog = screen.getByTestId('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent('pricePurchaseLists');
      expect(dialog).not.toHaveTextContent('priceSalesLists');
    });

    it('adding a staged sales row and saving POSTs with sales PLV', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      // Open dialog via sales pencil
      const pencil = await screen.findByTestId('price-sales-edit');
      await user.click(pencil);

      // Click "+" to add a pending row
      const plusBtn = screen.getByRole('button', { name: '+' });
      await user.click(plusBtn);

      // Select sales PLV
      const select = screen.getByRole('combobox');
      await userEvent.setup().selectOptions(select, [SALES_PLV_ID]);

      // Fill unit price and list price
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '10');
      await user.type(inputs[1], '12');

      // Confirm staged add
      const confirmBtn = screen.getByRole('button', { name: '✓' });
      await user.click(confirmBtn);

      // Save changes
      const saveBtn = screen.getByRole('button', { name: 'saveChanges' });
      await user.click(saveBtn);

      await waitFor(() => {
        const posts = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/price'));
        expect(posts).toHaveLength(1);
      });

      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/price'));
      const body = JSON.parse(post.body);
      expect(body.priceListVersion).toBe(SALES_PLV_ID);
    });

    it('adding a staged purchase row and saving POSTs with purchase PLV', async () => {
      const calls = [];
      global.fetch = buildFetch(
        {
          'GET /price?parentId=': { response: { data: [] } },
          'POST /price': { id: 'new' },
        },
        calls,
      );

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      // Open dialog via purchase pencil
      const pencil = await screen.findByTestId('price-purchase-edit');
      await user.click(pencil);

      // Click "+" to add a pending row
      const plusBtn = screen.getByRole('button', { name: '+' });
      await user.click(plusBtn);

      // Select purchase PLV
      const select = screen.getByRole('combobox');
      await userEvent.setup().selectOptions(select, [PURCHASE_PLV_ID]);

      // Fill unit price and list price
      const inputs = screen.getAllByRole('spinbutton');
      await user.type(inputs[0], '5');
      await user.type(inputs[1], '6');

      // Confirm staged add
      const confirmBtn = screen.getByRole('button', { name: '✓' });
      await user.click(confirmBtn);

      // Save changes
      const saveBtn = screen.getByRole('button', { name: 'saveChanges' });
      await user.click(saveBtn);

      await waitFor(() => {
        const posts = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/price'));
        expect(posts).toHaveLength(1);
      });

      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/price'));
      const body = JSON.parse(post.body);
      expect(body.priceListVersion).toBe(PURCHASE_PLV_ID);
    });

    it('shows priceUnfinishedRows toast when pending row is not confirmed', async () => {
      const { toast } = await import('sonner');
      toast.info.mockClear();

      global.fetch = buildFetch({
        'GET /price?parentId=': { response: { data: [] } },
      });

      const user = userEvent.setup();
      renderBar({ catalogs: catalogsWithPlv(), api: apiWithPriceSelector() });

      // Open dialog via sales pencil
      const pencil = await screen.findByTestId('price-sales-edit');
      await user.click(pencil);

      // Click "+" but do NOT confirm (leave pending row)
      const plusBtn = screen.getByRole('button', { name: '+' });
      await user.click(plusBtn);

      // Click "Save changes" without confirming the pending row
      const saveBtn = screen.getByRole('button', { name: 'saveChanges' });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('priceUnfinishedRows');
      });
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

      await screen.findByTestId('price-sales-edit');
      await user.click(screen.getByTestId('price-sales-edit'));

      // Lazy selector fetch should fire.
      await waitFor(() => {
        const selectorCalls = calls.filter((c) =>
          c.url.includes('/price/selectors/M_PriceList_Version_ID'),
        );
        expect(selectorCalls.length).toBeGreaterThan(0);
      });

      // Click "+" on the sales section (focusedSection='sales' → only one "+" button in dialog).
      const plusBtn = screen.getByRole('button', { name: '+' });
      await user.click(plusBtn);

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

      await screen.findByTestId('price-sales-edit');
      await user.click(screen.getByTestId('price-sales-edit'));

      // Open the add-row form on the sales section.
      const plusBtn = await screen.findByRole('button', { name: '+' });
      await user.click(plusBtn);

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

      await screen.findByTestId('price-sales-edit');
      await user.click(screen.getByTestId('price-sales-edit'));

      // Open the add-row form on the sales section while selector fetch is still pending.
      const plusBtn = await screen.findByRole('button', { name: '+' });
      await user.click(plusBtn);

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

      await screen.findByTestId('price-sales-edit');
      await user.click(screen.getByTestId('price-sales-edit'));

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
