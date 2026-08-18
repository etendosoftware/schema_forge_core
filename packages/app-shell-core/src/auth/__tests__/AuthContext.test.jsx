import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { createLocalAuthStorage, createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { CREDENTIAL_MODES } from '../sessionCredentials.js';

afterEach(cleanup);

// ETP-4576 cycle 4a — `restoreSession` stopped being opt-in: AuthProvider now
// defaults it to the platform fetcher (fetchCookieSession — GET /sws/go/session
// with credentials: 'include'). That has two file-wide consequences here, and
// both are handled below rather than inside individual tests:
//
// 1. EVERY <AuthProvider> mounted without the prop now calls `fetch` on mount.
//    jsdom has no server, so an unstubbed call would either hit the network or
//    blow up with an unhandled rejection. The `beforeEach` stub answers 401 —
//    the real "no active session" response — which keeps the fail-closed path
//    (status -> 'anonymous', no session) deterministic and offline, i.e. the
//    same anonymous outcome the pre-existing tests already assumed. It doubles
//    as the probe used to assert HOW the default fetcher calls the endpoint.
//
// 2. The fail-closed path runs logout(): it clears the session AND bumps the
//    selectRole stale-response guard. Suites whose subject is NOT the restore
//    (the ETP-4520 windowAccess/capabilities ones, the csrfToken ones) would
//    then race against that late logout — e.g. the hydration test seeds
//    `initialSession: { token, selectedRole }` and asserts the fetched
//    windowAccess sticks, which a 401-driven logout would wipe. So the shared
//    `wrapperWith()` helper (and the two inline wrappers of those suites)
//    neutralise the default with a never-settling `restoreSession` override:
//    the provider stays in 'booting' forever, no purge/logout ever fires, and
//    nothing else those tests assert changes. They keep verifying exactly what
//    they verified before, without being coupled to the new fetcher.
//
// Suites that DO exercise the default mount <AuthProvider> directly, with no
// `restoreSession` prop at all.
const NEVER_SETTLES = () => new Promise(() => {});

let fetchStub;
beforeEach(() => {
  fetchStub = vi.fn(async () => ({
    ok: false,
    status: 401,
    json: async () => {
      throw new Error('a 401 session response has no JSON body');
    },
  }));
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapperWith({ fetchWindowAccess, restoreSession = NEVER_SETTLES } = {}) {
  return function Wrapper({ children }) {
    return (
      <AuthProvider
        storage={createMemoryAuthStorage()}
        fetchWindowAccess={fetchWindowAccess}
        restoreSession={restoreSession}>
        {children}
      </AuthProvider>
    );
  };
}

describe('AuthContext — windowAccess/capabilities (ETP-4520)', () => {
  it('defaults windowAccess and capabilities to {} before any role is selected', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('calls fetchWindowAccess with the just-persisted session when a role is selected', async () => {
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });

    expect(fetchWindowAccess).toHaveBeenCalledTimes(1);
    const [sessionArg] = fetchWindowAccess.mock.calls[0];
    expect(sessionArg.selectedRole).toEqual({ id: 'role-1' });

    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });
    expect(result.current.capabilities).toEqual({ showAccountingFields: true });
  });

  it('does not block role selection on the network round trip (fire-and-forget)', async () => {
    let resolveFetch;
    const fetchWindowAccess = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    act(() => {
      result.current.selectRole({ id: 'role-1' });
    });

    // selectRole returns synchronously; the session is already updated even
    // though the window-access fetch is still pending.
    expect(result.current.selectedRole).toEqual({ id: 'role-1' });
    expect(result.current.windowAccess).toEqual({});

    // The actual fetchWindowAccess() call is deferred one microtask (so a
    // synchronous throw is caught too) — flush it before resolving.
    await act(async () => {
      await Promise.resolve();
    });
    resolveFetch({ windowAccess: {}, capabilities: {} });
  });

  it('leaves fail-closed defaults in place when fetchWindowAccess rejects', async () => {
    const fetchWindowAccess = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });

    await waitFor(() => {
      expect(fetchWindowAccess).toHaveBeenCalledTimes(1);
    });
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('is a no-op when no fetchWindowAccess prop is configured', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });

    expect(result.current.selectedRole).toEqual({ id: 'role-1' });
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('clears windowAccess and capabilities when the role is deselected', async () => {
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });
    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });

    act(() => {
      result.current.selectRole(null);
    });

    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('clears windowAccess and capabilities on logout', async () => {
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });
    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('fails closed WHILE loading when switching from a role with full access to a new role', async () => {
    let resolveFirst;
    const fetchWindowAccess = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(() => {})); // never resolves for the second role

    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    // First role gets full access/capabilities.
    act(() => {
      result.current.selectRole({ id: 'role-admin' });
    });
    // The fetchWindowAccess() call is deferred one microtask — flush it so
    // `resolveFirst` is assigned before we call it.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      resolveFirst({
        windowAccess: { '147': 'full' },
        capabilities: { showAccountingFields: true },
      });
    });
    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });
    expect(result.current.capabilities).toEqual({ showAccountingFields: true });

    // Switch to a new (restricted) role — the fetch for it never resolves in
    // this test, so we can assert the intermediate state synchronously.
    act(() => {
      result.current.selectRole({ id: 'role-restricted' });
    });

    // Fail closed WHILE loading, not the stale admin maps from the previous role.
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('does not crash and fails closed when fetchWindowAccess throws synchronously', async () => {
    const fetchWindowAccess = vi.fn(() => {
      throw new Error('synchronous boom');
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    expect(() => {
      act(() => {
        result.current.selectRole({ id: 'role-1' });
      });
    }).not.toThrow();

    await waitFor(() => {
      expect(fetchWindowAccess).toHaveBeenCalledTimes(1);
    });
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('discards a stale response that arrives after a newer selectRole call (ETP-4520 race)', async () => {
    let resolveRoleA;
    let resolveRoleB;
    const fetchWindowAccess = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRoleA = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRoleB = resolve; }));

    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    // Select role A — its fetch is slow and controlled manually.
    act(() => {
      result.current.selectRole({ id: 'role-A' });
    });
    // Flush the deferred microtask so resolveRoleA is assigned.
    await act(async () => {
      await Promise.resolve();
    });

    // Before A resolves, select role B — its fetch is controlled manually too.
    act(() => {
      result.current.selectRole({ id: 'role-B' });
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Resolve B first (fast response), then A (slow, stale response) — out
    // of call order, simulating the network race.
    await act(async () => {
      resolveRoleB({ windowAccess: { '200': 'full' }, capabilities: { roleB: true } });
    });
    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '200': 'full' });
    });
    expect(result.current.capabilities).toEqual({ roleB: true });

    await act(async () => {
      resolveRoleA({ windowAccess: { '100': 'read-only' }, capabilities: { roleA: true } });
    });

    // The stale, later-arriving response for the abandoned role-A request
    // must be discarded — state still reflects role B's data.
    expect(result.current.windowAccess).toEqual({ '200': 'full' });
    expect(result.current.capabilities).toEqual({ roleB: true });
  });

  it('discards an in-flight selectRole response that resolves after logout (ETP-4520 race)', async () => {
    let resolveFetch;
    const fetchWindowAccess = vi.fn(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    // Select a role — its fetch is slow and controlled manually.
    act(() => {
      result.current.selectRole({ id: 'role-1' });
    });
    // Flush the deferred microtask so resolveFetch is assigned.
    await act(async () => {
      await Promise.resolve();
    });

    // Logout before the fetch resolves.
    act(() => {
      result.current.logout();
    });
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});

    // The abandoned request now resolves with the pre-logout role's data.
    await act(async () => {
      resolveFetch({ windowAccess: { '147': 'full' }, capabilities: { showAccountingFields: true } });
    });

    // The stale response must be discarded — post-logout state stays empty.
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
  });

  it('fetches window access on mount when the initial/persisted session already has a selectedRole (hydration, ETP-4520)', async () => {
    // Regression: a host app whose login flow sets `selectedRole` directly via
    // login()/setSession() (or a page reload rehydrating a persisted session)
    // rather than calling selectRole() itself must still get its window access
    // fetched — otherwise windowAccess/capabilities stay fail-closed forever.
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider
          storage={createMemoryAuthStorage()}
          fetchWindowAccess={fetchWindowAccess}
          restoreSession={NEVER_SETTLES}
          initialSession={{ token: 'tok', selectedRole: { id: 'role-1' } }}>
          {children}
        </AuthProvider>
      ),
    });

    await waitFor(() => {
      expect(fetchWindowAccess).toHaveBeenCalledTimes(1);
    });
    const [sessionArg] = fetchWindowAccess.mock.calls[0];
    expect(sessionArg.selectedRole).toEqual({ id: 'role-1' });

    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });
    expect(result.current.capabilities).toEqual({ showAccountingFields: true });
  });

  it('does not double-fetch when selectRole() is called explicitly (hydration effect no-ops for the same role)', async () => {
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    await act(async () => {
      result.current.selectRole({ id: 'role-1' });
    });
    await waitFor(() => {
      expect(result.current.windowAccess).toEqual({ '147': 'full' });
    });

    expect(fetchWindowAccess).toHaveBeenCalledTimes(1);
  });

  it('does not fetch on mount when there is no persisted/initial selectedRole', () => {
    const fetchWindowAccess = vi.fn();
    renderHook(() => useAuth(), { wrapper: wrapperWith({ fetchWindowAccess }) });

    expect(fetchWindowAccess).not.toHaveBeenCalled();
  });

  it('exposes setWindowAccess/setCapabilities for callers that fetch externally', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setWindowAccess({ '147': 'read-only' });
      result.current.setCapabilities({ showAccountingFields: false });
    });

    expect(result.current.windowAccess).toEqual({ '147': 'read-only' });
    expect(result.current.capabilities).toEqual({ showAccountingFields: false });
  });
});

// ETP-4576 cycle 3 — in-memory csrfToken. The CSRF token backing the
// `X-Go-CSRF` header (ADR-0001) is issued by the backend in session
// responses and must live ONLY in memory, never in `session`/authStorage —
// unlike the legacy bearer token it replaces for unsafe-method requests.
describe('AuthContext — csrfToken (ETP-4576)', () => {
  it('defaults csrfToken to null before any change', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    expect(result.current.csrfToken).toBeNull();
  });

  it('exposes setCsrfToken in the context value and updates csrfToken when called', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    expect(typeof result.current.setCsrfToken).toBe('function');

    act(() => {
      result.current.setCsrfToken('csrf-abc123');
    });

    expect(result.current.csrfToken).toBe('csrf-abc123');
  });

  it('clears csrfToken back to null on logout', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setCsrfToken('csrf-abc123');
    });
    expect(result.current.csrfToken).toBe('csrf-abc123');

    act(() => {
      result.current.logout();
    });

    expect(result.current.csrfToken).toBeNull();
  });

  it('never persists csrfToken into authStorage — it is memory-only, not part of session', () => {
    const storage = createMemoryAuthStorage();
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider storage={storage} restoreSession={NEVER_SETTLES}>{children}</AuthProvider>
      ),
    });

    act(() => {
      result.current.setCsrfToken('csrf-should-not-persist');
    });
    expect(result.current.csrfToken).toBe('csrf-should-not-persist');

    // The underlying storage is only ever written to via persistSession()
    // (session/logout/selectRole/selectOrg) — csrfToken must never travel
    // through that path, under any session key.
    const persisted = storage.read();
    expect(JSON.stringify(persisted)).not.toContain('csrf-should-not-persist');
  });
});

// ETP-4576 cycle 4 — session restore on mount. AuthProvider takes a
// `restoreSession` fetcher and exposes a tri-state `status` field
// ('booting' | 'authenticated' | 'anonymous') on the context value.
//
// Cycle 4a — CONTRACT CHANGE: the prop is no longer opt-in. It now defaults to
// the platform fetcher (fetchCookieSession, exported by ./api.js), so a host
// that passes nothing still consults GET /sws/go/session.
describe('AuthContext — session restore (ETP-4576)', () => {
  afterEach(() => {
    // These tests seed real localStorage keys (jsdom) to exercise the legacy
    // purge; keep them from leaking into other tests in this file/run.
    window.localStorage.clear();
  });

  // ETP-4576 — this describe pins the COOKIE scheme's restore contract: with
  // `credentialMode` set to cookie, the platform fetcher is the default of the
  // `restoreSession` prop, so opting into the scheme is enough and no host has to
  // wire the fetcher by hand.
  //
  // Two earlier revisions of this block are worth knowing about, because each was
  // right about something. It first pinned OPT-IN semantics (no prop, no server
  // call), which left a hole: tools/etendo-go-ar/app-shell mounts <AuthProvider>
  // with no props at all, and once onboarding stopped writing the sf_auth_*
  // handoff keys that host had nothing to read — isAuthenticated false forever.
  // It was then inverted to make the fetcher an UNCONDITIONAL default, which
  // closed that hole but forced the cookie scheme on every other host, migrated
  // or not, and is why ETP-4576 had to be reverted (PR #111).
  //
  // Deriving the default from `credentialMode` satisfies both: the onboarding host
  // opts in explicitly (it does so in its own App.jsx now) and everyone else stays
  // on the bearer token. The tests below therefore all select the cookie scheme —
  // what they verify is unchanged, only the premise is now stated instead of
  // assumed.
  describe('under the cookie scheme, the platform fetcher is the restoreSession default', () => {
    it('starts in "booting" instead of resolving status synchronously, even when the initial session already carries a token', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()} initialSession={{ token: 'tok-1' }}>
            {children}
          </AuthProvider>
        ),
      });

      // The server is now the source of truth for a host that passes nothing,
      // exactly like one that passes its own fetcher: a leftover client-side
      // token must not be enough to declare the user authenticated.
      expect(result.current.status).toBe('booting');
    });

    it('settles to "anonymous" once the default fetcher gets the 401 "no active session" answer', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('anonymous');
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.csrfToken).toBeNull();
    });

    it('settles to "authenticated" with the restored csrfToken when the default fetcher gets a session', async () => {
      fetchStub.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          account: { name: 'Ada' },
          environment: { clientId: 'client-1', roleId: 'role-1', orgId: 'org-1' },
          roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
          csrfToken: 'csrf-from-default-fetcher',
        }),
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
      expect(result.current.csrfToken).toBe('csrf-from-default-fetcher');
      expect(result.current.username).toBe('Ada');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('asks GET /sws/go/session with the cookie attached and never sends an Authorization/Bearer header', async () => {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(fetchStub).toHaveBeenCalledTimes(1);
      });

      const [url, init = {}] = fetchStub.mock.calls[0];
      expect(String(url)).toMatch(/\/sws\/go\/session$/);
      // The whole point of the migration: the session travels in the httpOnly
      // __Host- cookie, so the request must opt into sending credentials and
      // must NOT carry a client-held token in any header.
      expect(init.credentials).toBe('include');
      expect((init.method || 'GET').toUpperCase()).toBe('GET');
      const serializedRequest = JSON.stringify(init);
      expect(serializedRequest).not.toMatch(/Authorization/i);
      expect(serializedRequest).not.toMatch(/Bearer/i);
    });

    it('purges the legacy sf_auth_* localStorage keys on mount (the default fetcher makes the purge unconditional)', async () => {
      window.localStorage.setItem('sf_auth_token', 'legacy-existing-token');

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()}>{children}</AuthProvider>
        ),
      });

      // Inverted from the old 'does not purge ... (zero side effects for
      // opted-out hosts)' test: there is no opted-out host any more, and the
      // stale handoff keys are exactly what must not survive the boot.
      expect(window.localStorage.getItem('sf_auth_token')).toBeNull();

      await waitFor(() => {
        expect(result.current.status).toBe('anonymous');
      });
    });

    it('lets a host-supplied restoreSession override the default — the platform fetcher is never called', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { name: 'Ada' },
        environment: null,
        roleList: [],
        csrfToken: 'csrf-from-host-fetcher',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider credentialMode={CREDENTIAL_MODES.cookie} storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
      expect(restoreSession).toHaveBeenCalledTimes(1);
      expect(result.current.csrfToken).toBe('csrf-from-host-fetcher');
      // No leaked call to the real fetcher: the default must be *replaced*, not
      // raced alongside the host's own implementation.
      expect(fetchStub).not.toHaveBeenCalled();
    });
  });

  describe('with restoreSession provided', () => {
    it('starts in "booting" status synchronously on the first render, before the restore promise settles', () => {
      // Never resolves within this test — we only assert the synchronous,
      // first-render value.
      const restoreSession = vi.fn(() => new Promise(() => {}));
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider
            storage={createMemoryAuthStorage()}
            initialSession={{ token: 'tok-1' }}
            restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      // Booting regardless of what the initial/persisted session says — the
      // restore result is the source of truth once restoreSession is wired.
      expect(result.current.status).toBe('booting');
    });

    it('purges legacy auth storage once on mount, before the restore promise resolves (success case)', async () => {
      window.localStorage.setItem('sf_auth_token', 'legacy-existing-token');
      const restoreSession = vi.fn().mockResolvedValue({
        account: { id: 'acc-1' },
        environment: { id: 'env-1' },
        roleList: [{ id: 'role-1' }],
        csrfToken: 'csrf-restored-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      // The purge runs synchronously in the mount effect — it must already
      // be gone even before the restore promise has had a chance to settle.
      expect(window.localStorage.getItem('sf_auth_token')).toBeNull();

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
    });

    it('purges legacy auth storage once on mount even when the restore promise rejects (failure case)', async () => {
      window.localStorage.setItem('sf_auth_token', 'legacy-existing-token');
      const restoreSession = vi.fn().mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      expect(window.localStorage.getItem('sf_auth_token')).toBeNull();

      await waitFor(() => {
        expect(result.current.status).toBe('anonymous');
      });
    });

    it('resolves to "authenticated" with the restored csrfToken once the restore promise succeeds', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { id: 'acc-1' },
        environment: { id: 'env-1' },
        roleList: [{ id: 'role-1' }],
        csrfToken: 'csrf-restored-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
      expect(result.current.csrfToken).toBe('csrf-restored-abc');
    });

    it('resolves to "anonymous" with csrfToken null and clears any existing session when restoreSession resolves null', async () => {
      const restoreSession = vi.fn().mockResolvedValue(null);
      // Seed a session that already looks logged-in, so we can prove it gets
      // actively cleared rather than just happening to start empty.
      const storage = createMemoryAuthStorage({ token: 'stale-token', username: 'stale-user' });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('anonymous');
      });
      expect(result.current.csrfToken).toBeNull();
      // Cleared as if logout() had run.
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('resolves to "anonymous" fail-closed when the restore promise rejects, without throwing or leaving an unhandled rejection', async () => {
      const restoreSession = vi.fn().mockRejectedValue(new Error('network error'));
      const storage = createMemoryAuthStorage({ token: 'stale-token', username: 'stale-user' });

      let result;
      expect(() => {
        ({ result } = renderHook(() => useAuth(), {
          wrapper: ({ children }) => (
            <AuthProvider storage={storage} restoreSession={restoreSession}>
              {children}
            </AuthProvider>
          ),
        }));
      }).not.toThrow();

      await waitFor(() => {
        expect(result.current.status).toBe('anonymous');
      });
      expect(result.current.csrfToken).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('does not call restoreSession more than once even when the component re-renders', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { id: 'acc-1' },
        environment: { id: 'env-1' },
        roleList: [{ id: 'role-1' }],
        csrfToken: 'csrf-restored-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
      expect(restoreSession).toHaveBeenCalledTimes(1);

      // Force a re-render via an existing, unrelated action — must not
      // re-trigger the mount-only restore.
      act(() => {
        result.current.selectOrg({ id: 'org-1' });
      });

      expect(restoreSession).toHaveBeenCalledTimes(1);
    });

    // ETP-4576 cycle 14 — real bug: `isAuthenticated` was computed as
    // `!!session.token` only, but a `restoreSession` host never populates
    // `session.token` (it only moves `status` to 'authenticated' and sets
    // `csrfToken`). So a successfully-restored session still reported
    // isAuthenticated === false, and AuthGate (AppShellRuntime.jsx) sent an
    // authenticated user to the "not authenticated" fallback.
    it('reflects isAuthenticated === true once a restoreSession-backed session reaches "authenticated" status, even though session.token stays unpopulated', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { id: 'acc-1' },
        environment: { id: 'env-1' },
        roleList: [{ id: 'role-1' }],
        csrfToken: 'csrf-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      // The bug: session.token is never populated by restoreSession, so
      // isAuthenticated must derive from `status`, not just `session.token`.
      expect(result.current.token).toBeFalsy();
      expect(result.current.isAuthenticated).toBe(true);
    });

    // ETP-4576 cycle 15 — the restore effect only set csrfToken + status, so
    // every session-shaped field (username, clientId, roleList, selectedRole,
    // selectedOrg) stayed empty on cookie-migrated hosts. Consumers that read
    // them were broken: DataProvider scopes its cache by client/role/org,
    // useCurrency needs the client, and the host UserAvatarButton renders
    // selectedRole?.name / selectedOrg?.name. These tests assert the effect
    // now maps the payload through mapRestoredSession.
    it('maps the restored payload onto the session state, resolving the role and org objects from the environment IDs', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { name: 'Ada' },
        environment: { clientId: 'client-1', roleId: 'role-1', orgId: 'org-1' },
        roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
        csrfToken: 'csrf-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      expect(result.current.username).toBe('Ada');
      expect(result.current.clientId).toBe('client-1');
      // The full objects, not the IDs the backend sent.
      expect(result.current.selectedRole).toMatchObject({ id: 'role-1', name: 'Admin' });
      expect(result.current.selectedOrg).toMatchObject({ id: 'org-1', name: 'Main Org' });
      expect(result.current.roleList).toEqual([
        { id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] },
      ]);
    });

    it('still reaches "authenticated" with null selectedRole/selectedOrg when the restored session has no environment yet', async () => {
      // Logged in but no environment entered (no client/role/org chosen) — a
      // real backend response shape, and it must not block the boot.
      const restoreSession = vi.fn().mockResolvedValue({
        account: { name: 'Ada' },
        environment: null,
        roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
        csrfToken: 'csrf-abc',
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });

      expect(result.current.username).toBe('Ada');
      expect(result.current.clientId).toBeNull();
      expect(result.current.selectedRole).toBeNull();
      expect(result.current.selectedOrg).toBeNull();
      // The available roles still reach the role picker.
      expect(result.current.roleList).toHaveLength(1);
    });

    it('does not persist the restored session into authStorage — the server response is authoritative, and persisting would undo the legacy purge', async () => {
      const restoreSession = vi.fn().mockResolvedValue({
        account: { name: 'Ada' },
        environment: { clientId: 'client-1', roleId: 'role-1', orgId: 'org-1' },
        roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
        csrfToken: 'csrf-abc',
      });
      const storage = createMemoryAuthStorage();

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} restoreSession={restoreSession}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('authenticated');
      });
      // The mapping did land in the context...
      expect(result.current.username).toBe('Ada');

      // ...but nothing was written back to storage: the same effect purges the
      // legacy sf_auth_* keys right before restoring, so persisting here would
      // immediately rewrite them and defeat the purge.
      const persisted = storage.read();
      expect(persisted.username).toBeNull();
      expect(persisted.clientId).toBeNull();
      expect(persisted.selectedRole).toBeNull();
      expect(persisted.selectedOrg).toBeNull();
      expect(persisted.roleList).toEqual([]);
      expect(JSON.stringify(persisted)).not.toContain('Ada');
    });
  });
});

// ETP-4576 cycle 14 — regression guard for the isAuthenticated fix above,
// readapted in cycle 4a. Its original premise ("legacy hosts compute `status`
// once, synchronously, and it stays frozen at 'anonymous' forever") is gone
// with the default fetcher: every host now boots 'booting' and then settles
// from the server's answer. The assertion it protects is unchanged and still
// load-bearing, though: `status` only ever reaches 'authenticated' through the
// restore path, so a host whose server says "no session" (401 -> 'anonymous')
// and then performs a legacy in-app login() would never flip isAuthenticated if
// that flag derived from `status` alone. It must keep falling back to
// `!!session.token`.
// ETP-4576 — logout must revoke the session SERVER-SIDE. Real gap found in this
// branch: nothing in the frontend ever called DELETE /sws/go/session. Logout was
// purely client-side (clear state + authStorage), which was survivable with a
// localStorage bearer token — deleting the token was the logout — but is a
// security hole with the `__Host-` cookie: the cookie is httpOnly, JS cannot
// delete it, so it survives the "logout" and the session stays valid on the
// server. Only the backend endpoint (ETP-4575) can revoke it.
//
// Design constraints the tests below pin down:
//   1. `logout()` stays SYNCHRONOUS. Every caller (LogoutRoute, the fail-closed
//      restore path, OnboardingFlow's cleanup) uses it fire-and-forget; making it
//      async would break them and delay the UI on a network round trip. So the
//      DELETE is dispatched without await and local state is cleared immediately.
//   2. The CSRF token must be captured BEFORE it is cleared. `logout()` calls
//      setCsrfToken(null); reading the token after that (or letting the request
//      read it late) sends an empty X-Go-CSRF and the backend answers 403 — the
//      easiest bug to introduce here, and a silent one, since local logout would
//      still look fine.
//   3. A failing DELETE must not block or throw. The user asked to leave.
//
// All wrappers here pass restoreSession={NEVER_SETTLES}, so the shared `fetchStub`
// records the logout request and nothing else.
describe('AuthContext — logout revokes the session server-side (ETP-4576)', () => {
  function deleteSessionCalls() {
    return fetchStub.mock.calls.filter(([url, init = {}]) => (
      (init.method || '').toUpperCase() === 'DELETE' && /\/sws\/go\/session$/.test(String(url))
    ));
  }

  it('fires a DELETE /sws/go/session when logout() is called', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
    const [, init = {}] = deleteSessionCalls()[0];
    // The cookie is the credential, so it has to be allowed to travel.
    expect(init.credentials).toBe('include');
  });

  it('sends the X-Go-CSRF header with the token the session held BEFORE the logout cleared it', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setCsrfToken('csrf-abc');
    });
    expect(result.current.csrfToken).toBe('csrf-abc');

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
    const [, init = {}] = deleteSessionCalls()[0];
    // The bug this guards: reading csrfToken after setCsrfToken(null) sends an
    // empty proof and the backend 403s, so the session is never revoked.
    expect(init.headers?.['X-Go-CSRF']).toBe('csrf-abc');
  });

  it('never sends an Authorization header or a Bearer scheme on the logout request', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setCsrfToken('csrf-abc');
    });
    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
    const [, init = {}] = deleteSessionCalls()[0];
    const serialized = JSON.stringify(init);
    expect(serialized).not.toMatch(/Authorization/i);
    expect(serialized).not.toMatch(/Bearer/i);
  });

  it('stays synchronous: local state is fully cleared immediately after logout(), with no await or waitFor', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setCsrfToken('csrf-abc');
      result.current.setWindowAccess({ '147': 'full' });
      result.current.setCapabilities({ showAccountingFields: true });
      result.current.login({ token: 'tok-1', username: 'Ada' });
    });
    expect(result.current.isAuthenticated).toBe(true);

    // Not awaited, not wrapped in waitFor: the DELETE is fire-and-forget, so the
    // UI-visible state must already be anonymous when logout() returns.
    let returned = 'sentinel';
    act(() => {
      returned = result.current.logout();
    });

    expect(returned).toBeUndefined();
    expect(result.current.csrfToken).toBeNull();
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
    expect(result.current.token).toBeNull();
    expect(result.current.username).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('still clears local state and does not throw when the DELETE fails (offline / 403 / 500)', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    act(() => {
      result.current.setCsrfToken('csrf-abc');
      result.current.setWindowAccess({ '147': 'full' });
      result.current.login({ token: 'tok-1' });
    });

    expect(() => {
      act(() => {
        result.current.logout();
      });
    }).not.toThrow();

    expect(result.current.csrfToken).toBeNull();
    expect(result.current.windowAccess).toEqual({});
    expect(result.current.capabilities).toEqual({});
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    // The rejection was attempted and swallowed — no unhandled rejection.
    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
  });
});

// ETP-4576 cycle 4b — THE LAST WRITER. Everything else in this epic removed a
// *reader* of the `sf_auth_*` localStorage channel: the handoff between page
// loads is gone, the session lives in the httpOnly `__Host-` cookie, the
// provider restores from the server on mount, and logout revokes server-side.
// One writer survived all of it: `authStorage` defaulted to
// createLocalAuthStorage(), so persistSession() — reached from login(),
// setSession(), selectRole() and selectOrg() — kept writing the token, the
// username, the client id, the role list and the selected role/org straight
// back into localStorage on every session change, for every host that passes no
// `storage` prop. The mount purge deleted those keys once and then the very
// first login re-created them. That is exactly the class of persistence SEC-10
// is about, so the default flips to createMemoryAuthStorage().
//
// What is NOT changing:
//   * the `storage` prop keeps the same priority — a host that wants its own
//     storage (including localStorage) still injects it;
//   * createLocalAuthStorage stays exported. It is published API of a package
//     with consumers we cannot see, and the PRD keeps it "for migration/tests".
//     It simply stops being what you get by default.
//
// What the flip costs, and why it costs nothing: a per-mount memory storage no
// longer survives a page load. It does not need to — restoreSession is now the
// platform default (cycle 4a), so every mount asks GET /sws/go/session who the
// user is. The storage is reduced to per-mount scratch space.
describe('AuthContext — the default auth storage is memory, never localStorage (ETP-4576)', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  // jsdom's Storage is not a plain object; enumerate it through the index API.
  function localStorageKeys() {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      keys.push(window.localStorage.key(i));
    }
    return keys;
  }

  function legacyAuthKeys() {
    return localStorageKeys().filter((key) => /^sf_auth_|^sf_platform_/.test(key));
  }

  function defaultStorageWrapper(props = {}) {
    // Deliberately NO `storage` prop — the whole subject of this suite.
    return function Wrapper({ children }) {
      return <AuthProvider {...props}>{children}</AuthProvider>;
    };
  }

  it('writes nothing to localStorage when login() persists a session (THE last-writer test)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: defaultStorageWrapper() });

    // Let the default fetcher's 401 settle FIRST. This is what makes the
    // assertion below mean "persistSession never wrote" rather than "it wrote
    // and the mount purge happened to erase it": the purge runs once, inside
    // the mount effect, and by the time `status` is 'anonymous' it is long
    // finished. Anything found in localStorage after this point was written by
    // the login() below.
    await waitFor(() => {
      expect(result.current.status).toBe('anonymous');
    });
    expect(legacyAuthKeys()).toEqual([]);

    // Vacuity guard: prove localStorage is live and observable in this
    // environment, so an empty result is a real "nothing was written" and not a
    // silently unavailable Storage.
    window.localStorage.setItem('unrelated_key', 'kept');

    act(() => {
      result.current.login({ token: 'tok', username: 'Ada', clientId: 'client-1' });
    });

    // persistSession DID run — the session is in the context...
    expect(result.current.token).toBe('tok');
    expect(result.current.username).toBe('Ada');
    expect(result.current.isAuthenticated).toBe(true);

    // ...and it went to memory only. No credential, no session context, on disk.
    expect(legacyAuthKeys()).toEqual([]);
    expect(window.localStorage.getItem('sf_auth_token')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_user')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_client_id')).toBeNull();
    expect(window.localStorage.getItem('unrelated_key')).toBe('kept');
  });

  it('writes nothing to localStorage when selectRole() and selectOrg() persist through the default storage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: defaultStorageWrapper() });

    await waitFor(() => {
      expect(result.current.status).toBe('anonymous');
    });

    act(() => {
      result.current.selectRole({ id: 'role-1', name: 'Admin' });
    });
    act(() => {
      result.current.selectOrg({ id: 'org-1', name: 'Main Org' });
    });

    expect(result.current.selectedRole).toMatchObject({ id: 'role-1' });
    expect(result.current.selectedOrg).toMatchObject({ id: 'org-1' });

    // The two session mutations a logged-in user triggers most often — the role
    // and org pickers — are also persistSession() call sites, so they were
    // writers too.
    expect(window.localStorage.getItem('sf_auth_selected_role')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_selected_org')).toBeNull();
    expect(legacyAuthKeys()).toEqual([]);
  });

  it('writes nothing to localStorage when a restored cookie session settles on a host that passes no storage', async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        account: { name: 'Ada' },
        environment: { clientId: 'client-1', roleId: 'role-1', orgId: 'org-1' },
        roleList: [{ id: 'role-1', name: 'Admin', orgList: [{ id: 'org-1', name: 'Main Org' }] }],
        csrfToken: 'csrf-abc',
      }),
    });

    // The cookie scheme is declared, not inherited: there IS no restore under the
    // bearer default, so without this the session never settles and the test would
    // be asserting "nothing was written" about a request that never happened.
    // `storage` is still deliberately absent — that is this suite's subject.
    const { result } = renderHook(() => useAuth(), {
      wrapper: defaultStorageWrapper({ credentialMode: CREDENTIAL_MODES.cookie }),
    });

    await waitFor(() => {
      expect(result.current.status).toBe('authenticated');
    });
    expect(result.current.username).toBe('Ada');

    // The restore path already avoided persisting (it would undo its own
    // purge); with the memory default there is no longer any path back to disk
    // at all, not even the csrfToken via a later session mutation.
    expect(legacyAuthKeys()).toEqual([]);
    expect(JSON.stringify(localStorageKeys())).not.toContain('sf_auth');
    expect(window.localStorage.getItem('sf_auth_client_name')).toBeNull();
  });

  it('does not hydrate the initial session from leftover sf_auth_* keys left in localStorage', () => {
    // A machine that ran the pre-cookie build has these on disk. With
    // createLocalAuthStorage() as the default, the useState initializer read
    // them back on the very first render — resurrecting a stale token, user,
    // client and role selection from a previous tenant before the purge in the
    // mount effect had even run (and the purge only clears storage, it never
    // resets the state that was already seeded from it).
    window.localStorage.setItem('sf_auth_token', 'legacy-token');
    window.localStorage.setItem('sf_auth_user', 'legacy-user');
    window.localStorage.setItem('sf_auth_client_id', 'legacy-client');
    window.localStorage.setItem('sf_auth_selected_role', JSON.stringify({ id: 'legacy-role' }));

    // NEVER_SETTLES keeps the provider in 'booting', so nothing after the first
    // render can clear the session — whatever we observe was seeded (or not) by
    // the default storage's read() alone.
    const { result } = renderHook(() => useAuth(), {
      wrapper: defaultStorageWrapper({ restoreSession: NEVER_SETTLES }),
    });

    expect(result.current.status).toBe('booting');
    expect(result.current.token).toBeNull();
    expect(result.current.username).toBeNull();
    expect(result.current.clientId).toBeNull();
    expect(result.current.selectedRole).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('still gives the storage prop priority over the new memory default', async () => {
    const writes = [];
    const injectedStorage = {
      read: () => ({}),
      write: (session) => writes.push(session),
      clear: () => writes.push('clear'),
    };

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider storage={injectedStorage} restoreSession={NEVER_SETTLES}>
          {children}
        </AuthProvider>
      ),
    });

    act(() => {
      result.current.login({ token: 'tok', username: 'Ada' });
    });

    // The prop is honoured exactly as before — the default changed, the
    // precedence did not.
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ token: 'tok', username: 'Ada' });
    expect(legacyAuthKeys()).toEqual([]);
  });

  it('lets a host opt back into localStorage persistence by injecting createLocalAuthStorage()', async () => {
    // The escape hatch the PRD keeps: createLocalAuthStorage is no longer the
    // default, but it is still exported and still works when injected, so any
    // consumer that genuinely wants the old behavior (or a migration shim) is
    // not broken by this cycle.
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider storage={createLocalAuthStorage()} restoreSession={NEVER_SETTLES}>
          {children}
        </AuthProvider>
      ),
    });

    act(() => {
      result.current.login({ token: 'tok-opted-in' });
    });

    expect(window.localStorage.getItem('sf_auth_token')).toBe('tok-opted-in');
  });

  it('keeps createLocalAuthStorage exported from the auth barrel — it stops being the default, it is not deleted', async () => {
    const barrel = await import('../index.js');

    expect(typeof barrel.createLocalAuthStorage).toBe('function');
    expect(typeof barrel.createMemoryAuthStorage).toBe('function');
  });
});

describe('AuthContext — isAuthenticated legacy fallback (ETP-4576 cycle 14 regression guard)', () => {
  it('is false once the default restore settles to "anonymous", then becomes true after a post-mount login() even though status stays "anonymous"', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider storage={createMemoryAuthStorage()}>{children}</AuthProvider>
      ),
    });

    // Let the default fetcher's 401 settle first, so the post-mount login() is
    // tested against a fully-booted anonymous provider (and so the fail-closed
    // logout() cannot land afterwards and wipe the token we are about to set).
    await waitFor(() => {
      expect(result.current.status).toBe('anonymous');
    });
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.login({ token: 'tok-1' });
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
