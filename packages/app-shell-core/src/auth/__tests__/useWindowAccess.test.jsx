import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { useWindowAccess, useHasCapability } from '../useWindowAccess.js';

// Core vitest runs without `globals: true` (see vitest.config.js) — do
// explicit cleanup so mounted providers don't bleed between tests.
afterEach(cleanup);

function wrapperWith({ initialSession, fetchWindowAccess } = {}) {
  return function Wrapper({ children }) {
    return (
      <AuthProvider
        storage={createMemoryAuthStorage(initialSession)}
        fetchWindowAccess={fetchWindowAccess}
      >
        {children}
      </AuthProvider>
    );
  };
}

describe('useWindowAccess', () => {
  it('fails closed to "none" before the map has loaded', () => {
    const { result } = renderHook(() => useWindowAccess('147'), {
      wrapper: wrapperWith(),
    });
    expect(result.current).toBe('none');
  });

  it('fails closed to "none" when windowId is missing/falsy', () => {
    const { result: withNull } = renderHook(() => useWindowAccess(null), {
      wrapper: wrapperWith(),
    });
    expect(withNull.current).toBe('none');

    const { result: withUndefined } = renderHook(() => useWindowAccess(undefined), {
      wrapper: wrapperWith(),
    });
    expect(withUndefined.current).toBe('none');

    const { result: withEmpty } = renderHook(() => useWindowAccess(''), {
      wrapper: wrapperWith(),
    });
    expect(withEmpty.current).toBe('none');
  });

  it('fails closed to "none" for a windowId absent from a loaded map', () => {
    const { result } = renderHook(() => useWindowAccess('999-absent'), {
      wrapper: wrapperWith({
        fetchWindowAccess: async () => ({ windowAccess: { '147': 'full' }, capabilities: {} }),
      }),
    });
    expect(result.current).toBe('none');
  });

  it('returns the resolved tier once the map has loaded via role selection', async () => {
    const { result } = renderHook(() => ({
      access: useWindowAccess('147'),
      auth: useAuth(),
    }), {
      wrapper: wrapperWith({
        fetchWindowAccess: async () => ({
          windowAccess: { '147': 'read-only', '181': 'full' },
          capabilities: {},
        }),
      }),
    });
    expect(result.current.access).toBe('none');

    await act(async () => {
      result.current.auth.selectRole({ id: 'role-1' });
    });

    await waitFor(() => {
      expect(result.current.access).toBe('read-only');
    });
  });
});

describe('useHasCapability', () => {
  it('fails closed to false before the map has loaded', () => {
    const { result } = renderHook(() => useHasCapability('showAccountingFields'), {
      wrapper: wrapperWith(),
    });
    expect(result.current).toBe(false);
  });

  it('fails closed to false when key is missing/falsy', () => {
    const { result } = renderHook(() => useHasCapability(null), {
      wrapper: wrapperWith(),
    });
    expect(result.current).toBe(false);
  });

  it('fails closed to false for a key absent from a loaded map', () => {
    const { result } = renderHook(() => useHasCapability('unknownCapability'), {
      wrapper: wrapperWith(),
    });
    expect(result.current).toBe(false);
  });
});
