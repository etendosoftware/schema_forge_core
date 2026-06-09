import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('@/components/ui/dialog.jsx', () => ({
  Dialog: ({ open, children }) => (open ? <div data-testid="change-password-dialog">{children}</div> : null),
  DialogContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

const changePassword = vi.fn();
vi.mock('../../pages/onboarding/onboardingApi.js', () => ({
  changePassword: (...a) => changePassword(...a),
}));
vi.mock('../copilot/copilotApi.js', () => ({
  detectBaseUrl: () => 'https://base',
}));

import { ChangePasswordDialog } from '../ChangePasswordDialog.jsx';

async function fillForm(user, { current = 'old', next = 'new', confirm = 'new' } = {}) {
  await user.type(screen.getByLabelText('onboardingCurrentPasswordLabel'), current);
  await user.type(screen.getByLabelText('onboardingNewPasswordLabel'), next);
  await user.type(screen.getByLabelText('onboardingConfirmPasswordLabel'), confirm);
}

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    changePassword.mockReset();
    localStorage.clear();
  });

  it('changes the password with the platform token and triggers onSuccess (logout)', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sf_platform_token', 'platform-token');
    changePassword.mockResolvedValue({ token: 'rotated' });
    const onSuccess = vi.fn();

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />);

    await fillForm(user);
    await user.click(screen.getByTestId('change-password-submit'));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith(fetch, 'https://base', 'platform-token', {
        currentPassword: 'old',
        newPassword: 'new',
        confirmPassword: 'new',
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('blocks submission and shows an error when passwords do not match', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />);

    await fillForm(user, { next: 'new', confirm: 'different' });
    await user.click(screen.getByTestId('change-password-submit'));

    expect(screen.getByText('onboardingCredentialsMustMatch')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows the server error and does not log out when the change fails', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sf_platform_token', 'platform-token');
    changePassword.mockRejectedValue({ userMessage: 'Wrong current password' });
    const onSuccess = vi.fn();

    render(<ChangePasswordDialog open onOpenChange={vi.fn()} onSuccess={onSuccess} />);

    await fillForm(user, { current: 'bad' });
    await user.click(screen.getByTestId('change-password-submit'));

    expect(await screen.findByText('Wrong current password')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
