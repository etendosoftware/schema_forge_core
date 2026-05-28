import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/i18n', () => ({
  useUI: () => (key, params = {}) => {
    if (key === 'financeAccountsCount') return `${params.count} cuentas`;
    if (key === 'financeAccountsReconcilePending') return `Conciliar (${params.count})`;
    if (key === 'financeAccountsRulesToast') return 'Próximamente en T5 (ETP-4099)';
    return key;
  },
}));

vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

const mockUseFinancialAccounts = vi.fn();
vi.mock('@/hooks/useFinancialAccounts.js', () => ({
  useFinancialAccounts: () => mockUseFinancialAccounts(),
}));

vi.mock('@/hooks/useAccountMutations.js', () => ({
  useAccountMutations: () => ({
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    archiveAccount: vi.fn(),
    fetchDefaults: vi.fn().mockResolvedValue({ currencies: [], defaultCurrencyId: '' }),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import FinancialAccountsPage from '../FinancialAccountsPage.jsx';

const baseAccounts = [
  {
    id: 'acc-1',
    name: 'BBVA Principal',
    type: 'B',
    currentBalance: 1000,
    currencyIso: 'EUR',
    pendingCount: 3,
  },
  {
    id: 'acc-2',
    name: 'Caja Tienda',
    type: 'C',
    currentBalance: 50,
    currencyIso: 'EUR',
    pendingCount: 0,
  },
  {
    id: 'acc-3',
    name: 'Visa Corporate',
    type: 'T',
    currentBalance: -120,
    currencyIso: 'USD',
    pendingCount: 1,
  },
];

const baseSummary = {
  totalBalance: 930,
  byCurrency: [
    { currencyIso: 'EUR', total: 1050 },
    { currencyIso: 'USD', total: -120 },
  ],
  pending: { accountsWithPending: 2, suggestionsReady: 0, byRule: 0 },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <FinancialAccountsPage />
    </MemoryRouter>,
  );
}

describe('FinancialAccountsPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseFinancialAccounts.mockReset();
  });

  it('renders the toolbar, sidebar and all account rows', () => {
    mockUseFinancialAccounts.mockReturnValue({
      accounts: baseAccounts,
      summary: baseSummary,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();

    expect(screen.getByTestId('cuentas-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('cuentas-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('cuentas-card')).toBeInTheDocument();
    expect(screen.getByTestId('account-row-acc-1')).toBeInTheDocument();
    expect(screen.getByTestId('account-row-acc-2')).toBeInTheDocument();
    expect(screen.getByTestId('account-row-acc-3')).toBeInTheDocument();
  });

  it('filters the table by the active type', () => {
    mockUseFinancialAccounts.mockReturnValue({
      accounts: baseAccounts,
      summary: baseSummary,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();
    fireEvent.click(screen.getByTestId('account-type-filter-trigger'));
    fireEvent.click(screen.getByTestId('account-type-filter-option-c'));

    expect(screen.queryByTestId('account-row-acc-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-row-acc-2')).toBeInTheDocument();
    expect(screen.queryByTestId('account-row-acc-3')).not.toBeInTheDocument();
  });

  it('filters the table by the search term against the account name', () => {
    mockUseFinancialAccounts.mockReturnValue({
      accounts: baseAccounts,
      summary: baseSummary,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();
    fireEvent.change(screen.getByTestId('cuentas-search-input'), {
      target: { value: 'visa' },
    });

    expect(screen.queryByTestId('account-row-acc-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('account-row-acc-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-row-acc-3')).toBeInTheDocument();
  });

  it('navigates to the detail route when a row is clicked', () => {
    mockUseFinancialAccounts.mockReturnValue({
      accounts: baseAccounts,
      summary: baseSummary,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();
    fireEvent.click(screen.getByTestId('account-row-acc-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/financial-account/acc-1');
  });

  it('renders the "Nueva cuenta" button enabled and does not navigate when clicked', () => {
    mockUseFinancialAccounts.mockReturnValue({
      accounts: baseAccounts,
      summary: baseSummary,
      loading: false,
      error: null,
      reload: vi.fn(),
    });

    renderPage();
    const button = screen.getByTestId('cuentas-new-account-button');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    // Clicking opens the wizard modal, not a navigation.
    fireEvent.click(button);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
