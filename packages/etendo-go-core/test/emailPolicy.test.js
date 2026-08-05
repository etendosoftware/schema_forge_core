import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmailFormat } from '../src/onboarding/emailPolicy.js';

// ETP-4664 — real-time email format validation on the register step.
describe('isValidEmailFormat', () => {
  it('accepts a well-formed email', () => {
    assert.equal(isValidEmailFormat('usuario@dominio.com'), true);
  });

  it('rejects a missing top-level domain (reported bug case)', () => {
    assert.equal(isValidEmailFormat('usuario@gm'), false);
  });

  it('rejects an empty or blank value', () => {
    assert.equal(isValidEmailFormat(''), false);
    assert.equal(isValidEmailFormat('   '), false);
  });

  it('rejects a value with no @', () => {
    assert.equal(isValidEmailFormat('usuario.dominio.com'), false);
  });

  it('rejects a value with spaces', () => {
    assert.equal(isValidEmailFormat('usuario @dominio.com'), false);
  });

  it('accepts common valid variants (plus-addressing, subdomains, dots)', () => {
    assert.equal(isValidEmailFormat('user.name+tag@sub.dominio.com'), true);
  });

  it('trims surrounding whitespace before validating', () => {
    assert.equal(isValidEmailFormat('  usuario@dominio.com  '), true);
  });

  it('is case-insensitive on the domain TLD', () => {
    assert.equal(isValidEmailFormat('usuario@dominio.COM'), true);
  });
});
