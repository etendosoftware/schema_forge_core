import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateFrontendContract } from '../src/generate-contract.js';
import { generateTableComponent, generateListModalPage } from '../src/generate-frontend.js';

/**
 * ETP-5382 — `backendSortKey` must survive the whole pipeline: decisions.json →
 * resolve-curated → contract → generated grid column. It is the sorting sibling
 * of `backendFilterKey` (ETP-4681), and like it, an EXPLICIT per-field opt-in:
 * nothing is inferred from a rename.
 *
 * Why it exists: a field renamed via decisions.json's `name` override (e.g. AD
 * column `SOPOType`, whose real OBDal/Hibernate property is `salesPurchaseType`,
 * exposed in the contract as `applicableTo`) sends the frontend contract key as
 * the filter/sort param, but Etendo Classic's AdvancedQueryBuilder /
 * JsonUtils.getPropertiesOnPath() resolves it against the real property and
 * silently drops anything it cannot match. Renaming a grid field therefore
 * requires declaring both keys by hand in that field's decisions.json entry —
 * the rule and the FK `$_identifier` caveat live in the functional repo's
 * `docs/decisions-reference.md`.
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

describe('resolveCurated — backendSortKey explicit plumbing (ETP-5382)', () => {
  it('copies an explicit backendSortKey through onto the curated field', async () => {
    const decisions = { entities: { tax: { fields: { applicableTo: { backendSortKey: 'salesPurchaseType' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw({ name: 'applicableTo' }), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendSortKey, 'salesPurchaseType');
  });

  it('carries both explicit keys through on a renamed field', async () => {
    const decisions = {
      entities: {
        tax: {
          fields: {
            salesPurchaseType: {
              name: 'applicableTo',
              backendFilterKey: 'salesPurchaseType',
              backendSortKey: 'salesPurchaseType',
            },
          },
        },
      },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendFilterKey, 'salesPurchaseType');
    assert.equal(field.backendSortKey, 'salesPurchaseType');
  });

  // The two keys are independent opt-ins: declaring one must never conjure the
  // other. A rename that declares only `backendFilterKey` still sorts by the
  // contract key — that is the documented, manual responsibility, not a default.
  it('declaring only one key leaves the other absent', async () => {
    const decisions = {
      entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo', backendFilterKey: 'salesPurchaseType' } } } },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(field.backendFilterKey, 'salesPurchaseType');
    assert.equal(Object.hasOwn(field, 'backendSortKey'), false);
  });

  it('emits neither key when a rename declares neither', async () => {
    const decisions = { entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo' } } } } };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'applicableTo');
    assert.equal(Object.hasOwn(field, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(field, 'backendSortKey'), false);
  });

  it('emits neither key with no decisions.json entry at all', async () => {
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, {});
    const field = schema.entities[0].fields.find(f => f.name === 'salesPurchaseType');
    assert.equal(Object.hasOwn(field, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(field, 'backendSortKey'), false);
  });

  it('leaves sibling fields untouched', async () => {
    const decisions = {
      entities: { tax: { fields: { salesPurchaseType: { name: 'applicableTo', backendSortKey: 'salesPurchaseType' } } } },
    };
    const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, decisions);
    const rate = schema.entities[0].fields.find(f => f.name === 'rate');
    assert.equal(Object.hasOwn(rate, 'backendFilterKey'), false);
    assert.equal(Object.hasOwn(rate, 'backendSortKey'), false);
  });

  // Declaring `backendSortKey` at all makes resolveBackendSort() use the value
  // verbatim — `isIdentifierSort` turns true and the `$_identifier` suffix is no
  // longer appended — so a renamed FK must spell the suffix out itself or the
  // column orders by the join column's UUID. The value is passed through as
  // written; the pipeline never adds or strips the suffix.
  it('passes an FK $_identifier sort key through verbatim', async () => {
    const decisions = {
      entities: {
        paymentPlan: {
          fields: {
            finPaymentmethodID: {
              name: 'paymentMethod',
              backendFilterKey: 'finPaymentmethodID',
              backendSortKey: 'finPaymentmethodID$_identifier',
            },
          },
        },
      },
    };
    const { schema } = await resolveCurated(fkRaw(), { rules: [] }, decisions);
    const field = schema.entities[0].fields.find(f => f.name === 'paymentMethod');
    assert.equal(field.backendFilterKey, 'finPaymentmethodID');
    assert.equal(field.backendSortKey, 'finPaymentmethodID$_identifier');
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
