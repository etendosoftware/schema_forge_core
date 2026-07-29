import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';

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

  // ETP-4576 cycle 4a — this describe used to be
  // 'without restoreSession (default, backward-compatible behavior)' and pinned
  // the OPT-IN semantics: a host that did not pass the prop kept the legacy
  // synchronous mode (status resolved from localStorage on the first render, no
  // purge, no server call). That opt-out is deleted, and its three tests are
  // inverted here, because it left a hole with no way out: three separate
  // consumers already needed the very same GET /sws/go/session fetcher, and one
  // of them — tools/etendo-go-ar/app-shell — mounts <AuthProvider> with no
  // props at all. Once the onboarding flow stopped writing the `sf_auth_*`
  // handoff keys (same epic), the legacy path had nothing left to read: that
  // host's isAuthenticated was false forever and its AuthGuard never let anyone
  // through. Making the platform fetcher the DEFAULT of the prop closes the
  // hole without every host having to be migrated by hand, and removes the
  // duplicated fetcher. Consequence: `restoreSession` is ALWAYS a function, so
  // the synchronous legacy mode is gone — every host boots in 'booting', purges
  // the legacy keys, and asks the server who it is.
  describe('without an explicit restoreSession (the platform cookie fetcher is the default)', () => {
    it('starts in "booting" instead of resolving status synchronously, even when the initial session already carries a token', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token: 'tok-1' }}>
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
          <AuthProvider storage={createMemoryAuthStorage()}>{children}</AuthProvider>
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
          <AuthProvider storage={createMemoryAuthStorage()}>{children}</AuthProvider>
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
          <AuthProvider storage={createMemoryAuthStorage()}>{children}</AuthProvider>
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
          <AuthProvider storage={createMemoryAuthStorage()}>{children}</AuthProvider>
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
          <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
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
