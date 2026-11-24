// @covers packages/app-shell-core/src/pages/AuthorizePage.jsx
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE imports. Paths are core-relative (this test lives in
// src/pages/__tests__/, the SUT in src/pages/), so mocks resolve to the same
// absolute modules the page imports.
vi.mock('../../i18n/index.js', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

// In core, both useAuth and createApiFetch come from the auth barrel.
// AuthorizePage no longer destructures `token`/`logout` (cookie-session migration,
// ADR-0001) — the mock reflects the new useAuth() contract: username + csrfToken.
const mockRefreshToken = vi.fn(() => Promise.resolve());
vi.mock('../../auth/index.js', () => ({
  useAuth: () => ({ username: 'testuser', csrfToken: 'test-csrf-token', refreshToken: mockRefreshToken }),
  createApiFetch: vi.fn(() => vi.fn()),
}));

vi.mock('../../components/ui/card.jsx', () => ({
  Card: ({ children, ...props }) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <div {...props}>{children}</div>,
}));

vi.mock('../../components/ui/button.jsx', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock('../../components/ui/badge.jsx', () => ({
  Badge: ({ children, ...props }) => <span {...props} data-testid="badge">{children}</span>,
}));

vi.mock('@phosphor-icons/react', () => ({
  ShieldIcon: () => <span>Shield</span>,
  CheckCircleIcon: () => <span>CheckCircle2</span>,
  XCircleIcon: () => <span>XCircle</span>,
  CircleNotchIcon: () => <span>Loader2</span>,
  PlugIcon: () => <span>Plug</span>,
  DownloadSimpleIcon: () => <span>Download</span>,
  SparkleIcon: () => <span>Sparkles</span>,
  CopyIcon: () => <span>Copy</span>,
  CheckIcon: () => <span>Check</span>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}));

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservabilityProvider } from '../../observability/index.js';
import AuthorizePage from '../AuthorizePage.jsx';
import { registerErrorTranslator, resetErrorTranslatorForTests } from '../../auth/networkError.js';

// The functional test mocked the telemetry wrapper module directly. Core has no
// such module — telemetry arrives through the observability seam — so we inject a
// spy via ObservabilityProvider and assert against it wherever the original
// asserted on the telemetry mock.
const telemetrySpy = vi.fn();

function renderPage() {
  return render(
    <ObservabilityProvider value={{ trackMcpConnectTabSelected: telemetrySpy }}>
      <AuthorizePage />
    </ObservabilityProvider>,
  );
}

describe('AuthorizePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telemetrySpy.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ConnectionsLanding (no OAuth params)', () => {
    it('renders the tabbed connections landing when no OAuth params', () => {
      renderPage();
      expect(screen.getByText('oauthConnectHeading')).toBeInTheDocument();
      expect(screen.getByText('oauthConnectSubheading')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-tab-ClaudeDesktop')).toBeInTheDocument();
      expect(screen.getByTestId('mcp-tab-Cursor')).toBeInTheDocument();
    });

    it('renders MCP server URL on landing', () => {
      renderPage();
      expect(screen.getByTestId('mcp-server-url')).toBeInTheDocument();
      expect(screen.getByText('oauthMcpServerUrl')).toBeInTheDocument();
    });

    it('shows the pick-a-client placeholder with no tab selected initially', () => {
      renderPage();
      expect(screen.getByTestId('mcp-client-placeholder')).toBeInTheDocument();
      expect(screen.getByText('oauthConnectPickClient')).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.some((tab) => tab.getAttribute('aria-selected') === 'true')).toBe(false);
    });

    it('selecting a client tab shows its content and hides the placeholder', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByTestId('mcp-tab-ClaudeCode'));

      expect(screen.queryByTestId('mcp-client-placeholder')).not.toBeInTheDocument();
      expect(screen.getByText('oauthConnectClaudeCodeStep1')).toBeInTheDocument();
    });

    it('tracks telemetry with the client id when a top-level tab is selected', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByTestId('mcp-tab-Cursor'));

      expect(telemetrySpy).toHaveBeenCalledWith({ client: 'Cursor' });
    });

    it('tracks telemetry with the first sub-tab id when Claude Desktop is selected', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByTestId('mcp-tab-ClaudeDesktop'));

      expect(telemetrySpy).toHaveBeenCalledWith({
        client: 'ClaudeDesktopPersonal',
      });
    });

    it('tracks telemetry with the sub-tab id when switching between Claude Desktop sub-tabs', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByTestId('mcp-tab-ClaudeDesktop'));
      telemetrySpy.mockClear();

      await user.click(screen.getByTestId('mcp-subtab-ClaudeDesktopOrg'));

      expect(telemetrySpy).toHaveBeenCalledWith({
        client: 'ClaudeDesktopOrg',
      });
      expect(screen.getByText('oauthConnectClaudeDesktopOrgOwnerNote')).toBeInTheDocument();
    });
  });

  // Kept before the real-timer consent tests: those leave a pending 1 s redirect timer that would
  // otherwise fire into this block's fake window.location.
  describe('ETP-5386 grant refresh before the redirect', () => {
    const REDIRECT = 'https://example.com/callback?code=abc';
    let originalLocation;

    beforeEach(() => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
      });
      vi.useFakeTimers();
      originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, href: '' };
      mockRefreshToken.mockReset();
    });

    afterEach(() => {
      window.location = originalLocation;
      vi.useRealTimers();
    });

    const authorize = async (response = { ok: true, json: async () => ({ redirect_url: REDIRECT }) }) => {
      globalThis.fetch = vi.fn().mockResolvedValue(response);
      renderPage();
      await act(async () => { fireEvent.click(screen.getByTestId('oauth-authorize-submit')); });
    };
    const advance = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

    it('redirects after the 1 s success display when the refresh settles at once', async () => {
      mockRefreshToken.mockResolvedValue(undefined);
      await authorize();
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
      await advance(999);
      expect(window.location.href).toBe('');
      await advance(1);
      expect(window.location.href).toBe(REDIRECT);
    });

    it('waits for a slow refresh before redirecting', async () => {
      let resolveRefresh;
      mockRefreshToken.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));
      await authorize();
      await advance(2500);
      expect(window.location.href).toBe('');
      await act(async () => { resolveRefresh(); });
      await advance(0);
      expect(window.location.href).toBe(REDIRECT);
    });

    it('redirects at the 3 s cap when the refresh never settles', async () => {
      mockRefreshToken.mockReturnValue(new Promise(() => {}));
      await authorize();
      await advance(2999);
      expect(window.location.href).toBe('');
      await advance(1);
      expect(window.location.href).toBe(REDIRECT);
    });

    it('still redirects when the refresh rejects', async () => {
      mockRefreshToken.mockRejectedValue(new Error('refresh failed'));
      await authorize();
      await advance(1000);
      expect(window.location.href).toBe(REDIRECT);
      expect(screen.queryByText('XCircle')).not.toBeInTheDocument();
    });

    it('still redirects when the refresh throws synchronously', async () => {
      mockRefreshToken.mockImplementation(() => { throw new Error('boom'); });
      await authorize();
      await advance(1000);
      expect(window.location.href).toBe(REDIRECT);
    });

    it('does not refresh when the server rejects the authorization', async () => {
      await authorize({ ok: false, status: 400, json: async () => ({ error: 'invalid_request' }) });
      await advance(5000);
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(window.location.href).toBe('');
    });

    it('does not refresh when the response has no redirect_url', async () => {
      await authorize({ ok: true, json: async () => ({}) });
      await advance(5000);
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(window.location.href).toBe('');
    });

    it('does not refresh when the user denies', async () => {
      renderPage();
      fireEvent.click(screen.getByTestId('oauth-deny'));
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('OAuth consent view', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
        scope: 'etendo:read etendo:write',
        state: 'state123',
      });
    });

    it('renders the consent view with OAuth params', () => {
      renderPage();
      expect(screen.getByTestId('oauth-consent-view')).toBeInTheDocument();
      expect(screen.getByText('oauthAuthorizeConnection')).toBeInTheDocument();
    });

    it('displays the client ID', () => {
      renderPage();
      expect(screen.getByText('test-client')).toBeInTheDocument();
    });

    it('displays the username', () => {
      renderPage();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('renders scope badges', () => {
      renderPage();
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('renders authorize and deny buttons', () => {
      renderPage();
      expect(screen.getByTestId('oauth-authorize-submit')).toBeInTheDocument();
      expect(screen.getByTestId('oauth-deny')).toBeInTheDocument();
    });

    it('displays redirect URI info', () => {
      renderPage();
      expect(screen.getByText('https://example.com/callback')).toBeInTheDocument();
    });

    it('handles authorize click - success flow', async () => {
      const user = userEvent.setup();
      const mockRedirectUrl = 'https://example.com/callback?code=abc';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: mockRedirectUrl }),
      });

      // Prevent actual redirect
      const originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, href: '' };

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(screen.getByText('oauthAuthorizedRedirecting')).toBeInTheDocument();
      });
      // ETP-5386 — the grant state is refreshed once the link completes.
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);

      window.location = originalLocation;
    });

    it('sends credentials: include so the session cookie travels with the request', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.credentials).toBe('include');
    });

    it('sends the X-Go-CSRF header with the csrfToken from useAuth', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      const [, options] = globalThis.fetch.mock.calls[0];
      expect(options.headers['X-Go-CSRF']).toBe('test-csrf-token');
    });

    it('never sends a bearer token: no Authorization header, no "Bearer" anywhere in the request', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      const [url, options] = globalThis.fetch.mock.calls[0];
      const serialized = JSON.stringify({ url, options });
      expect(serialized).not.toMatch(/Bearer/i);
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('does not include a token key in the request body', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
      });
      globalThis.fetch = fetchMock;

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).not.toHaveProperty('token');
    });

    it('handles authorize click - error from server', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error_description: 'Server failed' }),
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(screen.getByText('Server failed')).toBeInTheDocument();
      });
    });

    it('handles authorize click - network error', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    // ETP-5424 — this page calls `fetch` directly, so a dropped connection rejects with the
    // browser's English `TypeError('Failed to fetch')`. It must show the same localized text
    // apiFetch's NetworkError carries, never the browser prose.
    describe('dropped connection (TypeError from fetch)', () => {
      afterEach(() => {
        resetErrorTranslatorForTests();
      });

      it('shows the NetworkError fallback, never "Failed to fetch", with no translator', async () => {
        const user = userEvent.setup();
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        renderPage();
        await user.click(screen.getByTestId('oauth-authorize-submit'));

        await waitFor(() => {
          expect(screen.getByText('Could not complete the action. Try again.')).toBeInTheDocument();
        });
        expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
      });

      it('shows the translated text when a translator is registered', async () => {
        const user = userEvent.setup();
        registerErrorTranslator((key) => (key === 'networkErrorRetry'
          ? 'No se pudo completar la acción. Inténtalo de nuevo.'
          : key));
        globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        renderPage();
        await user.click(screen.getByTestId('oauth-authorize-submit'));

        await waitFor(() => {
          expect(screen.getByText('No se pudo completar la acción. Inténtalo de nuevo.')).toBeInTheDocument();
        });
        expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
        expect(screen.queryByText('Could not complete the action. Try again.')).not.toBeInTheDocument();
      });
    });

    it('handles authorize click - no redirect_url in response', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(screen.getByText('No redirect URL received')).toBeInTheDocument();
      });
    });

    it('handles deny click with redirect_uri', async () => {
      const user = userEvent.setup();
      const originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, href: '' };

      renderPage();
      await user.click(screen.getByTestId('oauth-deny'));

      expect(window.location.href).toContain('error=access_denied');
      expect(window.location.href).toContain('state=state123');

      window.location = originalLocation;
    });

    // ETP-4561 — window.location is stubbed per test and always restored, even when an
    // expectation throws, so a failure cannot leak the stub into later tests.
    describe('ETP-4561 redirect URL policy', () => {
      let originalLocation;
      beforeEach(() => {
        originalLocation = window.location;
        delete window.location;
        window.location = { ...originalLocation, href: 'about:initial' };
      });
      afterEach(() => {
        window.location = originalLocation;
      });

      const withRedirectUri = (redirect_uri, extra = {}) => {
        mockSearchParams = new URLSearchParams({
          client_id: 'c',
          redirect_uri,
          code_challenge: 'x',
          response_type: 'code',
          ...extra,
        });
      };

      it('deny shows an error and does not navigate to a javascript: redirect_uri', async () => {
        const user = userEvent.setup();
        withRedirectUri('javascript:alert(document.domain)');
        renderPage();
        await user.click(screen.getByTestId('oauth-deny'));
        // A 1s redirect timer leaked by an earlier success test can still fire into this
        // stub, so assert on the hostile scheme rather than on an untouched href.
        expect(window.location.href).not.toMatch(/^\s*javascript:/i);
        expect(screen.getByText('Invalid redirect URL received')).toBeInTheDocument();
      });

      it('deny navigates to an http loopback redirect_uri (RFC 8252)', async () => {
        const user = userEvent.setup();
        withRedirectUri('http://127.0.0.1:53682/cb', { state: 's1' });
        renderPage();
        await user.click(screen.getByTestId('oauth-deny'));
        const url = new URL(window.location.href);
        expect(url.origin).toBe('http://127.0.0.1:53682');
        expect(url.pathname).toBe('/cb');
        expect(url.searchParams.get('error')).toBe('access_denied');
        expect(url.searchParams.get('state')).toBe('s1');
      });

      it('deny encodes a hostile state and keeps the fragment last', async () => {
        const user = userEvent.setup();
        withRedirectUri('https://example.com/cb?a=1#frag', { state: 'x&error=foo#y' });
        renderPage();
        await user.click(screen.getByTestId('oauth-deny'));
        const url = new URL(window.location.href);
        expect(url.searchParams.getAll('error')).toEqual(['access_denied']);
        expect(url.searchParams.get('state')).toBe('x&error=foo#y');
        expect(url.searchParams.get('a')).toBe('1');
        expect(url.hash).toBe('#frag');
      });

      it('authorize navigates to an http loopback redirect_url', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
          const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
          withRedirectUri('http://127.0.0.1:53682/cb');
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ redirect_url: 'http://127.0.0.1:53682/cb?code=abc' }),
          });
          renderPage();
          await user.click(screen.getByTestId('oauth-authorize-submit'));
          await waitFor(() => expect(screen.getByText('oauthAuthorizedRedirecting')).toBeInTheDocument());
          await vi.advanceTimersByTimeAsync(1100);
          expect(window.location.href).toBe('http://127.0.0.1:53682/cb?code=abc');
        } finally {
          vi.useRealTimers();
        }
      });

      it('authorize refuses a javascript: redirect_url returned by the server', async () => {
        const user = userEvent.setup();
        withRedirectUri('https://example.com/cb');
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ redirect_url: ' JavaScript:alert(1)' }),
        });
        renderPage();
        await user.click(screen.getByTestId('oauth-authorize-submit'));
        await waitFor(() => {
          expect(screen.getByText('Invalid redirect URL received')).toBeInTheDocument();
        });
        // A 1s redirect timer leaked by an earlier success test can still fire into this
        // stub, so assert on the hostile scheme rather than on an untouched href.
        expect(window.location.href).not.toMatch(/^\s*javascript:/i);
      });
    });

    it('handles error response where json parsing fails', async () => {
      const user = userEvent.setup();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => { throw new Error('not json'); },
      });

      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));

      await waitFor(() => {
        expect(screen.getByText('Authorization failed (400)')).toBeInTheDocument();
      });
    });

    it('uses default scope when scope param is missing', () => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
      });
      renderPage();
      // Should render with default scope 'etendo:read etendo:write' -> 2 badges
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBe(2);
    });

    it('labels every etendo:* scope on the consent screen', () => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
        scope: 'etendo:read etendo:write etendo:process etendo:report etendo:*',
      });
      renderPage();
      for (const key of ['oauthReadData', 'oauthWriteData', 'oauthRunProcesses', 'oauthGenerateReports', 'oauthFullAccess']) {
        expect(screen.getByText(key)).toBeInTheDocument();
      }
      expect(screen.queryByText(/^etendo:/)).not.toBeInTheDocument();
    });

    it('still labels legacy neo:* scopes so old clients get a readable consent screen', () => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
        scope: 'neo:read neo:write neo:process neo:report neo:*',
      });
      renderPage();
      for (const key of ['oauthReadData', 'oauthWriteData', 'oauthRunProcesses', 'oauthGenerateReports', 'oauthFullAccess']) {
        expect(screen.getByText(key)).toBeInTheDocument();
      }
      expect(screen.queryByText(/^neo:/)).not.toBeInTheDocument();
    });

    it('requests etendo:read etendo:write when the scope param is missing', async () => {
      const user = userEvent.setup();
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
      });
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
      });
      renderPage();
      await user.click(screen.getByTestId('oauth-authorize-submit'));
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.scope).toBe('etendo:read etendo:write');
    });

    it('renders unknown scope as raw text', () => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
        scope: 'custom:scope',
      });
      renderPage();
      expect(screen.getByText('custom:scope')).toBeInTheDocument();
    });
  });

  describe('embedded mode', () => {
    it('applies embedded styling when embedded=1 on landing', () => {
      mockSearchParams = new URLSearchParams({ embedded: '1' });
      const { container } = renderPage();
      const wrapper = container.firstChild;
      expect(wrapper.className).toContain('min-h-screen');
    });

    it('applies embedded styling when embedded=1 on consent', () => {
      mockSearchParams = new URLSearchParams({
        embedded: '1',
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
      });
      renderPage();
      const consentView = screen.getByTestId('oauth-consent-view');
      expect(consentView.className).toContain('min-h-screen');
    });
  });
});
