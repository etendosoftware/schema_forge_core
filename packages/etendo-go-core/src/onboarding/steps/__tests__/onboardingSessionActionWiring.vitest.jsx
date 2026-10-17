// @covers packages/etendo-go-core/src/onboarding/components/PageHeader.jsx
// @covers packages/etendo-go-core/src/onboarding/components/SetupProgressShell.jsx
// @covers packages/etendo-go-core/src/onboarding/components/OnboardingSessionAction.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/ProfileStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/CompanyStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/EnvSelectStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/SetupProgressStep.jsx
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4584 — every onboarding screen that holds a platform-account session must
 * offer the user a way out: one shared, accessible action (never a per-step
 * copy), in the page header, visible exactly when a session exists. The hard
 * part is the last one: on the provisioning screen the backend keeps working
 * after the user leaves, so a stream that finishes late must not silently open a
 * new environment session for someone who already logged out.
 *
 * Each guarantee is observed by rendering the real step with the network stubbed,
 * not by reading the step's source.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'es_ES', setLocale: null }),
}));

vi.mock('../../api.js', () => ({
  runOnboardingStream: vi.fn(),
  fetchEnvironments: vi.fn(async () => []),
  loginEnvironment: vi.fn(),
  isSessionLostError: () => false,
  AUTH_ERROR_UI_KEYS: {},
  resolveAuthErrorMessage: (ui, err, fallback) => fallback,
  loginAccount: vi.fn(),
  loginWithSsoProvider: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  fetchAccount: vi.fn(),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => [],
  renderSsoProviderButton: vi.fn(),
}));

const { PageHeader } = await import('../../components/PageHeader.jsx');
const { ProfileStep } = await import('../ProfileStep.jsx');
const { CompanyStep } = await import('../CompanyStep.jsx');
const { EnvSelectStep } = await import('../EnvSelectStep.jsx');
const { SetupProgressStep } = await import('../SetupProgressStep.jsx');
const api = await import('../../api.js');

const CONFIG = { apiBase: '', brandLabel: 'Etendo' };
/** The mocked useUI returns keys unchanged, so the action's label is this literal. */
const LOGOUT_LABEL = 'logout';

beforeEach(() => {
  vi.clearAllMocks();
  api.runOnboardingStream.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderProfile(props = {}) {
  return render(
    <ProfileStep
      config={CONFIG}
      stepData={{ fullName: 'Ada Lovelace', countryCode: 'ES' }}
      onNext={vi.fn()}
      onBack={vi.fn()}
      goToStep={vi.fn()}
      onChange={vi.fn()}
      setDraftNotice={vi.fn()}
      {...props}
    />,
  );
}

function renderCompany(props = {}) {
  return render(
    <CompanyStep
      config={CONFIG}
      stepData={{ businessType: 'company', clientName: 'Acme', fullName: 'Ada Lovelace' }}
      onNext={vi.fn()}
      onBack={vi.fn()}
      goToStep={vi.fn()}
      onChange={vi.fn()}
      setDraftNotice={vi.fn()}
      {...props}
    />,
  );
}

function renderEnvSelect(props = {}) {
  return render(
    <EnvSelectStep
      config={CONFIG}
      stepData={{}}
      token="platform-token"
      environments={[]}
      onLogout={vi.fn()}
      {...props}
    />,
  );
}

function renderSetupProgress(props = {}) {
  return render(
    <SetupProgressStep
      config={CONFIG}
      stepData={{ fullName: 'Ada Lovelace', clientName: 'Acme', countryCode: 'ES' }}
      token="platform-token"
      routeByEnvironments={vi.fn(async () => {})}
      onLogout={vi.fn()}
      {...props}
    />,
  );
}

/** The logout action sits above the step's own content (header, not body). */
function expectRenderedAbove(logout, element) {
  expect(logout.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe('onboarding session action wiring (ETP-4584)', () => {
  it('renders the shared action in the setup shell header of Profile and Company when a token exists', () => {
    for (const renderStep of [renderProfile, renderCompany]) {
      const onLogout = vi.fn();
      const view = renderStep({ token: 'platform-token', onLogout });

      const logout = screen.getByTestId('onboarding-logout');
      expect(logout).toHaveAccessibleName(LOGOUT_LABEL);
      expectRenderedAbove(logout, screen.getByRole('heading', { level: 1 }));

      fireEvent.click(logout);
      expect(onLogout).toHaveBeenCalledTimes(1);

      view.unmount();
    }
  });

  it('renders no session action in the setup steps without a token', () => {
    const profile = renderProfile();
    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
    expect(screen.queryByRole('button', { name: LOGOUT_LABEL })).toBeNull();
    profile.unmount();

    renderCompany();
    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
    expect(screen.queryByRole('button', { name: LOGOUT_LABEL })).toBeNull();
  });

  it('offers logout in PageHeader on authentication alone, with or without an account name', () => {
    const onLogout = vi.fn();

    const withName = render(
      <PageHeader
        isAuthenticated
        accountName="Ada Lovelace"
        onLogout={onLogout}
        logoutLabel={LOGOUT_LABEL}
        brandLabel="Etendo"
      />,
    );
    expect(screen.getByTestId('onboarding-logout')).toHaveAccessibleName(LOGOUT_LABEL);
    withName.unmount();

    // The action is tied to the session, not to knowing who the account is.
    render(
      <PageHeader
        isAuthenticated
        onLogout={onLogout}
        logoutLabel={LOGOUT_LABEL}
        brandLabel="Etendo"
      />,
    );
    const logout = screen.getByTestId('onboarding-logout');
    fireEvent.click(logout);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('hides the session action in PageHeader when there is no session', () => {
    render(
      <PageHeader
        isAuthenticated={false}
        accountName="Ada Lovelace"
        onLogout={vi.fn()}
        logoutLabel={LOGOUT_LABEL}
        brandLabel="Etendo"
      />,
    );

    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
    // The header itself still works — the brand is not what depends on the session.
    expect(screen.getByText('Etendo')).toBeTruthy();
  });

  it('keeps environment selection usable without account data, keyed on the platform token', () => {
    const onLogout = vi.fn();
    const withToken = render(
      <EnvSelectStep
        config={CONFIG}
        stepData={{}}
        token="platform-token"
        environments={[{ clientId: 'client-1', clientName: 'Acme', orgName: 'Acme Org' }]}
        onLogout={onLogout}
      />,
    );

    // No accountName was given at all: the step renders and can be acted on.
    expect(screen.getByText('onboardingEnvironmentsTitle')).toBeTruthy();
    expect(screen.getByTestId('action-enter-environment-client-1')).toBeTruthy();
    expect(screen.getByTestId('onboarding-logout')).toHaveAccessibleName(LOGOUT_LABEL);
    fireEvent.click(screen.getByTestId('onboarding-logout'));
    expect(onLogout).toHaveBeenCalledTimes(1);
    withToken.unmount();

    // Without the platform token there is no session to leave, but the step is
    // still usable — an account name alone must not resurrect the action.
    renderEnvSelect({ token: '', accountName: 'Ada Lovelace', environments: [] });
    expect(screen.getByText('onboardingEnvironmentsTitle')).toBeTruthy();
    expect(screen.getByText('onboardingNoEnvironments')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
  });

  it('keeps logout available during provisioning, outside the content it may cover', () => {
    renderSetupProgress();

    const logout = screen.getByTestId('onboarding-logout');
    expect(logout).toHaveAccessibleName(LOGOUT_LABEL);
    // Provisioning is under way: this is the "preparing" state, not a finished screen.
    expect(screen.getByText('onboardingPreparingTitle')).toBeTruthy();

    // The overlay ignores pointer events except on the action itself, so the
    // header can never swallow clicks meant for the card underneath.
    const actionWrapper = logout.parentElement;
    expect(actionWrapper.className).toContain('pointer-events-auto');
    const overlay = actionWrapper.parentElement;
    expect(overlay.className).toContain('pointer-events-none');
    expect(overlay.className).toContain('absolute');
    expect(overlay.className).toContain('top-0');
  });

  it('does not offer logout during provisioning when there is no token', () => {
    renderSetupProgress({ token: '' });

    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
    expect(screen.queryByRole('button', { name: LOGOUT_LABEL })).toBeNull();
  });

  it('never starts a new environment session from a stream that outlives logout', async () => {
    vi.useFakeTimers();
    let emitStreamMessage;
    let finishStream;
    api.runOnboardingStream.mockImplementation((fetchImpl, apiBase, token, payload, onMessage) => {
      emitStreamMessage = onMessage;
      return new Promise((resolve) => { finishStream = resolve; });
    });

    const onLogout = vi.fn();
    renderSetupProgress({ onLogout });

    expect(api.runOnboardingStream).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('onboarding-logout'));
    expect(onLogout).toHaveBeenCalledTimes(1);

    // The server cannot be cancelled: it reports success after the user left.
    await act(async () => {
      emitStreamMessage({ type: 'progress', step: 'client', status: 'success' });
      emitStreamMessage({ type: 'result', success: true });
      finishStream();
      await Promise.resolve();
    });
    // Give the auto-login countdown (2s, retried) every chance to fire.
    await act(async () => { vi.advanceTimersByTime(30_000); });

    // No environment login, no environment poll: nothing can hand a session to
    // the user who just logged out.
    expect(api.fetchEnvironments).not.toHaveBeenCalled();
    expect(api.loginEnvironment).not.toHaveBeenCalled();
  });

  // Control case for the test above: the exact same harness, without the logout.
  // Provisioning success DOES drive the auto-login, so "nothing happened" after a
  // logout is a real guard and not an inert stub.
  it('does start the environment session when the stream succeeds and the user stays', async () => {
    vi.useFakeTimers();
    let emitStreamMessage;
    let finishStream;
    api.runOnboardingStream.mockImplementation((fetchImpl, apiBase, token, payload, onMessage) => {
      emitStreamMessage = onMessage;
      return new Promise((resolve) => { finishStream = resolve; });
    });
    api.fetchEnvironments.mockResolvedValue([{ clientId: 'client-9' }]);
    api.loginEnvironment.mockResolvedValue({ status: 'failed' });

    renderSetupProgress();

    await act(async () => {
      emitStreamMessage({ type: 'result', success: true });
      finishStream();
      await Promise.resolve();
    });
    await act(async () => { vi.advanceTimersByTime(30_000); });
    await act(async () => { vi.advanceTimersByTime(30_000); });

    expect(api.fetchEnvironments).toHaveBeenCalled();
    expect(api.loginEnvironment).toHaveBeenCalledWith(
      expect.anything(),
      '',
      'platform-token',
      { clientId: 'client-9' },
    );
  });
});
