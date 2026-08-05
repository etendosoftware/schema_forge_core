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
    // Remembering the choice is an optimisation and must never block login.
  }
}

export function isProfileStepValid(form) {
  return Boolean(form.fullName?.trim() && form.countryCode);
}

export function isCompanyStepValid(form) {
  // Tax ID (fiscalIdValue) is optional: it is not sent to provisioning, so it
  // must not gate the step. Only the company name is required.
  return Boolean(form.clientName?.trim());
}
