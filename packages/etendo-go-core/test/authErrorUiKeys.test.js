import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_ERROR_UI_KEYS, resolveAuthErrorMessage } from '../src/onboarding/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const registerStep = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'RegisterStep.jsx'),
  'utf8',
);
const loginStep = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'LoginStep.jsx'),
  'utf8',
);

// ETP-4664 — register/login errors must translate by the backend's stable
// SCREAMING_SNAKE `code` (EtendoGoJwtServlet), never show the raw English
// `userMessage`/`message` it also sends. `error.code` is not itself a valid
// i18n key, so it must always be resolved through AUTH_ERROR_UI_KEYS.
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

describe('RegisterStep resolves register errors by code (ETP-4664)', () => {
  it('imports AUTH_ERROR_UI_KEYS from api.js', () => {
    assert.match(registerStep, /import\s*\{[^}]*AUTH_ERROR_UI_KEYS[^}]*\}\s*from\s*'\.\.\/api\.js'/s);
  });

  it('resolves the register error via AUTH_ERROR_UI_KEYS, with the generic fallback', () => {
    assert.match(
      registerStep,
      /setRegisterError\(ui\(AUTH_ERROR_UI_KEYS\[err\.code\] \|\| 'onboardingConnectionError'\)\);/,
    );
  });

  it('never shows the raw err.userMessage/message from the register endpoint', () => {
    const handleRegisterBlock = registerStep.slice(
      registerStep.indexOf('const handleRegister ='),
      registerStep.indexOf('const authFeatureLabels ='),
    );
    assert.doesNotMatch(handleRegisterBlock, /err\.userMessage/);
  });
});

describe('LoginStep resolves login errors by code (ETP-4664)', () => {
  it('imports AUTH_ERROR_UI_KEYS from api.js', () => {
    assert.match(loginStep, /import\s*\{[^}]*AUTH_ERROR_UI_KEYS[^}]*\}\s*from\s*'\.\.\/api\.js'/s);
  });

  it('resolves the login error via AUTH_ERROR_UI_KEYS, with the generic fallback', () => {
    assert.match(
      loginStep,
      /setLoginError\(ui\(AUTH_ERROR_UI_KEYS\[err\.code\] \|\| 'onboardingConnectionError'\)\);/,
    );
  });

  it('never shows the raw err.userMessage/message from the login endpoint', () => {
    const handleLoginBlock = loginStep.slice(
      loginStep.indexOf('const handleLogin ='),
      loginStep.indexOf('const handleForgotPassword ='),
    );
    assert.doesNotMatch(handleLoginBlock, /err\.userMessage/);
  });
});

// ETP-5258 — the reset/forgot views (also the SSO "set a password" link) used to prefer the
// backend's fixed English userMessage, so the error stayed in English under a Spanish UI.
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

describe('LoginStep reset and forgot views resolve errors by code (ETP-5258)', () => {
  const recoveryBlock = loginStep.slice(
    loginStep.indexOf('const handleForgotPassword ='),
    loginStep.indexOf('const setOnboardingLocale ='),
  );

  it('routes both failures through resolveAuthErrorMessage', () => {
    assert.match(recoveryBlock, /setForgotError\(resolveAuthErrorMessage\(ui, err, 'onboardingCredentialResetFailed'\)\)/);
    assert.match(recoveryBlock, /setResetError\(resolveAuthErrorMessage\(ui, err, 'onboardingCredentialResetFailed'\)\)/);
  });

  it('never shows the raw err.userMessage', () => {
    assert.doesNotMatch(recoveryBlock, /err\.userMessage/);
  });
});

describe('every new-password screen in core shares the strength checklist (ETP-5258)', () => {
  it('RegisterStep and the LoginStep reset view render PasswordStrengthChecklist', () => {
    assert.match(registerStep, /<PasswordStrengthChecklist[\s\S]*?testIdPrefix="register-password"/);
    assert.match(loginStep, /<PasswordStrengthChecklist[\s\S]*?testIdPrefix="reset-password"/);
  });

  it('the reset submit is gated on isStrongPassword', () => {
    assert.match(loginStep, /disabled=\{resetLoading \|\| !resetForm\.token \|\| !isStrongPassword\(resetForm\.password\)\}/);
  });
});
