// EPL-1807 / ETP-4603 follow-up — computed-column freshness indicator.
// Covers the three pipeline layers that carry the computed-column signal:
//   1. Extractor  — extract-fields.js applyComputationHints (via buildSchema)
//   2. Generator  — generate-contract.js mapRefresh / applyComputedHint
//                   (via generateFrontendContract)
//   3. Resolver   — resolve-curated.js pass-through of raw computed props and
//                   the optional `computedHint` decision override
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSchema } from '../src/extract-fields.js';
import { generateFrontendContract } from '../src/generate-contract.js';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateTableComponent } from '../src/generate-frontend.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const systemColumns = JSON.parse(
  await readFile(join(ROOT, 'core-maps', 'system-columns.json'), 'utf-8')
);
const refMap = JSON.parse(
  await readFile(join(ROOT, 'core-maps', 'ad-reference-map.json'), 'utf-8')
);

// Minimal DB row mirroring extract-fields-helpers.test.js makeRow(), plus the
// three EPL-1807 computed-column attributes the extractor now reads.
function makeRow(overrides = {}) {
  return {
    ad_window_id: '100',
    window_name: 'Product',
    ad_tab_id: '200',
    tab_name: 'Product',
    tablevel: 0,
    tab_seq: 10,
    tablename: 'M_Product',
    entity_classname: null,
    entity_alias: null,
    entity_javapackage: null,
    ad_field_id: '300',
    field_name: 'Stock',
    field_isactive: 'Y',
    isdisplayed: 'Y',
    isreadonly: 'N',
    isshowninstatusbar: 'N',
    displaylogic: null,
    displaylogic_server: null,
    displaylogicgrid: null,
    readonlylogic: null,
    field_seq: 10,
    columnname: 'eTGOStock',
    obdal_name: 'eTGOStock',
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
    onchangefunction: null,
    isidentifier: 'N',
    isselectioncolumn: 'N',
    isfilterable: 'N',
    precision: null,
    istranslated: 'N',
    help_text: null,
    field_group_name: null,
    ui_pattern: null,
    whereclause: null,
    orderbyclause: null,
    filterclause: null,
    hqlwhereclause: null,
    hqlorderbyclause: null,
    hqlfiltclause: null,
    column_module_id: null,
    table_module_id: null,
    ad_process_id: null,
    em_obuiapp_process_id: null,
    iskey: 'N',
    // EPL-1807 computed-column attributes (default: not computed)
    computation_mode: null,
    refresh_mode: null,
    computation_function: null,
    ...overrides,
  };
}

function fieldFromRow(overrides) {
  const schema = buildSchema([makeRow(overrides)], systemColumns, refMap);
  return schema.entities[0].fields.find((f) => f.columnName === (overrides.columnname || 'eTGOStock'));
}

// ---------------------------------------------------------------------------
// 1. Extractor — applyComputationHints (exercised through buildSchema)
// ---------------------------------------------------------------------------

describe('extract-fields — computed-column hints (applyComputationHints)', () => {
  it('sets all three raw props for a stored-computed, queued column', () => {
    const field = fieldFromRow({
      computation_mode: 'S',
      refresh_mode: 'Q',
      computation_function: 'etgo_product_stock',
    });
    assert.equal(field.computedMode, 'S');
    assert.equal(field.refreshMode, 'Q');
    assert.equal(field.computationFunction, 'etgo_product_stock');
  });

  it('omits all three props when computation_mode is N', () => {
    const field = fieldFromRow({
      computation_mode: 'N',
      refresh_mode: 'Q',
      computation_function: 'etgo_product_stock',
    });
    assert.ok(!('computedMode' in field), 'computedMode must be absent');
    assert.ok(!('refreshMode' in field), 'refreshMode must be absent');
    assert.ok(!('computationFunction' in field), 'computationFunction must be absent');
  });

  it('omits all three props when computation_mode is null', () => {
    const field = fieldFromRow({
      computation_mode: null,
      refresh_mode: null,
      computation_function: null,
    });
    assert.ok(!('computedMode' in field));
    assert.ok(!('refreshMode' in field));
    assert.ok(!('computationFunction' in field));
  });

  it('carries the mode for a virtual (V) column (any non-N mode is carried)', () => {
    const field = fieldFromRow({
      computation_mode: 'V',
      refresh_mode: 'S',
      computation_function: 'etgo_virtual_expr',
    });
    assert.equal(field.computedMode, 'V');
    assert.equal(field.refreshMode, 'S');
    assert.equal(field.computationFunction, 'etgo_virtual_expr');
  });

  it('sets only computedMode when refresh_mode / computation_function are absent', () => {
    const field = fieldFromRow({
      computation_mode: 'S',
      refresh_mode: null,
      computation_function: null,
    });
    assert.equal(field.computedMode, 'S');
    assert.ok(!('refreshMode' in field));
    assert.ok(!('computationFunction' in field));
  });
});

// ---------------------------------------------------------------------------
// 2. Generator — mapRefresh + applyComputedHint (via generateFrontendContract)
// ---------------------------------------------------------------------------

function schemaWithField(fieldOverrides) {
  return {
    version: '0.1.0',
    window: { id: 'W1', name: 'Product', primaryEntity: 'header', category: 'master' },
    entities: [{
      name: 'header',
      table: 'M_Product',
      level: 'header',
      fields: [{
        name: 'etgoStock',
        apiKey: 'etgoStock',
        column: 'eTGOStock',
        label: 'Stock',
        type: 'quantity',
        visibility: 'readOnly',
        required: false,
        grid: true,
        form: true,
        ...fieldOverrides,
      }],
    }],
  };
}

function computedOf(fieldOverrides) {
  const fc = generateFrontendContract(schemaWithField(fieldOverrides));
  const field = fc.entities.header.fields.find((f) => f.name === 'etgoStock');
  return { field, computed: field.computed };
}

describe('generate-contract — mapRefresh (refresh wording key)', () => {
  // mapRefresh is not exported; exercised through applyComputedHint by driving
  // a stored field with each refreshMode.
  it('maps Q -> queued', () => {
    assert.deepEqual(computedOf({ computedMode: 'S', refreshMode: 'Q' }).computed,
      { mode: 'stored', refresh: 'queued' });
  });

  it('maps S -> synchronous', () => {
    assert.deepEqual(computedOf({ computedMode: 'S', refreshMode: 'S' }).computed,
      { mode: 'stored', refresh: 'synchronous' });
  });

  it('maps M -> manual', () => {
    assert.deepEqual(computedOf({ computedMode: 'S', refreshMode: 'M' }).computed,
      { mode: 'stored', refresh: 'manual' });
  });

  it('falls back to queued for an absent/unknown refreshMode', () => {
    assert.equal(computedOf({ computedMode: 'S' }).computed.refresh, 'queued');
    assert.equal(computedOf({ computedMode: 'S', refreshMode: 'X' }).computed.refresh, 'queued');
  });
});

describe('generate-contract — applyComputedHint (freshness hint emission)', () => {
  it('emits computed:{mode:stored,refresh:queued} for a stored/queued field', () => {
    assert.deepEqual(computedOf({ computedMode: 'S', refreshMode: 'Q' }).computed,
      { mode: 'stored', refresh: 'queued' });
  });

  it('does NOT emit computed for a virtual (V) field', () => {
    assert.equal(computedOf({ computedMode: 'V', refreshMode: 'S' }).computed, undefined);
  });

  it('does NOT emit computed for a non-computed (N / absent) field', () => {
    assert.equal(computedOf({ computedMode: 'N' }).computed, undefined);
    assert.equal(computedOf({}).computed, undefined);
  });

  it('suppresses computed when decision computedHint === false on a stored field', () => {
    assert.equal(computedOf({ computedMode: 'S', refreshMode: 'Q', computedHint: false }).computed,
      undefined);
  });

  it('force-emits computed when decision computedHint === true on a non-stored field', () => {
    assert.deepEqual(computedOf({ computedMode: 'N', computedHint: true }).computed,
      { mode: 'stored', refresh: 'queued' });
  });

  it('force-emits computed with mapped refresh when computedHint === true and refreshMode present', () => {
    assert.deepEqual(computedOf({ computedHint: true, refreshMode: 'M' }).computed,
      { mode: 'stored', refresh: 'manual' });
  });
});

// ---------------------------------------------------------------------------
// 3. Resolver — pass-through of raw computed props + computedHint override
// ---------------------------------------------------------------------------

describe('resolve-curated — computed-column pass-through', () => {
  const rawSchema = (fieldRaw) => ({
    window: { id: 'W1', name: 'Product' },
    entities: [{
      name: 'header',
      tableName: 'M_Product',
      tabId: 'T1',
      tabName: 'Product',
      fields: [{
        name: 'etgoStock',
        columnName: 'eTGOStock',
        label: 'Stock',
        type: 'quantity',
        visibility: 'readOnly',
        ...fieldRaw,
      }],
    }],
  });
  const minimalRules = { rules: [] };
  const decisionsWith = (fieldDecision) => ({
    _version: 3,
    entities: fieldDecision
      ? { header: { fields: { etgoStock: fieldDecision } } }
      : {},
    rules: {},
    window: {},
  });

  async function resolvedField(fieldRaw, fieldDecision) {
    const result = await resolveCurated(rawSchema(fieldRaw), minimalRules, decisionsWith(fieldDecision));
    return result.schema.entities[0].fields.find((f) => f.name === 'etgoStock');
  }

  it('passes raw computedMode / refreshMode / computationFunction through unchanged', async () => {
    const field = await resolvedField({
      computedMode: 'S',
      refreshMode: 'Q',
      computationFunction: 'etgo_product_stock',
    });
    assert.equal(field.computedMode, 'S');
    assert.equal(field.refreshMode, 'Q');
    assert.equal(field.computationFunction, 'etgo_product_stock');
  });

  it('does not invent computed props for a non-computed raw field', async () => {
    const field = await resolvedField({});
    assert.ok(!('computedMode' in field));
    assert.ok(!('refreshMode' in field));
    assert.ok(!('computationFunction' in field));
  });

  it('preserves computedHint === false override (survives truthy filtering)', async () => {
    const field = await resolvedField(
      { computedMode: 'S', refreshMode: 'Q' },
      { computedHint: false }
    );
    assert.equal(field.computedHint, false);
  });

  it('preserves computedHint === true override', async () => {
    const field = await resolvedField(
      {},
      { computedHint: true }
    );
    assert.equal(field.computedHint, true);
  });

  it('omits computedHint entirely when the decision does not set it', async () => {
    const field = await resolvedField({ computedMode: 'S', refreshMode: 'Q' });
    assert.ok(!('computedHint' in field), 'computedHint must be absent when not declared');
  });

  it('end-to-end: raw stored field + computedHint:false -> contract has no computed key', async () => {
    const result = await resolveCurated(
      rawSchema({ computedMode: 'S', refreshMode: 'Q', computationFunction: 'etgo_product_stock' }),
      minimalRules,
      decisionsWith({ computedHint: false })
    );
    const fc = generateFrontendContract(result.schema);
    const field = fc.entities.header.fields.find((f) => f.name === 'etgoStock');
    assert.equal(field.computed, undefined);
  });

  it('end-to-end: raw stored field (no override) -> contract emits computed:{stored,queued}', async () => {
    const result = await resolveCurated(
      rawSchema({ computedMode: 'S', refreshMode: 'Q', computationFunction: 'etgo_product_stock' }),
      minimalRules,
      decisionsWith(null)
    );
    const fc = generateFrontendContract(result.schema);
    const field = fc.entities.header.fields.find((f) => f.name === 'etgoStock');
    assert.deepEqual(field.computed, { mode: 'stored', refresh: 'queued' });
  });
});

// ---------------------------------------------------------------------------
// 4. Frontend generator — generateTableComponent carries `computed` onto the
//    grid column so DataTable renders the freshness clock in the list header.
// ---------------------------------------------------------------------------
function tableContract(fieldOverrides) {
  return {
    frontendContract: {
      entities: {
        header: {
          searchableFields: [],
          fields: [
            {
              name: 'stock',
              column: 'EM_ETGO_Stock',
              type: 'number',
              grid: true,
              visibility: 'readOnly',
              ...fieldOverrides,
            },
          ],
        },
      },
    },
  };
}

describe('generate-frontend — generateTableComponent (computed column adornment)', () => {
  it('emits computed:{mode:stored,refresh:queued} onto a stored/queued grid column', () => {
    const code = generateTableComponent('header', tableContract({ computed: { mode: 'stored', refresh: 'queued' } }));
    assert.match(code, /key: 'stock'[^}]*computed: \{"mode":"stored","refresh":"queued"\}/);
  });

  it('emits computed with synchronous refresh when the field carries it', () => {
    const code = generateTableComponent('header', tableContract({ computed: { mode: 'stored', refresh: 'synchronous' } }));
    assert.match(code, /key: 'stock'[^}]*computed: \{"mode":"stored","refresh":"synchronous"\}/);
  });

  it('does NOT emit computed for a plain (non-computed) grid column', () => {
    const code = generateTableComponent('header', tableContract({}));
    assert.match(code, /key: 'stock'/);
    assert.doesNotMatch(code, /key: 'stock'[^}]*computed:/);
  });

  it('does NOT emit computed for a virtual column (mode !== stored)', () => {
    const code = generateTableComponent('header', tableContract({ computed: { mode: 'virtual' } }));
    assert.doesNotMatch(code, /key: 'stock'[^}]*computed:/);
  });
});
