import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateSchema } from '../src/validate-schema.js';

// Helper to create minimal valid schema
function validSchema(overrides = {}) {
  return {
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    sourceChecksum: 'abcd1234',
    window: { id: '143', name: 'Sales Order', description: 'test', primaryEntity: 'order', category: 'sales' },
    entities: [{
      name: 'order', table: 'C_Order', description: 'Order', level: 'header',
      parentEntity: null, parentField: null,
      fields: [
        { name: 'documentNo', column: 'DocumentNo', label: 'Document No', type: 'string',
          required: true, visibility: 'readOnly', sequence: 10, grid: true, form: true, searchable: true }
      ],
      defaultSort: { field: 'documentNo', direction: 'desc' },
      uniqueConstraints: []
    }],
    ...overrides
  };
}

describe('validateSchema', () => {
  it('valid schema passes all levels', async () => {
    const result = await validateSchema(validSchema());
    assert.equal(result.errors.length, 0);
  });

  it('L1: missing window.name', async () => {
    const s = validSchema();
    delete s.window.name;
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1));
  });

  it('L1: duplicate field names', async () => {
    const s = validSchema();
    s.entities[0].fields.push({ ...s.entities[0].fields[0] });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1 && e.code === 'DUPLICATE_FIELD'));
  });

  it('L1: invalid visibility value', async () => {
    const s = validSchema();
    s.entities[0].fields[0].visibility = 'hidden';
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1));
  });

  it('L1: missing version', async () => {
    const s = validSchema();
    delete s.version;
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1 && e.code === 'MISSING_FIELD'));
  });

  it('L1: missing entities', async () => {
    const s = validSchema();
    delete s.entities;
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1 && e.code === 'MISSING_FIELD'));
  });

  it('L1: duplicate entity names', async () => {
    const s = validSchema();
    s.entities.push({ ...s.entities[0] });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1 && e.code === 'DUPLICATE_ENTITY'));
  });

  it('L1: invalid entity level', async () => {
    const s = validSchema();
    s.entities[0].level = 'unknown';
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 1 && e.code === 'INVALID_ENUM'));
  });

  it('L1: errors prevent L2+ from running', async () => {
    const s = validSchema();
    s.entities[0].fields[0].visibility = 'hidden';
    s.window.primaryEntity = 'nonexistent'; // Would be L2 error
    const result = await validateSchema(s);
    assert.equal(result.maxLevel, 1);
    assert.ok(!result.errors.some(e => e.level === 2));
  });

  it('L2: primaryEntity references nonexistent entity', async () => {
    const s = validSchema();
    s.window.primaryEntity = 'nonexistent';
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 2));
  });

  it('L2: FK field without reference', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'partnerId', column: 'C_BPartner_ID', label: 'Partner', type: 'foreignKey',
      required: true, visibility: 'editable', sequence: 20, grid: true, form: true, searchable: true
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 2 && e.message.includes('reference')));
  });

  it('L2: parentEntity references nonexistent entity', async () => {
    const s = validSchema();
    s.entities.push({
      name: 'orderLine', table: 'C_OrderLine', description: 'Line', level: 'line',
      parentEntity: 'nonexistent', parentField: 'orderId',
      fields: [
        { name: 'lineNo', column: 'Line', label: 'Line', type: 'integer',
          required: true, visibility: 'readOnly', sequence: 10, grid: true, form: true, searchable: false }
      ],
      defaultSort: { field: 'lineNo', direction: 'asc' },
      uniqueConstraints: []
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 2 && e.code === 'INVALID_REF'));
  });

  it('L2: parentField missing when parentEntity is set', async () => {
    const s = validSchema();
    s.entities.push({
      name: 'orderLine', table: 'C_OrderLine', description: 'Line', level: 'line',
      parentEntity: 'order', parentField: null,
      fields: [
        { name: 'lineNo', column: 'Line', label: 'Line', type: 'integer',
          required: true, visibility: 'readOnly', sequence: 10, grid: true, form: true, searchable: false }
      ],
      defaultSort: { field: 'lineNo', direction: 'asc' },
      uniqueConstraints: []
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 2 && e.code === 'MISSING_PARENT_FIELD'));
  });

  it('L3: system field without derivation', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'someSystem', column: 'SomeSystem', label: '', type: 'string',
      required: false, visibility: 'system', systemCategory: 'internal',
      sequence: 30, grid: false, form: false, searchable: false
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 3) || result.warnings.some(w => w.level === 3));
  });

  it('L3: system field with searchable=true', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'adClientId', column: 'AD_Client_ID', label: '', type: 'id',
      required: true, visibility: 'system', systemCategory: 'internal',
      derivation: { type: 'fromConfig', source: 'context.client' },
      sequence: 30, grid: false, form: false, searchable: true
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 3));
  });

  it('L3: system field with grid=true', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'adOrgId', column: 'AD_Org_ID', label: '', type: 'id',
      required: true, visibility: 'system', systemCategory: 'internal',
      derivation: { type: 'fromConfig', source: 'context.organization' },
      sequence: 30, grid: true, form: false, searchable: false
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 3 && e.code === 'SYSTEM_UI_PROP'));
  });

  it('L3: fromParent derivation on header entity without parent', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'inherited', column: 'Inherited', label: '', type: 'string',
      required: false, visibility: 'system', systemCategory: 'internal',
      derivation: { type: 'fromParent', source: 'someField' },
      sequence: 30, grid: false, form: false, searchable: false
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 3 && e.code === 'INVALID_FROM_PARENT'));
  });

  it('L3: system field in system-columns.json passes without derivation', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'adClientId', column: 'AD_Client_ID', label: '', type: 'id',
      required: true, visibility: 'system', systemCategory: 'internal',
      sequence: 30, grid: false, form: false, searchable: false
    });
    const result = await validateSchema(s);
    // Should not have L3 warning for this field since it's in system-columns.json
    assert.ok(!result.warnings.some(w => w.level === 3 && w.message.includes('adClientId')));
  });

  it('L4: searchable field with incompatible type', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'isActive', column: 'IsActive', label: 'Active', type: 'boolean',
      required: false, visibility: 'editable', sequence: 20, grid: true, form: true, searchable: true
    });
    const result = await validateSchema(s);
    assert.ok(result.errors.some(e => e.level === 4 && e.code === 'INVALID_SEARCHABLE_TYPE'));
  });

  it('L4: system field without derivation, default, or rule emits warning', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'someInternal', column: 'AD_Client_ID', label: '', type: 'id',
      required: true, visibility: 'system', systemCategory: 'internal',
      sequence: 30, grid: false, form: false, searchable: false
    });
    const result = await validateSchema(s);
    assert.ok(result.warnings.some(w => w.level === 4 && w.code === 'SYSTEM_NO_SOURCE'));
  });

  it('L4: system field with kept rule passes', async () => {
    const s = validSchema();
    s.entities[0].fields.push({
      name: 'customCalc', column: 'CustomCalc', label: '', type: 'string',
      required: false, visibility: 'system', systemCategory: 'internal',
      sequence: 30, grid: false, form: false, searchable: false
    });
    const rules = [{ field: 'customCalc', decision: 'keep', active: true }];
    const result = await validateSchema(s, rules);
    assert.ok(!result.warnings.some(w => w.level === 4 && w.code === 'SYSTEM_NO_SOURCE' && w.path.includes('customCalc')));
  });

  it('returns maxLevel=4 when all levels pass', async () => {
    const result = await validateSchema(validSchema());
    assert.equal(result.maxLevel, 4);
  });

  it('result structure has errors, warnings, maxLevel', async () => {
    const result = await validateSchema(validSchema());
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
    assert.ok(typeof result.maxLevel === 'number');
  });
});
