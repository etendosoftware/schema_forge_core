import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

// Core vitest runs without `globals: true` guaranteed in every project, so RTL's
// automatic afterEach cleanup is not registered — do it explicitly to avoid DOM
// bleed between tests (same pattern as useDistinctValues.test.jsx).
afterEach(cleanup);

// useCurrency.jsx imports `useAuth` from `../auth/index.js` (NOT `../auth/AuthContext.jsx`
// directly). From this test dir (`hooks/__tests__/`) that resolves to `../../auth/index.js`,
// the exact barrel file the hook imports — vitest matches vi.mock by RESOLVED module id, so
// mocking here intercepts the hook's internal useAuth call.
//
// mockUseAuth is exposed via vi.hoisted() so individual tests can override its return value.
// Pitfall already hit in useDistinctValues.test.jsx: React may re-invoke a hook more than once
// per render, so a `mockReturnValueOnce` override can fall through to the default on a later
// call within the SAME test. Use persistent `mockReturnValue` and restore it explicitly at the
// end of any test that overrides it — a vi.hoisted() vi.fn() has no "original" implementation
// for `restoreAllMocks` to fall back to.
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ isAuthenticated: true, selectedOrg: { id: 'org-1' } })),
}));

vi.mock('../../auth/index.js', () => ({
  useAuth: mockUseAuth,
}));

import { CurrencyProvider, useCurrency } from '../useCurrency.jsx';

function renderCurrency(props) {
  return renderHook(() => useCurrency(), {
    wrapper: ({ children }) => (
      <CurrencyProvider {...props}>{children}</CurrencyProvider>
    ),
  });
}

describe('useCurrency', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({ isAuthenticated: true, selectedOrg: { id: 'org-1' } });
  });

  it('returns the value prop directly and never calls fetcher', async () => {
    const fetcher = vi.fn();
    const { result } = renderCurrency({ value: 'EUR', apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(result.current).toBe('EUR');
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not call fetcher and stays null when isAuthenticated is false', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, selectedOrg: null });
    try {
      const fetcher = vi.fn();
      const { result } = renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

      expect(result.current).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, selectedOrg: { id: 'org-1' } });
    }
  });

  it('calls fetcher with credentials: "include" when authenticated', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currencyCode: 'EUR' }),
    });
    renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
    const [, options] = fetcher.mock.calls[0];
    expect(options).toMatchObject({ credentials: 'include' });
  });

  it('security: never sends an Authorization header or the word Bearer anywhere in the call', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currencyCode: 'EUR' }),
    });
    renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(options?.headers?.Authorization).toBeUndefined();
    const serialized = JSON.stringify({ url, options });
    expect(serialized).not.toMatch(/Bearer/i);
  });

  it('resolves currencyCode on a successful response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ currencyCode: 'EUR' }),
    });
    const { result } = renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(result.current).toBe('EUR');
    });
  });

  it('stays null without throwing when res.ok is false', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
  });

  it('stays null without throwing when fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });
    expect(result.current).toBeNull();
  });

  it('re-fetches when selectedOrg?.id changes between renders', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ currencyCode: 'EUR' }),
    }));

    mockUseAuth.mockReturnValue({ isAuthenticated: true, selectedOrg: { id: 'org-1' } });
    const { rerender } = renderHook(() => useCurrency(), {
      wrapper: ({ children }) => (
        <CurrencyProvider apiBaseUrl="/sws/neo" fetcher={fetcher}>{children}</CurrencyProvider>
      ),
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    mockUseAuth.mockReturnValue({ isAuthenticated: true, selectedOrg: { id: 'org-2' } });
    rerender();

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('does not update currencyCode after unmount (cancelled flag)', async () => {
    let resolvePromise;
    const fetcher = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolvePromise = resolve;
    }));

    const { result, unmount } = renderCurrency({ apiBaseUrl: '/sws/neo', fetcher });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });

    unmount();

    await act(async () => {
      resolvePromise({
        ok: true,
        json: () => Promise.resolve({ currencyCode: 'EUR' }),
      });
    });

    // No assertion possible on `result.current` post-unmount via renderHook,
    // but resolving after unmount must not throw (React act warnings would
    // surface as a test failure) — the cancelled flag inside the effect
    // guards the setState call.
    expect(result.current).toBeNull();
  });
});
