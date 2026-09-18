import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth, createLocalAuthStorage } from '@etendosoftware/app-shell-core/auth';
import { apiFetch, resetApiSessionForTests } from '@etendosoftware/app-shell-core/auth/api';
import { persistEnvironmentSession, clearEnvironmentSession } from '../state.js';
import { sessionFixture, deferred, jsonResponse, metadataResponse } from '../../../../app-shell-core/src/auth/__tests__/refreshFixtures.js';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  resetApiSessionForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('canonical onboarding session persistence', () => {
  it.each(['omitted', 'empty'])('clears %s role metadata and invalidates pending Y work before awaiting cleanup', async (list) => {
    const initial = sessionFixture({ tenant: 'Y', role: 'admin' });
    const next = sessionFixture();
    const storage = createLocalAuthStorage();
    storage.write(initial);
    localStorage.setItem('sf_auth_client_name', 'Tenant Y');
    localStorage.setItem('sf_platform_token', 'account-token');
    const refresh = deferred();
    const request = deferred();
    fetch.mockImplementation((path) => path.endsWith('/refreshtoken') ? refresh.promise : request.promise);
    const { result } = renderHook(() => useAuth(), {
      // ETP-4576 — the session under test is the one `storage` supplies, so the provider
      // opts out of the cookie restore: its mount-time GET /sws/go/session would otherwise
      // land in the fetch counts these cases assert on.
      wrapper: ({ children }) => <AuthProvider storage={storage} restoreSession={null}>{children}</AuthProvider>,
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const snapshot = result.current.captureSession();
    const lateRequest = apiFetch('/resource').catch((error) => error);
    const asyncCleanup = deferred();
    let saved;
    let switchDone;
    await act(async () => {
      switchDone = (async () => {
        saved = persistEnvironmentSession({ clientId: next.clientId, adminUserName: 'account-X' },
          { token: next.token, ...(list === 'empty' ? { roleList: [] } : {}) });
        // These assertions run synchronously before the first cleanup await.
        expect(result.current.isCurrentSession(snapshot)).toBe(false);
        expect(storage.read()).toEqual({ token: next.token, username: 'account-X', clientId: next.clientId,
          roleList: [], selectedRole: null, selectedOrg: null });
        expect(localStorage.getItem('sf_auth_selected_role')).toBeNull();
        expect(localStorage.getItem('sf_auth_selected_org')).toBeNull();
        expect(localStorage.getItem('sf_auth_client_name')).not.toBe('Tenant Y');
        await asyncCleanup.promise;
      })();
    });
    expect(saved.selectedRole).toBeNull();
    expect(result.current.clientId).toBe('tenant-X');
    await act(async () => {
      refresh.resolve(jsonResponse(metadataResponse(sessionFixture({ tenant: 'Y', role: 'personal' }))));
      request.resolve(jsonResponse({}, 401));
    });
    expect((await lateRequest).name).toBe('AbortError');
    expect(result.current.token).toBe(next.token);
    expect(result.current.clientId).toBe('tenant-X');
    expect(localStorage.getItem('sf_platform_token')).toBe('account-token');
    expect(localStorage.getItem('sf_last_environment')).toBe('tenant-X');
    asyncCleanup.resolve();
    await switchDone;
  });

  it('persists fresh destination roles and preferred organization and clears the ambient session synchronously', async () => {
    const initial = sessionFixture();
    const destination = sessionFixture({ tenant: 'Y', role: 'personal' });
    const storage = createLocalAuthStorage();
    storage.write(initial);
    fetch.mockResolvedValue(jsonResponse({ token: initial.token }));
    const { result } = renderHook(() => useAuth(), {
      // ETP-4576 — the session under test is the one `storage` supplies, so the provider
      // opts out of the cookie restore: its mount-time GET /sws/go/session would otherwise
      // land in the fetch counts these cases assert on.
      wrapper: ({ children }) => <AuthProvider storage={storage} restoreSession={null}>{children}</AuthProvider>,
    });
    await waitFor(() => expect(result.current.isSessionReady).toBe(true));
    fetch.mockResolvedValue(jsonResponse({ token: destination.token }));
    destination.selectedRole.orgList.unshift({ id: 'Y-root', name: '*' });
    act(() => persistEnvironmentSession({ clientId: destination.clientId, clientName: 'Tenant Y',
      adminUserName: destination.username }, { token: destination.token, roleList: destination.roleList }));
    expect(storage.read()).toEqual(destination);
    expect(result.current.selectedRole).toEqual(destination.roleList[0]);
    expect(result.current.selectedOrg).toEqual(destination.selectedOrg);
    const snapshot = result.current.captureSession();
    act(() => {
      clearEnvironmentSession();
      expect(result.current.isCurrentSession(snapshot)).toBe(false);
    });
    expect(result.current.token).toBeNull();
    expect(storage.read().roleList).toEqual([]);
    expect(localStorage.getItem('sf_auth_client_name')).toBeNull();
  });
});
