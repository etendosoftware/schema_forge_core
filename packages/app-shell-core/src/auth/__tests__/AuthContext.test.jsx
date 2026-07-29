import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';

afterEach(cleanup);

function wrapperWith({ fetchWindowAccess } = {}) {
  return function Wrapper({ children }) {
    return (
      <AuthProvider storage={createMemoryAuthStorage()} fetchWindowAccess={fetchWindowAccess}>
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
      wrapper: ({ children }) => <AuthProvider storage={storage}>{children}</AuthProvider>,
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

// ETP-4576 cycle 4 — session restore on mount, purely additive. AuthProvider
// gains an optional `restoreSession` prop (host-injected, same pattern as
// `fetchWindowAccess`) and a new tri-state `status` field
// ('booting' | 'authenticated' | 'anonymous') on the context value. When the
// prop is not supplied, `status` must resolve synchronously and no new side
// effect (legacy storage purge) must fire — hosts that have not opted into
// the new flow must see zero behavior change.
describe('AuthContext — session restore (ETP-4576)', () => {
  afterEach(() => {
    // These tests seed real localStorage keys (jsdom) to exercise the legacy
    // purge; keep them from leaking into other tests in this file/run.
    window.localStorage.clear();
  });

  describe('without restoreSession (default, backward-compatible behavior)', () => {
    it('resolves status synchronously to "authenticated" on the first render when the initial session already has a token', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token: 'tok-1' }}>
            {children}
          </AuthProvider>
        ),
      });

      expect(result.current.status).toBe('authenticated');
    });

    it('resolves status synchronously to "anonymous" on the first render when there is no token', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

      expect(result.current.status).toBe('anonymous');
    });

    it('does not purge legacy localStorage keys when restoreSession is not provided (zero side effects for opted-out hosts)', () => {
      window.localStorage.setItem('sf_auth_token', 'legacy-existing-token');

      renderHook(() => useAuth(), { wrapper: wrapperWith() });

      expect(window.localStorage.getItem('sf_auth_token')).toBe('legacy-existing-token');
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

// ETP-4576 cycle 14 — regression guard for the isAuthenticated fix above.
// Legacy hosts (no `restoreSession` prop) compute `status` ONCE, synchronously,
// on mount, and never recompute it afterwards — so if login() happens AFTER
// mount (token goes from null to a real value), `status` stays frozen at
// 'anonymous' forever. isAuthenticated must therefore keep falling back to
// `!!session.token` for these hosts, or a post-mount login would never flip
// isAuthenticated to true.
describe('AuthContext — isAuthenticated legacy fallback (ETP-4576 cycle 14 regression guard)', () => {
  it('is false on mount without restoreSession/initialSession, then becomes true after a post-mount login() even though status stays frozen at "anonymous"', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWith() });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.login({ token: 'tok-1' });
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
