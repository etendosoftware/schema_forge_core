import { render, screen } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key, params = {}) => {
    if (key === 'financeAccountsPendingAccountsRow') {
      return `${params.count} cuentas`;
    }
    const map = {
      financeAccountsBalanceTitle: 'Saldo',
      financeAccountsBalanceInfo: 'Info',
      financeAccountsSyncUpdatedAgo: 'Actualizado',
      financeAccountsBalanceByCurrency: 'Por moneda',
      financeAccountsBalanceEmpty: 'Sin saldos',
      financeAccountsPendingTitle: 'Pendientes',
      financeAccountsPendingSuggestions: 'Sugerencias',
      financeAccountsPendingByRule: 'Por regla',
    };
    return map[key] ?? key;
  },
}));

import { AccountsSidebar } from '../index.jsx';

const baseSummary = {
  totalBalance: 1250.5,
  byCurrency: [
    { currencyIso: 'EUR', total: 1000 },
    { currencyIso: 'USD', total: 250.5 },
  ],
  pending: { accountsWithPending: 3, suggestionsReady: 2, byRule: 1 },
};

describe('AccountsSidebar', () => {
  it('renders the Saldo header and the formatted total balance', () => {
    render(<AccountsSidebar summary={baseSummary} loading={false} />);
    expect(screen.getByText('Saldo')).toBeInTheDocument();
    expect(screen.getByTestId('balance-card')).toBeInTheDocument();
  });

  it('renders one row per currency in the breakdown card', () => {
    render(<AccountsSidebar summary={baseSummary} loading={false} />);
    expect(screen.getByTestId('balance-by-currency-EUR')).toBeInTheDocument();
    expect(screen.getByTestId('balance-by-currency-USD')).toBeInTheDocument();
  });

  it('renders the three pending counters', () => {
    render(<AccountsSidebar summary={baseSummary} loading={false} />);
    const card = screen.getByTestId('pending-reconcile-card');
    expect(card).toHaveTextContent('3 cuentas');
    expect(card).toHaveTextContent('Sugerencias');
    expect(card).toHaveTextContent('Por regla');
  });

  it('shows an em-dash placeholder while loading is true', () => {
    render(<AccountsSidebar summary={null} loading={true} />);
    expect(screen.getByTestId('balance-card')).toHaveTextContent('—');
  });

  it('falls back to a single empty currency row when there are no accounts', () => {
    render(
      <AccountsSidebar
        summary={{ totalBalance: 0, byCurrency: [], pending: {} }}
        loading={false}
      />,
    );
    expect(screen.getByTestId('balance-by-currency-EUR')).toBeInTheDocument();
  });
});
