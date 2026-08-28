export const ONBOARDING_ERROR_CODES = {
  registerFailed: 'onboardingRegisterFailed',
  invalidCredentials: 'onboardingInvalidCredentials',
  invalidSession: 'onboardingInvalidSession',
  loadEnvironmentsFailed: 'onboardingLoadEnvironmentsFailed',
  environmentLoginFailed: 'onboardingEnvironmentLoginFailed',
  credentialChangeFailed: 'onboardingCredentialChangeFailed',
  credentialResetFailed: 'onboardingCredentialResetFailed',
  ssoFailed: 'onboardingSsoFailed',
  streamUnavailable: 'onboardingStreamUnavailable',
  missingResult: 'onboardingMissingResult',
  emailVerifyFailed: 'onboardingEmailVerifyFailed',
};

// ETP-4664 — maps the stable, SCREAMING_SNAKE `error.code` returned by the
// register/login endpoints (EtendoGoJwtServlet) to the i18n key that
// translates it. `error.code` is machine-readable and NOT itself a valid
// dictionary key — always resolve it through this table (or the
// 'onboardingConnectionError' fallback) instead of passing it to ui() directly.
export const AUTH_ERROR_UI_KEYS = {
  WEAK_PASSWORD: 'onboardingWeakPassword',
  INVALID_REQUEST: 'onboardingInvalidRequest',
  REGISTER_MISSING_FIELDS: 'onboardingRegisterMissingFields',
  REGISTER_EMPTY_FIELDS: 'onboardingRegisterEmptyFields',
  INVALID_EMAIL_FORMAT: 'onboardingInvalidEmailFormat',
  EMAIL_ALREADY_REGISTERED: 'onboardingEmailAlreadyRegistered',
  REGISTER_SERVER_ERROR: 'onboardingRegisterServerError',
  LOGIN_MISSING_FIELDS: 'onboardingLoginMissingFields',
  INVALID_CREDENTIALS: 'onboardingInvalidCredentials',
  LOGIN_SERVER_ERROR: 'onboardingLoginServerError',
  INTERNAL_ERROR: 'onboardingConnectionError',
  // ETP-4798 — email ownership confirmation.
  EMAIL_NOT_VERIFIED: 'onboardingEmailNotVerified',
  EMAIL_VERIFY_INVALID: 'onboardingEmailVerifyInvalid',
  // AUTH-07 / ETP-5022 — change-password failures. These used to reach the user as the
  // backend's raw English text because ChangePasswordDialog preferred error.userMessage
  // over this table.
  CHANGE_PASSWORD_MISSING_CREDENTIALS: 'onboardingChangePasswordMissingCredentials',
  NO_LOCAL_PASSWORD: 'onboardingNoLocalPassword',
  INVALID_CURRENT_PASSWORD: 'onboardingInvalidCurrentPassword',
};

const SSO_PAYLOAD_BUILDERS = {
  google: (payload = {}) => ({
    credential: payload.credential,
  }),
};

// ETP-5022: mirrors app-shell-core's useLocaleState STORAGE_KEY. Duplicated on purpose —
// this package has no dependency on app-shell-core, and adding one to read a single
// localStorage key would couple the onboarding flow to the whole app shell.
const LOCALE_STORAGE_KEY = 'schema-forge-locale';
const DEFAULT_LOCALE = 'es_ES';

function storedLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function buildAuthHeaders(csrfToken) {
  return {
    'Content-Type': 'application/json',
    // ETP-5022: without this the backend resolves AD_Message text in the account's AD
    // language, so auth errors came back in English while the UI was in Spanish.
    'Accept-Language': storedLocale(),
    // ETP-4576: the session is the `__Host-` cookie the browser sends on its own, so
    // what travels here is the proof of intent, never a credential.
    ...(csrfToken ? { 'X-Go-CSRF': csrfToken } : {}),
  };
}

function buildApiError(data, fallbackCode, status) {
  // Two error envelopes exist. Most endpoints send the structured
  // `{ error: { code, message, userMessage } }` (ETP-4664); the paywall sends the older flat
  // `{ error: "PAYMENT_REQUIRED", message }`, where `error` is the code itself as a string.
  const flatCode = typeof data?.error === 'string' ? data.error : null;
  const error = new Error(data?.error?.message || data?.message || fallbackCode);
  // Prefer the backend's stable error code (e.g. "WEAK_PASSWORD") when present,
  // falling back to the generic per-call code.
  error.code = data?.error?.code || flatCode || fallbackCode;
  error.userMessage = data?.error?.userMessage || data?.error?.message || data?.message || null;
  error.status = status;
  // Length-violation details (ETP-4665): the backend reports which field
  // overflowed and its limit so the UI can localize "no more than N characters".
  error.field = data?.error?.field ?? null;
  error.max = data?.error?.max ?? null;
  return error;
}

async function readJsonResponse(response, fallbackCode) {
  const data = await response.json();
  if (!response.ok) {
    throw buildApiError(data, fallbackCode, response.status);
  }
  return data;
}

export async function fetchSession(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/sws/go/session`, {
    credentials: 'include',
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidSession);
}

export async function registerAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/session/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.registerFailed);
}

export async function loginAccount(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidCredentials);
}

export async function loginWithSsoProvider(fetchImpl, baseUrl, provider, payload) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const buildPayload = SSO_PAYLOAD_BUILDERS[normalizedProvider];
  if (!buildPayload) {
    const error = new Error(ONBOARDING_ERROR_CODES.ssoFailed);
    error.code = ONBOARDING_ERROR_CODES.ssoFailed;
    throw error;
  }
  const response = await fetchImpl(`${baseUrl}/sws/go/session/sso/${encodeURIComponent(normalizedProvider)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(payload)),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.ssoFailed);
}

export async function requestPasswordReset(fetchImpl, baseUrl, email) {
  const response = await fetchImpl(`${baseUrl}/sws/go/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.credentialResetFailed);
}

export async function confirmPasswordReset(fetchImpl, baseUrl, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: form.token,
      password: form.password,
    }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.credentialResetFailed);
}

/**
 * ETP-4798 — confirms the account holder controls the email address.
 *
 * Unauthenticated on purpose: the token from the mailed link IS the credential, and the link is
 * usually opened in a browser with no session. Idempotent server-side, so re-following the same
 * link (or a mail client prefetching it) resolves rather than erroring.
 *
 * ETP-4576 — no `credentials: 'include'` for the same reason it takes no CSRF proof: there is no
 * session to send. It sits with requestPasswordReset/confirmPasswordReset, the other two calls a
 * logged-out visitor makes.
 */
export async function verifyEmail(fetchImpl, baseUrl, token) {
  const response = await fetchImpl(`${baseUrl}/sws/go/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.emailVerifyFailed);
}

/**
 * ETP-4798 — asks for the confirmation link again. Always resolves with the same neutral payload
 * whether a mail went out or nothing was pending, so the caller must not try to infer state from it.
 *
 * ETP-4576 — unlike verifyEmail this one IS authenticated (the visitor is signed in, just not
 * confirmed), so it takes the session cookie plus the CSRF proof. It arrived from the epic passing
 * the bearer token to buildAuthHeaders, which under this scheme would have shipped the bearer as
 * `X-Go-CSRF` — a header the backend rejects — while sending no session at all.
 */
export async function resendVerifyEmail(fetchImpl, baseUrl, csrfToken, language) {
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  const response = await fetchImpl(`${baseUrl}/sws/go/verify-email/resend${query}`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.emailVerifyFailed);
}

export async function changePassword(fetchImpl, baseUrl, csrfToken, form) {
  const response = await fetchImpl(`${baseUrl}/sws/go/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
    body: JSON.stringify({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.credentialChangeFailed);
}

export async function fetchAccount(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/sws/go/me`, {
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidSession);
}

export async function fetchEnvironments(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/sws/go/environments`, {
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
  });
  const data = await readJsonResponse(response, ONBOARDING_ERROR_CODES.loadEnvironmentsFailed);
  return data.environments || [];
}

export async function loginEnvironment(fetchImpl, baseUrl, csrfToken, env) {
  // ETP-4576 — POSTs to the session endpoint instead of GET /sws/go/login?userId=:
  // picking an environment now updates the backend-managed session rather than minting
  // a token for the client to hold. Headers come from buildAuthHeaders so this call
  // keeps ETP-5022's Accept-Language like every other one.
  const response = await fetchImpl(`${baseUrl}/sws/go/session/environment`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
    body: JSON.stringify({
      userId: env.adminUserId,
      ...(env.roleId ? { roleId: env.roleId } : {}),
      ...(env.orgId ? { orgId: env.orgId } : {}),
    }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.environmentLoginFailed);
}

export async function fetchOnboardingDraft(fetchImpl, baseUrl) {
  const response = await fetchImpl(`${baseUrl}/sws/go/onboarding/draft`, {
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
  });
  const data = await readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidSession);
  return data.draft || null;
}

export async function saveOnboardingDraft(fetchImpl, baseUrl, csrfToken, draft) {
  const response = await fetchImpl(`${baseUrl}/sws/go/onboarding/draft`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
    body: JSON.stringify({ draft }),
  });
  return readJsonResponse(response, ONBOARDING_ERROR_CODES.invalidSession);
}

function processLines(lines, onMessage, finalResult) {
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    onMessage?.(message);
    if (message.type === 'result') {
      finalResult = message;
    }
  }
  return finalResult;
}

async function readStreamResult(reader, onMessage) {
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult = null;

  while (true) {
    const {done, value} = await reader.read();
    if (value) buffer += decoder.decode(value, {stream: !done});
    if (done) buffer += decoder.decode();

    const lines = buffer.split('\n');
    buffer = done ? '' : lines.pop();

    finalResult = processLines(lines, onMessage, finalResult);

    if (done) break;
  }
  return finalResult;
}

export async function runOnboardingStream(fetchImpl, baseUrl, csrfToken, form, onMessage) {
  const response = await fetchImpl(`${baseUrl}/sws/go/onboarding`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(csrfToken),
    body: JSON.stringify({
      clientName: form.clientName,
      currency: form.currency,
      language: form.language,
      countryCode: form.countryCode,
      ...(form.address ? { address: form.address } : {}),
      ...(form.fullName ? { fullName: form.fullName } : {}),
      // Optional Tax ID from the Company step (ETP-4749) — matches
      // com.etendoerp.go's EtendoGoJwtServlet, which reads this same JSON key
      // ("fiscalIdValue") and persists it onto AD_OrgInfo.TaxID when non-blank.
      ...(form.fiscalIdValue ? { fiscalIdValue: form.fiscalIdValue } : {}),
    }),
  });

  // A refused request never becomes a stream: the backend answers plain JSON before opening the
  // NDJSON response (the ETP-4798 email gate and the ETP-4686 paywall both do). Without this check
  // that JSON would be fed to processLines as if it were a progress line, produce no `result`
  // message, and surface as the generic "missing result" error instead of the real reason.
  // `ok === false` rather than `!ok`: a real Response always carries the flag, but fetch shims and
  // test doubles routinely model only `body.getReader`, and treating a missing flag as a failure
  // would reject a perfectly good stream.
  if (response.ok === false) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    throw buildApiError(data, ONBOARDING_ERROR_CODES.streamUnavailable, response.status);
  }

  if (!response.body?.getReader) {
    const error = new Error(ONBOARDING_ERROR_CODES.streamUnavailable);
    error.code = ONBOARDING_ERROR_CODES.streamUnavailable;
    throw error;
  }

  const reader = response.body.getReader();
  const finalResult = await readStreamResult(reader, onMessage);

  if (!finalResult) {
    const error = new Error(ONBOARDING_ERROR_CODES.missingResult);
    error.code = ONBOARDING_ERROR_CODES.missingResult;
    throw error;
  }
  return finalResult;
}
