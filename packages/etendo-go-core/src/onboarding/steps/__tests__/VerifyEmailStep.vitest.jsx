// @covers packages/etendo-go-core/src/onboarding/steps/VerifyEmailStep.jsx
// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/index.js
// @covers packages/etendo-go-core/src/onboarding/api.js
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4798 — the confirm-your-email wall and the confirmation link.
 *
 * The old suite read the sources of VerifyEmailStep.jsx, OnboardingFlow.jsx and steps/index.js and
 * matched regular expressions against them. This one renders the real wall, drives the real flow
 * with a stubbed network, and asserts the same guarantees on what a user can observe: which step
 * is on screen, which requests go out (and in which order), what the resend button offers and when
 * it accepts another click, and that the confirmation refusal reaches the user as a localized
 * sentence instead of the backend's English text.
 */

const CATALOG = {
  onboardingVerifyEmailTitle: 'Confirma tu correo electrónico',
  onboardingVerifyEmailSentToAddress: 'Te enviamos un enlace a {email}',
  onboardingVerifyEmailSent: 'Te enviamos un enlace de confirmación',
  onboardingVerifyEmailHint: 'Si no lo ves, revisá la carpeta de spam.',
  onboardingEmailVerifyResend: 'Reenviar correo',
  onboardingEmailVerifyResending: 'Reenviando…',
  onboardingEmailVerifyResent: 'Correo reenviado',
  onboardingEmailVerifyResendCooldown: 'Podés reenviar en {seconds} s',
  onboardingEmailVerifyResendFailed: 'No pudimos reenviar el correo.',
  onboardingEmailNotVerified: 'Confirmá tu correo antes de crear un entorno.',
  logout: 'Cerrar sesión',
};

function translate(key, params = {}) {
  let text = CATALOG[key] ?? key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value);
  });
  return text;
}

const COOLDOWN_TEXT = translate('onboardingEmailVerifyResendCooldown', { seconds: 60 });
const EMAIL = 'ada@example.com';
const CSRF_PROOF = 'csrf-proof';
const COOLDOWN_KEY = `sf_verify_resend_until:${EMAIL}`;

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => translate,
  // No setLocale → the steps skip the language selector entirely.
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

// The real api.js is kept for everything this suite does not drive by hand: `runOnboardingStream`
// and `resolveAuthErrorMessage` are asserted as themselves below, and the account binding /
// session-lost helpers are what the flow under test uses.
vi.mock('../../api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchSession: vi.fn(),
    fetchAccount: vi.fn(),
    fetchEnvironments: vi.fn(),
    fetchOnboardingDraft: vi.fn(),
    saveOnboardingDraft: vi.fn(),
    loginEnvironment: vi.fn(),
    loginAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerifyEmail: vi.fn(),
  };
});

const { VerifyEmailStep } = await import('../VerifyEmailStep.jsx');
const { LoginStep } = await import('../LoginStep.jsx');
const { coreSteps } = await import('../index.js');
const api = await import('../../api.js');
const { resolveOnboardingErrorMessage } = await import('../../errorMessages.js');
const { OnboardingFlow } = await import('../../OnboardingFlow.jsx');

function account(overrides = {}) {
  return { id: 'acc-1', email: EMAIL, name: 'Ada', ...overrides };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** The wall, rendered on its own. */
function renderWall(props = {}) {
  return render(
    <VerifyEmailStep
      config={{ apiBase: '', brandLabel: 'Etendo', defaultForm: { language: 'es_ES' } }}
      token={CSRF_PROOF}
      accountEmail={EMAIL}
      accountName="Ada"
      onLogout={() => {}}
      {...props}
    />,
  );
}

function ProfileStandIn() {
  return <div data-testid="profile-step">profile</div>;
}

function CompanyStandIn() {
  return <div data-testid="company-step">company</div>;
}

/** Exposes the flow's register continuation, which is otherwise only reachable through a step. */
function HandoffStandIn({ handleRegisterSuccess }) {
  return (
    <div data-testid="handoff-step">
      <button
        type="button"
        data-testid="handoff-register"
        onClick={() => handleRegisterSuccess(CSRF_PROOF, account())}>
        registered
      </button>
    </div>
  );
}

function flowSteps(loginComponent) {
  return [
    { id: 'login', component: loginComponent },
    { id: 'verify-email', component: VerifyEmailStep }, // the real wall
    { id: 'profile', component: ProfileStandIn, persistable: true },
    { id: 'company', component: CompanyStandIn, persistable: true },
  ];
}

function renderFlow(loginComponent) {
  return render(<OnboardingFlow steps={flowSteps(loginComponent)} config={{ apiBase: '' }} />);
}

function noSession() {
  const err = new Error('no session');
  err.status = 401;
  return err;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  localStorage.clear();
  // The flow announces its account to the other tabs; keep that inside this process rather than
  // on Node's own BroadcastChannel, which neighbouring suites share.
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.closed = false; }

    postMessage() {}

    close() { this.closed = true; }
  });
  api.fetchSession.mockResolvedValue({ csrfToken: CSRF_PROOF, account: account() });
  api.fetchAccount.mockResolvedValue(account());
  api.fetchEnvironments.mockResolvedValue([]);
  api.fetchOnboardingDraft.mockResolvedValue({ draft: null });
  api.saveOnboardingDraft.mockResolvedValue({ ok: true });
  api.verifyEmail.mockResolvedValue({ status: 'success', emailVerified: true });
  api.resendVerifyEmail.mockResolvedValue({ status: 'success' });
  api.loginAccount.mockResolvedValue({ csrfToken: CSRF_PROOF, account: account() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the confirm-your-email wall (ETP-4798)', () => {
  beforeEach(() => {
    api.fetchAccount.mockResolvedValue(account({ emailVerificationPending: true }));
  });

  it('replaces the onboarding step while a confirmation is owed, and offers the resend', async () => {
    renderFlow(HandoffStandIn);

    expect(await screen.findByTestId('verify-email-step')).toBeTruthy();
    expect(screen.queryByTestId('profile-step')).toBeNull();
    expect(screen.getByText(CATALOG.onboardingVerifyEmailTitle)).toBeTruthy();
    expect(screen.getByText(
      translate('onboardingVerifyEmailSentToAddress', { email: EMAIL }),
    )).toBeTruthy();
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(false);
  });

  it('blocks before loading the environments, from the single entry every authenticated path uses', async () => {
    renderFlow(HandoffStandIn);

    await screen.findByTestId('verify-email-step');
    expect(api.fetchEnvironments).not.toHaveBeenCalled();
    // The mount reads /session (for the CSRF proof) and the account state is read once, downstream.
    expect(api.fetchSession).toHaveBeenCalledTimes(1);
    expect(api.fetchAccount).toHaveBeenCalledTimes(1);
  });

  it('never walls an account that is merely not verified — only a pending confirmation counts', async () => {
    // An account predating the feature, or one whose mail could not be delivered (the backend
    // leaves those ungated on purpose), is neither verified nor pending and must go straight on.
    api.fetchAccount.mockResolvedValue(account({ emailVerified: false }));

    renderFlow(HandoffStandIn);

    expect(await screen.findByTestId('profile-step')).toBeTruthy();
    expect(screen.queryByTestId('verify-email-step')).toBeNull();
    expect(api.fetchEnvironments).toHaveBeenCalledTimes(1);
  });

  it('walls a plain login too, not only the mount path', async () => {
    api.fetchSession.mockRejectedValue(noSession());
    api.loginAccount.mockResolvedValue({ csrfToken: CSRF_PROOF, account: account() });
    const { container } = renderFlow(LoginStep);

    // No session: the flow lands on the login form.
    await screen.findByTestId('action-login-submit');
    fireEvent.change(container.querySelector('#login-email'), { target: { value: EMAIL } });
    fireEvent.change(container.querySelector('#login-password'), { target: { value: 'Str0ng!Pass' } });
    fireEvent.submit(screen.getByTestId('action-login-submit').closest('form'));

    expect(await screen.findByTestId('verify-email-step')).toBeTruthy();
    expect(api.fetchEnvironments).not.toHaveBeenCalled();
  });
});

describe('the post-registration destination (ETP-4798)', () => {
  beforeEach(() => {
    api.fetchSession.mockRejectedValue(noSession());
  });

  it('sends a freshly registered account to the wall when the server says a confirmation is owed', async () => {
    renderFlow(HandoffStandIn);
    await screen.findByTestId('handoff-step');

    api.fetchAccount.mockResolvedValue(account({ emailVerificationPending: true }));
    fireEvent.click(screen.getByTestId('handoff-register'));

    expect(await screen.findByTestId('verify-email-step')).toBeTruthy();
    // The destination came from the server's answer, not from the registration response.
    await waitFor(() => expect(api.fetchAccount).toHaveBeenCalledTimes(1));
  });

  it('starts onboarding when the server does not report a pending confirmation', async () => {
    renderFlow(HandoffStandIn);
    await screen.findByTestId('handoff-step');

    api.fetchAccount.mockResolvedValue(account());
    fireEvent.click(screen.getByTestId('handoff-register'));

    expect(await screen.findByTestId('profile-step')).toBeTruthy();
    expect(screen.queryByTestId('verify-email-step')).toBeNull();
  });
});

describe('the confirmation link (ETP-4798)', () => {
  it('confirms with the URL token after stripping it from the address bar, and settles before /session', async () => {
    const order = [];
    const confirm = deferred();
    let searchAtRequest = null;
    api.verifyEmail.mockImplementation(async () => {
      order.push('verify-email');
      searchAtRequest = window.location.search;
      return confirm.promise;
    });
    api.fetchSession.mockImplementation(async () => {
      order.push('session');
      return { csrfToken: CSRF_PROOF, account: account() };
    });
    api.fetchAccount.mockImplementation(async () => {
      order.push('me');
      return account();
    });
    window.history.replaceState({}, '', '/?verifyToken=tok-abc');

    renderFlow(HandoffStandIn);

    await waitFor(() => expect(api.verifyEmail).toHaveBeenCalledTimes(1));
    expect(api.verifyEmail).toHaveBeenCalledWith(expect.anything(), '', 'tok-abc');
    // The token is gone from the address bar before the request is issued, so a reload mid-flight
    // cannot replay it out of history.
    expect(searchAtRequest).toBe('');
    // Regression guard: fired concurrently, the still-pending session answer overwrote the
    // just-confirmed state.
    expect(order).toEqual(['verify-email']);
    expect(api.fetchSession).not.toHaveBeenCalled();

    confirm.resolve({ status: 'success', emailVerified: true });

    expect(await screen.findByTestId('profile-step')).toBeTruthy();
    expect(order).toEqual(['verify-email', 'session', 'me']);
  });

  it('never issues a confirmation request when the URL carries no token', async () => {
    renderFlow(HandoffStandIn);

    expect(await screen.findByTestId('profile-step')).toBeTruthy();
    expect(api.verifyEmail).not.toHaveBeenCalled();
  });

  it('does not dead-end on an expired or already-used link: the wall stays up with its resend', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.verifyEmail.mockRejectedValue(Object.assign(
      new Error('Invalid or expired email verification token'),
      { code: 'EMAIL_VERIFY_INVALID', status: 400 },
    ));
    api.fetchAccount.mockResolvedValue(account({ emailVerificationPending: true }));
    window.history.replaceState({}, '', '/?verifyToken=stale-token');

    renderFlow(HandoffStandIn);

    expect(await screen.findByTestId('verify-email-step')).toBeTruthy();
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(false);
    // The ordinary bootstrap still ran: the failed confirmation did not interrupt the flow.
    expect(api.fetchSession).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('the email-verification refusal reaches the user localized (ETP-4798)', () => {
  it('turns the 403 gate code into the localized sentence, never the backend English text', async () => {
    const refusal = {
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Confirm your email address before creating an environment.',
        },
      }),
    };

    const error = await api.runOnboardingStream(
      async () => refusal, '', CSRF_PROOF, { clientName: 'ACME' }, () => {},
    ).catch((thrown) => thrown);

    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    const message = resolveOnboardingErrorMessage(translate, error);
    expect(message).toBe(CATALOG.onboardingEmailNotVerified);
    expect(message).not.toContain('Confirm your email address');
  });
});

// The transport half of the same contract, asserted against the real module (the components above
// replace these entry points, so bypass the mock to reach them).
describe('the email-verification endpoints (ETP-4798)', () => {
  const BASE = 'https://etendo.example.test';

  function jsonResponse(body, { ok = true, status = 200 } = {}) {
    return { ok, status, json: async () => body };
  }

  async function realApi() {
    return vi.importActual('../../api.js');
  }

  it('confirms the token without a session or an Authorization header', async () => {
    const { verifyEmail } = await realApi();
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success', emailVerified: true });
    };

    const data = await verifyEmail(fetchImpl, BASE, 'tok-123');

    expect(seen.url).toBe(`${BASE}/sws/go/verify-email`);
    expect(seen.init.method).toBe('POST');
    // The mailed link is opened without a session; requiring one would break the flow entirely.
    expect(seen.init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(seen.init.body)).toEqual({ token: 'tok-123' });
    expect(data.emailVerified).toBe(true);
  });

  it('throws the backend stable code when the link is no longer valid', async () => {
    const { verifyEmail } = await realApi();
    const fetchImpl = async () => jsonResponse(
      { error: { code: 'EMAIL_VERIFY_INVALID', message: 'Invalid or expired email verification token' } },
      { ok: false, status: 400 },
    );

    const error = await verifyEmail(fetchImpl, BASE, 'stale').catch((thrown) => thrown);

    expect(error.code).toBe('EMAIL_VERIFY_INVALID');
    expect(error.status).toBe(400);
  });

  it('resends authenticated by the session cookie and its CSRF proof, passing the language', async () => {
    const { resendVerifyEmail } = await realApi();
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success' });
    };

    await resendVerifyEmail(fetchImpl, BASE, 'csrf-proof', 'es_ES');

    expect(seen.url).toBe(`${BASE}/sws/go/verify-email/resend?language=es_ES`);
    // ETP-4576: the credential is the __Host- session cookie, so an unsafe request carries only the
    // CSRF proof by hand — and the cookie only rides along with credentials: 'include'.
    expect(seen.init.credentials).toBe('include');
    expect(seen.init.headers['X-Go-CSRF']).toBe('csrf-proof');
    expect(seen.init.headers.Authorization).toBeUndefined();
  });

  it('omits the language query when none is selected', async () => {
    const { resendVerifyEmail } = await realApi();
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success' });
    };

    await resendVerifyEmail(fetchImpl, BASE, 'csrf-proof', '');

    expect(seen.url).toBe(`${BASE}/sws/go/verify-email/resend`);
  });

  it('keeps the flat paywall refusal readable too', async () => {
    // The paywall sends `{ error: "PAYMENT_REQUIRED" }`, where the code IS the string.
    const fetchImpl = async () => jsonResponse(
      { error: 'PAYMENT_REQUIRED', message: 'Creating an additional environment requires a payment.' },
      { ok: false, status: 402 },
    );

    const error = await api.runOnboardingStream(
      fetchImpl, BASE, CSRF_PROOF, { clientName: 'ACME' }, () => {},
    ).catch((thrown) => thrown);

    expect(error.code).toBe('PAYMENT_REQUIRED');
  });

  it('falls back to the stream-unavailable code when a refusal has no parseable body', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json'); },
    });

    const error = await api.runOnboardingStream(
      fetchImpl, BASE, CSRF_PROOF, { clientName: 'ACME' }, () => {},
    ).catch((thrown) => thrown);

    expect(error.code).toBe(api.ONBOARDING_ERROR_CODES.streamUnavailable);
  });
});

describe('the wall in the step registry (ETP-4798)', () => {
  it('is registered as the real wall and preserves the index chain handleNext walks', () => {
    const ids = coreSteps.map((step) => step.id);

    expect(coreSteps.find((step) => step.id === 'verify-email').component).toBe(VerifyEmailStep);
    // handleNext advances by index, so profile -> company -> setup-progress must stay contiguous.
    expect(ids.indexOf('company')).toBe(ids.indexOf('profile') + 1);
    expect(ids.indexOf('setup-progress')).toBe(ids.indexOf('company') + 1);
  });

  it('owns no draft state, so it cannot disturb draft save or restore', () => {
    const entry = coreSteps.find((step) => step.id === 'verify-email');

    // draftPersistence only resolves steps that are `persistable`/`draftStep`; the wall carrying
    // neither is what keeps it out of the saved draft.
    expect(entry).toEqual({ id: 'verify-email', component: VerifyEmailStep });
  });
});

describe('the resend action and its cooldown (ETP-4798)', () => {
  it('sends with the session proof and the selected language, then waits a minute', async () => {
    renderWall();

    fireEvent.click(screen.getByTestId('verify-email-resend'));

    await waitFor(() => expect(api.resendVerifyEmail).toHaveBeenCalledWith(
      expect.anything(), '', CSRF_PROOF, 'es_ES',
    ));
    expect(await screen.findByText(COOLDOWN_TEXT)).toBeTruthy();
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(true);
    expect(screen.getByTestId('verify-email-resent').textContent)
      .toBe(CATALOG.onboardingEmailVerifyResent);
  });

  it('refuses a second send while cooling, not only while the first is in flight', async () => {
    renderWall();

    fireEvent.click(screen.getByTestId('verify-email-resend'));
    await waitFor(() => expect(api.resendVerifyEmail).toHaveBeenCalledTimes(1));
    await screen.findByText(COOLDOWN_TEXT);

    fireEvent.click(screen.getByTestId('verify-email-resend'));

    expect(api.resendVerifyEmail).toHaveBeenCalledTimes(1);
  });

  it('frees the button again once the cooldown expires instead of parking it on "sent"', async () => {
    // A second, legitimate resend used to need a page reload.
    localStorage.setItem(COOLDOWN_KEY, String(Date.now() + 200));
    renderWall();

    expect(screen.getByTestId('verify-email-resend').disabled).toBe(true);

    await waitFor(
      () => expect(screen.getByTestId('verify-email-resend').disabled).toBe(false),
      { timeout: 3000 },
    );
    expect(screen.queryByTestId('verify-email-resent')).toBeNull();
    expect(screen.getByTestId('verify-email-resend').textContent)
      .toBe(CATALOG.onboardingEmailVerifyResend);
  });

  it('only starts the cooldown on success, so a failed send stays retryable', async () => {
    api.resendVerifyEmail.mockRejectedValue(new Error('Resend refused'));
    renderWall();

    fireEvent.click(screen.getByTestId('verify-email-resend'));

    expect((await screen.findByTestId('verify-email-resend-failed')).textContent)
      .toBe(CATALOG.onboardingEmailVerifyResendFailed);
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(false);
    expect(localStorage.getItem(COOLDOWN_KEY)).toBeNull();

    fireEvent.click(screen.getByTestId('verify-email-resend'));

    await waitFor(() => expect(api.resendVerifyEmail).toHaveBeenCalledTimes(2));
  });

  it('persists the deadline per address, so a refresh or another account does not reset it', async () => {
    const first = renderWall();

    fireEvent.click(screen.getByTestId('verify-email-resend'));
    await screen.findByText(COOLDOWN_TEXT);
    expect(localStorage.getItem(COOLDOWN_KEY)).not.toBeNull();

    // This screen's documented way forward is a plain refresh, which must not clear the cooldown.
    first.unmount();
    const refreshed = renderWall();
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(true);
    expect(screen.getByTestId('verify-email-resent')).toBeTruthy();
    refreshed.unmount();

    // A different account registering in the same browser is not made to wait out someone else's.
    renderWall({ accountEmail: 'grace@example.com' });
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(false);
  });

  it('survives storage being unavailable instead of breaking the screen', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    renderWall();

    expect(screen.getByTestId('verify-email-step')).toBeTruthy();
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(false);

    fireEvent.click(screen.getByTestId('verify-email-resend'));

    await waitFor(() => expect(api.resendVerifyEmail).toHaveBeenCalledTimes(1));
    // The write failed, but the in-memory countdown still protects this page.
    expect(screen.getByTestId('verify-email-resend').disabled).toBe(true);
  });

  it('clears its interval on unmount', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const view = renderWall();

    fireEvent.click(screen.getByTestId('verify-email-resend'));
    await screen.findByText(COOLDOWN_TEXT);
    const intervalId = setIntervalSpy.mock.results.at(-1).value;
    expect(intervalId).toBeDefined();

    view.unmount();

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
  });
});
