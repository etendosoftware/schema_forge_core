import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a) => toastSuccess(...a),
    error: (...a) => toastError(...a),
  },
}));

const updateAccount = vi.fn();
const fetchDefaults = vi.fn();
vi.mock('@/hooks/useAccountMutations.js', () => ({
  useAccountMutations: () => ({ updateAccount, fetchDefaults }),
}));

import { EditAccountModal } from '../EditAccountModal.jsx';

const BANK_ACCOUNT = {
  id: 'acc-1',
  name: 'BBVA',
  type: 'B',
  iban: 'ES9121000418450200051332',
  currencyId: '102',
};

function renderModal(props = {}) {
  return render(
    <EditAccountModal
      open
      account={BANK_ACCOUNT}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      {...props}
    />,
  );
}

describe('EditAccountModal', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    updateAccount.mockReset();
    fetchDefaults.mockReset();
    fetchDefaults.mockResolvedValue({ currencies: [{ id: '102', iso: 'EUR' }] });
    updateAccount.mockResolvedValue({ id: 'acc-1', name: 'BBVA Renamed' });
  });

  it('returns null (renders nothing) when no account is given', () => {
    const { container } = render(<EditAccountModal open account={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a prefilled form without a BIC field (showBic=false)', async () => {
    renderModal();
    expect(screen.getByTestId('edit-account-modal')).toBeInTheDocument();
    expect(screen.getByTestId('account-form-name')).toHaveValue('BBVA');
    expect(screen.getByTestId('account-form-iban')).toHaveValue('ES9121000418450200051332');
    expect(screen.queryByTestId('account-form-bic')).not.toBeInTheDocument();
  });

  it('shows the disabled connection section for a bank account', () => {
    renderModal();
    expect(screen.getByTestId('edit-account-connection-disabled')).toBeInTheDocument();
  });

  it('hides the connection section for a cash account', () => {
    renderModal({ account: { id: 'acc-2', name: 'Caja', type: 'C', currencyId: '102' } });
    expect(screen.queryByTestId('edit-account-connection-disabled')).not.toBeInTheDocument();
    // cash account: no IBAN field
    expect(screen.queryByTestId('account-form-iban')).not.toBeInTheDocument();
  });

  it('saves with updateAccount(id, payload) and calls onSaved + onClose', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderModal({ onSaved, onClose });

    const nameInput = screen.getByTestId('account-form-name');
    await user.clear(nameInput);
    await user.type(nameInput, 'BBVA Renamed');
    await user.click(screen.getByTestId('account-form-submit'));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledTimes(1));
    const [id, payload] = updateAccount.mock.calls[0];
    expect(id).toBe('acc-1');
    expect(payload).toMatchObject({ name: 'BBVA Renamed', type: 'B', currencyId: '102' });
    // showBic=false → no swiftCode in the payload, so backend preserves it
    expect(payload).not.toHaveProperty('swiftCode');

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('financeAccountsEditSuccess');
  });

  it('shows the inline name-exists error on a 409 and does not close', async () => {
    const user = userEvent.setup();
    const err = new Error('dup');
    err.status = 409;
    updateAccount.mockRejectedValueOnce(err);
    const onSaved = vi.fn();
    renderModal({ onSaved });

    await user.click(screen.getByTestId('account-form-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('account-form-error')).toHaveTextContent(
        'financeAccountsNewNameExists',
      ),
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('toasts an error for a non-409 save failure', async () => {
    const user = userEvent.setup();
    const err = new Error('boom');
    err.status = 500;
    updateAccount.mockRejectedValueOnce(err);
    renderModal();

    await user.click(screen.getByTestId('account-form-submit'));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('boom'));
  });
});
