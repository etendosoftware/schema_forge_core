import { describe, test, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth, createMemoryAuthStorage } from '../../auth/index.js';
import { DataProvider, useDataCache } from '../DataProvider.jsx';
import { useQuery } from '../useQuery.jsx';

// ETP-4576 cycle 4a — `restoreSession` is no longer opt-in: AuthProvider defaults
// it to the platform cookie fetcher (fetchCookieSession). Left on the default, every
// provider here would call `fetch` on mount, fail under jsdom, and take the
// fail-closed path — which runs logout(), clearing the session and thereby changing
// DataProvider's identity scope, which wipes the cache these tests just populated.
// This suite's subject is cache scoping/deduplication, NOT the session restore, so
// it opts OUT of the restore entirely with an explicit `null`: AuthProvider's
// `typeof restoreSession === 'function'` checks then take the legacy branch, status
// resolves synchronously from `session.token`, and the mount effect returns early —
// i.e. behaviour verbatim identical to before the default existed. Note `undefined`
// would NOT work: a default parameter only fills in for `undefined`. Do not remove.
const NO_RESTORE = null;

function renderWithProviders(ui, { session = { token: 'tok', selectedRole: { id: 'r1' }, selectedOrg: { id: 'o1' } } } = {}) {
  return render(
    <AuthProvider
      storage={createMemoryAuthStorage(session)}
      initialSession={session}
      restoreSession={NO_RESTORE}>
      <DataProvider>{ui}</DataProvider>
    </AuthProvider>,
  );
}

// Probe that exposes the cache and a control to change the selected role.
let capturedCache = null;
function CacheProbe() {
  const { cache } = useDataCache();
  const { selectRole, selectOrg } = useAuth();
  capturedCache = cache;
  return (
    <div>
      <button onClick={() => selectRole({ id: 'r2' })}>change-role</button>
      <button onClick={() => selectOrg({ id: 'o2' })}>change-org</button>
    </div>
  );
}

// Probe for ETP-4576 identity-scope tests: exposes the cache plus the auth
// setters needed to simulate a csrfToken rotation (cookie-session hosts with
// no `token`) and a token change (legacy hosts without `csrfToken`).
let capturedIdentityCache = null;
function IdentityProbe() {
  const { cache } = useDataCache();
  const { setCsrfToken, login } = useAuth();
  capturedIdentityCache = cache;
  return (
    <div>
      <button onClick={() => setCsrfToken('csrf-2')}>rotate-csrf</button>
      <button onClick={() => login({ token: 'tok-2' })}>change-token</button>
    </div>
  );
}

describe('DataProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    capturedCache = null;
    capturedIdentityCache = null;
  });

  test('clears cached data when the selected role changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedCache.size).toBe(1);

    await user.click(screen.getByText('change-role'));

    await waitFor(() => expect(capturedCache.size).toBe(0));
  });

  test('clears cached data when the selected organization changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedCache.size).toBe(1);

    await user.click(screen.getByText('change-org'));

    await waitFor(() => expect(capturedCache.size).toBe(0));
  });

  test('two consumers of the same key trigger a single request', async () => {
    const fetcher = vi.fn(() => Promise.resolve('shared'));
    function Consumer({ label }) {
      const { data } = useQuery({ entity: 'Contact', recordId: '1', fetcher });
      return <span>{label}:{data ?? '...'}</span>;
    }

    renderWithProviders(
      <>
        <Consumer label="A" />
        <Consumer label="B" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByText('A:shared')).toBeInTheDocument();
      expect(screen.getByText('B:shared')).toBeInTheDocument();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('cached application data is memory-only (no persistent storage writes)', async () => {
    renderWithProviders(<CacheProbe />);

    await act(async () => {
      await capturedCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve({ secret: 'payload' }),
      });
    });

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  // ETP-4576 — cookie-session hosts (using restoreSession, cycle 4) never
  // populate session.token; scope.auth must fall back to csrfToken so the
  // cache still gets invalidated on login/logout/environment rotation.
  test('clears cached data when csrfToken changes (cookie-session hosts with no token)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityProbe />, { session: {} });

    await act(async () => {
      await capturedIdentityCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedIdentityCache.size).toBe(1);

    await user.click(screen.getByText('rotate-csrf'));

    await waitFor(() => expect(capturedIdentityCache.size).toBe(0));
  });

  // Regression guard: legacy hosts (not yet migrated to restoreSession) keep
  // populating session.token directly via their own login flow and never see
  // a csrfToken. `token` must keep driving cache invalidation for them.
  test('clears cached data when token changes (legacy hosts without csrfToken)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<IdentityProbe />, { session: { token: 'tok-1' } });

    await act(async () => {
      await capturedIdentityCache.fetchQuery({
        key: { entity: 'Contact', recordId: '1' },
        fetcher: () => Promise.resolve('cached'),
      });
    });
    expect(capturedIdentityCache.size).toBe(1);

    await user.click(screen.getByText('change-token'));

    await waitFor(() => expect(capturedIdentityCache.size).toBe(0));
  });
});
