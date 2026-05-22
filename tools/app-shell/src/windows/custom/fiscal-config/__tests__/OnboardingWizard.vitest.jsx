import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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
  useApiFetch: () => vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
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

describe('OnboardingWizard — territory selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enables continue after selecting a territory', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });

  it('renders all territory groups including gipuzkoa, baleares, canarias, ceuta', () => {
    renderWizard();
    expect(screen.getByText('fiscal.territory.gipuzkoa')).toBeInTheDocument();
    expect(screen.getByText('fiscal.territory.canarias')).toBeInTheDocument();
    expect(screen.getByText('fiscal.territory.ceuta')).toBeInTheDocument();
  });

  it('navigates directly to ConfirmScreen for navarra (no sub-questions)', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    expect(screen.getByText('fiscal.onboarding.confirm.title')).toBeInTheDocument();
  });

  it('navigates to SubquestionScreen for alava (askNational=true)', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.alava'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    expect(screen.getByText('fiscal.onboarding.subq.also.title')).toBeInTheDocument();
  });

  it('navigates to SubquestionScreen for baleares (askVolume=true)', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.espania'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    expect(screen.getByText('fiscal.onboarding.subq.volume.title')).toBeInTheDocument();
  });
});

describe('OnboardingWizard — SkippedScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows go-home button in skipped screen', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.onboarding.skip'));
    expect(screen.getByText('fiscal.onboarding.goHome')).toBeInTheDocument();
  });

  it('navigates back to territory from skipped screen', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.onboarding.skip'));
    fireEvent.click(screen.getByText('fiscal.onboarding.back.wizard'));
    expect(screen.getByText('fiscal.onboarding.territory.title')).toBeInTheDocument();
  });
});

describe('OnboardingWizard — SubquestionScreen (national)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function navigateToSubquestion() {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.alava'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
  }

  it('shows national-tax question for tbai territories', () => {
    navigateToSubquestion();
    expect(screen.getByText('fiscal.onboarding.subq.also.title')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.tbai.label')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.sii.label')).toBeInTheDocument();
  });

  it('continue is disabled before answering the national question', () => {
    navigateToSubquestion();
    expect(screen.getByText('fiscal.onboarding.continue')).toBeDisabled();
  });

  it('continue is enabled after selecting only-tbai option', () => {
    navigateToSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.tbai.label'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });

  it('continue is enabled after selecting also-sii option', () => {
    navigateToSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.sii.label'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });

  it('navigates to ConfirmScreen after answering the national question', () => {
    navigateToSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.tbai.label'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    expect(screen.getByText('fiscal.onboarding.confirm.title')).toBeInTheDocument();
  });

  it('navigates back to territory from SubquestionScreen', () => {
    navigateToSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.territory.title')).toBeInTheDocument();
  });
});

describe('OnboardingWizard — SubquestionScreen (volume)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function navigateToVolumeSubquestion() {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.espania'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
  }

  it('shows volume question for siiver territories', () => {
    navigateToVolumeSubquestion();
    expect(screen.getByText('fiscal.onboarding.subq.volume.title')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.volume.low.label')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.volume.high.label')).toBeInTheDocument();
  });

  it('continue is enabled after selecting high volume', () => {
    navigateToVolumeSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.volume.high.label'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });

  it('continue stays disabled after selecting low volume without choosing system', () => {
    navigateToVolumeSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.volume.low.label'));
    expect(screen.getByText('fiscal.onboarding.continue')).toBeDisabled();
  });

  it('shows system choice when volume is low', () => {
    navigateToVolumeSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.volume.low.label'));
    expect(screen.getByText('fiscal.onboarding.subq.system.title')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.verifactu.label')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.subq.sii.vol.label')).toBeInTheDocument();
  });

  it('continue is enabled after choosing system for low volume', () => {
    navigateToVolumeSubquestion();
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.volume.low.label'));
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.verifactu.label'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });
});

describe('OnboardingWizard — ConfirmScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function navigateToConfirm() {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
  }

  it('shows confirmation title and subtitle', () => {
    navigateToConfirm();
    expect(screen.getByText('fiscal.onboarding.confirm.title')).toBeInTheDocument();
    expect(screen.getByText('fiscal.onboarding.confirm.subtitle')).toBeInTheDocument();
  });

  it('shows confirm button', () => {
    navigateToConfirm();
    expect(screen.getByText('fiscal.onboarding.confirm.btn')).toBeInTheDocument();
  });

  it('shows territory row in summary', () => {
    navigateToConfirm();
    expect(screen.getByText('fiscal.onboarding.confirm.row.territory')).toBeInTheDocument();
  });

  it('back button returns to territory for navarra (no sub-questions)', () => {
    navigateToConfirm();
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.territory.title')).toBeInTheDocument();
  });

  it('back button returns to subquestion for alava (went through sub-questions)', () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.alava'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    fireEvent.click(screen.getByText('fiscal.onboarding.subq.tbai.label'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.subq.also.title')).toBeInTheDocument();
  });
});

describe('OnboardingWizard — createRecords flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('navigates to DetailScreen after confirming', async () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    fireEvent.click(screen.getByText('fiscal.onboarding.confirm.btn'));
    await waitFor(() => {
      expect(screen.getByText('fiscal.onboarding.detail.saveapply')).toBeInTheDocument();
    });
  });

  it('back button in DetailScreen returns to ConfirmScreen', async () => {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    fireEvent.click(screen.getByText('fiscal.onboarding.confirm.btn'));
    await waitFor(() => {
      expect(screen.getByText('fiscal.onboarding.detail.saveapply')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.confirm.title')).toBeInTheDocument();
  });
});

describe('OnboardingWizard — ManualScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function navigateToManual() {
    renderWizard();
    fireEvent.click(screen.getByText('fiscal.onboarding.territory.prefer.manual.link'));
  }

  it('shows territory cards in manual screen', () => {
    navigateToManual();
    expect(screen.getByText('fiscal.territory.navarra')).toBeInTheDocument();
    expect(screen.getByText('fiscal.territory.alava')).toBeInTheDocument();
  });

  it('shows system placeholder when no territory selected', () => {
    navigateToManual();
    expect(screen.getByText('fiscal.onboarding.manual.system.placeholder')).toBeInTheDocument();
  });

  it('continue is disabled when no territory or system selected', () => {
    navigateToManual();
    expect(screen.getByText('fiscal.onboarding.continue')).toBeDisabled();
  });

  it('shows system options after selecting a territory', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    expect(screen.getByText('SII')).toBeInTheDocument();
    expect(screen.getByText('TBAI')).toBeInTheDocument();
  });

  it('continue is disabled after selecting territory but not system', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    expect(screen.getByText('fiscal.onboarding.continue')).toBeDisabled();
  });

  it('continue is enabled after selecting both territory and system', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('SII'));
    expect(screen.getByText('fiscal.onboarding.continue')).not.toBeDisabled();
  });

  it('navigates to ConfirmScreen after selecting territory and system', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('SII'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    expect(screen.getByText('fiscal.onboarding.confirm.title')).toBeInTheDocument();
  });

  it('navigates back to territory from manual screen', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.territory.title')).toBeInTheDocument();
  });

  it('changing territory in manual screen resets system selection', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('SII'));
    fireEvent.click(screen.getByText('fiscal.territory.alava'));
    expect(screen.getByText('fiscal.onboarding.continue')).toBeDisabled();
  });

  it('ConfirmScreen back button returns to manual when manualSystem is set', () => {
    navigateToManual();
    fireEvent.click(screen.getByText('fiscal.territory.navarra'));
    fireEvent.click(screen.getByText('SII'));
    fireEvent.click(screen.getByText('fiscal.onboarding.continue'));
    fireEvent.click(screen.getByText('fiscal.onboarding.back'));
    expect(screen.getByText('fiscal.onboarding.manual.title')).toBeInTheDocument();
  });
});
