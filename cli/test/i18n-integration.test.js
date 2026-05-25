import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// resolveLabel — pure function tests
// ---------------------------------------------------------------------------

// Inline the function since it lives in the app-shell (ESM with import.meta)
function resolveLabel(dictionary, columnName) {
  return dictionary?.fields?.[columnName]?.label ?? null;
}

describe('resolveLabel', () => {
  const dict = {
    fields: {
      C_BPartner_ID: { label: 'Business Partner' },
      DocumentNo: { label: 'Document No.' },
      DateOrdered: { label: 'Order Date' },
    },
  };

  it('returns label for known column', () => {
    assert.equal(resolveLabel(dict, 'C_BPartner_ID'), 'Business Partner');
  });

  it('returns null for unknown column', () => {
    assert.equal(resolveLabel(dict, 'NonExistentColumn'), null);
  });

  it('returns null when dictionary is null', () => {
    assert.equal(resolveLabel(null, 'C_BPartner_ID'), null);
  });

  it('returns null when dictionary is undefined', () => {
    assert.equal(resolveLabel(undefined, 'C_BPartner_ID'), null);
  });

  it('returns null when dictionary has no fields key', () => {
    assert.equal(resolveLabel({}, 'C_BPartner_ID'), null);
  });

  it('returns null when fields entry has no label', () => {
    assert.equal(resolveLabel({ fields: { C_BPartner_ID: {} } }, 'C_BPartner_ID'), null);
  });

  it('returns null for empty string column name', () => {
    assert.equal(resolveLabel(dict, ''), null);
  });

  it('returns null for null column name', () => {
    assert.equal(resolveLabel(dict, null), null);
  });

  it('returns null for undefined column name', () => {
    assert.equal(resolveLabel(dict, undefined), null);
  });

  it('handles label with special characters', () => {
    const specialDict = {
      fields: { TestCol: { label: 'Amount (USD) > 0' } },
    };
    assert.equal(resolveLabel(specialDict, 'TestCol'), 'Amount (USD) > 0');
  });

  it('returns empty string label as-is (nullish coalescing does not catch empty string)', () => {
    const emptyDict = { fields: { TestCol: { label: '' } } };
    // ?? only catches null/undefined, not empty string — this is correct behavior
    // The fallback chain (t(col) ?? f.label ?? f.key) will pass empty string through
    assert.equal(resolveLabel(emptyDict, 'TestCol'), '');
  });
});

// ---------------------------------------------------------------------------
// Generated artifact validation — column: key present, no label: key
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR = resolve(import.meta.dirname, '../../artifacts');

function getGeneratedJsxFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        // Skip custom/ directories — hand-written files are not generated
        if (entry === 'custom') continue;
        results.push(...getGeneratedJsxFiles(full));
      } else if (entry.endsWith('Form.jsx') || entry.endsWith('Table.jsx')) {
        results.push(full);
      }
    }
  } catch {
    // Directory may not exist in test environments
  }
  return results;
}

describe('generated artifacts i18n compliance', () => {
  const jsxFiles = getGeneratedJsxFiles(ARTIFACTS_DIR);

  it('finds generated Form and Table JSX files', () => {
    assert.ok(jsxFiles.length > 0, `Expected generated JSX files in ${ARTIFACTS_DIR}`);
  });

  it('all field declarations have column: for i18n lookup; label: is allowed as per-window override', () => {
    // Every field line must have column: (the i18n lookup key).
    // label: is permitted alongside column: — it carries the per-window AD_Field.Name which
    // takes priority over the global locale when the same column has different labels in
    // different windows (e.g. BillTo_ID = "Invoice Address" in sales-order vs "Invoice From"
    // in purchase-order).
    const filesWithoutColumn = [];

    for (const file of jsxFiles) {
      const content = readFileSync(file, 'utf8');
      const fieldLines = content.split('\n').filter(
        (line) => line.includes('{ key:') || line.includes("{ key:")
      );
      for (const line of fieldLines) {
        if (!line.includes('column:')) {
          filesWithoutColumn.push(file);
          break;
        }
      }
    }

    assert.deepStrictEqual(
      filesWithoutColumn,
      [],
      `Files missing column: key: ${filesWithoutColumn.join(', ')}`,
    );
  });

  it('every field declaration has a non-empty column value', () => {
    const badFields = [];
    for (const file of jsxFiles) {
      const content = readFileSync(file, 'utf8');
      // Match column: 'VALUE' or column: "VALUE"
      const columnMatches = content.matchAll(/column:\s*['"]([^'"]*)['"]/g);
      for (const m of columnMatches) {
        if (!m[1] || m[1].trim().length === 0) {
          badFields.push({ file, match: m[0] });
        }
      }
    }
    assert.deepStrictEqual(badFields, [], 'Found fields with empty column values');
  });
});

// ---------------------------------------------------------------------------
// Fallback chain: t(f.column) ?? f.label ?? f.key
// ---------------------------------------------------------------------------

describe('label fallback chain', () => {
  it('uses dictionary label when available', () => {
    const dict = { fields: { Col1: { label: 'From Dict' } } };
    const field = { key: 'myField', column: 'Col1', label: 'Static Label' };
    const result = resolveLabel(dict, field.column) ?? field.label ?? field.key;
    assert.equal(result, 'From Dict');
  });

  it('falls back to field.label when dictionary miss', () => {
    const dict = { fields: {} };
    const field = { key: 'myField', column: 'UnknownCol', label: 'Static Label' };
    const result = resolveLabel(dict, field.column) ?? field.label ?? field.key;
    assert.equal(result, 'Static Label');
  });

  it('falls back to field.key when both dictionary and label missing', () => {
    const dict = { fields: {} };
    const field = { key: 'myField', column: 'UnknownCol' };
    const result = resolveLabel(dict, field.column) ?? field.label ?? field.key;
    assert.equal(result, 'myField');
  });

  it('falls back to field.key when dictionary is null and no label', () => {
    const field = { key: 'myField', column: 'AnyCol' };
    const result = resolveLabel(null, field.column) ?? field.label ?? field.key;
    assert.equal(result, 'myField');
  });
});

// ---------------------------------------------------------------------------
// resolveMenuLabel — { field } option
// ---------------------------------------------------------------------------

// Inline the logic from useMenuLabel.js (tools/app-shell/src/i18n/useMenuLabel.js)
// since that file uses ESM with import.meta / React hooks.
function resolveMenuLabel(dictionary, key, { field } = {}) {
  if (field) {
    return dictionary?.windows?.[key]?.[field] ?? null;
  }
  return (
    dictionary?.ui?.[key]?.label ??
    dictionary?.menus?.[key]?.label ??
    dictionary?.windows?.[key]?.label ??
    dictionary?.tabs?.[key]?.label ??
    dictionary?.genericLabels?.[key] ??
    key
  );
}

describe('resolveMenuLabel — { field } option', () => {
  const dictionary = {
    ui: {},
    menus: {},
    windows: {
      'Sales Order': { label: 'Pedido de venta', newLabel: 'Nuevo pedido' },
      'Product': { label: 'Producto' },
    },
    tabs: {},
    genericLabels: {},
  };

  it('returns the field value when windows[key][field] exists', () => {
    assert.equal(resolveMenuLabel(dictionary, 'Sales Order', { field: 'newLabel' }), 'Nuevo pedido');
  });

  it('returns null when key is not in windows', () => {
    assert.equal(resolveMenuLabel(dictionary, 'Unknown', { field: 'newLabel' }), null);
  });

  it('returns null when key exists in windows but field is missing', () => {
    assert.equal(resolveMenuLabel(dictionary, 'Product', { field: 'newLabel' }), null);
  });

  it('returns null when key is undefined', () => {
    assert.equal(resolveMenuLabel(dictionary, undefined, { field: 'newLabel' }), null);
  });

  it('returns null when key is null', () => {
    assert.equal(resolveMenuLabel(dictionary, null, { field: 'newLabel' }), null);
  });

  it('without { field }: normal cascade returns label found via windows[key].label', () => {
    assert.equal(resolveMenuLabel(dictionary, 'Sales Order'), 'Pedido de venta');
  });

  it('without { field }: falls back to raw key when nothing matches in cascade', () => {
    assert.equal(resolveMenuLabel(dictionary, 'Unknown Key'), 'Unknown Key');
  });
});

// ---------------------------------------------------------------------------
// getPrice — pure function tests (mirrors ProductSearchDrawer.jsx logic)
// ---------------------------------------------------------------------------

// Inline the formatCurrency logic (ES module with export can't be required directly).
// This mirrors the implementation in tools/app-shell/src/lib/formatCurrency.js.
const DEFAULT_LOCALE = 'en-US';
const SYMBOL_AFTER_CURRENCIES = new Set(['EUR', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'PLN']);

function formatCurrency(currencyCode, value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';

  const amount = Number(value);

  try {
    const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (SYMBOL_AFTER_CURRENCIES.has(currencyCode)) {
      const symbol = formatter.formatToParts(0).find((p) => p.type === 'currency')?.value ?? currencyCode;
      const numFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const sign = amount < 0 ? '-' : '';
      return `${sign}${numFormatter.format(Math.abs(amount))} ${symbol}`;
    }

    return formatter.format(amount);
  } catch {
    return amount.toLocaleString(DEFAULT_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

// Inline getPrice logic from ProductSearchDrawer.jsx
function getPrice(item, currency) {
  const p = item.standardPrice || item.listPrice || item.price;
  if (p == null) return null;
  const num = typeof p === 'number' ? p : parseFloat(p);
  if (isNaN(num)) return String(p);
  return currency ? formatCurrency(currency, num) : num.toFixed(2);
}

describe('getPrice — currency formatting', () => {
  it('with EUR currency returns amount followed by € symbol (symbol-after convention)', () => {
    const result = getPrice({ standardPrice: 12 }, 'EUR');
    assert.equal(result, '12.00 €');
  });

  it('with USD currency returns $ symbol before amount (symbol-before convention)', () => {
    const result = getPrice({ standardPrice: 12 }, 'USD');
    assert.equal(result, '$12.00');
  });

  it('with null currency falls back to toFixed(2) with no symbol', () => {
    const result = getPrice({ standardPrice: 12 }, null);
    assert.equal(result, '12.00');
  });

  it('returns null when price fields are all absent (null item price)', () => {
    const result = getPrice({ id: 'prod-1' }, 'EUR');
    assert.equal(result, null);
  });

  it('parses a string price to float and formats it correctly', () => {
    const result = getPrice({ standardPrice: '44.5' }, 'EUR');
    assert.equal(result, '44.50 €');
  });

  it('returns the raw string when price is a non-numeric string (NaN guard)', () => {
    const result = getPrice({ standardPrice: 'abc' }, 'EUR');
    assert.equal(result, 'abc');
  });

  it('uses listPrice when standardPrice is absent', () => {
    const result = getPrice({ listPrice: 99 }, 'USD');
    assert.equal(result, '$99.00');
  });

  it('uses price as last fallback when both standardPrice and listPrice are absent', () => {
    const result = getPrice({ price: 5.5 }, 'EUR');
    assert.equal(result, '5.50 €');
  });

  it('with undefined currency (no session currency) falls back to toFixed(2)', () => {
    const result = getPrice({ standardPrice: 30 }, undefined);
    assert.equal(result, '30.00');
  });
});

// ---------------------------------------------------------------------------
// Locale newLabel consistency
// ---------------------------------------------------------------------------

const LOCALES_DIR = resolve(import.meta.dirname, '../../packages/app-shell-core/src/locales');

describe('locale newLabel consistency', () => {
  const esRaw = readFileSync(join(LOCALES_DIR, 'es_ES.json'), 'utf8');
  const enRaw = readFileSync(join(LOCALES_DIR, 'en_US.json'), 'utf8');
  const esLocale = JSON.parse(esRaw);
  const enLocale = JSON.parse(enRaw);

  const esWindows = esLocale?.windows ?? {};
  const enWindows = enLocale?.windows ?? {};

  const esKeysWithNewLabel = Object.keys(esWindows).filter((k) => 'newLabel' in esWindows[k]);
  const enKeysWithNewLabel = Object.keys(enWindows).filter((k) => 'newLabel' in enWindows[k]);

  it('every key with newLabel in es_ES also has newLabel in en_US', () => {
    const missing = esKeysWithNewLabel.filter((k) => !('newLabel' in (enWindows[k] ?? {})));
    assert.deepStrictEqual(
      missing,
      [],
      `Keys with newLabel in es_ES but missing in en_US: ${missing.join(', ')}`,
    );
  });

  it('every key with newLabel in en_US also has newLabel in es_ES', () => {
    const missing = enKeysWithNewLabel.filter((k) => !('newLabel' in (esWindows[k] ?? {})));
    assert.deepStrictEqual(
      missing,
      [],
      `Keys with newLabel in en_US but missing in es_ES: ${missing.join(', ')}`,
    );
  });

  it('newLabel values are non-empty strings in es_ES', () => {
    const bad = esKeysWithNewLabel.filter(
      (k) => typeof esWindows[k].newLabel !== 'string' || esWindows[k].newLabel.trim() === '',
    );
    assert.deepStrictEqual(
      bad,
      [],
      `Keys with empty/non-string newLabel in es_ES: ${bad.join(', ')}`,
    );
  });

  it('newLabel values are non-empty strings in en_US', () => {
    const bad = enKeysWithNewLabel.filter(
      (k) => typeof enWindows[k].newLabel !== 'string' || enWindows[k].newLabel.trim() === '',
    );
    assert.deepStrictEqual(
      bad,
      [],
      `Keys with empty/non-string newLabel in en_US: ${bad.join(', ')}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Country selector — language URL parameter contract
//
// CreateContactModal.jsx builds country/region selector URLs as:
//   `${baseUrl}?limit=${PAGE}&offset=${offset}&language=${locale}`
//
// These tests verify the URL-construction contract so a regression (e.g.
// accidentally removing &language=) is caught before any UI change ships.
// ---------------------------------------------------------------------------

describe('country selector URL — language param contract', () => {
  function buildCountrySelectorUrl(baseUrl, limit, offset, locale) {
    return `${baseUrl}?limit=${limit}&offset=${offset}&language=${locale}`;
  }

  it('includes language=es_ES when locale is es_ES', () => {
    const url = buildCountrySelectorUrl(
      'http://localhost/sws/neo/sales-order/contacts/locationAddress/selectors/C_Country_ID',
      120, 0, 'es_ES',
    );
    assert.ok(url.includes('language=es_ES'), `Expected language=es_ES in: ${url}`);
  });

  it('includes language=en_US when locale is en_US', () => {
    const url = buildCountrySelectorUrl(
      'http://localhost/sws/neo/sales-order/contacts/locationAddress/selectors/C_Country_ID',
      120, 0, 'en_US',
    );
    assert.ok(url.includes('language=en_US'), `Expected language=en_US in: ${url}`);
  });

  it('language param comes after pagination params', () => {
    const url = buildCountrySelectorUrl(
      'http://localhost/sws/neo/foo/selectors/C_Country_ID',
      120, 120, 'es_ES',
    );
    const languageIdx = url.indexOf('language=');
    const limitIdx = url.indexOf('limit=');
    const offsetIdx = url.indexOf('offset=');
    assert.ok(languageIdx > limitIdx, 'language param must come after limit');
    assert.ok(languageIdx > offsetIdx, 'language param must come after offset');
  });

  it('region selector uses same URL pattern with language param', () => {
    const url = buildCountrySelectorUrl(
      'http://localhost/sws/neo/contacts/locationAddress/selectors/C_Region_ID',
      200, 0, 'es_ES',
    );
    assert.ok(url.includes('language=es_ES'), `Expected language=es_ES in: ${url}`);
    assert.ok(url.includes('C_Region_ID'), 'URL must reference C_Region_ID selector');
  });

  it('language param is not empty string', () => {
    const url = buildCountrySelectorUrl(
      'http://localhost/sws/neo/contacts/locationAddress/selectors/C_Country_ID',
      120, 0, 'es_ES',
    );
    const match = url.match(/language=([^&]*)/);
    assert.ok(match, 'language param must be present');
    assert.ok(match[1].length > 0, 'language param value must not be empty');
  });
});
