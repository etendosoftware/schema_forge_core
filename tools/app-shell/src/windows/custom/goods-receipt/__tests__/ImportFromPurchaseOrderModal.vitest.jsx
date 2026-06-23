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

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onChange, onClick, disabled, indeterminate, ...props }) =>
    <input
      type="checkbox"
      checked={!!checked}
      disabled={!!disabled}
      onChange={onChange || (() => {})}
      onClick={onClick}
      ref={el => { if (el) el.indeterminate = !!indeterminate; }}
      {...props}
    />,
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

  it('renders close X button in header', () => {
    renderModal();
    // The close button contains the times symbol
    const closeBtn = screen.getByText('\u00D7');
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    const { props } = renderModal();
    const closeBtn = screen.getByText('\u00D7');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('import button is disabled when no lines are selected', () => {
    renderModal();
    // The import button text includes the UI key
    const buttons = screen.getAllByRole('button');
    const importBtn = buttons.find(b => b.textContent.includes('importSelected'));
    expect(importBtn).toBeDefined();
    expect(importBtn.disabled).toBe(true);
  });

  it('search input filters orders by document number', async () => {
    renderModal();
    await screen.findByText('PO-001');

    const searchInput = screen.getByPlaceholderText('searchPurchaseOrder');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

    // Should show "no orders match" message
    expect(screen.getByText('noOrdersMatchYourSearch')).toBeInTheDocument();
  });

  it('search input clears to show all orders again', async () => {
    renderModal();
    await screen.findByText('PO-001');

    const searchInput = screen.getByPlaceholderText('searchPurchaseOrder');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });
    expect(screen.getByText('noOrdersMatchYourSearch')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('filters out non-completed orders', async () => {
    const mixedOrders = [
      ...sampleOrders,
      { id: 'order-2', documentNo: 'PO-002', documentStatus: 'DR', businessPartner: 'bp-1', orderDate: '2024-02-01' },
    ];

    global.fetch = vi.fn((url) => {
      if (url.includes('/purchase-order/header')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: mixedOrders } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      });
    });

    renderModal();
    await screen.findByText('PO-001');
    // PO-002 is draft, should not appear
    expect(screen.queryByText('PO-002')).not.toBeInTheDocument();
  });

  it('filters out orders for different business partner', async () => {
    const otherBpOrders = [
      ...sampleOrders,
      { id: 'order-3', documentNo: 'PO-003', documentStatus: 'CO', businessPartner: 'bp-other', orderDate: '2024-03-01' },
    ];

    global.fetch = vi.fn((url) => {
      if (url.includes('/purchase-order/header')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: otherBpOrders } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      });
    });

    renderModal();
    await screen.findByText('PO-001');
    // PO-003 is for different BP, should not appear
    expect(screen.queryByText('PO-003')).not.toBeInTheDocument();
  });

  it('shows order date formatted', async () => {
    renderModal();
    await screen.findByText('PO-001');
    // Use the local-time constructor so the result is timezone-independent
    // (matches ImportLinesModal.fmtDate which parses the ISO string without UTC offset).
    const expected = new Date(2024, 0, 15).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('shows order total amount formatted', async () => {
    renderModal();
    await screen.findByText('PO-001');
    // grandTotalAmount = 1500, shown via toLocaleString (no currency symbol).
    const expected = Number(1500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('shows selected lines count in footer', async () => {
    renderModal();
    await screen.findByText('PO-001');
    // No lines selected initially
    expect(screen.getByText('selectLinesToImport')).toBeInTheDocument();
  });

  it('handles fetch failure gracefully', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network failure')));
    renderModal();
    // Should eventually show the empty state after loading
    await screen.findByText('noCompletedPurchaseOrdersWithPendingQuantitiesForThisVendor');
  });

  it('expands order on click to show lines', async () => {
    const sampleLines = [
      { id: 'line-1', product: 'prod-1', 'product$_identifier': 'Widget A', orderedQuantity: 10, deliveredQuantity: 0 },
    ];

    global.fetch = vi.fn((url) => {
      if (url.includes('/purchase-order/header')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: { data: sampleOrders } }) });
      }
      if (url.includes('/purchase-order/lines')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: { data: sampleLines } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: { data: [] } }) });
    });

    renderModal();
    await screen.findByText('PO-001');

    // Click the order row to expand
    fireEvent.click(screen.getByText('PO-001'));

    // Should show line product name
    await screen.findByText('Widget A');
    expect(screen.getByText('Widget A')).toBeInTheDocument();
  });
});
