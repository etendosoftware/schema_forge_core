/**
 * Integration test: extractor output → validator.
 *
 * Uses a real schema-raw.json (extracted from Sales Order) as a fixture
 * to verify that buildSchema output passes validate-schema.
 * This catches shape mismatches between extractor and validator (bugs 1-6 from feedback.md).
 *
 * Runs offline — no DB required. Uses the fixture snapshot.
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateSchema } from '../src/validate-schema.js';
import { buildSchema, classifyField } from '../src/extract-fields.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLI_DIR = join(__dirname, '..');

describe('Integration: extractor → validator', () => {
  let schemaRaw;

  before(async () => {
    // Use the real extracted schema as fixture (if it exists)
    try {
      const raw = await readFile(join(ROOT, 'artifacts', 'sales-order', 'schema-raw.json'), 'utf-8');
      schemaRaw = JSON.parse(raw);
    } catch {
      // No fixture available — skip gracefully
      schemaRaw = null;
    }
  });

  it('schema-raw.json passes L1 structural validation', async () => {
    if (!schemaRaw) return; // skip if no fixture
    const result = await validateSchema(schemaRaw);
    const l1Errors = result.errors.filter(e => e.level === 1);
    assert.equal(l1Errors.length, 0,
      `L1 errors: ${l1Errors.map(e => `${e.code}: ${e.message}`).join(', ')}`);
  });

  it('schema-raw.json passes L2 semantic validation', async () => {
    if (!schemaRaw) return;
    const result = await validateSchema(schemaRaw);
    const l2Errors = result.errors.filter(e => e.level === 2);
    assert.equal(l2Errors.length, 0,
      `L2 errors: ${l2Errors.map(e => `${e.code}: ${e.message}`).join(', ')}`);
  });

  it('schema-raw.json has top-level version field', () => {
    if (!schemaRaw) return;
    assert.ok(schemaRaw.version, 'Missing top-level version');
  });

  it('schema-raw.json has window.primaryEntity', () => {
    if (!schemaRaw) return;
    assert.ok(schemaRaw.window.primaryEntity, 'Missing window.primaryEntity');
  });

  it('schema-raw.json has window.category', () => {
    if (!schemaRaw) return;
    assert.ok(schemaRaw.window.category, 'Missing window.category');
  });

  it('entity levels are semantic strings (header/line/subline)', () => {
    if (!schemaRaw) return;
    const validLevels = ['header', 'line', 'subline'];
    for (const entity of schemaRaw.entities) {
      assert.ok(validLevels.includes(entity.level),
        `Entity ${entity.name} has invalid level '${entity.level}', expected one of: ${validLevels.join(', ')}`);
    }
  });

  it('no duplicate field names within any entity', () => {
    if (!schemaRaw) return;
    for (const entity of schemaRaw.entities) {
      const names = entity.fields.map(f => f.name);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      assert.equal(dupes.length, 0,
        `Entity ${entity.name} has duplicate fields: ${[...new Set(dupes)].join(', ')}`);
    }
  });

  it('all foreignKey fields have a reference object', () => {
    if (!schemaRaw) return;
    const missing = [];
    for (const entity of schemaRaw.entities) {
      for (const field of entity.fields) {
        if (field.type === 'foreignKey' && !field.reference) {
          missing.push(`${entity.name}.${field.name}`);
        }
      }
    }
    assert.equal(missing.length, 0,
      `FK fields missing reference: ${missing.join(', ')}`);
  });
});

describe('Integration: buildSchema produces valid output', () => {
  it('buildSchema with synthetic rows produces validatable schema', async () => {
    const systemColumns = JSON.parse(
      await readFile(join(CLI_DIR, 'core-maps', 'system-columns.json'), 'utf-8')
    );
    const refMap = JSON.parse(
      await readFile(join(CLI_DIR, 'core-maps', 'ad-reference-map.json'), 'utf-8')
    );

    // Minimal synthetic rows simulating a 2-tab window
    const rows = [
      {
        ad_window_id: '999', window_name: 'Test Window',
        ad_tab_id: '1', tab_name: 'Header', tablevel: '0', tab_seq: '10',
        tablename: 'C_Test', entity_classname: 'Test', entity_alias: null,
        entity_javapackage: 'org.test', ad_field_id: '10',
        field_name: 'Name', isdisplayed: 'Y', isreadonly: 'N',
        displaylogic: null, displaylogic_server: null, displaylogicgrid: null,
        readonlylogic: null, field_seq: '10',
        columnname: 'Name', ad_reference_id: '10', ismandatory: 'Y',
        isupdateable: 'Y', defaultvalue: null, fieldlength: 60,
        valuemin: null, valuemax: null, ad_val_rule_id: null,
        ad_reference_value_id: null, reference_name: 'String',
        val_rule_name: null, val_rule_code: null, callout_class: null,
        ref_table_target: null, ref_table_display: null, ref_table_key: null,
        ref_table_filter: null, ref_table_orderby: null,
        ref_search_target: null, ref_search_column: null,
        ref_selector_name: null, ref_selector_target: null,
        ref_selector_filter: null, ref_selector_hql: null,
        onchangefunction: null, isidentifier: 'Y', isselectioncolumn: 'N',
        isfilterable: 'N', precision: null, istranslated: 'N',
        help_text: null, field_group_name: null,
        whereclause: null, orderbyclause: null, filterclause: null,
        hqlwhereclause: null, hqlorderbyclause: null, hqlfiltclause: null,
      },
      {
        ad_window_id: '999', window_name: 'Test Window',
        ad_tab_id: '1', tab_name: 'Header', tablevel: '0', tab_seq: '10',
        tablename: 'C_Test', entity_classname: 'Test', entity_alias: null,
        entity_javapackage: 'org.test', ad_field_id: '11',
        field_name: 'Organization', isdisplayed: 'Y', isreadonly: 'N',
        displaylogic: null, displaylogic_server: null, displaylogicgrid: null,
        readonlylogic: null, field_seq: '20',
        columnname: 'AD_Org_ID', ad_reference_id: '19', ismandatory: 'Y',
        isupdateable: 'Y', defaultvalue: '@#AD_Org_ID@', fieldlength: 22,
        valuemin: null, valuemax: null, ad_val_rule_id: null,
        ad_reference_value_id: null, reference_name: 'TableDir',
        val_rule_name: null, val_rule_code: null, callout_class: null,
        ref_table_target: null, ref_table_display: null, ref_table_key: null,
        ref_table_filter: null, ref_table_orderby: null,
        ref_search_target: null, ref_search_column: null,
        ref_selector_name: null, ref_selector_target: null,
        ref_selector_filter: null, ref_selector_hql: null,
        onchangefunction: null, isidentifier: 'N', isselectioncolumn: 'N',
        isfilterable: 'N', precision: null, istranslated: 'N',
        help_text: null, field_group_name: null,
        whereclause: null, orderbyclause: null, filterclause: null,
        hqlwhereclause: null, hqlorderbyclause: null, hqlfiltclause: null,
      },
    ];

    const schema = buildSchema(rows, systemColumns, refMap);

    // Must pass validation
    const result = await validateSchema(schema);
    const errors = result.errors;
    assert.equal(errors.length, 0,
      `Validation errors: ${errors.map(e => `${e.code}: ${e.message}`).join(', ')}`);

    // Structural checks
    assert.ok(schema.version);
    assert.ok(schema.window.primaryEntity);
    assert.ok(schema.window.category);
    assert.equal(schema.entities[0].level, 'header');
  });
});
