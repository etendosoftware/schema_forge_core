import { test, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { AppShellRuntime } from '../AppShellRuntime.jsx';
import { useAuth } from '../../auth/index.js';

// Core vitest runs without `globals: true` (see vitest.config.js) — do
// explicit cleanup so mounted providers don't bleed between tests.
afterEach(cleanup);

// ETP-4576 cycle 4a — `restoreSession` is no longer opt-in: AuthProvider defaults
// it to the platform cookie fetcher (fetchCookieSession), and AppShellRuntime
// forwards `auth.restoreSession` straight through (so omitting it hands the default
// to every runtime mounted here). The tests below that predate the cookie-session
// flow assume the legacy behaviour: `status` resolved synchronously from
// `auth.initialSession.token`, never 'booting', and no fail-closed logout(). Under
// the default they'd instead park in 'booting' (renderToStaticMarkup then yields the
// empty bootingFallback) or get their windowAccess wiped by the logout that follows
// a failed jsdom fetch. They opt OUT with an explicit `null`: AuthProvider's
// `typeof restoreSession === 'function'` checks take the legacy branch and the mount
// effect returns early. Note `undefined` would NOT work — a default parameter only
// fills in for `undefined`. The ETP-4576 tests further down deliberately DO pass a
// restoreSession, since the restore is their actual subject. Do not remove.
const NO_RESTORE = null;

function RouteAwareProbe() {
  // Throws outside a Router context — proves children mount inside BrowserRouter.
  const location = useLocation();
  return <div data-testid="probe">{location.pathname}</div>;
}

test('AppShellRuntime renders children inside the router so they can use router hooks', () => {
  const html = renderToStaticMarkup(
    <AppShellRuntime
      basename="/"
      menuGroups={[]}
      routes={[{ path: 'home', index: true, public: true, element: <div>home</div> }]}
      auth={{ loginPath: '/login' }}
    >
      <RouteAwareProbe />
    </AppShellRuntime>
  );

  expect(html).toMatch(/data-testid="probe"/);
});

test('AppShellRuntime uses a custom layout component when one is provided', () => {
  function CustomLayout({ menuGroups }) {
    return <div data-testid="custom-layout">{menuGroups.length} groups</div>;
  }

  const html = renderToStaticMarkup(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div>home</div> }]}
      auth={{ loginPath: '/login', unauthenticatedFallback: <div>n/a</div>, initialSession: { token: 'test-token' }, restoreSession: NO_RESTORE }}
      layout={CustomLayout}
    />
  );

  expect(html).toMatch(/data-testid="custom-layout"/);
  expect(html).toMatch(/1 groups/);
});

test('AppShellRuntime falls back to ShellLayout when no layout override is given', () => {
  const html = renderToStaticMarkup(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div>home</div> }]}
      auth={{ loginPath: '/login', unauthenticatedFallback: <div>n/a</div>, initialSession: { token: 'test-token' }, restoreSession: NO_RESTORE }}
    />
  );

  expect(html).toMatch(/Group 1/);
});

// ETP-4520 — `auth.fetchWindowAccess` must reach `AuthProvider` through
// `AppShellRuntime` -> `AppShellProviders`, the same pass-through path used by
// `storage`/`initialSession`/`onSessionChange`. Without this, host apps have
// no way to wire the window-access webhook fetch into the runtime.
test('AppShellRuntime forwards auth.fetchWindowAccess to AuthProvider', async () => {
  function RoleSelectorProbe() {
    const { selectRole, windowAccess } = useAuth();
    return (
      <div>
        <button type="button" data-testid="select-role" onClick={() => selectRole({ id: 'role-1' })}>
          select
        </button>
        <div data-testid="window-access">{JSON.stringify(windowAccess)}</div>
      </div>
    );
  }

  const fetchWindowAccess = async () => ({
    windowAccess: { '147': 'full' },
    capabilities: { showAccountingFields: true },
  });

  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[]}
      routes={[{ path: 'home', index: true, public: true, element: <div>home</div> }]}
      auth={{ loginPath: '/login', fetchWindowAccess, restoreSession: NO_RESTORE }}
    >
      <RoleSelectorProbe />
    </AppShellRuntime>
  );

  await act(async () => {
    screen.getByTestId('select-role').click();
  });

  expect(await screen.findByTestId('window-access')).toHaveTextContent('{"147":"full"}');
});

// ETP-4576 — session-restore-by-cookie migration. `AppShellRuntime` must forward
// `auth.restoreSession` to `AuthProvider` through the exact same pass-through
// mechanism proven above for `fetchWindowAccess`, and its `AuthGate` must gate
// on the tri-state `status` ('booting' | 'authenticated' | 'anonymous') exposed
// by `useAuth()`, not only on `isAuthenticated`. Without this, a host that
// opts into the cookie-session restore flow would see a flash of the
// unauthenticated redirect before the restore resolves.
//
// A `restoreSession` mock is used (instead of `initialSession={{ token }}`) to
// force the 'booting' state: per AuthContext.jsx, `status` is only ever
// 'booting' when `restoreSession` is a function — without it, `status`
// resolves synchronously and never passes through 'booting'.

function SessionStatusProbe() {
  const { status, csrfToken } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="csrf">{csrfToken ?? ''}</div>
    </div>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

test('AppShellRuntime forwards auth.restoreSession to AuthProvider', async () => {
  const restoreSession = async () => ({
    account: { id: 'acc-1' },
    environment: {},
    roleList: [],
    csrfToken: 'csrf-xyz',
  });

  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[]}
      routes={[{ path: 'home', index: true, public: true, element: <div>home</div> }]}
      auth={{ loginPath: '/login', restoreSession }}
    >
      <SessionStatusProbe />
    </AppShellRuntime>
  );

  await waitFor(() => {
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
  });
  expect(screen.getByTestId('csrf')).toHaveTextContent('csrf-xyz');
});

test('AppShellRuntime shows neither protected content nor the unauthenticated fallback while auth.restoreSession is still pending', () => {
  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div data-testid="protected">protected</div> }]}
      auth={{
        loginPath: '/login',
        unauthenticatedFallback: <div data-testid="login-fallback">login</div>,
        // Never resolves — keeps `status` at 'booting' for the life of the test.
        restoreSession: () => new Promise(() => {}),
      }}
    />
  );

  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  expect(screen.queryByTestId('login-fallback')).not.toBeInTheDocument();
});

test('AppShellRuntime renders a custom auth.bootingFallback while status is booting', () => {
  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div data-testid="protected">protected</div> }]}
      auth={{
        loginPath: '/login',
        bootingFallback: <div data-testid="loading">Cargando...</div>,
        // Not part of this test's assertions — only present so that, against
        // the pre-implementation code (which ignores `status` and falls
        // through to the `isAuthenticated` check), AuthGate renders a finite
        // fallback instead of <Navigate to="/login">. Without it, the
        // catch-all route bounces back to `/`, which is still unauthenticated,
        // producing an infinite navigation loop that crashes the Vitest worker.
        unauthenticatedFallback: <div data-testid="login-fallback">login</div>,
        restoreSession: () => new Promise(() => {}),
      }}
    />
  );

  expect(screen.getByTestId('loading')).toBeInTheDocument();
  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
});

test('AppShellRuntime shows the protected route content once auth.restoreSession resolves successfully', async () => {
  let resolveRestore;
  const restoreSession = () => new Promise((resolve) => {
    resolveRestore = resolve;
  });

  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div data-testid="protected">protected</div> }]}
      auth={{
        loginPath: '/login',
        restoreSession,
        // Already authenticated (has a token) before the restore settles, so
        // this isolates the assertion to the `status` gate: content must stay
        // hidden while booting even though `isAuthenticated` is already true,
        // and only appear once `status` flips to 'authenticated'.
        initialSession: { token: 'existing-token' },
      }}
    />
  );

  // Flush the deferred microtask so resolveRestore is assigned before we call it.
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();

  await act(async () => {
    resolveRestore({ account: {}, environment: {}, roleList: [], csrfToken: 'csrf-abc' });
  });

  await waitFor(() => {
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });
});

test('AppShellRuntime falls through from booting to the unauthenticated fallback when auth.restoreSession resolves without a session', async () => {
  const restoreSession = async () => null; // no active session

  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div data-testid="protected">protected</div> }]}
      auth={{
        loginPath: '/login',
        restoreSession,
        // Not part of this test's assertions — only present so that, against
        // the pre-implementation code (which ignores `status` and falls
        // through to the `isAuthenticated` check), AuthGate renders a finite
        // fallback instead of <Navigate to="/login">. Without it, the
        // catch-all route bounces back to `/`, which is still unauthenticated,
        // producing an infinite navigation loop that crashes the Vitest worker.
        unauthenticatedFallback: <div data-testid="login-fallback">login</div>,
      }}
    >
      <LocationProbe />
    </AppShellRuntime>
  );

  // Still booting right after mount: no redirect has happened yet.
  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/');

  await waitFor(() => {
    expect(screen.getByTestId('login-fallback')).toBeInTheDocument();
  });
  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
});

// Same threading mechanism already proven for `auth.unauthenticatedFallback`
// (merged into `runtimeAuth` in AppShellRuntime and forwarded to every
// `AuthGate`, both the layout-level one and the per-route ones from
// `renderRoute`): configuring `auth.bootingFallback` alongside it must reach
// the route-level `AuthGate` too, and the gate must hand off from one fallback
// to the other as `status` moves from 'booting' to 'anonymous'.
test('AppShellRuntime threads auth.bootingFallback down to the route AuthGate alongside auth.unauthenticatedFallback', async () => {
  let rejectRestore;
  const restoreSession = () => new Promise((_resolve, reject) => {
    rejectRestore = reject;
  });

  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div data-testid="protected">protected</div> }]}
      auth={{
        loginPath: '/login',
        restoreSession,
        bootingFallback: <div data-testid="loading">Cargando...</div>,
        unauthenticatedFallback: <div data-testid="login-fallback">login</div>,
      }}
    />
  );

  // Flush the deferred microtask so rejectRestore is assigned before we call it.
  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByTestId('loading')).toBeInTheDocument();
  expect(screen.queryByTestId('login-fallback')).not.toBeInTheDocument();
  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();

  await act(async () => {
    rejectRestore(new Error('session expired'));
  });

  await waitFor(() => {
    expect(screen.getByTestId('login-fallback')).toBeInTheDocument();
  });
  expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
});
