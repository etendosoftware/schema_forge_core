import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Core vitest runs without `globals: true`, so RTL's automatic afterEach
// cleanup is not registered — do it explicitly to avoid DOM bleed between tests.
afterEach(cleanup);

// The hook imports auth via its own relative specifiers (`../auth/AuthContext.jsx`
// and `../auth/api.js`). vitest matches vi.mock by RESOLVED module id, so from
// this test dir (`hooks/__tests__/`) `../../auth/...` resolves to the exact same
// files the hook imports — the mocks intercept the hook's internal useAuth call.
//
// mockUseAuth is exposed via vi.hoisted() so individual tests can override its
// return value (e.g. `mockUseAuth.mockReturnValue({ isAuthenticated: false })`)
// without affecting other tests — any test that overrides it MUST restore the
// default (`{ isAuthenticated: true }`) before it finishes, since a hoisted
// vi.fn() has no "original" implementation for the beforeEach's
// restoreAllMocks to fall back to.
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(() => ({ isAuthenticated: true })),
}));

vi.mock('../../auth/AuthContext.jsx', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../../auth/api.js', () => ({
  buildHeaders: () => ({}),
}));

import { useDistinctValues } from '../useDistinctValues.js';

describe('useDistinctValues', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial empty state', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [], hasMore: false } }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('orderLine', 'product', { apiBaseUrl: '/api', enabled: false }),
    );
    expect(result.current.values).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(false);
  });

  it('fetches values when enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { data: [{ id: 'P1', _identifier: 'Product 1' }], hasMore: false },
      }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('orderLine', 'product', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.values).toHaveLength(1);
    });
    expect(result.current.values[0].id).toBe('P1');
    expect(result.current.values[0]._identifier).toBe('Product 1');
  });

  it('normalizes scalar string entries to {id, _identifier}', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { data: ['Active', 'Inactive'], hasMore: false },
      }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'status', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.values).toHaveLength(2);
    });
    expect(result.current.values[0]).toEqual({ id: 'Active', _identifier: 'Active' });
  });

  it('normalizes null entries', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { data: [null], hasMore: false },
      }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.values).toHaveLength(1);
    });
    expect(result.current.values[0]).toEqual({ id: '', _identifier: '' });
  });

  it('handles hasMore=true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { data: [{ id: 'P1', _identifier: 'P1' }], hasMore: true },
      }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.hasMore).toBe(true);
    });
  });

  it('handles fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.values).toEqual([]);
  });

  it('handles HTTP error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('does not fetch when enabled=false', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [] } }),
    });
    renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api', enabled: false }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when entity is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [] } }),
    });
    renderHook(() =>
      useDistinctValues('', 'field', { apiBaseUrl: '/api' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when field is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [] } }),
    });
    renderHook(() =>
      useDistinctValues('entity', '', { apiBaseUrl: '/api' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when apiBaseUrl is empty', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [] } }),
    });
    renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when isAuthenticated is false', () => {
    // mockReturnValue (not `Once`) so EVERY call to useAuth() during this test
    // sees isAuthenticated: false — React may re-invoke the hook across
    // renders, and a `*Once` override only covers the first call, letting a
    // later render fall through to the default `{ isAuthenticated: true }`
    // and fetch anyway. Restored explicitly in `finally` (not left to the
    // `beforeEach` restoreAllMocks) because a vi.hoisted() vi.fn() has no
    // "original" implementation for restoreAllMocks to fall back to.
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    try {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ response: { data: [] } }),
      });
      renderHook(() =>
        useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
    }
  });

  it('exposes search and setSearch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [], hasMore: false } }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    expect(result.current.search).toBe('');
    act(() => { result.current.setSearch('test'); });
    expect(result.current.search).toBe('test');
  });

  it('loadMore does nothing when hasMore is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: { data: [], hasMore: false } }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const fetchCount = globalThis.fetch.mock.calls.length;
    act(() => { result.current.loadMore(); });
    // No additional fetch should happen
    expect(globalThis.fetch.mock.calls.length).toBe(fetchCount);
  });

  it('normalizes object entry without _identifier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: { data: [{ id: 'X1' }], hasMore: false },
      }),
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(result.current.values).toHaveLength(1));
    expect(result.current.values[0]._identifier).toBe('X1');
  });

  it('refresh re-fetches from start', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [{ id: `P${callCount}`, _identifier: `P${callCount}` }], hasMore: false } }),
      });
    });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(result.current.values).toHaveLength(1));
    await act(async () => { result.current.refresh(); });
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(2));
  });
});

// ETP-5009: `initialLoading` is the "page 1 of the current query key has not
// settled yet" flag a picker uses to show a loader instead of an in-memory
// seed that would reorder once the backend page lands.
describe('useDistinctValues — initialLoading (ETP-5009)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // fetch whose responses resolve/reject only when the test says so.
  function deferredFetch() {
    const pending = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => new Promise((resolve, reject) => {
      pending.push({ url, resolve, reject });
    }));
    const ok = (data) => ({ ok: true, json: () => Promise.resolve({ response: { data, hasMore: false } }) });
    return {
      spy,
      pending,
      resolveAt: (i, data) => pending[i].resolve(ok(data)),
      rejectAt: (i, err) => pending[i].reject(err),
    };
  }

  it('is true on the very first render, before the fetch effect runs', () => {
    deferredFetch();
    const seen = [];
    renderHook(() => {
      const r = useDistinctValues('entity', 'field', { apiBaseUrl: '/api' });
      seen.push(r.initialLoading);
      return r;
    });
    expect(seen[0]).toBe(true);
  });

  it('stays true while page 1 is pending and clears once it resolves', async () => {
    const f = deferredFetch();
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(f.pending).toHaveLength(1));
    expect(result.current.initialLoading).toBe(true);
    await act(async () => { f.resolveAt(0, ['A', 'B']); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.values.map((v) => v.id)).toEqual(['A', 'B']);
  });

  it('clears on fetch error', async () => {
    const f = deferredFetch();
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(f.pending).toHaveLength(1));
    expect(result.current.initialLoading).toBe(true);
    await act(async () => { f.rejectAt(0, new Error('boom')); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('clears on an HTTP error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.initialLoading).toBe(false);
  });

  it('is not raised again by a search refetch', async () => {
    const f = deferredFetch();
    const seen = [];
    const { result } = renderHook(() => {
      const r = useDistinctValues('entity', 'field', { apiBaseUrl: '/api', debounceMs: 0 });
      seen.push(r.initialLoading);
      return r;
    });
    await waitFor(() => expect(f.pending).toHaveLength(1));
    await act(async () => { f.resolveAt(0, ['A']); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
    const settledAt = seen.length;

    act(() => { result.current.setSearch('x'); });
    await waitFor(() => expect(f.pending).toHaveLength(2));
    expect(f.pending[1].url).toContain('_distinctSearch=x');
    expect(result.current.loading).toBe(true);
    expect(result.current.initialLoading).toBe(false);
    await act(async () => { f.resolveAt(1, ['X']); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(seen.slice(settledAt)).not.toContain(true);
  });

  it('is raised again when the query key (field) changes', async () => {
    const f = deferredFetch();
    const { result, rerender } = renderHook(
      ({ field }) => useDistinctValues('entity', field, { apiBaseUrl: '/api' }),
      { initialProps: { field: 'a' } },
    );
    await waitFor(() => expect(f.pending).toHaveLength(1));
    await act(async () => { f.resolveAt(0, ['A']); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));

    rerender({ field: 'b' });
    expect(result.current.initialLoading).toBe(true);
    await waitFor(() => expect(f.pending).toHaveLength(2));
    await act(async () => { f.resolveAt(1, ['B']); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
  });

  it('becomes true on the render that flips enabled from false to true', async () => {
    const f = deferredFetch();
    const { result, rerender } = renderHook(
      ({ enabled }) => useDistinctValues('entity', 'field', { apiBaseUrl: '/api', enabled }),
      { initialProps: { enabled: false } },
    );
    expect(result.current.initialLoading).toBe(false);
    rerender({ enabled: true });
    expect(result.current.initialLoading).toBe(true);
    await waitFor(() => expect(f.pending).toHaveLength(1));
    await act(async () => { f.resolveAt(0, []); });
    await waitFor(() => expect(result.current.initialLoading).toBe(false));
  });

  it('is false when disabled', () => {
    deferredFetch();
    const { result } = renderHook(() =>
      useDistinctValues('entity', 'field', { apiBaseUrl: '/api', enabled: false }),
    );
    expect(result.current.initialLoading).toBe(false);
  });

  it.each([
    ['entity', ['', 'field', '/api']],
    ['field', ['entity', '', '/api']],
    ['apiBaseUrl', ['entity', 'field', '']],
  ])('is false when %s is missing', (_, [entity, field, apiBaseUrl]) => {
    deferredFetch();
    const { result } = renderHook(() => useDistinctValues(entity, field, { apiBaseUrl }));
    expect(result.current.initialLoading).toBe(false);
  });

  it('is false when unauthenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    try {
      deferredFetch();
      const { result } = renderHook(() =>
        useDistinctValues('entity', 'field', { apiBaseUrl: '/api' }),
      );
      expect(result.current.initialLoading).toBe(false);
    } finally {
      mockUseAuth.mockReturnValue({ isAuthenticated: true });
    }
  });
});
