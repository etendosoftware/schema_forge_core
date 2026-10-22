// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/EnvSelectStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4443 — login is the default onboarding view (cold entry and post-logout); register is only
 * a secondary action, reachable when the entry asked for it explicitly. ETP-4576 moved the session
 * to the `__Host-` cookie, so the bootstrap asks the server (GET /sws/go/session) instead of
 * reading a client-visible token, and ETP-5550 makes a backend that is not answering wait and
 * retry instead of showing the login form over a live session.
 *
 * Renders the real OnboardingFlow with stand-in steps around the real EnvSelectStep; every routing
 * decision is observed as "which view is on screen", driven by a stubbed global fetch.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');
const { EnvSelectStep } = await import('../steps/EnvSelectStep.jsx');
const { bindOnboardingAccount } = await import('../api.js');

const ACCOUNT = { id: 'acc-A', email: 'ada@example.test', name: 'Ada Lovelace' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function LoginStandIn() {
  return <div data-testid="login-step">login</div>;
}

function RegisterStandIn() {
  return <div data-testid="register-step">register</div>;
}

const STEPS = [
  { id: 'login', component: LoginStandIn },
  // Register IS a valid step of this flow: the fallbacks must still never choose it.
  { id: 'register', component: RegisterStandIn },
  { id: 'env-select', component: EnvSelectStep },
  { id: 'profile', component: () => <div data-testid="profile-step">profile</div> },
];

let sessionStatus;
let unavailableProbes;
let environments;
let requests;

function sessionProbeCount() {
  return requests.filter((r) => r.path.endsWith('/sws/go/session') && r.method === 'GET').length;
}

beforeEach(() => {
  sessionStatus = 401;
  unavailableProbes = 0;
  environments = [];
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push({ path, method, headers: init.headers || {} });
    if (path.endsWith('/sws/go/session') && method === 'GET') {
      // ETP-5550: a backend that is not answering is not "no session".
      if (unavailableProbes > 0) {
        unavailableProbes -= 1;
        return new Response('maintenance', { status: 503 });
      }
      if (sessionStatus !== 200) {
        return json({ error: { code: 'invalidSession', message: 'no session' } }, sessionStatus);
      }
      return json({ status: 'success', account: ACCOUNT, csrfToken: 'csrf-A' });
    }
    if (path.endsWith('/sws/go/session') && method === 'DELETE') return new Response(null, { status: 204 });
    if (path.endsWith('/sws/go/me')) return json(ACCOUNT);
    if (path.endsWith('/sws/go/environments')) return json({ environments });
    // The environment switch carries NO token (ETP-4576); a refusal is what keeps the flow on
    // the environment list so the step itself can be exercised.
    if (path.endsWith('/sws/go/session/environment')) return json({ status: 'failed' });
    if (path.endsWith('/sws/go/onboarding/draft')) return json({ draft: null });
    return json({});
  }));
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.closed = false; }

    postMessage() {}

    close() { this.closed = true; }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  bindOnboardingAccount(null);
  localStorage.clear();
});

describe('OnboardingFlow default view (ETP-4443)', () => {
  it('lands on login — never register — when the session probe says there is no session', async () => {
    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    // The register step existed as a valid routing target the whole time and was still not chosen.
    expect(screen.queryByTestId('register-step')).toBeNull();
  });

  it('asks the server for the session and ignores a leftover client-visible token', async () => {
    localStorage.setItem('sf_platform_token', 'legacy-bearer-from-a-pre-cookie-session');

    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    // A bootstrap that read the localStorage token would have treated the visitor as signed in
    // and gone on to read the account; the server's 401 is the only answer that counts.
    expect(requests.some((r) => r.path.endsWith('/sws/go/me'))).toBe(false);
    expect(sessionProbeCount()).toBeGreaterThan(0);
  });

  it.each([
    ['register', 'register-step'],
    ['login', 'login-step'],
    ['some-unknown-view', 'login-step'],
  ])('honours the explicit one-shot entry view %s when the probe fails', async (initialView, expected) => {
    localStorage.setItem('sf_onboarding_initial_view', initialView);

    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    expect(await screen.findByTestId(expected)).toBeTruthy();
    // Explicit opt-out is a single entry: anything else (and every later mount) is login.
    expect(localStorage.getItem('sf_onboarding_initial_view')).toBeNull();
  });

  it('waits and retries while the backend is unavailable, instead of showing login over a live session', async () => {
    unavailableProbes = 1;
    sessionStatus = 401;

    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    // While the probe failed for unavailability the flow is still on the loading view.
    expect(screen.queryByTestId('login-step')).toBeNull();
    expect(screen.getByTestId('Loader2__79cf84')).toBeTruthy();

    // The retry asks again, and only its answer routes the user.
    expect(await screen.findByTestId('login-step', {}, { timeout: 4000 })).toBeTruthy();
    expect(sessionProbeCount()).toBeGreaterThanOrEqual(2);
  });

  it('sends the user back to login when the env-select step logs out', async () => {
    sessionStatus = 200;
    environments = [{ clientId: 'env-1', clientName: 'Env One', adminUserId: 'user-1' }];
    localStorage.setItem('sf_platform_token', 'legacy-bearer-from-a-pre-cookie-session');

    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    // The flow auto-enters the only environment and, refused, lands on the real env-select step.
    const logout = await screen.findByTestId('onboarding-logout');

    fireEvent.click(logout);

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
    // The shared logout revoked the server session and purged the legacy client token — the step
    // itself holds no logout logic and no storage cleanup.
    expect(requests.some((r) => r.path.endsWith('/sws/go/session') && r.method === 'DELETE')).toBe(true);
    expect(localStorage.getItem('sf_platform_token')).toBeNull();
  });
});
