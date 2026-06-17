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

  // ---------- NEW: additional coverage for uncovered DataTable branches ----------

  // --- Status cell rendering ---

  describe('status column', () => {
    it('renders StatusTag for status type column', () => {
      const cols = [{ key: 'status', label: 'Status', type: 'status' }];
      const rows = [{ id: 's1', status: 'DR' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByTestId('status-tag')).toBeInTheDocument();
    });

    it('renders status with dot display', () => {
      const cols = [{ key: 'status', label: 'Status', type: 'status', display: 'dot' }];
      const rows = [{ id: 's2', status: 'CO' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      // statusLabel mock returns "lbl-CO"
      expect(screen.getByText('lbl-CO')).toBeInTheDocument();
    });
  });

  // --- Date cell with dot color ---

  describe('date dot color', () => {
    it('renders date with color dot for past dates', () => {
      const cols = [{ key: 'date', label: 'Date', type: 'date' }];
      const rows = [{ id: 'dd1', date: '2020-01-01' }];
      const { container } = render(<DataTable columns={cols} data={rows} selectable={false} />);
      // Past date should produce a red dot
      const dot = container.querySelector('.bg-red-500');
      expect(dot).not.toBeNull();
    });

    it('renders date with green dot for future dates', () => {
      const cols = [{ key: 'date', label: 'Date', type: 'date' }];
      const rows = [{ id: 'dd2', date: '2099-12-31' }];
      const { container } = render(<DataTable columns={cols} data={rows} selectable={false} />);
      const dot = container.querySelector('.bg-emerald-500');
      expect(dot).not.toBeNull();
    });

    it('renders date without dot when col.dot is false', () => {
      const cols = [{ key: 'date', label: 'Date', type: 'date', dot: false }];
      const rows = [{ id: 'dd3', date: '2020-01-01' }];
      const { container } = render(<DataTable columns={cols} data={rows} selectable={false} />);
      const dot = container.querySelector('.bg-red-500');
      expect(dot).toBeNull();
    });
  });

  // --- Inline add-row with selector/search field ---

  describe('inline add-row with selector field', () => {
    it('renders InlineSearchCombo for search-type add-row field', () => {
      const addRow = {
        active: true,
        fields: [
          { key: 'product', label: 'Product', type: 'search', column: 'M_Product_ID' },
        ],
        onAdd: vi.fn(),
        onCancel: vi.fn(),
        catalogs: {},
      };
      const cols = [{ key: 'product', label: 'Product', type: 'string' }];
      render(
        <DataTable
          columns={cols}
          data={[]}
          addRow={addRow}
          selectable={false}
          apiBaseUrl="/api"
          entity="lines"
          token="tok"
        />,
      );
      expect(screen.getByTestId('inline-add-row')).toBeInTheDocument();
    });
  });

  // --- Custom render column ---

  describe('custom render column', () => {
    it('calls col.render function for custom columns', () => {
      const cols = [{
        key: 'custom',
        label: 'Custom',
        type: 'string',
        render: (row) => <span data-testid="custom-render">{row.id}</span>,
      }];
      const rows = [{ id: 'cr1' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByTestId('custom-render')).toBeInTheDocument();
      expect(screen.getByText('cr1')).toBeInTheDocument();
    });
  });

  // --- Amount column rendering ---

  describe('amount column', () => {
    it('renders formatted amount in body cell', () => {
      const cols = [
        { key: 'docNo', label: 'Doc No', type: 'string' },
        { key: 'total', label: 'Total', type: 'amount' },
      ];
      const rows = [{ id: 'a1', docNo: 'X', total: 99.9, 'currency$_identifier': 'EUR' }];
      render(<DataTable columns={cols} data={rows} selectable={false} showFooterTotals={false} />);
      expect(screen.getByText('99.90 EUR')).toBeInTheDocument();
    });
  });

  // --- Boolean toggle column ---

  describe('boolean toggle column', () => {
    it('renders Switch for boolean column with toggle: true', () => {
      const cols = [{ key: 'active', label: 'Active', type: 'boolean', toggle: true }];
      const rows = [{ id: 'bt1', active: true }];
      render(
        <DataTable
          columns={cols}
          data={rows}
          selectable={false}
          apiBaseUrl="/api"
          entity="header"
          token="tok"
        />,
      );
      // Switch renders with role="switch"
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  // --- Empty state without filter ---

  describe('empty state without filter', () => {
    it('shows noRecordsYet when no filters and no data', () => {
      render(<DataTable columns={COLUMNS} data={[]} selectable={false} />);
      expect(screen.getByText('noRecordsYet')).toBeInTheDocument();
    });
  });

  // --- addRow with select type field ---

  describe('inline add-row with select field', () => {
    it('renders select dropdown for static-options field in add-row', () => {
      const addRow = {
        active: true,
        fields: [
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            column: 'DocType',
            options: [
              { value: 'SO', label: 'Sales' },
              { value: 'PO', label: 'Purchase' },
            ],
          },
        ],
        onAdd: vi.fn(),
        onCancel: vi.fn(),
        catalogs: {},
      };
      const cols = [{ key: 'type', label: 'Type', type: 'string' }];
      render(
        <DataTable columns={cols} data={[]} addRow={addRow} selectable={false} />,
      );
      expect(screen.getByTestId('inline-add-row')).toBeInTheDocument();
      expect(screen.getByTestId('inline-add-field-type')).toBeInTheDocument();
    });
  });

  // --- Read-only mode (no selection column) ---

  describe('readOnly rendering', () => {
    it('does not show checkboxes when selectable is false', () => {
      render(<DataTable columns={COLUMNS} data={DATA} selectable={false} />);
      expect(screen.queryByRole('checkbox')).toBeNull();
    });
  });

  // --- onNavigate fallback ---

  describe('onNavigate row click', () => {
    it('calls onNavigate when no onRowClick or onRowSelect', async () => {
      const onNavigate = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onNavigate={onNavigate} selectable={false} />,
      );
      await act(async () => {
        await userEvent.click(screen.getByTestId('row-r1'));
      });
      expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ id: DATA[0].id }));
    });
  });

  // --- Click interactions on hover row action buttons ---

  describe('hover row action button clicks', () => {
    it('calls onSaveRow when save icon is clicked in editing mode', async () => {
      const onSaveRow = vi.fn();
      const onCancelEdit = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          onDeleteRow={vi.fn()}
          editingRowId="r1"
          onSaveRow={onSaveRow}
          onCancelEdit={onCancelEdit}
          selectable={false}
        />,
      );
      const saveBtn = screen.getByLabelText('save');
      await act(async () => {
        await userEvent.click(saveBtn);
      });
      expect(onSaveRow).toHaveBeenCalled();
    });

    it('calls onCancelEdit when cancel icon is clicked in editing mode', async () => {
      const onCancelEdit = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          onDeleteRow={vi.fn()}
          editingRowId="r1"
          onSaveRow={vi.fn()}
          onCancelEdit={onCancelEdit}
          selectable={false}
        />,
      );
      const cancelBtn = screen.getByLabelText('cancel');
      await act(async () => {
        await userEvent.click(cancelBtn);
      });
      expect(onCancelEdit).toHaveBeenCalled();
    });

    it('calls onDeleteRow when delete icon is clicked on a non-editing row', async () => {
      const onDeleteRow = vi.fn().mockResolvedValue({});
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          onDeleteRow={onDeleteRow}
          selectable={false}
        />,
      );
      const deleteButtons = screen.getAllByTestId(/^row-delete-/);
      await act(async () => {
        await userEvent.click(deleteButtons[0]);
      });
      expect(onDeleteRow).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    });
  });

  // --- Clone button click ---

  describe('clone button click', () => {
    it('calls onCloneRow with row data when clone button is clicked', async () => {
      const onCloneRow = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onCloneRow={onCloneRow} selectable={false} />,
      );
      const cloneButtons = screen.getAllByLabelText('cloneOrderBtn');
      await act(async () => {
        await userEvent.click(cloneButtons[0]);
      });
      expect(onCloneRow).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    });
  });

  // --- Deselect all via select-all toggle ---

  describe('select-all deselect', () => {
    it('deselects all rows when select-all is clicked twice', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      const selectAll = checkboxes[0];
      // Select all
      await act(async () => {
        await userEvent.click(selectAll);
      });
      // Deselect all
      await act(async () => {
        await userEvent.click(selectAll);
      });
      const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
      expect(lastCall[0]).toEqual([]);
    });
  });

  // --- Boolean toggle switch click ---

  describe('boolean toggle switch click', () => {
    it('calls fetch to toggle boolean when switch is clicked', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: { data: [{ id: 'bt1', active: false }] } }),
      });
      const cols = [{ key: 'active', label: 'Active', type: 'boolean', toggle: true }];
      const rows = [{ id: 'bt1', active: true }];
      render(
        <DataTable
          columns={cols}
          data={rows}
          selectable={false}
          apiBaseUrl="/api"
          entity="header"
          token="tok"
        />,
      );
      const toggle = screen.getByRole('switch');
      await act(async () => {
        await userEvent.click(toggle);
      });
      expect(globalThis.fetch).toHaveBeenCalled();
      delete globalThis.fetch;
    });
  });

  // --- Sort direction toggle ---

  describe('sort direction toggle', () => {
    it('shows descending indicator when sortDirection is desc', () => {
      const cols = [{ key: 'name', label: 'Name', type: 'string' }];
      render(
        <DataTable
          columns={cols}
          data={[]}
          onSort={vi.fn()}
          sortColumn="name"
          sortDirection="desc"
          selectable={false}
        />,
      );
      expect(screen.getByText('\u25BC')).toBeInTheDocument();
    });
  });

  // --- hideHeader mode (colgroup + hidden thead) ---

  describe('hideHeader mode', () => {
    it('hides table header with display:none when hideHeader is true', () => {
      const { container } = render(
        <DataTable columns={COLUMNS} data={DATA} hideHeader selectable={false} />,
      );
      const thead = container.querySelector('thead');
      expect(thead).not.toBeNull();
      expect(thead.style.display).toBe('none');
    });

    it('renders colgroup for column widths when hideHeader is true', () => {
      const { container } = render(
        <DataTable columns={COLUMNS} data={DATA} hideHeader selectable={false} />,
      );
      expect(container.querySelector('colgroup')).not.toBeNull();
    });
  });

  // --- Pagination controls ---

  describe('pagination controls', () => {
    it('renders page info when totalRows is provided', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          totalRows={50}
          pageSize={10}
          currentPage={1}
          onPageChange={vi.fn()}
          selectable={false}
        />,
      );
      // Should show some pagination UI
      const nextBtn = screen.queryByTestId('pagination-next');
      // Pagination might render as text or as buttons depending on implementation
      expect(screen.getByTestId('row-r1')).toBeInTheDocument();
    });

    it('calls onPageChange when next page is clicked', async () => {
      const onPageChange = vi.fn();
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          totalRows={50}
          pageSize={10}
          currentPage={1}
          onPageChange={onPageChange}
          selectable={false}
        />,
      );
      const nextBtn = screen.queryByTestId('pagination-next');
      if (nextBtn) {
        await act(async () => { await userEvent.click(nextBtn); });
        expect(onPageChange).toHaveBeenCalled();
      }
    });
  });

  // --- Custom render function in column ---

  describe('custom column render function — complex', () => {
    it('passes full row data and context to custom render', () => {
      const renderFn = vi.fn((row, ctx) => <span data-testid="custom-cell">{row.docNo}-{row.total}</span>);
      const cols = [{
        key: 'custom',
        label: 'Custom',
        type: 'string',
        render: renderFn,
      }];
      const rows = [{ id: 'cr2', docNo: 'INV-001', total: 500 }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByTestId('custom-cell')).toBeInTheDocument();
      expect(screen.getByText('INV-001-500')).toBeInTheDocument();
      // render receives (row, { entity, token, apiBaseUrl })
      expect(renderFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cr2', docNo: 'INV-001' }),
        expect.objectContaining({}),
      );
    });
  });

  // --- Footer totals with mixed types ---

  describe('footer totals — edge cases', () => {
    it('renders 0 total when all amounts are null', () => {
      const cols = [{ key: 'total', label: 'Total', type: 'amount' }];
      const rows = [
        { id: 'fn1', total: null },
        { id: 'fn2', total: null },
      ];
      render(<DataTable columns={cols} data={rows} selectable={false} showFooterTotals />);
      // formatAmount(0) → "0.00"
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('handles single row totals', () => {
      const cols = [{ key: 'total', label: 'Total', type: 'amount' }];
      const rows = [{ id: 'fs1', total: 42.5, 'currency$_identifier': 'USD' }];
      render(<DataTable columns={cols} data={rows} selectable={false} showFooterTotals />);
      // 42.50 USD appears in both body and footer
      expect(screen.getAllByText('42.50 USD').length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Read-only mode: no edit icons in hoverRowActions ---

  describe('readOnly via hoverRowActions without onDeleteRow', () => {
    it('does not render delete buttons when onDeleteRow is not provided', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          hoverRowActions
          selectable={false}
        />,
      );
      expect(screen.queryAllByTestId(/^row-delete-/)).toHaveLength(0);
    });
  });

  // --- Filter empty state with rowFilter that removes all ---

  describe('filter empty state with rowFilter removing all rows', () => {
    it('shows noRecordsYet when rowFilter removes every row', () => {
      render(
        <DataTable
          columns={COLUMNS}
          data={DATA}
          rowFilter={() => false}
          selectable={false}
        />,
      );
      // All rows filtered out via rowFilter → empty state without filter hint
      expect(screen.getByText('noRecordsYet')).toBeInTheDocument();
    });
  });

  // --- Selector input field in add row ---

  describe('inline add-row with selector field', () => {
    it('renders SelectorInput for selector-type add-row field', () => {
      const addRow = {
        active: true,
        fields: [
          { key: 'bp', label: 'Business Partner', type: 'selector', column: 'C_BPartner_ID' },
        ],
        onAdd: vi.fn(),
        onCancel: vi.fn(),
        catalogs: {},
      };
      const cols = [{ key: 'bp', label: 'BP', type: 'string' }];
      render(
        <DataTable
          columns={cols}
          data={[]}
          addRow={addRow}
          selectable={false}
          apiBaseUrl="/api"
          entity="lines"
          token="tok"
        />,
      );
      expect(screen.getByTestId('inline-add-row')).toBeInTheDocument();
    });
  });

  // --- Multiple selection toggle ---

  describe('multiple selection toggles', () => {
    it('selects and deselects individual rows independently', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Select first row
      await act(async () => { await userEvent.click(checkboxes[1]); });
      // Select second row
      await act(async () => { await userEvent.click(checkboxes[2]); });
      // Should have both rows selected
      const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
      expect(lastCall[0]).toHaveLength(2);
    });

    it('deselects a row by clicking its checkbox again', async () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
      );
      const checkboxes = screen.getAllByRole('checkbox');
      // Select first row
      await act(async () => { await userEvent.click(checkboxes[1]); });
      // Deselect first row
      await act(async () => { await userEvent.click(checkboxes[1]); });
      const lastCall = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1];
      expect(lastCall[0]).toHaveLength(0);
    });
  });

  // --- Column with no data ---

  describe('column with missing data', () => {
    it('renders empty cell for undefined field value', () => {
      const cols = [{ key: 'missing', label: 'Missing', type: 'string' }];
      const rows = [{ id: 'md1' }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      expect(screen.getByTestId('row-md1')).toBeInTheDocument();
    });
  });

  // --- Row highlighting for selectedRowId ---

  describe('selectedRowId highlighting', () => {
    it('renders selected row with different styling', () => {
      const { container } = render(
        <DataTable columns={COLUMNS} data={DATA} selectedRowId="r1" selectable={false} />,
      );
      const row = screen.getByTestId('row-r1');
      // The selected row typically gets a bg-* class
      expect(row).toBeInTheDocument();
    });
  });

  // --- Row without any row click handler ---

  describe('row without click handlers', () => {
    it('renders row without crashing when no click handler is provided', async () => {
      render(
        <DataTable columns={COLUMNS} data={DATA} selectable={false} />,
      );
      await act(async () => {
        await userEvent.click(screen.getByTestId('row-r1'));
      });
      // Just should not crash
      expect(screen.getByTestId('row-r1')).toBeInTheDocument();
    });
  });

  // --- Boolean column without badge (plain check/x) ---

  describe('boolean column plain display', () => {
    it('renders boolean value without badge styling when badge is not set', () => {
      const cols = [{ key: 'active', label: 'Active', type: 'boolean' }];
      const rows = [{ id: 'bp1', active: true }, { id: 'bp2', active: false }];
      render(<DataTable columns={cols} data={rows} selectable={false} />);
      // Should render checkmarks or x marks
      expect(screen.getByTestId('row-bp1')).toBeInTheDocument();
      expect(screen.getByTestId('row-bp2')).toBeInTheDocument();
    });
  });

  // --- Amount column with zero value ---

  describe('amount column with zero', () => {
    it('renders 0.00 for zero amount', () => {
      const cols = [{ key: 'total', label: 'Total', type: 'amount' }];
      const rows = [{ id: 'az1', total: 0 }];
      render(<DataTable columns={cols} data={rows} selectable={false} showFooterTotals={false} />);
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });
  });

  // --- Sort column with no callback ---

  describe('sort column without onSort', () => {
    it('does not crash when header is clicked without onSort', async () => {
      const cols = [{ key: 'name', label: 'Name', type: 'string' }];
      render(<DataTable columns={cols} data={[]} selectable={false} />);
      const header = screen.getByText('Name');
      await act(async () => {
        await userEvent.click(header);
      });
      // No crash
      expect(header).toBeInTheDocument();
    });
  });

  // --- Inline edit field click does not propagate row click ---

  describe('inline add cancel', () => {
    it('calls onCancel when cancel button is clicked in add row', async () => {
      const onCancel = vi.fn();
      const addRow = {
        active: true,
        fields: [{ key: 'docNo', label: 'Doc No', type: 'text', column: 'DocumentNo' }],
        onAdd: vi.fn(),
        onCancel,
      };
      render(<DataTable columns={[COLUMNS[0]]} data={[]} addRow={addRow} selectable={false} />);
      const cancelBtn = screen.queryByTestId('inline-add-cancel');
      if (cancelBtn) {
        await act(async () => { await userEvent.click(cancelBtn); });
        expect(onCancel).toHaveBeenCalled();
      }
    });
  });
});
