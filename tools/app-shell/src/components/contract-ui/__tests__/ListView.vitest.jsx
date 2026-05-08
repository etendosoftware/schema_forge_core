import { render, screen } from '@testing-library/react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/test-entity', search: '' }),
  NavLink: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

// Mock i18n hooks
vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock useEntity hook
vi.mock('@/hooks/useEntity', () => ({
  useEntity: () => ({
    items: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    sortColumn: 'creationDate',
    sortDirection: 'desc',
    setSortColumn: vi.fn(),
    setSortDirection: vi.fn(),
  }),
}));

// Mock layout context hooks
vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: vi.fn(),
}));
vi.mock('@/components/layout/FavoritesContext', () => ({
  useFavorites: () => ({ favorites: [], toggleFavorite: vi.fn(), isFavorite: () => false }),
}));

// Mock sub-components
vi.mock('../ReportDrawer.jsx', () => ({
  default: () => null,
}));
vi.mock('../DocumentPrintDrawer.jsx', () => ({
  default: () => null,
  printDocuments: vi.fn(),
}));
vi.mock('../ListFilterBar.jsx', () => ({
  ListFilterBar: () => <div data-testid="list-filter-bar" />,
}));
vi.mock('@/lib/gridQuery', () => ({
  buildAdvancedFilterCriteria: () => null,
}));
vi.mock('@/hooks/useWindowFilterPresets', () => ({
  useWindowFilterPresets: () => ({ presets: {}, savePreset: vi.fn(), deletePreset: vi.fn() }),
}));

import { ListView } from '../ListView.jsx';

// A minimal Table component mock that renders rows
function MockTable({ data, onNavigate, ...rest }) {
  return (
    <table data-testid="mock-table">
      <tbody>
        {data.map((row, i) => (
          <tr key={row.id ?? i} onClick={() => onNavigate?.(row)}>
            <td>{row.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('ListView', () => {
  const defaultProps = {
    entity: 'testEntity',
    Table: MockTable,
    entityLabel: 'Test Entity',
    windowName: 'test-entity',
    token: 'fake-token',
    apiBaseUrl: 'http://localhost/api',
  };

  it('renders without crashing with minimal props', () => {
    render(<ListView {...defaultProps} />);
    expect(screen.getByTestId('list-view')).toBeInTheDocument();
  });

  it('renders the new record button by default', () => {
    render(<ListView {...defaultProps} />);
    expect(screen.getByTestId('action-new')).toBeInTheDocument();
    expect(screen.getByText('newRecord')).toBeInTheDocument();
  });

  it('hides the new record button when hideCreate is true', () => {
    render(<ListView {...defaultProps} hideCreate={true} />);
    expect(screen.queryByTestId('action-new')).not.toBeInTheDocument();
  });

  it('renders the table component', () => {
    render(<ListView {...defaultProps} />);
    expect(screen.getByTestId('mock-table')).toBeInTheDocument();
  });

  it('renders the filter bar by default', () => {
    render(<ListView {...defaultProps} />);
    expect(screen.getByTestId('list-filter-bar')).toBeInTheDocument();
  });

  it('hides the filter bar when hideListFilters is true', () => {
    render(<ListView {...defaultProps} hideListFilters={true} />);
    expect(screen.queryByTestId('list-filter-bar')).not.toBeInTheDocument();
  });

  it('renders subset filter buttons when subsetFilters are provided', () => {
    const subsetFilters = [
      { label: 'filterAll', filter: null },
      { label: 'filterOpen', filter: 'status=DR' },
    ];
    render(<ListView {...defaultProps} subsetFilters={subsetFilters} />);
    expect(screen.getByText('filterAll')).toBeInTheDocument();
    expect(screen.getByText('filterOpen')).toBeInTheDocument();
  });

  it('renders quick filter buttons when quickFilters are provided', () => {
    const quickFilters = [
      { label: 'overdueFilter', filter: 'overdue=true' },
    ];
    render(<ListView {...defaultProps} quickFilters={quickFilters} />);
    expect(screen.getByText('overdueFilter')).toBeInTheDocument();
  });
});
