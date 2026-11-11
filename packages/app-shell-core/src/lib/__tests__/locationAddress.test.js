// @covers packages/app-shell-core/src/lib/locationAddress.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeAddressLines,
  effectiveBuildingNumber,
  EMPTY_BUILDING_NUMBER_FALLBACK,
  ADDRESS_LINE_MAX_LENGTH,
  STREET_NAME_MAX_LENGTH,
  BUILDING_NUMBER_MAX_LENGTH,
  BUILDING_NAME_MAX_LENGTH,
} from '../locationAddress.js';

describe('composeAddressLines (ETP-5806 — ports StructuredAddressComposer/LocationSEPA.fillAddressLines)', () => {
  it('exposes the DB column length constants mirrored from the Java side', () => {
    assert.equal(ADDRESS_LINE_MAX_LENGTH, 60);
    assert.equal(STREET_NAME_MAX_LENGTH, 70);
    assert.equal(BUILDING_NUMBER_MAX_LENGTH, 16);
    assert.equal(BUILDING_NAME_MAX_LENGTH, 35);
  });

  it('puts everything on line 1 and leaves line 2 empty when it all fits (<= 60 chars)', () => {
    const result = composeAddressLines('Calle Mayor', '5', '');
    assert.deepEqual(result, { address1: 'Calle Mayor, 5', address2: '' });
  });

  it('omits the building name from the join when it is absent, without a trailing separator', () => {
    const result = composeAddressLines('Calle Mayor', '5', '   ');
    assert.deepEqual(result, { address1: 'Calle Mayor, 5', address2: '' });
  });

  it('accepts a free-text building number such as "s/n"', () => {
    const result = composeAddressLines('Calle Mayor', 's/n', '');
    assert.deepEqual(result, { address1: 'Calle Mayor, s/n', address2: '' });
  });

  it('moves the building name to line 2, untruncated, when Street+Number fits but the full join overflows', () => {
    const street = 'Avenida Principal Industrial';
    const number = '100';
    const buildingName = 'Nave Numero Cuarenta y Dos Fondo';
    const streetAndNumber = `${street}, ${number}`;
    // Sanity on the fixture itself: streetAndNumber must fit, the full join must not.
    assert.ok(streetAndNumber.length <= 60);
    assert.ok(`${streetAndNumber} - ${buildingName}`.length > 60);

    const result = composeAddressLines(street, number, buildingName);
    assert.deepEqual(result, { address1: streetAndNumber, address2: buildingName });
  });

  it('truncates a long building name to 60 chars on line 2 when it alone would overflow', () => {
    const street = 'Avenida Principal';
    const number = '1';
    const buildingName = 'X'.repeat(80);
    const result = composeAddressLines(street, number, buildingName);
    assert.equal(result.address1, `${street}, ${number}`);
    assert.equal(result.address2, 'X'.repeat(60));
    assert.equal(result.address2.length, 60);
  });

  it('truncates the street itself to 60 chars, and puts "Number - BuildingName" on line 2, when even Street+Number overflows', () => {
    const street = 'CCCCC Calle de Nombre Extremadamente Largo Para Forzar Truncado Total';
    assert.ok(`${street}, 1`.length > 60);

    const result = composeAddressLines(street, '1', 'B');
    assert.equal(result.address1, street.slice(0, 60));
    assert.equal(result.address1.length, 60);
    assert.equal(result.address2, '1 - B');
  });

  it('truncates line 2 to 60 chars too, in the street-overflow branch, when Number + BuildingName is itself long', () => {
    const street = 'Y'.repeat(90);
    const number = '100';
    const buildingName = 'Z'.repeat(90);
    const result = composeAddressLines(street, number, buildingName);
    assert.equal(result.address1, street.slice(0, 60));
    assert.equal(result.address2, `${number} - ${buildingName}`.slice(0, 60));
    assert.equal(result.address2.length, 60);
  });

  it('trims surrounding whitespace on every field before composing', () => {
    const result = composeAddressLines('  Calle Mayor  ', '  5  ', '  ');
    assert.deepEqual(result, { address1: 'Calle Mayor, 5', address2: '' });
  });

  it('composes a blank number as "s/n" when a street is present (StructuredAddressComposer fallback)', () => {
    assert.deepEqual(composeAddressLines('Calle Mayor', '', ''), { address1: 'Calle Mayor, s/n', address2: '' });
    assert.deepEqual(composeAddressLines('Calle Mayor', '   ', 'Bajo'), {
      address1: 'Calle Mayor, s/n - Bajo',
      address2: '',
    });
  });

  it('carries the "s/n" fallback into line 2 in the street-overflow branch', () => {
    const street = 'W'.repeat(65);
    const result = composeAddressLines(street, null, 'Nave 3');
    assert.deepEqual(result, { address1: 'W'.repeat(60), address2: 's/n - Nave 3' });
  });

  it('returns empty lines when there is no street, even with a number or a building name typed', () => {
    assert.deepEqual(composeAddressLines('', '1', ''), { address1: '', address2: '' });
    assert.deepEqual(composeAddressLines('   ', '1', 'Edificio A'), { address1: '', address2: '' });
  });

  it('coerces numeric input to text before composing', () => {
    assert.deepEqual(composeAddressLines('Calle Mayor', 5, ''), { address1: 'Calle Mayor, 5', address2: '' });
    assert.deepEqual(composeAddressLines('Calle Mayor', 0, ''), { address1: 'Calle Mayor, 0', address2: '' });
  });

  it('returns empty strings for completely empty input', () => {
    const result = composeAddressLines('', '', '');
    assert.deepEqual(result, { address1: '', address2: '' });
  });

  it('treats null/undefined fields the same as empty strings', () => {
    const result = composeAddressLines(null, undefined, null);
    assert.deepEqual(result, { address1: '', address2: '' });
  });

  it('composes Street + Number alone when there is no building name, regardless of length', () => {
    const result = composeAddressLines('Calle Larga del Pueblo', '42', '');
    assert.deepEqual(result, { address1: 'Calle Larga del Pueblo, 42', address2: '' });
  });
});

describe('effectiveBuildingNumber (mirrors StructuredAddressComposer.effectiveBuildingNumber)', () => {
  it('returns the trimmed number when there is one', () => {
    assert.equal(effectiveBuildingNumber('Calle Mayor', '  12B  '), '12B');
    assert.equal(effectiveBuildingNumber('', '7'), '7');
  });

  it('returns "s/n" when the number is blank and a street is present', () => {
    assert.equal(EMPTY_BUILDING_NUMBER_FALLBACK, 's/n');
    for (const blank of ['', '   ', null, undefined]) {
      assert.equal(effectiveBuildingNumber('Calle Mayor', blank), 's/n');
    }
  });

  it('returns null when both street and number are blank', () => {
    assert.equal(effectiveBuildingNumber('', ''), null);
    assert.equal(effectiveBuildingNumber(null, undefined), null);
  });

  it('coerces a numeric number, keeping 0 as a real value', () => {
    assert.equal(effectiveBuildingNumber('Calle Mayor', 42), '42');
    assert.equal(effectiveBuildingNumber('Calle Mayor', 0), '0');
  });
});
