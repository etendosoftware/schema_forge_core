import { render, screen, fireEvent, within } from '@testing-library/react';

// i18n translator returns the key itself, so we assert on key strings.
vi.mock('@/i18n', () => ({
  useUI: () => (k) => k,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

// Stub the leaf cell components — their internals are out of scope here.
vi.mock('../MovementStatusBadge', () => ({
  MovementStatusBadge: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../PostingStatusDot', () => ({
  PostingStatusDot: () => <span data-testid="posting-dot" />,
}));
vi.mock('../MovementRowKebab', () => ({
  MovementRowKebab: () => <span data-testid="row-kebab" />,
}));
vi.mock('@/components/ui/money-amount', () => ({
  MoneyAmount: ({ value }) => <span data-testid="money">{String(value)}</span>,
}));

import { MovementsTable } from '../MovementsTable.jsx';

const baseMovement = (over = {}) => ({
  id: 'm1',
  date: '2026-05-10',
  documentNo: 'DOC-001',
  contact: 'ACME',
  description: 'office',
  paymentStatus: 'RPR',
  trxType: 'BPD',
  glItem: 'EXP',
  amount: 100,
  balance: 1000,
  currencyIso: 'EUR',
  dimensions: {},
  ...over,
});

function renderTable(props = {}) {
  return render(
    <MovementsTable
      movements={props.movements ?? [baseMovement()]}
      loading={props.loading ?? false}
      enabledDimensions={props.enabledDimensions ?? []}
      selectedIds={props.selectedIds ?? new Set()}
      onSelectionChange={props.onSelectionChange ?? vi.fn()}
    />,
  );
}

describe('MovementsTable — payment link', () => {
  beforeEach(() => navigate.mockClear());

  it('navigates to payment-in for a receipt payment', () => {
    renderTable({
      movements: [baseMovement({ paymentId: 'pay-1', paymentIsReceipt: 'Y' })],
    });
    fireEvent.click(screen.getByText('DOC-001'));
    expect(navigate).toHaveBeenCalledWith('/payment-in/pay-1');
  });

  it('navigates to payment-out for a non-receipt payment', () => {
    renderTable({
      movements: [baseMovement({ paymentId: 'pay-2', paymentIsReceipt: 'N' })],
    });
    fireEvent.click(screen.getByText('DOC-001'));
    expect(navigate).toHaveBeenCalledWith('/payment-out/pay-2');
  });

  it('renders documentNo as plain text (no navigation) when there is no paymentId', () => {
    renderTable({ movements: [baseMovement({ paymentId: undefined })] });
    const docCell = screen.getByText('DOC-001');
    expect(docCell.tagName).toBe('SPAN');
    fireEvent.click(docCell);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('MovementsTable — expandable dimensions panel', () => {
  it('renders no expand control when enabledDimensions is empty', () => {
    renderTable({ enabledDimensions: [] });
    expect(screen.queryByTestId('movement-expand-m1')).not.toBeInTheDocument();
  });

  it('expands and collapses the more-info panel on click', () => {
    renderTable({
      enabledDimensions: ['project'],
      movements: [baseMovement({ dimensions: { project: 'Proj A' } })],
    });
    const expand = screen.getByTestId('movement-expand-m1');
    expect(screen.queryByTestId('movement-moreinfo-m1')).not.toBeInTheDocument();

    fireEvent.click(expand);
    expect(screen.getByTestId('movement-moreinfo-m1')).toBeInTheDocument();

    fireEvent.click(expand);
    expect(screen.queryByTestId('movement-moreinfo-m1')).not.toBeInTheDocument();
  });

  it('shows enabled dimensions (even empty) as read-only fields, excluding bpartner', () => {
    renderTable({
      enabledDimensions: ['project', 'costcenter', 'campaign', 'bpartner'],
      movements: [
        baseMovement({
          dimensions: {
            project: 'Proj A',
            costcenter: '', // enabled but empty → still shown as an empty field
            campaign: 'Camp Z',
            bpartner: 'Should Not Show', // excluded — it has its own Contacto column
          },
        }),
      ],
    });
    fireEvent.click(screen.getByTestId('movement-expand-m1'));
    const panel = screen.getByTestId('movement-moreinfo-m1');

    // Values now render as disabled read-only inputs, so assert by display value.
    expect(within(panel).getByDisplayValue('Proj A')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('Camp Z')).toBeInTheDocument();
    expect(within(panel).getByDisplayValue('Proj A')).toBeDisabled();
    expect(within(panel).queryByDisplayValue('Should Not Show')).not.toBeInTheDocument();
    // Every enabled non-bpartner dimension renders its label — even the empty one.
    expect(within(panel).getByText('financeAccountMovementsDimProject')).toBeInTheDocument();
    expect(within(panel).getByText('financeAccountMovementsDimCampaign')).toBeInTheDocument();
    expect(within(panel).getByText('financeAccountMovementsDimCostcenter')).toBeInTheDocument();
    // bpartner is never rendered in the panel.
    expect(within(panel).queryByText('financeAccountMovementsDimBpartner')).not.toBeInTheDocument();
  });

  it('shows the no-dimensions message when the only enabled dimension is bpartner', () => {
    renderTable({
      enabledDimensions: ['bpartner'],
      movements: [baseMovement({ dimensions: { bpartner: 'Acme' } })],
    });
    fireEvent.click(screen.getByTestId('movement-expand-m1'));
    const panel = screen.getByTestId('movement-moreinfo-m1');
    expect(within(panel).getByText('financeAccountMovementsNoDimensions')).toBeInTheDocument();
  });
});

describe('MovementsTable — selection', () => {
  it('reflects selectedIds and calls onSelectionChange for a row checkbox', () => {
    const onSelectionChange = vi.fn();
    renderTable({
      movements: [baseMovement({ id: 'm1' })],
      selectedIds: new Set(['m1']),
      onSelectionChange,
    });
    const checkboxes = screen.getAllByRole('checkbox');
    // [0] = header select-all, [1] = the single row checkbox.
    const rowCheckbox = checkboxes[1];
    expect(rowCheckbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(rowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith('m1');
  });

  it('header select-all is indeterminate and toggles only the unselected rows', () => {
    const onSelectionChange = vi.fn();
    renderTable({
      movements: [
        baseMovement({ id: 'm1' }),
        baseMovement({ id: 'm2' }),
        baseMovement({ id: 'm3' }),
      ],
      selectedIds: new Set(['m1']), // partially selected
      onSelectionChange,
    });
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'mixed');

    fireEvent.click(headerCheckbox);
    // Toggles only the currently-unselected rows: m2 and m3.
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(onSelectionChange).toHaveBeenCalledWith('m2');
    expect(onSelectionChange).toHaveBeenCalledWith('m3');
    expect(onSelectionChange).not.toHaveBeenCalledWith('m1');
  });

  it('header select-all deselects every row when all are selected', () => {
    const onSelectionChange = vi.fn();
    renderTable({
      movements: [baseMovement({ id: 'm1' }), baseMovement({ id: 'm2' })],
      selectedIds: new Set(['m1', 'm2']),
      onSelectionChange,
    });
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    expect(headerCheckbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(headerCheckbox);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(onSelectionChange).toHaveBeenCalledWith('m1');
    expect(onSelectionChange).toHaveBeenCalledWith('m2');
  });

  it('clicking a row checkbox does not navigate (stopPropagation on the cell)', () => {
    const onSelectionChange = vi.fn();
    renderTable({
      movements: [baseMovement({ id: 'm1', paymentId: 'pay-1', paymentIsReceipt: 'Y' })],
      enabledDimensions: ['project'],
      onSelectionChange,
    });
    navigate.mockClear();
    const rowCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(rowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith('m1');
    expect(navigate).not.toHaveBeenCalled();
    // Expand panel should not open from the checkbox click either.
    expect(screen.queryByTestId('movement-moreinfo-m1')).not.toBeInTheDocument();
  });
});
