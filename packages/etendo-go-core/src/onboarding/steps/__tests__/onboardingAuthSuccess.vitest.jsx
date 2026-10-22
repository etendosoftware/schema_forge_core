// @covers packages/etendo-go-core/src/onboarding/steps/LoginStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
// @covers packages/etendo-go-core/src/onboarding/postAuth.js
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4576 / ETP-4958 — the post-authentication continuation of LoginStep and
 * RegisterStep.
 *
 * The node --test version asserted the SOURCE TEXT of both steps: the
 * `handleAuthSuccess` signature, `csrfToken ?? token` inside each handler, the
 * `localStorage.removeItem('sf_platform_auth_method')` that had to disappear.
 * Every one of those is a change detector — it passes even when the branch is
 * unreachable. Here the real components are rendered, '../../api.js' and
 * '../../sso.js' are mocked, and the assertions are on the calls the steps make
 * (setToken, the caller continuation, the register handler) and on what
 * localStorage actually holds afterwards.
 */

let ssoHandlers = null;

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => ['google'],
  renderSsoProviderButton: vi.fn(async (provider, container, handlers) => {
    ssoHandlers = handlers;
  }),
}));

const TOKEN = 'session-token';
const CSRF_TOKEN = 'csrf-proof';
const ACCOUNT = { name: 'Ada Lovelace', email: 'ada@example.com' };
const STRONG_PASSWORD = 'Str0ng!Pass';

const api = {
  loginAccount: vi.fn(async () => ({ token: TOKEN, account: ACCOUNT })),
  loginWithSsoProvider: vi.fn(async () => ({ token: TOKEN, account: ACCOUNT })),
  registerAccount: vi.fn(async () => ({ csrfToken: CSRF_TOKEN, account: ACCOUNT })),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(async () => ({ status: 'success' })),
  fetchAccount: vi.fn(),
  fetchEnvironments: vi.fn(async () => []),
};

vi.mock('../../api.js', () => ({
  AUTH_ERROR_UI_KEYS: {},
  resolveAuthErrorMessage: (ui, err, fallbackKey) => ui(err?.code || fallbackKey),
  loginAccount: (...args) => api.loginAccount(...args),
  loginWithSsoProvider: (...args) => api.loginWithSsoProvider(...args),
  registerAccount: (...args) => api.registerAccount(...args),
  requestPasswordReset: (...args) => api.requestPasswordReset(...args),
  confirmPasswordReset: (...args) => api.confirmPasswordReset(...args),
  fetchAccount: (...args) => api.fetchAccount(...args),
  fetchEnvironments: (...args) => api.fetchEnvironments(...args),
}));

const { LoginStep } = await import('../LoginStep.jsx');
const { RegisterStep } = await import('../RegisterStep.jsx');

/** Every key/value currently in localStorage, to prove a credential never lands there. */
function storedPairs() {
  const pairs = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    pairs.push([key, localStorage.getItem(key)]);
  }
  return pairs;
}

function credentialIsStored(credential) {
  return storedPairs().some(([key, value]) => key === 'sf_platform_token' || value === credential);
}

function renderLoginStep(props = {}) {
  const routeByEnvironments = props.routeByEnvironments || vi.fn(async () => {});
  const setToken = props.setToken || vi.fn();
  const setAccountName = props.setAccountName || vi.fn();
  const utils = render(
    <LoginStep
      config={{ apiBase: '', brandLabel: 'Etendo' }}
      stepData={{}}
      routeByEnvironments={routeByEnvironments}
      setToken={setToken}
      setAccountName={setAccountName}
      {...props}
    />,
  );
  return { ...utils, routeByEnvironments, setToken, setAccountName };
}

function renderRegisterStep(props = {}) {
  const setToken = props.setToken || vi.fn();
  const setAccountName = props.setAccountName || vi.fn();
  const utils = render(
    <RegisterStep
      config={{ apiBase: '', brandLabel: 'Etendo' }}
      stepData={{}}
      setToken={setToken}
      setAccountName={setAccountName}
      {...props}
    />,
  );
  return { ...utils, setToken, setAccountName };
}

async function submitPasswordLogin(container) {
  fireEvent.change(container.querySelector('#login-email'), {
    target: { value: ACCOUNT.email },
  });
  fireEvent.change(container.querySelector('#login-password'), {
    target: { value: 'correct horse battery staple' },
  });
  await act(async () => {
    fireEvent.submit(screen.getByTestId('action-login-submit').closest('form'));
  });
}

async function fillAndSubmitRegistration(container) {
  fireEvent.change(container.querySelector('#reg-name'), { target: { value: ACCOUNT.name } });
  fireEvent.change(container.querySelector('#reg-email'), { target: { value: ACCOUNT.email } });
  fireEvent.change(container.querySelector('#reg-password'), { target: { value: STRONG_PASSWORD } });
  await act(async () => {
    fireEvent.submit(screen.getByTestId('action-register-submit').closest('form'));
  });
}

async function completeSsoCredential(payload = { credential: 'google-jwt' }) {
  await waitFor(() => expect(ssoHandlers).not.toBeNull());
  await act(async () => {
    ssoHandlers.onCredential('google', payload);
  });
}

beforeEach(() => {
  ssoHandlers = null;
  localStorage.clear();
  api.loginAccount.mockReset().mockResolvedValue({ token: TOKEN, account: ACCOUNT });
  api.loginWithSsoProvider.mockReset().mockResolvedValue({ token: TOKEN, account: ACCOUNT });
  api.registerAccount.mockReset().mockResolvedValue({ csrfToken: CSRF_TOKEN, account: ACCOUNT });
  api.requestPasswordReset.mockReset();
  api.confirmPasswordReset.mockReset().mockResolvedValue({ status: 'success' });
  api.fetchAccount.mockReset();
  api.fetchEnvironments.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

describe('LoginStep password login (ETP-4576)', () => {
  it('accepts a bearer token, records the password method and hands the credential to setToken and the router', async () => {
    const { container, setToken, setAccountName, routeByEnvironments } = renderLoginStep();

    await submitPasswordLogin(container);

    await waitFor(() => expect(routeByEnvironments).toHaveBeenCalledWith(TOKEN));
    expect(setToken).toHaveBeenCalledWith(TOKEN);
    expect(setAccountName).toHaveBeenCalledWith(ACCOUNT.name);
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('password');
    // The credential itself is never persisted.
    expect(credentialIsStored(TOKEN)).toBe(false);
  });

  it('accepts a CSRF proof instead of a bearer token and reports the cookie scheme to the caller', async () => {
    api.loginAccount.mockResolvedValueOnce({ csrfToken: CSRF_TOKEN, account: ACCOUNT });
    const onAuthenticated = vi.fn(async () => {});
    const { container, setToken, routeByEnvironments } = renderLoginStep({ onAuthenticated });

    await submitPasswordLogin(container);

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(onAuthenticated).toHaveBeenCalledWith(CSRF_TOKEN, ACCOUNT, { scheme: 'cookie' });
    expect(setToken).toHaveBeenCalledWith(CSRF_TOKEN);
    // A caller-owned continuation must not be navigated away from.
    expect(routeByEnvironments).not.toHaveBeenCalled();
    expect(credentialIsStored(CSRF_TOKEN)).toBe(false);
  });
});

describe('LoginStep SSO login (ETP-4576, ETP-4958)', () => {
  it('accepts a bearer SSO credential, records the sso method and hands it over exactly once', async () => {
    const onAuthenticated = vi.fn(async () => {});
    const { setToken, routeByEnvironments } = renderLoginStep({ onAuthenticated });

    await completeSsoCredential();

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(onAuthenticated).toHaveBeenCalledWith(TOKEN, ACCOUNT, { scheme: 'bearer' });
    expect(setToken).toHaveBeenCalledWith(TOKEN);
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('sso');
    expect(routeByEnvironments).not.toHaveBeenCalled();
    expect(credentialIsStored(TOKEN)).toBe(false);
  });
});

describe('LoginStep confirmed password reset (ETP-4576)', () => {
  it('confirms the reset, clears the caller state and leaves the auth-method key untouched', async () => {
    window.history.replaceState({}, '', '/?resetToken=reset-token-1');
    localStorage.setItem('sf_platform_auth_method', 'sso');
    const { container, setToken, setAccountName } = renderLoginStep();

    fireEvent.change(container.querySelector('#reset-password'), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.change(container.querySelector('#reset-password-confirm'), {
      target: { value: STRONG_PASSWORD },
    });
    await act(async () => {
      fireEvent.submit(screen.getByTestId('action-reset-password-submit').closest('form'));
    });

    await waitFor(() => expect(api.confirmPasswordReset).toHaveBeenCalledTimes(1));
    expect(setToken).toHaveBeenCalledWith(null);
    expect(setAccountName).toHaveBeenCalledWith(null);
    expect(screen.getByText('onboardingResetPasswordSuccessTitle')).toBeTruthy();
    // The reset no longer wipes the method note — UserAvatarButton still reads it.
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('sso');
    expect(localStorage.getItem('sf_platform_token')).toBeNull();
  });
});

describe('RegisterStep password registration (ETP-4576)', () => {
  it('accepts the credential, records the method and calls handleRegisterSuccess with it', async () => {
    const handleRegisterSuccess = vi.fn();
    const { container, setToken, setAccountName } = renderRegisterStep({ handleRegisterSuccess });

    await fillAndSubmitRegistration(container);

    await waitFor(() => expect(handleRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(handleRegisterSuccess).toHaveBeenCalledWith(CSRF_TOKEN, ACCOUNT);
    expect(setToken).toHaveBeenCalledWith(CSRF_TOKEN);
    expect(setAccountName).toHaveBeenCalledWith(ACCOUNT.name);
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('password');
    expect(credentialIsStored(CSRF_TOKEN)).toBe(false);
  });

  it('leaves routing out when the host owns the continuation', async () => {
    const onRegistered = vi.fn(async () => {});
    const handleRegisterSuccess = vi.fn();
    const { container, setToken } = renderRegisterStep({ onRegistered, handleRegisterSuccess });

    await fillAndSubmitRegistration(container);

    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    expect(onRegistered).toHaveBeenCalledWith(CSRF_TOKEN, ACCOUNT);
    expect(handleRegisterSuccess).not.toHaveBeenCalled();
    expect(setToken).toHaveBeenCalledWith(CSRF_TOKEN);
  });

  it('accepts a bearer token from a host-owned registerHandler and passes it through unchanged', async () => {
    const registerHandler = vi.fn(async () => ({ token: TOKEN, account: ACCOUNT }));
    const onRegistered = vi.fn(async () => {});
    const { container, setToken } = renderRegisterStep({ registerHandler, onRegistered });

    await fillAndSubmitRegistration(container);

    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    expect(onRegistered).toHaveBeenCalledWith(TOKEN, ACCOUNT);
    expect(setToken).toHaveBeenCalledWith(TOKEN);
    // The host endpoint is used instead of the package's own register call.
    expect(api.registerAccount).not.toHaveBeenCalled();
    expect(registerHandler).toHaveBeenCalledWith(expect.objectContaining({ email: ACCOUNT.email }));
    expect(credentialIsStored(TOKEN)).toBe(false);
  });

  it('passes a bearer token through to the internal success handler unchanged', async () => {
    const registerHandler = vi.fn(async () => ({ token: TOKEN, account: ACCOUNT }));
    const handleRegisterSuccess = vi.fn();
    const { container } = renderRegisterStep({ registerHandler, handleRegisterSuccess });

    await fillAndSubmitRegistration(container);

    await waitFor(() => expect(handleRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(handleRegisterSuccess).toHaveBeenCalledWith(TOKEN, ACCOUNT);
  });

  it('prefers the CSRF proof when both credentials arrive, never relabelling either', async () => {
    api.registerAccount.mockResolvedValueOnce({ csrfToken: CSRF_TOKEN, token: TOKEN, account: ACCOUNT });
    const onRegistered = vi.fn(async () => {});
    const { container } = renderRegisterStep({ onRegistered });

    await fillAndSubmitRegistration(container);

    await waitFor(() => expect(onRegistered).toHaveBeenCalledTimes(1));
    expect(onRegistered).toHaveBeenCalledWith(CSRF_TOKEN, ACCOUNT);
  });
});

describe('RegisterStep SSO registration (ETP-4576)', () => {
  it('records the sso method and hands the credential to setToken and handleRegisterSuccess', async () => {
    const handleRegisterSuccess = vi.fn();
    const { setToken } = renderRegisterStep({ handleRegisterSuccess });

    await completeSsoCredential();

    await waitFor(() => expect(handleRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(handleRegisterSuccess).toHaveBeenCalledWith(TOKEN, ACCOUNT);
    expect(setToken).toHaveBeenCalledWith(TOKEN);
    // An SSO account must say so, or the avatar offers a password it never set.
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('sso');
    expect(credentialIsStored(TOKEN)).toBe(false);
  });

  it('accepts a CSRF proof from the provider as well as a bearer token', async () => {
    api.loginWithSsoProvider.mockResolvedValueOnce({ csrfToken: CSRF_TOKEN, account: ACCOUNT });
    const handleRegisterSuccess = vi.fn();
    const { setToken } = renderRegisterStep({ handleRegisterSuccess });

    await completeSsoCredential();

    await waitFor(() => expect(handleRegisterSuccess).toHaveBeenCalledTimes(1));
    expect(handleRegisterSuccess).toHaveBeenCalledWith(CSRF_TOKEN, ACCOUNT);
    expect(setToken).toHaveBeenCalledWith(CSRF_TOKEN);
    expect(localStorage.getItem('sf_platform_auth_method')).toBe('sso');
  });
});
