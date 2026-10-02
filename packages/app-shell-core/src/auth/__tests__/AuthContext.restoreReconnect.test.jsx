import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { sessionUnavailableError } from '../api.js';

// ETP-5550 — a tab reloaded while the backend is down (a deploy) used to settle on 'anonymous'
// and send the user to the login screen, although the session was alive and came back with the
// backend. An unavailable backend now keeps the tab booting and retries with backoff; only the
// backend saying there is no session signs the tab out.

const RESTORED = {
  account: { name: 'Ana' },
  environment: { userId: 'U1', roleId: 'R1', clientId: 'C1', orgId: 'O1' },
  roleList: [{ id: 'R1', name: 'Admin', orgList: [{ id: 'O1', name: 'Main' }] }],
  csrfToken: 'csrf-1',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount(restoreSession) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
        {children}
      </AuthProvider>
    ),
  }).result;
}

const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe('AuthContext keeps a tab signed in across a backend outage (ETP-5550)', () => {
  it('stays booting and reconnecting while the backend is unavailable, then restores', async () => {
    const restoreSession = vi.fn()
      .mockRejectedValueOnce(sessionUnavailableError())
      .mockRejectedValueOnce(sessionUnavailableError())
      .mockResolvedValueOnce(RESTORED);
    const result = mount(restoreSession);

    await flush();
    expect(result.current.status).toBe('booting');
    expect(result.current.isReconnecting).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(restoreSession).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('booting');

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(restoreSession).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('authenticated');
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.csrfToken).toBe('csrf-1');
  });

  it('backs off up to a cap instead of hammering the backend', async () => {
    const restoreSession = vi.fn().mockRejectedValue(sessionUnavailableError());
    mount(restoreSession);
    await flush();

    await act(async () => { await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 8000 + 16000); });
    expect(restoreSession).toHaveBeenCalledTimes(6);

    await act(async () => { await vi.advanceTimersByTimeAsync(29999); });
    expect(restoreSession).toHaveBeenCalledTimes(6);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(restoreSession).toHaveBeenCalledTimes(7);
  });

  it('signs the tab out at once when the backend answers that there is no session', async () => {
    const result = mount(vi.fn().mockResolvedValue(null));

    await flush();

    expect(result.current.status).toBe('anonymous');
    expect(result.current.isReconnecting).toBe(false);
  });

  it('keeps any other restore failure fail-closed, as before', async () => {
    const restoreSession = vi.fn().mockRejectedValue(new Error('boom'));
    const result = mount(restoreSession);

    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });

    expect(result.current.status).toBe('anonymous');
    expect(restoreSession).toHaveBeenCalledTimes(1);
  });

  it('stops retrying once the provider unmounts', async () => {
    const restoreSession = vi.fn().mockRejectedValue(sessionUnavailableError());
    mount(restoreSession);
    await flush();

    cleanup();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });

    expect(restoreSession).toHaveBeenCalledTimes(1);
  });
});
