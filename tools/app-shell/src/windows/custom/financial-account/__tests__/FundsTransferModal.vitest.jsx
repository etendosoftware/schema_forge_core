import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// i18n → identity so assertions can match on the key.
vi.mock('@/i18n', () => ({ useUI: () => (key) => key }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a) },
}));

// Accounts list backing the source prefill + destination options.
let ACCOUNTS = [];
vi.mock('@/hooks/useFinancialAccounts.js', () => ({
  useFinancialAccounts: () => ({ accounts: ACCOUNTS }),
}));

const transfer = vi.fn();
let transferring = false;
vi.mock('@/hooks/useCreateMovement', () => ({
  useFundsTransfer: () => ({ transfer, transferring }),
}));

vi.mock('@/hooks/useMovementLookups', () => ({
  useGLItemLookup: () => ({ results: [], loading: false }),
}));

// Render the dialog inline (no portal / pointer-events friction).
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children, ...p }) => <div {...p}>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

// Native field stand-ins so the form is drivable with fireEvent.
vi.mock('@/components/forms/fields', () => ({
  Field: ({ label, children }) => <label>{label}{children}</label>,
  ReadOnly: ({ children }) => <span data-testid="readonly">{children}</span>,
  Select: ({ value, onChange, options, name }) => (
    <select data-testid={`field-select-${name}`} value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}>
      <option value="" />
      {(options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
  AmountInput: ({ value, onChange, name }) => (
    <input data-testid={`field-number-${name}`} value={value ?? ''} onChange={onChange} />
  ),
  TextInput: ({ value, onChange, name }) => (
    <input data-testid={`field-text-${name}`} value={value ?? ''} onChange={onChange} />
  ),
  LookupPicker: () => <div data-testid="lookup-glitem" />,
}));

import { FundsTransferModal } from '../FundsTransferModal.jsx';

const SRC = { id: 'SRC', name: 'BBVA', currencyId: '102', currencyIso: 'EUR', currentBalance: 1000, active: true };
const DST = { id: 'DST', name: 'Santander', currencyId: '102', currencyIso: 'EUR', currentBalance: 0, active: true };
const USD = { id: 'USD', name: 'Chase', currencyId: '200', currencyIso: 'USD', currentBalance: 0, active: true };

function renderModal(props = {}) {
  return render(
    <FundsTransferModal sourceAccountId="SRC" onClose={vi.fn()} onSuccess={vi.fn()} {...props} />,
  );
}

describe('FundsTransferModal', () => {
  beforeEach(() => {
    ACCOUNTS = [SRC, DST, USD];
    transferring = false;
    transfer.mockReset();
    transfer.mockResolvedValue({});
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('prefills the source account (read-only) and lists other accounts as destinations', () => {
    renderModal();
    expect(screen.getByTestId('funds-transfer-modal')).toBeInTheDocument();
    expect(screen.getByText('BBVA')).toBeInTheDocument();
    const dest = screen.getByTestId('field-select-transfer-destination');
    const values = Array.from(dest.querySelectorAll('option')).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(['DST', 'USD']); // source excluded
  });

  it('keeps confirm disabled until a destination and a valid amount are set', () => {
    renderModal();
    const confirm = screen.getByTestId('transfer-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'DST' } });
    fireEvent.change(screen.getByTestId('field-number-transfer-amount'), { target: { value: '100' } });
    expect(confirm).not.toBeDisabled();
  });

  it('reveals the fee-amount field only when Bank Fee is checked', () => {
    renderModal();
    expect(screen.queryByTestId('field-number-transfer-bankfee-amount')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('checkbox-transfer-bankfee'));
    expect(screen.getByTestId('field-number-transfer-bankfee-amount')).toBeInTheDocument();
  });

  it('shows the Currency To field only when the destination currency differs', () => {
    renderModal();
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'DST' } });
    expect(screen.queryByTestId('field-text-transfer-rate')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'USD' } });
    expect(screen.getByTestId('field-text-transfer-rate')).toBeInTheDocument();
  });

  it('blocks a transfer above the source available balance', () => {
    renderModal();
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'DST' } });
    fireEvent.change(screen.getByTestId('field-number-transfer-amount'), { target: { value: '5000' } });
    expect(screen.getByTestId('transfer-balance-warning')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-confirm')).toBeDisabled();
  });

  it('posts the expected payload and reports success on confirm', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    renderModal({ onClose, onSuccess });
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'DST' } });
    fireEvent.change(screen.getByTestId('field-number-transfer-amount'), { target: { value: '100' } });
    fireEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(transfer).toHaveBeenCalledTimes(1));
    expect(transfer).toHaveBeenCalledWith({
      sourceAccountId: 'SRC',
      destinationAccountId: 'DST',
      amount: '100',
      description: 'financeAccountTransferDescriptionDefault',
      bankFee: false,
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('forwards the conversion rate on a multi-currency transfer', async () => {
    renderModal();
    fireEvent.change(screen.getByTestId('field-select-transfer-destination'), { target: { value: 'USD' } });
    fireEvent.change(screen.getByTestId('field-number-transfer-amount'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('field-text-transfer-rate'), { target: { value: '1.1' } });
    fireEvent.click(screen.getByTestId('transfer-confirm'));

    await waitFor(() => expect(transfer).toHaveBeenCalledTimes(1));
    expect(transfer.mock.calls[0][0]).toMatchObject({
      destinationAccountId: 'USD',
      amount: '100',
      conversionRate: '1.1',
    });
  });
});
