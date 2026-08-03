import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isAdMessageKey,
  resolveOnboardingErrorMessage,
} from '../src/onboarding/errorMessages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingDir = join(__dirname, '..', 'src', 'onboarding');

// Mirrors useUI(): interpolates {param} and echoes the key when it has no translation.
const DICTIONARY = {
  onboardingGenericError: 'Something went wrong during onboarding.',
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

describe('the flow routes its failures through the resolver (ETP-4665)', () => {
  const read = name => readFileSync(join(onboardingDir, name), 'utf8');

  it('resolves the stream result instead of rendering msg.message raw', () => {
    const step = read(join('steps', 'SetupProgressStep.jsx'));
    assert.match(step, /error: msg\.success \? null : resolveOnboardingErrorMessage\(ui, msg\)/);
    assert.doesNotMatch(step, /error: msg\.success \? null : msg\.message/);
  });

  it('resolves register failures through the same helper', () => {
    const step = read(join('steps', 'RegisterStep.jsx'));
    assert.match(step, /resolveOnboardingErrorMessage\(ui, err, 'onboardingConnectionError'\)/);
  });

  it('carries the field and max details out of the JSON error envelope', () => {
    const api = read('api.js');
    assert.match(api, /error\.field = data\?\.error\?\.field \?\? null;/);
    assert.match(api, /error\.max = data\?\.error\?\.max \?\? null;/);
  });
});
