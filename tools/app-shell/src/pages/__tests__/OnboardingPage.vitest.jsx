import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const localStorageMock = (() => {
  let store = {};
  return {
    clear: vi.fn(() => {
      store = {};
    }),
    getItem: vi.fn((key) => store[key] ?? null),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

Object.defineProperty(globalThis, 'alert', {
  configurable: true,
  value: vi.fn(),
});

// Mock i18n
vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => {
    if (params) return `${key} ${JSON.stringify(params)}`;
    return key;
  },
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
  useMenuLabel: () => (key) => key,
}));

vi.mock('../../i18n/index.js', () => ({
  useUI: () => (key, params) => {
    if (params) return `${key} ${JSON.stringify(params)}`;
    return key;
  },
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
  useMenuLabel: () => (key) => key,
}));

// Mock onboarding API
vi.mock('../onboarding/onboardingApi.js', () => ({
  ONBOARDING_ERROR_CODES: {},
  fetchAccount: vi.fn(),
  fetchEnvironments: vi.fn().mockResolvedValue([]),
  loginAccount: vi.fn(),
  loginEnvironment: vi.fn(),
  registerAccount: vi.fn(),
  runOnboardingStream: vi.fn(),
}));

// Mock onboarding readiness
vi.mock('../onboarding/onboardingReadiness.js', () => ({
  checkSalesInvoiceReadiness: vi.fn().mockResolvedValue({ ready: true }),
}));

// Mock onboarding state
vi.mock('../onboarding/onboardingState.js', () => ({
  applyProgressMessage: (prev) => prev,
  buildEnvironmentSessionStorage: () => ({}),
  initialSetupSteps: () => [
    { name: 'setup', status: 'pending' },
    { name: 'client', status: 'pending' },
    { name: 'organization', status: 'pending' },
    { name: 'finalize', status: 'pending' },
  ],
  isCompanyStepValid: () => true,
  isProfileStepValid: () => true,
}));

vi.mock('../../lib/observability.js', () => ({
  track: vi.fn(),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props) => <input {...props} />,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

import OnboardingPage from '../OnboardingPage.jsx';
import {
  fetchAccount,
  fetchEnvironments,
  loginAccount,
  loginEnvironment,
  registerAccount,
  runOnboardingStream,
} from '../onboarding/onboardingApi.js';
import { track } from '../../lib/observability.js';

describe('OnboardingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    fetchAccount.mockReset();
    fetchEnvironments.mockReset();
    fetchEnvironments.mockResolvedValue([]);
    loginAccount.mockReset();
    loginEnvironment.mockReset();
    registerAccount.mockReset();
    runOnboardingStream.mockReset();
    window.history.replaceState(null, '', '/onboarding');
  });

  it('renders without crashing', () => {
    const { container } = render(<OnboardingPage />);
    expect(container).toBeTruthy();
  });

  it('shows loading spinner when view is null (initial check)', () => {
    // No platform token, so it will go to register view immediately,
    // but briefly passes through null. Since no token, it jumps to register.
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    // Should immediately show the register view since no token
    expect(screen.getByText('onboardingRegisterTitle')).toBeInTheDocument();
  });

  it('shows register view when no platform token exists', () => {
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    expect(screen.getByText('onboardingRegisterTitle')).toBeInTheDocument();
    expect(screen.getByText('onboardingRegisterSubtitle')).toBeInTheDocument();
  });

  it('renders register form fields', () => {
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    // Form has name, email, password fields
    expect(screen.getByText('onboardingNameLabel')).toBeInTheDocument();
    expect(screen.getByText('onboardingEmailLabel')).toBeInTheDocument();
    expect(screen.getByText('onboardingPasswordLabel')).toBeInTheDocument();
  });

  it('shows the create account button', () => {
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    expect(screen.getByText('onboardingCreateAccountAction')).toBeInTheDocument();
  });

  it('renders the brand name', () => {
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    expect(screen.getByText('onboardingBrandName')).toBeInTheDocument();
  });

  it('shows switch to login prompt', () => {
    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);
    expect(screen.getByText('onboardingSwitchToLoginPrompt')).toBeInTheDocument();
    expect(screen.getByText('onboardingSwitchToLoginAction')).toBeInTheDocument();
  });

  it('tracks registration submission and success without user-entered values', async () => {
    registerAccount.mockResolvedValue({
      token: 'platform-token',
      account: { name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);

    fireEvent.submit(screen.getByTestId('action-register-submit').closest('form'));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('onboarding_auth_submitted', {
        action: 'register',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'started',
        windowName: 'onboarding',
      });
      expect(track).toHaveBeenCalledWith('onboarding_auth_succeeded', {
        action: 'register',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'success',
        windowName: 'onboarding',
      });
    });

    const serializedCalls = JSON.stringify(track.mock.calls);
    expect(serializedCalls).not.toContain('Ada Lovelace');
    expect(serializedCalls).not.toContain('ada@example.com');
    expect(serializedCalls).not.toContain('platform-token');
  });

  it('tracks onboarding setup step navigation', async () => {
    localStorage.setItem('sf_platform_token', 'platform-token');
    fetchAccount.mockResolvedValue({ name: 'Ada Lovelace' });
    fetchEnvironments.mockResolvedValue([]);

    render(<OnboardingPage />);

    const continueButton = await screen.findByText('onboardingContinueAction');
    fireEvent.click(continueButton);

    expect(track).toHaveBeenCalledWith('onboarding_setup_step_completed', {
      action: 'continue',
      component: 'OnboardingPage',
      source: 'onboarding',
      status: 'success',
      type: 'profile',
      windowName: 'onboarding',
    });
  });

  it('tracks login failures without credentials', async () => {
    loginAccount.mockResolvedValue({});

    localStorage.removeItem('sf_platform_token');
    render(<OnboardingPage />);

    fireEvent.click(screen.getByTestId('action-switch-to-login'));
    fireEvent.submit(screen.getByTestId('action-login-submit').closest('form'));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('onboarding_auth_submitted', {
        action: 'login',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'started',
        windowName: 'onboarding',
      });
      expect(track).toHaveBeenCalledWith('onboarding_auth_failed', {
        action: 'login',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'failed',
        windowName: 'onboarding',
      });
    });

    expect(JSON.stringify(track.mock.calls)).not.toContain('password');
  });

  it('tracks setup back navigation from company step', async () => {
    localStorage.setItem('sf_platform_token', 'platform-token');
    fetchAccount.mockResolvedValue({ name: 'Ada Lovelace' });
    fetchEnvironments.mockResolvedValue([]);

    render(<OnboardingPage />);

    fireEvent.click(await screen.findByText('onboardingContinueAction'));
    fireEvent.click(await screen.findByText('back'));

    expect(track).toHaveBeenCalledWith('onboarding_setup_step_back', {
      action: 'back',
      component: 'OnboardingPage',
      source: 'onboarding',
      status: 'success',
      type: 'company',
      windowName: 'onboarding',
    });
  });

  it('tracks onboarding run success without company or fiscal values', async () => {
    localStorage.setItem('sf_platform_token', 'platform-token');
    fetchAccount.mockResolvedValue({ name: 'Ada Lovelace' });
    fetchEnvironments.mockResolvedValue([]);
    runOnboardingStream.mockImplementation(async (_fetch, _baseUrl, _token, _form, onMessage) => {
      onMessage({ type: 'result', success: true });
    });

    render(<OnboardingPage />);

    fireEvent.click(await screen.findByText('onboardingContinueAction'));
    fireEvent.change(screen.getByLabelText(/onboardingCompanyNameLabel/), {
      target: { value: 'Secret Company' },
    });
    fireEvent.change(screen.getByLabelText(/onboardingFiscalIdLabel/), {
      target: { value: 'B12345678' },
    });
    fireEvent.click(screen.getByText('onboardingStartAction'));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('onboarding_run_started', {
        action: 'create_environment',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'started',
        windowName: 'onboarding',
      });
      expect(track).toHaveBeenCalledWith('onboarding_run_succeeded', {
        action: 'create_environment',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'success',
        windowName: 'onboarding',
      });
    });

    const serializedCalls = JSON.stringify(track.mock.calls);
    expect(serializedCalls).not.toContain('Secret Company');
    expect(serializedCalls).not.toContain('B12345678');
  });

  it('tracks onboarding run failures', async () => {
    localStorage.setItem('sf_platform_token', 'platform-token');
    fetchAccount.mockResolvedValue({ name: 'Ada Lovelace' });
    fetchEnvironments.mockResolvedValue([]);
    runOnboardingStream.mockImplementation(async (_fetch, _baseUrl, _token, _form, onMessage) => {
      onMessage({ type: 'result', success: false, message: 'failed' });
    });

    render(<OnboardingPage />);

    fireEvent.click(await screen.findByText('onboardingContinueAction'));
    fireEvent.click(screen.getByText('onboardingStartAction'));

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('onboarding_run_failed', {
        action: 'create_environment',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'failed',
        windowName: 'onboarding',
      });
    });
  });

  it('tracks environment entry success without environment identifiers', async () => {
    localStorage.setItem('sf_platform_token', 'platform-token');
    fetchAccount.mockResolvedValue({ name: 'Ada Lovelace' });
    fetchEnvironments.mockResolvedValue([
      { clientId: 'client-secret', clientName: 'Secret Client', orgName: 'Org', adminUser: 'admin' },
    ]);
    loginEnvironment.mockResolvedValue({ token: 'environment-token' });

    render(<OnboardingPage />);

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith('onboarding_environment_enter_submitted', {
        action: 'enter_environment',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'started',
        windowName: 'onboarding',
      });
      expect(track).toHaveBeenCalledWith('onboarding_environment_enter_succeeded', {
        action: 'enter_environment',
        component: 'OnboardingPage',
        source: 'onboarding',
        status: 'success',
        windowName: 'onboarding',
      });
    });

    const serializedCalls = JSON.stringify(track.mock.calls);
    expect(serializedCalls).not.toContain('client-secret');
    expect(serializedCalls).not.toContain('Secret Client');
    expect(serializedCalls).not.toContain('environment-token');
  });
});
