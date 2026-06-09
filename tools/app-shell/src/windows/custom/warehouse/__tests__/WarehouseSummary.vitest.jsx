vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => params ? `${key}(${JSON.stringify(params)})` : key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('../useWarehouseStock', () => ({
  useWarehouseStock: vi.fn(),
}));

vi.mock('@/lib/dashboardNumberFormat', () => ({
  niceScale: (max) => ({ niceMax: max || 10, ticks: [0, max || 10] }),
  formatDashboardAxisTick: (v) => String(v),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <span>{children}</span>,
}));

import { render, screen } from '@testing-library/react';
import WarehouseSummary from '../WarehouseSummary.jsx';
import { useWarehouseStock } from '../useWarehouseStock';

describe('WarehouseSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading message while stock is loading', () => {
    useWarehouseStock.mockReturnValue({ loading: true, error: null, products: [], transactions: [] });
    render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(screen.getByText('warehouseLoadingStock')).toBeInTheDocument();
  });

  it('shows error message on fetch failure', () => {
    useWarehouseStock.mockReturnValue({ loading: false, error: 'Network error', products: [], transactions: [] });
    render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(screen.getByText('warehouseStockError')).toBeInTheDocument();
  });

  it('renders products count and total units from stock data', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      products: [
        { qty: 10 },
        { qty: 5 },
        { qty: 3 },
      ],
      transactions: [],
    });
    render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(screen.getByText('warehouseProducts')).toBeInTheDocument();
    expect(screen.getByText('warehouseTotalUnits')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // totalProducts
    expect(screen.getByText('18')).toBeInTheDocument(); // totalUnits
  });

  it('renders the stock trend label when data is available', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      products: [{ qty: 1 }],
      transactions: [],
    });
    render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(screen.getAllByText('warehouseStockTrend').length).toBeGreaterThan(0);
  });

  it('shows no-data message in chart when no transactions', () => {
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      products: [{ qty: 5 }],
      transactions: [],
    });
    render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(screen.getAllByText('warehouseNoMovementData').length).toBeGreaterThan(0);
  });

  it('renders SVG chart when transactions with quantities exist', () => {
    const now = new Date();
    useWarehouseStock.mockReturnValue({
      loading: false,
      error: null,
      products: [{ qty: 10 }],
      transactions: [
        { movementDate: now.toISOString(), movementQuantity: 20 },
        { movementDate: now.toISOString(), movementQuantity: 30 },
      ],
    });
    const { container } = render(<WarehouseSummary data={{ id: 'wh-1' }} token="t" apiBaseUrl="/api" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without crashing when data prop is undefined', () => {
    useWarehouseStock.mockReturnValue({ loading: true, error: null, products: [], transactions: [] });
    expect(() => render(<WarehouseSummary token="t" apiBaseUrl="/api" />)).not.toThrow();
  });
});
