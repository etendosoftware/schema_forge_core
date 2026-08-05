import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const registerStep = readFileSync(
  join(__dirname, '..', 'src', 'onboarding', 'steps', 'RegisterStep.jsx'),
  'utf8',
);

// ETP-4664 — RegisterStep must validate the email format live (not only on
// submit) and gate the submit button, mirroring the existing password-policy
// wiring in the same file.
describe('RegisterStep email format wiring (ETP-4664)', () => {
  it('imports isValidEmailFormat from emailPolicy', () => {
    assert.match(
      registerStep,
      /import\s*\{\s*isValidEmailFormat\s*\}\s*from\s*'\.\.\/emailPolicy\.js'/,
    );
  });

  it('derives email validity from state on every render, no debounce/onBlur handler', () => {
    assert.match(registerStep, /const registerEmailValid = isValidEmailFormat\(registerForm\.email\)/);
    assert.doesNotMatch(registerStep, /onBlur=\{.*email/);
  });

  it('shows a green check icon when the email is valid, red alert when invalid, nothing until touched', () => {
    const emailFieldBlock = registerStep.slice(
      registerStep.indexOf('id="reg-email"'),
      registerStep.indexOf('id="reg-password"'),
    );
    assert.match(emailFieldBlock, /trailing=\{registerEmailTouched \? \(/);
    assert.match(emailFieldBlock, /<Check className="h-5 w-5 text-emerald-500"/);
    assert.match(emailFieldBlock, /<AlertCircle className="h-5 w-5 text-rose-500"/);
    assert.match(emailFieldBlock, /\) : null\}/);
  });

  it('does not block typing (the input itself is never disabled by email validity)', () => {
    const emailFieldBlock = registerStep.slice(
      registerStep.indexOf('id="reg-email"'),
      registerStep.indexOf('id="reg-password"'),
    );
    assert.match(emailFieldBlock, /disabled=\{registerLoading\}/);
  });

  it('blocks account creation while the email format is invalid, via the submit button gate', () => {
    assert.match(
      registerStep,
      /disabled=\{registerLoading \|\| !registerPasswordStrong \|\| !registerEmailValid\}/,
    );
  });
});
