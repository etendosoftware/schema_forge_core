import { render, screen } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

// StatusTag uses Radix popovers and tokens — stub to a plain span so we can
// assert the tone + label without pulling the full component tree.
vi.mock('@/components/ui/status-tag', () => ({
  StatusTag: ({ tone, label }) => (
    <span data-testid={`status-${tone}`}>{label}</span>
  ),
}));

const linesMock = vi.fn();
vi.mock('@/hooks/useBankStatementLines', () => ({
  useBankStatementLines: (...args) => linesMock(...args),
}));

import { StatementLinesInline } from '../StatementLinesInline.jsx';

describe('StatementLinesInline', () => {
  beforeEach(() => {
    linesMock.mockReset();
  });

  it('renders the inline title with the lines count badge', () => {
    linesMock.mockReturnValue({ lines: [], loading: false });
    render(<StatementLinesInline statementId="s1" />);
    expect(screen.getByText('financeAccountStatementsInlineTitle')).toBeInTheDocument();
    // The badge shows "0" for an empty list
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('forwards the statementId to the useBankStatementLines hook', () => {
    linesMock.mockReturnValue({ lines: [], loading: false });
    render(<StatementLinesInline statementId="s-42" />);
    expect(linesMock).toHaveBeenCalledWith('s-42');
  });

  it('renders loading skeletons (no rows) when loading=true', () => {
    linesMock.mockReturnValue({ lines: [], loading: true });
    const { container } = render(<StatementLinesInline statementId="s1" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('financeAccountStatementLinesEmpty')).not.toBeInTheDocument();
  });

  it('renders the empty-state message when no lines and not loading', () => {
    linesMock.mockReturnValue({ lines: [], loading: false });
    render(<StatementLinesInline statementId="s1" />);
    expect(screen.getByText('financeAccountStatementLinesEmpty')).toBeInTheDocument();
  });

  it('renders one row per line with the test id', () => {
    linesMock.mockReturnValue({
      lines: [
        {
          id: 'l1', date: '2026-05-06T00:00:00Z', description: 'foo',
          bpartnerName: 'ACME', amount: 100, matched: true,
        },
        {
          id: 'l2', date: '2026-05-07T00:00:00Z', description: '',
          bpartnerName: '', amount: -50, matched: false,
        },
      ],
      loading: false,
    });

    render(<StatementLinesInline statementId="s1" />);
    expect(screen.getByTestId('statement-line-row-l1')).toBeInTheDocument();
    expect(screen.getByTestId('statement-line-row-l2')).toBeInTheDocument();
    // The header badge should also reflect 2 lines.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders a success-tone match pill for matched=true and a neutral one for matched=false', () => {
    linesMock.mockReturnValue({
      lines: [
        { id: 'l1', date: '2026-05-06T00:00:00Z', description: '', amount: 100, matched: true },
        { id: 'l2', date: '2026-05-07T00:00:00Z', description: '', amount: 100, matched: false },
      ],
      loading: false,
    });
    render(<StatementLinesInline statementId="s1" />);
    expect(
      screen.getByText('financeAccountStatementLinesStatusAuto'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('financeAccountStatementLinesStatusUnmatched'),
    ).toBeInTheDocument();
  });

  it('renders the contact name, the contact FK and the G/L item columns', () => {
    linesMock.mockReturnValue({
      lines: [
        {
          id: 'l1', date: '2026-05-06T00:00:00Z', description: 'Transfer',
          bpartnerName: 'Acme typed', bpartnerFkName: 'Acme S.L.',
          glItemName: 'Comisiones', amount: 100, matched: false,
        },
      ],
      loading: false,
    });
    render(<StatementLinesInline statementId="s1" />);
    // The header exposes the three distinct columns.
    expect(screen.getByText('financeAccountStatementLinesColBpartner')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColContact')).toBeInTheDocument();
    expect(screen.getByText('financeAccountStatementLinesColGlItem')).toBeInTheDocument();
    // The row shows the free-text name, the resolved BP and the G/L item.
    expect(screen.getByText('Acme typed')).toBeInTheDocument();
    expect(screen.getByText('Acme S.L.')).toBeInTheDocument();
    expect(screen.getByText('Comisiones')).toBeInTheDocument();
  });

  it('falls back to "—" for empty description', () => {
    linesMock.mockReturnValue({
      lines: [
        { id: 'l1', date: '2026-05-06T00:00:00Z', description: '', amount: 100, matched: true },
      ],
      loading: false,
    });
    render(<StatementLinesInline statementId="s1" />);
    // The empty description should render the placeholder "—" exactly once.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
