// @covers packages/etendo-go-core/src/onboarding/api.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_ERROR_UI_KEYS, resolveAuthErrorMessage } from '../src/onboarding/api.js';

// ETP-4664 — register/login errors must translate by the backend's stable
// SCREAMING_SNAKE `code` (EtendoGoJwtServlet), never show the raw English
// `userMessage`/`message` it also sends. `error.code` is not itself a valid
// i18n key, so it must always be resolved through AUTH_ERROR_UI_KEYS.
//
// The table and the resolver live here; the screens that consume them are covered
// through a render in src/onboarding/steps/__tests__/AuthErrorMessages.vitest.jsx
// (LoginStep, RegisterStep and the reset/forgot views), which is why this file
// asserts no component source text.
describe('AUTH_ERROR_UI_KEYS (ETP-4664)', () => {
  it('maps every register/login backend error code to an onboarding i18n key', () => {
    const expected = {
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
      // ETP-5022 (AUTH-07) — change-password failures, previously surfaced as raw
      // English server text.
      CHANGE_PASSWORD_MISSING_CREDENTIALS: 'onboardingChangePasswordMissingCredentials',
      NO_LOCAL_PASSWORD: 'onboardingNoLocalPassword',
      INVALID_CURRENT_PASSWORD: 'onboardingInvalidCurrentPassword',
      // ETP-5258 — unknown, used or expired reset/set-password link.
      PASSWORD_RESET_INVALID: 'onboardingCredentialResetFailed',
    };
    assert.deepEqual(AUTH_ERROR_UI_KEYS, expected);
  });

  it('every mapped key follows the onboarding* i18n naming convention', () => {
    for (const key of Object.values(AUTH_ERROR_UI_KEYS)) {
      assert.match(key, /^onboarding[A-Z]/, `${key} must start with "onboarding"`);
    }
  });
});

// ETP-5258 — the reset/forgot views (also the SSO "set a password" link) used to prefer the
// backend's fixed English userMessage, so the error stayed in English under a Spanish UI.
// They call this resolver, never the raw error text — see the rendered cases in
// src/onboarding/steps/__tests__/AuthErrorMessages.vitest.jsx.
describe('resolveAuthErrorMessage (ETP-5258)', () => {
  const ui = (key) => `t:${key}`;

  it('translates a mapped code', () => {
    assert.equal(
      resolveAuthErrorMessage(ui, { code: 'WEAK_PASSWORD', userMessage: 'English text' }, 'fallbackKey'),
      't:onboardingWeakPassword',
    );
  });

  it('falls back to the given key for an unmapped code, never the English userMessage', () => {
    assert.equal(
      resolveAuthErrorMessage(ui, { code: 'SOMETHING_NEW', userMessage: 'English text' }, 'fallbackKey'),
      't:fallbackKey',
    );
  });

  it('falls back for an error without a code (network failure) or no error at all', () => {
    assert.equal(resolveAuthErrorMessage(ui, new TypeError('Failed to fetch'), 'fallbackKey'), 't:fallbackKey');
    assert.equal(resolveAuthErrorMessage(ui, undefined, 'fallbackKey'), 't:fallbackKey');
  });
});
