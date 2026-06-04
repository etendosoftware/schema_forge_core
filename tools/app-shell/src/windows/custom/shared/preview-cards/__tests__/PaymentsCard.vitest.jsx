vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/lib/dateOnly', () => ({
  formatCalendarDate: (_raw, _locale, _opts) => '1 Jan 2026',
}));

vi.mock('@/lib/formatAmount.js', () => ({
  formatAmount: (n) => String(n),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import PaymentsCard from '../PaymentsCard.jsx';

describe('PaymentsCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders section title via i18n key', () => {
    render(<PaymentsCard />);
    expect(screen.getByText('previewCardPayments')).toBeInTheDocument();
  });

  it('shows loading text when loading=true', () => {
    render(<PaymentsCard loading />);
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('shows no-payments message when payments empty and no outstanding', () => {
    render(<PaymentsCard payments={[]} totalOutstanding={0} />);
    expect(screen.getByText('previewCardNoPaymentsRecorded')).toBeInTheDocument();
  });

  it('shows add-payment button when canAddPayment=true', () => {
    const onAddPayment = vi.fn();
    render(<PaymentsCard canAddPayment onAddPayment={onAddPayment} payments={[]} totalOutstanding={100} />);
    const btn = screen.getByText('previewCardAddPayment');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAddPayment).toHaveBeenCalledTimes(1);
  });

  it('shows check icon when isFullyPaid=true and canAddPayment=false', () => {
    const { container } = render(<PaymentsCard isFullyPaid payments={[]} totalOutstanding={0} />);
    // Check icon from lucide renders as svg
    expect(container.querySelector('svg')).toBeInTheDocument();
    // No add-payment button
    expect(screen.queryByText('previewCardAddPayment')).toBeNull();
  });

  it('renders payment rows with accountName label', () => {
    const payments = [{ id: '1', amount: 200, paymentDate: '2026-01-01', accountName: 'Main Account' }];
    render(<PaymentsCard payments={payments} currencyCode="EUR" />);
    expect(screen.getByText('Main Account')).toBeInTheDocument();
    expect(screen.getByText('EUR 200')).toBeInTheDocument();
    expect(screen.getByText('1 Jan 2026')).toBeInTheDocument();
  });

  it('renders payment rows using documentNo fallback when accountName absent', () => {
    const payments = [{ id: '2', amount: 50, paymentDate: '2026-02-01', documentNo: '12345' }];
    render(<PaymentsCard payments={payments} currencyCode="USD" />);
    expect(screen.getByText('#12345')).toBeInTheDocument();
  });

  it('renders "—" when neither accountName nor documentNo present', () => {
    const payments = [{ id: '3', amount: 10, paymentDate: '2026-03-01' }];
    render(<PaymentsCard payments={payments} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows outstanding row when totalOutstanding > 0', () => {
    const payments = [{ id: '1', amount: 100, paymentDate: '2026-01-01', accountName: 'Acct' }];
    render(<PaymentsCard payments={payments} currencyCode="EUR" totalOutstanding={50} />);
    expect(screen.getByText('invoicePendingPayment')).toBeInTheDocument();
    expect(screen.getByText('EUR 50')).toBeInTheDocument();
  });

  it('does not show outstanding row when totalOutstanding is 0', () => {
    const payments = [{ id: '1', amount: 100, paymentDate: '2026-01-01', accountName: 'Acct' }];
    render(<PaymentsCard payments={payments} currencyCode="EUR" totalOutstanding={0} />);
    expect(screen.queryByText('invoicePendingPayment')).toBeNull();
  });
});
