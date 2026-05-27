import { render, screen, act } from '@testing-library/react';
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
vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
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

vi.mock('../AdvancedFilterBuilder.jsx', () => ({
  AdvancedFilterBuilder: (props) => <div data-testid="advanced-filter-builder" />,
}));

vi.mock('../DistinctValuesList.jsx', () => ({
  DistinctValuesList: () => <div data-testid="distinct-values-list" />,
}));

// Mock the Calendar component
vi.mock('@/components/ui/calendar.jsx', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

// Capture-stub for DateRangePopoverContent: records the most recent props it
// was rendered with so tests can invoke onChange directly to exercise the
// adapter functions in ListFilterBar.
const lastDateRangeProps = { current: null };
vi.mock('@/components/ui/date-range-popover.jsx', () => ({
  DateRangePopoverContent: (props) => {
    lastDateRangeProps.current = props;
    return <div data-testid="date-range-popover-content" />;
  },
}));

import { ListFilterBar } from '../ListFilterBar.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'documentStatus', label: 'Status', type: 'status' },
  { key: 'orderDate', label: 'Order Date', type: 'date' },
];

describe('ListFilterBar', () => {
  it('renders without crashing with no columns', () => {
    const { container } = render(<ListFilterBar columns={[]} />);
    expect(container).toBeTruthy();
  });

  it('renders the advanced filter (funnel) button', () => {
    render(<ListFilterBar columns={COLUMNS} />);
    // The funnel button has title from ui('advancedFilters')
    const funnelBtn = screen.getByTitle('advancedFilters');
    expect(funnelBtn).toBeInTheDocument();
  });

  it('renders status filter when a status column exists', () => {
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={vi.fn()}
      />
    );
    // Status button shows ui('allStatuses') by default
    expect(screen.getByText('allStatuses')).toBeInTheDocument();
  });

  it('does not render status filter when no status column exists', () => {
    const cols = [{ key: 'name', label: 'Name', type: 'string' }];
    render(
      <ListFilterBar
        columns={cols}
        columnFilters={{}}
        onFilterChange={vi.fn()}
      />
    );
    expect(screen.queryByText('allStatuses')).not.toBeInTheDocument();
  });

  it('renders date filter when dateFilterKey points to a date column', () => {
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );
    // Date filter button shows ui('dateRangeAnyTime')
    expect(screen.getByText('dateRangeAnyTime')).toBeInTheDocument();
  });

  it('does not render date filter when dateFilterKey is null', () => {
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={vi.fn()}
        dateFilterKey={null}
      />
    );
    expect(screen.queryByText('dateRangeAnyTime')).not.toBeInTheDocument();
  });

  it('shows active filter badge count when advanced filter is active', () => {
    const advancedFilter = {
      conditions: [
        { field: 'name', operator: 'iContains', value: 'test' },
        { field: 'amount', operator: 'greaterThan', value: '100' },
      ],
    };
    render(
      <ListFilterBar
        columns={COLUMNS}
        advancedFilter={advancedFilter}
        onAdvancedFilterChange={vi.fn()}
      />
    );
    // Badge shows count of conditions
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show filter badge when no advanced filter is active', () => {
    render(
      <ListFilterBar
        columns={COLUMNS}
        advancedFilter={null}
        onAdvancedFilterChange={vi.fn()}
      />
    );
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Adapter logic: dateRangeValue + handleDateRangeChange
// ─────────────────────────────────────────────────────────────────────────────
describe('ListFilterBar date range adapters', () => {
  beforeEach(() => {
    lastDateRangeProps.current = null;
  });

  /**
   * Opens the date popover by clicking its trigger, which causes
   * DateRangePopoverContent to mount and capture its props into
   * `lastDateRangeProps.current`.
   */
  const openDatePopover = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByTestId('filter-date'));
    // Wait for the captured props to populate. In JSDOM Radix opens
    // synchronously after click, but await one microtask for safety.
    await Promise.resolve();
  };

  it('dateRangeValue is null when no date filter is active', async () => {
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    expect(lastDateRangeProps.current).not.toBeNull();
    expect(lastDateRangeProps.current.value).toBeNull();
  });

  it('dateRangeValue derives {presetId} from a preset:* originalValue', async () => {
    const columnFilters = {
      orderDate: {
        mode: 'date',
        op: 'range',
        value: ['2026-05-19', '2026-05-25'],
        originalValue: 'preset:last7',
      },
    };

    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={columnFilters}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    expect(lastDateRangeProps.current.value).toEqual({ presetId: 'last7' });
  });

  it('dateRangeValue derives {from,to} from a custom:* originalValue', async () => {
    const columnFilters = {
      orderDate: {
        mode: 'date',
        op: 'range',
        value: ['2026-05-01', '2026-05-31'],
        originalValue: 'custom:2026-05-01:2026-05-31',
      },
    };

    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={columnFilters}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    const v = lastDateRangeProps.current.value;
    expect(v).not.toBeNull();
    expect(v.from).toBeInstanceOf(Date);
    expect(v.to).toBeInstanceOf(Date);
    expect(v.from.getFullYear()).toBe(2026);
    expect(v.from.getMonth()).toBe(4); // May (0-indexed)
    expect(v.from.getDate()).toBe(1);
    expect(v.to.getDate()).toBe(31);
  });

  it('handleDateRangeChange(null) emits a null filter via onFilterChange', async () => {
    const onFilterChange = vi.fn();
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={onFilterChange}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    act(() => {
      lastDateRangeProps.current.onChange(null);
    });

    expect(onFilterChange).toHaveBeenCalledWith('orderDate', null);
  });

  it('handleDateRangeChange({presetId:"today"}) emits a range filter with preset:today originalValue', async () => {
    const onFilterChange = vi.fn();
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={onFilterChange}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    act(() => {
      lastDateRangeProps.current.onChange({ presetId: 'today' });
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    const [key, payload] = onFilterChange.mock.calls[0];
    expect(key).toBe('orderDate');
    expect(payload.mode).toBe('date');
    expect(payload.op).toBe('range');
    expect(payload.originalValue).toBe('preset:today');
    expect(payload.value).toHaveLength(2);
    // today preset: from === to (same day)
    expect(payload.value[0]).toBe(payload.value[1]);
    expect(payload.value[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handleDateRangeChange({from,to}) emits a range filter with custom:from:to originalValue', async () => {
    const onFilterChange = vi.fn();
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={onFilterChange}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    const from = new Date(2026, 4, 1); // 2026-05-01 (local time)
    const to = new Date(2026, 4, 31);  // 2026-05-31 (local time)
    act(() => {
      lastDateRangeProps.current.onChange({ from, to });
    });

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    const [key, payload] = onFilterChange.mock.calls[0];
    expect(key).toBe('orderDate');
    expect(payload.mode).toBe('date');
    expect(payload.op).toBe('range');
    expect(payload.value).toEqual(['2026-05-01', '2026-05-31']);
    expect(payload.originalValue).toBe('custom:2026-05-01:2026-05-31');
  });

  it('handleDateRangeChange({presetId:"allTime"}) emits null (unsupported preset clears filter)', async () => {
    const onFilterChange = vi.fn();
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={{}}
        onFilterChange={onFilterChange}
        dateFilterKey="orderDate"
      />
    );

    await openDatePopover();
    act(() => {
      lastDateRangeProps.current.onChange({ presetId: 'allTime' });
    });

    expect(onFilterChange).toHaveBeenCalledWith('orderDate', null);
  });

  it('renders the trigger with a localized preset label when preset filter is active', () => {
    const columnFilters = {
      orderDate: {
        mode: 'date',
        op: 'range',
        value: ['2026-05-19', '2026-05-25'],
        originalValue: 'preset:last7',
      },
    };
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={columnFilters}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );

    // The trigger label should reflect the preset, not "anyTime"
    expect(screen.getByText('dateRangeLast7Days')).toBeInTheDocument();
  });

  it('renders the trigger with the "custom" label when a custom range filter is active', () => {
    const columnFilters = {
      orderDate: {
        mode: 'date',
        op: 'range',
        value: ['2026-05-01', '2026-05-31'],
        originalValue: 'custom:2026-05-01:2026-05-31',
      },
    };
    render(
      <ListFilterBar
        columns={COLUMNS}
        columnFilters={columnFilters}
        onFilterChange={vi.fn()}
        dateFilterKey="orderDate"
      />
    );

    expect(screen.getByText('dateRangeCustom')).toBeInTheDocument();
  });
});