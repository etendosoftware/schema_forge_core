import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Exercises the REAL shared module. These three symbols lived only inside the
// functional repo's Vite dev plugin, so the production report-server rendered
// every report with blank labels and English titles while dev looked correct.
// Never re-implement the logic here — a hand-rolled copy passes whether or not
// the shipped code is right, which is the exact failure this module exists to
// end.
import {
  REPORT_UI_STRINGS,
  pickLabel,
  pickUiStrings,
  buildContractLabels,
} from '../src/report-i18n.js';

/**
 * The chrome keys every template may reference as `meta.ui.<key>`. Pinned so
 * adding one is deliberate: a key missing from a locale renders as empty text,
 * not as an English fallback, so a partial addition is invisible until someone
 * opens the report in that language.
 */
const UI_KEYS = ['records', 'total', 'totals', 'filters', 'generatedBy', 'initialBalance', 'subtotal'];

describe('REPORT_UI_STRINGS', () => {
  it('ships the same key set for every locale', () => {
    const locales = Object.keys(REPORT_UI_STRINGS);
    assert.ok(locales.includes('en_US'), 'en_US is the fallback locale and must exist');
    assert.ok(locales.includes('es_ES'), 'es_ES is the primary client-facing locale');
    for (const locale of locales) {
      assert.deepEqual(
        Object.keys(REPORT_UI_STRINGS[locale]).sort(),
        [...UI_KEYS].sort(),
        `locale ${locale} does not carry exactly the pinned chrome keys`,
      );
    }
  });

  it('has no empty string values (an empty key renders as blank text)', () => {
    for (const [locale, strings] of Object.entries(REPORT_UI_STRINGS)) {
      for (const [key, value] of Object.entries(strings)) {
        assert.ok(value && value.trim() !== '', `${locale}.${key} is empty`);
      }
    }
  });

  it('actually translates — es_ES is not a copy of en_US', () => {
    assert.notEqual(REPORT_UI_STRINGS.es_ES.records, REPORT_UI_STRINGS.en_US.records);
    assert.equal(REPORT_UI_STRINGS.es_ES.initialBalance, 'Saldo inicial');
  });
});

describe('pickUiStrings', () => {
  it('returns the requested locale', () => {
    assert.equal(pickUiStrings('es_ES').totals, 'Totales');
  });

  it('falls back to en_US for an unknown locale rather than returning undefined', () => {
    assert.deepEqual(pickUiStrings('fr_FR'), REPORT_UI_STRINGS.en_US);
    assert.deepEqual(pickUiStrings(undefined), REPORT_UI_STRINGS.en_US);
  });
});

describe('pickLabel', () => {
  const label = { en_US: 'Warehouse', es_ES: 'Almacén' };

  it('resolves the requested locale', () => {
    assert.equal(pickLabel(label, 'es_ES'), 'Almacén');
    assert.equal(pickLabel(label, 'en_US'), 'Warehouse');
  });

  it('falls back to en_US when the locale is missing from the object', () => {
    assert.equal(pickLabel(label, 'fr_FR'), 'Warehouse');
    assert.equal(pickLabel({ en_US: 'Only English' }, 'es_ES'), 'Only English');
  });

  it('falls back to the supplied fallback when the object is absent or empty', () => {
    assert.equal(pickLabel(undefined, 'es_ES', 'fallback'), 'fallback');
    assert.equal(pickLabel(null, 'es_ES', 'fallback'), 'fallback');
    assert.equal(pickLabel({}, 'es_ES', 'fallback'), 'fallback');
  });

  it('returns an empty string, never undefined, when no fallback is given', () => {
    assert.equal(pickLabel(undefined, 'es_ES'), '');
  });
});

describe('buildContractLabels', () => {
  const contract = {
    columns: [
      { field: 'qtyOnHand', label: { en_US: 'Quantity', es_ES: 'Stock Disponible' } },
      { field: 'uom', label: { en_US: 'UOM' } },
      { field: 'noLabel' },
    ],
    groups: [
      {
        field: 'warehouse',
        label: { en_US: 'Warehouse', es_ES: 'Almacén' },
        headerFields: [{ field: 'category', label: { en_US: 'Category', es_ES: 'Categoría' } }],
      },
    ],
    parameters: [
      { name: 'M_Product_ID', label: { en_US: 'Product', es_ES: 'Producto' } },
      { name: 'noLabelParam' },
    ],
    labels: { noData: { en_US: 'No data found.', es_ES: 'No se encontraron datos.' } },
  };

  it('resolves columns, groups, headerFields, parameters and the labels block', () => {
    const labels = buildContractLabels(contract, 'es_ES');
    assert.equal(labels.qtyOnHand, 'Stock Disponible');
    assert.equal(labels.warehouse, 'Almacén');
    assert.equal(labels.category, 'Categoría', 'nested headerFields must be resolved too');
    assert.equal(labels.M_Product_ID, 'Producto');
    assert.equal(labels.noData, 'No se encontraron datos.');
  });

  it('falls back to en_US per entry, not for the whole contract', () => {
    const labels = buildContractLabels(contract, 'es_ES');
    assert.equal(labels.uom, 'UOM', 'an entry with no es_ES must fall back on its own');
    assert.equal(labels.qtyOnHand, 'Stock Disponible', 'siblings must still resolve to es_ES');
  });

  it('uses the field/parameter name when an entry declares no label at all', () => {
    const labels = buildContractLabels(contract, 'es_ES');
    assert.equal(labels.noLabel, 'noLabel');
    assert.equal(labels.noLabelParam, 'noLabelParam');
  });

  it('never yields undefined values — a template would render those as blank', () => {
    for (const [key, value] of Object.entries(buildContractLabels(contract, 'es_ES'))) {
      assert.equal(typeof value, 'string', `${key} is not a string`);
      assert.notEqual(value, '', `${key} resolved to an empty string`);
    }
  });

  it('tolerates a contract with no translatable sections', () => {
    assert.deepEqual(buildContractLabels({}, 'es_ES'), {});
  });
});
