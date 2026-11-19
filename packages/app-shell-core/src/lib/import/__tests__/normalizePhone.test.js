import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isInvalidPhone, normalizePhoneTargets } from '../normalizePhone.js';

describe('normalizePhone (ETP-6225)', () => {
  it('strips spaces', () => {
    assert.equal(normalizePhone('+34 910 565 400'), '+34910565400');
    assert.equal(normalizePhone('912 345 678'), '912345678');
  });
  it('strips NBSP and U+FEFF (written as escapes so they cannot be mistaken for spaces)', () => {
    assert.equal(normalizePhone('+34\u00A0910\u00A0565\u00A0400'), '+34910565400');
    assert.equal(normalizePhone('\uFEFF912345678'), '912345678');
    assert.equal(isInvalidPhone('+34\u00A0910\u00A0565\u00A0400'), false);
    assert.equal(isInvalidPhone('\uFEFF912345678'), false);
  });
  it('turns numeric and float-like cells into integer strings (CP4)', () => {
    assert.equal(normalizePhone(653120012), '653120012');
    assert.equal(normalizePhone('653120012.0'), '653120012');
    assert.equal(normalizePhone(6.53120012e8), '653120012');
    assert.equal(normalizePhone('6.53120012e8'), '653120012');
  });
  it('keeps leading zeros and dotted phones', () => {
    assert.equal(normalizePhone('0034910565400'), '0034910565400');
    assert.equal(normalizePhone('910.565.400'), '910.565.400');
  });
  it('accepts valid phones', () => {
    for (const v of ['+34 910 565 400', '912 345 678', '653120012', '+34 (910) 565-400', 653120012, '653120012.0', '', null]) {
      assert.equal(isInvalidPhone(v), false, String(v));
    }
  });
  it('rejects leading apostrophe, bad chars and >15 chars', () => {
    for (const v of ["'+34 910 565 400", '+34 910#565', 'abc123', '+34 910 565 400 1234', '1234567890123456']) {
      assert.equal(isInvalidPhone(v), true, String(v));
    }
  });
  it('normalizes only the phone targets', () => {
    assert.deepEqual(normalizePhoneTargets({ phone: '1 2', name: 'a b' }, ['phone']), { phone: '12', name: 'a b' });
  });
});
