import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyEmail,
  resendVerifyEmail,
  runOnboardingStream,
  ONBOARDING_ERROR_CODES,
} from '../src/onboarding/api.js';
import { ONBOARDING_ERROR_CODE_LABELS } from '../src/onboarding/errorMessages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingFlow = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'OnboardingFlow.jsx'),
  'utf8',
);
const stepsRegistry = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'index.js'),
  'utf8',
);

/** Step ids in registry order, read from source (steps/index.js imports .jsx, so it cannot be imported here). */
function stepIdsInOrder() {
  return [...stepsRegistry.matchAll(/\{\s*id:\s*'([^']+)'/g)].map((match) => match[1]);
}

const BASE = 'https://etendo.example.test';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('verifyEmail (ETP-4798)', () => {
  it('posts the token to /sws/go/verify-email without an Authorization header', async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success', emailVerified: true });
    };

    const data = await verifyEmail(fetchImpl, BASE, 'tok-123');

    assert.equal(seen.url, `${BASE}/sws/go/verify-email`);
    assert.equal(seen.init.method, 'POST');
    // The mailed link is opened without a session; sending an Authorization header would be
    // meaningless and requiring one would break the flow entirely.
    assert.equal(seen.init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(seen.init.body), { token: 'tok-123' });
    assert.equal(data.emailVerified, true);
  });

  it('throws with the backend stable code when the link is no longer valid', async () => {
    const fetchImpl = async () => jsonResponse(
      { error: { code: 'EMAIL_VERIFY_INVALID', message: 'Invalid or expired email verification token' } },
      { ok: false, status: 400 },
    );

    await assert.rejects(
      () => verifyEmail(fetchImpl, BASE, 'stale'),
      (err) => {
        assert.equal(err.code, 'EMAIL_VERIFY_INVALID');
        assert.equal(err.status, 400);
        return true;
      },
    );
  });
});

describe('resendVerifyEmail (ETP-4798)', () => {
  it('authenticates with the session token and passes the language', async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success' });
    };

    await resendVerifyEmail(fetchImpl, BASE, 'session-token', 'es_ES');

    assert.equal(seen.url, `${BASE}/sws/go/verify-email/resend?language=es_ES`);
    assert.equal(seen.init.headers.Authorization, 'Bearer session-token');
  });

  it('omits the language query when none is selected', async () => {
    let seen = null;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return jsonResponse({ status: 'success' });
    };

    await resendVerifyEmail(fetchImpl, BASE, 'session-token', '');

    assert.equal(seen.url, `${BASE}/sws/go/verify-email/resend`);
  });
});

describe('runOnboardingStream surfaces a refusal instead of a stream (ETP-4798)', () => {
  it('throws the gate code when onboarding is refused with 403', async () => {
    // The refusal is plain JSON sent before the NDJSON stream opens. Without the response.ok check
    // this body would be parsed as a progress line and reported as the generic "missing result".
    const fetchImpl = async () => jsonResponse(
      { error: { code: 'EMAIL_NOT_VERIFIED', message: 'Confirm your email address before creating an environment.' } },
      { ok: false, status: 403 },
    );

    await assert.rejects(
      () => runOnboardingStream(fetchImpl, BASE, 'session-token', { clientName: 'ACME' }, () => {}),
      (err) => {
        assert.equal(err.code, 'EMAIL_NOT_VERIFIED');
        assert.equal(err.status, 403);
        return true;
      },
    );
  });

  it('keeps the flat paywall envelope readable too', async () => {
    // The paywall sends `{ error: "PAYMENT_REQUIRED" }`, where the code IS the string.
    const fetchImpl = async () => jsonResponse(
      { error: 'PAYMENT_REQUIRED', message: 'Creating an additional environment requires a payment.' },
      { ok: false, status: 402 },
    );

    await assert.rejects(
      () => runOnboardingStream(fetchImpl, BASE, 'session-token', { clientName: 'ACME' }, () => {}),
      (err) => {
        assert.equal(err.code, 'PAYMENT_REQUIRED');
        return true;
      },
    );
  });

  it('falls back to the stream-unavailable code when the refusal has no parseable body', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json'); },
    });

    await assert.rejects(
      () => runOnboardingStream(fetchImpl, BASE, 'session-token', { clientName: 'ACME' }, () => {}),
      (err) => {
        assert.equal(err.code, ONBOARDING_ERROR_CODES.streamUnavailable);
        return true;
      },
    );
  });
});

describe('the gate has a localized message (ETP-4798)', () => {
  it('maps EMAIL_NOT_VERIFIED so the progress screen never shows the English backend text', () => {
    assert.equal(ONBOARDING_ERROR_CODE_LABELS.EMAIL_NOT_VERIFIED, 'onboardingEmailNotVerified');
  });
});

describe('OnboardingFlow consumes the confirmation link (ETP-4798)', () => {
  it('reads the verifyToken query parameter', () => {
    assert.match(onboardingFlow, /search\.get\('verifyToken'\)/);
  });

  it('strips the token from the address bar before issuing the request', () => {
    const block = onboardingFlow.slice(
      onboardingFlow.indexOf("const verifyToken = search.get('verifyToken')"),
      onboardingFlow.indexOf('// Every persistable step'),
    );
    const stripAt = block.indexOf('window.history.replaceState');
    const requestAt = block.indexOf('verifyEmail(fetch');
    assert.ok(stripAt > -1, 'must rewrite the URL');
    assert.ok(requestAt > -1, 'must call verifyEmail');
    assert.ok(stripAt < requestAt, 'the URL must be rewritten before the request is issued');
  });

  it('settles the confirmation before reading /me, so the fresh state is not overwritten', () => {
    // Regression guard: both requests were once fired concurrently, and whenever /me answered
    // first it reported the still-pending state over the just-confirmed one.
    const block = onboardingFlow.slice(
      onboardingFlow.indexOf("const verifyToken = search.get('verifyToken')"),
      onboardingFlow.indexOf('// Every persistable step'),
    );
    assert.match(block, /confirmEmailFirst\.then\(bootstrap\)/);
    const fetchAt = block.indexOf('fetchAccount(fetch, apiBase, currentToken)');
    const bootstrapAt = block.indexOf('const bootstrap = ()');
    assert.ok(bootstrapAt > -1 && fetchAt > bootstrapAt,
      '/me must be read inside bootstrap(), after the confirmation settles');
  });
});

describe('the resend cooldown (ETP-4798)', () => {
  const wall = readFileSync(
    join(__dirname, '..', 'src', 'onboarding', 'steps', 'VerifyEmailStep.jsx'),
    'utf8',
  );

  it('waits 60 seconds after a successful resend', () => {
    assert.match(wall, /RESEND_COOLDOWN_MS = 60_000/);
  });

  it('only starts the cooldown on success, so a failed send stays retryable', () => {
    const handler = wall.slice(
      wall.indexOf('const handleResend'),
      wall.indexOf('return (', wall.indexOf('const handleResend')),
    );
    const successAt = handler.indexOf('writeCooldownDeadline');
    const catchAt = handler.indexOf('} catch {');
    assert.ok(successAt > -1 && catchAt > -1);
    assert.ok(successAt < catchAt, 'the deadline must be written in the try, never the catch');
    assert.doesNotMatch(handler.slice(catchAt), /writeCooldownDeadline/);
  });

  it('refuses a second send while cooling, not only while in flight', () => {
    assert.match(wall, /if \(state === 'sending' \|\| cooling\) return;/);
  });

  it('persists the deadline, so the documented refresh does not reset it', () => {
    // This screen tells users to refresh (that is how confirming on a phone unblocks a desktop),
    // so a state-only timer would be bypassed by the very action they are told to take.
    assert.match(wall, /localStorage\.setItem/);
    assert.match(wall, /localStorage\.getItem/);
    assert.match(wall, /useState\(\(\) => readCooldownDeadline\(accountEmail\)\)/);
  });

  it('keys the deadline per address', () => {
    assert.match(wall, /sf_verify_resend_until:\$\{email \|\| 'unknown'\}/);
  });

  it('survives storage being unavailable instead of breaking the screen', () => {
    const reader = wall.slice(wall.indexOf('function readCooldownDeadline'), wall.indexOf('function writeCooldownDeadline'));
    assert.match(reader, /catch \{/);
  });

  it('clears its interval on unmount', () => {
    assert.match(wall, /return \(\) => clearInterval\(id\);/);
  });

  it('no longer parks the button on a terminal sent state', () => {
    // Before the cooldown the button was replaced by a permanent "sent" message, so a legitimate
    // second resend needed a page reload.
    assert.doesNotMatch(wall, /state === 'sent'/);
  });
});

describe('the confirm-your-email wall (ETP-4798)', () => {
  it('is a registered step, placed so it cannot break the handleNext index chain', () => {
    const ids = stepIdsInOrder();
    assert.ok(ids.includes('verify-email'), 'verify-email must be a step');
    // handleNext advances by index, so profile -> company -> setup-progress must stay contiguous.
    assert.equal(ids.indexOf('company'), ids.indexOf('profile') + 1);
    assert.equal(ids.indexOf('setup-progress'), ids.indexOf('company') + 1);
  });

  it('owns no draft state, so it cannot disturb draft save/restore', () => {
    // draftPersistence resolves steps by id/draftStep and requires persistable, so a step carrying
    // neither cannot participate in draft save or restore.
    const entry = stepsRegistry.match(/\{\s*id:\s*'verify-email'[^}]*\}/);
    assert.ok(entry, 'verify-email must be registered');
    assert.doesNotMatch(entry[0], /persistable/);
    assert.doesNotMatch(entry[0], /draftStep/);
  });

  it('routes on emailVerificationPending, never on "not verified"', () => {
    // An account predating ETP-4798 — or one whose mail could not be sent, which the backend
    // leaves ungated on purpose — is neither verified nor pending and must never be walled.
    // The exact predicate is pinned, which is stronger than also asserting the absence of
    // "!emailVerified" — that negative matched the doc comment explaining the distinction.
    assert.match(
      onboardingFlow,
      /owesEmailConfirmation = \(account\) => Boolean\(account\?\.emailVerificationPending\)/,
    );
  });

  it('guards the single funnel every authenticated entry passes through', () => {
    // Guarding only the mount path let a plain login (LoginStep calls routeByEnvironments
    // directly) walk past the wall and into onboarding.
    const funnel = onboardingFlow.slice(
      onboardingFlow.indexOf('const routeByEnvironments = useCallback'),
      onboardingFlow.indexOf('// Initial token verification on mount'),
    );
    const guardAt = funnel.indexOf("goToStep('verify-email')");
    const envsAt = funnel.indexOf('setLoadingEnvs(true)');
    assert.ok(guardAt > -1, 'the funnel must be able to route to the wall');
    assert.ok(guardAt < envsAt, 'the wall check must precede loading environments');
  });

  it('reuses the /me payload the mount path already fetched', () => {
    assert.match(onboardingFlow, /routeByEnvironments\(currentToken, data\)/);
  });

  it('decides the post-registration destination on server state, not optimistically', () => {
    const block = onboardingFlow.slice(
      onboardingFlow.indexOf('const handleRegisterSuccess = async'),
      onboardingFlow.indexOf('const handleStepDataChange'),
    );
    assert.match(block, /await fetchAccount\(fetch, apiBase, authToken\)/);
    assert.match(block, /owesEmailConfirmation\(freshAccount\) \? 'verify-email' : 'profile'/);
  });

  it('no longer gates handleNext or renders the removed banner', () => {
    // Both became unreachable once the wall moved ahead of onboarding; the backend 403 is what
    // still covers a modified client.
    assert.doesNotMatch(onboardingFlow, /EmailVerificationNotice/);
    assert.doesNotMatch(onboardingFlow, /emailVerification\.pending/);
  });
});
