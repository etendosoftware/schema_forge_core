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

  // --- Extended coverage (pencil, trash, checkboxes, cell rendering) ---

  it('click pencil icon enters edit mode for the row', async () => {
    renderPanel();
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.hover(row);
    });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0]; // pencil is first
    await act(async () => {
      await userEvent.click(editBtn);
    });
    // After clicking pencil, the row should have edit cells — look for an input
    // inside the row (EditCell renders an <Input> for editable types).
    const inputs = within(row).queryAllByRole('textbox');
    // The 'product' column is type: 'string' and editable — should render an input
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('click trash icon fires onDeleteRow', async () => {
    const onDeleteRow = vi.fn().mockResolvedValue();
    renderPanel({ onDeleteRow });
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.hover(row);
    });
    const actions = within(row).getByTestId('line-actions');
    const buttons = within(actions).getAllByRole('button');
    const trashBtn = buttons[buttons.length - 1]; // trash is second/last
    await act(async () => {
      await userEvent.click(trashBtn);
    });
    expect(onDeleteRow).toHaveBeenCalledWith(ROWS[0]);
  });

  it('numeric column headers are right-aligned', () => {
    renderPanel();
    const qtyHeader = screen.getByTestId('column-header-quantity');
    expect(qtyHeader.style.justifyContent).toBe('flex-end');
  });

  it('renders boolean column as Yes/No text', () => {
    const columns = [
      { key: 'active', label: 'Active', type: 'boolean' },
    ];
    const rows = [
      { id: 'B1', active: true },
      { id: 'B2', active: false },
    ];
    const ref = createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    // renderBooleanCell: true → ui('yes') which returns 'yes'
    expect(screen.getByText('yes')).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('renders date column with formatted date', () => {
    const columns = [
      { key: 'orderDate', label: 'Date', type: 'date' },
    ];
    const rows = [
      { id: 'D1', orderDate: '2026-03-15' },
    ];
    const ref = createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    // renderDateCell parses "2026-03-15" and calls toLocaleDateString
    const row = screen.getByTestId('line-row-D1');
    // The date should be rendered (exact format depends on locale, but it should not be the raw ISO string)
    expect(within(row).queryByText('—')).toBeNull();
  });

  it('renders dash for empty date column', () => {
    const columns = [
      { key: 'orderDate', label: 'Date', type: 'date' },
    ];
    const rows = [
      { id: 'D2', orderDate: null },
    ];
    const ref = createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('commitField skips when value is unchanged (onUpdateRow NOT called)', async () => {
    const onUpdateRow = vi.fn().mockResolvedValue();
    renderPanel({ onUpdateRow });
    const row = screen.getByTestId('line-row-L1');
    // Enter edit mode
    await act(async () => {
      await userEvent.hover(row);
    });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => {
      await userEvent.click(editBtn);
    });
    // The product field should now be an editable input with value 'P1'.
    // Find the input for product (type: 'string') and blur it without changing the value.
    const inputs = within(row).getAllByRole('textbox');
    const productInput = inputs[0];
    // Blur without changing — commitField should skip because original === value
    await act(async () => {
      productInput.focus();
      productInput.blur();
    });
    // onUpdateRow should NOT have been called because value is unchanged
    expect(onUpdateRow).not.toHaveBeenCalled();
  });

  it('onEditRow is called instead of toggling inline edit when provided', async () => {
    const onEditRow = vi.fn();
    renderPanel({ onEditRow });
    const row = screen.getByTestId('line-row-L1');
    await act(async () => {
      await userEvent.hover(row);
    });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => {
      await userEvent.click(editBtn);
    });
    expect(onEditRow).toHaveBeenCalledWith(ROWS[0]);
  });

  it('clearSelection resets selected rows', async () => {
    const onSelectionChange = vi.fn();
    const { ref } = renderPanel({ onSelectionChange });
    // Clear should work without error
    await act(async () => {
      ref.current.clearSelection();
    });
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it('closeEditing exits edit mode', async () => {
    const { ref } = renderPanel();
    const row = screen.getByTestId('line-row-L1');
    // Enter edit mode
    await act(async () => {
      await userEvent.hover(row);
    });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => {
      await userEvent.click(editBtn);
    });
    // Should have editable inputs
    expect(within(row).queryAllByRole('textbox').length).toBeGreaterThan(0);
    // Now close
    await act(async () => {
      ref.current.closeEditing();
    });
    // After close, no editable inputs in the row
    // Re-query the row (it re-renders)
    const rowAfter = screen.getByTestId('line-row-L1');
    // In read mode, product renders as a span, not an input
    expect(within(rowAfter).queryAllByRole('textbox').length).toBe(0);
  });

  // ---------- NEW: additional coverage for uncovered InlineLinesPanel branches ----------

  it('renders enum column with Select dropdown in edit mode', async () => {
    const columns = [
      {
        key: 'taxCategory',
        label: 'Tax',
        type: 'enum',
        column: 'C_TaxCategory_ID',
        enumLabels: { VAT21: '21% VAT', VAT10: '10% VAT' },
      },
    ];
    const rows = [{ id: 'E1', taxCategory: 'VAT21' }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-E1');
    // Enter edit mode
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // Enum field should render a Select trigger
    const trigger = within(row).getByTestId('field-taxCategory');
    expect(trigger).toBeInTheDocument();
  });

  it('renders date input type in edit mode', async () => {
    const columns = [
      { key: 'orderDate', label: 'Date', type: 'date', column: 'DateOrdered' },
    ];
    const rows = [{ id: 'DT1', orderDate: '2026-03-15' }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-DT1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // Date field renders as type="date" input
    const dateInput = within(row).getByTestId('field-orderDate');
    expect(dateInput).toBeInTheDocument();
    expect(dateInput).toHaveAttribute('type', 'date');
  });

  it('renders numeric field with decimal inputMode in edit mode', async () => {
    const columns = [
      { key: 'quantity', label: 'Qty', type: 'number', column: 'QtyOrdered' },
    ];
    const rows = [{ id: 'N1', quantity: 10 }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-N1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    const numInput = within(row).getByTestId('field-quantity');
    expect(numInput).toHaveAttribute('inputmode', 'decimal');
  });

  it('renders integer field with numeric inputMode in edit mode', async () => {
    const columns = [
      { key: 'lineNo', label: 'Line', type: 'integer', column: 'Line' },
    ];
    const rows = [{ id: 'INT1', lineNo: 10 }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-INT1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    const intInput = within(row).getByTestId('field-lineNo');
    expect(intInput).toHaveAttribute('inputmode', 'numeric');
  });

  it('shows validation error for value below col.min', async () => {
    const columns = [
      { key: 'quantity', label: 'Qty', type: 'number', column: 'QtyOrdered', min: 1 },
    ];
    const rows = [{ id: 'MV1', quantity: 5 }];
    const onUpdateRow = vi.fn().mockResolvedValue();
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={onUpdateRow}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-MV1');
    // Enter edit mode
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // Type a value below min
    const qtyInput = within(row).getByTestId('field-quantity');
    await act(async () => {
      await userEvent.clear(qtyInput);
      await userEvent.type(qtyInput, '0');
      qtyInput.blur();
    });
    // commitField should NOT have been called successfully (min validation fails)
    // The toast.error is called with 'fieldMinValueError'
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('formats amount type with two decimals in edit mode', async () => {
    const columns = [
      { key: 'name', label: 'Name', type: 'string', column: 'Name' },
      { key: 'unitPrice', label: 'Price', type: 'amount', column: 'PriceActual', noTrailing: true },
    ];
    const rows = [{ id: 'FE1', name: 'Item', unitPrice: 23 }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-FE1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // Amount field should display "23.00" (formatForEdit)
    const priceInput = within(row).getByTestId('field-unitPrice');
    expect(priceInput).toHaveValue('23.00');
  });

  it('renders readonly LookupTrigger for lookup fields in edit mode', async () => {
    const columns = [
      {
        key: 'product',
        label: 'Product',
        type: 'search',
        column: 'M_Product_ID',
        lookup: true,
      },
    ];
    const rows = [{ id: 'LT1', product: 'P1', 'product$_identifier': 'Widget' }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-LT1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // LookupTrigger renders a button with data-testid="field-product"
    const lookupBtn = within(row).getByTestId('field-product');
    expect(lookupBtn).toBeInTheDocument();
    expect(lookupBtn.tagName).toBe('BUTTON');
  });

  it('renders percent column with percentage sign', () => {
    const columns = [
      { key: 'discount', label: 'Discount', type: 'percent' },
    ];
    const rows = [{ id: 'PC1', discount: 15 }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    expect(screen.getByText('15%')).toBeInTheDocument();
  });

  it('renders computed/readOnly column as non-editable in edit mode', async () => {
    const columns = [
      { key: 'lineNetAmount', label: 'Total', type: 'amount', computed: true },
    ];
    const rows = [{ id: 'RO1', lineNetAmount: 500 }];
    const ref = React.createRef();
    render(
      <InlineLinesPanel
        ref={ref}
        columns={columns}
        data={rows}
        entity="lines"
        token="test"
        apiBaseUrl="/api"
        selectorContext={{}}
        onSelectionChange={vi.fn()}
        onUpdateRow={vi.fn().mockResolvedValue()}
        onDeleteRow={vi.fn().mockResolvedValue()}
      />,
    );
    const row = screen.getByTestId('line-row-RO1');
    await act(async () => { await userEvent.hover(row); });
    const actions = within(row).getByTestId('line-actions');
    const editBtn = within(actions).getAllByRole('button')[0];
    await act(async () => { await userEvent.click(editBtn); });
    // Computed column should NOT render an input — EditCell returns null for non-editable
    expect(within(row).queryByRole('textbox')).toBeNull();
  });

  it('select-all checkbox toggles all rows', async () => {
    const onSelectionChange = vi.fn();
    renderPanel({ onSelectionChange });
    // Find the select-all checkbox (first checkbox in the header)
    const checkboxes = screen.getAllByRole('checkbox');
    const selectAll = checkboxes[0];
    await act(async () => {
      await userEvent.click(selectAll);
    });
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'L1' }),
        expect.objectContaining({ id: 'L2' }),
      ]),
    );
  });
});
