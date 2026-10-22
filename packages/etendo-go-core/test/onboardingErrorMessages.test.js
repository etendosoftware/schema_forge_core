// @covers packages/etendo-go-core/src/onboarding/errorMessages.js
// @covers packages/etendo-go-core/src/onboarding/api.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAdMessageKey,
  resolveOnboardingErrorMessage,
} from '../src/onboarding/errorMessages.js';
import { registerAccount } from '../src/onboarding/api.js';

// Mirrors useUI(): interpolates {param} and echoes the key when it has no translation.
const DICTIONARY = {
  onboardingGenericError: 'Something went wrong during onboarding.',
  onboardingSessionLostError: 'Your session ended. Sign in again to continue.',
  onboardingCreateClientFailed: 'We could not create your environment.',
  onboardingCreateOrgFailed: 'We could not create your organization.',
  onboardingDuplicateClient: 'That company name is already taken.',
  onboardingFieldTooLong: 'This field must not exceed {max} characters.',
  onboardingWeakPassword: 'Password is too weak.',
  onboardingConnectionError: 'Connection error.',
};

function ui(key, params = {}) {
  const template = DICTIONARY[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined || params[name] === null ? match : String(params[name])
  ));
}

const BASE = 'https://etendo.example.test';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

// ETP-4665 — InitialClientSetup / InitialOrgSetup report failures as UNRESOLVED
// Etendo AD message keys, and nothing in the chain translated them, so the user
// literally saw "@CreateClientFailed@" on the final onboarding screen.
describe('AD message key detection', () => {
  it('recognizes a wrapped AD key', () => {
    assert.equal(isAdMessageKey('@CreateClientFailed@'), true);
    assert.equal(isAdMessageKey('  @CreateOrgFailed@  '), true);
  });

  it('does not mistake ordinary text or an email for an AD key', () => {
    assert.equal(isAdMessageKey('Email already registered'), false);
    assert.equal(isAdMessageKey('user@example.com'), false);
    assert.equal(isAdMessageKey('@ not a key @'), false);
    assert.equal(isAdMessageKey(null), false);
    assert.equal(isAdMessageKey(undefined), false);
  });
});

describe('resolveOnboardingErrorMessage (ETP-4665)', () => {
  it('replaces the reported @CreateClientFailed@ with a localized sentence', () => {
    const message = resolveOnboardingErrorMessage(ui, {
      type: 'result',
      success: false,
      message: '@CreateClientFailed@',
    });
    assert.equal(message, 'We could not create your environment.');
  });

  it('maps the organization and duplicate-name keys too', () => {
    assert.equal(
      resolveOnboardingErrorMessage(ui, { message: '@CreateOrgFailed@' }),
      'We could not create your organization.',
    );
    assert.equal(
      resolveOnboardingErrorMessage(ui, { message: '@DuplicateClient@' }),
      'That company name is already taken.',
    );
  });

  it('falls back to the generic error for an AD key it does not know', () => {
    const message = resolveOnboardingErrorMessage(ui, { message: '@SomeBrandNewFailure@' });
    assert.equal(message, 'Something went wrong during onboarding.');
    assert.doesNotMatch(message, /@/, 'a raw AD key must never reach the user');
  });

  it('localizes a length violation using the limit the backend reported', () => {
    const message = resolveOnboardingErrorMessage(ui, {
      code: 'FIELD_TOO_LONG',
      field: 'clientName',
      max: 40,
      message: 'Field clientName must not exceed 40 characters',
    });
    // The localized text wins over the backend's English sentence.
    assert.equal(message, 'This field must not exceed 40 characters.');
  });

  it('does not render "undefined" when a length error arrives without its limit', () => {
    // useUI() substitutes every param it is handed, so a missing `max` used to
    // produce "must not exceed undefined characters".
    const message = resolveOnboardingErrorMessage(ui, { code: 'FIELD_TOO_LONG', field: 'email' });
    assert.equal(message, 'Something went wrong during onboarding.');
    assert.doesNotMatch(message, /undefined/);
  });

  it('prefers the stable code over the backend text for provisioning failures', () => {
    const message = resolveOnboardingErrorMessage(ui, {
      code: 'CLIENT_CREATION_FAILED',
      message: '@CreateClientFailed@',
    });
    assert.equal(message, 'We could not create your environment.');
  });

  it('keeps the weak-password behaviour the register step had before', () => {
    const message = resolveOnboardingErrorMessage(ui, {
      code: 'WEAK_PASSWORD',
      userMessage: 'Password does not meet the policy',
    }, 'onboardingConnectionError');
    assert.equal(message, 'Password is too weak.');
  });

  it('passes a plain backend sentence through — it is more useful than a generic banner', () => {
    const message = resolveOnboardingErrorMessage(ui, {
      code: 'onboardingRegisterFailed',
      userMessage: 'Email already registered',
    });
    assert.equal(message, 'Email already registered');
  });

  it('uses the per-call fallback code when there is no message at all', () => {
    const message = resolveOnboardingErrorMessage(ui, { code: null }, 'onboardingConnectionError');
    assert.equal(message, 'Connection error.');
  });

  it('reports nothing when there is no error', () => {
    assert.equal(resolveOnboardingErrorMessage(ui, null), null);
    assert.equal(resolveOnboardingErrorMessage(ui, undefined), null);
  });
});

// ETP-4665 — the flow routes its failures through the resolver, and the error envelope must carry
// the length-violation details the resolver needs. The callers' side of it (SetupProgressStep
// resolving a stream result, RegisterStep localizing FIELD_TOO_LONG with the backend's `max`, and
// never showing the raw backend sentence) is asserted on the rendered components in
// src/onboarding/steps/__tests__/AuthErrorMessages.vitest.jsx; what is left here is the transport:
// what the real api module hands back.
describe('the error envelope carries the length-violation details (ETP-4665)', () => {
  it('exposes the field and max the backend reported', async () => {
    const response = jsonResponse({
      error: {
        code: 'FIELD_TOO_LONG',
        message: 'Field clientName must not exceed 40 characters',
        field: 'clientName',
        max: 40,
      },
    }, { ok: false, status: 400 });

    const error = await registerAccount(async () => response, BASE, { email: 'ada@example.test' })
      .catch((thrown) => thrown);

    assert.equal(error.code, 'FIELD_TOO_LONG');
    assert.equal(error.field, 'clientName');
    assert.equal(error.max, 40);
  });

  it('reports them as null when the backend did not send them', async () => {
    const response = jsonResponse({
      error: { code: 'WEAK_PASSWORD', message: 'Password does not meet the policy' },
    }, { ok: false, status: 400 });

    const error = await registerAccount(async () => response, BASE, { email: 'ada@example.test' })
      .catch((thrown) => thrown);

    assert.equal(error.field, null);
    assert.equal(error.max, null);
  });
});

// ETP-5675 — the reported failure: provisioning refused for a session another tab had closed showed
// the backend's raw English "Missing or invalid Authorization header" under a Spanish UI.
describe('resolveOnboardingErrorMessage — lost session (ETP-5675)', () => {
  it('translates a 401 instead of quoting the backend', () => {
    const err = Object.assign(new Error('Missing or invalid Authorization header'), { status: 401 });
    assert.equal(resolveOnboardingErrorMessage(ui, err), DICTIONARY.onboardingSessionLostError);
  });

  it('translates the account-mismatch 403', () => {
    const err = Object.assign(new Error('Session belongs to another account'), { status: 403 });
    assert.equal(resolveOnboardingErrorMessage(ui, err), DICTIONARY.onboardingSessionLostError);
  });

  it('leaves other 403s to the existing rules', () => {
    const err = Object.assign(new Error('Origin not allowed'), { status: 403 });
    assert.notEqual(resolveOnboardingErrorMessage(ui, err), DICTIONARY.onboardingSessionLostError);
  });
});
