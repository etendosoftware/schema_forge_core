import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => 'USD',
}));

vi.mock('@/lib/formatCurrency', () => ({
  formatCurrency: (_curr, val) => `$${Number(val || 0).toFixed(2)}`,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// --- Import under test ----------------------------------------------------

import ImportFromPurchaseOrderModal from '../ImportFromPurchaseOrderModal.jsx';

// --- Helpers --------------------------------------------------------------

const sampleOrders = [
  {
    id: 'order-1',
    documentNo: 'PO-001',
    documentStatus: 'CO',
    businessPartner: 'bp-1',
    'businessPartner$_identifier': 'Acme Corp',
    orderDate: '2024-01-15',
    grandTotalAmount: 1500,
    'currency$_identifier': 'USD',
  },
];

function renderModal(overrides = {}) {
  const defaults = {
    receiptId: 'receipt-1',
    bpId: 'bp-1',
    base: '/api',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };
  return { ...render(<ImportFromPurchaseOrderModal {...defaults} {...overrides} />), props: { ...defaults, ...overrides } };
}

// --- Tests ----------------------------------------------------------------

describe('ImportFromPurchaseOrderModal', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      // Orders endpoint
      if (url.includes('/purchase-order/header')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: sampleOrders } }),
        });
      }
      // Receipt lines endpoint
      if (url.includes('/goodsReceiptLine')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the modal title', () => {
    renderModal();
    expect(screen.getByText('importFromPurchaseOrder')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderModal();
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('renders purchase orders after loading', async () => {
    renderModal();
    await screen.findByText('PO-001');
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('shows business partner name', async () => {
    renderModal();
    await screen.findByText('Acme Corp');
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderModal();
    const input = screen.getByPlaceholderText('searchPurchaseOrder');
    expect(input).toBeInTheDocument();
  });

  it('shows empty state when no orders match the business partner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      }),
    );

    renderModal();
    await screen.findByText('noCompletedPurchaseOrdersWithPendingQuantitiesForThisVendor');
  });

  it('renders cancel and import buttons in footer', () => {
    renderModal();
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('cancel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the backdrop', () => {
    const { props, container } = renderModal();
    // The outermost div is the backdrop
    const backdrop = container.firstChild;
    fireEvent.click(backdrop);
    expect(props.onClose).toHaveBeenCalled();
  });
});
