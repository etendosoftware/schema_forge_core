import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Core vitest runs without `globals: true`, so RTL's automatic afterEach
// cleanup is not registered — do it explicitly to avoid DOM bleed between tests.
afterEach(cleanup);
beforeEach(() => {
  distinctCalls.length = 0;
});

// Mock i18n hooks
vi.mock('../../../i18n/index.js', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({ statuses: {} }),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock dependencies
vi.mock('../../../lib/gridQuery.js', () => ({
  resolveFilterMode: (col) => {
    if (col.type === 'date') return 'date';
    if (col.type === 'number' || col.type === 'amount') return 'numeric';
    if (col.type === 'status') return 'enumLabel';
    if (col.type === 'boolean') return 'booleanLabel';
    if (col.type === 'selector') return 'identifier';
    return 'text';
  },
  getDisplayText: () => '',
}));

// Mutable holder so individual tests can inject the distinct endpoint values.
// Defaults to an empty set (the original behavior the existing tests rely on).
const distinctState = { values: [] };

// Records every call's (entity, field, options) so tests can assert on the
// `enabled` flag the component computed — the mocked hook always returns
// `distinctState.values` regardless of `enabled`, so this is the only way to
// verify the gating logic itself (ETP-4770).
const distinctCalls = [];

vi.mock('../../../hooks/useDistinctValues.js', () => ({
  useDistinctValues: (entity, field, options) => {
    distinctCalls.push({ entity, field, options });
    return {
      values: distinctState.values,
      loading: false,
      loadingMore: false,
      hasMore: false,
      search: '',
      setSearch: vi.fn(),
      loadMore: vi.fn(),
    };
  },
}));

// Render one option per code so tests can count duplicate labels. Mirrors the
// real DistinctValuesList contract: it receives { codes, labelFor, onSelect }.
vi.mock('../DistinctValuesList.jsx', () => ({
  DistinctValuesList: ({ codes = [], labelFor, onSelect }) => (
    <div data-testid="distinct-values-list">
      {codes.map((code, i) => (
        <button
          key={`${String(code)}-${i}`}
          type="button"
          data-testid="distinct-option"
          onClick={() => onSelect?.(code)}
        >
          {labelFor ? labelFor(code) : String(code)}
        </button>
      ))}
    </div>
  ),
}));

import { AdvancedFilterBuilder } from '../AdvancedFilterBuilder.jsx';

// Radix Select needs a few pointer/scroll DOM APIs jsdom does not implement so
// the operator dropdown can open and options can be selected.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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

  // ================================================================
  // ETP-4532 — "starts with" (iStartsWith) operator
  // ================================================================

  describe('iStartsWith operator (ETP-4532)', () => {
    // Seed a single row with the field already picked so the operator select is
    // enabled (it is `disabled={!col}` until a field is chosen).
    const seededValue = (field) => ({
      rowOperator: 'and',
      conditions: [{ field, operator: '', value: '' }],
    });

    it('offers the starts-with option for a text column', async () => {
      const user = userEvent.setup();
      render(<AdvancedFilterBuilder columns={COLUMNS} value={seededValue('name')} />);
      // Open the operator dropdown (its placeholder is advancedFilterSelectOp).
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      // ui() returns the key, so the option label is the i18n key 'opStartsWith'.
      expect(await screen.findByRole('option', { name: 'opStartsWith' })).toBeInTheDocument();
    });

    it('offers the starts-with option for an identifier column', async () => {
      const user = userEvent.setup();
      const cols = [{ key: 'bp', label: 'Partner', type: 'selector', column: 'C_BPartner_ID' }];
      render(<AdvancedFilterBuilder columns={cols} value={seededValue('bp')} />);
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      expect(await screen.findByRole('option', { name: 'opStartsWith' })).toBeInTheDocument();
    });

    it('emits a condition with operator iStartsWith after selecting it, typing a value, and applying', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <AdvancedFilterBuilder columns={COLUMNS} value={seededValue('name')} onApply={onApply} />,
      );
      // Select the "starts with" operator.
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      await user.click(await screen.findByRole('option', { name: 'opStartsWith' }));
      // The value input now appears (iStartsWith is not a nullish op).
      const input = screen.getByRole('textbox');
      await user.type(input, 'foo');
      // Apply.
      await user.click(screen.getByText('advancedFilterApply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      const applied = onApply.mock.calls[0][0];
      expect(applied.conditions).toHaveLength(1);
      expect(applied.conditions[0]).toMatchObject({
        field: 'name',
        operator: 'iStartsWith',
        value: 'foo',
      });
    });
  });

  // ================================================================
  // DistinctEnumPicker — labelFor translation behavior
  // ================================================================

  describe('DistinctEnumPicker — labelFor resolves enumLabels via ui()', () => {
    // DistinctEnumPicker is an internal sub-component activated when the filter
    // mode is 'enumLabel' and the operator is not 'inSet'. It renders a trigger
    // button whose label is `labelFor(value)`. When a value is already selected,
    // the button shows the resolved label. We exercise this to verify the
    // translation path without accessing the private function directly.

    const statusCol = {
      key: 'processed',
      label: 'Processed',
      type: 'status',
      column: 'Processed',
      // enumLabels values are i18n keys — ui() should be called on them
      enumLabels: { true: 'statusProcessed', false: 'statusDraft' },
    };

    // Reset the injected distinct values after every test so the default empty
    // set is restored for the other tests in this file.
    afterEach(() => {
      distinctState.values = [];
    });

    it('shows the ui()-translated label for a selected enumLabels i18n-key value', () => {
      // useUI mock returns key as-is, so ui('statusProcessed') === 'statusProcessed'
      const filterValue = {
        rowOperator: 'and',
        conditions: [{ field: 'processed', operator: 'equals', value: 'true' }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[statusCol]}
          value={filterValue}
        />,
      );
      // 'statusProcessed' should appear as the picker trigger label
      expect(screen.getByText('statusProcessed')).toBeInTheDocument();
    });

    it('shows a literal enumLabels label unchanged when it is not an i18n key', () => {
      // When the enumLabels value is a plain string (not a registered i18n key),
      // ui() returns it unchanged — the label passes through literally.
      const literalCol = {
        key: 'processed',
        label: 'Processed',
        type: 'status',
        column: 'Processed',
        enumLabels: { true: 'Procesado', false: 'Borrador' },
      };
      const filterValue = {
        rowOperator: 'and',
        conditions: [{ field: 'processed', operator: 'equals', value: 'false' }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[literalCol]}
          value={filterValue}
        />,
      );
      expect(screen.getByText('Borrador')).toBeInTheDocument();
    });

    it('shows enumLabels keys as the picker options (fallback from enumLabels keys when no rows/distinct)', () => {
      // When no rows or distinct values are available, DistinctEnumPicker populates
      // the option list from the enumLabels keys directly (fillFallbackCodes).
      // The active label for the selected value must match the resolved labelFor().
      const filterValue = {
        rowOperator: 'and',
        conditions: [{ field: 'processed', operator: 'equals', value: 'true' }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[statusCol]}
          value={filterValue}
        />,
      );
      // The active value 'true' maps to enumLabels['true'] = 'statusProcessed',
      // then ui('statusProcessed') === 'statusProcessed' (mock returns key).
      expect(screen.getByText('statusProcessed')).toBeInTheDocument();
    });

    it('falls back to dictionary.statuses label when code is not in enumLabels', () => {
      // A column with enumLabels only for some codes — unlisted codes fall back to
      // dictionary.statuses or the raw code itself.
      const partialCol = {
        key: 'status',
        label: 'Status',
        type: 'status',
        column: 'Status',
        enumLabels: { CO: 'Complete' },
      };
      const filterValue = {
        rowOperator: 'and',
        conditions: [{ field: 'status', operator: 'equals', value: 'CO' }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[partialCol]}
          value={filterValue}
        />,
      );
      // ui('Complete') === 'Complete' (literal pass-through from mock)
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('does not duplicate boolean options when distinct returns string twins of in-memory booleans', async () => {
      // Regression: a boolean-valued status column surfaces the same value in two
      // shapes — the distinct endpoint returns the STRING "true"/"false" while
      // in-memory rows hold the BOOLEAN true/false. Without canonical dedup, the
      // mergedCodes Set treats "true" and true as distinct, rendering each option
      // twice ("Draft, Processed, Draft, Processed"). The canon() helper collapses
      // booleans to their string form so each option appears exactly once.
      const user = userEvent.setup();

      // Distinct endpoint contributes the STRING forms.
      distinctState.values = [
        { id: 'true', _identifier: 'true' },
        { id: 'false', _identifier: 'false' },
      ];

      // In-memory rows hold the BOOLEAN forms (note: two `true` rows).
      const rows = [
        { processed: false },
        { processed: true },
        { processed: true },
      ];

      // A condition with field + a non-inSet operator and no value activates the
      // DistinctEnumPicker and shows the "select value" placeholder on its trigger.
      const filterValue = {
        rowOperator: 'and',
        conditions: [{ field: 'processed', operator: 'equals', value: '' }],
      };

      render(
        <AdvancedFilterBuilder
          columns={[statusCol]}
          value={filterValue}
          rows={rows}
          entity="goods-movements"
          apiBaseUrl="/api"
        />,
      );

      // Open the enum picker popover (the only picker trigger on screen).
      const trigger = screen.getByText('advancedFilterSelectValue');
      await user.click(trigger);

      const options = await screen.findAllByTestId('distinct-option');
      const labels = options.map((o) => o.textContent);

      // Each label must appear exactly once — no boolean/string duplicates.
      // enumLabels keys are 'true'/'false', resolved via ui() to the keys
      // 'statusProcessed' / 'statusDraft' (mock returns key as-is).
      expect(labels.filter((l) => l === 'statusProcessed')).toHaveLength(1);
      expect(labels.filter((l) => l === 'statusDraft')).toHaveLength(1);
      expect(options).toHaveLength(2);
    });
  });

  // ================================================================
  // ETP-4532 — DATE value input renders the shared DateField
  // (react-day-picker) instead of a native <input type="date">.
  // ================================================================

  describe('date value input renders DateField (ETP-4532)', () => {
    // Seeding the applied value with a field + non-nullish operator makes the
    // value area render immediately, so we can assert on the rendered widget
    // without driving the field/operator Select dropdowns.
    const dateValue = (operator, value) => ({
      rowOperator: 'and',
      conditions: [{ field: 'orderDate', operator, value }],
    });

    it('single-value date mode renders DateField, not a native date input', () => {
      render(<AdvancedFilterBuilder columns={COLUMNS} value={dateValue('equals', '')} />);
      // The stable contract is the testid; DateField renders a masked text input.
      expect(screen.getByTestId('AdvancedFilterBuilder__DateField')).toBeInTheDocument();
      // Regression: the value area must NOT fall back to a native date input.
      expect(document.querySelector('input[type="date"]')).toBeNull();
    });

    it('between date mode renders two DateFields (from + to)', () => {
      render(
        <AdvancedFilterBuilder columns={COLUMNS} value={dateValue('between', ['', ''])} />,
      );
      expect(screen.getByTestId('AdvancedFilterBuilder__DateField__from')).toBeInTheDocument();
      expect(screen.getByTestId('AdvancedFilterBuilder__DateField__to')).toBeInTheDocument();
      expect(document.querySelector('input[type="date"]')).toBeNull();
    });

    it('non-date mode still renders the plain Input (regression guard)', () => {
      // A numeric column with a single-value operator must keep the old Input.
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'amount', operator: 'equals', value: '' }],
      };
      render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
      expect(screen.getAllByTestId('Input__4eedf1').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('AdvancedFilterBuilder__DateField')).toBeNull();
    });

    it('single-value date onChange emits an ISO yyyy-mm-dd string into the condition', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <AdvancedFilterBuilder
          columns={COLUMNS}
          value={dateValue('equals', '')}
          onApply={onApply}
        />,
      );
      // Locale mock resolves to en_US → month-first mask (mm/dd/yyyy). Typing the
      // 8 digits auto-inserts separators; blur commits the parsed ISO value.
      const input = screen.getByTestId('AdvancedFilterBuilder__DateField');
      await user.type(input, '03152026');
      await user.tab(); // blur → commitTypedValue → onChange('2026-03-15')
      await user.click(screen.getByText('advancedFilterApply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply.mock.calls[0][0].conditions[0]).toMatchObject({
        field: 'orderDate',
        operator: 'equals',
        value: '2026-03-15',
      });
    });

    it('between date onChange emits an ISO [from, to] pair into the condition', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <AdvancedFilterBuilder
          columns={COLUMNS}
          value={dateValue('between', ['', ''])}
          onApply={onApply}
        />,
      );
      const from = screen.getByTestId('AdvancedFilterBuilder__DateField__from');
      await user.type(from, '01012026');
      await user.tab();
      const to = screen.getByTestId('AdvancedFilterBuilder__DateField__to');
      await user.type(to, '12312026');
      await user.tab();
      await user.click(screen.getByText('advancedFilterApply'));
      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply.mock.calls[0][0].conditions[0]).toMatchObject({
        field: 'orderDate',
        operator: 'between',
        value: ['2026-01-01', '2026-12-31'],
      });
    });
  });

  // ================================================================
  // ETP-4609 — required columns must not offer isNull / isNotNull
  // ================================================================

  describe('required columns hide isNull/isNotNull operators (ETP-4609)', () => {
    const seededValue = (field) => ({
      rowOperator: 'and',
      conditions: [{ field, operator: '', value: '' }],
    });

    it('does not offer "Es vacío" / "No es vacío" for a required text column', async () => {
      const user = userEvent.setup();
      const cols = [{ key: 'name', label: 'Name', type: 'text', column: 'Name', required: true }];
      render(<AdvancedFilterBuilder columns={cols} value={seededValue('name')} />);
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      expect(screen.queryByRole('option', { name: 'opIsEmpty' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'opIsNotEmpty' })).not.toBeInTheDocument();
      // Other operators for the mode remain available.
      expect(screen.getByRole('option', { name: 'opContains' })).toBeInTheDocument();
    });

    it('still offers "Es vacío" / "No es vacío" for the same column when not required', async () => {
      const user = userEvent.setup();
      const cols = [{ key: 'name', label: 'Name', type: 'text', column: 'Name' }];
      render(<AdvancedFilterBuilder columns={cols} value={seededValue('name')} />);
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      expect(await screen.findByRole('option', { name: 'opIsEmpty' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'opIsNotEmpty' })).toBeInTheDocument();
    });

    it('does not offer isNull/isNotNull for a required identifier (selector) column', async () => {
      const user = userEvent.setup();
      const cols = [
        { key: 'productCategory', label: 'Category', type: 'selector', column: 'M_Product_Category_ID', required: true },
      ];
      render(<AdvancedFilterBuilder columns={cols} value={seededValue('productCategory')} />);
      await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
      expect(screen.queryByRole('option', { name: 'opIsEmpty' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'opIsNotEmpty' })).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // ETP-4609 — synthetic `type: 'custom'` columns without a backend field
  // must not appear in the filter field list (wrong label + never matches).
  // ================================================================

  describe('custom columns without a backend field are excluded from filters (ETP-4609)', () => {
    it('does not offer a custom column that has no `column` / `backendFilterKey`', async () => {
      const user = userEvent.setup();
      const cols = [
        { key: 'name', label: 'Name', type: 'text', column: 'Name' },
        {
          key: 'nameAndSearchKey',
          labels: { en_US: 'Identifier & Name', es_ES: 'Identificador & Nombre' },
          type: 'custom',
          render: () => null,
        },
      ];
      render(<AdvancedFilterBuilder columns={cols} />);
      await user.click(screen.getByText('advancedFilterSelectField').closest('button'));
      expect(await screen.findByRole('option', { name: 'Name' })).toBeInTheDocument();
      // The raw internal key must never leak into the field dropdown as an option.
      expect(screen.queryByRole('option', { name: 'nameAndSearchKey' })).not.toBeInTheDocument();
    });

    it('still offers a custom column that declares a real `column` (AD field)', async () => {
      const user = userEvent.setup();
      const cols = [
        { key: 'grandTotalAmount', label: 'Total', type: 'custom', column: 'GrandTotal', render: () => null },
      ];
      render(<AdvancedFilterBuilder columns={cols} />);
      await user.click(screen.getByText('advancedFilterSelectField').closest('button'));
      // useLabel is mocked as the identity function in this file (line ~12), so
      // columnLabel resolves to `col.column` here, not `col.label`.
      expect(await screen.findByRole('option', { name: 'GrandTotal' })).toBeInTheDocument();
    });

    it('still offers a custom column explicitly opted in via `filterable: true`', async () => {
      const user = userEvent.setup();
      const cols = [
        { key: 'virtualButFilterable', label: 'Virtual', type: 'custom', filterable: true, render: () => null },
      ];
      render(<AdvancedFilterBuilder columns={cols} />);
      await user.click(screen.getByText('advancedFilterSelectField').closest('button'));
      expect(await screen.findByRole('option', { name: 'Virtual' })).toBeInTheDocument();
    });
  });
});

// ETP-4705 — the conditional filter panel used to force fixed/proportional
// widths on its root container and on the Field/Operator selects, which
// truncated placeholders ("Seleccionar condici…") and left a large empty gap.
// The fix switched to content-based sizing. These assertions lock that in so a
// regression back to the old fixed widths is caught.
describe('AdvancedFilterBuilder — content-based sizing (ETP-4705)', () => {
  // The Field select wrapper is uniquely identified by its max-w-[22rem];
  // the Operator select wrapper by its max-w-[18rem].
  const fieldWrapper = (container) => container.querySelector('div.max-w-\\[22rem\\]');
  const operatorWrapper = (container) => container.querySelector('div.max-w-\\[18rem\\]');

  it('root container uses w-max content sizing, not the old fixed min-widths (ETP-4705)', () => {
    const { container } = render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const root = container.firstChild;
    const cls = root.className;

    // Must NOT regress to the old fixed pixel min-widths.
    expect(cls).not.toContain('min-w-[760px]');
    expect(cls).not.toContain('min-w-[860px]');

    // Must use content-based sizing.
    expect(cls).toContain('w-max');
    expect(cls).toContain('max-w-[min(90vw,60rem)]');
    // Non-between default floor.
    expect(cls).toContain('min-w-[32rem]');
  });

  it('root container widens to min-w-[38rem] in the between case (ETP-4705)', () => {
    // Seed a pre-applied condition whose operator is "between" so hasBetween is
    // true on first render — no dropdown interaction needed.
    const value = {
      rowOperator: 'and',
      conditions: [{ field: 'amount', operator: 'between', value: ['', ''] }],
    };
    const { container } = render(<AdvancedFilterBuilder columns={COLUMNS} value={value} />);
    const cls = container.firstChild.className;

    expect(cls).not.toContain('min-w-[760px]');
    expect(cls).not.toContain('min-w-[860px]');
    expect(cls).toContain('w-max');
    // between → wider floor, and NOT the narrow default floor.
    expect(cls).toContain('min-w-[38rem]');
    expect(cls).not.toContain('min-w-[32rem]');
  });

  it('Field select wrapper is content-sized (w-fit), not flex-[2] (ETP-4705)', () => {
    const { container } = render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const wrapper = fieldWrapper(container);
    expect(wrapper).not.toBeNull();
    const cls = wrapper.className;

    expect(cls).toContain('w-fit');
    expect(cls).toContain('min-w-[12rem]');
    // Must NOT grab free space via flex.
    expect(cls).not.toContain('flex-[2]');
  });

  it('Operator select wrapper is content-sized (w-fit), not flex-1 (ETP-4705)', () => {
    const { container } = render(<AdvancedFilterBuilder columns={COLUMNS} />);
    const wrapper = operatorWrapper(container);
    expect(wrapper).not.toBeNull();
    const cls = wrapper.className;

    expect(cls).toContain('w-fit');
    expect(cls).toContain('min-w-[12rem]');
    // Must NOT grab free space via flex — the value cell keeps flex-1, so scope
    // the assertion to this operator wrapper only.
    expect(cls.split(/\s+/)).not.toContain('flex-1');
  });

  // ================================================================
  // ETP-4770 — IdentifierMultiPicker re-edit label resolution
  // ================================================================

  describe('IdentifierMultiPicker — re-edit label resolution (ETP-4770)', () => {
    const bpCol = { key: 'bp', label: 'Partner', type: 'selector', column: 'C_BPartner_ID' };

    it('resolves the real label for a pre-selected "notEqual" value even though the grid excludes it', () => {
      // Bug 3: grid rows already exclude the notEqual-filtered contact, so
      // there is no in-memory label for it. The picker must still show the
      // real name (from the backend distinct source), not the raw id.
      distinctState.values = [{ id: 'BP1', _identifier: 'Acme Corp' }];
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'notEqual', value: ['BP1'] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.queryByText('BP1')).not.toBeInTheDocument();
    });

    it('fetches distinct values eagerly on mount when re-editing (selected already set)', () => {
      // The picker's own popover is still closed (open=false) on mount — the
      // fetch must not depend on the user clicking it open first.
      distinctState.values = [{ id: 'BP1', _identifier: 'Acme Corp' }];
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'equals', value: ['BP1'] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[{ bp: 'BP1', 'bp$_identifier': 'Acme Corp' }]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      const call = distinctCalls.find((c) => c.field === 'bp');
      expect(call).toBeDefined();
      expect(call.options.enabled).toBe(true);
    });

    it('does not fetch eagerly for a fresh, empty condition (no selection yet)', () => {
      // A brand new row (nothing selected) should stay lazy until the user
      // opens the picker — no wasted network call.
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'equals', value: [] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      const call = distinctCalls.find((c) => c.field === 'bp');
      expect(call).toBeDefined();
      expect(call.options.enabled).toBe(false);
    });

    it('opening the popover after re-editing "equals" surfaces other contacts, not just the grid-visible one', async () => {
      // Bug 2: rows only contain the previously-selected contact. The
      // backend distinct universe must still offer other contacts to
      // search/select.
      const user = userEvent.setup();
      distinctState.values = [
        { id: 'BP1', _identifier: 'Acme Corp' },
        { id: 'BP2', _identifier: 'Globex Inc' },
      ];
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'equals', value: ['BP1'] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[{ bp: 'BP1', 'bp$_identifier': 'Acme Corp' }]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      await user.click(screen.getByText('Acme Corp'));
      expect(await screen.findByText('Globex Inc')).toBeInTheDocument();
    });

    // QA (ETP-4770): the eager-fetch gate is `selected.length > 0`, generic
    // across every discrete identifier operator (equals/notEqual/inSet all
    // funnel through IdentifierMultiPicker — see TEXTUAL_IDENT_OPS in the
    // component). Verify "inSet" ("Es cualquiera de", multi-select equals)
    // is covered too, not just single equals/notEqual.
    it('fetches distinct values eagerly on mount when re-editing an "inSet" (multi-select) condition', () => {
      distinctState.values = [
        { id: 'BP1', _identifier: 'Acme Corp' },
        { id: 'BP2', _identifier: 'Globex Inc' },
      ];
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'inSet', value: ['BP1', 'BP2'] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[{ bp: 'BP1', 'bp$_identifier': 'Acme Corp' }]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      const call = distinctCalls.find((c) => c.field === 'bp');
      expect(call).toBeDefined();
      expect(call.options.enabled).toBe(true);
      expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    });

    // QA (ETP-4770): stale selected id whose backend record was deleted
    // meanwhile — neither the distinct fetch nor the grid rows can resolve a
    // label for it. The picker must fall back to the raw id without
    // crashing (Alex's review note), not silently drop the selection.
    it('falls back to the raw id (no crash) when a pre-selected id is missing from both distinct values and rows', () => {
      distinctState.values = [{ id: 'BP2', _identifier: 'Globex Inc' }]; // BP1 no longer exists
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'equals', value: ['BP1'] }],
      };
      expect(() =>
        render(
          <AdvancedFilterBuilder
            columns={[bpCol]}
            value={value}
            rows={[]}
            entity="business-partners"
            apiBaseUrl="/api"
          />,
        ),
      ).not.toThrow();
      expect(screen.getByText('BP1')).toBeInTheDocument();
    });
  });
});
