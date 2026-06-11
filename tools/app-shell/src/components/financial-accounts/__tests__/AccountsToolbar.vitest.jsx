import { render, screen, fireEvent } from '@testing-library/react';

const toast = vi.fn();
vi.mock('sonner', () => ({
  toast: (...args) => toast(...args),
}));

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      financeAccountsFilterAll: 'Todas las cuentas',
      financeAccountsSearchPlaceholder: 'Buscar cuenta…',
      financeAccountsMatchingRules: 'Reglas de matcheo',
      financeAccountsNewAccount: 'Nueva cuenta',
      financeAccountsRulesToast: 'Próximamente en T5',
      financeAccountsTypeBank: 'Banco',
      financeAccountsTypeCash: 'Caja',
      financeAccountsTypeCard: 'Tarjeta',
    };
    return map[key] ?? key;
  },
}));

import { AccountsToolbar } from '../AccountsToolbar.jsx';

describe('AccountsToolbar', () => {
  beforeEach(() => {
    toast.mockReset();
  });

  it('renders the type filter, search input, matching rules and new account buttons', () => {
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('account-type-filter-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('cuentas-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('cuentas-matching-rules-button')).toBeInTheDocument();
    expect(screen.getByTestId('cuentas-new-account-button')).toBeInTheDocument();
  });

  it('reports search input changes back to the parent', () => {
    const onSearchChange = vi.fn();
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.change(screen.getByTestId('cuentas-search-input'), {
      target: { value: 'BBVA' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('BBVA');
  });

  it('fires a toast pointing to T5 when "Reglas de matcheo" is clicked', () => {
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('cuentas-matching-rules-button'));
    expect(toast).toHaveBeenCalledWith('Próximamente en T5');
  });

  it('hides the advanced ("by conditions") filter when no handler is wired', () => {
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('cuentas-advanced-filter')).not.toBeInTheDocument();
  });

  it('shows the advanced filter button with the active-conditions badge', () => {
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        advancedFilter={{ rowOperator: 'and', conditions: [{ field: 'type', operator: 'equals', value: 'B' }] }}
        onAdvancedFilterChange={vi.fn()}
        rows={[]}
      />,
    );
    const funnel = screen.getByTestId('cuentas-advanced-filter');
    expect(funnel).toBeInTheDocument();
    expect(funnel).toHaveTextContent('1');
  });

  it('keeps the "Nueva cuenta" button enabled with no click handler in T1', () => {
    render(
      <AccountsToolbar
        typeFilter={null}
        onTypeFilterChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    );
    const button = screen.getByTestId('cuentas-new-account-button');
    expect(button).not.toBeDisabled();
  });
});
