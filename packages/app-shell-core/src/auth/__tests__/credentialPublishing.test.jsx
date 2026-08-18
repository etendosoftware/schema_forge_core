/**
 * ETP-4576 — AuthProvider is the ONLY writer of ./sessionCredentials.js, and this
 * suite is the only place that proves it works.
 *
 * Why it needs its own file: every suite in the HOST replaces AuthProvider with a
 * mock (src/test/authContextMock.js), because mounting the real provider in a hook
 * test is not practical. That mock publishes credentials itself, mirroring the
 * effect below — so the host suites verify that the BUILDERS honour whatever is
 * published, and nothing anywhere verified that the provider publishes the right
 * thing in the first place. That is the gap: the one link in the chain that only
 * exists in production.
 *
 * The four properties that matter:
 *   1. the mode comes from the `credentialMode` prop, defaulting to bearer;
 *   2. the credentials come from the session, not from the caller;
 *   3. a change in either republishes — a token refresh or a preference flip must
 *      take effect without a reload;
 *   4. it never publishes one scheme's credential under the other's mode.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, cleanup, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import {
  CREDENTIAL_MODES,
  getCredentialMode,
  jsonHeaders,
  resetSessionCredentials,
  writeHeaders,
} from '../sessionCredentials.js';

const TOKEN = 'session-token';
const CSRF = 'session-csrf';

// AuthProvider's default `restoreSession` is the platform cookie fetcher, which
// calls fetch on mount. jsdom has no server, so it is stubbed per test. A promise
// that never settles keeps the provider in its booting state, which is what most
// tests here want: it isolates the publishing effect from the restore flow.
const NEVER_SETTLES = () => new Promise(() => {});

beforeEach(() => {
  resetSessionCredentials();
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
});

afterEach(() => {
  cleanup();
  resetSessionCredentials();
  vi.restoreAllMocks();
});

function mount({ credentialMode, restoreSession = NEVER_SETTLES } = {}) {
  function Wrapper({ children }) {
    return (
      <AuthProvider credentialMode={credentialMode} restoreSession={restoreSession}>
        {children}
      </AuthProvider>
    );
  }
  return renderHook(() => useAuth(), { wrapper: Wrapper });
}

describe('AuthProvider publishes the credential scheme on mount', () => {
  it('defaults to the bearer scheme when no credentialMode prop is given', () => {
    // The default has to be the LEGACY scheme: a host that has not opted in must
    // keep working exactly as before. A default of cookie would silently break
    // every unmigrated deployment the moment this version shipped.
    mount();
    expect(getCredentialMode()).toBe(CREDENTIAL_MODES.bearer);
  });

  it('publishes the cookie scheme when the prop says so', () => {
    mount({ credentialMode: CREDENTIAL_MODES.cookie });
    expect(getCredentialMode()).toBe(CREDENTIAL_MODES.cookie);
  });

  it('publishes the bearer scheme for an unrecognised prop value, never a broken one', () => {
    // setSessionCredentials normalises anything that is not 'cookie' to bearer. A
    // typo in a host's prop, or a preference payload that arrives as the string
    // "true", must degrade to the working legacy scheme — not to a mode that
    // authenticates with nothing.
    mount({ credentialMode: 'not-a-scheme' });
    expect(getCredentialMode()).toBe(CREDENTIAL_MODES.bearer);
    expect(writeHeaders()).not.toHaveProperty('X-Go-CSRF');
  });
});

describe('AuthProvider publishes the credentials the session holds', () => {
  // The bearer token arrives through login(), NOT through restoreSession:
  // mapRestoredSession (session.js) deliberately keeps only the identity fields and
  // drops `token`, because the restore path exists for the cookie session, where the
  // browser never holds one. Worth stating because it is not guessable, and it is
  // why a backend-only bridge between the two schemes cannot work.
  it('feeds a logged-in bearer token into the builders', async () => {
    const { result } = mount();
    await act(async () => { result.current.login({ token: TOKEN, username: 'u' }); });

    expect(jsonHeaders()).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('feeds the restored CSRF proof into the write builder under the cookie scheme', async () => {
    const restoreSession = () => Promise.resolve({ csrfToken: CSRF, username: 'u' });
    await act(async () => {
      mount({ credentialMode: CREDENTIAL_MODES.cookie, restoreSession });
    });

    expect(writeHeaders()).toMatchObject({ 'X-Go-CSRF': CSRF });
  });

  it('publishes no credential at all before a session is restored', () => {
    // The booting window. Nothing has authenticated yet, so no header may claim
    // otherwise — a stale credential surviving here is how a logged-out tab keeps
    // issuing authenticated-looking requests.
    mount();
    expect(jsonHeaders()).not.toHaveProperty('Authorization');
    expect(writeHeaders()).not.toHaveProperty('X-Go-CSRF');
  });
});

describe('AuthProvider republishes when the scheme or the credentials change', () => {
  it('picks up a token that arrives after mount', async () => {
    const { result } = mount();
    expect(jsonHeaders()).not.toHaveProperty('Authorization');

    await act(async () => { result.current.login({ token: TOKEN, username: 'u' }); });

    expect(jsonHeaders()).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
  });

  it('flips the whole app when the credentialMode prop changes, with no remount', async () => {
    // This is the preference flip. The provider stays mounted and the session is
    // untouched; only the mode changes. If the effect did not list credentialMode
    // as a dependency, the app would keep using the old scheme until a reload —
    // which is exactly the "revertible without a redeploy" promise, broken.
    //
    // render/rerender rather than renderHook: renderHook's rerender replaces the
    // hook's props, NOT the wrapper, so a changed `credentialMode` would never
    // reach the provider and this test would pass by never testing anything.
    //
    // Both credentials are present at once, each by its own real path: the CSRF
    // proof from the restore, the bearer token from a login.
    const restoreSession = () => Promise.resolve({ csrfToken: CSRF, username: 'u' });

    let auth;
    function Probe() {
      auth = useAuth();
      return null;
    }
    const tree = (mode) => (
      <AuthProvider credentialMode={mode} restoreSession={restoreSession}>
        <Probe />
      </AuthProvider>
    );

    let rerender;
    await act(async () => { ({ rerender } = render(tree(CREDENTIAL_MODES.bearer))); });
    await act(async () => { auth.login({ token: TOKEN, username: 'u' }); });

    expect(jsonHeaders()).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
    expect(writeHeaders()).not.toHaveProperty('X-Go-CSRF');

    await act(async () => { rerender(tree(CREDENTIAL_MODES.cookie)); });

    expect(jsonHeaders()).not.toHaveProperty('Authorization');
    expect(writeHeaders()).toMatchObject({ 'X-Go-CSRF': CSRF });
  });
});

describe('AuthProvider never mixes the two schemes', () => {
  it('holds both credentials but emits only the active scheme\'s', async () => {
    // The session legitimately carries both during a migration window. The MODE
    // has to be the only thing that decides which one reaches a header — the
    // absence of a value must never be what saves us, because a session that
    // holds both is the realistic case, not the edge case.
    const restoreSession = () => Promise.resolve({ csrfToken: CSRF, username: 'u' });
    let result;
    await act(async () => {
      ({ result } = mount({ credentialMode: CREDENTIAL_MODES.cookie, restoreSession }));
    });
    await act(async () => { result.current.login({ token: TOKEN, username: 'u' }); });

    const read = jsonHeaders();
    const write = writeHeaders();

    expect(read).not.toHaveProperty('Authorization');
    expect(write).not.toHaveProperty('Authorization');
    expect(write).toMatchObject({ 'X-Go-CSRF': CSRF });
    expect(read).not.toHaveProperty('X-Go-CSRF');
  });
});
