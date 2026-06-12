/**
 * Integration test for InlineLinesPanel — renders the component in jsdom
 * with minimal mocks. No server, no DB, no browser needed.
 */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InlineLinesPanel from '../InlineLinesPanel.jsx';
import React, { createRef } from 'react';

// --- Mocks (one block, no spreading across files) ---

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/i18n', () => ({
  useLabel: () => () => '',
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/lib/formatAmount.js', () => ({
  formatAmount: (v, cur) => (v != null ? `${Number(v).toFixed(2)}${cur ? ` ${cur}` : ''}` : '—'),
}));

vi.mock('@/lib/resolveIdentifier.js', () => ({
  resolveIdentifier: (row, key) => {
    const idKey = `${key}$_identifier`;
    return row[idKey] || row[key] || '';
  },
}));

vi.mock('@/lib/resolveColumnLabel.js', () => ({
  resolveColumnLabel: (col) => col.label || col.key,
}));

vi.mock('@/lib/linesColumnWidth.js', () => ({
  columnFlex: () => '1 0 100px',
  columnMinWidthPx: () => 100,
}));

// Stub the heavy sub-components that need their own providers
vi.mock('../InlineSearchCombo.jsx', () => ({
  InlineSearchCombo: ({ field, displayLabel }) => (
    <span data-testid={`inline-combo-${field.key}`}>{displayLabel}</span>
  ),
}));
vi.mock('../SelectorInput.jsx', () => ({
  SelectorInput: () => <span data-testid="selector-input" />,
}));
vi.mock('../ProductSearchDrawer.jsx', () => ({
  default: () => null,
}));
vi.mock('./quickActionsStyle.js', () => ({
  QUICK_ACTIONS_PILL_CLASS: 'pill',
}));

// --- Test data ---

const COLUMNS = [
  { key: 'product', label: 'Product', type: 'string', column: 'M_Product_ID' },
  { key: 'quantity', label: 'Qty', type: 'number' },
  { key: 'unitPrice', label: 'Price', type: 'amount' },
  { key: 'lineNetAmount', label: 'Total', type: 'amount' },
];

const ROWS = [
  { id: 'L1', product: 'P1', 'product$_identifier': 'Widget', quantity: 10, unitPrice: 5.0, lineNetAmount: 50 },
  { id: 'L2', product: 'P2', 'product$_identifier': 'Gadget', quantity: 3, unitPrice: 20.0, lineNetAmount: 60 },
];

function renderPanel(props = {}) {
  const ref = createRef();
  const result = render(
    <InlineLinesPanel
      ref={ref}
      columns={COLUMNS}
      data={ROWS}
      entity="lines"
      token="test"
      apiBaseUrl="/api"
      selectorContext={{}}
      onSelectionChange={vi.fn()}
      onUpdateRow={vi.fn().mockResolvedValue()}
      onDeleteRow={vi.fn().mockResolvedValue()}
      {...props}
    />,
  );
  return { ...result, ref };
}

// --- Tests ---

describe('InlineLinesPanel', () => {
  it('renders the panel container', () => {
    renderPanel();
    expect(screen.getByTestId('inline-lines-panel')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    renderPanel();
    expect(screen.getByTestId('column-header-product')).toBeInTheDocument();
    expect(screen.getByTestId('column-header-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('column-header-unitPrice')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    renderPanel();
    expect(screen.getByTestId('line-row-L1')).toBeInTheDocument();
    expect(screen.getByTestId('line-row-L2')).toBeInTheDocument();
  });

  it('displays resolved identifiers (product name, not ID)', () => {
    renderPanel();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toBeInTheDocument();
  });

  it('formats amount columns', () => {
    renderPanel();
    // formatAmount mock returns "50.00" for lineNetAmount=50
    expect(screen.getByText('50.00')).toBeInTheDocument();
    expect(screen.getByText('60.00')).toBeInTheDocument();
  });

  it('shows edit and delete actions on hover', async () => {
    renderPanel();
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.hover(row);
    });
    // Actions container should appear
    const actions = within(row).getByTestId('line-actions');
    expect(actions).toBeInTheDocument();
  });

  it('does not show actions when isDocumentReadOnly', async () => {
    renderPanel({ isDocumentReadOnly: true });
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.hover(row);
    });
    // line-actions may render but the action buttons inside should not
    const actions = within(row).queryByTestId('line-actions');
    if (actions) {
      // In readonly mode, showActions is false → no buttons rendered inside
      expect(within(actions).queryByRole('button')).toBeNull();
    }
  });

  it('handles empty data gracefully', () => {
    renderPanel({ data: [] });
    expect(screen.getByTestId('inline-lines-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('line-row-L1')).toBeNull();
  });

  it('respects hidden columns', () => {
    const cols = [
      ...COLUMNS,
      { key: 'secret', label: 'Secret', type: 'string', hidden: true },
    ];
    renderPanel({ columns: cols });
    expect(screen.queryByTestId('column-header-secret')).toBeNull();
  });

  it('exposes imperative ref with flushPendingEdits and clearSelection', () => {
    const { ref } = renderPanel();
    expect(typeof ref.current.flushPendingEdits).toBe('function');
    expect(typeof ref.current.closeEditing).toBe('function');
    expect(typeof ref.current.clearSelection).toBe('function');
  });

  it('flushPendingEdits resolves a promise', async () => {
    const { ref } = renderPanel();
    await expect(ref.current.flushPendingEdits()).resolves.toBeUndefined();
  });

  it('onRowClick fires when provided and row body is clicked', async () => {
    const onRowClick = vi.fn();
    renderPanel({ onRowClick });
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.click(row);
    });
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });
});
