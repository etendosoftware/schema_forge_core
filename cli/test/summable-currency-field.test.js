import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateFrontendContract } from '../src/generate-contract.js';
import { generateTableComponent } from '../src/generate-frontend.js';

/**
 * ETP-5245 — `summable` (tri-state) and `currencyField` (per-row currency source)
 * must survive the whole pipeline: decisions.json → resolve-curated → contract →
 * generated grid column.
 *
 * `summable` existed end to end before this ticket but was DEAD: every layer
 * dropped it unless it was `true`, so the only value a window could express was
 * the one that was already the default. The regression these tests guard is the
 * opposite direction — an `amount` column that declares nothing must keep
 * emitting NO `summable` key, because DataTable reads "absent" as "sums" and 99
 * existing amount columns across 28 windows depend on that.
 */

function buildSchemaRaw(fieldExtras = {}) {
  return {
    window: { id: '140', name: 'Product' },
    entities: [{
      name: 'costing',
      tableName: 'M_Costing',
      fields: [
        { name: 'cost', columnName: 'Cost', label: 'Cost', type: 'decimal', visibility: 'editable', ...fieldExtras },
        { name: 'total', columnName: 'Total', label: 'Total', type: 'decimal', visibility: 'editable' },
      ],
    }],
  };
}

function buildSchema(fieldExtras = {}) {
  return {
    version: '0.1.0',
    window: { id: '140', name: 'Product', primaryEntity: 'costing', category: 'inventory' },
    entities: [{
      name: 'costing',
      table: 'M_Costing',
      level: 'header',
      fields: [
        {
          name: 'cost', column: 'Cost', type: 'amount', visibility: 'editable',
          required: false, searchable: false, grid: true, form: true, ...fieldExtras,
        },
        {
          name: 'total', column: 'Total', type: 'amount', visibility: 'editable',
          required: false, searchable: false, grid: true, form: true,
        },
      ],
    }],
  };
}

function buildContract(fieldExtras = {}) {
  return {
    frontendContract: {
      entities: {
        costing: {
          fields: [
            {
              name: 'cost', column: 'Cost', label: 'Cost', type: 'amount',
              visibility: 'editable', grid: true, form: true, ...fieldExtras,
            },
            {
              name: 'total', column: 'Total', label: 'Total', type: 'amount',
              visibility: 'editable', grid: true, form: true,
            },
          ],
        },
      },
    },
  };
}

describe('resolveCurated — summable tri-state / currencyField (ETP-5245)', () => {
  it('carries an explicit summable:false onto the curated field', async () => {
    const decisions = { entities: { costing: { fields: { cost: { summable: false } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'cost');
    assert.equal(field.summable, false);
  });

  it('still carries summable:true (the pre-existing opt-in)', async () => {
    const decisions = { entities: { costing: { fields: { cost: { summable: true } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'cost');
    assert.equal(field.summable, true);
  });

  it('leaves summable undefined when the decision does not declare it', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'cost');
    assert.equal(field.summable, undefined);
    assert.equal(Object.hasOwn(field, 'summable'), false);
  });

  it('copies currencyField through onto the curated field', async () => {
    const decisions = { entities: { costing: { fields: { cost: { currencyField: 'cCurrencyID' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'cost');
    assert.equal(field.currencyField, 'cCurrencyID');
  });

  it('omits currencyField entirely when not declared', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'cost');
    assert.equal(field.currencyField, undefined);
  });
});

describe('generateFrontendContract — summable tri-state / currencyField (ETP-5245)', () => {
  it('emits summable:false on the contract field', () => {
    const fc = generateFrontendContract(buildSchema({ summable: false }));
    const field = fc.entities.costing.fields.find(f => f.name === 'cost');
    assert.equal(field.summable, false);
    assert.equal(Object.hasOwn(field, 'summable'), true);
  });

  it('emits summable:true on the contract field', () => {
    const fc = generateFrontendContract(buildSchema({ summable: true }));
    const field = fc.entities.costing.fields.find(f => f.name === 'cost');
    assert.equal(field.summable, true);
  });

  it('omits summable when the curated field does not declare it', () => {
    const fc = generateFrontendContract(buildSchema());
    const field = fc.entities.costing.fields.find(f => f.name === 'cost');
    assert.equal(Object.hasOwn(field, 'summable'), false);
  });

  it('copies currencyField onto the contract field, and omits it otherwise', () => {
    const withField = generateFrontendContract(buildSchema({ currencyField: 'cCurrencyID' }));
    assert.equal(withField.entities.costing.fields.find(f => f.name === 'cost').currencyField, 'cCurrencyID');
    const without = generateFrontendContract(buildSchema());
    assert.equal(without.entities.costing.fields.find(f => f.name === 'cost').currencyField, undefined);
  });
});

describe('generateTableComponent — summable tri-state / currencyField (ETP-5245)', () => {
  it('emits summable: false on the grid column', () => {
    const src = generateTableComponent('costing', buildContract({ summable: false }));
    assert.match(src, /key: 'cost'.*summable: false/);
  });

  it('emits summable: true on the grid column', () => {
    const src = generateTableComponent('costing', buildContract({ summable: true }));
    assert.match(src, /key: 'cost'.*summable: true/);
  });

  it('emits NO summable key when the field does not declare it (regression guard: absent still sums)', () => {
    const src = generateTableComponent('costing', buildContract());
    assert.doesNotMatch(src, /summable/);
  });

  it('emits currencyField on the grid column when declared, and nothing otherwise', () => {
    const src = generateTableComponent('costing', buildContract({ currencyField: 'cCurrencyID' }));
    assert.match(src, /key: 'cost'.*currencyField: 'cCurrencyID'/);
    assert.doesNotMatch(generateTableComponent('costing', buildContract()), /currencyField/);
  });

  it('leaves sibling amount columns untouched', () => {
    const src = generateTableComponent('costing', buildContract({ summable: false, currencyField: 'cCurrencyID' }));
    const totalLine = src.split('\n').find(l => l.includes("key: 'total'"));
    assert.doesNotMatch(totalLine, /summable|currencyField/);
  });
});
