/**
 * ETP-5323 — DB-sourced `maxLength` passthrough (AD_Column.FieldLength, surfaced on
 * the contract as `field.validation.maxLength`) onto generated grid columns
 * (generateTableComponent → `maxLengthColPart`) and form fields
 * (generateFormComponent → `buildFormMaxLengthPart`).
 *
 * The gating is the point of this fix: AD_Column.FieldLength exists for EVERY
 * column type (it's a storage-precision hint, not "chars typed"), so a numeric,
 * selector, date or amount field must NEVER receive an HTML `maxLength` — only
 * plain text columns (`type === 'string'` in the grid, `type === 'text' |
 * 'textarea'` in the form) may.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateTableComponent, generateFormComponent } from '../src/generate-frontend.js';

function buildContract(fields) {
  return {
    frontendContract: {
      window: { id: '1', name: 'Test Window', primaryEntity: 'line', category: 'test' },
      entities: {
        line: {
          fields,
          searchableFields: [],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

// ---------------------------------------------------------------------------
// generateTableComponent (grid columns)
// ---------------------------------------------------------------------------

describe('generateTableComponent - maxLength passthrough (ETP-5323)', () => {
  it('emits maxLength on a plain string grid column when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'description', column: 'Description', type: 'string', tsType: 'string',
        visibility: 'editable', grid: true, form: true,
        validation: { maxLength: 2000 },
      },
    ]);
    const code = generateTableComponent('line', contract);
    assert.match(code, /key: 'description'[^}]*maxLength: 2000/);
  });

  it('does not emit maxLength on a string column when validation.maxLength is absent (backwards-compatible)', () => {
    const contract = buildContract([
      {
        name: 'description', column: 'Description', type: 'string', tsType: 'string',
        visibility: 'editable', grid: true, form: true,
      },
    ]);
    const code = generateTableComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'description'"));
    assert.ok(line, 'description column line should exist');
    assert.ok(!line.includes('maxLength:'), 'column without validation.maxLength must not gain one');
  });

  it('does NOT emit maxLength on a numeric (integer) column even when validation.maxLength is set', () => {
    // Regression the developer caught in review: AD_Column.FieldLength is populated
    // for every column type, including numeric precision — never an HTML character
    // cap on a number input.
    const contract = buildContract([
      {
        name: 'quantity', column: 'Quantity', type: 'integer', tsType: 'number',
        visibility: 'editable', grid: true, form: true,
        validation: { maxLength: 5 },
      },
    ]);
    const code = generateTableComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'quantity'"));
    assert.ok(line, 'quantity column line should exist');
    assert.ok(!line.includes('maxLength:'), 'numeric column must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength on an amount column even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'grossUnitPrice', column: 'GrossUnitPrice', type: 'amount', tsType: 'number',
        visibility: 'editable', grid: true, form: true,
        validation: { maxLength: 12 },
      },
    ]);
    const code = generateTableComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'grossUnitPrice'"));
    assert.ok(line, 'grossUnitPrice column line should exist');
    assert.ok(!line.includes('maxLength:'), 'amount column must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength on a foreignKey (selector) column even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'product', column: 'M_Product_ID', type: 'foreignKey', tsType: 'string',
        visibility: 'editable', grid: true, form: true, reference: 'Product',
        validation: { maxLength: 32 },
      },
    ]);
    const code = generateTableComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'product'"));
    assert.ok(line, 'product column line should exist');
    assert.ok(!line.includes('maxLength:'), 'selector column must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength on a date column even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'movementDate', column: 'MovementDate', type: 'date', tsType: 'string',
        visibility: 'editable', grid: true, form: true,
        validation: { maxLength: 10 },
      },
    ]);
    const code = generateTableComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'movementDate'"));
    assert.ok(line, 'movementDate column line should exist');
    assert.ok(!line.includes('maxLength:'), 'date column must never gain an HTML maxLength');
  });
});

// ---------------------------------------------------------------------------
// generateFormComponent (form fields)
// ---------------------------------------------------------------------------

describe('generateFormComponent - maxLength passthrough (ETP-5323)', () => {
  it("emits maxLength for a plain text field ('name'-shaped, maps to type: 'text')", () => {
    const contract = buildContract([
      {
        name: 'name', column: 'Name', type: 'string', tsType: 'string',
        visibility: 'editable', form: true,
        validation: { maxLength: 60 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    assert.match(code, /key: 'name'[^}]*type: 'text'[^}]*maxLength: 60/);
  });

  it("emits maxLength for a textarea field ('description'-shaped, maps to type: 'textarea')", () => {
    const contract = buildContract([
      {
        name: 'description', column: 'Description', type: 'string', tsType: 'string',
        visibility: 'editable', form: true,
        validation: { maxLength: 2000 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    assert.match(code, /key: 'description'[^}]*type: 'textarea'[^}]*maxLength: 2000/);
  });

  it('does not emit maxLength for a text field when validation.maxLength is absent (backwards-compatible)', () => {
    const contract = buildContract([
      {
        name: 'name', column: 'Name', type: 'string', tsType: 'string',
        visibility: 'editable', form: true,
      },
    ]);
    const code = generateFormComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'name'"));
    assert.ok(line, 'name field line should exist');
    assert.ok(!line.includes('maxLength:'), 'field without validation.maxLength must not gain one');
  });

  it('does NOT emit maxLength for a numeric field even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'quantity', column: 'Quantity', type: 'integer', tsType: 'number',
        visibility: 'editable', form: true,
        validation: { maxLength: 5 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'quantity'"));
    assert.ok(line, 'quantity field line should exist');
    assert.ok(!line.includes('maxLength:'), 'numeric form field must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength for a date field even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'movementDate', column: 'MovementDate', type: 'date', tsType: 'string',
        visibility: 'editable', form: true,
        validation: { maxLength: 10 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'movementDate'"));
    assert.ok(line, 'movementDate field line should exist');
    assert.ok(!line.includes('maxLength:'), 'date form field must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength for a foreignKey (search/selector) field even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'businessPartner', column: 'C_BPartner_ID', type: 'foreignKey', tsType: 'string',
        visibility: 'editable', form: true, reference: 'BusinessPartner', inputMode: 'search',
        validation: { maxLength: 32 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'businessPartner'"));
    assert.ok(line, 'businessPartner field line should exist');
    assert.ok(!line.includes('maxLength:'), 'foreignKey form field must never gain an HTML maxLength');
  });

  it('does NOT emit maxLength for a select (enum) field even when validation.maxLength is set', () => {
    const contract = buildContract([
      {
        name: 'status', column: 'Status', type: 'string', tsType: 'string',
        visibility: 'editable', form: true,
        enumValues: [{ value: 'A', name: 'Active' }, { value: 'I', name: 'Inactive' }],
        validation: { maxLength: 1 },
      },
    ]);
    const code = generateFormComponent('line', contract);
    const line = code.split('\n').find(l => l.includes("key: 'status'"));
    assert.ok(line, 'status field line should exist');
    assert.ok(!line.includes('maxLength:'), 'select form field must never gain an HTML maxLength');
  });
});
