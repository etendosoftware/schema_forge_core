import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock i18n hooks
vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({}),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/lib/buildUrlWithParams.js', () => ({
  buildUrlWithParams: (url) => url,
}));
vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: () => [],
}));
vi.mock('@/lib/statusBadge.js', () => ({
  getStatusDotColor: () => 'bg-gray-400',
  getStatusGridPillClass: () => '',
  getStatusPillClass: () => '',
  statusLabel: (raw) => raw,
}));
vi.mock('@/components/ui/status-tag', () => ({
  StatusTag: ({ status, label }) => <span data-testid="status-tag">{label || status}</span>,
}));
vi.mock('@/components/ui/tag', () => ({
  Tag: ({ label }) => <span>{label}</span>,
}));
vi.mock('@/lib/resolveIdentifier.js', () => ({
  resolveIdentifier: (row, key) => row?.[key + '$_identifier'] ?? row?.[key] ?? '',
}));
vi.mock('@/lib/resolveColumnLabel.js', () => ({
  resolveColumnLabel: (col) => col.label ?? col.key,
}));
vi.mock('@/lib/formatAmount.js', () => ({
  formatAmount: (val) => val != null ? String(val) : '',
}));
vi.mock('@/lib/applyCalloutUpdates.js', () => ({
  applyCalloutUpdates: (prev, updates) => ({ ...prev, ...updates }),
}));
vi.mock('../ProductSearchDrawer.jsx', () => ({
  default: () => null,
}));
vi.mock('../InternalConsumptionProductSearchDrawer.jsx', () => ({
  default: () => null,
}));
vi.mock('../SelectorInput.jsx', () => ({
  SelectorInput: () => <div data-testid="selector-input" />,
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { DataTable } from '../DataTable.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'status', label: 'Status', type: 'status' },
];

const DATA = [
  { id: '1', name: 'Order A', amount: 100, status: 'DR' },
  { id: '2', name: 'Order B', amount: 200, status: 'CO' },
];

describe('DataTable', () => {
  it('renders without crashing with empty data', () => {
    render(<DataTable columns={COLUMNS} data={[]} />);
    // Empty state should be visible
    expect(screen.getByText('noRecordsYet')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />);
    expect(screen.getByText('Order A')).toBeInTheDocument();
    expect(screen.getByText('Order B')).toBeInTheDocument();
  });

  it('renders amount values', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders row test ids', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />);
    expect(screen.getByTestId('row-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-2')).toBeInTheDocument();
  });

  it('shows empty state with filter hint when data is filtered to empty', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        filters={['name']}
      />
    );
    expect(screen.getByText('noRecordsYet')).toBeInTheDocument();
  });

  it('calls onNavigate when a row is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <DataTable columns={COLUMNS} data={DATA} onNavigate={onNavigate} />
    );
    await user.click(screen.getByTestId('row-1'));
    expect(onNavigate).toHaveBeenCalledWith(DATA[0]);
  });

  it('renders loading skeleton when loading is true', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} data={[]} loading={true} />
    );
    // Skeleton renders animated placeholder divs
    expect(container.querySelector('.space-y-2')).toBeInTheDocument();
  });

  it('renders checkboxes when selectable is true (default)', () => {
    render(<DataTable columns={COLUMNS} data={DATA} />);
    // Header checkbox + 2 row checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);
  });

  it('does not render checkboxes when selectable is false', () => {
    render(<DataTable columns={COLUMNS} data={DATA} selectable={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders delete button when onDeleteRow is provided', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        onDeleteRow={vi.fn()}
      />
    );
    const deleteButtons = screen.getAllByTitle('deleteRowTooltip');
    expect(deleteButtons.length).toBe(2);
  });

  it('renders boolean column as yes/no text', () => {
    const columns = [{ key: 'active', label: 'Active', type: 'boolean' }];
    const data = [
      { id: '1', active: true },
      { id: '2', active: false },
    ];
    render(<DataTable columns={columns} data={data} selectable={false} />);
    expect(screen.getByText('yes')).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();
  });

  it('renders footer totals for amount columns', () => {
    render(
      <DataTable columns={COLUMNS} data={DATA} selectable={false} showFooterTotals={true} />
    );
    // Total of 100 + 200 = 300
    expect(screen.getByText('300')).toBeInTheDocument();
  });
});