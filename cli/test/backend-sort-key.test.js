import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateFrontendContract } from '../src/generate-contract.js';
import { generateTableComponent, generateListModalPage } from '../src/generate-frontend.js';

/**
 * ETP-5382 — `backendSortKey` (and, since this ticket, its AUTO-DERIVATION) must
 * survive the whole pipeline: decisions.json → resolve-curated → contract →
 * generated grid column. It is the sorting sibling of `backendFilterKey`
 * (ETP-4681): a field renamed via decisions.json's `name` override (e.g. AD
 * column `SOPOType`, whose real OBDal/Hibernate property is `salesPurchaseType`,
 * exposed in the contract as `applicableTo`) sends the frontend contract key as
 * the filter/sort param, but Etendo Classic's AdvancedQueryBuilder /
 * JsonUtils.getPropertiesOnPath() resolves it against the real property and
 * silently drops anything it can't match.
 *
 * A first version of this feature added `backendSortKey` as a plain manual
 * decisions.json opt-in, mirroring `backendFilterKey`'s existing plumbing. A
 * repo-wide audit then found that manual declaration reproduces the exact bug
 * it was meant to fix: of 12 renamed grid fields across 5 windows
 * (tax, payment-out, purchase-invoice, sales-order), NONE had ever declared
 * either key — the gap is not discoverable from decisions.json alone. So
 * resolve-curated.js now AUTO-DERIVES both keys from the field's raw
 * (pre-rename) name whenever decisions.json's `name` renames it, with an
 * explicit decisions.json value still honored as an escape hatch (see
 * applyBackendKeyDerivation() for why the raw name is always the real backend
 * property, not a heuristic guess).
 *
 * Mirrors summable-currency-field.test.js's structure (ETP-5245), the closest
 * existing "append at tail, verbatim opt-in" precedent — `backendFilterKey`
 * itself has no dedicated pipeline regression test today (only its F20
 * validator usage is covered in validate-pipeline.test.js).
 */

function buildSchemaRaw(fieldExtras = {}) {
  return {
    window: { id: '19', name: 'Tax Rate' },
    entities: [{
      name: 'tax',
      tableName: 'C_Tax',
      fields: [
        // Raw (pre-decisions) field: `apiKey` is what extract-fields.js's
        // toPropertyName(AD_Column.Name) produces — the REAL OBDal property.
        { name: 'salesPurchaseType', apiKey: 'salesPurchaseType', columnName: 'SOPOType', label: 'Sales/Purchase', type: 'string', visibility: 'editable', ...fieldExtras },
        { name: 'rate', apiKey: 'rate', columnName: 'Rate', label: 'Rate', type: 'decimal', visibility: 'editable' },
      ],
    }],
  };
}

function buildSchema(fieldExtras = {}) {
  return {
    version: '0.1.0',
    window: { id: '19', name: 'Tax Rate', primaryEntity: 'tax', category: 'general' },
    entities: [{
      name: 'tax',
      table: 'C_Tax',
      level: 'header',
      fields: [
        {
          name: 'applicableTo', column: 'SOPOType', type: 'string', visibility: 'editable',
          required: false, searchable: false, grid: true, form: true, ...fieldExtras,
        },
        {
          name: 'rate', column: 'Rate', type: 'decimal', visibility: 'editable',
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
        tax: {
          fields: [
            {
              name: 'applicableTo', column: 'SOPOType', label: 'Applicable To', type: 'string',
              visibility: 'editable', grid: true, form: true, ...fieldExtras,
            },
            {
              name: 'rate', column: 'Rate', label: 'Rate', type: 'decimal',
              visibility: 'editable', grid: true, form: true,
            },
          ],
        },
      },
    },
  };
}

describe('resolveCurated — backendFilterKey/backendSortKey AUTO-DERIVATION on rename (ETP-5382)', () => {
  it('derives both keys from the raw apiKey when decisions.json renames the field', async () => {
    const decisions = { entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendFilterKey, 'salesPurchaseType');
    assert.equal(field.backendSortKey, 'salesPurchaseType');
  });

  it('does NOT derive anything when the field is not renamed', async () => {
    const decisions = { entities: { tax: { fields: { salesPurchaseType: { label: 'Sales/Purchase Type' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'salesPurchaseType');
    assert.equal(Object.hasOwn(field, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(field, 'backendSortKey'), false);
  });

  it('does NOT derive anything with no decisions.json entry at all', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'salesPurchaseType');
    assert.equal(Object.hasOwn(field, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(field, 'backendSortKey'), false);
  });

  it('an explicit decisions.json value overrides the derived one (escape hatch)', async () => {
    const decisions = {
      entities: {
        tax: {
          fields: {
            salesPurchaseType: {
              name: 'applicableTo',
              backendFilterKey: 'customFilterKey',
              backendSortKey: 'customSortKey',
            },
          },
        },
      },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendFilterKey, 'customFilterKey');
    assert.equal(field.backendSortKey, 'customSortKey');
  });

  it('a partial explicit override (only one of the two keys) still derives the other', async () => {
    const decisions = {
      entities: {
        tax: {
          fields: {
            salesPurchaseType: { name: 'applicableTo', backendFilterKey: 'customFilterKey' },
          },
        },
      },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendFilterKey, 'customFilterKey');
    assert.equal(field.backendSortKey, 'salesPurchaseType');
  });

  it('leaves sibling (non-renamed) fields untouched', async () => {
    const decisions = { entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const rate = schema.entities[0].fields.find(f => f.name === 'rate');
    assert.equal(Object.hasOwn(rate, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(rate, 'backendSortKey'), false);
  });
});

/**
 * `deduplicateFieldNames()` in extract-fields.js suffixes a counter onto the raw
 * `name` when two AD fields of the same tab resolve to the same OBDal property
 * (`documentNo` → `documentNo2`) and leaves `apiKey` alone. `documentNo2` is not
 * a Hibernate property, so the derivation MUST read `apiKey`. Live case:
 * payment-out lines `documentNo2` → `invoiceNo`, a renamed grid field.
 */
describe('resolveCurated — derivation reads apiKey, not the deduplicated name (ETP-5382)', () => {
  function dedupedRaw() {
    return {
      window: { id: '1', name: 'Payment Out' },
      entities: [{
        name: 'lines',
        tableName: 'FIN_Payment_ScheduleDetail',
        fields: [
          { name: 'documentNo', apiKey: 'documentNo', columnName: 'DocumentNo', label: 'Order No.', type: 'string', visibility: 'editable' },
          { name: 'documentNo2', apiKey: 'documentNo', columnName: 'DocumentNo', label: 'Invoice No.', type: 'string', visibility: 'editable' },
        ],
      }],
    };
  }

  it('derives the real property, never the deduplicated suffix', async () => {
    const decisions = {
      entities: { lines: { fields: {
        documentNo: { name: 'orderNo' },
        documentNo2: { name: 'invoiceNo' },
      } } },
    };
    const { schema } = await resolveCurated(dedupedRaw(), { rules: [] }, decisions);
    const orderNo = schema.entities[0].fields.find(f => f.name === 'orderNo');
    const invoiceNo = schema.entities[0].fields.find(f => f.name === 'invoiceNo');
    assert.equal(orderNo.backendFilterKey, 'documentNo');
    assert.equal(orderNo.backendSortKey, 'documentNo');
    assert.equal(invoiceNo.backendFilterKey, 'documentNo');
    assert.equal(invoiceNo.backendSortKey, 'documentNo');
  });

  it('is a no-op when the rename target IS the real property', async () => {
    const decisions = { entities: { lines: { fields: { documentNo2: { name: 'documentNo' } } } } };
    const { schema } = await resolveCurated(dedupedRaw(), { rules: [] }, decisions);
    // Two fields now share the name; the renamed one is the second.
    const renamed = schema.entities[0].fields.filter(f => f.name === 'documentNo')[1];
    assert.equal(Object.hasOwn(renamed, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(renamed, 'backendSortKey'), false);
  });
});

/**
 * An unrenamed FK emits a `type: 'selector'` column, which resolveBackendSort()
 * sorts as `<key>$_identifier`. Setting backendSortKey makes that helper use the
 * value verbatim, so the derived key must carry the suffix itself or the column
 * silently orders by the join column's UUID.
 */
describe('resolveCurated — FK renames derive an identifier sort key (ETP-5382)', () => {
  function fkRaw(extras = {}) {
    return {
      window: { id: '1', name: 'Purchase Invoice' },
      entities: [{
        name: 'paymentPlan',
        tableName: 'FIN_Payment_Sched_Inv_V',
        fields: [
          {
            name: 'finPaymentmethodID', apiKey: 'finPaymentmethodID', columnName: 'Fin_Paymentmethod_ID',
            label: 'Payment Method', type: 'foreignKey', visibility: 'editable', ...extras,
          },
        ],
      }],
    };
  }

  it('suffixes $_identifier on the sort key but NOT on the filter key', async () => {
    const decisions = { entities: { paymentPlan: { fields: { finPaymentmethodID: { name: 'paymentMethod' } } } } };
    const { schema } = await resolveCurated(fkRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'paymentMethod');
    assert.equal(field.backendFilterKey, 'finPaymentmethodID');
    assert.equal(field.backendSortKey, 'finPaymentmethodID$_identifier');
  });

  it('an explicit decisions.json backendSortKey still wins over the suffixed one', async () => {
    const decisions = {
      entities: { paymentPlan: { fields: { finPaymentmethodID: { name: 'paymentMethod', backendSortKey: 'finPaymentmethodID' } } } },
    };
    const { schema } = await resolveCurated(fkRaw(), { rules: [] }, decisions);
    assert.equal(schema.entities[0].fields.find(f => f.name === 'paymentMethod').backendSortKey, 'finPaymentmethodID');
  });

  it('a columnType override that is not a selector drops the suffix', async () => {
    const decisions = {
      entities: { paymentPlan: { fields: { finPaymentmethodID: { name: 'paymentMethod', columnType: 'string' } } } },
    };
    const { schema } = await resolveCurated(fkRaw(), { rules: [] }, decisions);
    assert.equal(schema.entities[0].fields.find(f => f.name === 'paymentMethod').backendSortKey, 'finPaymentmethodID');
  });

  it('an enum reference is not a selector, so no suffix', async () => {
    const decisions = { entities: { paymentPlan: { fields: { finPaymentmethodID: { name: 'paymentMethod' } } } } };
    const { schema } = await resolveCurated(fkRaw({ enumValues: ['A', 'B'] }), { rules: [] }, decisions);
    assert.equal(schema.entities[0].fields.find(f => f.name === 'paymentMethod').backendSortKey, 'finPaymentmethodID');
  });

  it('a non-FK rename never gets the suffix', async () => {
    const decisions = { entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    assert.equal(schema.entities[0].fields.find(f => f.name === 'applicableTo').backendSortKey, 'salesPurchaseType');
  });
});

describe('resolveCurated — backendSortKey explicit plumbing (ETP-5382)', () => {
  it('copies an explicit backendSortKey through onto the curated field', async () => {
    const decisions = { entities: { tax: { fields: { applicableTo: { backendSortKey: 'salesPurchaseType' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw({ name: 'applicableTo' }), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendSortKey, 'salesPurchaseType');
  });
});

describe('generateFrontendContract — backendSortKey (ETP-5382)', () => {
  it('copies backendSortKey onto the contract field, and omits it otherwise', () => {
    const withField = generateFrontendContract(buildSchema({ backendSortKey: 'salesPurchaseType' }));
    assert.equal(withField.entities.tax.fields.find(f => f.name === 'applicableTo').backendSortKey, 'salesPurchaseType');
    const without = generateFrontendContract(buildSchema());
    assert.equal(without.entities.tax.fields.find(f => f.name === 'applicableTo').backendSortKey, undefined);
  });
});

describe('generateTableComponent — backendSortKey (ETP-5382)', () => {
  it('emits backendSortKey on the grid column when declared, and nothing otherwise', () => {
    const src = generateTableComponent('tax', buildContract({ backendSortKey: 'salesPurchaseType' }));
    assert.match(src, /key: 'applicableTo'.*backendSortKey: 'salesPurchaseType'/);
    assert.doesNotMatch(generateTableComponent('tax', buildContract()), /backendSortKey/);
  });

  it('leaves sibling columns untouched', () => {
    const src = generateTableComponent('tax', buildContract({ backendSortKey: 'salesPurchaseType' }));
    const rateLine = src.split('\n').find(l => l.includes("key: 'rate'"));
    assert.doesNotMatch(rateLine, /backendSortKey/);
  });

  it('coexists with backendFilterKey on the same column (both survive independently)', () => {
    const src = generateTableComponent('tax', buildContract({
      backendFilterKey: 'salesPurchaseType',
      backendSortKey: 'salesPurchaseType',
    }));
    assert.match(src, /key: 'applicableTo'.*backendFilterKey: 'salesPurchaseType'.*backendSortKey: 'salesPurchaseType'/);
  });
});

describe('generateListModalPage — backendSortKey (ETP-5382)', () => {
  function listModalContract(fieldExtras = {}) {
    return {
      apiPrediction: {
        specName: 'tax', baseUrl: '/sws/neo/tax',
        crud: { tax: { listUrl: '/sws/neo/tax/tax' } },
        selectors: [], actions: [], queryParams: {},
      },
      frontendContract: {
        window: {
          id: '19', name: 'Tax Rate', primaryEntity: 'tax', category: 'general',
          layoutType: 'list-modal',
          templateConfig: { titleKey: 't', editTitleKey: 't', bannerKey: 't', searchPlaceholderKey: 't', newLabelKey: 't' },
        },
        entities: {
          tax: {
            tableName: 'C_Tax',
            fields: [
              {
                name: 'applicableTo', column: 'SOPOType', type: 'string', tsType: 'string',
                visibility: 'editable', required: false, grid: true, form: true, ...fieldExtras,
              },
              {
                name: 'rate', column: 'Rate', type: 'decimal', tsType: 'number',
                visibility: 'editable', required: false, grid: true, form: true,
              },
            ],
            searchableFields: ['applicableTo'],
            computedFields: [],
          },
        },
      },
    };
  }

  it('emits backendSortKey on the list-modal grid column when declared, and nothing otherwise', () => {
    const withField = generateListModalPage('tax', listModalContract({ backendSortKey: 'salesPurchaseType' }));
    assert.match(withField, /key: 'applicableTo'.*backendSortKey: 'salesPurchaseType'/);
    const without = generateListModalPage('tax', listModalContract());
    assert.doesNotMatch(without, /backendSortKey/);
  });
});
