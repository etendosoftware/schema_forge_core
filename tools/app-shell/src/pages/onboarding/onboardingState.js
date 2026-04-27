export const SETUP_STEP_DEFINITIONS = [
  { name: 'setup', label: 'Preparando contexto', estimate: '1s' },
  { name: 'client', label: 'Crear empresa', estimate: '2 min' },
  { name: 'organization', label: 'Crear organizacion', estimate: '1 min' },
  { name: 'finalize', label: 'Finalizar configuracion', estimate: '1s' },
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
  };
}

export function selectPreferredOrg(role) {
  return role?.orgList?.find(org => org.name !== '*') || role?.orgList?.[0] || null;
}

export function buildEnvironmentSessionStorage(env, loginResponse) {
  const values = {
    sf_auth_token: loginResponse.token,
    sf_auth_user: env.adminUserName || env.adminUser || '',
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

export function isProfileStepValid(form) {
  return Boolean(form.fullName?.trim() && form.countryCode);
}

export function isCompanyStepValid(form) {
  return Boolean(form.clientName?.trim() && form.fiscalIdValue?.trim());
}
