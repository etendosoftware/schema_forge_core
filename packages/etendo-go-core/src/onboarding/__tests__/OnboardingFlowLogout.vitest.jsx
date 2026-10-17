// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/logout.js
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The onboarding logout contract, observed through the rendered flow: one shared operation, the
 * revoke naming this page's account, the legacy session wiped at every cleanup site, and the
 * cross-tab sign-out announcement.
 *
 * `createOnboardingLogout`'s own ordering/telemetry rules are pure JS and stay with the node --test
 * suite (test/onboardingLogout.test.js); everything a user can see is asserted here, with a stubbed
 * fetch, against which view is on screen.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');
const { EnvSelectStep } = await import('../steps/EnvSelectStep.jsx');
const { bindOnboardingAccount } = await import('../api.js');

const ACCOUNT = { id: 'acc-A', email: 'ada@example.test', name: 'Ada Lovelace' };

// Every pre-cookie key app-shell-core's purgeLegacyAuthStorage owns. sf_auth_client_name matters:
// the retired local auth storage's own clear() never removed it, so its absence after a logout is
// what proves the canonical purge ran rather than a local storage adapter.
const LEGACY_KEYS = [
  'sf_auth_token',
  'sf_auth_user',
  'sf_auth_client_id',
  'sf_auth_client_name',
  'sf_auth_rolelist',
  'sf_auth_selected_role',
  'sf_auth_selected_org',
  'sf_platform_token',
  'sf_platform_auth_method',
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function seedLegacyKeys() {
  LEGACY_KEYS.forEach((key) => localStorage.setItem(key, `legacy:${key}`));
}

function remainingLegacyKeys() {
  return LEGACY_KEYS.filter((key) => localStorage.getItem(key) !== null);
}

const ENVIRONMENT = { clientId: 'env-1', clientName: 'Env One', adminUserId: 'user-1' };

const STEPS = [
  { id: 'login', component: () => <div data-testid="login-step">login</div> },
  { id: 'env-select', component: EnvSelectStep },
  { id: 'profile', component: ProfileStandIn, persistable: true, draftStep: 1 },
];

function ProfileStandIn({ onLogout, onNext }) {
  return (
    <div data-testid="profile-step">
      <button type="button" onClick={onLogout} data-testid="profile-logout">logout</button>
      <button type="button" onClick={() => onNext({ fullName: 'Ada L' })} data-testid="profile-next">next</button>
    </div>
  );
}

let sessionStatus;
let deleteStatus;
let draftSaveStatus;
let environments;
let holdDelete;
let channels;
let requests;

beforeEach(() => {
  sessionStatus = 200;
  deleteStatus = 204;
  draftSaveStatus = 200;
  environments = [];
  holdDelete = null;
  channels = [];
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push({ path, method, headers: init.headers || {} });
    if (path.endsWith('/sws/go/session') && method === 'GET') {
      if (sessionStatus !== 200) {
        return json({ error: { code: 'invalidSession', message: 'no session' } }, sessionStatus);
      }
      return json({ status: 'success', account: ACCOUNT, csrfToken: 'csrf-A' });
    }
    if (path.endsWith('/sws/go/session') && method === 'DELETE') {
      if (holdDelete) await holdDelete.promise;
      return new Response(null, { status: deleteStatus });
    }
    if (path.endsWith('/sws/go/me')) return json(ACCOUNT);
    if (path.endsWith('/sws/go/environments')) return json({ environments });
    if (path.endsWith('/sws/go/session/environment')) return json({ status: 'failed' });
    if (path.endsWith('/sws/go/onboarding/draft') && method === 'POST') {
      return draftSaveStatus === 200
        ? json({ ok: true })
        : json({ error: { message: 'Invalid or expired session', status: draftSaveStatus } }, draftSaveStatus);
    }
    if (path.endsWith('/sws/go/onboarding/draft')) return json({ draft: null });
    return json({});
  }));
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.closed = false; this.received = []; channels.push(this); }

    postMessage(data) {
      channels
        .filter((c) => c !== this && !c.closed && c.name === this.name)
        .forEach((c) => { c.received.push(data); c.onmessage?.({ data }); });
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

/** Another tab of this browser, listening on the shared session channel. */
function openOtherTab() {
  return new BroadcastChannel('etendo-go-session');
}

function revokeRequests() {
  return requests.filter((r) => r.path.endsWith('/sws/go/session') && r.method === 'DELETE');
}

/** Renders a flow that lands on the profile step, signed in as the fixture account. */
async function renderAtProfile() {
  render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);
  await screen.findByTestId('profile-step');
}

describe('OnboardingFlow logout', () => {
  it('revokes the session server-side, naming its own account, and only then leaves to login', async () => {
    holdDelete = deferred();
    await renderAtProfile();

    fireEvent.click(screen.getByTestId('profile-logout'));

    await waitFor(() => { expect(revokeRequests()).toHaveLength(1); });
    // The logout is still in flight: the user has not been moved.
    expect(screen.queryByTestId('login-step')).toBeNull();

    holdDelete.resolve();

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    const [revoke] = revokeRequests();
    expect(revoke.headers).toEqual({ 'X-Go-CSRF': 'csrf-A', 'X-Go-Account': 'acc-A' });
  });

  it('routes the logout of every step through the one shared operation', async () => {
    await renderAtProfile();
    fireEvent.click(screen.getByTestId('profile-logout'));
    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(revokeRequests()).toHaveLength(1);

    cleanup();
    requests = [];
    environments = [ENVIRONMENT];
    bindOnboardingAccount(null);

    // The real EnvSelectStep has no logout logic of its own: its "Cerrar sesión" is the flow's
    // callback, so it revokes and lands on the login exactly like the stand-in step did.
    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);
    fireEvent.click(await screen.findByTestId('onboarding-logout'));
    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(revokeRequests()).toHaveLength(1);
  });

  it('shares a single logout operation across two clicks in the same render', async () => {
    await renderAtProfile();

    const logout = screen.getByTestId('profile-logout');
    fireEvent.click(logout);
    fireEvent.click(logout);

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(revokeRequests()).toHaveLength(1);
  });

  it('tells the other tabs the browser is signed out, and only when the revoke was confirmed', async () => {
    await renderAtProfile();
    // Opened after the sign-in announcement the flow already made on its way to the step.
    const otherTab = openOtherTab();

    fireEvent.click(screen.getByTestId('profile-logout'));
    expect(await screen.findByTestId('login-step')).toBeTruthy();

    expect(otherTab.received).toEqual([{ type: 'session-account', accountId: null }]);
    // This page unbound before announcing, so it does not read its own sign-out as a session lost
    // to another tab, and it is not left on the session-lost screen.
    expect(screen.queryByTestId('onboarding-session-lost')).toBeNull();

    cleanup();
    requests = [];
    otherTab.received.length = 0;
    bindOnboardingAccount(null);
    deleteStatus = 401;

    await renderAtProfile();
    otherTab.received.length = 0;
    fireEvent.click(screen.getByTestId('profile-logout'));
    expect(await screen.findByTestId('login-step')).toBeTruthy();

    // A revoke the server refused left a session this page cannot speak for: nothing is announced.
    expect(otherTab.received).toEqual([]);
  });

  it('keeps the environment preference but wipes the whole legacy session', async () => {
    await renderAtProfile();
    seedLegacyKeys();
    localStorage.setItem('sf_last_environment', 'env-kept');

    fireEvent.click(screen.getByTestId('profile-logout'));
    expect(await screen.findByTestId('login-step')).toBeTruthy();

    expect(remainingLegacyKeys()).toEqual([]);
    expect(localStorage.getItem('sf_last_environment')).toBe('env-kept');
  });
});

// ETP-4576 pinned three purge sites (logout, the mount bootstrap's catch, and the session-lost
// screen's "sign in again"), failing a partial migration that converted one and left the others
// without cleanup. Each site now has its own observation below.
describe('OnboardingFlow purges the legacy session at every cleanup site (ETP-4576)', () => {
  it('purges when the mount bootstrap finds no session', async () => {
    sessionStatus = 401;
    seedLegacyKeys();

    render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(remainingLegacyKeys()).toEqual([]);
  });

  it('purges when the session-lost screen signs back in', async () => {
    await renderAtProfile();
    draftSaveStatus = 401;
    fireEvent.click(screen.getByTestId('profile-next'));
    await screen.findByTestId('onboarding-session-lost');

    seedLegacyKeys();
    fireEvent.click(screen.getByTestId('onboarding-session-lost-signin'));

    expect(await screen.findByTestId('login-step')).toBeTruthy();
    expect(remainingLegacyKeys()).toEqual([]);
  });
});
