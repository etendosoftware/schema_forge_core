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
  it('uses buildDefaultOperations when no descriptorName is given', async () => {
    const row = { name: 'Widget' };
    const ops = await buildOperations(row, { spec: 'product', entity: 'product', targets: ['name'] });
    assert.equal(ops.length, 1);
    assert.equal(ops[0].body.name, 'Widget');
  });

  it('delegates to a registered descriptor when descriptorName is given', async () => {
    registerImportDescriptor('contacts', (row, config) => [
      { id: 'bp', spec: config.spec, entity: 'businessPartner', body: { name: row.name } },
      { id: 'loc', spec: config.spec, entity: 'locationAddress', parentRef: 'bp', body: { country: row.country } },
    ]);
    const ops = await buildOperations({ name: 'Acme', country: 'Argentina' }, { spec: 'contacts', descriptorName: 'contacts' });
    assert.equal(ops.length, 2);
    assert.equal(ops[0].id, 'bp');
    assert.equal(ops[1].parentRef, 'bp');
  });

  it('throws when descriptorName is set but not registered', async () => {
    await assert.rejects(
      () => buildOperations({}, { spec: 'x', descriptorName: 'never-registered' }),
      /No import descriptor registered: "never-registered"/,
    );
  });

  it('regression: resolves to a real array (not a Promise) even when the registered descriptor is itself async', async () => {
    // The exact bug this guards against: buildOperations() used to be a plain (non-async)
    // function that returned `descriptor(row, config)` verbatim. An async descriptor
    // (e.g. Contacts, which awaits FK resolution) made that a Promise, not an array —
    // JSON.stringify(promise) serializes to "{}", so a caller that forgot to await this
    // would send `{"operations":{}}` to /batch and get rejected outright.
    registerImportDescriptor('async-contacts', async (row, config) => {
      await Promise.resolve(); // force a real microtask hop, not just an immediately-settled thenable
      return [{ id: 'bp', spec: config.spec, entity: 'businessPartner', body: { name: row.name } }];
    });
    const result = buildOperations({ name: 'Acme' }, { spec: 'contacts', descriptorName: 'async-contacts' });
    assert.ok(typeof result.then === 'function', 'buildOperations must always return a thenable, even for a sync descriptor');
    const ops = await result;
    assert.ok(Array.isArray(ops), 'the resolved value must be a real array');
    assert.equal(ops[0].body.name, 'Acme');
  });
});
