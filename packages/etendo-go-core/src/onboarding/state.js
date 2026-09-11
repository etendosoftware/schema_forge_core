import { ONBOARDING_FIELD_LIMITS, fullNameLimitFor, exceedsLimit } from './fieldLimits.js';
import { replaceAmbientSession } from '@etendosoftware/app-shell-core/auth/api';

export const SETUP_STEP_DEFINITIONS = [
  { name: 'setup', estimate: '1s' },
  { name: 'client', estimate: '2 min' },
  { name: 'organization', estimate: '1 min' },
  { name: 'dataset', estimate: '1 min' },
  { name: 'sequences', estimate: '1s' },
  { name: 'finalize', estimate: '1s' },
];

export function initialSetupSteps() {
  return SETUP_STEP_DEFINITIONS.map(step => ({
    ...step,
    status: 'pending',
    ms: null,
    error: null,
  }));
}

export function mapBackendStepStatus(status) {
  if (status === 'in_progress') return 'running';
  if (status === 'done') return 'done';
  if (status === 'error') return 'failed';
  return status;
}

export function applyProgressMessage(steps, message) {
  if (message?.type !== 'progress' || !message.step) return steps;
  return steps.map(step => step.name === message.step
    ? {
      ...step,
      status: mapBackendStepStatus(message.status),
      ms: message.ms || null,
      error: message.status === 'error' ? message.message : null,
    }
    : step);
}

export function buildOnboardingPayload(form) {
  return {
    clientName: form.clientName,
    currency: form.currency,
    language: form.language,
    countryCode: form.countryCode,
    address: form.address,
    // Optional Tax ID from the Company step — sent to provisioning when provided
    // (ETP-4749; previously dropped here, matching the old api.js/SetupProgressStep.jsx
    // behavior that this same fix reverses).
    fiscalIdValue: form.fiscalIdValue,
  };
}

export function selectPreferredOrg(role) {
  return role?.orgList?.find(org => org.name !== '*') || role?.orgList?.[0] || null;
}

// ETP-4576 — ENVIRONMENT_SESSION_KEYS, buildEnvironmentSessionStorage and
// clearEnvironmentSession lived here. Those seven keys were never state: they
// were a handoff channel between two page loads, written just before the
// full-page redirect so the app could boot cold and read them back to hydrate
// its auth context. The server-side __Host- session cookie survives that
// navigation on its own and the app now restores from GET /sws/go/session, so
// the channel is gone. Purging keys a pre-cookie session may have left behind
// is app-shell-core's purgeLegacyAuthStorage, which owns the canonical list.

// sf_last_environment is a UX preference, not authentication state. It
// deliberately survives logout and must never be grouped with the removed
// sf_auth_* handoff keys.
export const LAST_ENVIRONMENT_KEY = 'sf_last_environment';

export function rememberEnvironment(clientId) {
  if (typeof localStorage === 'undefined' || !localStorage || !clientId) return;
  try {
    localStorage.setItem(LAST_ENVIRONMENT_KEY, clientId);
  } catch {
    // Storage may be unavailable or throw (SSR / private mode); the preference
    // is an optimisation, never a requirement.
  }
}

export function buildEnvironmentSessionStorage(env, loginResponse) {
  rememberEnvironment(env.clientId);
  const values = {
    sf_auth_token: loginResponse.token,
    sf_auth_user: env.adminUserName || env.adminUser || '',
    sf_auth_client_id: env.clientId || '',
    sf_auth_client_name: env.clientName || '',
  };

  if (loginResponse.roleList) {
    values.sf_auth_rolelist = JSON.stringify(loginResponse.roleList);
    const role = loginResponse.roleList[0];
    if (role) {
      values.sf_auth_selected_role = JSON.stringify(role);
      const org = selectPreferredOrg(role);
      if (org) values.sf_auth_selected_org = JSON.stringify(org);
    }
  }

  return values;
}

/** Replace the entire environment tuple before any async cleanup or navigation. */
export function persistEnvironmentSession(env, loginResponse) {
  const values = buildEnvironmentSessionStorage(env, loginResponse);
  const parse = (key) => values[key] ? JSON.parse(values[key]) : null;
  const session = {
    token: values.sf_auth_token,
    username: values.sf_auth_user,
    clientId: values.sf_auth_client_id,
    roleList: parse('sf_auth_rolelist') || [],
    selectedRole: parse('sf_auth_selected_role'),
    selectedOrg: parse('sf_auth_selected_org'),
  };
  replaceAmbientSession(session);
  for (const key of ENVIRONMENT_SESSION_KEYS) {
    if (values[key] == null) localStorage.removeItem(key);
    else localStorage.setItem(key, values[key]);
  }
  return session;
}

// Clears the Etendo environment session written by buildEnvironmentSessionStorage.
// Fail-safe: if localStorage is unavailable (SSR) or removeItem throws (private
// mode), the caller's own logout flow still resets state and redirects to login.
export function clearEnvironmentSession() {
  replaceAmbientSession({});
  if (typeof localStorage === 'undefined' || !localStorage) return;
  for (const key of ENVIRONMENT_SESSION_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable or throw (SSR / private mode).
    }
  }
}

export function isProfileStepValid(form) {
  if (!form.fullName?.trim() || !form.countryCode) return false;
  // Freelancers reuse the full name as the client name, so the stricter
  // AD_CLIENT.VALUE limit applies to them (ETP-4665). Blocking here keeps a
  // value that provisioning would reject from ever reaching the next step.
  return !exceedsLimit(form.fullName.trim(), fullNameLimitFor(form.businessType));
}

export function isCompanyStepValid(form) {
  // Tax ID (fiscalIdValue) is optional: it IS sent to provisioning when the user fills
  // it in (ETP-4749 — see SetupProgressStep.jsx's formPayload and api.js's
  // runOnboardingStream), but it must still not gate the step. Only the company name
  // is required to advance.
  if (!form.clientName?.trim()) return false;
  return !exceedsLimit(form.clientName.trim(), ONBOARDING_FIELD_LIMITS.clientName)
    && !exceedsLimit(form.address?.trim(), ONBOARDING_FIELD_LIMITS.address);
}
