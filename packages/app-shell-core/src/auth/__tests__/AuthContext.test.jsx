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
