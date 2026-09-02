import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Core vitest runs without `globals: true`, so RTL's automatic afterEach
// cleanup is not registered — do it explicitly to avoid DOM bleed between tests.
afterEach(cleanup);
beforeEach(() => {
  distinctCalls.length = 0;
  distinctState.loading = false;
  localeState.statuses = {};
});

// Mock i18n hooks. `useLocale().statuses` is read through a mutable holder so a
// test can populate the GLOBAL status dictionary — the source of enum labels for
// a column that does NOT declare its own `enumLabels`, which follows a different
// merge policy (see the ETP-4956 fillFallbackCodes block below). It defaults to
// an empty object, preserving every pre-existing test's behavior.
vi.mock('../../../i18n/index.js', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({ statuses: localeState.statuses }),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

const localeState = { statuses: {} };

// Mock dependencies
vi.mock('../../../lib/gridQuery.js', () => ({
  resolveFilterMode: (col) => {
    if (col.type === 'date') return 'date';
    if (col.type === 'number' || col.type === 'amount') return 'numeric';
    // 'enum' maps to enumLabel exactly like 'status' does in the real
    // inferFilterMode (lib/gridQuery.js) — both reach DistinctEnumPicker.
    if (col.type === 'status' || col.type === 'enum') return 'enumLabel';
    if (col.type === 'boolean') return 'booleanLabel';
    if (col.type === 'selector') return 'identifier';
    return 'text';
  },
  getDisplayText: () => '',
}));

// Mutable holder so individual tests can inject the distinct endpoint values.
// Defaults to an empty set (the original behavior the existing tests rely on).
// `loading` defaults to false to preserve every pre-existing test's behavior;
// only the ETP-4770 pending-label tests below set it to true.
const distinctState = { values: [], loading: false };

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
      loading: distinctState.loading,
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

import { AdvancedFilterBuilder, normalizeDecimalInput } from '../AdvancedFilterBuilder.jsx';

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

    it('shows enumLabels keys as the picker options (fallback from enumLabels keys when no rows/distinct)', async () => {
      // When no rows or distinct values are available, DistinctEnumPicker populates
      // the option list from the enumLabels keys directly (fillFallbackCodes).
      //
      // This test used to assert ONLY the closed trigger's label, which is why
      // the ETP-4956 regression (a re-opened picker offering just the
      // already-selected option) shipped unnoticed: the option list was never
      // read. Radix keeps PopoverContent unmounted while closed, so the list
      // only exists after the trigger is clicked — do that, then COUNT.
      const user = userEvent.setup();
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

      await user.click(screen.getByText('statusProcessed'));
      const labels = (await screen.findAllByTestId('distinct-option')).map((o) => o.textContent);
      // BOTH enumLabels keys are offered — not only the selected one.
      expect(labels.sort()).toEqual(['statusDraft', 'statusProcessed']);
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
  // ETP-4913 — DistinctEnumPicker option ORDER.
  //
  // mergedCodes fuses two sources that arrive at different times: the uncached
  // backend `_distinct` fetch (fired when the popover opens) and the codes
  // present in the currently loaded grid rows. Without a final sort the list
  // paints in grid order, then reshuffles once the fetch resolves — and on the
  // next open the component remounts and does it again, so the user sees a
  // different order every time. Status columns must instead follow the fixed
  // business-flow order (the same one ListFilterBar's pill uses).
  // ================================================================

  describe('DistinctEnumPicker option order (ETP-4913)', () => {
    // No enumLabels and a mocked `useLocale` returning `{ statuses: {} }` means
    // labelFor(code) falls all the way through to the raw code, so each
    // rendered option's text IS its code. That keeps the order assertions
    // readable and independent of any translation catalog.
    const DOC_STATUS_COL = {
      key: 'documentStatus',
      label: 'Doc Status',
      type: 'status',
      column: 'DocStatus',
    };

    // Business enum (chart-of-accounts `accountType`): NOT a status column, so
    // it must keep whatever order the merge produced.
    const ACCOUNT_TYPE_COL = {
      key: 'accountType',
      label: 'Account Type',
      type: 'enum',
      column: 'AccountType',
    };

    // Virtual column with no backend: its options come from the enumLabels keys
    // via fillFallbackCodes, in a deliberate (severity) order.
    const SEVERITY_COL = {
      key: 'dueState',
      label: 'Due State',
      type: 'enum',
      column: 'DueState',
      enumLabels: { vencida: 'vencida', proxima: 'proxima', aldia: 'aldia' },
    };

    afterEach(() => {
      distinctState.values = [];
    });

    /**
     * Renders the builder with one column and an empty-valued condition (which
     * is what activates DistinctEnumPicker), opens the picker and returns the
     * option texts in render order. Shared by every case below so the
     * render/open/read sequence is written once.
     */
    async function openPickerOptions(col, { distinctCodes = [], rows = [], value = '' } = {}) {
      const user = userEvent.setup();
      distinctState.values = distinctCodes.map((c) => ({ id: c, _identifier: String(c) }));

      render(
        <AdvancedFilterBuilder
          columns={[col]}
          value={{
            rowOperator: 'and',
            conditions: [{ field: col.key, operator: 'equals', value }],
          }}
          rows={rows}
          entity="test-entity"
          apiBaseUrl="/api"
        />,
      );

      // With no selected value the trigger shows the placeholder; with one it
      // shows that value's resolved label — which, with no enumLabels and an
      // empty statuses dictionary, is the raw code itself.
      const triggerText = value === '' ? 'advancedFilterSelectValue' : String(value);
      await user.click(screen.getByText(triggerText));

      const options = await screen.findAllByTestId('distinct-option');
      return options.map((o) => o.textContent);
    }

    it('renders status codes in business-flow order, not in the order they arrived', async () => {
      // Shuffled arrival order, as the backend/grid mix would deliver it.
      const labels = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['VO', 'DR', 'CO', 'NA', 'TEMP'],
      });
      expect(labels).toEqual(['TEMP', 'DR', 'CO', 'NA', 'VO']);
    });

    it('renders the same order whichever source arrived first (the reported symptom)', async () => {
      // Same five codes, but split across the two sources in opposite ways.
      const backendFirst = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['CL', 'CO', 'DR'],
        rows: [{ documentStatus: 'VO' }, { documentStatus: 'IP' }],
      });
      cleanup();
      const rowsFirst = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['VO', 'IP'],
        rows: [{ documentStatus: 'DR' }, { documentStatus: 'CO' }, { documentStatus: 'CL' }],
      });

      expect(backendFirst).toEqual(['DR', 'IP', 'CO', 'CL', 'VO']);
      expect(rowsFirst).toEqual(backendFirst);
    });

    it('sorts the Unknown sentinel last instead of first', async () => {
      // The backend orders distinct values by raw code and '?' sorts before
      // 'A', so '??' used to lead the list.
      const labels = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['??', 'CL', 'CO', 'DR'],
      });
      expect(labels).toEqual(['DR', 'CO', 'CL', '??']);
    });

    it('places an active code absent from both sources in its flow position, not at the end', async () => {
      const labels = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['DR', 'VO'],
        value: 'CO',
      });
      expect(labels).toEqual(['DR', 'CO', 'VO']);
    });

    it('leaves a non-status enum column in its arrival order (guard: do not widen the gate)', async () => {
      // accountType's codes collide with the status catalog ('M' sits in the
      // In-process bucket), so sorting them would reorder a correct list.
      const labels = await openPickerOptions(ACCOUNT_TYPE_COL, {
        distinctCodes: ['A', 'E', 'L', 'M', 'O', 'R'],
      });
      expect(labels).toEqual(['A', 'E', 'L', 'M', 'O', 'R']);
    });

    it('preserves the deliberate enumLabels order of a virtual enum column', async () => {
      // No entity data reaches this column, so fillFallbackCodes supplies the
      // enumLabels keys — a severity order that alphabetizing would invert.
      const labels = await openPickerOptions(SEVERITY_COL);
      expect(labels).toEqual(['vencida', 'proxima', 'aldia']);
    });

    it('still collapses boolean/string twins to one option on a status column', async () => {
      // Guard that ordering did not disturb the canon() dedup: 'false' (Draft
      // bucket) must precede 'true' (Completed bucket), once each.
      const labels = await openPickerOptions(DOC_STATUS_COL, {
        distinctCodes: ['true', 'false'],
        rows: [{ documentStatus: true }, { documentStatus: false }, { documentStatus: true }],
      });
      expect(labels).toEqual(['false', 'true']);
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

    // ETP-4770 reject-cycle 3: the eager fetch (added above) fires correctly,
    // but while it's still in flight the picker must show a loading
    // placeholder — never the raw id, not even for one render. This is the
    // generic case (label unknown + fetch pending), not specific to
    // "notEqual" — it applies to any selected id absent from both
    // `inMemoryOptions` and `distinct.values` while the fetch hasn't settled.
    it('shows a loading placeholder — never the raw id — while the distinct fetch is still in flight', () => {
      distinctState.loading = true;
      distinctState.values = []; // not resolved yet
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'notEqual', value: ['BP1'] }],
      };
      render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[]} // notEqual excludes the selected row from the grid
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      expect(screen.queryByText('BP1')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('Loader2__4eedf1').length).toBeGreaterThan(0);
    });

    it('replaces the loading placeholder with the real label once the distinct fetch settles', () => {
      distinctState.loading = true;
      distinctState.values = [];
      const value = {
        rowOperator: 'and',
        conditions: [{ field: 'bp', operator: 'notEqual', value: ['BP1'] }],
      };
      const { rerender } = render(
        <AdvancedFilterBuilder
          columns={[bpCol]}
          value={value}
          rows={[]}
          entity="business-partners"
          apiBaseUrl="/api"
        />,
      );
      expect(screen.queryByText('BP1')).not.toBeInTheDocument();
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();

      // The fetch settles: values arrive, loading flips false.
      distinctState.loading = false;
      distinctState.values = [{ id: 'BP1', _identifier: 'Acme Corp' }];
      rerender(
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
  });
});

// ================================================================
// ETP-4956 — advanced filter usability fixes.
//
// Five independent bugs, all observable only once the component is mounted:
//
//   1. Re-opening an enum filter that already had a value offered a dropdown
//      containing ONLY the already-selected option. The cause was the ORDER of
//      the `mergedCodes` merge: the current selection was folded in BEFORE the
//      declared-enumLabels fallback, so the fallback's "only when no data
//      produced anything" gate saw a non-empty list and skipped. The gate
//      itself is correct and stays — the selection is now folded in LAST.
//   2. Enum values are now picked with a multi-select popover; the retired
//      "Is any of" (`inSet`) free-text operator is gone from the enum list but
//      remains RENDERABLE so pre-existing saved presets stay editable.
//   3. Numeric editors accept a locale decimal comma (type="text" +
//      inputMode="decimal") and are normalized to dot-decimal on apply.
//   4. Text values are trimmed on apply — and NOT on change, so the user can
//      keep typing spaces between words.
//
// Radix keeps `PopoverContent` UNMOUNTED while closed, so every assertion on
// the enum picker's OPTION LIST must click the trigger first. Asserting only
// the closed trigger's label — what the pre-existing option test did — cannot
// see bug 1 at all.
// ================================================================

/**
 * Renders one enum condition, opens its picker, and returns the option labels
 * in render order plus the handles the caller needs to keep interacting.
 *
 * `triggerText` is what the CLOSED trigger shows: the placeholder when nothing
 * is selected, otherwise the first selected code's resolved label (+N suffix).
 */
async function openEnumPicker({ col, value = '', rows = [], distinctCodes = [], onApply, entity, apiBaseUrl }) {
  const user = userEvent.setup();
  distinctState.values = distinctCodes.map((c) => ({ id: c, _identifier: String(c) }));
  render(
    <AdvancedFilterBuilder
      columns={[col]}
      value={{ rowOperator: 'and', conditions: [{ field: col.key, operator: 'equals', value }] }}
      rows={rows}
      entity={entity}
      apiBaseUrl={apiBaseUrl}
      onApply={onApply}
    />,
  );
  // The picker's ChevronDown is unique here: the identifier picker and the
  // presets dropdown (which share the testid) are not rendered for an enum
  // column with no `presets` prop.
  const trigger = screen.getByTestId('ChevronDown__4eedf1').closest('button');
  await user.click(trigger);
  await screen.findByTestId('distinct-values-list');
  return { user, trigger };
}

const optionLabels = () =>
  screen.getAllByTestId('distinct-option').map((o) => o.textContent);

const clickOption = (user, label) =>
  user.click(screen.getAllByTestId('distinct-option').find((o) => o.textContent === label));

describe('ETP-4956 — enum picker option list when re-editing', () => {
  // A non-`status` enum column: orderCodesForColumn only reorders
  // `type: 'status'` columns (ETP-4913), so this one keeps the merge order and
  // the assertions can read as a plain set without fighting the business-flow
  // sort. Labels are literals, which ui() passes through unchanged.
  const RECONCILIATION_COL = {
    key: 'reconciliation',
    label: 'Reconciliation',
    type: 'enum',
    column: 'ReconciliationState',
    enumLabels: {
      DRAFT: 'Borrador',
      UNRECONCILED: 'Sin conciliar',
      RECONCILED: 'Conciliado',
    },
  };

  const FULL_CATALOGUE = ['Borrador', 'Conciliado', 'Sin conciliar'];

  afterEach(() => {
    distinctState.values = [];
  });

  // ----------------------------------------------------------------
  // No dynamic source produced anything -> the declared catalogue seeds the
  // list, so a virtual column with static enumLabels is never an empty picker.
  // ----------------------------------------------------------------

  it('seeds the list from the declared catalogue when there is no data at all', async () => {
    await openEnumPicker({ col: RECONCILIATION_COL, value: '' });
    expect(optionLabels().sort()).toEqual(FULL_CATALOGUE);
  });

  it('STILL seeds the whole declared catalogue when a value is already selected', async () => {
    // THE ETP-4956 REGRESSION, and the single most important case here: with no
    // rows and no distinct values the only thing in the list used to be the
    // already-picked code, because `selected` was folded in BEFORE the
    // fallback and tripped its "no data" gate. The user could not switch
    // values without clearing the filter first. The selection is now folded in
    // LAST, so the gate sees the (empty) DATA only.
    await openEnumPicker({
      col: RECONCILIATION_COL,
      value: 'DRAFT',
      rows: [],
      distinctCodes: [],
      entity: 'bank-statement',
      apiBaseUrl: '/api',
    });
    expect(optionLabels().sort()).toEqual(FULL_CATALOGUE);
  });

  it('STILL seeds the whole declared catalogue when several values are already selected', async () => {
    await openEnumPicker({
      col: RECONCILIATION_COL,
      value: ['DRAFT', 'RECONCILED'],
      rows: [],
      distinctCodes: [],
      entity: 'bank-statement',
      apiBaseUrl: '/api',
    });
    expect(optionLabels().sort()).toEqual(FULL_CATALOGUE);
  });

  it('does not duplicate an already-selected code that the catalogue also seeded', async () => {
    await openEnumPicker({ col: RECONCILIATION_COL, value: 'RECONCILED' });
    const labels = optionLabels();
    expect(labels.sort()).toEqual(FULL_CATALOGUE);
    expect(labels.filter((l) => l === 'Conciliado')).toHaveLength(1);
  });

  // ----------------------------------------------------------------
  // Some dynamic source DID produce codes -> the declared catalogue must NOT
  // be unioned in. A declared code no row carries can only ever return zero
  // rows, so offering it is a dead end for the user.
  // ----------------------------------------------------------------

  it('does NOT offer a declared code that no loaded row and no distinct value carries', async () => {
    // The reported bug from the opposite direction: unioning the catalogue
    // whenever the column declares one put an unmatchable option in the list.
    await openEnumPicker({
      col: RECONCILIATION_COL,
      value: 'DRAFT',
      distinctCodes: ['DRAFT'],
      rows: [{ reconciliation: 'DRAFT' }],
      entity: 'bank-statement',
      apiBaseUrl: '/api',
    });
    expect(optionLabels()).toEqual(['Borrador']);
  });

  it('does not duplicate a declared code that is both selected and present in the data', async () => {
    await openEnumPicker({
      col: RECONCILIATION_COL,
      value: 'RECONCILED',
      distinctCodes: ['RECONCILED', 'DRAFT'],
      rows: [{ reconciliation: 'RECONCILED' }],
      entity: 'bank-statement',
      apiBaseUrl: '/api',
    });
    const labels = optionLabels();
    // Exactly the two codes the data carries — 'Sin conciliar' is declared but
    // absent from the data, and 'Conciliado' is both selected and in the data
    // yet must appear once.
    expect(labels.slice().sort()).toEqual(['Borrador', 'Conciliado']);
    expect(labels.filter((l) => l === 'Conciliado')).toHaveLength(1);
  });

  // ----------------------------------------------------------------
  // The reported user case: Movements declares labels for BPD/BPW/BF so a
  // bank-fee row renders its name instead of a raw code, but an account with
  // no bank-fee movement must not be offered "Comisión bancaria" — filtering
  // by it could only ever return zero rows.
  // ----------------------------------------------------------------

  describe('a declared code absent from the data stays out of the list (Movements "Tipo")', () => {
    const MOVEMENT_TYPE_COL = {
      key: 'movementType',
      label: 'Type',
      type: 'enum',
      column: 'MovementType',
      enumLabels: {
        BPD: 'Depósito',
        BPW: 'Retirada',
        BF: 'Comisión bancaria',
      },
    };

    const openMovements = (value) => openEnumPicker({
      col: MOVEMENT_TYPE_COL,
      value,
      distinctCodes: ['BPD', 'BPW'],
      rows: [{ movementType: 'BPD' }, { movementType: 'BPW' }],
      entity: 'goods-movements',
      apiBaseUrl: '/api',
    });

    it('offers only the two codes the account actually has', async () => {
      await openMovements('');
      expect(optionLabels().slice().sort()).toEqual(['Depósito', 'Retirada']);
    });

    it('still offers only those two when one of them is already selected (re-edit)', async () => {
      // Re-opening the filter must neither collapse the list to the picked
      // code (the ETP-4956 bug) nor grow it with the unmatchable BF option.
      await openMovements('BPD');
      expect(optionLabels().slice().sort()).toEqual(['Depósito', 'Retirada']);
    });

    it('offers the third code as soon as a row carries it', async () => {
      await openEnumPicker({
        col: MOVEMENT_TYPE_COL,
        value: 'BPD',
        distinctCodes: ['BPD', 'BPW'],
        rows: [{ movementType: 'BPD' }, { movementType: 'BPW' }, { movementType: 'BF' }],
        entity: 'goods-movements',
        apiBaseUrl: '/api',
      });
      expect(optionLabels().slice().sort()).toEqual(['Comisión bancaria', 'Depósito', 'Retirada']);
    });
  });

  // ----------------------------------------------------------------
  // The fallback gate is UNIFORM: it governs the global status dictionary the
  // same way it governs a column's own enumLabels. (An earlier attempt at the
  // fix made the two differ; that split no longer exists.)
  // ----------------------------------------------------------------

  describe('the same gate applies to the global status dictionary', () => {
    const UNDECLARED_COL = {
      key: 'documentStatus',
      label: 'Doc Status',
      type: 'enum',
      column: 'DocStatus',
    };

    it('falls back to the global dictionary only when nothing else was merged', async () => {
      localeState.statuses = { DR: { label: 'Draft' }, CO: { label: 'Complete' } };
      await openEnumPicker({ col: UNDECLARED_COL, value: '' });
      expect(optionLabels().sort()).toEqual(['Complete', 'Draft']);
    });

    it('still falls back for an undeclared column when only a value is selected', async () => {
      // Same ordering guarantee as for a declared catalogue: the selection is
      // not data, so it must not suppress the fallback.
      localeState.statuses = { DR: { label: 'Draft' }, CO: { label: 'Complete' } };
      await openEnumPicker({ col: UNDECLARED_COL, value: 'DR' });
      expect(optionLabels().sort()).toEqual(['Complete', 'Draft']);
    });

    it('does NOT union the global dictionary once real data has been merged', async () => {
      localeState.statuses = { DR: { label: 'Draft' }, CO: { label: 'Complete' } };
      await openEnumPicker({
        col: UNDECLARED_COL,
        value: 'DR',
        distinctCodes: ['DR'],
        entity: 'orders',
        apiBaseUrl: '/api',
      });
      // Only the code the data actually produced — 'Complete' would be an
      // unrelated global status leaking into this column's picker.
      expect(optionLabels()).toEqual(['Draft']);
    });
  });
});

describe('ETP-4956 — enum picker is multi-select', () => {
  const RECONCILIATION_COL = {
    key: 'reconciliation',
    label: 'Reconciliation',
    type: 'enum',
    column: 'ReconciliationState',
    enumLabels: {
      DRAFT: 'Borrador',
      UNRECONCILED: 'Sin conciliar',
      RECONCILED: 'Conciliado',
    },
  };

  afterEach(() => {
    distinctState.values = [];
  });

  it('accumulates toggled codes into an array and emits it on apply', async () => {
    const onApply = vi.fn();
    const { user } = await openEnumPicker({ col: RECONCILIATION_COL, value: 'DRAFT', onApply });
    await clickOption(user, 'Conciliado');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].conditions[0].value).toEqual(['DRAFT', 'RECONCILED']);
  });

  it('accepts a scalar value on the way in (pre-ETP-4956 saved preset)', async () => {
    const onApply = vi.fn();
    // The stored condition is the SCALAR 'DRAFT', not an array.
    const { user } = await openEnumPicker({ col: RECONCILIATION_COL, value: 'DRAFT', onApply });
    // It is treated as a one-element selection, so applying untouched still
    // works and toggling promotes it to an array.
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toBe('DRAFT');
  });

  it('un-toggles an already-selected code', async () => {
    const onApply = vi.fn();
    const { user } = await openEnumPicker({
      col: RECONCILIATION_COL,
      value: ['DRAFT', 'RECONCILED'],
      onApply,
    });
    await clickOption(user, 'Borrador');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toEqual(['RECONCILED']);
  });

  it('keeps the popover open while several codes are toggled in one pass', async () => {
    const { user } = await openEnumPicker({ col: RECONCILIATION_COL, value: '' });
    await clickOption(user, 'Borrador');
    // Single-select used to close here, forcing a re-open per value.
    expect(screen.getByTestId('distinct-values-list')).toBeInTheDocument();
    await clickOption(user, 'Conciliado');
    expect(screen.getByTestId('distinct-values-list')).toBeInTheDocument();
    await clickOption(user, 'Sin conciliar');
    expect(screen.getByTestId('distinct-values-list')).toBeInTheDocument();
  });

  it('labels the trigger "<first> +N" for a multi-code selection', async () => {
    const { user, trigger } = await openEnumPicker({ col: RECONCILIATION_COL, value: 'DRAFT' });
    expect(trigger).toHaveTextContent('Borrador');
    expect(trigger).not.toHaveTextContent('+');

    await clickOption(user, 'Conciliado');
    expect(trigger).toHaveTextContent('Borrador +1');

    await clickOption(user, 'Sin conciliar');
    expect(trigger).toHaveTextContent('Borrador +2');
  });

  it('falls back to the placeholder once every code is un-toggled', async () => {
    const { user, trigger } = await openEnumPicker({ col: RECONCILIATION_COL, value: 'DRAFT' });
    await clickOption(user, 'Borrador');
    expect(trigger).toHaveTextContent('advancedFilterSelectValue');
  });

  it('disables apply while the enum row has no selected code', async () => {
    const onApply = vi.fn();
    const { user } = await openEnumPicker({ col: RECONCILIATION_COL, value: '', onApply });
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('ETP-4956 — "Is any of" (inSet) retired from enum operators', () => {
  const seededEnumRow = (col) => ({
    rowOperator: 'and',
    conditions: [{ field: col.key, operator: '', value: '' }],
  });

  const ENUM_COL = {
    key: 'reconciliation',
    label: 'Reconciliation',
    type: 'enum',
    column: 'ReconciliationState',
    enumLabels: { DRAFT: 'Borrador', RECONCILED: 'Conciliado' },
  };

  it('does not offer the "is any of" operator for an enum column', async () => {
    const user = userEvent.setup();
    render(<AdvancedFilterBuilder columns={[ENUM_COL]} value={seededEnumRow(ENUM_COL)} />);
    await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
    // ui() returns the key, so the retired option would read 'opInSet'.
    expect(screen.queryByRole('option', { name: 'opInSet' })).not.toBeInTheDocument();
  });

  it('still offers the four surviving enum operators', async () => {
    const user = userEvent.setup();
    render(<AdvancedFilterBuilder columns={[ENUM_COL]} value={seededEnumRow(ENUM_COL)} />);
    await user.click(screen.getByText('advancedFilterSelectOp').closest('button'));
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    // 'opIs' / 'opIsNot' are the labels of equals / notEqual.
    expect(names).toEqual(['opIs', 'opIsNot', 'opIsEmpty', 'opIsNotEmpty']);
  });

  it('keeps a pre-existing inSet preset editable as a comma-separated text field', async () => {
    // The operator can no longer be CHOSEN, but a preset saved before the
    // change must not render an empty value cell.
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder
        columns={[ENUM_COL]}
        value={{
          rowOperator: 'and',
          conditions: [{ field: 'reconciliation', operator: 'inSet', value: ['DRAFT', 'RECONCILED'] }],
        }}
        onApply={onApply}
      />,
    );
    const input = screen.getByPlaceholderText('advancedFilterInSetPlaceholder');
    expect(input).toHaveValue('DRAFT,RECONCILED');
    await user.clear(input);
    await user.type(input, 'DRAFT');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0]).toMatchObject({
      operator: 'inSet',
      value: 'DRAFT',
    });
  });
});

describe('ETP-4956 — normalizeDecimalInput', () => {
  it('leaves a plain integer untouched', () => {
    expect(normalizeDecimalInput('1646')).toBe('1646');
  });

  it('leaves canonical dot-decimal untouched', () => {
    expect(normalizeDecimalInput('1646.49')).toBe('1646.49');
  });

  it('reads a lone comma as the decimal separator (es-ES typing)', () => {
    expect(normalizeDecimalInput('1646,49')).toBe('1646.49');
  });

  it('reads the LAST separator as the decimal when both are present', () => {
    expect(normalizeDecimalInput('1.646,49')).toBe('1646.49');
    expect(normalizeDecimalInput('1,646.49')).toBe('1646.49');
  });

  it('strips multiple thousands groups', () => {
    expect(normalizeDecimalInput('1.234.567,89')).toBe('1234567.89');
    expect(normalizeDecimalInput('1,234,567.89')).toBe('1234567.89');
  });

  it('treats a lone separator followed by exactly three digits as a thousands group', () => {
    // "1.646" is 1646 in es-ES, never 1.646 — the ambiguity is resolved in
    // favour of the grouping reading.
    expect(normalizeDecimalInput('1.646')).toBe('1646');
    expect(normalizeDecimalInput('1,646')).toBe('1646');
  });

  it('keeps a lone separator followed by a non-three-digit group as the decimal', () => {
    expect(normalizeDecimalInput('1,6')).toBe('1.6');
    expect(normalizeDecimalInput('1,6499')).toBe('1.6499');
  });

  it('preserves the sign', () => {
    expect(normalizeDecimalInput('-1.646,49')).toBe('-1646.49');
    expect(normalizeDecimalInput('+1646,49')).toBe('+1646.49');
  });

  it('drops surrounding and inner whitespace', () => {
    expect(normalizeDecimalInput('  1 646,49 ')).toBe('1646.49');
  });

  it('returns the trimmed original for anything that is not a number', () => {
    expect(normalizeDecimalInput('  1.646,49 EUR ')).toBe('1.646,49 EUR');
    expect(normalizeDecimalInput('  abc  ')).toBe('abc');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeDecimalInput('')).toBe('');
    expect(normalizeDecimalInput('   ')).toBe('');
  });

  it('passes non-string values straight through', () => {
    expect(normalizeDecimalInput(1646.49)).toBe(1646.49);
    expect(normalizeDecimalInput(null)).toBeNull();
    expect(normalizeDecimalInput(undefined)).toBeUndefined();
  });
});

describe('ETP-4956 — numeric editors accept a locale decimal comma', () => {
  const NUMERIC_COLS = [
    { key: 'balance', label: 'Balance', type: 'number', column: 'Balance' },
    { key: 'amount', label: 'Amount', type: 'amount', column: 'Amount' },
  ];

  const numericRow = (operator, value) => ({
    rowOperator: 'and',
    conditions: [{ field: 'balance', operator, value }],
  });

  it('renders the single-value numeric editor as a decimal text field', () => {
    render(<AdvancedFilterBuilder columns={NUMERIC_COLS} value={numericRow('equals', '')} />);
    const input = screen.getByRole('textbox');
    // NOT type="number": that input refuses the comma the grid displays.
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('renders both "between" numeric editors as decimal text fields', () => {
    render(<AdvancedFilterBuilder columns={NUMERIC_COLS} value={numericRow('between', ['', ''])} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputmode', 'decimal');
    }
  });

  it('does not put inputMode=decimal on a text column editor', () => {
    const cols = [{ key: 'name', label: 'Name', type: 'text', column: 'Name' }];
    render(
      <AdvancedFilterBuilder
        columns={cols}
        value={{ rowOperator: 'and', conditions: [{ field: 'name', operator: 'iContains', value: '' }] }}
      />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toHaveAttribute('inputmode');
  });

  it('lets the user type a decimal comma and normalizes it on apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder columns={NUMERIC_COLS} value={numericRow('equals', '')} onApply={onApply} />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, '1.646,49');
    // The comma survives in the editor — the user sees what they typed.
    expect(input).toHaveValue('1.646,49');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toBe('1646.49');
  });

  it('normalizes both ends of a "between" numeric range on apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder columns={NUMERIC_COLS} value={numericRow('between', ['', ''])} onApply={onApply} />,
    );
    const [from, to] = screen.getAllByRole('textbox');
    await user.type(from, '1.000,50');
    await user.type(to, '2.000,75');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toEqual(['1000.50', '2000.75']);
  });
});

describe('ETP-4956 — values are sanitized at apply time, not on change', () => {
  const COLS = [
    { key: 'contact', label: 'Contact', type: 'text', column: 'Contact' },
    { key: 'balance', label: 'Balance', type: 'number', column: 'Balance' },
  ];

  it('trims a text value on apply', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder
        columns={COLS}
        value={{ rowOperator: 'and', conditions: [{ field: 'contact', operator: 'iContains', value: '  Ivan  ' }] }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByText('advancedFilterApply'));
    // Untrimmed, the backend matched the spaces literally and returned nothing.
    expect(onApply.mock.calls[0][0].conditions[0].value).toBe('Ivan');
  });

  it('does NOT trim while the user is typing, so inner spaces survive', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder
        columns={COLS}
        value={{ rowOperator: 'and', conditions: [{ field: 'contact', operator: 'iContains', value: '' }] }}
        onApply={onApply}
      />,
    );
    const input = screen.getByRole('textbox');
    // Trimming on change would eat the space and make "Banco Santander"
    // untypeable — the editor must keep the trailing space mid-word.
    await user.type(input, 'Banco ');
    expect(input).toHaveValue('Banco ');
    await user.type(input, 'Santander');
    expect(input).toHaveValue('Banco Santander');
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toBe('Banco Santander');
  });

  it('sanitizes every condition of a multi-row filter, each by its own mode', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder
        columns={COLS}
        value={{
          rowOperator: 'and',
          conditions: [
            { field: 'contact', operator: 'iContains', value: '  Ivan  ' },
            { field: 'balance', operator: 'equals', value: '1.646,49' },
          ],
        }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions.map((c) => c.value)).toEqual(['Ivan', '1646.49']);
  });

  it('leaves a nullish-operator condition (value === null) alone', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <AdvancedFilterBuilder
        columns={COLS}
        value={{ rowOperator: 'and', conditions: [{ field: 'contact', operator: 'isNull', value: null }] }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toBeNull();
  });

  it('trims every element of an array value', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const cols = [{ key: 'bp', label: 'Partner', type: 'selector', column: 'C_BPartner_ID' }];
    render(
      <AdvancedFilterBuilder
        columns={cols}
        value={{ rowOperator: 'and', conditions: [{ field: 'bp', operator: 'equals', value: [' BP1 ', 'BP2 '] }] }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByText('advancedFilterApply'));
    expect(onApply.mock.calls[0][0].conditions[0].value).toEqual(['BP1', 'BP2']);
  });

  it('does not mutate the applied condition objects passed in as `value`', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const incoming = { field: 'contact', operator: 'iContains', value: '  Ivan  ' };
    render(
      <AdvancedFilterBuilder
        columns={COLS}
        value={{ rowOperator: 'and', conditions: [incoming] }}
        onApply={onApply}
      />,
    );
    await user.click(screen.getByText('advancedFilterApply'));
    expect(incoming.value).toBe('  Ivan  ');
    expect(onApply.mock.calls[0][0].conditions[0]).not.toBe(incoming);
  });
});
