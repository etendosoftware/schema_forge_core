import { render, screen } from '@testing-library/react';

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('@/lib/formatCurrency', () => ({
  formatCurrency: (_curr, val) => `$${Number(val || 0).toFixed(2)}`,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }) => <button>{children}</button>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/date-field', () => ({
  DateField: ({ value, onChange }) => (
    <input type="date" value={value || ''} onChange={(e) => onChange?.(e.target.value)} data-testid="date-field" />
  ),
}));

// --- Import under test ----------------------------------------------------

import InvoicePaymentModal from '../InvoicePaymentModal.jsx';

// --- Helpers --------------------------------------------------------------

const sampleInvoice = {
  id: 'inv-1',
  documentNo: 'INV-001',
  documentStatus: 'CO',
  grandTotalAmount: 1000,
  'currency$_identifier': 'USD',
  'paymentMethod$_identifier': 'Wire Transfer',
  businessPartner: 'bp-1',
};

const sampleInstallments = [
  {
    id: 'inst-1',
    finPaymentScheduleID: 'sched-1',
    amount: '1000',
    paidAmount: '0',
    outstandingAmount: '1000',
    dueDate: '2024-06-15',
  },
];

function renderModal(overrides = {}) {
  const defaults = {
    invoiceId: 'inv-1',
    invoiceData: sampleInvoice,
    specName: 'sales-invoice',
    token: 'tok',
    apiBaseUrl: '/api/sales-invoice',
    onClose: vi.fn(),
  };
  return { ...render(<InvoicePaymentModal {...defaults} {...overrides} />), props: { ...defaults, ...overrides } };
}

// --- Tests ----------------------------------------------------------------

describe('InvoicePaymentModal', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('paymentPlan')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: sampleInstallments } }),
        });
      }
      if (url.includes('invoicePayments')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: { data: [] } }),
        });
      }
      if (url.includes('invoiceAccounts')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [{ id: 'acc-1', label: 'Main Account' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the modal with invoice number', () => {
    renderModal();
    expect(screen.getByText('payments')).toBeInTheDocument();
  });

  it('shows the close button', () => {
    renderModal();
    expect(screen.getByText('close')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderModal();
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('displays installment after data loads', async () => {
    renderModal();
    await screen.findByText(/installment/);
    expect(screen.getByText(/installment/)).toBeInTheDocument();
  });

  it('shows paid and outstanding amounts in summary', async () => {
    renderModal();
    await screen.findByText(/installment/);
    // Summary shows paidAmount and outstandingLabel
    expect(screen.getByText(/paidAmount/)).toBeInTheDocument();
    expect(screen.getByText(/outstandingLabel/)).toBeInTheDocument();
  });

  it('shows register payment button for outstanding installments', async () => {
    renderModal();
    await screen.findByText(/registerPayment/);
    expect(screen.getByText(/registerPayment/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const { props } = renderModal();
    const closeBtn = screen.getByText('close');
    closeBtn.click();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { props, container } = renderModal();
    // The outermost div is the backdrop
    const backdrop = container.firstChild;
    backdrop.click();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('accepts an optional onPaymentAdded prop without error', () => {
    const onPaymentAdded = vi.fn();
    expect(() => renderModal({ onPaymentAdded })).not.toThrow();
  });
});
