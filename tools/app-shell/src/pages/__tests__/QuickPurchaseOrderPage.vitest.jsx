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
vi.mock('../quick-purchase-order/SupplierSelector.jsx', () => ({
  default: () => <div data-testid="supplier-selector">SupplierSelector</div>,
}));
vi.mock('../quick-sales-order/ProductSearchBar.jsx', () => ({
  default: ({ inputRef }) => <input data-testid="product-search" ref={inputRef} />,
}));
vi.mock('../quick-sales-order/ProductGrid.jsx', () => ({
  default: () => <div data-testid="product-grid">ProductGrid</div>,
}));
vi.mock('../quick-purchase-order/CartPanel.jsx', () => ({
  default: () => <div data-testid="cart-panel">CartPanel</div>,
}));
vi.mock('../quick-purchase-order/SendOrderPanel.jsx', () => ({
  default: () => <div data-testid="send-order-panel">SendOrderPanel</div>,
}));

// Mock useQuickPurchaseData hook
vi.mock('@/hooks/useQuickPurchaseData.js', () => ({
  useQuickPurchaseData: () => ({
    products: [
      { id: 'p1', name: 'Raw Material', searchKey: 'RM1', price: 25, taxRate: 0.21, category: 'cat1', productId: 'p1', priceListVersion: 'pl1' },
    ],
    suppliers: [
      { id: 's1', name: 'Supplier A' },
    ],
    categories: [{ id: 'cat1', name: 'Category 1' }],
    topSellers: {},
    previousOrders: [],
    supplierPriceLists: {},
    loading: false,
    error: null,
  }),
  SEND_METHODS: ['email', 'print'],
}));

// Mock barcode scanner
vi.mock('@/hooks/useBarcodeScanner.js', () => ({
  useBarcodeScanner: () => ({ lastScan: null, scanCount: 0 }),
}));

import QuickPurchaseOrderPage from '../QuickPurchaseOrderPage.jsx';

describe('QuickPurchaseOrderPage', () => {
  it('renders without crashing', () => {
    render(<QuickPurchaseOrderPage />);
    expect(screen.getByTestId('quick-purchase-order-page')).toBeInTheDocument();
  });

  it('renders sub-components when data is loaded', () => {
    render(<QuickPurchaseOrderPage />);
    expect(screen.getByTestId('supplier-selector')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
    expect(screen.getByTestId('cart-panel')).toBeInTheDocument();
    expect(screen.getByTestId('send-order-panel')).toBeInTheDocument();
  });

  it('renders product search bar', () => {
    render(<QuickPurchaseOrderPage />);
    expect(screen.getByTestId('product-search')).toBeInTheDocument();
  });

  it('renders the priority toggle button', () => {
    render(<QuickPurchaseOrderPage />);
    const priorityBtn = screen.getByTitle('qpoPriority');
    expect(priorityBtn).toBeInTheDocument();
  });

  it('renders the barcode scanner indicator', () => {
    render(<QuickPurchaseOrderPage />);
    const scanIndicator = screen.getByTitle('qpoScanDetected');
    expect(scanIndicator).toBeInTheDocument();
  });
});