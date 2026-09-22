import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, LogoutRoute, createMemoryAuthStorage } from '../../index.js';

const SAFE_DESTINATION = '/onboarding';

// ETP-4576 — LogoutRoute is the app's real `/logout` route (schema_forge mounts
// it as <LogoutRoute safeDestination="/onboarding" /> with NO `cleanup` prop),
// and its old default cleanup only did createLocalAuthStorage().clear(). That is
// the second mouth of the same hole the AuthContext cycle closed: with the
// httpOnly `__Host-` session cookie, clearing localStorage revokes nothing — the
// cookie survives the "logout" and the session stays valid on the server. Only
// DELETE /sws/go/session (ETP-4575) revokes it.
//
// New contract pinned here: when no `cleanup` prop is given, LogoutRoute uses
// the AuthContext `logout()` (revoke + local clear + state reset). The `cleanup`
// prop is still the public API and still WINS when passed — that priority is
// exercised below too, since consumers may own their teardown.
//
// LogoutRoute now consumes useAuth(), which throws outside a provider, so every
// render below is wrapped in <AuthProvider> — which is also how the real app
// mounts it (a route inside AppShellProviders).
const NEVER_SETTLES = () => new Promise(() => {});

function DestinationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="destination">{`${navigationType}:${location.pathname}${location.search}`}</output>;
}

// The provider's `restoreSession` default (fetchCookieSession) would add a
// GET /sws/go/session on every mount and, on its 401, fail closed by clearing
// the session. Both would pollute what these tests observe, so it is neutralised
// with a never-settling override — same approach as AuthContext.test.jsx. The
// stub still answers 401 for anything that does reach it.
let fetchStub;
beforeEach(() => {
  fetchStub = vi.fn(async () => ({
    ok: false,
    status: 401,
    json: async () => {
      throw new Error('a 401 session response has no JSON body');
    },
  }));
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function deleteSessionCalls() {
  return fetchStub.mock.calls.filter(([url, init = {}]) => (
    (init.method || '').toUpperCase() === 'DELETE' && /\/sws\/go\/session$/.test(String(url))
  ));
}

function logoutTree({ entry = '/logout', cleanup, safeDestination = SAFE_DESTINATION, storage }) {
  return (
    <AuthProvider storage={storage} restoreSession={NEVER_SETTLES}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/logout"
            element={<LogoutRoute cleanup={cleanup} safeDestination={safeDestination} />}
          />
          <Route path="*" element={<DestinationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function renderLogoutRoute(options = {}) {
  const storage = options.storage ?? createMemoryAuthStorage();
  const view = render(logoutTree({ ...options, storage }));
  return { ...view, storage, props: { ...options, storage } };
}

async function expectDestination(destination = SAFE_DESTINATION) {
  await waitFor(() => {
    expect(screen.getByTestId('destination')).toHaveTextContent(`REPLACE:${destination}`);
  });
}

describe('LogoutRoute — default cleanup revokes the session server-side (ETP-4576)', () => {
  it('fires a DELETE /sws/go/session when no cleanup prop is passed', async () => {
    renderLogoutRoute();

    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
    const [, init = {}] = deleteSessionCalls()[0];
    // The cookie IS the credential, so the revoke has to be allowed to send it.
    expect(init.credentials).toBe('include');

    await expectDestination();
  });

  it('also clears the local session, through the same context logout', async () => {
    // Replaces the two former 'uses the local auth storage cleanup authority'
    // tests: those seeded raw sf_auth_*/sf_platform_* localStorage keys, which
    // AuthProvider's mount purge (purgeLegacyAuthStorage) now removes on its
    // own — the assertion would pass without LogoutRoute doing anything. The
    // provider's own storage is the honest probe for the local half of logout().
    const storage = createMemoryAuthStorage({ token: 'session-token', username: 'Ada' });
    expect(storage.read().token).toBe('session-token');

    renderLogoutRoute({ storage });

    await expectDestination();
    expect(storage.read().token).toBeNull();
    expect(storage.read().username).toBeNull();
    // ...and the revoke is the part local-only cleanup could never do.
    expect(deleteSessionCalls()).toHaveLength(1);
  });

  it('still redirects when the server-side revoke fails (offline / 403 / 500)', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));

    renderLogoutRoute();

    // The user asked to leave: a failed revoke must not trap them on /logout.
    await expectDestination();
    await waitFor(() => {
      expect(deleteSessionCalls()).toHaveLength(1);
    });
  });

  it('revokes only once even when the route is re-rendered', async () => {
    const props = { storage: createMemoryAuthStorage() };
    const { rerender } = render(logoutTree(props));

    await expectDestination();
    rerender(logoutTree(props));

    expect(deleteSessionCalls()).toHaveLength(1);
  });

  it('resolves an unsafe configured destination to / while still revoking', async () => {
    renderLogoutRoute({ safeDestination: 'https://attacker.example/steal' });

    await expectDestination('/');
    expect(deleteSessionCalls()).toHaveLength(1);
  });
});

describe('LogoutRoute — an explicit cleanup prop keeps priority', () => {
  it('runs the consumer cleanup and does NOT revoke the session server-side', async () => {
    const cleanup = vi.fn();

    renderLogoutRoute({ cleanup });

    await expectDestination();
    expect(cleanup).toHaveBeenCalledTimes(1);
    // The prop replaces the default authority outright — it must not be raced
    // alongside the context logout, or a consumer owning its own teardown would
    // get a surprise round trip (and a revoke it did not ask for).
    expect(deleteSessionCalls()).toHaveLength(0);
  });

  it.each([
    'https://attacker.example/steal',
    '//attacker.example/steal',
    'javascript:alert(1)',
    'not-a-local-path',
    '/%',
    '/logout',
    '/onboarding?returnTo=/logout',
    '/onboarding?returnTo=%2Flogout',
  ])('rejects unsafe configured destination %s', async (safeDestination) => {
    const cleanup = vi.fn();
    renderLogoutRoute({ cleanup, safeDestination });

    await expectDestination('/');
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not let a query destination override the configured safe destination', async () => {
    const cleanup = vi.fn();
    renderLogoutRoute({
      entry: '/logout?returnTo=https%3A%2F%2Fattacker.example%2Fsteal',
      cleanup,
    });

    await expectDestination();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not repeat cleanup when its effect is re-rendered', async () => {
    const cleanup = vi.fn();
    const props = { cleanup, storage: createMemoryAuthStorage() };
    const { rerender } = render(logoutTree(props));

    await expectDestination();
    rerender(logoutTree(props));

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('redirects anyway when the cleanup rejects', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('teardown exploded'));

    renderLogoutRoute({ cleanup });

    await expectDestination();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('redirects anyway when the cleanup throws synchronously', async () => {
    const cleanup = vi.fn(() => {
      throw new Error('teardown exploded synchronously');
    });

    renderLogoutRoute({ cleanup });

    await expectDestination();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
