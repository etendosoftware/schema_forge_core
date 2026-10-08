// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/components/OnboardingSessionLost.jsx
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-5675 — the onboarding used to hide a lost session until the very end: a second tab of the
 * same browser signed in as another account (the cookie is the browser profile's), this page only
 * warned that the draft could not be saved, and provisioning then failed with the backend's raw
 * "Missing or invalid Authorization header". Its own "Cerrar sesión" never revoked the session.
 *
 * Renders the real OnboardingFlow with two stand-in steps; the network is a stubbed `fetch` and the
 * other tab is a second BroadcastChannel on the same name.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');
const { bindOnboardingAccount } = await import('../api.js');

const ACCOUNT_B = { id: 'acc-B', email: 'b@example.test', name: 'Bea' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function LoginStandIn({ draftSaveWarning }) {
  return (
    <div data-testid="login-step">
      {draftSaveWarning && <p data-testid="stale-draft-warning">warning</p>}
    </div>
  );
}

function ProfileStandIn({ onLogout, onNext }) {
  return (
    <div data-testid="profile-step">
      <button type="button" onClick={onLogout} data-testid="profile-logout">logout</button>
      <button type="button" onClick={() => onNext({ fullName: 'Bea B' })} data-testid="profile-next">next</button>
    </div>
  );
}

const STEPS = [
  { id: 'login', component: LoginStandIn },
  { id: 'profile', component: ProfileStandIn, persistable: true },
  { id: 'company', component: () => <p data-testid="company-step">company</p>, persistable: true },
];

let draftSaveStatus;

let requests;
let channels;

beforeEach(() => {
  draftSaveStatus = 200;
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push({ path, method, headers: init.headers || {} });
    if (path.endsWith('/sws/go/session') && method === 'GET') {
      return json({ status: 'success', account: ACCOUNT_B, csrfToken: 'csrf-B' });
    }
    if (path.endsWith('/sws/go/session') && method === 'DELETE') return new Response(null, { status: 204 });
    if (path.endsWith('/sws/go/me')) return json(ACCOUNT_B);
    if (path.endsWith('/sws/go/environments')) return json({ environments: [] });
    if (path.endsWith('/sws/go/onboarding/draft') && method === 'POST') {
      return draftSaveStatus === 200
        ? json({ ok: true })
        : json({ error: { message: 'Invalid or expired session', status: draftSaveStatus } }, draftSaveStatus);
    }
    if (path.endsWith('/sws/go/onboarding/draft')) return json({ draft: null });
    return json({});
  }));
  channels = [];
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.closed = false; channels.push(this); }

    postMessage(data) {
      channels.filter((c) => c !== this && !c.closed && c.name === this.name)
        .forEach((c) => c.onmessage?.({ data }));
    }

    close() { this.closed = true; }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  bindOnboardingAccount(null);
  localStorage.clear();
});

/** Another tab of this browser announcing whose session the browser holds now. */
function otherTabAnnounces(accountId) {
  const other = new BroadcastChannel('etendo-go-session');
  act(() => { other.postMessage({ type: 'session-account', accountId }); });
  other.close();
}

async function renderSignedInAsB() {
  render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);
  await screen.findByTestId('profile-step');
}

describe('OnboardingFlow — a session lost to another tab (ETP-5675)', () => {
  it('stops on the session-lost screen when another tab signs in as someone else', async () => {
    await renderSignedInAsB();

    otherTabAnnounces('acc-C');

    expect(await screen.findByTestId('onboarding-session-lost')).toBeTruthy();
    expect(screen.queryByTestId('profile-step')).toBeNull();
  });

  it('stops too when another tab signs the browser out', async () => {
    await renderSignedInAsB();

    otherTabAnnounces(null);

    expect(await screen.findByTestId('onboarding-session-lost')).toBeTruthy();
  });

  it('ignores another tab of the same account', async () => {
    await renderSignedInAsB();

    otherTabAnnounces('acc-B');

    expect(screen.getByTestId('profile-step')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-session-lost')).toBeNull();
  });

  it('goes back to the login without revoking anything', async () => {
    await renderSignedInAsB();
    otherTabAnnounces('acc-C');
    fireEvent.click(await screen.findByTestId('onboarding-session-lost-signin'));

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(requests.some((r) => r.method === 'DELETE')).toBe(false);
  });

  // The session expired server-side (an idle timeout): no other tab announced anything. The draft
  // save used to only warn and let the flow carry on to a provisioning that could only fail.
  it('stops on the session-lost screen when a draft save answers 401', async () => {
    await renderSignedInAsB();
    draftSaveStatus = 401;

    fireEvent.click(screen.getByTestId('profile-next'));

    expect(await screen.findByTestId('onboarding-session-lost')).toBeTruthy();
    expect(screen.queryByTestId('company-step')).toBeNull();
  });

  it('does not carry the failed-save warning over to the login', async () => {
    await renderSignedInAsB();
    draftSaveStatus = 401;
    fireEvent.click(screen.getByTestId('profile-next'));
    fireEvent.click(await screen.findByTestId('onboarding-session-lost-signin'));

    await screen.findByTestId('login-step');
    expect(screen.queryByTestId('stale-draft-warning')).toBeNull();
  });

  it('binds its authenticated calls to the account it signed in as', async () => {
    await renderSignedInAsB();

    const environments = requests.find((r) => r.path.endsWith('/sws/go/environments'));
    expect(environments.headers['X-Go-Account']).toBe('acc-B');
  });
});

describe('OnboardingFlow — logout (ETP-5675)', () => {
  it('revokes the session server-side, naming its own account', async () => {
    await renderSignedInAsB();

    fireEvent.click(screen.getByTestId('profile-logout'));

    await waitFor(() => { expect(requests.some((r) => r.method === 'DELETE')).toBe(true); });
    const revoke = requests.find((r) => r.method === 'DELETE');
    expect(revoke.headers).toEqual({ 'X-Go-CSRF': 'csrf-B', 'X-Go-Account': 'acc-B' });
    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-session-lost')).toBeNull();
  });
});
