import React, { StrictMode, useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { createMemoryAuthStorage } from '../session.js';
import { apiFetch, createApiFetch, resetApiSessionForTests } from '../api.js';
import { useApiFetch } from '../useApiFetch.js';
import { WindowAccessGuard } from '../WindowAccessGuard.jsx';
import { DataProvider, useDataCache } from '../../data/DataProvider.jsx';
import { useQuery } from '../../data/useQuery.jsx';
import { CurrencyProvider, useCurrency } from '../../hooks/useCurrency.jsx';
import { deferred, jsonResponse, metadataResponse, refreshResponse, sessionFixture } from './refreshFixtures.js';

vi.mock('../../i18n/useUI.js', () => ({ useUI: () => (key) => key }));
// Unrelated runtime chrome is not part of this contract. Providers and guards stay real.
vi.mock('../../layout/index.js', () => ({ ShellLayout: () => null }));
vi.mock('../../reports/index.js', () => ({ ReportViewerFrame: () => null }));
import { AuthGate } from '../../runtime/AppShellRuntime.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {
  cleanup();
  resetApiSessionForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup({ session = sessionFixture(), fetchWindowAccess, strict = false, onSessionChange } = {}) {
  const storage = createMemoryAuthStorage(session);
  const Wrapper = ({ children }) => {
    const content = <AuthProvider storage={storage} fetchWindowAccess={fetchWindowAccess}
      onSessionChange={onSessionChange} apiBaseUrl="/server">{children}</AuthProvider>;
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
  const hook = renderHook(() => ({ ...useAuth(), request: useApiFetch('/server') }), { wrapper: Wrapper });
  return { ...hook, storage };
}

const settled = (result) => waitFor(() => {
  expect(result.current.isSessionReady).toBe(true);
  expect(result.current.isRefreshingSession).toBe(false);
});

describe('real provider authoritative refresh', () => {
  it.each([['personal', 'admin'], ['admin', 'personal']])(
    'bootstraps %s to %s before the first permission request, using the new JWT and tuple', async (from, to) => {
      const initial = sessionFixture({ role: from });
      const next = sessionFixture({ role: to, org: 'new-org' });
      const pending = deferred();
      const observed = [];
      fetch.mockImplementation((path, options) => {
        if (path.endsWith('/refreshtoken')) return pending.promise;
        observed.push({ path, options });
        return Promise.resolve(jsonResponse({ windowAccess: { fixtureWindow: 'full' }, capabilities: { manage: to === 'admin' } }));
      });
      const access = vi.fn(async (session) => {
        expect(session).toEqual(next);
        return (await apiFetch('/sws/neo/access')).json();
      });
      const { result, storage } = setup({ session: initial, fetchWindowAccess: access });
      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(result.current.isSessionReady).toBe(false);
      expect(access).not.toHaveBeenCalled();
      await act(async () => pending.resolve(refreshResponse(metadataResponse(next))));
      await settled(result);
      expect(access).toHaveBeenCalledTimes(1);
      expect(observed).toHaveLength(1);
      expect(observed[0].options.headers.Authorization).toBe(`Bearer ${next.token}`);
      expect(observed[0].path).toBe('/server/sws/neo/access');
      expect(storage.read()).toEqual(next);
      expect(result.current.selectedRole).toEqual(next.roleList[0]);
      expect(result.current.selectedOrg).toEqual(next.roleList[0].orgList[0]);
      expect(result.current.capabilities.manage).toBe(to === 'admin');
    },
  );

  it('refreshes same-role metadata and access without applying another tenant user context', async () => {
    const initial = sessionFixture();
    const next = sessionFixture({ revision: 1 });
    next.selectedRole.name = 'Updated X role';
    next.selectedRole.orgList.push({ id: 'X-extra', name: 'Extra X organization' });
    fetch.mockResolvedValueOnce(refreshResponse(metadataResponse(initial)))
      .mockResolvedValueOnce(refreshResponse(metadataResponse(next)));
    const access = vi.fn().mockResolvedValueOnce({ capabilities: { manage: true } })
      .mockResolvedValueOnce({ capabilities: { manage: false } });
    const { result, storage } = setup({ fetchWindowAccess: access });
    await settled(result);
    const revision = result.current.authRevision;
    await act(async () => { await result.current.refreshToken(); });
    expect(storage.read()).toEqual(next);
    expect(result.current.clientId).toBe('tenant-X');
    expect(result.current.capabilities).toEqual({ manage: false });
    expect(result.current.authRevision).toBeGreaterThan(revision);
    expect(access).toHaveBeenCalledTimes(2);
    for (const [, options] of fetch.mock.calls) expect(options.headers.Authorization).toContain(initial.token);
  });

  it('does not bump authRevision on a pure token rotation with unchanged metadata AND unchanged access', async () => {
    // ETP-5195 follow-up — regression for the live-reported "alt-tab causes a menu flicker
    // and an unrelated open window loses its data/scroll, even with zero role change" bug.
    // The backend mints a brand-new JWT (fresh iat/exp) on every refresh call regardless of
    // whether anything about the role/org actually changed; adopting that new token is still
    // required (see "uses the renewed JWT..." below), but bumping `authRevision` for a
    // rotation this pure — same metadata, same resolved access — is what cascaded a
    // needless reset through every authRevision-gated consumer app-wide.
    const initial = sessionFixture();
    const next = sessionFixture({ revision: 1 });
    fetch.mockResolvedValueOnce(refreshResponse(metadataResponse(initial)))
      .mockResolvedValueOnce(refreshResponse(metadataResponse(next)));
    const access = vi.fn().mockResolvedValue({ capabilities: { manage: true } });
    const { result, storage } = setup({ fetchWindowAccess: access });
    await settled(result);
    const revision = result.current.authRevision;
    const priorWindowAccess = result.current.windowAccess;
    const priorCapabilities = result.current.capabilities;
    await act(async () => { await result.current.refreshToken(); });
    expect(storage.read().token).toBe(next.token);
    expect(result.current.authRevision).toBe(revision);
    // Reference-stable, not just value-equal — a fresh object here would still recreate any
    // `useAuth()` consumer's own memoized derivations that key off object identity.
    expect(result.current.windowAccess).toBe(priorWindowAccess);
    expect(result.current.capabilities).toBe(priorCapabilities);
  });

  it.each(['ambient', 'session-bound'])('uses the renewed JWT for authoritative same-role %s permission transport', async (transport) => {
    const initial = sessionFixture();
    const next = sessionFixture({ revision: 1 });
    const permissionRequests = [];
    fetch.mockImplementation((path, options) => {
      if (path.endsWith('/refreshtoken')) return Promise.resolve(refreshResponse(metadataResponse(next)));
      permissionRequests.push(options.headers.Authorization);
      return Promise.resolve(jsonResponse({ windowAccess: { fixtureWindow: 'full' } }));
    });
    const access = vi.fn(async (session) => {
      const request = transport === 'ambient' ? apiFetch : createApiFetch('/server', () => session.token, () => {});
      return (await request('/sws/neo/access')).json();
    });
    const { result } = setup({ session: initial, fetchWindowAccess: access });
    await settled(result);
    expect(permissionRequests).toEqual([`Bearer ${next.token}`]);
    expect(result.current.windowAccess).toEqual({ fixtureWindow: 'full' });
  });

  it.each(['userId', 'clientId', 'selectedRoleId', 'selectedOrgId', 'version'])(
    'invalid supplied %s metadata blocks access without any partial storage mutation', async (field) => {
      const initial = sessionFixture();
      const response = metadataResponse(sessionFixture({ role: 'admin' }));
      response.session[field] = field === 'version' ? 99 : 'mismatched';
      fetch.mockResolvedValue(refreshResponse(response));
      const access = vi.fn();
      const { result, storage } = setup({ fetchWindowAccess: access });
      await waitFor(() => expect(result.current.sessionRefreshStatus).toBe('metadata-required'));
      expect(result.current.isSessionReady).toBe(false);
      expect(storage.read()).toEqual(initial);
      expect(result.current.windowAccess).toEqual({});
      expect(result.current.capabilities).toEqual({});
      expect(access).not.toHaveBeenCalled();
    },
  );

  it('keeps legacy unchanged identity ready and revalidates access without a storage write', async () => {
    const session = sessionFixture();
    fetch.mockResolvedValue(refreshResponse({ token: sessionFixture({ revision: 1 }).token }));
    const access = vi.fn().mockResolvedValue({ windowAccess: { fixtureWindow: 'read-only' } });
    const { result, storage } = setup({ session, fetchWindowAccess: access });
    const write = vi.spyOn(storage, 'write');
    await settled(result);
    expect(result.current.sessionRefreshStatus).toBe('legacy');
    expect(result.current.token).toBe(session.token);
    expect(result.current.windowAccess.fixtureWindow).toBe('read-only');
    expect(write).not.toHaveBeenCalled();
  });

  it('blocks changed token-only identity, survives failed retries, and recovers only with valid metadata', async () => {
    const initial = sessionFixture();
    const next = sessionFixture({ role: 'admin' });
    fetch.mockResolvedValueOnce(refreshResponse({ token: next.token }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(refreshResponse({ token: initial.token }))
      .mockResolvedValueOnce(refreshResponse(metadataResponse(next)));
    const access = vi.fn().mockResolvedValue({ capabilities: { manage: true } });
    const { result, storage } = setup({ fetchWindowAccess: access });
    await waitFor(() => expect(result.current.sessionRefreshStatus).toBe('metadata-required'));
    for (let retry = 0; retry < 2; retry += 1) {
      await act(async () => { await result.current.refreshToken(); });
      expect(result.current.isSessionReady).toBe(false);
      expect(storage.read()).toEqual(initial);
      expect(result.current.windowAccess).toEqual({});
      expect(result.current.capabilities).toEqual({});
      expect(access).not.toHaveBeenCalled();
    }
    await act(async () => { await result.current.refreshToken(); });
    expect(result.current.isSessionReady).toBe(true);
    expect(storage.read()).toEqual(next);
    expect(result.current.capabilities.manage).toBe(true);
  });

  it('rejects foreign Y metadata while account user X is active', async () => {
    const initial = sessionFixture();
    fetch.mockResolvedValue(refreshResponse(metadataResponse(sessionFixture({ tenant: 'Y', role: 'personal' }))));
    const access = vi.fn();
    const { result, storage } = setup({ fetchWindowAccess: access });
    await waitFor(() => expect(result.current.sessionRefreshStatus).toBe('metadata-required'));
    expect(storage.read()).toEqual(initial);
    expect(result.current.isSessionReady).toBe(false);
    expect(access).not.toHaveBeenCalled();
  });

  it('does not resurrect logout when the response resolves in the same React batch before render', async () => {
    const pending = deferred();
    fetch.mockReturnValue(pending.promise);
    const { result, storage } = setup();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      result.current.logout();
      pending.resolve(refreshResponse(metadataResponse(sessionFixture({ role: 'admin' }))));
      await Promise.resolve();
    });
    expect(result.current.token).toBe(null);
    expect(storage.read().token).toBe(null);
    expect(result.current.windowAccess).toEqual({});
  });

  it.each(['same-token', 'tenant-X'])('discards pending Y refresh after %s replacement', async (replacement) => {
    const y = sessionFixture({ tenant: 'Y' });
    const next = replacement === 'same-token' ? { ...y, username: 'replacement-generation' } : sessionFixture();
    const old = deferred();
    const fresh = deferred();
    fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result, storage } = setup({ session: y });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const snapshot = result.current.captureSession();
    act(() => result.current.replaceSession(next));
    expect(result.current.isCurrentSession(snapshot)).toBe(false);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => old.resolve(refreshResponse(metadataResponse(sessionFixture({ tenant: 'Y', role: 'admin' })))));
    expect(storage.read()).toEqual(next);
    expect(result.current.token).toBe(next.token);
    await act(async () => fresh.resolve(refreshResponse(metadataResponse(next))));
    await settled(result);
    expect(storage.read()).toEqual(next);
  });

  it('a delayed old 401 cannot log out replacement, while its current 401 does', async () => {
    const session = sessionFixture();
    const old = deferred();
    fetch.mockResolvedValue(refreshResponse({ token: session.token }));
    const { result } = setup();
    await settled(result);
    fetch.mockReturnValueOnce(old.promise);
    const oldRequest = result.current.request('/resource').catch((error) => error);
    act(() => result.current.replaceSession(session));
    await settled(result);
    await act(async () => old.resolve(jsonResponse({}, 401)));
    expect((await oldRequest).name).toBe('AbortError');
    expect(result.current.token).toBe(session.token);
    fetch.mockResolvedValueOnce(jsonResponse({}, 401));
    await act(async () => {
      await expect(result.current.request('/resource')).rejects.toThrow('Unauthorized');
    });
    expect(result.current.token).toBe(null);
  });

  it('discards old access after replacement without overwriting current access', async () => {
    const initial = sessionFixture({ tenant: 'Y' });
    const next = sessionFixture();
    const old = deferred();
    fetch.mockResolvedValueOnce(refreshResponse(metadataResponse(initial)))
      .mockResolvedValueOnce(refreshResponse(metadataResponse(next)));
    const access = vi.fn().mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ windowAccess: { fixtureWindow: 'full' }, capabilities: { tenantX: true } });
    const { result } = setup({ session: initial, fetchWindowAccess: access });
    await waitFor(() => expect(access).toHaveBeenCalledTimes(1));
    act(() => result.current.replaceSession(next));
    await settled(result);
    await act(async () => old.resolve({ windowAccess: { fixtureWindow: 'none' }, capabilities: { tenantY: true } }));
    expect(result.current.windowAccess).toEqual({ fixtureWindow: 'full' });
    expect(result.current.capabilities).toEqual({ tenantX: true });
    expect(access.mock.calls[0][1].isCurrent()).toBe(false);
    expect(access).toHaveBeenCalledTimes(2);
  });
});

describe('automatic refresh lifecycle and form preservation', () => {
  it('ignores focus and visibility while hidden, then refreshes on visible focus', async () => {
    vi.useFakeTimers();
    fetch.mockResolvedValue(refreshResponse({ token: sessionFixture().token }));
    const { result } = setup();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.isSessionReady).toBe(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('coalesces focus and visibility, deduplicates in flight, and cleans up StrictMode listeners and timers', async () => {
    vi.useFakeTimers();
    const pending = deferred();
    fetch.mockResolvedValueOnce(refreshResponse({ token: sessionFixture().token })).mockReturnValue(pending.promise);
    const { result, unmount } = setup({ strict: true });
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.isSessionReady).toBe(true);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new Event('focus'));
    unmount();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {
      pending.resolve(refreshResponse({ token: sessionFixture().token }));
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('issues one trailing post-mutation refresh for concurrent imperative calls during a background request', async () => {
    const old = deferred();
    const fresh = deferred();
    fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const access = vi.fn().mockResolvedValue({ capabilities: { manage: true } });
    const { result, storage } = setup({ fetchWindowAccess: access });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    let first;
    let second;
    act(() => {
      first = result.current.refreshToken();
      second = result.current.refreshToken();
    });
    expect(first).toBe(second);
    await act(async () => old.resolve(refreshResponse(metadataResponse(sessionFixture()))));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(access).not.toHaveBeenCalled();
    const next = sessionFixture({ role: 'admin' });
    await act(async () => {
      fresh.resolve(refreshResponse(metadataResponse(next)));
      await first;
    });
    expect(storage.read()).toEqual(next);
    expect(access).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(['legacy', 'metadata'])('keeps the real guarded editable subtree mounted during unchanged %s focus refresh', async (kind) => {
    const session = sessionFixture();
    const response = kind === 'metadata' ? metadataResponse(session) : { token: session.token };
    const accessPending = deferred();
    const mounts = vi.fn();
    const unmounts = vi.fn();
    const access = vi.fn().mockResolvedValueOnce({ windowAccess: { fixtureWindow: 'full' } })
      .mockReturnValueOnce(accessPending.promise);
    fetch.mockResolvedValue(refreshResponse(response));
    function Editor() {
      const [value, setValue] = useState('');
      useEffect(() => { mounts(); return unmounts; }, []);
      return <input aria-label="draft" value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    render(<AuthProvider storage={createMemoryAuthStorage(session)} fetchWindowAccess={access}>
      <AuthGate pendingFallback={<span data-testid="pending" />} fallback={<span data-testid="login" />}>
        <WindowAccessGuard windowId="fixtureWindow"><Editor /></WindowAccessGuard>
      </AuthGate>
    </AuthProvider>);
    expect(screen.getByTestId('pending')).toBeInTheDocument();
    expect(screen.queryByTestId('login')).toBeNull();
    const input = await screen.findByRole('textbox', { name: 'draft' });
    fireEvent.change(input, { target: { value: 'unsaved edit' } });
    fireEvent.focus(window);
    await waitFor(() => expect(access).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveValue('unsaved edit');
    expect(unmounts).not.toHaveBeenCalled();
    await act(async () => accessPending.resolve({ windowAccess: { fixtureWindow: 'full' } }));
    expect(screen.getByRole('textbox')).toBe(input);
    expect(input).toHaveValue('unsaved edit');
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();
  });
});

describe('real data and currency consumers', () => {
  it.each(['different-tenant', 'same-token'])('hides old query data and discards late query/currency bodies after %s replacement', async (mode) => {
    const initial = sessionFixture({ tenant: 'Y' });
    const next = mode === 'same-token' ? initial : sessionFixture();
    const currencyOld = deferred();
    const currencyNew = deferred();
    const queryOld = deferred();
    const queryNew = deferred();
    const firstBootstrap = deferred();
    let sessionCalls = 0;
    fetch.mockImplementation((path, options) => {
      if (path.endsWith('/refreshtoken')) {
        if (fetch.mock.calls.length === 1) return firstBootstrap.promise;
        return Promise.resolve(refreshResponse({ token: options.headers.Authorization.slice(7) }));
      }
      if (path.endsWith('/session')) {
        sessionCalls += 1;
        return Promise.resolve({ ok: true, json: () => sessionCalls === 1 ? currencyOld.promise : currencyNew.promise });
      }
      throw new Error(`Unexpected request ${path}`);
    });
    const fetchQuery = vi.fn().mockResolvedValueOnce('original-visible')
      .mockReturnValueOnce(queryOld.promise).mockReturnValueOnce(queryNew.promise);
    let auth;
    let query;
    let cache;
    function Probe() {
      auth = useAuth();
      cache = useDataCache().cache;
      query = useQuery({ entity: 'fixture', fetcher: fetchQuery });
      const currency = useCurrency();
      return <><span data-testid="query">{query.data ?? 'empty'}</span>
        <span data-testid="currency">{currency ?? 'empty'}</span></>;
    }
    render(<AuthProvider storage={createMemoryAuthStorage(initial)}>
      <DataProvider><CurrencyProvider><Probe /></CurrencyProvider></DataProvider>
    </AuthProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(sessionCalls).toBe(0);
    await act(async () => firstBootstrap.resolve(refreshResponse({ token: initial.token })));
    await waitFor(() => expect(screen.getByTestId('query')).toHaveTextContent('original-visible'));
    const oldKey = query.key;
    let refreshQuery;
    act(() => { refreshQuery = query.refetch(); });
    await waitFor(() => expect(fetchQuery).toHaveBeenCalledTimes(2));
    act(() => auth.replaceSession(next));
    expect(screen.getByTestId('query')).toHaveTextContent('empty');
    await waitFor(() => expect(fetchQuery).toHaveBeenCalledTimes(3));
    await act(async () => {
      queryOld.resolve('obsolete-data');
      currencyOld.resolve({ currencyCode: 'EUR' });
      await refreshQuery;
    });
    expect(screen.getByTestId('query')).toHaveTextContent('empty');
    expect(screen.getByTestId('currency')).toHaveTextContent('empty');
    expect(cache.getData(oldKey)).toBeUndefined();
    await act(async () => {
      queryNew.resolve('current-data');
      currencyNew.resolve({ currencyCode: 'ARS' });
    });
    expect(screen.getByTestId('query')).toHaveTextContent('current-data');
    expect(screen.getByTestId('currency')).toHaveTextContent('ARS');
    expect(cache.getData(query.key)).toBe('current-data');
    expect(fetchQuery).toHaveBeenCalledTimes(3);
    expect(sessionCalls).toBe(2);
  });
});
