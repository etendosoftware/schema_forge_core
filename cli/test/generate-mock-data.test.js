import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateMockValue,
  generateMockRecords,
  generateAllMockData,
  generateMockDataFile,
} from '../src/generate-mock-data.js';

const sampleContract = {
  frontendContract: {
    window: { id: '143', name: 'Sales Order', primaryEntity: 'order', category: 'sales' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
          { name: 'businessPartner', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'orderDate', type: 'date', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'warehouse', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: false, form: true },
          { name: 'currency', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
          { name: 'description', type: 'string', tsType: 'string', visibility: 'editable', required: false, grid: false, form: true },
          { name: 'totalLines', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
          { name: 'grandTotal', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
          { name: 'docStatus', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
        ],
        searchableFields: ['documentNo', 'businessPartner', 'docStatus'],
        computedFields: [],
      },
      orderLine: {
        fields: [
          { name: 'lineNo', type: 'integer', tsType: 'number', visibility: 'readOnly', required: true, grid: true, form: true },
          { name: 'product', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'quantity', type: 'number', tsType: 'number', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'unitPrice', type: 'amount', tsType: 'number', visibility: 'editable', required: true, grid: true, form: true },
          { name: 'discount', type: 'number', tsType: 'number', visibility: 'editable', required: false, grid: true, form: true },
          { name: 'lineNetAmount', type: 'amount', tsType: 'number', visibility: 'readOnly', required: false, grid: true, form: true },
          { name: 'tax', type: 'string', tsType: 'string', visibility: 'editable', required: false, grid: true, form: true },
          { name: 'description', type: 'string', tsType: 'string', visibility: 'editable', required: false, grid: false, form: true },
        ],
        searchableFields: ['product'],
        computedFields: [],
      },
    },
  },
};

// --- generateMockValue tests ---

describe('generateMockValue', () => {
  it('generates sequential document numbers for documentNo', () => {
    const field = { name: 'documentNo', type: 'string' };
    const val0 = generateMockValue(field, 0, 'order');
    const val1 = generateMockValue(field, 1, 'order');
    assert.equal(val0, 'SO-00001');
    assert.equal(val1, 'SO-00002');
  });

  it('generates sequential document numbers for lineNo-style *No fields', () => {
    const field = { name: 'invoiceNo', type: 'string' };
    const val = generateMockValue(field, 2, 'invoice');
    assert.match(val, /^IN-\d{5}$/);
  });

  it('generates business partner names for *Partner* fields', () => {
    const field = { name: 'businessPartner', type: 'string' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'string');
    assert.ok(val.length > 0, 'should not be empty');
  });

  it('cycles through docStatus values', () => {
    const field = { name: 'docStatus', type: 'string' };
    const statuses = ['DR', 'CO', 'VO', 'IP'];
    for (let i = 0; i < 8; i++) {
      const val = generateMockValue(field, i, 'order');
      assert.equal(val, statuses[i % 4]);
    }
  });

  it('generates date strings for date fields', () => {
    const field = { name: 'orderDate', type: 'date' };
    const val = generateMockValue(field, 0, 'order');
    assert.match(val, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('generates numeric amounts for amount fields', () => {
    const field = { name: 'grandTotal', type: 'amount' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'number');
    assert.ok(val >= 500 && val <= 50000, `amount ${val} should be between 500 and 50000`);
  });

  it('generates integers for integer type fields', () => {
    const field = { name: 'someCount', type: 'integer' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'number');
    assert.ok(Number.isInteger(val), 'should be an integer');
    assert.ok(val >= 1 && val <= 100);
  });

  it('cycles through currency values for *currency* fields', () => {
    const field = { name: 'currency', type: 'string' };
    const currencies = ['USD', 'EUR', 'GBP'];
    for (let i = 0; i < 6; i++) {
      const val = generateMockValue(field, i, 'order');
      assert.equal(val, currencies[i % 3]);
    }
  });

  it('generates warehouse names for *warehouse* fields', () => {
    const field = { name: 'warehouse', type: 'string' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'string');
    assert.ok(val.length > 0);
  });

  it('generates product names for *product* fields', () => {
    const field = { name: 'product', type: 'string' };
    const val = generateMockValue(field, 0, 'orderLine');
    assert.equal(typeof val, 'string');
    assert.ok(val.length > 0);
  });

  it('generates discount between 0 and 25', () => {
    const field = { name: 'discount', type: 'number' };
    const val = generateMockValue(field, 0, 'orderLine');
    assert.equal(typeof val, 'number');
    assert.ok(val >= 0 && val <= 25, `discount ${val} should be between 0 and 25`);
  });

  it('generates quantity between 1 and 100', () => {
    const field = { name: 'quantity', type: 'number' };
    const val = generateMockValue(field, 0, 'orderLine');
    assert.equal(typeof val, 'number');
    assert.ok(val >= 1 && val <= 100);
  });

  it('generates lineNo as (index+1)*10', () => {
    const field = { name: 'lineNo', type: 'integer' };
    assert.equal(generateMockValue(field, 0, 'orderLine'), 10);
    assert.equal(generateMockValue(field, 1, 'orderLine'), 20);
    assert.equal(generateMockValue(field, 4, 'orderLine'), 50);
  });

  it('generates description phrases for description fields', () => {
    const field = { name: 'description', type: 'string' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'string');
    assert.ok(val.length > 0);
  });

  it('generates tax names for *tax* fields', () => {
    const field = { name: 'tax', type: 'string' };
    const val = generateMockValue(field, 0, 'orderLine');
    assert.equal(typeof val, 'string');
    assert.ok(val.length > 0);
  });

  it('defaults to "Sample {fieldName}" for unknown string fields', () => {
    const field = { name: 'unknownField', type: 'string' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(val, 'Sample unknownField');
  });

  it('generates random numbers for generic number type', () => {
    const field = { name: 'someValue', type: 'number' };
    const val = generateMockValue(field, 0, 'order');
    assert.equal(typeof val, 'number');
    assert.ok(val >= 1 && val <= 1000);
  });
});

// --- generateMockRecords tests ---

describe('generateMockRecords', () => {
  it('generates the requested number of records', () => {
    const records = generateMockRecords('order', sampleContract, 5);
    assert.equal(records.length, 5);
  });

  it('defaults to 12 records', () => {
    const records = generateMockRecords('order', sampleContract);
    assert.equal(records.length, 12);
  });

  it('each record has an id field', () => {
    const records = generateMockRecords('order', sampleContract, 3);
    for (const rec of records) {
      assert.ok(rec.id, 'record should have an id');
      assert.match(rec.id, /^mock-order-\d{3}$/);
    }
  });

  it('all ids are unique', () => {
    const records = generateMockRecords('order', sampleContract, 15);
    const ids = records.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, 'all IDs should be unique');
  });

  it('each record has all frontend fields', () => {
    const records = generateMockRecords('order', sampleContract, 1);
    const fieldNames = sampleContract.frontendContract.entities.order.fields.map(f => f.name);
    for (const name of fieldNames) {
      assert.ok(name in records[0], `record should have field "${name}"`);
    }
  });
});

// --- generateAllMockData tests ---

describe('generateAllMockData', () => {
  it('returns data for all entities', () => {
    const data = generateAllMockData(sampleContract, 5);
    assert.ok(data.order, 'should have order entity');
    assert.ok(data.orderLine, 'should have orderLine entity');
  });

  it('primary entity comes first in keys', () => {
    const data = generateAllMockData(sampleContract, 5);
    const keys = Object.keys(data);
    assert.equal(keys[0], 'order', 'primary entity should be first');
  });

  it('generates the requested count per entity', () => {
    const data = generateAllMockData(sampleContract, 10);
    assert.equal(data.order.length, 10);
    assert.equal(data.orderLine.length, 10);
  });

  it('child records reference parent IDs', () => {
    const data = generateAllMockData(sampleContract, 5);
    for (const line of data.orderLine) {
      assert.ok(line.orderId, 'orderLine should have orderId');
      const parentIds = data.order.map(o => o.id);
      assert.ok(parentIds.includes(line.orderId), `orderId "${line.orderId}" should reference a valid parent`);
    }
  });

  it('defaults to 12 records per entity', () => {
    const data = generateAllMockData(sampleContract);
    assert.equal(data.order.length, 12);
    assert.equal(data.orderLine.length, 12);
  });
});

// --- generateMockDataFile tests ---

describe('generateMockDataFile', () => {
  it('returns a valid ES module string', () => {
    const code = generateMockDataFile(sampleContract);
    assert.ok(code.includes('export const order'), 'should export order');
    assert.ok(code.includes('export const orderLine'), 'should export orderLine');
  });

  it('contains valid JSON arrays in exports', () => {
    const code = generateMockDataFile(sampleContract);
    // Extract the order array from the code
    const orderMatch = code.match(/export const order = (\[[\s\S]*?\]);/);
    assert.ok(orderMatch, 'should have order export with array');
    const parsed = JSON.parse(orderMatch[1]);
    assert.ok(Array.isArray(parsed), 'should be an array');
    assert.ok(parsed.length > 0, 'should have records');
  });
});
