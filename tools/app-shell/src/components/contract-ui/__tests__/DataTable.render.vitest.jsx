/**
 * DataTable render coverage tests.
 *
 * Exercises branches NOT covered by DataTable.vitest.jsx or
 * DataTable.renderCellValue.vitest.jsx — focused on selection, inline-add,
 * readOnly mode, hidden columns, hover-row actions, date/enum formatting
 * paths, and clone buttons.
 */

import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---

vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({ genericLabels: {}, statuses: {} }),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/lib/buildUrlWithParams.js', () => ({
  buildUrlWithParams: (url) => url,
}));
vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: () => [],
}));
vi.mock('@/lib/statusBadge.js', () => ({
  getStatusDotColor: (raw) => `dot-${raw ?? 'none'}`,
  statusLabel: (raw) => `lbl-${raw}`,
}));
vi.mock('@/components/ui/status-tag', () => ({
  StatusTag: ({ status, label }) => <span data-testid="status-tag">{label || status}</span>,
}));
vi.mock('@/components/ui/tag', () => ({
  Tag: ({ label, variant }) => <span data-testid="tag" data-variant={variant}>{label}</span>,
}));
vi.mock('@/lib/resolveIdentifier.js', () => ({
  resolveIdentifier: (row, key) => row?.[key + '$_identifier'] ?? row?.[key] ?? '',
}));
vi.mock('@/lib/resolveColumnLabel.js', () => ({
  resolveColumnLabel: (col) => col.label ?? col.key,
}));
vi.mock('@/lib/formatAmount.js', () => ({
  formatAmount: (val, cur) => (val != null ? `${Number(val).toFixed(2)}${cur ? ` ${cur}` : ''}` : ''),
}));
vi.mock('@/lib/applyCalloutUpdates.js', () => ({
  applyCalloutUpdates: (prev, updates) => ({ ...prev, ...updates }),
}));
vi.mock('@/lib/linesColumnWidth.js', () => ({
  columnFlex: () => '1 0 100px',
  columnMinWidthPx: () => 100,
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
vi.mock('../InlineSearchCombo.jsx', () => ({
  InlineSearchCombo: ({ field }) => <span data-testid={`inline-combo-${field?.key}`} />,
}));
vi.mock('../RowQuickActions.jsx', () => ({
  default: ({ row }) => <span data-testid={`rqa-${row?.id}`} />,
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { DataTable } from '../DataTable.jsx';

// --- Fixtures ---

const COLUMNS = [
  { key: 'docNo', label: 'Doc No', type: 'string' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'total', label: 'Total', type: 'amount' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'active', label: 'Active', type: 'boolean' },
];

const DATA = [
  { id: 'r1', docNo: 'SO-001', date: '2025-03-15', total: 150, status: 'DR', active: true, 'currency$_identifier': 'USD' },
  { id: 'r2', docNo: 'SO-002', date: '2025-06-01', total: 300, status: 'CO', active: false, 'currency$_identifier': 'USD' },
];

// ---- Tests ----

describe('DataTable — render coverage', () => {
  // --- Selection ---

  describe('selection', () => {
    it('select-all toggles all row checkboxes', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is "select all"
      const selectAll = checkboxes[0];
      await act(async () => {
        await userEvent.click(selectAll);
      });
      expect(onSelectionChange).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'r1' }),
        expect.objectContaining({ id: 'r2' }),
      ]));
    });

    it('toggling a single row checkbox calls onSelectionChange with that row', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Second checkbox is for the first row
      await act(async () => {
        await userEvent.click(checkboxes[1]);
      });
      expect(onSelectionChange).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'r1' })]),
      );
    });

    it('isRowSelectable prevents selecting non-selectable rows', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          onSelectionChange={onSelectionChange}
          isRowSelectable={(row) => row.id === 'r1'}
        />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Row 2 should be disabled
      expect(checkboxes[2]).toBeDisabled();
    });
  });

  // --- Empty / loading states ---

  describe('empty and loading states', () => {
    it('shows empty state with filter hint when columnFilters are active', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={[]}
          columnFilters={{ docNo: 'xyz' }}
        />,
      );
      // hasActiveFilter includes columnFilters
      expect(screen.getByText('noMatchingRecords')).toBeInTheDocument();
    });

    it('renders skeleton rows when loading', () => {
      const { container } = render(
        <DataTable columns={COLUMNS} data={[]} loading />,
      );
      expect(container.querySelector('.space-y-2')).toBeInTheDocument();
    });
  });

  // --- Date cell formatting ---

  describe('date column', () => {
    it('renders formatted date for valid ISO date', () => {
      const cols = [{ key: 'date', label: 'Date', type: 'date' }];
      const rows = [{ id: 'd1', date: '2025-03-15' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      // The dateFormatter uses en-US locale → "03/15/2025"
      expect(screen.getByText('03/15/2025')).toBeInTheDocument();
    });

    it('renders em-dash for null date', () => {
      const cols = [{ key: 'date', label: 'Date', type: 'date' }];
      const rows = [{ id: 'd2', date: null }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText('\u2014')).toBeInTheDocument();
    });
  });

  // --- Enum column ---

  describe('enum column', () => {
    it('renders enum label via useMenuLabel', () => {
      const cols = [{ key: 'type', label: 'Type', type: 'enum', enumLabels: { SO: 'Sales Order' } }];
      const rows = [{ id: 'e1', type: 'SO' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      // useMenuLabel mock returns the key as-is, enumLabels maps SO → 'Sales Order'
      expect(screen.getByText('Sales Order')).toBeInTheDocument();
    });

    it('renders enum with dot display', () => {
      const cols = [{ key: 'type', label: 'Type', type: 'enum', display: 'dot', enumLabels: { DR: 'Draft' } }];
      const rows = [{ id: 'e2', type: 'DR' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders enum with Tag variant', () => {
      const cols = [{ key: 'type', label: 'Type', type: 'enum', enumLabels: { CO: 'Complete' }, enumVariants: { CO: 'green' } }];
      const rows = [{ id: 'e3', type: 'CO' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      const tag = screen.getByTestId('tag');
      expect(tag).toHaveAttribute('data-variant', 'green');
    });
  });

  // --- Boolean badge column ---

  describe('boolean badge column', () => {
    it('renders badge when col.badge is true', () => {
      const cols = [{ key: 'active', label: 'Active', type: 'boolean', badge: true }];
      const rows = [
        { id: 'b1', active: true },
        { id: 'b2', active: false },
      ];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      const tags = screen.getAllByTestId('tag');
      expect(tags).toHaveLength(2);
    });

    it('renders colored badge when col.badgeColors is set', () => {
      const cols = [{
        key: 'active', label: 'Active', type: 'boolean', badge: true,
        badgeColors: { true: 'bg-green-100 text-green-800', false: 'bg-red-100 text-red-800' },
      }];
      const rows = [{ id: 'b3', active: true }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      // badgeColors path renders a <span> with custom classes, not a Tag
      expect(screen.getByText('statusComplete')).toBeInTheDocument();
    });
  });

  // --- Amount column with footer totals ---

  describe('footer totals', () => {
    it('renders sum of amount columns in footer', () => {
      const cols = [
        { key: 'total', label: 'Total', type: 'amount' },
      ];
      const rows = [
        { id: 'f1', total: 100, 'currency$_identifier': 'EUR' },
        { id: 'f2', total: 250, 'currency$_identifier': 'EUR' },
      ];
      render(<DataTable columns={cols} data={rows} selectable={false} showFooterTotals />);
      // 100 + 250 = 350 → formatAmount mock → "350.00 EUR"
      expect(screen.getByText('350.00 EUR')).toBeInTheDocument();
    });

    it('does not render footer when showFooterTotals is false', () => {
      const cols = [{ key: 'total', label: 'Total', type: 'amount' }];
      const rows = [{ id: 'f3', total: 42 }];
      const { container } = render(
        <DataTable columns={cols} data={rows} selectable={false} showFooterTotals={false} />,
      );
      expect(container.querySelector('tfoot')).toBeNull();
    });
  });

  // --- Hidden columns ---

  describe('hidden columns', () => {
    it('does not render columns listed in hiddenColumns', () => {
      render(
        <DataTable columns={COLUMNS} data={DATA} hiddenColumns={['active']} selectable={false} />,
      );
      expect(screen.queryByTestId('column-header-active')).toBeNull();
    });
  });

  // --- Clone button ---

  describe('clone button', () => {
    it('renders clone button when onCloneRow is provided', () => {
      render(
        <DataTable columns={COLUMNS} data={DATA} onCloneRow={vi.fn()} selectable={false} />,
      );
      const cloneButtons = screen.getAllByLabelText('cloneOrderBtn');
      expect(cloneButtons).toHaveLength(DATA.length);
    });
  });

  // --- Hover row actions ---

  describe('hover row actions', () => {
    it('renders pencil and trash in hoverRowActions mode', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          onDeleteRow={vi.fn()}
          selectable={false}
        />,
      );
      // Each row has an edit button (Pencil) and a delete button
      const editButtons = screen.getAllByLabelText('edit');
      expect(editButtons).toHaveLength(DATA.length);
      const deleteButtons = screen.getAllByTestId(/^row-delete-/);
      expect(deleteButtons).toHaveLength(DATA.length);
    });

    it('shows save/cancel icons when editingRowId matches', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          onDeleteRow={vi.fn()}
          editingRowId="r1"
          onSaveRow={vi.fn()}
          onCancelEdit={vi.fn()}
          selectable={false}
        />,
      );
      // For row r1, edit column shows Check (save), delete column shows X (cancel)
      expect(screen.getByLabelText('save')).toBeInTheDocument();
      expect(screen.getByLabelText('cancel')).toBeInTheDocument();
    });
  });

  // --- RowQuickActions ---

  describe('row quick actions', () => {
    it('renders RowQuickActions when rowQuickActions.enabled is true', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          rowQuickActions={{ enabled: true, onEdit: vi.fn() }}
          selectable={false}
        />,
      );
      expect(screen.getByTestId('rqa-r1')).toBeInTheDocument();
      expect(screen.getByTestId('rqa-r2')).toBeInTheDocument();
    });
  });

  // --- Inline add row ---

  describe('inline add row', () => {
    it('renders inline-add-row when addRow.active is true', () => {
      const addRow = {
        active: true,
        fields: [
          { key: 'docNo', label: 'Doc No', type: 'text', column: 'DocumentNo' },
        ],
        onAdd: vi.fn(),
        onCancel: vi.fn(),
        catalogs: {},
      };
      render(<DataTable columns={[COLUMNS[0]]} data={[]} addRow={addRow} selectable={false} />);
      expect(screen.getByTestId('inline-add-row')).toBeInTheDocument();
    });

    it('shows the inline-add hint text when addRow is active', () => {
      const addRow = {
        active: true,
        fields: [{ key: 'docNo', label: 'Doc No', type: 'text', column: 'DocumentNo' }],
        onAdd: vi.fn(),
        onCancel: vi.fn(),
      };
      render(<DataTable columns={[COLUMNS[0]]} data={[]} addRow={addRow} selectable={false} />);
      expect(screen.getByText('inlineAddHint')).toBeInTheDocument();
    });
  });

  // --- Percent column ---

  describe('percent column', () => {
    it('renders percent bar at 0%', () => {
      const cols = [{ key: 'pct', label: 'Pct', type: 'percent' }];
      const rows = [{ id: 'p1', pct: 0 }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('renders percent bar at 100%', () => {
      const cols = [{ key: 'pct', label: 'Pct', type: 'percent' }];
      const rows = [{ id: 'p2', pct: 100 }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('renders partial percent bar', () => {
      const cols = [{ key: 'pct', label: 'Pct', type: 'percent' }];
      const rows = [{ id: 'p3', pct: 45 }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  // --- Truncated fallback ---

  describe('long string truncation', () => {
    it('renders long string values without crashing', () => {
      const longStr = 'A'.repeat(35);
      const cols = [{ key: 'name', label: 'Name', type: 'string' }];
      const rows = [{ id: 't1', name: longStr }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByText(longStr)).toBeInTheDocument();
    });
  });

  // --- Sort callback ---

  describe('sort column', () => {
    it('calls onSort when a sortable column header is clicked', async () => {
      const onSort = vi.fn();
      const cols = [{ key: 'name', label: 'Name', type: 'string' }];
      render(
        <DataTable columns={cols} data={[]} onSort={onSort} selectable={false} />,
      );
      const header = screen.getByText('Name');
      await act(async () => {
        await userEvent.click(header);
      });
      expect(onSort).toHaveBeenCalledWith('name');
    });

    it('renders sort indicator when sortColumn matches', () => {
      const cols = [{ key: 'name', label: 'Name', type: 'string' }];
      render(
        <DataTable
          columns={cols}
          data={[]}
          onSort={vi.fn()}
          sortColumn="name"
          sortDirection="asc"
          selectable={false}
        />,
      );
      expect(screen.getByText('\u25B2')).toBeInTheDocument();
    });
  });

  // --- onRowClick vs onNavigate vs onRowSelect ---

  describe('row click dispatch', () => {
    it('calls onRowClick when provided instead of onNavigate', async () => {
      const onRowClick = vi.fn();
      const onNavigate = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onRowClick={onRowClick} onNavigate={onNavigate} selectable={false} />,
      );
      await act(async () => {
        await userEvent.click(screen.getByTestId('row-r1'));
      });
      expect(onRowClick).toHaveBeenCalledWith(DATA[0]);
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('falls back to onRowSelect when neither onRowClick nor onNavigate', async () => {
      const onRowSelect = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onRowSelect={onRowSelect} selectable={false} />,
      );
      await act(async () => {
        await userEvent.click(screen.getByTestId('row-r1'));
      });
      expect(onRowSelect).toHaveBeenCalledWith(DATA[0]);
    });
  });

  // --- Row filter ---

  describe('rowFilter', () => {
    it('filters rows using the rowFilter predicate', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          rowFilter={(row) => row.total > 200}
          selectable={false}
        />,
      );
      expect(screen.queryByTestId('row-r1')).toBeNull();
      expect(screen.getByTestId('row-r2')).toBeInTheDocument();
    });
  });
});
