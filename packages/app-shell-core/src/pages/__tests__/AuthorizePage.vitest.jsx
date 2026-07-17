import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE imports. Paths are core-relative (this test lives in
// src/pages/__tests__/, the SUT in src/pages/), so mocks resolve to the same
// absolute modules the page imports.
vi.mock('../../i18n/index.js', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

// In core, both useAuth and createApiFetch come from the auth barrel.
vi.mock('../../auth/index.js', () => ({
  useAuth: () => ({ token: 'test-token', username: 'testuser', logout: vi.fn() }),
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

// Select is a Radix compound component — not interactable as a native <select>
// in jsdom (see src/components/ui/__tests__/select.test.js). Stub it with a
// closure-based mock: SelectItem clicks call the onValueChange captured from
// the enclosing Select, so tests can drive the validity selector by clicking
// the option's data-testid without opening a real Radix popper.
let selectOnValueChange;
vi.mock('../../components/ui/select.jsx', () => ({
  Select: ({ value, onValueChange, children }) => {
    selectOnValueChange = onValueChange;
    return <div data-value={value}>{children}</div>;
  },
  SelectTrigger: ({ children, ...props }) => <div {...props}>{children}</div>,
  SelectValue: (props) => <span {...props} />,
  SelectContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  SelectItem: ({ value, children, ...props }) => (
    <div {...props} role="option" onClick={() => selectOnValueChange(value)}>
      {children}
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Shield: () => <span>Shield</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  XCircle: () => <span>XCircle</span>,
  Loader2: () => <span>Loader2</span>,
  Plug: () => <span>Plug</span>,
  Download: () => <span>Download</span>,
  Sparkles: () => <span>Sparkles</span>,
  Copy: () => <span>Copy</span>,
  Check: () => <span>Check</span>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservabilityProvider } from '../../observability/index.js';
import AuthorizePage from '../AuthorizePage.jsx';

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

  describe('OAuth consent view', () => {
    beforeEach(() => {
      mockSearchParams = new URLSearchParams({
        client_id: 'test-client',
        redirect_uri: 'https://example.com/callback',
        code_challenge: 'challenge123',
        response_type: 'code',
        scope: 'neo:read neo:write',
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

      window.location = originalLocation;
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
      // Should render with default scope 'neo:read neo:write' -> 2 badges
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBe(2);
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

    // ETP-4393 — user-selectable OAuth2 token validity period.
    describe('token validity selector', () => {
      it('renders the validity selector defaulting to 1 day', () => {
        renderPage();
        const select = screen.getByTestId('oauth-validity-select');
        expect(select).toBeInTheDocument();
        expect(screen.getByText('oauthValidity1Day')).toBeInTheDocument();
      });

      it('sends validity_seconds: 86400 in the POST body by default', async () => {
        const user = userEvent.setup();
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
        });

        renderPage();
        await user.click(screen.getByTestId('oauth-authorize-submit'));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        const [, options] = globalThis.fetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.validity_seconds).toBe(86400);
      });

      it('sends the chosen validity_seconds after changing the select', async () => {
        const user = userEvent.setup();
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ redirect_url: 'https://example.com/callback?code=abc' }),
        });

        renderPage();
        await user.click(screen.getByTestId('oauth-validity-option-0'));
        await user.click(screen.getByTestId('oauth-authorize-submit'));

        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        const [, options] = globalThis.fetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.validity_seconds).toBe(0);
      });

      it('shows a finite expiry date for the default 1-day validity', () => {
        renderPage();
        const expiry = screen.getByTestId('oauth-validity-expiry');
        expect(expiry).toHaveTextContent('oauthTokenExpiresLabel');
        expect(expiry).not.toHaveTextContent('oauthValidityNever');
      });

      it('shows "no expiration" text when No expiration is selected', async () => {
        const user = userEvent.setup();
        renderPage();
        await user.click(screen.getByTestId('oauth-validity-option-0'));

        const expiry = screen.getByTestId('oauth-validity-expiry');
        expect(expiry).toHaveTextContent('oauthValidityNever');
      });
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
