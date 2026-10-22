// @covers packages/etendo-go-core/src/onboarding/state.js
// @covers packages/etendo-go-core/src/onboarding/index.js
// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/EnvSelectStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/SetupProgressStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as onboardingState from '../state.js';
import * as onboardingBarrel from '../index.js';
import { purgeLegacyAuthStorage } from '@etendosoftware/app-shell-core/auth';

/**
 * ETP-4576 — the `sf_auth_*` localStorage keys were never onboarding state: they were a HANDOFF
 * CHANNEL between two page loads (the flow wrote them, did a full-page redirect, and the app booted
 * cold reading them back). With the server-side `__Host-` session cookie the channel is obsolete:
 * the cookie survives the navigation on its own and the app asks the server instead. Purging what a
 * pre-cookie session left behind is app-shell-core's `purgeLegacyAuthStorage`, which owns the
 * canonical key list.
 *
 * The old suite read this off the source text. Here the modules are executed: the exported surface
 * is imported, the key-writing functions are called, the canonical purge is run against a real
 * localStorage, and the real steps are rendered to observe that no consumer reaches for the
 * channel.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { EnvSelectStep } = await import('../steps/EnvSelectStep.jsx');
const { SetupProgressStep } = await import('../steps/SetupProgressStep.jsx');

const SURVIVING_STATE_EXPORTS = [
  'SETUP_STEP_DEFINITIONS',
  'initialSetupSteps',
  'mapBackendStepStatus',
  'applyProgressMessage',
  'buildOnboardingPayload',
  'selectPreferredOrg',
  'isProfileStepValid',
  'isCompanyStepValid',
];

const HANDOFF_MEMBERS = [
  'ENVIRONMENT_SESSION_KEYS',
  'buildEnvironmentSessionStorage',
  'persistEnvironmentSession',
  'clearEnvironmentSession',
];

// The nine keys app-shell-core's purge owns, from its canonical list.
const LEGACY_AUTH_KEYS = [
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

const ENVIRONMENT = { clientId: 'env-1', clientName: 'Env One', adminUserName: 'user-1' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function ndjson(lines) {
  return new Response(`${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

function storedKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
  return keys;
}

function handoffKeysWritten() {
  return storedKeys().filter((key) => key.startsWith('sf_auth_'));
}

let originalLocation;
let requests;

beforeEach(() => {
  originalLocation = window.location;
  localStorage.clear();
  requests = [];
  // A full-page redirect is the point of the environment entry; give it somewhere to land instead
  // of jsdom's unimplemented navigation.
  delete window.location;
  window.location = { ...originalLocation, href: '', search: '', pathname: '/onboarding' };
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push({ path, method, headers: init.headers || {} });
    if (path.endsWith('/sws/go/session/environment')) return json({ status: 'success' });
    if (path.endsWith('/sws/go/environments')) return json({ environments: [ENVIRONMENT] });
    if (path.endsWith('/sws/go/onboarding')) {
      return ndjson([
        { type: 'progress', step: 'client', status: 'in_progress' },
        { type: 'result', success: true },
      ]);
    }
    if (path.endsWith('/sws/go/session')) return json({ status: 'success', csrfToken: 'csrf-A' });
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
  window.location = originalLocation;
  localStorage.clear();
});

describe('the onsite state surface (ETP-4576)', () => {
  it('keeps every export that is not part of the handoff', () => {
    for (const name of SURVIVING_STATE_EXPORTS) {
      expect(name in onboardingState).toBe(true);
    }
  });

  it('re-exports the surviving state members from the onboarding barrel', () => {
    for (const name of SURVIVING_STATE_EXPORTS) {
      // Identity, not a name match: the barrel must hand out the real implementation.
      expect(onboardingBarrel[name]).toBe(onboardingState[name]);
    }
  });

  it('exposes the handoff helper only as a whole, never half of it', () => {
    // A partial removal is worse than either end state: a barrel that still hands out the writer
    // while the key list is gone produces a session written under no keys at all.
    const exported = HANDOFF_MEMBERS.filter((name) => name in onboardingState);
    expect(exported).toEqual(HANDOFF_MEMBERS);
  });
});

describe('the sf_auth_* keys stay a handoff helper, never onboarding state (ETP-4576)', () => {
  it('keeps the environment preference out of the handoff keys, and writes only it', () => {
    expect(onboardingState.ENVIRONMENT_SESSION_KEYS).not.toContain(onboardingState.LAST_ENVIRONMENT_KEY);

    // The preference key is deliberately separate: it survives logout, and grouping it with the
    // session keys is how it used to get cleared along with them.
    onboardingState.rememberEnvironment('client-pref');
    expect(storedKeys()).toEqual([onboardingState.LAST_ENVIRONMENT_KEY]);
  });

  it('builds the handoff tuple under the handoff keys only', () => {
    const values = onboardingState.buildEnvironmentSessionStorage(
      ENVIRONMENT,
      { token: 'a-token', roleList: [{ id: 'role-1', orgList: [{ id: 'org-1', name: 'Root' }] }] },
    );

    expect(Object.keys(values).sort()).toEqual([...onboardingState.ENVIRONMENT_SESSION_KEYS].sort());
    expect(values[onboardingState.LAST_ENVIRONMENT_KEY]).toBeUndefined();
  });

  it('does not clear the environment preference when the handoff tuple is cleared', () => {
    onboardingState.persistEnvironmentSession(ENVIRONMENT, { token: 'a-token' });
    expect(handoffKeysWritten().length).toBeGreaterThan(0);

    onboardingState.clearEnvironmentSession();

    expect(handoffKeysWritten()).toEqual([]);
    expect(localStorage.getItem(onboardingState.LAST_ENVIRONMENT_KEY)).toBe(ENVIRONMENT.clientId);
  });
});

describe('the canonical purge is reachable from the auth barrel (ETP-4576)', () => {
  it('removes the legacy keys and leaves everything else alone', () => {
    LEGACY_AUTH_KEYS.forEach((key) => localStorage.setItem(key, 'legacy'));
    localStorage.setItem('unrelated-key', 'keep-me');

    purgeLegacyAuthStorage();

    expect(LEGACY_AUTH_KEYS.filter((key) => localStorage.getItem(key) !== null)).toEqual([]);
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('covers the whole onboarding handoff tuple, so the flow needs no second eraser', () => {
    onboardingState.persistEnvironmentSession(ENVIRONMENT, { token: 'a-token', roleList: [] });
    expect(handoffKeysWritten().length).toBeGreaterThan(0);

    purgeLegacyAuthStorage();

    expect(handoffKeysWritten()).toEqual([]);
  });
});

describe('No onboarding consumer writes the session to localStorage (ETP-4576)', () => {
  it('EnvSelectStep enters the environment on status alone, with no token and no handoff write', async () => {
    // The answer carries NO `token` (verified in EtendoGoJwtServlet.handleSessionEnvironment), so
    // gating on `data.token` would make this a silent no-op: the user clicks and nothing happens.
    render(
      <EnvSelectStep
        config={{ apiBase: '' }}
        token="csrf-A"
        accountName="Ada"
        environments={[ENVIRONMENT]} />,
    );

    fireEvent.click(screen.getByTestId('action-enter-environment-env-1'));

    await waitFor(() => { expect(window.location.href).toBe('/dashboard'); });
    expect(localStorage.getItem(onboardingState.LAST_ENVIRONMENT_KEY)).toBe(ENVIRONMENT.clientId);
    expect(handoffKeysWritten()).toEqual([]);
    // The CSRF proof travels as the request's third argument (`token` is the prop name ETP-4576
    // kept as a bridge), so the cookie session is entered with its proof of intent.
    const enterRequest = requests.find((r) => r.path.endsWith('/sws/go/session/environment'));
    expect(enterRequest.headers['X-Go-CSRF']).toBe('csrf-A');
  });

  it('EnvSelectStep delegates the logout to the flow and clears no storage of its own', () => {
    localStorage.setItem('sf_platform_token', 'legacy');
    const onLogout = vi.fn();

    render(
      <EnvSelectStep
        config={{ apiBase: '' }}
        token="csrf-A"
        accountName="Ada"
        environments={[]}
        onLogout={onLogout} />,
    );

    fireEvent.click(screen.getByTestId('onboarding-logout'));

    expect(onLogout).toHaveBeenCalledTimes(1);
    // The step holds no logout logic and no storage cleanup: the legacy key is untouched by the
    // click, and no handoff key appears.
    expect(localStorage.getItem('sf_platform_token')).toBe('legacy');
    expect(handoffKeysWritten()).toEqual([]);
  });

  it('OnboardingFlow auto-enters the only environment on status alone, with no handoff write', async () => {
    const { OnboardingFlow } = await import('../OnboardingFlow.jsx');

    render(<OnboardingFlow steps={[{ id: 'login', component: () => <p>login</p> }]} config={{ apiBase: '' }} />);

    await waitFor(() => { expect(window.location.href).toBe('/dashboard'); });
    expect(localStorage.getItem(onboardingState.LAST_ENVIRONMENT_KEY)).toBe(ENVIRONMENT.clientId);
    expect(handoffKeysWritten()).toEqual([]);
  });

  it('SetupProgressStep enters the created environment through the two-argument cookie-era API', async () => {
    const checkReadiness = vi.fn(async () => ({ ready: true }));

    render(
      <SetupProgressStep
        config={{ apiBase: '', checkReadiness }}
        stepData={{ clientName: 'Ada Inc', countryCode: 'ES' }}
        token="csrf-A" />,
    );

    // Provisioning reports success, then the step retries the environment login (2s later).
    await waitFor(() => { expect(checkReadiness).toHaveBeenCalledTimes(1); }, { timeout: 6000 });

    // Two arguments exactly: no bearer token is threaded through either cookie-era call.
    expect(checkReadiness.mock.calls[0]).toHaveLength(2);
    expect(checkReadiness.mock.calls[0][1]).toBe('');
    const environmentsCall = vi.mocked(fetch).mock.calls.find(
      ([url]) => String(url).endsWith('/sws/go/environments'),
    );
    expect(environmentsCall).toHaveLength(2);

    expect(localStorage.getItem(onboardingState.LAST_ENVIRONMENT_KEY)).toBe(ENVIRONMENT.clientId);
    expect(handoffKeysWritten()).toEqual([]);
  });
});
