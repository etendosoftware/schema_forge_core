export { OnboardingFlow } from './OnboardingFlow.jsx';
export { coreSteps } from './steps/index.js';
export { buildOnboardingReturnTo, getSafeReturnTo, buildAppReturnToHref } from './oauthReturnTo.js';

export {
  ONBOARDING_ERROR_CODES,
  buildAuthHeaders,
  registerAccount,
  loginAccount,
  loginWithSsoProvider,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  fetchAccount,
  fetchEnvironments,
  loginEnvironment,
  fetchOnboardingDraft,
  saveOnboardingDraft,
  runOnboardingStream,
} from './api.js';

export {
  getConfiguredSsoProviders,
  readCookie,
  buildGoogleSsoPayload,
  loadGoogleIdentityScript,
  renderSsoProviderButton,
} from './sso.js';

export {
  SETUP_STEP_DEFINITIONS,
  initialSetupSteps,
  mapBackendStepStatus,
  applyProgressMessage,
  buildOnboardingPayload,
  selectPreferredOrg,
  isProfileStepValid,
  isCompanyStepValid,
} from './state.js';

export {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RULES,
  getPasswordChecks,
  isStrongPassword,
} from './passwordPolicy.js';

export {
  ONBOARDING_FIELD_LIMITS,
  ACCOUNT_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  FISCAL_ID_MAX_LENGTH,
  ADDRESS_MAX_LENGTH,
  FREELANCER_FULL_NAME_MAX_LENGTH,
  fullNameLimitFor,
  exceedsLimit,
} from './fieldLimits.js';

export {
  ONBOARDING_ERROR_CODE_LABELS,
  AD_MESSAGE_KEY_LABELS,
  isAdMessageKey,
  resolveOnboardingErrorMessage,
} from './errorMessages.js';
