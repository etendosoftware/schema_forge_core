import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { useWindowAccess, useHasCapability } from '../useWindowAccess.js';

// Core vitest runs without `globals: true` (see vitest.config.js) — do
// explicit cleanup so mounted providers don't bleed between tests.
afterEach(cleanup);

// ETP-4576 cycle 4a — `restoreSession` is no longer opt-in: AuthProvider defaults
// it to the platform cookie fetcher (fetchCookieSession). Every provider mounted
// without the prop would therefore call `fetch` on mount, fail under jsdom, and
// take the fail-closed path — which runs logout(), wiping the very
// windowAccess/capabilities these tests just seeded via selectRole().
// This suite's subject is the windowAccess/capabilities lookups, NOT the session
// restore, so the wrapper neutralises the default with a never-settling override:
// the provider parks in 'booting', no purge/logout ever fires, the default fetcher
// is never invoked (so no `fetch` stub is needed either), and every assertion below
// keeps verifying exactly what it verified before the default existed. Do not remove.
const NEVER_SETTLES = () => new Promise(() => {});

function wrapperWith({ initialSession, fetchWindowAccess } = {}) {
  return function Wrapper({ children }) {
    return (
      <AuthProvider
        storage={createMemoryAuthStorage(initialSession)}
        fetchWindowAccess={fetchWindowAccess}
        restoreSession={NEVER_SETTLES}
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

  it('fails closed to "none" for an unrecognized tier value in the map', async () => {
    const { result } = renderHook(() => ({
      access: useWindowAccess('147'),
      auth: useAuth(),
    }), {
      wrapper: wrapperWith({
        fetchWindowAccess: async () => ({
          windowAccess: { '147': 'bogus', '181': undefined },
          capabilities: {},
        }),
      }),
    });

    await act(async () => {
      result.current.auth.selectRole({ id: 'role-1' });
    });

    await waitFor(() => {
      expect(result.current.auth.windowAccess).toEqual({ '147': 'bogus', '181': undefined });
    });
    expect(result.current.access).toBe('none');
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

  it('fails closed to false for non-boolean-true truthy values (strict === true check)', async () => {
    const { result } = renderHook(() => ({
      stringFalse: useHasCapability('stringFalseFlag'),
      numberOne: useHasCapability('numberOneFlag'),
      auth: useAuth(),
    }), {
      wrapper: wrapperWith({
        fetchWindowAccess: async () => ({
          windowAccess: {},
          capabilities: { stringFalseFlag: 'false', numberOneFlag: 1 },
        }),
      }),
    });

    await act(async () => {
      result.current.auth.selectRole({ id: 'role-1' });
    });

    await waitFor(() => {
      expect(result.current.auth.capabilities).toEqual({ stringFalseFlag: 'false', numberOneFlag: 1 });
    });
    expect(result.current.stringFalse).toBe(false);
    expect(result.current.numberOne).toBe(false);
  });
});
