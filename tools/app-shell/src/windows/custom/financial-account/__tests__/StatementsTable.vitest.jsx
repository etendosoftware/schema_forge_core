import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

vi.mock('@/components/ui/status-tag', () => ({
  StatusTag: ({ tone, label }) => (
    <span data-testid={`status-${tone}`} data-label={label}>{label}</span>
  ),
}));

// Stub the heavy child — we cover it with its own test suite. The stub lets
// us assert that an expanded row mounts the inline lines view with the right id.
vi.mock('../StatementLinesInline', () => ({
  StatementLinesInline: ({ statementId, currency }) => (
    <div data-testid={`stub-inline-${statementId}`} data-currency={currency} />
  ),
}));

import { StatementsTable } from '../StatementsTable.jsx';

const ROWS = [
  {
    id: 's1', documentNo: 'BS-001', name: 'Mayo',
    importDate: '2026-05-15T08:00:00Z',
    transactionDate: '2026-05-14T00:00:00Z',
    lineCount: 5, matchedCount: 0, totalAmount: 1234.56, status: 'PENDING',
  },
  {
    id: 's2', documentNo: 'BS-002', name: 'Junio',
    periodFrom: '2026-06-01T00:00:00Z',
    periodTo: '2026-06-30T00:00:00Z',
    importDate: '2026-06-20T08:00:00Z',
    transactionDate: '2026-06-19T00:00:00Z',
    lineCount: 10, matchedCount: 4, totalAmount: -500, status: 'PARTIAL',
  },
  {
    id: 's3', documentNo: 'BS-003', name: 'Julio',
    importDate: '2026-07-01T08:00:00Z',
    transactionDate: '2026-07-01T00:00:00Z',
    lineCount: 3, matchedCount: 3, totalAmount: 0, status: 'RECONCILED',
  },
];

describe('StatementsTable', () => {
  it('renders one row per statement with documentNo + line counts', () => {
    render(<StatementsTable statements={ROWS} loading={false} />);
    expect(screen.getByTestId('statement-row-s1')).toBeInTheDocument();
    expect(screen.getByTestId('statement-row-s2')).toBeInTheDocument();
    expect(screen.getByText('BS-001')).toBeInTheDocument();
    expect(screen.getByText('BS-002')).toBeInTheDocument();
  });

  it('renders the empty state when there are no statements (and not loading)', () => {
    render(<StatementsTable statements={[]} loading={false} />);
    expect(screen.getByText('financeAccountStatementsEmpty')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading=true (no real rows)', () => {
    const { container } = render(<StatementsTable statements={[]} loading={true} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('financeAccountStatementsEmpty')).not.toBeInTheDocument();
  });

  it('maps PENDING → neutral, PARTIAL → warning, RECONCILED → success status tones', () => {
    render(<StatementsTable statements={ROWS} loading={false} />);
    expect(screen.getByTestId('status-neutral')).toBeInTheDocument();
    expect(screen.getByTestId('status-warning')).toBeInTheDocument();
    expect(screen.getByTestId('status-success')).toBeInTheDocument();
  });

  it('appends the matched/total counter to PARTIAL pill label', () => {
    render(<StatementsTable statements={ROWS} loading={false} />);
    const partial = screen.getByTestId('status-warning');
    // Label is the i18n key plus the " 4/10" suffix
    expect(partial.getAttribute('data-label')).toContain('4/10');
  });

  it('expands an accordion row on click and mounts the lines view for the row id', async () => {
    const user = userEvent.setup();
    render(<StatementsTable statements={ROWS} loading={false} currency="USD" />);

    expect(screen.queryByTestId('stub-inline-s1')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('statement-row-s1'));
    expect(screen.getByTestId('stub-inline-s1')).toBeInTheDocument();
    expect(screen.getByTestId('stub-inline-s1')).toHaveAttribute('data-currency', 'USD');
  });

  it('collapses an open row when clicked a second time', async () => {
    const user = userEvent.setup();
    render(<StatementsTable statements={ROWS} loading={false} />);
    const row = screen.getByTestId('statement-row-s1');

    await user.click(row);
    expect(screen.getByTestId('stub-inline-s1')).toBeInTheDocument();
    await user.click(row);
    expect(screen.queryByTestId('stub-inline-s1')).not.toBeInTheDocument();
  });

  it('only one row is expanded at a time (clicking another closes the previous)', async () => {
    const user = userEvent.setup();
    render(<StatementsTable statements={ROWS} loading={false} />);
    await user.click(screen.getByTestId('statement-row-s1'));
    expect(screen.getByTestId('stub-inline-s1')).toBeInTheDocument();

    await user.click(screen.getByTestId('statement-row-s2'));
    expect(screen.queryByTestId('stub-inline-s1')).not.toBeInTheDocument();
    expect(screen.getByTestId('stub-inline-s2')).toBeInTheDocument();
  });

  it('exposes accessible expand/collapse aria labels per row', () => {
    render(<StatementsTable statements={ROWS} loading={false} />);
    // 3 rows × 1 chevron each
    expect(
      screen.getAllByLabelText('financeAccountStatementsExpandAria').length,
    ).toBeGreaterThanOrEqual(1);
  });
});
