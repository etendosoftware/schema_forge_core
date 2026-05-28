import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

const toastFn = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args) => toastFn(...args),
}));

// Stub the row sub-components so we can target them without their own deps
vi.mock('../MovementStatusBadge.jsx', () => ({
  MovementStatusBadge: ({ status }) => <span data-testid={`badge-${status}`}>{status}</span>,
}));
vi.mock('../PostingStatusDot.jsx', () => ({
  PostingStatusDot: ({ paymentStatus }) => <span data-testid={`posting-${paymentStatus}`} />,
}));
vi.mock('../MovementRowKebab.jsx', () => ({
  MovementRowKebab: ({ movement }) => <span data-testid={`kebab-${movement.id}`} />,
}));

import { MovementsTable } from '../MovementsTable.jsx';

const ROWS = [
  {
    id: 'm1',
    date: '2026-05-06T12:00:00.000Z',
    documentNo: 'DOC-001',
    contact: 'ACME',
    description: 'Compra mensual',
    paymentStatus: 'RPR',
    trxType: 'BPD',
    amount: 1000,
    balance: 5000,
    currencyIso: 'EUR',
  },
  {
    id: 'm2',
    date: '2026-05-07T12:00:00.000Z',
    documentNo: 'DOC-002',
    contact: 'Globex',
    description: 'Pago factura',
    paymentStatus: 'RPAP',
    trxType: 'BPW',
    amount: -250,
    balance: 4750,
    currencyIso: 'EUR',
  },
];

function renderTable(props = {}) {
  return render(
    <MovementsTable
      movements={ROWS}
      loading={false}
      selectedIds={new Set()}
      onSelectionChange={vi.fn()}
      {...props}
    />,
  );
}

describe('MovementsTable', () => {
  beforeEach(() => {
    toastFn.mockClear();
  });

  it('renders one row per movement with documentNo + contact + description', () => {
    renderTable();
    expect(screen.getByText('DOC-001')).toBeInTheDocument();
    expect(screen.getByText('DOC-002')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Compra mensual')).toBeInTheDocument();
  });

  it('renders the status badge for each row', () => {
    renderTable();
    expect(screen.getByTestId('badge-RPR')).toBeInTheDocument();
    expect(screen.getByTestId('badge-RPAP')).toBeInTheDocument();
  });

  it('renders the type-label fallback ("BPD" → financeAccountMovementsTypeBPD)', () => {
    renderTable();
    // useUI mock returns the key itself
    expect(screen.getByText('financeAccountMovementsTypeBPD')).toBeInTheDocument();
    expect(screen.getByText('financeAccountMovementsTypeBPW')).toBeInTheDocument();
  });

  it('prefers movement.typeLabel over the localized fallback when present', () => {
    renderTable({
      movements: [{ ...ROWS[0], typeLabel: 'Custom label' }],
    });
    expect(screen.getByText('Custom label')).toBeInTheDocument();
    expect(screen.queryByText('financeAccountMovementsTypeBPD')).not.toBeInTheDocument();
  });

  it('renders skeleton rows when loading=true and no real rows appear', () => {
    const { container } = renderTable({ loading: true, movements: [] });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('DOC-001')).not.toBeInTheDocument();
  });

  it('renders the empty-state row when there are no movements (and not loading)', () => {
    renderTable({ movements: [] });
    expect(screen.getByText('financeAccountMovementsEmpty')).toBeInTheDocument();
  });

  it('emits a toast when a data row is clicked', () => {
    renderTable();
    fireEvent.click(screen.getByText('DOC-001'));
    expect(toastFn).toHaveBeenCalledWith('financeAccountMovementsRowViewDetailToast');
  });

  it('toggles selection when a row checkbox is clicked (and does not also fire the row toast)', () => {
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange });
    // Checkboxes have role="checkbox"; the first one is the header "select all".
    const checkboxes = screen.getAllByRole('checkbox');
    // Index 1 is the first data row's checkbox.
    fireEvent.click(checkboxes[1]);
    expect(onSelectionChange).toHaveBeenCalledWith('m1');
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('header "select all" calls onSelectionChange for each unselected row', () => {
    const onSelectionChange = vi.fn();
    renderTable({ onSelectionChange });
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // header
    expect(onSelectionChange).toHaveBeenCalledTimes(ROWS.length);
    expect(onSelectionChange).toHaveBeenCalledWith('m1');
    expect(onSelectionChange).toHaveBeenCalledWith('m2');
  });
});
