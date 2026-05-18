import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ETP-4005 — verifies the inline validation flow added to PaymentRegisterForm.
// The fix has two layers:
//   1. The confirm button is disabled when date is empty, so the user cannot
//      submit a payment with no date in the first place.
//   2. handleSubmit (which still runs when the button is enabled) short-circuits
//      with a translated error for amount/account violations and surfaces
//      paymentRequestFailed when the backend returns !res.ok.

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('@/lib/formatCurrency', () => ({
  formatCurrency: (_curr, val) => `$${Number(val || 0).toFixed(2)}`,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value }) => <div data-testid="select" data-value={value || ''}>{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <div data-testid={`option-${value}`}>{children}</div>,
  SelectTrigger: ({ children }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/date-field', () => ({
  DateField: ({ value, onChange, className }) => (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      data-testid="date-field"
      data-classname={className || ''}
    />
  ),
}));

vi.mock('@/auth/useApiFetch.js', () => ({
  useApiFetch: () => () => Promise.resolve({ ok: true, json: async () => ({ items: [] }) }),
}));

import { PaymentRegisterForm } from '../InvoicePaymentModal.jsx';

const baseProps = {
  invoiceId: 'inv-1',
  invoiceData: { id: 'inv-1' },
  scheduleId: 'sched-1',
  outstanding: 500,
  currency: 'USD',
  specName: 'sales-invoice',
  onCancel: vi.fn(),
  onSuccess: vi.fn(),
};

function makeApiFetch(handlers) {
  return vi.fn(async (path) => {
    for (const [matcher, response] of handlers) {
      if (path.includes(matcher)) return response;
    }
    return { ok: true, json: async () => ({}) };
  });
}

function getConfirmButton() {
  const buttons = screen.getAllByRole('button');
  return buttons[buttons.length - 1];
}

describe('PaymentRegisterForm validation (ETP-4005)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Required-field UX ────────────────────────────────────────────────────

  it('renders the date label with a red required asterisk', () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);
    expect(screen.getByText('paymentDate')).toBeInTheDocument();
    const asterisk = screen.getByText('*');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveStyle({ color: '#dc2626' });
  });

  // ── Disabled-button guard ────────────────────────────────────────────────

  it('disables the confirm button when the date field is cleared', () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);

    const dateField = screen.getByTestId('date-field');
    fireEvent.change(dateField, { target: { value: '' } });

    expect(getConfirmButton()).toBeDisabled();
  });

  it('enables the confirm button once a date is provided', () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);

    const dateField = screen.getByTestId('date-field');
    fireEvent.change(dateField, { target: { value: '' } });
    expect(getConfirmButton()).toBeDisabled();
    fireEvent.change(dateField, { target: { value: '2025-01-15' } });
    expect(getConfirmButton()).not.toBeDisabled();
  });

  // ── handleSubmit branches that surface translated errors ──────────────────

  it('shows paymentAmountInvalid when submitting with amount <= 0', async () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} outstanding={0} apiFetch={apiFetch} />);

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByText('paymentAmountInvalid')).toBeInTheDocument();
    });
  });

  it('shows paymentAccountRequired when no account is selected', async () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);

    await waitFor(() => {
      expect(screen.queryByText('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByText('paymentAccountRequired')).toBeInTheDocument();
    });
  });

  it('shows paymentRequestFailed when the API responds with !res.ok and no body message', async () => {
    const apiFetch = makeApiFetch([
      ['invoiceAccounts', { ok: true, json: async () => ({ items: [{ id: 'acc-1', label: 'Main' }] }) }],
      ['registerPayment', { ok: false, json: async () => ({}) }],
    ]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);

    await waitFor(() => {
      expect(screen.queryByText('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(getConfirmButton());

    await waitFor(() => {
      expect(screen.getByText('paymentRequestFailed')).toBeInTheDocument();
    });
  });

  // ── DateField className wiring ───────────────────────────────────────────

  it('passes an empty className to DateField while the date is valid', () => {
    const apiFetch = makeApiFetch([['invoiceAccounts', { ok: true, json: async () => ({ items: [] }) }]]);
    render(<PaymentRegisterForm {...baseProps} apiFetch={apiFetch} />);

    expect(screen.getByTestId('date-field')).toHaveAttribute('data-classname', '');
  });
});
