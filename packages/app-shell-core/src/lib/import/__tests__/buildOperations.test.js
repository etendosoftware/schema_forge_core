import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerImportDescriptor,
  getImportDescriptor,
  buildDefaultOperations,
  buildOperations,
} from '../buildOperations.js';

describe('buildDefaultOperations', () => {
  it('builds a single create op with only the listed targets in the body', () => {
    const row = { name: 'Widget', uom: 'Kg', ignoredColumn: 'x' };
    const ops = buildDefaultOperations(row, { spec: 'product', entity: 'product', targets: ['name', 'uom'] });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].id, 'row');
    assert.equal(ops[0].spec, 'product');
    assert.equal(ops[0].entity, 'product');
    assert.deepEqual(ops[0].body, { name: 'Widget', uom: 'Kg' });
  });
});

describe('registerImportDescriptor / getImportDescriptor', () => {
  it('registers and retrieves a descriptor by name', () => {
    const fn = () => [];
    registerImportDescriptor('test-descriptor', fn);
    assert.equal(getImportDescriptor('test-descriptor'), fn);
  });

  it('returns undefined for an unregistered name', () => {
    assert.equal(getImportDescriptor('nonexistent'), undefined);
  });
});

describe('buildOperations', () => {
  it('uses buildDefaultOperations when no descriptorName is given', () => {
    const row = { name: 'Widget' };
    const ops = buildOperations(row, { spec: 'product', entity: 'product', targets: ['name'] });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].body.name, 'Widget');
  });

  it('delegates to a registered descriptor when descriptorName is given', () => {
    registerImportDescriptor('contacts', (row, config) => [
      { id: 'bp', spec: config.spec, entity: 'businessPartner', body: { name: row.name } },
      { id: 'loc', spec: config.spec, entity: 'locationAddress', parentRef: 'bp', body: { country: row.country } },
    ]);
    const ops = buildOperations({ name: 'Acme', country: 'Argentina' }, { spec: 'contacts', descriptorName: 'contacts' });
    assert.equal(ops.length, 2);
    assert.equal(ops[0].id, 'bp');
    assert.equal(ops[1].parentRef, 'bp');
  });

  it('throws when descriptorName is set but not registered', () => {
    assert.throws(
      () => buildOperations({}, { spec: 'x', descriptorName: 'never-registered' }),
      /No import descriptor registered: "never-registered"/,
    );
  });
});
