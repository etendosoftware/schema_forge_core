import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeChecksum, generateVersion, toCamelCase } from '../src/utils.js';

describe('utils', () => {
  it('computeChecksum produces consistent hex hash', () => {
    const hash1 = computeChecksum('hello world');
    const hash2 = computeChecksum('hello world');
    assert.equal(hash1, hash2);
    assert.match(hash1, /^[0-9a-f]{8,}$/);
  });

  it('computeChecksum changes when input changes', () => {
    assert.notEqual(computeChecksum('hello'), computeChecksum('world'));
  });

  it('generateVersion returns semver format', () => {
    assert.match(generateVersion(), /^\d+\.\d+\.\d+$/);
  });

  it('toCamelCase converts column names', () => {
    assert.equal(toCamelCase('DocumentNo'), 'documentNo');
    assert.equal(toCamelCase('AD_Client_ID'), 'adClientId');
    assert.equal(toCamelCase('C_Order_ID'), 'cOrderId');
    assert.equal(toCamelCase('IsActive'), 'isActive');
  });
});
