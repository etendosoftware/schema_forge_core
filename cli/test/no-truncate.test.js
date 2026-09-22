import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateFrontendContract } from '../src/generate-contract.js';
import { generateTableComponent } from '../src/generate-frontend.js';

/**
 * ETP-5281 — `noTruncate` opts a grid cell out of the default ellipsis/truncate
 * behavior (the value renders in full and scrolls horizontally within its own
 * cell instead of being clipped with a hover tooltip). Read directly off the
 * column object by InlineLinesPanel's renderLineCell/ReadCell/LookupTrigger in
 * the functional repo (tools/app-shell).
 *
 * Must survive the whole pipeline: decisions.json → resolve-curated → contract
 * → generated grid column, and must stay byte-identical (no `noTruncate` key
 * at all) for every field/window that does not declare it.
 */

function buildSchemaRaw(fieldExtras = {}) {
  return {
    window: { id: '140', name: 'PurchaseInvoice' },
    entities: [{
      name: 'lines',
      tableName: 'C_Invoiceline',
      fields: [
        { name: 'product', columnName: 'M_Product_ID', label: 'Product', type: 'string', visibility: 'editable', ...fieldExtras },
        { name: 'description', columnName: 'Description', label: 'Description', type: 'string', visibility: 'editable' },
      ],
    }],
  };
}

function buildSchema(fieldExtras = {}) {
  return {
    version: '0.1.0',
    window: { id: '140', name: 'PurchaseInvoice', primaryEntity: 'lines', category: 'purchases' },
    entities: [{
      name: 'lines',
      table: 'C_Invoiceline',
      level: 'line',
      fields: [
        {
          name: 'product', column: 'M_Product_ID', type: 'string', visibility: 'editable',
          required: false, searchable: false, grid: true, form: true, ...fieldExtras,
        },
        {
          name: 'description', column: 'Description', type: 'string', visibility: 'editable',
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
        lines: {
          fields: [
            {
              name: 'product', column: 'M_Product_ID', label: 'Product', type: 'string',
              visibility: 'editable', grid: true, form: true, ...fieldExtras,
            },
            {
              name: 'description', column: 'Description', label: 'Description', type: 'string',
              visibility: 'editable', grid: true, form: true,
            },
          ],
        },
      },
    },
  };
}

describe('resolveCurated — noTruncate (ETP-5281)', () => {
  it('copies noTruncate:true through onto the curated field', async () => {
    const decisions = { entities: { lines: { fields: { product: { noTruncate: true } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'product');
    assert.equal(field.noTruncate, true);
  });

  it('omits noTruncate entirely when not declared', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'product');
    assert.equal(field.noTruncate, undefined);
    assert.equal(Object.hasOwn(field, 'noTruncate'), false);
  });
});

describe('generateFrontendContract — noTruncate (ETP-5281)', () => {
  it('emits noTruncate:true on the contract field', () => {
    const fc = generateFrontendContract(buildSchema({ noTruncate: true }));
    const field = fc.entities.lines.fields.find(f => f.name === 'product');
    assert.equal(field.noTruncate, true);
  });

  it('omits noTruncate when the curated field does not declare it', () => {
    const fc = generateFrontendContract(buildSchema());
    const field = fc.entities.lines.fields.find(f => f.name === 'product');
    assert.equal(Object.hasOwn(field, 'noTruncate'), false);
  });
});

describe('generateTableComponent — noTruncate (ETP-5281)', () => {
  it('emits noTruncate: true on the grid column', () => {
    const src = generateTableComponent('lines', buildContract({ noTruncate: true }));
    assert.match(src, /key: 'product'.*noTruncate: true/);
  });

  it('emits NO noTruncate key when the field does not declare it (regression guard: absent still truncates)', () => {
    const src = generateTableComponent('lines', buildContract());
    assert.doesNotMatch(src, /noTruncate/);
  });

  it('leaves sibling columns untouched', () => {
    const src = generateTableComponent('lines', buildContract({ noTruncate: true }));
    const descriptionLine = src.split('\n').find(l => l.includes("key: 'description'"));
    assert.doesNotMatch(descriptionLine, /noTruncate/);
  });

  it('coexists with currencyField (ETP-5245) on the same column without interfering', () => {
    const src = generateTableComponent('lines', buildContract({ noTruncate: true, currencyField: 'cCurrencyID' }));
    const productLine = src.split('\n').find(l => l.includes("key: 'product'"));
    assert.match(productLine, /currencyField: 'cCurrencyID'/);
    assert.match(productLine, /noTruncate: true/);
  });
});
