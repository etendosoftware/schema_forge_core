import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classifyField, inferDerivation, buildSchema } from '../src/extract-fields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Load the real system-columns map for tests
const systemColumns = JSON.parse(
  await readFile(join(ROOT, 'core-maps', 'system-columns.json'), 'utf-8')
);
const refMap = JSON.parse(
  await readFile(join(ROOT, 'core-maps', 'ad-reference-map.json'), 'utf-8')
);

/**
 * Helper to create a minimal field row with defaults.
 */
function makeRow(overrides = {}) {
  return {
    ad_window_id: '100',
    window_name: 'Sales Order',
    ad_tab_id: '200',
    tab_name: 'Order',
    tablevel: 0,
    tab_seq: 10,
    tablename: 'C_Order',
    ad_field_id: '300',
    field_name: 'Test Field',
    isdisplayed: 'Y',
    isreadonly: 'N',
    displaylogic: null,
    readonlylogic: null,
    field_seq: 10,
    columnname: 'TestColumn',
    ad_reference_id: 10,
    ismandatory: 'N',
    isupdateable: 'Y',
    defaultvalue: null,
    fieldlength: 60,
    valuemin: null,
    valuemax: null,
    ad_val_rule_id: null,
    reference_name: 'String',
    callout_class: null,
    ...overrides,
  };
}

describe('classifyField', () => {
  it('classifies AD_Client_ID as system/internal with fromConfig derivation', () => {
    const row = makeRow({ columnname: 'AD_Client_ID' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'system');
    assert.equal(result.systemCategory, 'internal');
    assert.deepEqual(result.derivation, { type: 'fromConfig', source: 'context.client' });
  });

  it('classifies Created as system/audit', () => {
    const row = makeRow({ columnname: 'Created' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'system');
    assert.equal(result.systemCategory, 'audit');
  });

  it('classifies hidden field (isDisplayed=N) as system', () => {
    const row = makeRow({ columnname: 'SomeHiddenField', isdisplayed: 'N' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'system');
  });

  it('classifies read-only field as readOnly', () => {
    const row = makeRow({ columnname: 'SomeReadOnlyField', isreadonly: 'Y' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'readOnly');
  });

  it('classifies normal displayed field as editable', () => {
    const row = makeRow({ columnname: 'Description' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'editable');
  });

  it('classifies primary key (C_Order_ID on table C_Order) as system/internal with sequence', () => {
    const row = makeRow({ columnname: 'C_Order_ID', tablename: 'C_Order' });
    const result = classifyField(row, systemColumns);
    assert.equal(result.visibility, 'system');
    assert.equal(result.systemCategory, 'internal');
    assert.deepEqual(result.derivation, { type: 'sequence' });
  });
});

describe('inferDerivation', () => {
  it('parses @AD_Org_ID@ as fromConfig', () => {
    const result = inferDerivation('@AD_Org_ID@');
    assert.equal(result.type, 'fromConfig');
    assert.equal(result.source, 'context.adOrgId');
  });

  it('parses @SQL=SELECT... as lookup', () => {
    const sql = 'SELECT MAX(Line) FROM C_OrderLine WHERE C_Order_ID=@C_Order_ID@';
    const result = inferDerivation(`@SQL=${sql}`);
    assert.equal(result.type, 'lookup');
    assert.equal(result.source, sql);
  });

  it('returns null for null input', () => {
    const result = inferDerivation(null);
    assert.equal(result, null);
  });

  it('returns null for undefined input', () => {
    const result = inferDerivation(undefined);
    assert.equal(result, null);
  });

  it('parses plain value as computed', () => {
    const result = inferDerivation('0');
    assert.equal(result.type, 'computed');
    assert.equal(result.source, '0');
  });
});

describe('buildSchema', () => {
  it('produces correct window name, 2 entities, and header/line levels', () => {
    const rows = [
      // Header tab (level 0)
      makeRow({
        ad_tab_id: '200',
        tab_name: 'Order',
        tablevel: 0,
        tab_seq: 10,
        tablename: 'C_Order',
        columnname: 'DocumentNo',
        field_name: 'Document No.',
        ad_reference_id: 10,
      }),
      makeRow({
        ad_tab_id: '200',
        tab_name: 'Order',
        tablevel: 0,
        tab_seq: 10,
        tablename: 'C_Order',
        columnname: 'DateOrdered',
        field_name: 'Order Date',
        ad_reference_id: 15,
      }),
      // Line tab (level 1)
      makeRow({
        ad_tab_id: '201',
        tab_name: 'Order Line',
        tablevel: 1,
        tab_seq: 20,
        tablename: 'C_OrderLine',
        columnname: 'QtyOrdered',
        field_name: 'Ordered Quantity',
        ad_reference_id: 29,
        field_seq: 10,
      }),
      makeRow({
        ad_tab_id: '201',
        tab_name: 'Order Line',
        tablevel: 1,
        tab_seq: 20,
        tablename: 'C_OrderLine',
        columnname: 'LineNetAmt',
        field_name: 'Line Net Amount',
        ad_reference_id: 12,
        field_seq: 20,
      }),
    ];

    const schema = buildSchema(rows, systemColumns, refMap);

    // Window
    assert.equal(schema.window.name, 'Sales Order');
    assert.equal(schema.window.id, '100');

    // Two entities
    assert.equal(schema.entities.length, 2);

    // Header entity
    const header = schema.entities[0];
    assert.equal(header.tableName, 'C_Order');
    assert.equal(header.level, 0);
    assert.equal(header.fields.length, 2);

    // Line entity
    const line = schema.entities[1];
    assert.equal(line.tableName, 'C_OrderLine');
    assert.equal(line.level, 1);
    assert.equal(line.fields.length, 2);

    // Meta
    assert.ok(schema.meta.version);
    assert.ok(schema.meta.checksum);
    assert.ok(schema.meta.extractedAt);
  });

  it('maps AD_Reference_ID correctly (ref 12 -> amount, ref 29 -> quantity)', () => {
    const rows = [
      makeRow({
        columnname: 'GrandTotal',
        field_name: 'Grand Total',
        ad_reference_id: 12,
      }),
      makeRow({
        columnname: 'QtyOrdered',
        field_name: 'Ordered Qty',
        ad_reference_id: 29,
        field_seq: 20,
      }),
    ];

    const schema = buildSchema(rows, systemColumns, refMap);
    const fields = schema.entities[0].fields;

    const grandTotal = fields.find((f) => f.columnName === 'GrandTotal');
    assert.equal(grandTotal.type, 'amount');

    const qty = fields.find((f) => f.columnName === 'QtyOrdered');
    assert.equal(qty.type, 'quantity');
  });

  it('returns empty schema for empty rows', () => {
    const schema = buildSchema([], systemColumns, refMap);
    assert.equal(schema.window, null);
    assert.deepEqual(schema.entities, []);
  });
});
