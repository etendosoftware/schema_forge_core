import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { apiFetch } from '../api.js';
import { getSessionCsrfToken } from '../sessionCredentials.js';

// ETP-5550 — the provider is the session owner apiFetch asks for the live CSRF proof after a
// stale-proof refusal. It re-reads the session through the same `restoreSession` it booted with
// (GET /sws/go/session, which never rotates) and adopts the proof only while the session is still
// in the environment this tab shows: a tab left on company X must not start writing into the
// company another tab switched to.

const STALE = 'csrf-of-the-rotated-session';
const LIVE = 'csrf-of-the-live-session';

function restored({ csrfToken, clientId = 'C1', roleId = 'R1', orgId = 'O1', name = 'Ana' } = {}) {
  return {
    account: { name },
    environment: { userId: 'U1', roleId, clientId, orgId, warehouseId: 'W1' },
    roleList: [
      { id: 'R1', name: 'Admin', orgList: [{ id: 'O1', name: 'Main' }, { id: 'O2', name: 'Branch' }] },
      { id: 'R2', name: 'Sales', orgList: [{ id: 'O1', name: 'Main' }] },
    ],
    csrfToken,
  };
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const staleRefusal = () => jsonResponse({ error: { message: 'CSRF validation failed', status: 403 } }, 403);

let writes;
beforeEach(() => {
  writes = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    writes.push({ url: String(url), csrf: init.headers?.['X-Go-CSRF'] });
    return init.headers?.['X-Go-CSRF'] === LIVE ? jsonResponse({ ok: true }, 200) : staleRefusal();
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function bootWith(restoreSession) {
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <AuthProvider storage={createMemoryAuthStorage()} restoreSession={restoreSession}>
        {children}
      </AuthProvider>
    ),
  });
  await waitFor(() => { expect(result.current.status).toBe('authenticated'); });
  await waitFor(() => { expect(getSessionCsrfToken()).toBe(STALE); });
  return result;
}

describe('AuthContext recovers a CSRF proof another tab rotated away (ETP-5550)', () => {
  it('adopts the live proof of the same environment and the write goes through', async () => {
    const restoreSession = vi.fn()
      .mockResolvedValueOnce(restored({ csrfToken: STALE }))
      .mockResolvedValueOnce(restored({ csrfToken: LIVE }));
    const result = await bootWith(restoreSession);

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    expect(res.status).toBe(200);
    expect(writes.map((w) => w.csrf)).toEqual([STALE, LIVE]);
    expect(restoreSession).toHaveBeenCalledTimes(2);
    await waitFor(() => { expect(result.current.csrfToken).toBe(LIVE); });
    expect(result.current.status).toBe('authenticated');
  });

  it.each([
    ['another company', { clientId: 'C2' }],
    ['another role', { roleId: 'R2' }],
    ['another organization', { orgId: 'O2' }],
    ['another account', { name: 'Bea' }],
  ])('refuses the proof when the session moved to %s', async (_label, change) => {
    const restoreSession = vi.fn()
      .mockResolvedValueOnce(restored({ csrfToken: STALE }))
      .mockResolvedValueOnce(restored({ csrfToken: LIVE, ...change }));
    const result = await bootWith(restoreSession);

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    expect(res.status).toBe(403);
    expect(writes).toHaveLength(1);
    expect(getSessionCsrfToken()).toBe(STALE);
    expect(result.current.csrfToken).toBe(STALE);
  });

  it('keeps the refusal, and the tab signed in, when the re-read finds no session', async () => {
    const restoreSession = vi.fn()
      .mockResolvedValueOnce(restored({ csrfToken: STALE }))
      .mockResolvedValueOnce(null);
    const result = await bootWith(restoreSession);

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    expect(res.status).toBe(403);
    expect(writes).toHaveLength(1);
    expect(result.current.status).toBe('authenticated');
  });

  it('keeps the refusal when the re-read itself fails', async () => {
    const restoreSession = vi.fn()
      .mockResolvedValueOnce(restored({ csrfToken: STALE }))
      .mockRejectedValueOnce(new Error('network error'));
    await bootWith(restoreSession);

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    expect(res.status).toBe(403);
    expect(writes).toHaveLength(1);
  });
});
