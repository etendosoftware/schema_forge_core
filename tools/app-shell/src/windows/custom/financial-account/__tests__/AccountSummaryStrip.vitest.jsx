import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      financeAccountDetailKpiBalance: 'Saldo total',
      financeAccountDetailKpiInflows: 'Entradas',
      financeAccountDetailKpiOutflows: 'Salidas',
      financeAccountDetailIbanCopied: 'IBAN copiado',
    };
    return map[key] ?? key;
  },
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args) => toastSuccess(...args) },
}));

// Stub AccountLogoAvatar so its dependency tree (icons) doesn't matter
vi.mock('@/components/financial-accounts/AccountLogoAvatar', () => ({
  AccountLogoAvatar: () => <div data-testid="avatar" />,
}));

import { AccountSummaryStrip } from '../AccountSummaryStrip.jsx';

const TOTALS = { balance: 1000, inflows: 500, outflows: -200, currency: 'EUR' };

describe('AccountSummaryStrip', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
  });

  it('renders skeletons when loading=true', () => {
    const { container } = render(
      <AccountSummaryStrip account={null} totals={TOTALS} loading={true} />,
    );
    // No KPI labels rendered while loading
    expect(screen.queryByText('Saldo total')).not.toBeInTheDocument();
    // Skeletons appear (animate-pulse class from Skeleton)
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders the three KPI labels and the IBAN row when not loading', () => {
    render(
      <AccountSummaryStrip
        account={{ iban: 'ES7012341234123412341234', name: 'BBVA' }}
        totals={TOTALS}
        loading={false}
      />,
    );
    expect(screen.getByText('Saldo total')).toBeInTheDocument();
    expect(screen.getByText('Entradas')).toBeInTheDocument();
    expect(screen.getByText('Salidas')).toBeInTheDocument();
    expect(screen.getByText('IBAN')).toBeInTheDocument();
  });

  it('formats the IBAN into 4-character groups', () => {
    render(
      <AccountSummaryStrip
        account={{ iban: 'ES7012341234123412341234' }}
        totals={TOTALS}
        loading={false}
      />,
    );
    expect(screen.getByText('ES70 1234 1234 1234 1234 1234')).toBeInTheDocument();
  });

  it('strips inner whitespace from the IBAN before chunking', () => {
    render(
      <AccountSummaryStrip
        account={{ iban: 'ES70 1234 1234 1234' }}
        totals={TOTALS}
        loading={false}
      />,
    );
    expect(screen.getByText('ES70 1234 1234 1234')).toBeInTheDocument();
  });

  it('renders an em dash when the account has no IBAN, and hides the copy button', () => {
    render(
      <AccountSummaryStrip
        account={{ name: 'Cash' }}
        totals={TOTALS}
        loading={false}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByLabelText('Copy IBAN')).not.toBeInTheDocument();
  });

  it('renders the copy button when the IBAN is present', () => {
    render(
      <AccountSummaryStrip
        account={{ iban: 'ES7000000000000000000000' }}
        totals={TOTALS}
        loading={false}
      />,
    );
    expect(screen.getByTestId('iban-copy-button')).toBeInTheDocument();
  });

  it('copies the IBAN to the clipboard and toasts on success', async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <AccountSummaryStrip
        account={{ iban: 'ES7012341234123412341234' }}
        totals={TOTALS}
        loading={false}
      />,
    );

    fireEvent.click(screen.getByTestId('iban-copy-button'));
    expect(writeText).toHaveBeenCalledWith('ES7012341234123412341234');

    // Wait for the .then() microtask
    await Promise.resolve();
    expect(toastSuccess).toHaveBeenCalledWith('IBAN copiado');
  });
});
