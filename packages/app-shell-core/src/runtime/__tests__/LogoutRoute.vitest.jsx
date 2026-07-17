import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogoutRoute } from '../../index.js';

const SAFE_DESTINATION = '/onboarding';

function DestinationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="destination">{`${navigationType}:${location.pathname}${location.search}`}</output>;
}

function renderLogoutRoute({ entry = '/logout', cleanup, safeDestination = SAFE_DESTINATION } = {}) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/logout"
          element={<LogoutRoute cleanup={cleanup} safeDestination={safeDestination} />}
        />
        <Route path="*" element={<DestinationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function expectDestination(destination = SAFE_DESTINATION) {
  await waitFor(() => {
    expect(screen.getByTestId('destination')).toHaveTextContent(`REPLACE:${destination}`);
  });
}

afterEach(() => {
  window.localStorage.clear();
});

describe('LogoutRoute', () => {
  it('cleans up safely without an active session and replaces the history entry', async () => {
    const cleanup = vi.fn();

    renderLogoutRoute({ cleanup });

    await expectDestination();
    expect(cleanup).toHaveBeenCalledTimes(1);
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

  it('uses the local auth storage cleanup authority for a platform-only session', async () => {
    window.localStorage.setItem('sf_platform_token', 'platform-token');
    window.localStorage.setItem('sf_platform_auth_method', 'password');

    renderLogoutRoute();

    await expectDestination();
    expect(window.localStorage.getItem('sf_platform_token')).toBeNull();
    expect(window.localStorage.getItem('sf_platform_auth_method')).toBeNull();
  });

  it('uses the local auth storage cleanup authority for a full environment session', async () => {
    window.localStorage.setItem('sf_auth_token', 'environment-token');
    window.localStorage.setItem('sf_auth_user', 'Ada');
    window.localStorage.setItem('sf_auth_rolelist', JSON.stringify([{ id: 'admin' }]));
    window.localStorage.setItem('sf_auth_selected_role', JSON.stringify({ id: 'admin' }));
    window.localStorage.setItem('sf_auth_selected_org', JSON.stringify({ id: 'org' }));
    window.localStorage.setItem('sf_platform_token', 'platform-token');
    window.localStorage.setItem('sf_platform_auth_method', 'password');

    renderLogoutRoute();

    await expectDestination();
    expect(window.localStorage.getItem('sf_auth_token')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_user')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_rolelist')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_selected_role')).toBeNull();
    expect(window.localStorage.getItem('sf_auth_selected_org')).toBeNull();
    expect(window.localStorage.getItem('sf_platform_token')).toBeNull();
    expect(window.localStorage.getItem('sf_platform_auth_method')).toBeNull();
  });

  it('does not repeat cleanup when its effect is re-rendered', async () => {
    const cleanup = vi.fn();
    const { rerender } = render(
      <MemoryRouter initialEntries={['/logout']}>
        <Routes>
          <Route path="/logout" element={<LogoutRoute cleanup={cleanup} safeDestination={SAFE_DESTINATION} />} />
          <Route path="*" element={<DestinationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await expectDestination();
    rerender(
      <MemoryRouter initialEntries={['/logout']}>
        <Routes>
          <Route path="/logout" element={<LogoutRoute cleanup={cleanup} safeDestination={SAFE_DESTINATION} />} />
          <Route path="*" element={<DestinationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
