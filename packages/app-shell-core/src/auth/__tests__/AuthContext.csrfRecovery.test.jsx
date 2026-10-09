import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import { createMemoryAuthStorage } from '../session.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { apiFetch } from '../api.js';
import { getSessionCsrfToken } from '../sessionCredentials.js';
import { announceSessionAccount, resetSessionConflictForTests } from '../sessionConflict.js';

// @covers packages/app-shell-core/src/auth/AuthContext.jsx

// ETP-5550 — the provider is the session owner apiFetch asks for the live CSRF proof after a
// stale-proof refusal. It re-reads the session through the same `restoreSession` it booted with
// (GET /sws/go/session, which never rotates) and adopts the proof only while the session is still
// in the environment this tab shows: a tab left on company X must not start writing into the
// company another tab switched to.

const STALE = 'csrf-of-the-rotated-session';
const LIVE = 'csrf-of-the-live-session';

function restored({ csrfToken, clientId = 'C1', roleId = 'R1', orgId = 'O1', name = 'Ana', accountId } = {}) {
  return {
    account: { name, ...(accountId ? { id: accountId, email: `${accountId}@example.test` } : {}) },
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
  resetSessionConflictForTests();
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

// ETP-5675 — the cookie is the browser profile's and production is one domain for every customer.
// A tab still showing account B after another tab signed in as C must find out and say so, and
// must never adopt C's proof or revoke C's session.
describe('AuthContext detects a session another account opened in another tab (ETP-5675)', () => {
  it('binds its requests to the account it restored', async () => {
    const seen = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      seen.push(init.headers?.['X-Go-Account']);
      return jsonResponse({ ok: true }, 200);
    }));
    const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
    const result = await bootWith(restoreSession);

    await apiFetch('/sales/order');

    expect(seen).toEqual(['acc-B']);
    expect(result.current.account).toEqual({ id: 'acc-B', email: 'acc-B@example.test', name: 'Ana' });
  });

  it('raises the conflict instead of adopting another account\'s proof', async () => {
    const restoreSession = vi.fn()
      .mockResolvedValueOnce(restored({ csrfToken: STALE, accountId: 'acc-B' }))
      .mockResolvedValueOnce(restored({ csrfToken: LIVE, accountId: 'acc-C' }));
    const result = await bootWith(restoreSession);

    const res = await apiFetch('/sales/order', { method: 'POST', body: '{}' });

    expect(res.status).toBe(403);
    expect(writes).toHaveLength(1);
    expect(getSessionCsrfToken()).toBe(STALE);
    await waitFor(() => { expect(result.current.sessionConflict).toEqual({ reason: 'csrf-recovery', accountId: 'acc-C' }); });
  });

  it('raises the conflict on the backend\'s account-mismatch refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(
      { error: { message: 'Session belongs to another account', status: 403 } }, 403,
    )));
    const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
    const result = await bootWith(restoreSession);

    await apiFetch('/contacts/businessPartner');

    await waitFor(() => { expect(result.current.sessionConflict?.reason).toBe('request'); });
    expect(result.current.status).toBe('authenticated');
  });

  describe('announcements from other tabs', () => {
    let channels;
    beforeEach(() => {
      channels = [];
      vi.stubGlobal('BroadcastChannel', class {
        constructor(name) { this.name = name; this.closed = false; channels.push(this); }

        postMessage(data) {
          channels.filter((c) => c !== this && !c.closed && c.name === this.name)
            .forEach((c) => c.onmessage?.({ data }));
        }

        close() { this.closed = true; }
      });
    });

    it('raises the conflict when another tab signs the browser in as someone else', async () => {
      const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
      const result = await bootWith(restoreSession);

      announceSessionAccount('acc-C');

      await waitFor(() => { expect(result.current.sessionConflict).toEqual({ reason: 'broadcast', accountId: 'acc-C' }); });
    });

    it('ignores another tab of the same account', async () => {
      const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
      const result = await bootWith(restoreSession);

      announceSessionAccount('acc-B');

      expect(result.current.sessionConflict).toBeNull();
      expect(result.current.status).toBe('authenticated');
    });

    it('signs out locally, without a revoke, when another tab signed the browser out', async () => {
      const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
      const result = await bootWith(restoreSession);
      const before = fetch.mock.calls.length;

      announceSessionAccount(null);

      await waitFor(() => { expect(result.current.status).toBe('anonymous'); });
      expect(fetch.mock.calls.slice(before).some(([, init = {}]) => init.method === 'DELETE')).toBe(false);
    });

    // A restore announced `account.id ?? null`, so a session restored without an id told every
    // other tab the browser had signed out, and they all logged out locally.
    it('is not signed out by another tab restoring a session without an account id', async () => {
      const result = await bootWith(vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' })));

      await bootWith(vi.fn().mockResolvedValue(restored({ csrfToken: STALE })));

      expect(result.current.status).toBe('authenticated');
      expect(result.current.sessionConflict).toBeNull();
    });
  });

  it('names its own account when it logs out', async () => {
    const deletes = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
      if (init.method === 'DELETE') deletes.push(init.headers);
      return new Response(null, { status: 204 });
    }));
    const restoreSession = vi.fn().mockResolvedValue(restored({ csrfToken: STALE, accountId: 'acc-B' }));
    const result = await bootWith(restoreSession);

    result.current.logout();

    await waitFor(() => { expect(deletes).toHaveLength(1); });
    expect(deletes[0]).toEqual({ 'X-Go-CSRF': STALE, 'X-Go-Account': 'acc-B' });
  });
});
