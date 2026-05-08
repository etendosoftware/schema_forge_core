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