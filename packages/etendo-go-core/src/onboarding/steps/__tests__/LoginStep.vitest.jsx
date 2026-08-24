import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * ETP-4959 — component-level coverage for the ETP-4958 authentication
 * continuation contract.
 *
 * `LoginStep` has two authentication branches (password and SSO). ETP-4958 was
 * caused by them each owning a private copy of the post-auth continuation: only
 * the password copy learned about the caller-owned `onAuthenticated` prop, so an
 * SSO login on the invitation page authenticated and then stopped, stranding the
 * user on the login form.
 *
 * These tests render the real component and drive each branch end to end, so
 * re-inlining the continuation into either branch fails the suite. Unit tests on
 * the extracted helper cannot catch that — they never observe the wiring.
 */

const TOKEN = 'session-token';
const ACCOUNT = { name: 'Ada Lovelace', email: 'ada@example.com' };

// Captures the credential callback the component hands to the provider SDK, so
// a test can fire a successful SSO credential without a real Google button.
let ssoHandlers = null;

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  // No setLocale → the component skips the language selector entirely.
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => ['google'],
  renderSsoProviderButton: vi.fn(async (provider, container, handlers) => {
    ssoHandlers = handlers;
  }),
}));

vi.mock('../../api.js', () => ({
  AUTH_ERROR_UI_KEYS: {},
  loginAccount: vi.fn(async () => ({ token: TOKEN, account: ACCOUNT })),
  loginWithSsoProvider: vi.fn(async () => ({ token: TOKEN, account: ACCOUNT })),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  fetchAccount: vi.fn(),
  fetchEnvironments: vi.fn(),
}));

const { LoginStep } = await import('../LoginStep.jsx');

function renderLoginStep(props = {}) {
  const routeByEnvironments = vi.fn(async () => {});
  const setToken = vi.fn();
  const utils = render(
    <LoginStep
      config={{ apiBase: '', brandLabel: 'Etendo Go' }}
      stepData={{}}
      routeByEnvironments={routeByEnvironments}
      setToken={setToken}
      {...props}
    />,
  );
  return { ...utils, routeByEnvironments, setToken };
}

/** Drives the password branch to a successful login. */
async function submitPasswordLogin(container) {
  fireEvent.change(container.querySelector('#login-email'), {
    target: { value: ACCOUNT.email },
  });
  fireEvent.change(container.querySelector('#login-password'), {
    target: { value: 'correct horse battery staple' },
  });
  fireEvent.submit(screen.getByTestId('action-login-submit').closest('form'));
}

/** Drives the SSO branch to a successful login. */
async function completeSsoCredential() {
  await waitFor(() => expect(ssoHandlers).not.toBeNull());
  ssoHandlers.onCredential('google', { credential: 'google-jwt' });
}

describe('LoginStep authentication continuation (ETP-4958)', () => {
  beforeEach(() => {
    ssoHandlers = null;
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SSO branch', () => {
    it('hands control to the caller instead of routing by environments', async () => {
      const onAuthenticated = vi.fn(async () => {});
      const { routeByEnvironments } = renderLoginStep({ onAuthenticated });

      await completeSsoCredential();

      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
      expect(onAuthenticated).toHaveBeenCalledWith(TOKEN, ACCOUNT);
      expect(routeByEnvironments).not.toHaveBeenCalled();
    });

    // ETP-4576 changed WHERE the credential lands, not the ordering this test
    // exists to pin. It is never written to localStorage now — it is handed to
    // `setToken`, so that is what the callback observes. The auth-method key is
    // still asserted: it is metadata, not a credential, and UserAvatarButton
    // reads it to hide change-password from SSO users.
    it('persists the session before handing over', async () => {
      const seen = [];
      let setToken;
      const onAuthenticated = vi.fn(async () => {
        seen.push(setToken.mock.calls.map(([credential]) => credential));
      });
      ({ setToken } = renderLoginStep({ onAuthenticated }));

      await completeSsoCredential();

      await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
      expect(seen).toEqual([[TOKEN]]);
      expect(globalThis.localStorage.getItem('sf_platform_auth_method')).toBe('sso');
    });

    it('keeps the default environment routing when no caller takes over', async () => {
      const { routeByEnvironments } = renderLoginStep();

      await completeSsoCredential();

      await waitFor(() => expect(routeByEnvironments).toHaveBeenCalledTimes(1));
      expect(routeByEnvironments).toHaveBeenCalledWith(TOKEN);
    });
  });

  describe('password branch', () => {
    it('hands control to the caller instead of routing by environments', async () => {
      const onAuthenticated = vi.fn(async () => {});
      const { container, routeByEnvironments } = renderLoginStep({ onAuthenticated });

      await submitPasswordLogin(container);

      await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
      expect(onAuthenticated).toHaveBeenCalledWith(TOKEN, ACCOUNT);
      expect(routeByEnvironments).not.toHaveBeenCalled();
    });

    it('keeps the default environment routing when no caller takes over', async () => {
      const { container, routeByEnvironments } = renderLoginStep();

      await submitPasswordLogin(container);

      await waitFor(() => expect(routeByEnvironments).toHaveBeenCalledTimes(1));
      expect(routeByEnvironments).toHaveBeenCalledWith(TOKEN);
    });
  });

  it('applies the same continuation to both branches', async () => {
    // The regression was precisely that these two diverged, so assert the
    // observable outcome is identical rather than testing them in isolation.
    const ssoCaller = vi.fn(async () => {});
    const sso = renderLoginStep({ onAuthenticated: ssoCaller });
    await completeSsoCredential();
    await waitFor(() => expect(ssoCaller).toHaveBeenCalled());
    sso.unmount();

    const passwordCaller = vi.fn(async () => {});
    const password = renderLoginStep({ onAuthenticated: passwordCaller });
    await submitPasswordLogin(password.container);
    await waitFor(() => expect(passwordCaller).toHaveBeenCalled());

    expect(ssoCaller.mock.calls).toEqual(passwordCaller.mock.calls);
    expect(sso.routeByEnvironments).not.toHaveBeenCalled();
    expect(password.routeByEnvironments).not.toHaveBeenCalled();
  });
});
