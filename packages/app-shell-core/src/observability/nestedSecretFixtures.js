/**
 * Shared nested-secret fixture for the telemetry gateway's abuse tests (ETP-4577
 * acceptance criterion: "fixtures with nested secrets do not appear in any output
 * payload").
 *
 * This is the SAME kind of single-source-of-truth fixture as `csvNeutralizationFixtures.js`
 * — kept as data, not inlined per test, so it can be reused verbatim. ETP-4578 needs
 * exactly this: PRD WS-3 item 6 requires testing the actual SERIALIZED outbound
 * envelope for each real provider (Sentry/GlitchTip, AWS RUM, Mixpanel), not just the
 * sanitizer's own output — that test should assert against this same secret set rather
 * than inventing a second one that could silently drift from what this gateway guards
 * against.
 */

// Deliberately NOT shaped like a real vendor key prefix (sk_live_, ghp_, AKIA…, xox…) —
// an earlier draft used a Stripe-shaped value and tripped GitHub push protection even
// though it was synthetic. High entropy (mixed case + digits, 40+ chars) is what the
// sanitizer's opaque-token heuristic needs; a recognizable vendor prefix is not.
export const SECRET_TOKEN = 'FAKE_TEST_TOKEN_ab12cd34ef56gh78ij90kl12mn34op56qr78st90uv12';
export const SECRET_EMAIL = 'jane.doe@example.com';
export const SECRET_PASSWORD = 'Tr0ub4dor&3-super-secret';
export const SECRET_SSN = '123-45-6789';

/** Every value that must never appear, in any form, in a sanitized/dispatched payload. */
export const NESTED_SECRET_FIXTURE_SECRETS = [SECRET_TOKEN, SECRET_EMAIL, SECRET_PASSWORD, SECRET_SSN];

/**
 * A realistic bundle with secrets planted at multiple depths and under multiple key
 * shapes (a sensitive key name, a legitimate key whose string value embeds a secret, a
 * URL query string, an `Authorization` header). The caller's `allowedKeys` in the
 * matching test approves every structural key here — a real leak would mean the value
 * scrub or the sensitive-key defense in depth failed, not that the key gate did.
 */
export function buildNestedSecretFixture() {
  return {
    user: {
      profile: {
        email: SECRET_EMAIL,
        ssn: SECRET_SSN,
        credentials: { token: SECRET_TOKEN, password: SECRET_PASSWORD },
      },
    },
    request: {
      headers: { authorization: `Bearer ${SECRET_TOKEN}`, cookie: `sid=${SECRET_TOKEN}` },
      url: `https://go.etendo.cloud/sws/neo/session?access_token=${SECRET_TOKEN}`,
    },
    message: `User ${SECRET_EMAIL} failed auth with ${SECRET_TOKEN}`,
  };
}

/** The full set of key names `buildNestedSecretFixture()` uses, for a caller's `allowedKeys`. */
export const NESTED_SECRET_FIXTURE_ALLOWED_KEYS = [
  'user', 'profile', 'email', 'ssn', 'credentials', 'token', 'password',
  'request', 'headers', 'authorization', 'cookie', 'url', 'message',
];

/**
 * @param {unknown} sanitized Anything JSON-serializable — a sanitizer's output, or a
 *   mock adapter's recorded call arguments.
 * @returns {string[]} Any fixture secret still present, empty when clean.
 */
export function findLeakedFixtureSecrets(sanitized) {
  const serialized = JSON.stringify(sanitized);
  return NESTED_SECRET_FIXTURE_SECRETS.filter((secret) => serialized.includes(secret));
}
