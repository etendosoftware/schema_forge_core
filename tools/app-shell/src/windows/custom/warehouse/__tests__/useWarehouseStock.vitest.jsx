/**
 * Tests for useWarehouseStock: guard on missing warehouseId, empty-bins path,
 * full aggregation path (bins -> binContents + productTransactions + UoM names),
 * and error handling. fetch is mocked per-URL.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useWarehouseStock } from '../useWarehouseStock.js';

const API = '/sws/neo';
const TOKEN = 'tok';

function jsonResponse(data) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => ({ response: { data } }) };
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWarehouseStock', () => {
  it('stays in the initial loading state when warehouseId is missing', () => {
    const { result } = renderHook(() => useWarehouseStock('', TOKEN, API));
    expect(result.current.loading).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns empty products/transactions when the warehouse has no bins', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/storageBin?')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/selectors/uOM')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    const { result } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.products).toEqual([]);
    expect(result.current.transactions).toEqual([]);
  });

  it('aggregates bin contents and transactions, resolving UoM names', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) {
        return Promise.resolve(jsonResponse([{ id: 'uom-1', identifier: 'Units' }]));
      }
      if (url.includes('/storageBin?')) {
        return Promise.resolve(jsonResponse([{ id: 'bin-1' }, { id: 'bin-2' }]));
      }
      if (url.includes('/binContents?parentId=bin-1')) {
        return Promise.resolve(jsonResponse([
          { product: 'p1', 'product$_identifier': 'Prod 1', uOM: 'uom-1', quantityOnHand: '5', etgoValuation: '10' },
        ]));
      }
      if (url.includes('/binContents?parentId=bin-2')) {
        return Promise.resolve(jsonResponse([
          { product: 'p1', 'product$_identifier': 'Prod 1', uOM: 'uom-1', quantityOnHand: '3', etgoValuation: '6' },
        ]));
      }
      if (url.includes('/productTransactions?parentId=bin-1')) {
        return Promise.resolve(jsonResponse([{ id: 'tx-1' }]));
      }
      if (url.includes('/productTransactions?parentId=bin-2')) {
        return Promise.resolve(jsonResponse([{ id: 'tx-2' }]));
      }
      return Promise.resolve(jsonResponse([]));
    });

    const { result } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.products).toEqual([
      { id: 'p1', label: 'Prod 1', uom: 'Units', qty: 8, valuation: 16 },
    ]);
    expect(result.current.transactions).toEqual([{ id: 'tx-1' }, { id: 'tx-2' }]);
  });

  it('recovers with an empty UoM map when the selector request fails', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) {
        return Promise.resolve({ ok: false, status: 500, statusText: 'Err', json: async () => ({}) });
      }
      if (url.includes('/storageBin?')) return Promise.resolve(jsonResponse([{ id: 'bin-1' }]));
      if (url.includes('/binContents?')) {
        return Promise.resolve(jsonResponse([
          { product: 'p1', uOM: 'uom-x', quantityOnHand: '2', etgoValuation: '4' },
        ]));
      }
      if (url.includes('/productTransactions?')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    const { result } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toEqual([
      { id: 'p1', label: 'p1', uom: 'uom-x', qty: 2, valuation: 4 },
    ]);
  });

  it('sets error when a request fails (non-ok response)', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/storageBin?')) {
        return Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable', json: async () => ({}) });
      }
      return Promise.resolve(jsonResponse([]));
    });

    const { result } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('503 Unavailable');
    expect(result.current.products).toEqual([]);
    expect(result.current.transactions).toEqual([]);
  });

  it('falls back to json.data then [] when response.data is absent', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 'u', name: 'U' }] }) });
      }
      if (url.includes('/storageBin?')) {
        return Promise.resolve({ ok: true, json: async () => ({}) }); // no data field -> []
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    const { result } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toEqual([]);
  });

  it('re-fetches when refreshKey changes', async () => {
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/storageBin?')) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([]));
    });

    const { result, rerender } = renderHook(
      ({ key }) => useWarehouseStock('wh-1', TOKEN, API, key),
      { initialProps: { key: 0 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsAfterFirst = globalThis.fetch.mock.calls.length;

    rerender({ key: 1 });
    await waitFor(() => expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(callsAfterFirst));
  });

  it('ignores results after unmount (cancelled)', async () => {
    let resolveBins;
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/selectors/uOM')) return Promise.resolve(jsonResponse([]));
      if (url.includes('/storageBin?')) {
        return new Promise((r) => { resolveBins = () => r(jsonResponse([])); });
      }
      return Promise.resolve(jsonResponse([]));
    });

    const { result, unmount } = renderHook(() => useWarehouseStock('wh-1', TOKEN, API));
    unmount();
    resolveBins();
    // No assertion errors / state updates after unmount; loading stays as last value.
    expect(result.current.loading).toBe(true);
  });
});
