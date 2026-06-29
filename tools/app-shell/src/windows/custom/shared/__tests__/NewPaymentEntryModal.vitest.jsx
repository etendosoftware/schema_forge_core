// Mocks must be hoisted before imports (Vitest hoisting)
vi.mock('@/i18n', () => ({
  useUI: () => (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : key),
}));

vi.mock('@/auth/useApiFetch.js', () => ({
  useApiFetch: vi.fn(),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ value, children }) => (
    <option data-testid="select-item" value={value}>{children}</option>
  ),
}));

vi.mock('@/components/ui/date-field', () => ({
  DateField: ({ value, onChange }) => (
    <input
      type="date"
      data-testid="date-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../paymentModalUi.jsx', () => ({
  DirBadge: ({ dir }) => <div data-testid={`dir-badge-${dir}`} />,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useApiFetch } from '@/auth/useApiFetch.js';
import NewPaymentEntryModal from '../NewPaymentEntryModal.jsx';

const INVOICE_DATA = {
  documentNo: 'INV-001',
  'businessPartner$_identifier': 'ACME Corp',
  'currency$_identifier': 'EUR',
};

function makeApiFetch(overrides = {}) {
  return vi.fn().mockImplementation((url) => {
    if (url.includes('invoiceAccounts')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: overrides.accounts ?? [{ id: 'acc1', label: 'Main Account', defaultPaymentMethod: null }] }),
      });
    }
    if (url.includes('invoicePaymentMethods')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: overrides.methods ?? [{ id: 'mth1', label: 'Transferencia' }] }),
      });
    }
    if (url.includes('invoiceCreditSources')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: overrides.sources ?? [] }),
      });
    }
    if (url.includes('paymentPlan')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: overrides.paymentPlan ?? [{ id: 'sch1', outstandingAmount: '500' }] } }),
      });
    }
    if (url.includes('registerPayment')) {
      return Promise.resolve({
        ok: overrides.saveOk ?? true,
        json: () => Promise.resolve(overrides.saveResult ?? { response: { data: {} } }),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  });
}

const DEFAULT_PROPS = {
  dir: 'in',
  specName: 'sales-invoice',
  invoiceId: '42',
  invoiceData: INVOICE_DATA,
  outstanding: 500,
  apiBaseUrl: 'http://host/sws/neo/sales-invoice',
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

describe('NewPaymentEntryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useApiFetch.mockReturnValue(makeApiFetch());
  });

  it('renders the modal container', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('cp-new-payment-modal')).toBeInTheDocument();
  });

  it('shows the direction badge for receipts', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} dir="in" />);
    expect(screen.getByTestId('dir-badge-in')).toBeInTheDocument();
  });

  it('shows the direction badge for payments', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} dir="out" />);
    expect(screen.getByTestId('dir-badge-out')).toBeInTheDocument();
  });

  it('renders the amount input pre-filled with the outstanding amount', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} outstanding={500} />);
    const input = screen.getByTestId('cp-amount-input');
    expect(input.value).toBe('500,00');
  });

  it('renders cancel button that calls onClose', () => {
    const onClose = vi.fn();
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('cp-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders the close × button that calls onClose', () => {
    const onClose = vi.fn();
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: 'close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders save-draft and confirm buttons', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('cp-save-draft')).toBeInTheDocument();
    expect(screen.getByTestId('cp-confirm')).toBeInTheDocument();
  });

  it('clicking equalize button does not crash', async () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} />);
    const eq = screen.getByTestId('cp-equalize');
    fireEvent.click(eq);
    // No error thrown; modal still visible
    expect(screen.getByTestId('cp-new-payment-modal')).toBeInTheDocument();
  });

  it('shows invoice docNo and partner in the header', () => {
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} />);
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText(/ACME Corp/)).toBeInTheDocument();
  });

  it('saves a draft and calls onSaved', async () => {
    const onSaved = vi.fn();
    useApiFetch.mockReturnValue(makeApiFetch());
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} scheduleId="sch1" onSaved={onSaved} />);

    await waitFor(() =>
      expect(screen.getByTestId('cp-save-draft')).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByTestId('cp-save-draft'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][1]).toBe('draft');
  });

  it('saves a confirmed payment and calls onSaved with "deposited"', async () => {
    const onSaved = vi.fn();
    useApiFetch.mockReturnValue(makeApiFetch());
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} scheduleId="sch1" onSaved={onSaved} />);

    await waitFor(() =>
      expect(screen.getByTestId('cp-confirm')).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByTestId('cp-confirm'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][1]).toBe('deposited');
  });

  it('shows an error when save fails', async () => {
    useApiFetch.mockReturnValue(
      makeApiFetch({ saveOk: false, saveResult: { response: { error: { message: 'Server error' } } } }),
    );
    render(<NewPaymentEntryModal {...DEFAULT_PROPS} scheduleId="sch1" />);

    await waitFor(() =>
      expect(screen.getByTestId('cp-save-draft')).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByTestId('cp-save-draft'));

    await waitFor(() =>
      expect(screen.getByText('Server error')).toBeInTheDocument(),
    );
  });
});
