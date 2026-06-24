/**
 * Integration render test for GoodsMovementsProductSearchDrawer.
 * Renders the real component with mocked dependencies, mirroring the harness used
 * by InternalConsumptionProductSearchDrawer.vitest.jsx.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

vi.mock('@/lib/buildUrlWithParams.js', () => ({
  buildUrlWithParams: (url, params) => {
    const search = new URLSearchParams(params).toString();
    return search ? `${url}?${search}` : url;
  },
}));

import GoodsMovementsProductSearchDrawer from '../GoodsMovementsProductSearchDrawer.jsx';

describe('GoodsMovementsProductSearchDrawer', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    selectorUrl: 'http://localhost/sws/neo/goods-movements/lines/selectors/M_Product_ID',
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], hasMore: false }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <GoodsMovementsProductSearchDrawer {...defaultProps} open={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the dialog when open', () => {
    render(<GoodsMovementsProductSearchDrawer {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders custom title in the search placeholder when provided', () => {
    render(<GoodsMovementsProductSearchDrawer {...defaultProps} title="Producto" />);
    expect(screen.getByPlaceholderText(/Producto/)).toBeInTheDocument();
  });

  it('does not fetch when selectorUrl is missing', () => {
    render(<GoodsMovementsProductSearchDrawer {...defaultProps} selectorUrl={null} />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when token is missing', () => {
    render(<GoodsMovementsProductSearchDrawer {...defaultProps} token={null} />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('keeps both the generic null-locator row and the concrete locator row', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          // Generic null-locator row for the product (no warehouse) — kept so a
          // product with no stock anywhere is still selectable (Classic parity).
          { id: 'P1', name: 'Agua', searchKey: 'SK-001', _aux: { _LOC: null, _QTY: '0' } },
          // Concrete locator row for the same product — kept with qty + bin label.
          { id: 'P1', name: 'Agua', searchKey: 'SK-001', warehouse: 'Almacen GO', _aux: { _LOC: 'LOC-1', _QTY: '2800' } },
        ],
        hasMore: false,
      }),
    });

    render(<GoodsMovementsProductSearchDrawer {...defaultProps} />);
    await vi.advanceTimersByTimeAsync(100);

    // BOTH rows render: the generic (null locator) and the concrete locator row.
    await waitFor(() => {
      const options = screen.getAllByTestId(/^gm-product-option-/);
      expect(options).toHaveLength(2);
    });

    // Product name + searchKey appear once per row (two of each).
    expect(screen.getAllByText('Agua')).toHaveLength(2);
    expect(screen.getAllByText('SK-001')).toHaveLength(2);

    // The concrete row shows qty-on-hand (formatted with a thousands separator).
    expect(screen.getByText((2800).toLocaleString())).toBeInTheDocument();

    // Only the concrete row carries a bin/warehouse label. getBinLabel returns null
    // for the generic row (no _LOC, no warehouse), so 'Almacen GO' appears exactly once.
    expect(screen.getAllByText(/Almacen GO/)).toHaveLength(1);
  });

  it('removes exact duplicates (same product id + same _LOC) surfaced twice', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: 'P1', name: 'Agua', searchKey: 'SK-001', warehouse: 'Almacen GO', _aux: { _LOC: 'LOC-1', _QTY: '2800' } },
          // Exact duplicate (same id + same locator) — pagination can surface it twice.
          { id: 'P1', name: 'Agua', searchKey: 'SK-001', warehouse: 'Almacen GO', _aux: { _LOC: 'LOC-1', _QTY: '2800' } },
        ],
        hasMore: false,
      }),
    });

    render(<GoodsMovementsProductSearchDrawer {...defaultProps} />);
    await vi.advanceTimersByTimeAsync(100);

    // The exact duplicate collapses to a single option.
    await waitFor(() => {
      const options = screen.getAllByTestId(/^gm-product-option-/);
      expect(options).toHaveLength(1);
    });
  });

  it('returns the full selected row via onSelect', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const concreteRow = {
      id: 'P1', name: 'Agua', searchKey: 'SK-001', warehouse: 'Almacen GO',
      _aux: { _LOC: 'LOC-1', _QTY: '2800' },
    };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [concreteRow], hasMore: false }),
    });

    render(<GoodsMovementsProductSearchDrawer {...defaultProps} />);
    await vi.advanceTimersByTimeAsync(100);

    const option = await screen.findByTestId('gm-product-option-P1');
    await user.click(option);
    // Selection is committed after a short highlight delay.
    await vi.advanceTimersByTimeAsync(200);

    await waitFor(() => {
      expect(defaultProps.onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'P1', _aux: expect.objectContaining({ _LOC: 'LOC-1' }) }),
      );
    });
  });

  it('shows a no-results message when a query returns nothing', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], hasMore: false }),
    });

    render(<GoodsMovementsProductSearchDrawer {...defaultProps} />);
    await vi.advanceTimersByTimeAsync(50);

    const input = screen.getByPlaceholderText(/searchLabelPrefix/);
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).type(input, 'nonexistent');
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(screen.getByText(/productSearchNoResults/)).toBeInTheDocument();
    });
  });
});
