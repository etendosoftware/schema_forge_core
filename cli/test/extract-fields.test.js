import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classifyField, inferDerivation, buildSchema, buildReference, parseValidationRule } from '../src/extract-fields.js';

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
    val_rule_name: null,
    val_rule_code: null,
    ad_reference_value_id: null,
    reference_name: 'String',
    callout_class: null,
    ref_table_target: null,
    ref_table_display: null,
    ref_table_key: null,
    ref_table_filter: null,
    ref_table_orderby: null,
    ref_search_target: null,
    ref_search_column: null,
    ref_selector_name: null,
    ref_selector_target: null,
    ref_selector_filter: null,
    ref_selector_hql: null,
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
    assert.equal(header.level, 'header');
    assert.equal(header.fields.length, 2);

    // Line entity
    const line = schema.entities[1];
    assert.equal(line.tableName, 'C_OrderLine');
    assert.equal(line.level, 'line');
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

  it('includes reference metadata for foreignKey fields', () => {
    const rows = [
      makeRow({
        columnname: 'C_Currency_ID',
        field_name: 'Currency',
        ad_reference_id: '19',
        reference_name: 'TableDir',
      }),
    ];

    const schema = buildSchema(rows, systemColumns, refMap);
    const field = schema.entities[0].fields.find(f => f.columnName === 'C_Currency_ID');
    assert.ok(field.reference, 'foreignKey field should have reference metadata');
    assert.equal(field.reference.targetTable, 'C_Currency');
    assert.equal(field.reference.type, 'TableDir');
  });
});

describe('buildReference', () => {
  it('builds TableDir reference from convention (column name minus _ID)', () => {
    const row = makeRow({
      columnname: 'C_Currency_ID',
      ad_reference_id: '19',
      reference_name: 'TableDir',
    });
    const ref = buildReference(row);
    assert.equal(ref.type, 'TableDir');
    assert.equal(ref.targetTable, 'C_Currency');
    assert.equal(ref.displayColumn, 'Name');
    assert.equal(ref.keyColumn, 'C_Currency_ID');
    assert.equal(ref.filterExpression, null);
  });

  it('builds Table reference from AD_Ref_Table config', () => {
    const row = makeRow({
      columnname: 'SalesRep_ID',
      ad_reference_id: '18',
      reference_name: 'Table',
      ref_table_target: 'AD_User',
      ref_table_key: 'AD_User_ID',
      ref_table_display: 'Name',
      ref_table_filter: "EXISTS (SELECT * FROM C_BPartner bp WHERE AD_User.C_BPartner_ID=bp.C_BPartner_ID AND bp.IsSalesRep='Y')",
    });
    const ref = buildReference(row);
    assert.equal(ref.type, 'Table');
    assert.equal(ref.targetTable, 'AD_User');
    assert.equal(ref.displayColumn, 'Name');
    assert.ok(ref.filterExpression.includes('IsSalesRep'));
  });

  it('builds Search reference from AD_Ref_Search config', () => {
    const row = makeRow({
      columnname: 'C_BPartner_ID',
      ad_reference_id: '30',
      reference_name: 'Search',
      ref_search_target: 'C_BPartner',
      ref_search_column: 'C_BPartner_ID',
    });
    const ref = buildReference(row);
    assert.equal(ref.type, 'Search');
    assert.equal(ref.targetTable, 'C_BPartner');
    assert.equal(ref.keyColumn, 'C_BPartner_ID');
  });

  it('builds Selector reference from OBUISEL_Selector config', () => {
    const row = makeRow({
      columnname: 'M_Warehouse_ID',
      ad_reference_id: '95E2A8B50A254B2AAE6774B8C2F28120',
      reference_name: 'OBUISEL_Selector Reference',
      ref_selector_target: 'M_Warehouse',
      ref_selector_name: 'On hand warehouse',
      ref_selector_filter: null,
    });
    const ref = buildReference(row);
    assert.equal(ref.type, 'Selector');
    assert.equal(ref.targetTable, 'M_Warehouse');
    assert.equal(ref.selectorName, 'On hand warehouse');
  });

  it('returns null for non-FK fields', () => {
    const row = makeRow({
      columnname: 'DocumentNo',
      ad_reference_id: '10',
      reference_name: 'String',
    });
    const ref = buildReference(row);
    assert.equal(ref, null);
  });
});

describe('parseValidationRule', () => {
  it('returns null for null input', () => {
    assert.equal(parseValidationRule(null), null);
  });

  it('returns null for undefined input', () => {
    assert.equal(parseValidationRule(undefined), null);
  });

  it('parses cascade params from @FIELD@ patterns', () => {
    const result = parseValidationRule(
      "C_BPartner_Location.C_BPartner_ID=@C_BPartner_ID@ AND C_BPartner_Location.IsShipTo='Y'"
    );
    assert.deepEqual(result.cascadeParams, ['C_BPartner_ID']);
    assert.deepEqual(result.contextParams, []);
  });

  it('parses context params from @#VAR@ patterns', () => {
    const result = parseValidationRule(
      "C_Charge.AD_Client_ID IN (@#User_Client@)"
    );
    assert.deepEqual(result.contextParams, ['User_Client']);
    assert.deepEqual(result.cascadeParams, []);
  });

  it('separates context and cascade params correctly', () => {
    const result = parseValidationRule(
      "C_DocType.AD_Client_ID=@#AD_Client_ID@ AND C_DocType.IsSOTrx='@IsSOTrx@' AND (AD_ISORGINCLUDED(@AD_Org_ID@,C_DocType.AD_Org_ID, @#AD_Client_ID@) <> '-1')"
    );
    assert.ok(result.contextParams.includes('AD_Client_ID'));
    assert.ok(result.cascadeParams.includes('IsSOTrx'));
    assert.ok(result.cascadeParams.includes('AD_Org_ID'));
    // AD_Client_ID should NOT be in cascadeParams (it's @#AD_Client_ID@)
    assert.ok(!result.cascadeParams.includes('AD_Client_ID'));
  });

  it('handles multiple cascade params', () => {
    const result = parseValidationRule(
      "AD_User.C_BPartner_ID=@DropShip_BPartner_ID@"
    );
    assert.deepEqual(result.cascadeParams, ['DropShip_BPartner_ID']);
    assert.deepEqual(result.contextParams, []);
  });

  it('preserves original code in result', () => {
    const code = "M_PriceList.issopricelist = @isSOTrx@";
    const result = parseValidationRule(code);
    assert.equal(result.code, code);
  });
});

describe('buildSchema validationRule', () => {
  it('includes validationRule with parsed params for fields with ad_val_rule', () => {
    const rows = [
      makeRow({
        columnname: 'C_BPartner_Location_ID',
        field_name: 'Partner Address',
        ad_reference_id: '19',
        reference_name: 'TableDir',
        val_rule_code: "C_BPartner_Location.C_BPartner_ID=@C_BPartner_ID@ AND C_BPartner_Location.IsShipTo='Y' AND C_BPartner_Location.IsActive='Y'",
      }),
    ];

    const schema = buildSchema(rows, systemColumns, refMap);
    const field = schema.entities[0].fields.find(f => f.columnName === 'C_BPartner_Location_ID');
    assert.ok(field.validationRule, 'field should have validationRule');
    assert.deepEqual(field.validationRule.cascadeParams, ['C_BPartner_ID']);
    assert.deepEqual(field.validationRule.contextParams, []);
    assert.ok(field.validationRule.code.includes('IsShipTo'));
  });
});
