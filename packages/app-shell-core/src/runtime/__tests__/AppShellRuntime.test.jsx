import { test, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { AppShellRuntime } from '../AppShellRuntime.jsx';
import { useAuth, createMemoryAuthStorage } from '../../auth/index.js';
import { sessionFixture, jsonResponse } from '../../auth/__tests__/refreshFixtures.js';

// Core vitest runs without `globals: true` (see vitest.config.js) — do
// explicit cleanup so mounted providers don't bleed between tests.
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

test('AppShellRuntime uses a custom layout component after session bootstrap', async () => {
  function CustomLayout({ menuGroups }) {
    return <div data-testid="custom-layout">{menuGroups.length} groups</div>;
  }

  const session = sessionFixture();
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ token: session.token })));
  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div>home</div> }]}
      auth={{ loginPath: '/login', storage: createMemoryAuthStorage(session) }}
      layout={CustomLayout}
    />
  );

  expect(await screen.findByTestId('custom-layout')).toHaveTextContent('1 groups');
});

test('AppShellRuntime falls back to ShellLayout after session bootstrap when no layout override is given', async () => {
  const session = sessionFixture();
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ token: session.token })));
  render(
    <AppShellRuntime
      basename="/"
      menuGroups={[{ id: 'g1', title: 'Group 1', items: [] }]}
      routes={[{ path: 'home', index: true, public: false, element: <div>home</div> }]}
      auth={{ loginPath: '/login', storage: createMemoryAuthStorage(session) }}
    />
  );

  expect(await screen.findByText('Group 1')).toBeInTheDocument();
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
      auth={{ loginPath: '/login', fetchWindowAccess }}
    >
      <RoleSelectorProbe />
    </AppShellRuntime>
  );

  await act(async () => {
    screen.getByTestId('select-role').click();
  });

  expect(await screen.findByTestId('window-access')).toHaveTextContent('{"147":"full"}');
});
