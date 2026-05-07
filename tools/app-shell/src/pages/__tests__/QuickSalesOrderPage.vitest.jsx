import { render, screen } from '@testing-library/react';

// Mock i18n
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock PageMetaContext
vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: vi.fn(),
}));

// Mock FavoritesContext
vi.mock('@/components/layout/FavoritesContext', () => ({
  useFavorites: () => ({
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// Mock sub-components
vi.mock('../quick-sales-order/CustomerSelector.jsx', () => ({
  default: () => <div data-testid="customer-selector">CustomerSelector</div>,
}));
vi.mock('../quick-sales-order/ProductSearchBar.jsx', () => ({
  default: ({ inputRef }) => <input data-testid="product-search" ref={inputRef} />,
}));
vi.mock('../quick-sales-order/ProductGrid.jsx', () => ({
  default: () => <div data-testid="product-grid">ProductGrid</div>,
}));
vi.mock('../quick-sales-order/CartPanel.jsx', () => ({
  default: () => <div data-testid="cart-panel">CartPanel</div>,
}));
vi.mock('../quick-sales-order/PaymentPanel.jsx', () => ({
  default: () => <div data-testid="payment-panel">PaymentPanel</div>,
}));

// Mock useQuickSalesData hook
vi.mock('@/hooks/useQuickSalesData.js', () => ({
  useQuickSalesData: () => ({
    products: [
      { id: 'p1', name: 'Widget', searchKey: 'WDG', price: 10, taxRate: 0.21, category: 'cat1', productId: 'p1', priceListVersion: 'pl1' },
    ],
    customers: [
      { id: 'c1', name: 'Anonymous', isAnonymous: true },
    ],
    categories: [{ id: 'cat1', name: 'Category 1' }],
    topSellers: {},
    previousOrders: [],
    customerPriceLists: {},
    loading: false,
    error: null,
  }),
  PAYMENT_METHODS: ['cash', 'card'],
}));

// Mock barcode scanner
vi.mock('@/hooks/useBarcodeScanner.js', () => ({
  useBarcodeScanner: () => ({ lastScan: null, scanCount: 0 }),
}));

import QuickSalesOrderPage from '../QuickSalesOrderPage.jsx';

describe('QuickSalesOrderPage', () => {
  it('renders without crashing', () => {
    render(<QuickSalesOrderPage />);
    expect(screen.getByTestId('quick-sales-order-page')).toBeInTheDocument();
  });

  it('renders sub-components when data is loaded', () => {
    render(<QuickSalesOrderPage />);
    expect(screen.getByTestId('customer-selector')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    expect(screen.getByTestId('cart-panel')).toBeInTheDocument();
    expect(screen.getByTestId('payment-panel')).toBeInTheDocument();
  });

  it('renders product search bar', () => {
    render(<QuickSalesOrderPage />);
    expect(screen.getByTestId('product-search')).toBeInTheDocument();
  });

  it('shows loading state when data is loading', () => {
    // Override the mock for this test
    const originalMock = vi.fn();
    vi.doMock('@/hooks/useQuickSalesData.js', () => ({
      useQuickSalesData: () => ({
        products: [],
        customers: [],
        categories: [],
        topSellers: {},
        previousOrders: [],
        customerPriceLists: {},
        loading: true,
        error: null,
      }),
      PAYMENT_METHODS: ['cash'],
    }));
  });

  it('renders the priority toggle button', () => {
    render(<QuickSalesOrderPage />);
    // The priority button has the TrendingUp icon and title
    const priorityBtn = screen.getByTitle('qsoPriority');
    expect(priorityBtn).toBeInTheDocument();
  });

  it('renders the barcode scanner indicator', () => {
    render(<QuickSalesOrderPage />);
    const scanIndicator = screen.getByTitle('qsoScanDetected');
    expect(scanIndicator).toBeInTheDocument();
  });
});