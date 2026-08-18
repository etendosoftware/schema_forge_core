import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTH_ERROR_UI_KEYS } from '../src/onboarding/api.js';

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
