import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/auth/useApiFetch.js', () => ({
  useApiFetch: () => vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) })),
}));

vi.mock('@/auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    selectedOrg: { id: 'org-1', name: 'Test Organization' },
    selectedRole: { orgList: [{ id: 'org-1', name: 'Test Organization' }] },
    selectOrg: vi.fn(),
  }),
}));

vi.mock('@/components/related-documents/helpers.js', () => ({
  fetchById: vi.fn(() => Promise.resolve(null)),
  neoBase: (url) => url?.replace(/\/[^/]+$/, '') ?? '',
}));

vi.mock('../fiscalConfig.utils.js', () => ({
  buildOnboardingPayloads: () => ({}),
  getFiscalRecordId: () => null,
  getAllowedSystemsForTerritory: () => ['SII', 'TBAI', 'VERIFACTU'],
  getCertificateContext: () => null,
  resolveSystem: () => null,
}));

vi.mock('../SiiSection.jsx', () => ({ default: () => <div data-testid="sii-section" /> }));
vi.mock('../TbaiSection.jsx', () => ({ default: () => <div data-testid="tbai-section" /> }));
vi.mock('../VerifactuSection.jsx', () => ({ default: () => <div data-testid="verifactu-section" /> }));
vi.mock('../CertModal.jsx', () => ({ default: () => <div data-testid="cert-modal" /> }));
vi.mock('../CertSection.jsx', () => ({ default: () => <div data-testid="cert-section" /> }));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Import under test ----------------------------------------------------

import OnboardingWizard from '../OnboardingWizard.jsx';

// --- Helpers --------------------------------------------------------------

function renderWizard(overrides = {}) {
  const defaults = {
    apiBaseUrl: '/api/fiscal-config',
    onComplete: vi.fn(),
    onGoHome: vi.fn(),
  };
  return { ...render(<OnboardingWizard {...defaults} {...overrides} />), props: { ...defaults, ...overrides } };
}

// --- Tests ----------------------------------------------------------------

describe('OnboardingWizard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    renderWizard();
    // The territory step title
    expect(screen.getByText('fiscal.onboarding.territory.title')).toBeInTheDocument();
  });

  it('shows organization name', () => {
    renderWizard();
    expect(screen.getByText('Test Organization')).toBeInTheDocument();
  });

  it('renders stepper with step 1 active', () => {
    renderWizard();
    // Step labels
    expect(screen.getByText('fiscal.onboarding.step.territory')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.step.details')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.step.confirm')).toBeInTheDocument();
  });

  it('renders territory cards', () => {
    renderWizard();
    // Territory names come from ui() calls
    expect(screen.getByText('fiscal.territory.navarra')).toBeInTheDocument();
    expect(screen.getByText('fiscal.territory.alava')).toBeInTheDocument();
    expect(screen.getByText('fiscal.territory.bizkaia')).toBeInTheDocument();
  });

  it('shows continue button that is initially disabled', () => {
    renderWizard();
    const continueBtn = screen.getByText('fiscal.onboarding.continue');
    expect(continueBtn).toBeDisabled();
  });

  it('shows skip option', () => {
    renderWizard();
    expect(screen.getByText('fiscal.onboarding.skip')).toBeInTheDocument();
  });

  it('navigates to skipped state when skip is clicked', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.onboarding.skip'));
    expect(screen.getByText('fiscal.onboarding.skipped.title')).toBeInTheDocument();
  });

  it('shows manual config link in header', () => {
    renderWizard();
    expect(screen.getByText('fiscal.onboarding.territory.prefer.manual.link')).toBeInTheDocument();
  });

  it('navigates to manual step when manual config link is clicked', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.onboarding.territory.prefer.manual.link'));
    expect(screen.getByText('fiscal.onboarding.manual.title')).toBeInTheDocument();
  });
});
