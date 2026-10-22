// @covers tools/etendo-go-ar/app-shell/src/App.jsx
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4576 cycle 4a — the `tools/etendo-go-ar/app-shell` host.
 *
 * This host mounts <AuthProvider> with no props of its own and relies on the provider's default
 * cookie restore: for the duration of GET /sws/go/session the status is 'booting' while
 * `isAuthenticated` is still false. A guard that only looked at `isAuthenticated` would redirect on
 * EVERY reload, before the restore had a chance to answer, so the guard must hold while booting.
 *
 * That host has no test runner of its own (its dev deps are vite/tailwind, and its file's own
 * comment argues against standing one up for a ~60-line scaffold). Its `<App>` is therefore
 * rendered from this package's runner, with the host's page and the platform providers stubbed:
 * the subject is the guard's branching on `useAuth()`, driven by a controllable auth status.
 */

const host = vi.hoisted(() => ({
  auth: { status: 'booting', isAuthenticated: false },
  providerProps: [],
}));

vi.mock('@etendosoftware/app-shell-core/auth', async (importOriginal) => {
  const actual = await importOriginal();
  const { default: React } = await import('react');
  return {
    // CREDENTIAL_MODES stays the platform's own constant: what is asserted below is that the host
    // opts into `cookie`, not that a particular string was written in the file.
    ...actual,
    AuthProvider: (props) => {
      host.providerProps.push(props);
      return React.createElement(React.Fragment, null, props.children);
    },
    useAuth: () => host.auth,
  };
});

vi.mock('@etendosoftware/app-shell-core/i18n', async (importOriginal) => {
  const actual = await importOriginal();
  const { default: React } = await import('react');
  return {
    ...actual,
    LocaleProvider: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('../../../../../tools/etendo-go-ar/app-shell/src/pages/OnboardingPage.jsx', async () => {
  const { default: React } = await import('react');
  return { default: () => React.createElement('div', { 'data-testid': 'host-onboarding-page' }) };
});

const App = (await import('../../../../../tools/etendo-go-ar/app-shell/src/App.jsx')).default;
const { CREDENTIAL_MODES } = await import('@etendosoftware/app-shell-core/auth');

function setUrl(path) {
  window.history.replaceState({}, '', path);
}

beforeEach(() => {
  host.providerProps.length = 0;
  host.auth.status = 'booting';
  host.auth.isAuthenticated = false;
  setUrl('/dashboard');
});

afterEach(cleanup);

describe('etendo-go-ar AuthGuard handles the restore boot window (ETP-4576)', () => {
  it('holds with nothing rendered while the restore is booting, even though isAuthenticated is false', () => {
    render(<App />);

    // A guard that only read `isAuthenticated` would have redirected right here.
    expect(screen.queryByTestId('host-onboarding-page')).toBeNull();
    expect(screen.queryByText(/Has ingresado al sistema/)).toBeNull();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('redirects to the onboarding return-to URL, replacing the entry, once the restore says anonymous', async () => {
    const { rerender } = render(<App />);
    expect(screen.queryByTestId('host-onboarding-page')).toBeNull();
    const historyLengthBefore = window.history.length;

    host.auth.status = 'anonymous';

    rerender(<App />);

    expect(await screen.findByTestId('host-onboarding-page')).toBeTruthy();
    expect(window.location.pathname).toBe('/onboarding');
    // The page the visitor came for travels along, so onboarding can hand them back to it.
    expect(window.location.search).toBe('?returnTo=%2Fdashboard');
    // `replace`, so the guarded page is not left in the history behind the redirect.
    expect(window.history.length).toBe(historyLengthBefore);
  });

  it('renders the app once the restore says authenticated', async () => {
    const { rerender } = render(<App />);

    host.auth.status = 'authenticated';
    host.auth.isAuthenticated = true;

    rerender(<App />);

    expect(await screen.findByText(/Has ingresado al sistema/)).toBeTruthy();
    expect(screen.queryByTestId('host-onboarding-page')).toBeNull();
  });

  it('selects the cookie scheme from the platform, and passes no restoreSession prop', () => {
    render(<App />);

    expect(host.providerProps).toHaveLength(1);
    const [providerProps] = host.providerProps;
    // The prop IS the restore: selecting `cookie` is what makes the provider fetch the session on
    // mount, which is what the booting window above depends on.
    expect(providerProps.credentialMode).toBe(CREDENTIAL_MODES.cookie);
    // Every host wiring its own fetcher is the duplication moving it into app-shell-core removed.
    expect(providerProps.restoreSession).toBeUndefined();
  });
});
