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

  it('does not block role selection on the network round trip (fire-and-forget)', () => {
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
