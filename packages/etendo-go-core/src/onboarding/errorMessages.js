/**
 * Turns whatever the backend reports into something a user can read (ETP-4665).
 *
 * Two shapes reach this module:
 *
 * 1. Structured codes from the JSON endpoints and from the provisioning stream
 *    (`{ code: 'FIELD_TOO_LONG', field: 'email', max: 60 }`), which map to a
 *    localized label here.
 * 2. Raw Etendo AD message keys such as `@CreateClientFailed@`. `InitialClientSetup`
 *    and `InitialOrgSetup` put those unresolved keys straight into their `OBError`,
 *    and nothing downstream translates them — so before ETP-4665 the literal
 *    `@CreateClientFailed@` was rendered on screen. Any `@Something@` is caught
 *    here and never shown as-is.
 */

const AD_MESSAGE_KEY_PATTERN = /^@([A-Za-z0-9_]+)@$/;

/** Stable error codes emitted by the Etendo GO onboarding endpoints. */
export const ONBOARDING_ERROR_CODE_LABELS = {
  FIELD_TOO_LONG: 'onboardingFieldTooLong',
  CLIENT_CREATION_FAILED: 'onboardingCreateClientFailed',
  ORG_CREATION_FAILED: 'onboardingCreateOrgFailed',
  WEAK_PASSWORD: 'onboardingWeakPassword',
  // ETP-4798 — the onboarding stream is refused before it opens when the account still owes an
  // email confirmation.
  EMAIL_NOT_VERIFIED: 'onboardingEmailNotVerified',
};

/**
 * AD message keys worth a specific message. Anything else that arrives wrapped
 * in `@…@` still gets intercepted and falls back to the generic error.
 */
export const AD_MESSAGE_KEY_LABELS = {
  CreateClientFailed: 'onboardingCreateClientFailed',
  CreateOrgFailed: 'onboardingCreateOrgFailed',
  DuplicateClient: 'onboardingDuplicateClient',
  DuplicateClientUser: 'onboardingDuplicateClient',
  DuplicateOrgName: 'onboardingDuplicateClient',
  DuplicateOrgUser: 'onboardingDuplicateClient',
};

/** True when `value` is an unresolved Etendo AD message key like `@Foo@`. */
export function isAdMessageKey(value) {
  return typeof value === 'string' && AD_MESSAGE_KEY_PATTERN.test(value.trim());
}

function adMessageKeyOf(value) {
  const match = typeof value === 'string' ? value.trim().match(AD_MESSAGE_KEY_PATTERN) : null;
  return match ? match[1] : null;
}

/**
 * Resolves a backend failure into a localized, user-facing string.
 *
 * @param ui           the `useUI()` translator
 * @param source       an Error thrown by api.js, or a stream `result` message
 * @param fallbackKey  i18n key used when nothing more specific is known
 * @returns the localized message, or null when there is nothing to report
 */
export function resolveOnboardingErrorMessage(ui, source, fallbackKey = 'onboardingGenericError') {
  if (!source) return null;

  const code = source.code || null;
  const rawMessage = source.userMessage || source.message || null;

  const codeLabel = code ? ONBOARDING_ERROR_CODE_LABELS[code] : null;
  if (codeLabel) {
    // useUI() substitutes every key it is given, so an undefined `max` would
    // render the literal "undefined" inside the sentence. Only pass what exists,
    // and drop to the generic message when the limit itself is missing.
    const params = {};
    if (source.max !== undefined && source.max !== null) params.max = source.max;
    if (source.field) params.field = source.field;
    if (codeLabel === ONBOARDING_ERROR_CODE_LABELS.FIELD_TOO_LONG && params.max === undefined) {
      return ui(fallbackKey);
    }
    return ui(codeLabel, params);
  }

  const adKey = adMessageKeyOf(rawMessage);
  if (adKey) {
    return ui(AD_MESSAGE_KEY_LABELS[adKey] || fallbackKey);
  }

  // A plain backend sentence (e.g. "Email already registered") is still more
  // useful than a generic banner, so it is passed through. Only unresolved AD
  // keys and unknown codes are replaced.
  if (rawMessage) return rawMessage;

  // `code` is unknown but present: ui() echoes the key when it has no
  // translation, which is exactly how the legacy per-call codes
  // (onboardingRegisterFailed, …) are already resolved.
  return ui(code || fallbackKey);
}
