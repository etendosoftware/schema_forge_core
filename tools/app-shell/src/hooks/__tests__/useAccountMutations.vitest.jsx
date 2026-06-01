import { renderHook, act } from '@testing-library/react';

vi.mock('@/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

import { useAccountMutations } from '../useAccountMutations.js';

function okResponse(payload) {
  return { ok: true, json: async () => ({ response: { data: payload } }) };
}

describe('useAccountMutations', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/etendo/web/app' },
      writable: true,
    });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── createAccount ─────────────────────────────────────────────────────────

  it('createAccount POSTs to /sws/neo/financial-account and returns response.data', async () => {
    globalThis.fetch.mockResolvedValue(okResponse({ id: 'acc-new', name: 'BBVA' }));

    const { result } = renderHook(() => useAccountMutations());

    let created;
    await act(async () => {
      created = await result.current.createAccount({ name: 'BBVA', currencyId: '102' });
    });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/sws/neo/financial-account');
    expect(url).not.toContain('action=');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'BBVA', currencyId: '102' });
    expect(created).toEqual({ id: 'acc-new', name: 'BBVA' });
  });

  it('createAccount returns null when the envelope has no data', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useAccountMutations());
    let created;
    await act(async () => {
      created = await result.current.createAccount({ name: 'X', currencyId: '102' });
    });
    expect(created).toBeNull();
  });

  it('createAccount throws an Error with .status set from a non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: 'duplicate name' } }),
    });

    const { result } = renderHook(() => useAccountMutations());

    await act(async () => {
      await expect(
        result.current.createAccount({ name: 'BBVA', currencyId: '102' }),
      ).rejects.toMatchObject({ message: 'duplicate name', status: 409 });
    });
  });

  it('createAccount falls back to "HTTP <status>" when the error body is unparseable', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    const { result } = renderHook(() => useAccountMutations());

    await act(async () => {
      await expect(
        result.current.createAccount({ name: 'X', currencyId: '102' }),
      ).rejects.toMatchObject({ message: 'HTTP 500', status: 500 });
    });
  });

  // ── updateAccount ─────────────────────────────────────────────────────────

  it('updateAccount hits ?action=update&id= with the account id and returns data', async () => {
    globalThis.fetch.mockResolvedValue(okResponse({ id: 'acc-1', name: 'Renamed' }));

    const { result } = renderHook(() => useAccountMutations());

    let updated;
    await act(async () => {
      updated = await result.current.updateAccount('acc-1', { name: 'Renamed' });
    });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/sws/neo/financial-account?action=update&id=acc-1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Renamed' });
    expect(updated).toEqual({ id: 'acc-1', name: 'Renamed' });
  });

  it('updateAccount URL-encodes the account id', async () => {
    globalThis.fetch.mockResolvedValue(okResponse({ id: 'x', name: 'x' }));

    const { result } = renderHook(() => useAccountMutations());
    await act(async () => {
      await result.current.updateAccount('acc/with space', { name: 'x' });
    });

    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('id=acc%2Fwith%20space');
  });

  it('updateAccount throws with .status on a non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: 'taken' } }),
    });

    const { result } = renderHook(() => useAccountMutations());
    await act(async () => {
      await expect(
        result.current.updateAccount('acc-1', { name: 'taken' }),
      ).rejects.toMatchObject({ message: 'taken', status: 409 });
    });
  });

  // ── archiveAccount ──────────────────────────────────────────────────────────

  it('archiveAccount hits ?action=archive&id= and returns true', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    const { result } = renderHook(() => useAccountMutations());

    let res;
    await act(async () => {
      res = await result.current.archiveAccount('acc-1');
    });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/sws/neo/financial-account?action=archive&id=acc-1');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(res).toBe(true);
  });

  it('archiveAccount throws with .status on a 409 (open reconciliations)', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { message: 'open reconciliations' } }),
    });

    const { result } = renderHook(() => useAccountMutations());
    await act(async () => {
      await expect(result.current.archiveAccount('acc-1')).rejects.toMatchObject({
        message: 'open reconciliations',
        status: 409,
      });
    });
  });

  // ── fetchDefaults ───────────────────────────────────────────────────────────

  it('fetchDefaults GETs ?action=defaults and returns response.data', async () => {
    globalThis.fetch.mockResolvedValue(
      okResponse({ defaultCurrencyId: '102', currencies: [{ id: '102', iso: 'EUR' }] }),
    );

    const { result } = renderHook(() => useAccountMutations());

    let defaults;
    await act(async () => {
      defaults = await result.current.fetchDefaults();
    });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/sws/neo/financial-account?action=defaults');
    // GET: no explicit method passed to fetch
    expect(init.method).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(defaults).toEqual({
      defaultCurrencyId: '102',
      currencies: [{ id: '102', iso: 'EUR' }],
    });
  });

  it('fetchDefaults falls back to { currencies: [] } when the envelope has no data', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useAccountMutations());
    let defaults;
    await act(async () => {
      defaults = await result.current.fetchDefaults();
    });
    expect(defaults).toEqual({ currencies: [] });
  });

  it('fetchDefaults throws with .status on a non-ok response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    });

    const { result } = renderHook(() => useAccountMutations());
    await act(async () => {
      await expect(result.current.fetchDefaults()).rejects.toMatchObject({
        message: 'boom',
        status: 500,
      });
    });
  });
});
