import { render, screen } from '@testing-library/react';

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
import { fetchAccount } from '../onboarding/onboardingApi.js';

describe('OnboardingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});