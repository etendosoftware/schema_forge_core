import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => {
    if (params && typeof params === 'object') {
      return Object.entries(params).reduce((s, [k, v]) => s.replace(`{${k}}`, v), key);
    }
    return key;
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, ...rest }) => <div {...rest}>{children}</div>,
  DialogTitle: ({ children, ...rest }) => <h2 {...rest}>{children}</h2>,
}));

vi.mock('@/components/ui/money-amount', () => ({
  MoneyAmount: ({ value }) => <span>{value}</span>,
}));

const applyMock = vi.fn();
vi.mock('@/hooks/useReconciliation', () => ({
  useApplySuggestions: () => ({ apply: applyMock, loading: false, error: null }),
}));

// --- Import under test (after mocks) ----------------------------------------

import { AutoMatchSuggestionModal } from '../AutoMatchSuggestionModal.jsx';
import { toast } from 'sonner';

// --- Fixtures ---------------------------------------------------------------

const GROUP_STANDARD = {
  groupKey: 'line-1-txn-1',
  statementLine: { id: 'line-1', description: 'Bank commission fee', amount: -15 },
  operations: [{ id: 'txn-1', documentNo: 'PAY-001', amount: -15, isNew: false }],
  origin: 'standard',
  isNew: false,
  difference: 0,
};

const GROUP_RULE = {
  groupKey: 'line-2-rule-r1',
  statementLine: { id: 'line-2', description: 'PAGO IMPUESTOS', amount: -50 },
  operations: [{ id: 'new', glItemId: 'GL-001', amount: -50, isNew: true }],
  origin: 'rule',
  ruleName: 'Impuestos',
  isNew: true,
  difference: 0,
  createPayment: { ruleId: 'r1', glItemId: 'GL-001', bpartnerId: '', amount: -50 },
};

const KPIS = { pendingLines: 10, groupsFound: 2, opsToLink: 1, willCreate: 1 };

function renderModal(overrides = {}) {
  const defaults = {
    accountId: 'acc-1',
    groups: [GROUP_STANDARD, GROUP_RULE],
    kpis: KPIS,
    currency: 'EUR',
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };
  return { ...render(<AutoMatchSuggestionModal {...defaults} {...overrides} />), props: { ...defaults, ...overrides } };
}

// --- Tests ------------------------------------------------------------------

describe('AutoMatchSuggestionModal', () => {
  beforeEach(() => {
    applyMock.mockReset().mockResolvedValue({});
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it('renders nothing when open is false', () => {
    const { container } = renderModal({ open: false });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders the modal title', () => {
    renderModal();
    expect(screen.getByText('financeReconcileAutomatchModalTitle')).toBeInTheDocument();
  });

  it('shows KPI values', () => {
    renderModal();
    expect(screen.getByText('10')).toBeInTheDocument(); // pendingLines
    expect(screen.getByText('2')).toBeInTheDocument();  // groupsFound
  });

  it('renders groups for both standard and rule origins', () => {
    renderModal();
    expect(screen.getByText('Bank commission fee')).toBeInTheDocument();
    expect(screen.getByText('PAGO IMPUESTOS')).toBeInTheDocument();
  });

  it('shows "By rule" badge for rule-origin groups', () => {
    renderModal();
    expect(screen.getByText(/financeReconcileAutomatchBadgeByRule/)).toBeInTheDocument();
    expect(screen.getByText('Impuestos', { exact: false })).toBeInTheDocument();
  });

  it('shows "New" badge on rule group with isNew=true', () => {
    renderModal();
    expect(screen.getByText('financeReconcileAutomatchBadgeNew')).toBeInTheDocument();
  });

  it('all groups are checked by default', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it('unchecking a group removes it from the apply payload', async () => {
    const { props } = renderModal();
    const [firstCheckbox] = screen.getAllByRole('checkbox');
    fireEvent.click(firstCheckbox);

    const applyBtn = screen.getByTestId('automatch-modal-apply');
    fireEvent.click(applyBtn);

    await vi.waitFor(() => expect(applyMock).toHaveBeenCalledTimes(1));
    const payload = applyMock.mock.calls[0][0];
    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].statementLineId).toBe('line-2');
  });

  it('apply button is disabled when no groups are checked', () => {
    renderModal({ groups: [GROUP_STANDARD] });
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const applyBtn = screen.getByTestId('automatch-modal-apply');
    expect(applyBtn).toBeDisabled();
  });

  it('calls apply and onSuccess on successful reconciliation', async () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByTestId('automatch-modal-apply'));
    await vi.waitFor(() => expect(applyMock).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(props.onSuccess).toHaveBeenCalledTimes(1));
  });

  it('shows error toast when apply fails', async () => {
    applyMock.mockRejectedValue(new Error('Server error'));
    renderModal();
    fireEvent.click(screen.getByTestId('automatch-modal-apply'));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('calls onClose when cancel is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByTestId('automatch-modal-cancel'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no groups', () => {
    renderModal({ groups: [] });
    expect(screen.getByText('financeReconcileAutomatchEmpty')).toBeInTheDocument();
  });

  it('passes createPayment spec for rule groups', async () => {
    renderModal({ groups: [GROUP_RULE] });
    fireEvent.click(screen.getByTestId('automatch-modal-apply'));
    await vi.waitFor(() => expect(applyMock).toHaveBeenCalledTimes(1));
    const payload = applyMock.mock.calls[0][0];
    const group = payload.groups[0];
    expect(group.createPayment).toBeDefined();
    expect(group.createPayment.glItemId).toBe('GL-001');
  });

  it('standard groups do not include createPayment', async () => {
    renderModal({ groups: [GROUP_STANDARD] });
    fireEvent.click(screen.getByTestId('automatch-modal-apply'));
    await vi.waitFor(() => expect(applyMock).toHaveBeenCalledTimes(1));
    const payload = applyMock.mock.calls[0][0];
    expect(payload.groups[0].createPayment).toBeUndefined();
  });
});
