// @covers packages/app-shell-core/src/pages/AuthorizePage.jsx
// ETP-5386 — real AuthProvider + real AuthorizePage + a sibling WindowAccessGuard: completing the
// OAuth link must reload the grant maps so the guard stops showing "no access" without a reload.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../auth/AuthContext.jsx';
import { createMemoryAuthStorage } from '../../auth/session.js';
import { resetApiSessionForTests } from '../../auth/api.js';
import { WindowAccessGuard } from '../../auth/WindowAccessGuard.jsx';
import { ObservabilityProvider } from '../../observability/index.js';
import { jsonResponse, metadataResponse, refreshResponse, sessionFixture } from '../../auth/__tests__/refreshFixtures.js';
import AuthorizePage from '../AuthorizePage.jsx';

vi.mock('../../i18n/index.js', () => ({ useUI: () => (key) => key, useMenuLabel: () => (key) => key }));
vi.mock('../../i18n/useUI.js', () => ({ useUI: () => (key) => key }));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams({
    client_id: 'test-client',
    redirect_uri: 'https://example.com/callback',
    code_challenge: 'challenge123',
    response_type: 'code',
  })],
}));

const REDIRECT = 'https://example.com/callback?code=abc';
let originalLocation;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  originalLocation = window.location;
  delete window.location;
  window.location = { ...originalLocation, href: '' };
});
afterEach(() => {
  window.location = originalLocation;
  cleanup();
  resetApiSessionForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AuthorizePage grant refresh (real AuthProvider)', () => {
  it('replaces the stale grant maps once the link completes, then still redirects', async () => {
    const session = sessionFixture();
    // Before the link the access map is empty (grants not available yet); after it, granted.
    const access = vi.fn().mockResolvedValueOnce({ windowAccess: {} })
      .mockResolvedValue({ windowAccess: { fixtureWindow: 'full' } });
    vi.stubGlobal('fetch', vi.fn((path) => {
      if (String(path).endsWith('/refreshtoken')) return Promise.resolve(refreshResponse(metadataResponse(session)));
      if (String(path).endsWith('/oauth2/authorize')) return Promise.resolve(jsonResponse({ redirect_url: REDIRECT }));
      return Promise.resolve(jsonResponse({}));
    }));

    render(
      <AuthProvider storage={createMemoryAuthStorage(session)} restoreSession={null} fetchWindowAccess={access} apiBaseUrl="/server">
        <ObservabilityProvider value={{ trackMcpConnectTabSelected: vi.fn() }}>
          <WindowAccessGuard windowId="fixtureWindow"><span data-testid="granted" /></WindowAccessGuard>
          <AuthorizePage />
        </ObservabilityProvider>
      </AuthProvider>,
    );

    await screen.findByTestId('window-access-denied');
    await waitFor(() => expect(access).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('granted')).toBeNull();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => { fireEvent.click(screen.getByTestId('oauth-authorize-submit')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    await waitFor(() => expect(screen.getByTestId('granted')).toBeInTheDocument());
    expect(screen.queryByTestId('window-access-denied')).toBeNull();
    expect(access.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(window.location.href).toBe(REDIRECT);
  });
});
