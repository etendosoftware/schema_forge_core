// --- Mocks (before imports) ---

vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// --- Import under test ---

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MoveStockModal from '../MoveStockModal.jsx';

// --- Helpers ---

const defaultProps = {
  product: { id: 'p1', label: 'Widget', qty: 10, uom: 'EA' },
  currentWarehouseId: 'wh-1',
  data: { organization: { id: 'org-1' } },
  token: 'test-token',
  apiBaseUrl: '/sws/neo/warehouse',
  onSuccess: vi.fn(),
  onClose: vi.fn(),
};

function mockFetch({ warehouses = [] } = {}) {
  globalThis.fetch = vi.fn((url) => {
    if (url.includes('/warehouse?')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: warehouses } }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// --- Tests ---

describe('MoveStockModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal with title and product info', async () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    expect(screen.getByText('warehouseMoveTitle')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
  });

  it('shows loading state for warehouses', () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    expect(screen.getByText('warehouseMoveLoadingWarehouses')).toBeInTheDocument();
  });

  it('shows no warehouses message when list is empty', async () => {
    mockFetch({ warehouses: [] });
    render(<MoveStockModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('warehouseMoveNoWarehouses')).toBeInTheDocument();
    });
  });

  it('populates warehouse dropdown after loading', async () => {
    mockFetch({ warehouses: [{ id: 'wh-2', name: 'Warehouse B' }, { id: 'wh-3', name: 'Warehouse C' }] });
    render(<MoveStockModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Warehouse B')).toBeInTheDocument();
    });
    expect(screen.getByText('Warehouse C')).toBeInTheDocument();
  });

  it('filters out current warehouse from list', async () => {
    mockFetch({
      warehouses: [
        { id: 'wh-1', name: 'Current WH' },
        { id: 'wh-2', name: 'Other WH' },
      ],
    });
    render(<MoveStockModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Other WH')).toBeInTheDocument();
    });
    expect(screen.queryByText('Current WH')).not.toBeInTheDocument();
  });

  it('renders cancel button', () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    expect(screen.getByText('cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    fireEvent.click(screen.getByText('cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    mockFetch();
    const { container } = render(<MoveStockModal {...defaultProps} />);
    // Click on the overlay (first child)
    fireEvent.click(container.firstChild);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows product UOM', () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    expect(screen.getByText('EA')).toBeInTheDocument();
  });

  it('renders description textarea', () => {
    mockFetch();
    render(<MoveStockModal {...defaultProps} />);
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });
});
