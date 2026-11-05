// @covers packages/etendo-go-core/src/onboarding/phonePrefixes.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPhonePrefixOptions,
  composePhone,
  defaultPhonePrefix,
  isValidPhoneNumber,
  PHONE_NUMBER_MAX_LENGTH,
} from '../src/onboarding/phonePrefixes.js';

describe('phone prefixes (ETP-6081)', () => {
  it('preselects the prefix of the given country, case-insensitively', () => {
    assert.equal(defaultPhonePrefix('ES'), 'ES');
    assert.equal(defaultPhonePrefix('es'), 'ES');
  });

  it('preselects nothing for an unknown or missing country', () => {
    assert.equal(defaultPhonePrefix('ZZ'), '');
    assert.equal(defaultPhonePrefix(undefined), '');
  });

  it('labels each option with the two-letter code and the dialling code', () => {
    const spain = buildPhonePrefixOptions('es_ES').find(option => option.value === 'ES');
    assert.equal(spain.label, 'ES +34');
    assert.equal(spain.dialCode, '34');
  });

  it('keeps the country name in the UI language for the tooltip', () => {
    const spain = buildPhonePrefixOptions('es_ES').find(option => option.value === 'ES');
    assert.equal(spain.name, 'España');
  });

  it('orders the options by country code', () => {
    const codes = buildPhonePrefixOptions('en_US').map(option => option.value);
    assert.deepEqual(codes, [...codes].sort());
  });

  it('accepts an empty number: the phone is optional', () => {
    assert.equal(isValidPhoneNumber(''), true);
    assert.equal(isValidPhoneNumber('   '), true);
  });

  it('accepts digits with the usual separators', () => {
    assert.equal(isValidPhoneNumber('600 12 34 56'), true);
    assert.equal(isValidPhoneNumber('(11) 4567-8901'), true);
  });

  it('rejects letters, too few digits and an over-long number', () => {
    assert.equal(isValidPhoneNumber('600abc'), false);
    assert.equal(isValidPhoneNumber('12'), false);
    assert.equal(isValidPhoneNumber('1'.repeat(PHONE_NUMBER_MAX_LENGTH + 1)), false);
  });

  it('composes the stored value with the prefix of the selected country', () => {
    assert.equal(composePhone('ES', ' 600123456 '), '+34 600123456');
    assert.equal(composePhone('us', '555 0100'), '+1 555 0100');
  });

  it('composes nothing without a number, without a prefix or with an invalid number', () => {
    assert.equal(composePhone('ES', ''), '');
    assert.equal(composePhone('', '600123456'), '');
    assert.equal(composePhone('ES', '600abc'), '');
  });
});
