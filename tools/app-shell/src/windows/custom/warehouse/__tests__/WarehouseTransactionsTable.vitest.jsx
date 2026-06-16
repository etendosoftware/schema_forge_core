// --- Mocks (before imports) ---

vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

vi.mock('../useWarehouseStock', () => ({
  useWarehouseStock: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Loader2: (props) => <span data-testid="loader" {...props} />,
  ArrowUpDown: (props) => <span data-testid="icon-sort" {...props} />,
  ArrowUp: (props) => <span data-testid="icon-up" {...props} />,
  ArrowDown: (props) => <span data-testid="icon-down" {...props} />,
}));

// --- Import under test ---

import { render, screen, fireEvent } from '@testing-library/react';
import WarehouseTransactionsTable from '../WarehouseTransactionsTable.jsx';
import { useWarehouseStock } from '../useWarehouseStock';

// --- Helpers ---

const defaultProps = {
  parentId: 'wh-1',
  token: 'test-token',
  apiBaseUrl: '/sws/neo/warehouse',
  onCount: vi.fn(),
};

// --- Tests ---

describe('WarehouseTransactionsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    useWarehouseStock.mockReturnValue({ loading: true, error: null, transactions: null });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByText('warehouseLoadingTransactions')).toBeInTheDocument();
  });

  it('shows error state', () => {
    useWarehouseStock.mockReturnValue({ loading: false, error: 'Network error', transactions: null });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByText(/warehouseTransactionsError/)).toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    useWarehouseStock.mockReturnValue({ loading: false, error: null, transactions: [] });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByText('warehouseNoTransactions')).toBeInTheDocument();
  });

  it('renders table with transactions', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      transactions: [
        {
          id: 'tx-1',
          movementDate: '2025-01-15',
          'product$_identifier': 'Widget A',
          movementType: 'V+',
          movementQuantity: 10,
        },
      ],
    });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
  });

  it('calls onCount with transaction count', () => {
    useWarehouseStock.mockReturnValue({ loading: false, error: null, transactions: [{ id: 'tx-1', movementDate: '2025-01-15', movementQuantity: 5 }] });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(defaultProps.onCount).toHaveBeenCalledWith(1);
  });

  it('renders search input', () => {
    useWarehouseStock.mockReturnValue({ loading: false, error: null, transactions: [] });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByPlaceholderText('warehouseFilterPlaceholder')).toBeInTheDocument();
  });

  it('filters transactions by search', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      transactions: [
        { id: 'tx-1', movementDate: '2025-01-15', 'product$_identifier': 'Widget A', movementType: 'V+', movementQuantity: 10 },
        { id: 'tx-2', movementDate: '2025-01-16', 'product$_identifier': 'Gadget B', movementType: 'C-', movementQuantity: -5 },
      ],
    });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('warehouseFilterPlaceholder'), { target: { value: 'Widget' } });
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.queryByText('Gadget B')).not.toBeInTheDocument();
  });

  it('shows no filter results message', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      transactions: [
        { id: 'tx-1', movementDate: '2025-01-15', 'product$_identifier': 'Widget A', movementType: 'V+', movementQuantity: 10 },
      ],
    });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('warehouseFilterPlaceholder'), { target: { value: 'ZZZ' } });
    expect(screen.getByText('warehouseNoFilterResults')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      transactions: [{ id: 'tx-1', movementDate: '2025-01-15', movementQuantity: 5 }],
    });
    render(<WarehouseTransactionsTable {...defaultProps} />);
    expect(screen.getByText('warehouseDate')).toBeInTheDocument();
    expect(screen.getByText('warehouseProduct')).toBeInTheDocument();
    expect(screen.getByText('warehouseType')).toBeInTheDocument();
    expect(screen.getByText('warehouseQty')).toBeInTheDocument();
  });
});
