import { render, screen } from '@testing-library/react';

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

vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: () => [],
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
});
