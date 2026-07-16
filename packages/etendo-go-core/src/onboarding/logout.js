import { trackOnboarding } from './tracking.js';
import { ENVIRONMENT_SESSION_KEYS } from './state.js';

// Platform-level session keys owned by the onboarding auth layer. Combined
// with ENVIRONMENT_SESSION_KEYS (the Etendo environment session written by
// buildEnvironmentSessionStorage) this is the full set cleared on sign-out.
const PLATFORM_SESSION_KEYS = ['sf_platform_token', 'sf_platform_auth_method'];

const LOGOUT_SESSION_KEYS = [...PLATFORM_SESSION_KEYS, ...ENVIRONMENT_SESSION_KEYS];

// Builds the onboarding sign-out handler shared by every onboarding screen.
//
// It clears the full session (platform tokens plus the Etendo environment
// session keys written by buildEnvironmentSessionStorage), resets the flow
// state, tracks the logout event, and returns the user to the login step.
// Centralizing it keeps every screen's exit path identical and avoids the
// per-step duplication of this token-clearing logic.
//
// Storage clearing is fail-safe: if localStorage is unavailable (SSR) or
// removeItem throws (e.g. private mode), the session-state reset and the
// redirect to the login step still run, so the user always lands on login.
export function createOnboardingLogout({ config, setToken, setAccountName, goToStep }) {
  return () => {
    trackOnboarding(config, 'onboarding_auth_logout', {
      action: 'logout',
      status: 'success',
    });
    clearSessionStorage();
    if (setToken) setToken(null);
    if (setAccountName) setAccountName(null);
    if (goToStep) goToStep('login');
  };
}

function clearSessionStorage() {
  if (typeof localStorage === 'undefined' || !localStorage) return;
  try {
    for (const key of LOGOUT_SESSION_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable or throw (SSR / private mode). Swallow the
    // error so the session-state reset and login redirect still run.
  }
}

export default createOnboardingLogout;
