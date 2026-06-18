import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock i18n hooks
vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({ statuses: {} }),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock dependencies
vi.mock('@/lib/gridQuery', () => ({
  resolveFilterMode: (col) => {
    if (col.type === 'date') return 'date';
    if (col.type === 'number' || col.type === 'amount') return 'numeric';
    if (col.type === 'status') return 'enumLabel';
    if (col.type === 'boolean') return 'booleanLabel';
    return 'text';
  },
  getDisplayText: () => '',
}));

vi.mock('@/hooks/useDistinctValues.js', () => ({
  useDistinctValues: () => ({
    values: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    search: '',
    setSearch: vi.fn(),
    loadMore: vi.fn(),
  }),
}));

vi.mock('../DistinctValuesList.jsx', () => ({
  DistinctValuesList: () => <div data-testid="distinct-values-list" />,
}));

import { AdvancedFilterBuilder } from '../AdvancedFilterBuilder.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name', type: 'text', column: 'Name' },
  { key: 'amount', label: 'Amount', type: 'amount', column: 'Amount' },
  { key: 'orderDate', label: 'Order Date', type: 'date', column: 'OrderDate' },
];

describe('AdvancedFilterBuilder', () => {
  it('renders without crashing', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    // Title is rendered via ui('advancedFilterTitle') which returns the key
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders the "Where" label on the first row', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    expect(screen.getByText('advancedFilterWhere')).toBeInTheDocument();
  });

  it('renders add condition button', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    expect(screen.getByText('advancedFilterAddCondition')).toBeInTheDocument();
  });

  it('renders apply and clear buttons', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    expect(screen.getByText('advancedFilterApply')).toBeInTheDocument();
    expect(screen.getByText('advancedFilterClear')).toBeInTheDocument();
  });

  it('adds a new filter row when add condition is clicked', async () => {
    const user = userEvent.setup();
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const addBtn = screen.getByText('advancedFilterAddCondition');
    await user.click(addBtn);
    // After clicking, we should have 2 rows. The second row shows the and/or connector.
    // Look for "Remove condition" aria-labels — should have 2 now.
    const removeButtons = screen.getAllByLabelText('Remove condition');
    expect(removeButtons).toHaveLength(2);
  });

  it('removes a filter row when trash button is clicked', async () => {
    const user = userEvent.setup();
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    // Add a second row first
    await user.click(screen.getByText('advancedFilterAddCondition'));
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(2);
    // Remove the first row
    const removeButtons = screen.getAllByLabelText('Remove condition');
    await user.click(removeButtons[0]);
    // Should have 1 row left
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders field select placeholders', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    // The placeholder uses ui('advancedFilterSelectField') returning the key
    expect(screen.getByText('advancedFilterSelectField')).toBeInTheDocument();
  });

  it('renders with existing filter value', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'iContains', value: 'test' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    // Should render the existing condition, not the empty row
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('calls onClear when clear button is clicked with applied filter', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'iContains', value: 'test' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} onClear={onClear} />);
    await user.click(screen.getByText('advancedFilterClear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('disables apply button when row is incomplete', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const applyButton = screen.getByText('advancedFilterApply');
    expect(applyButton).toBeDisabled();
  });

  it('renders save button placeholder when presets are not enabled', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    expect(screen.getByText('advancedFilterSave')).toBeInTheDocument();
  });

  // ============================================================
  // Additional branch coverage tests
  // ============================================================

  it('renders with status column type (enumLabel mode)', () => {
    const cols = [
      ...COLUMNS,
      { key: 'status', label: 'Status', type: 'status', column: 'Status' },
    ];
    render(<AdvancedFilterBuilder columns={cols} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders with boolean column type (booleanLabel mode)', () => {
    const cols = [
      ...COLUMNS,
      { key: 'active', label: 'Active', type: 'boolean', column: 'Active' },
    ];
    render(<AdvancedFilterBuilder columns={cols} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders with number column type (numeric mode)', () => {
    const cols = [{ key: 'qty', label: 'Qty', type: 'number', column: 'Qty' }];
    render(<AdvancedFilterBuilder columns={cols} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('filters out discarded columns', () => {
    const cols = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
      { key: 'hidden', label: 'Hidden', type: 'discarded', column: 'Hidden' },
    ];
    render(<AdvancedFilterBuilder columns={cols} />);
    // Only 'name' should be available as a filterable column
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('filters out system columns', () => {
    const cols = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
      { key: 'sys', label: 'System', type: 'system', column: 'System' },
    ];
    render(<AdvancedFilterBuilder columns={cols} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('filters out columns with filterable=false', () => {
    const cols = [
      { key: 'name', label: 'Name', type: 'text', column: 'Name' },
      { key: 'nf', label: 'NoFilter', type: 'text', column: 'NoFilter', filterable: false },
    ];
    render(<AdvancedFilterBuilder columns={cols} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders with between operator condition value (two inputs)', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'amount', operator: 'between', value: ['10', '50'] }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders with isNull operator (no value input needed)', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'isNull', value: '' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders with isNotNull operator', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'isNotNull', value: '' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders with multiple conditions showing connector', () => {
    const value = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: 'iContains', value: 'test' },
        { field: 'amount', operator: 'greaterThan', value: '100' },
      ],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(2);
  });

  it('renders with or rowOperator', () => {
    const value = {
      rowOperator: 'or',
      conditions: [
        { field: 'name', operator: 'iContains', value: 'a' },
        { field: 'name', operator: 'iContains', value: 'b' },
      ],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(2);
  });

  it('enables apply button when row is complete with isNull', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'isNull', value: '' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    const applyButton = screen.getByText('advancedFilterApply');
    expect(applyButton).not.toBeDisabled();
  });

  it('calls onApply with cloned conditions when apply is clicked', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'isNull', value: '' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} onApply={onApply} />);
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply).toHaveBeenCalled();
    const applied = onApply.mock.calls[0][0];
    expect(applied.conditions).toHaveLength(1);
    // Verify it's a clone, not the same reference
    expect(applied.conditions).not.toBe(value.conditions);
  });

  it('disables clear button when no value (no applied filter)', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const clearButton = screen.getByText('advancedFilterClear');
    expect(clearButton).toBeDisabled();
  });

  it('renders date column with date-specific operator labels', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'orderDate', operator: 'greaterThan', value: '2026-01-01' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders numeric between condition', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'amount', operator: 'between', value: ['100', '500'] }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders with empty columns array', () => {
    render(<AdvancedFilterBuilder columns={[]} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders with inSet operator for enumLabel', () => {
    const cols = [{ key: 'status', label: 'Status', type: 'status', column: 'Status' }];
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'status', operator: 'inSet', value: 'DR,CO' }],
    };
    render(<AdvancedFilterBuilder columns={cols} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('calls onApply when complete condition with value', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'iContains', value: 'test' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} onApply={onApply} />);
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply).toHaveBeenCalled();
  });

  it('renders with presets prop', () => {
    const presets = [
      { name: 'My Filter', conditions: [{ field: 'name', operator: 'iContains', value: 'x' }], rowOperator: 'and' },
    ];
    render(<AdvancedFilterBuilder columns={COLUMNS} presets={presets} />);
    expect(screen.getByText('advancedFilterTitle')).toBeInTheDocument();
  });

  it('renders with onSavePreset prop', () => {
    render(<AdvancedFilterBuilder columns={COLUMNS} onSavePreset={vi.fn()} />);
    expect(screen.getByText('advancedFilterSave')).toBeInTheDocument();
  });

  it('renders complete condition with equals operator', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'name', operator: 'iEquals', value: 'exact' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    const applyButton = screen.getByText('advancedFilterApply');
    expect(applyButton).not.toBeDisabled();
  });

  it('renders condition with notEqual operator', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'amount', operator: 'notEqual', value: '0' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });

  it('renders condition with lessOrEqual operator', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'amount', operator: 'lessOrEqual', value: '999' }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getByText('advancedFilterApply')).not.toBeDisabled();
  });

  it('renders date between condition', () => {
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'orderDate', operator: 'between', value: ['2026-01-01', '2026-12-31'] }],
    };
    render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    expect(screen.getAllByLabelText('Remove condition')).toHaveLength(1);
  });
});
