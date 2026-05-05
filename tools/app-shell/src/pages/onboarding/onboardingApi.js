export const ONBOARDING_ERROR_CODES = {
  registerFailed: 'onboardingRegisterFailed',
  invalidCredentials: 'onboardingInvalidCredentials',
  invalidSession: 'onboardingInvalidSession',
  loadEnvironmentsFailed: 'onboardingLoadEnvironmentsFailed',
  environmentLoginFailed: 'onboardingEnvironmentLoginFailed',
  streamUnavailable: 'onboardingStreamUnavailable',
  missingResult: 'onboardingMissingResult',
};

export function buildAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildApiError(data, fallbackCode) {
  const error = new Error(data?.error?.message || data?.message || fallbackCode);
  error.code = fallbackCode;
  error.userMessage = data?.error?.message || data?.message || null;
  return error;
}

async function readJsonResponse(response, fallbackCode) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw buildApiError(data, fallbackCode);
  }
  return data;
}

export async function registerAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.registerFailed);
}

export async function loginAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidCredentials);
}

export async function fetchAccount(fetchImpl, baseUrl, token) {
  const response = await fetchImpl(`${baseUrl}/sws/go/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidSession);
}

export async function fetchEnvironments(fetchImpl, baseUrl, token) {
  const response = await fetchImpl(`${baseUrl}/sws/go/environments`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await readJsonResponse(response, ONBOARDING_ERROR_CODES.loadEnvironmentsFailed);
  return data.environments || [];
}

export async function loginEnvironment(fetchImpl, baseUrl, token, env) {
  const userId = encodeURIComponent(env.adminUserId);
  const response = await fetchImpl(`${baseUrl}/sws/go/login?userId=${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.environmentLoginFailed);
}

export async function runOnboardingStream(fetchImpl, baseUrl, token, form, onMessage) {
  const response = await fetchImpl(`${baseUrl}/sws/go/onboarding`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      clientName: form.clientName,
      currency: form.currency,
      language: form.language,
      countryCode: form.countryCode,
    }),
  });

  if (!response.body?.getReader) {
    const error = new Error(ONBOARDING_ERROR_CODES.streamUnavailable);
    error.code = ONBOARDING_ERROR_CODES.streamUnavailable;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    if (done) buffer += decoder.decode();

    const lines = buffer.split('\n');
    buffer = done ? '' : lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      onMessage?.(message);
      if (message.type === 'result') {
        finalResult = message;
      }
    }

    if (done) break;
  }

  if (!finalResult) {
    const error = new Error(ONBOARDING_ERROR_CODES.missingResult);
    error.code = ONBOARDING_ERROR_CODES.missingResult;
    throw error;
  }
  return finalResult;
}
