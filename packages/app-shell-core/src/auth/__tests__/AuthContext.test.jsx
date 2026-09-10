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

/**
 * Builds a JWT-shaped string with a real base64url-encoded payload, decodable by
 * `decodeJwtPayload`/`decodeJwtRole` (jsdom's `btoa` handles the ASCII-only payloads used here;
 * a real UTF-8-safe encoder is unnecessary for these fixtures).
 */
function makeToken(payload) {
  const encode = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.sig`;
}

/** Stubs `globalThis.fetch` with a single canned response (or response factory) and returns a
 * recorder of every call, plus a restore. Mirrors `auth/__tests__/api.test.js`'s own `stubFetch`
 * convention (same file's `node:test` suite can't share this one directly since this file needs
 * `vi.fn()` wrapping for assertions like `toHaveBeenCalled`). */
function stubFetch(responseFactory) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = vi.fn(async (url, options) => {
    calls.push({ url, options });
    const response = typeof responseFactory === 'function' ? responseFactory(url, options) : responseFactory;
    if (response instanceof Error) throw response;
    return response;
  });
  return { calls, restore: () => { globalThis.fetch = original; } };
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

describe('AuthContext — silent token refresh (ETP-5195)', () => {
  it('fires a silent refresh on mount, hitting GET /sws/neo/refreshtoken', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>
            {children}
          </AuthProvider>
        ),
      });

      await waitFor(() => expect(f.calls.length).toBeGreaterThanOrEqual(1));
      expect(f.calls[0].url).toBe('/sws/neo/refreshtoken');
    } finally { f.restore(); }
  });

  it('does not fire a refresh on mount when there is no token yet (logged out)', async () => {
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: 'irrelevant' }) }) });
    try {
      renderHook(() => useAuth(), { wrapper: wrapperWith() });
      // Give the mount effect a chance to run before asserting the negative.
      await act(async () => { await Promise.resolve(); });
      expect(f.calls.length).toBe(0);
    } finally { f.restore(); }
  });

  it('blocks a token-only changed role without partially replacing the stored session', async () => {
    const oldToken = makeToken({ role: 'R-OLD', user: 'U1' });
    const newToken = makeToken({ role: 'R-NEW', user: 'U1' });
    const storage = createMemoryAuthStorage({ token: oldToken });
    const writeSpy = vi.spyOn(storage, 'write');
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: newToken }) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} initialSession={{ token: oldToken }}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => expect(result.current.sessionRefreshStatus).toBe('metadata-required'));
      expect(result.current.token).toBe(oldToken);
      expect(result.current.isSessionReady).toBe(false);
      expect(storage.read().token).toBe(oldToken);
      expect(writeSpy).not.toHaveBeenCalled();
    } finally { f.restore(); }
  });

  it('does NOT persist/write when the refreshed token carries the SAME role', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    // A different token string, but decoding to the same role — the no-op condition is
    // "role unchanged", not "token identical".
    const sameRoleToken = makeToken({ role: 'R1', user: 'U1', extra: 'ignored' });
    const storage = createMemoryAuthStorage({ token });
    const writeSpy = vi.spyOn(storage, 'write');
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: sameRoleToken }) }) });
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => expect(f.calls.length).toBeGreaterThanOrEqual(1));
      // Flush any microtasks a (wrongly-firing) persistSession would need.
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(writeSpy).not.toHaveBeenCalled();
    } finally { f.restore(); }
  });

  it('swallows a network error from the refresh fetch without throwing or changing the session', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.token).toBe(token);
      expect(warnSpy).toHaveBeenCalled();
    } finally { globalThis.fetch = original; warnSpy.mockRestore(); }
  });

  it('swallows a non-OK refresh response without changing the session', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: false, status: 401, json: async () => ({ result: JSON.stringify({}) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => expect(f.calls.length).toBeGreaterThanOrEqual(1));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.token).toBe(token);
    } finally { f.restore(); }
  });

  it('swallows a response with no usable token field without changing the session', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({}) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await waitFor(() => expect(f.calls.length).toBeGreaterThanOrEqual(1));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.token).toBe(token);
    } finally { f.restore(); }
  });

  it('re-triggers the silent refresh when the document becomes visible', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });
      await waitFor(() => expect(f.calls.length).toBe(1));

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      await waitFor(() => expect(f.calls.length).toBe(2));
      expect(f.calls[1].url).toBe('/sws/neo/refreshtoken');
    } finally { f.restore(); }
  });

  it('does not bump authRevision on a same-role visibilitychange refresh when window access resolves unchanged', async () => {
    // ETP-5195 follow-up — regression for the live-reported "alt-tab causes a menu flicker
    // and the currently-open window resets/loses scroll, even with no role change" bug.
    // `authRevision` (and the underlying `generation`) must only bump when something about
    // the resolved access actually changed — every app-wide consumer keyed off it (the
    // sidebar menu, useViewerRole, any generation-gated in-flight fetch) treats a bump as
    // "the session changed under me" and resets to a loading state.
    const token = makeToken({ role: 'R1', user: 'U1' });
    const fetchWindowAccess = vi.fn().mockResolvedValue({
      windowAccess: { '147': 'full' },
      capabilities: { showAccountingFields: true },
    });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider
            storage={createMemoryAuthStorage()}
            fetchWindowAccess={fetchWindowAccess}
            initialSession={{ token, selectedRole: { id: 'role-1' } }}>
            {children}
          </AuthProvider>
        ),
      });
      await waitFor(() => expect(result.current.windowAccess).toEqual({ '147': 'full' }));
      const authRevisionAfterMount = result.current.authRevision;

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      await waitFor(() => expect(fetchWindowAccess).toHaveBeenCalledTimes(2));
      // Flush the microtasks the second refresh's own loadAccess()/publish need.
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });

      expect(result.current.windowAccess).toEqual({ '147': 'full' });
      expect(result.current.authRevision).toBe(authRevisionAfterMount);
    } finally { f.restore(); }
  });

  it('still bumps authRevision when a same-role visibilitychange refresh resolves DIFFERENT window access', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const fetchWindowAccess = vi.fn()
      .mockResolvedValueOnce({ windowAccess: { '147': 'full' }, capabilities: {} })
      .mockResolvedValueOnce({ windowAccess: { '147': 'read-only' }, capabilities: {} });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider
            storage={createMemoryAuthStorage()}
            fetchWindowAccess={fetchWindowAccess}
            initialSession={{ token, selectedRole: { id: 'role-1' } }}>
            {children}
          </AuthProvider>
        ),
      });
      await waitFor(() => expect(result.current.windowAccess).toEqual({ '147': 'full' }));
      const authRevisionAfterMount = result.current.authRevision;

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.windowAccess).toEqual({ '147': 'read-only' }));

      expect(result.current.authRevision).toBe(authRevisionAfterMount + 1);
    } finally { f.restore(); }
  });

  it('does NOT re-trigger the refresh on a visibilitychange while the document is hidden', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });
      await waitFor(() => expect(f.calls.length).toBe(1));

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      // Still just the one mount-time call — a transition to "hidden" is not a refresh trigger.
      expect(f.calls.length).toBe(1);
    } finally { f.restore(); visibilitySpy.mockRestore(); }
  });

  it('exposes refreshToken as an imperative trigger for the same silent-refresh logic', async () => {
    const oldToken = makeToken({ role: 'R-OLD', user: 'U1' });
    const newToken = makeToken({ role: 'R-NEW', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: newToken }) }) });
    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token: oldToken }}>
            {children}
          </AuthProvider>
        ),
      });

      // The incomplete changed-role response blocks bootstrap; the imperative API must
      // still allow another attempt to obtain authoritative metadata.
      await waitFor(() => expect(result.current.sessionRefreshStatus).toBe('metadata-required'));
      const callsBeforeManualTrigger = f.calls.length;

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(f.calls.length).toBeGreaterThan(callsBeforeManualTrigger);
      expect(f.calls[f.calls.length - 1].url).toBe('/sws/neo/refreshtoken');
      expect(result.current.token).toBe(oldToken);
      expect(result.current.isSessionReady).toBe(false);
    } finally { f.restore(); }
  });

  // ── QA (ETP-5195) — logout-race adversarial case ──────────────────────────
  //
  // `silentlyRefreshToken` reads the CURRENT `refreshSessionRef.current` again at the moment it
  // persists ("...refreshSessionRef.current, token: newToken"), rather than checking whether the
  // session it captured at the START of the call is still the one in effect. If the user logs
  // out WHILE the `GET /sws/neo/refreshtoken` request is still in flight, the resolution has no
  // way of knowing that: it unconditionally spreads the (now-cleared) current session and merges
  // in the freshly-issued token, silently re-authenticating a session the user explicitly ended.
  it('does NOT resurrect the session with a fresh token when logout() happens while the refresh request is in flight', async () => {
    const oldToken = makeToken({ role: 'R-OLD', user: 'U1' });
    const newToken = makeToken({ role: 'R-NEW', user: 'U1' });
    const storage = createMemoryAuthStorage({ token: oldToken });

    // A controllable fetch: the promise only resolves once the test explicitly releases it,
    // giving us a window to call logout() while the silent refresh is still "in flight".
    let releaseFetch;
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(() => new Promise((resolve) => { releaseFetch = resolve; }));

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} initialSession={{ token: oldToken }}>{children}</AuthProvider>
        ),
      });

      // Wait for the mount-time silent refresh to actually issue its fetch (and be suspended on
      // it) before logging out mid-flight.
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

      act(() => { result.current.logout(); });
      expect(result.current.token).toBeFalsy();

      // Now let the stale refresh request resolve with a brand-new, perfectly valid token.
      await act(async () => {
        releaseFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: newToken }) }) });
        await Promise.resolve();
        await Promise.resolve();
      });

      // A logged-out session must stay logged out — a request that started before logout has no
      // business reviving it once it finally resolves.
      expect(result.current.token).toBeFalsy();
    } finally { globalThis.fetch = original; }
  });
});

describe('AuthContext — silent refresh polling fallback (ETP-5195)', () => {
  // Mirrors the module-level SILENT_REFRESH_POLL_INTERVAL_MS constant in AuthContext.jsx —
  // not exported, so kept in sync here.
  const POLL_INTERVAL_MS = 5 * 60 * 1000;

  // Fake timers must be installed BEFORE renderHook() so the provider's setInterval() call
  // itself is captured by the fake clock — installing afterwards would leave a real interval
  // running in the background, uncontrolled by vi.advanceTimersByTimeAsync(). Restore real
  // timers afterwards so later tests (e.g. the 50ms visibilitychange debounce, which relies on
  // real setTimeout + testing-library's waitFor) are unaffected.
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires a silent refresh after the poll interval elapses', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    vi.useFakeTimers();
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      // Flush the mount-time silent refresh (queued via a Promise microtask, not a timer —
      // unaffected by the fake clock).
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(f.calls.length).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });

      expect(f.calls.length).toBe(2);
      expect(f.calls[1].url).toBe('/sws/neo/refreshtoken');
    } finally { f.restore(); }
  });

  it('keeps firing on every interval tick, not just once (recurring poll, not a one-shot timeout)', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    vi.useFakeTimers();
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const callsAfterMount = f.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * POLL_INTERVAL_MS);
      });

      // Two full interval periods elapsed — two additional poll-triggered refreshes, proving
      // this is a recurring setInterval, not a setTimeout that fires once and stops.
      expect(f.calls.length).toBe(callsAfterMount + 2);
    } finally { f.restore(); }
  });

  it('clears the interval on unmount, stopping the poll', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token }) }) });
    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={createMemoryAuthStorage()} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      const callsBeforeUnmount = f.calls.length;

      unmount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });

      // No additional call after unmount — the cleanup's clearInterval() actually ran.
      expect(f.calls.length).toBe(callsBeforeUnmount);
    } finally { f.restore(); }
  });

  it('reuses the same-role no-op guard on a poll-triggered refresh (no unnecessary persistSession write)', async () => {
    const token = makeToken({ role: 'R1', user: 'U1' });
    // A different token string, but decoding to the same role — polling must not bypass the
    // "role unchanged" no-op guard that the other refresh triggers already respect.
    const sameRoleToken = makeToken({ role: 'R1', user: 'U1', extra: 'ignored' });
    const storage = createMemoryAuthStorage({ token });
    const writeSpy = vi.spyOn(storage, 'write');
    const f = stubFetch({ ok: true, json: async () => ({ result: JSON.stringify({ token: sameRoleToken }) }) });
    vi.useFakeTimers();
    try {
      renderHook(() => useAuth(), {
        wrapper: ({ children }) => (
          <AuthProvider storage={storage} initialSession={{ token }}>{children}</AuthProvider>
        ),
      });

      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(f.calls.length).toBe(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      });

      // The poll-triggered refresh did fire...
      expect(f.calls.length).toBe(2);
      expect(f.calls[1].url).toBe('/sws/neo/refreshtoken');
      // ...but since the role didn't change, it stayed a no-op — same guard as every other trigger.
      expect(writeSpy).not.toHaveBeenCalled();
    } finally { f.restore(); }
  });
});
