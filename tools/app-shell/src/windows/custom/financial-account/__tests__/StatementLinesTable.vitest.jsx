import { render, screen } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

// Stub MoneyAmount so we can assert on the value/currency pair without
// formatter quirks.
vi.mock('@/components/ui/money-amount', () => ({
  MoneyAmount: ({ value, currency, tone }) => (
    <span data-testid={`money-${value}-${currency}-${tone}`}>{`${value} ${currency}`}</span>
  ),
}));

import { StatementLinesTable } from '../StatementLinesTable.jsx';

const LINES = [
  {
    id: 'l1', lineNo: 1, date: '2026-05-06T12:00:00.000Z',
    description: 'Compra mensual', reference: 'REF-1', bpartnerName: 'ACME',
    amount: 1000, matched: true,
  },
  {
    id: 'l2', lineNo: 2, date: '2026-05-07T12:00:00.000Z',
    description: '', reference: '', bpartnerName: '',
    amount: -250, matched: false,
  },
];

describe('StatementLinesTable', () => {
  it('renders the column headers (i18n keys)', () => {
    render(<StatementLinesTable lines={[]} loading={false} />);
    expect(screen.getByText('financeAccountStatementLinesColLineNo')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColDate')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColDescription')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColReference')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColBpartner')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColAmount')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColMatched')).toBeInTheDocument();
  });

  it('renders the empty-state row when there are no lines and not loading', () => {
    render(<StatementLinesTable lines={[]} loading={false} />);
    expect(screen.getByText('financeAccountStatementLinesEmpty')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading=true (no data rows)', () => {
    const { container } = render(<StatementLinesTable lines={[]} loading={true} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('financeAccountStatementLinesEmpty')).not.toBeInTheDocument();
  });

  it('renders one row per line with line number, reference, bpartner', () => {
    render(<StatementLinesTable lines={LINES} loading={false} />);
    expect(screen.getByTestId('statement-line-row-l1')).toBeInTheDocument();
    expect(screen.getByTestId('statement-line-row-l2')).toBeInTheDocument();
    expect(screen.getByText('REF-1')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('shows "—" placeholders for empty description / reference / bpartner', () => {
    render(<StatementLinesTable lines={LINES} loading={false} />);
    // Three "—" should appear in row l2 (description, reference, bpartner)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a MoneyAmount with tone="auto" for each line', () => {
    render(<StatementLinesTable lines={LINES} loading={false} currency="USD" />);
    expect(screen.getByTestId('money-1000-USD-auto')).toBeInTheDocument();
    expect(screen.getByTestId('money--250-USD-auto')).toBeInTheDocument();
  });

  it('passes through the EUR currency by default', () => {
    render(<StatementLinesTable lines={LINES} loading={false} />);
    expect(screen.getByTestId('money-1000-EUR-auto')).toBeInTheDocument();
  });

  it('exposes the matched aria-label for each line', () => {
    render(<StatementLinesTable lines={LINES} loading={false} />);
    expect(
      screen.getByLabelText('financeAccountStatementLinesMatchedYes'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('financeAccountStatementLinesMatchedNo'),
    ).toBeInTheDocument();
  });
});
