import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDisplayText,
  parseUserFilter,
  resolveBackendSort,
  buildBackendFilter,
} from '../gridQuery.js';

// ---------------------------------------------------------------------------
// getDisplayText
// ---------------------------------------------------------------------------

describe('getDisplayText', () => {
  describe('selector / FK columns', () => {
    it('returns $\_identifier when present', () => {
      const row = { businessPartner: 'some-uuid', 'businessPartner$_identifier': 'A. Datum Corp' };
      const col = { key: 'businessPartner', type: 'selector' };
      assert.equal(getDisplayText(row, col), 'A. Datum Corp');
    });

    it('falls back to row[key].name for mock object-shaped data', () => {
      const row = { businessPartner: { id: '1', name: 'Acme' } };
      const col = { key: 'businessPartner', type: 'selector' };
      assert.equal(getDisplayText(row, col), 'Acme');
    });

    it('falls back to raw string when no identifier', () => {
      const row = { businessPartner: 'some-uuid' };
      const col = { key: 'businessPartner', type: 'selector' };
      assert.equal(getDisplayText(row, col), 'some-uuid');
    });
  });

  describe('status / enum columns', () => {
    const col = {
      key: 'documentStatus',
      type: 'status',
      enumLabels: { DR: 'Draft', CO: 'Completed', IP: 'In Process' },
    };
    it('maps raw code to visible label', () => {
      assert.equal(getDisplayText({ documentStatus: 'CO' }, col), 'Completed');
    });
    it('maps another code', () => {
      assert.equal(getDisplayText({ documentStatus: 'DR' }, col), 'Draft');
    });
    it('returns raw code when not in map', () => {
      assert.equal(getDisplayText({ documentStatus: 'XX' }, col), 'XX');
    });
  });

  describe('boolean columns', () => {
    const col = {
      key: 'processed',
      type: 'boolean',
      badgeLabels: { true: 'Complete', false: 'In Process' },
    };
    it('maps true to badge true label', () => {
      assert.equal(getDisplayText({ processed: true }, col), 'Complete');
    });
    it('maps false to badge false label', () => {
      assert.equal(getDisplayText({ processed: false }, col), 'In Process');
    });
    it('maps string "true"', () => {
      assert.equal(getDisplayText({ processed: 'true' }, col), 'Complete');
    });
    it('maps string "Y"', () => {
      assert.equal(getDisplayText({ processed: 'Y' }, col), 'Complete');
    });
  });

  describe('string columns', () => {
    it('returns raw string value', () => {
      const row = { name: 'Sales Order 001' };
      const col = { key: 'name', type: 'string' };
      assert.equal(getDisplayText(row, col), 'Sales Order 001');
    });
    it('returns empty string for null', () => {
      assert.equal(getDisplayText({ name: null }, { key: 'name' }), '');
    });
    it('returns empty string when row is null', () => {
      assert.equal(getDisplayText(null, { key: 'name' }), '');
    });
  });
});

// ---------------------------------------------------------------------------
// parseUserFilter
// ---------------------------------------------------------------------------

describe('parseUserFilter', () => {
  describe('text mode (default)', () => {
    const col = { key: 'name', type: 'string' };
    it('returns text filter for plain input', () => {
      const result = parseUserFilter(col, 'datum');
      assert.deepEqual(result, { mode: 'text', value: 'datum', originalValue: 'datum' });
    });
    it('returns null for empty string', () => {
      assert.equal(parseUserFilter(col, ''), null);
    });
    it('returns null for whitespace', () => {
      assert.equal(parseUserFilter(col, '   '), null);
    });
  });

  describe('date mode', () => {
    const col = { key: 'orderDate', type: 'date', filterMode: 'date' };

    it('parses dd/mm/yyyy as exact date', () => {
      const result = parseUserFilter(col, '14/04/2026');
      assert.deepEqual(result, { mode: 'date', op: '=', value: '2026-04-14', originalValue: '14/04/2026' });
    });

    it('parses ISO yyyy-mm-dd as exact date', () => {
      const result = parseUserFilter(col, '2026-04-14');
      assert.deepEqual(result, { mode: 'date', op: '=', value: '2026-04-14', originalValue: '2026-04-14' });
    });

    it('parses year-only as year range', () => {
      const result = parseUserFilter(col, '2026');
      assert.deepEqual(result, { mode: 'date', op: 'year', value: '2026', originalValue: '2026' });
    });

    it('parses > operator', () => {
      const result = parseUserFilter(col, '>14/04/2026');
      assert.deepEqual(result, { mode: 'date', op: '>', value: '2026-04-14', originalValue: '>14/04/2026' });
    });

    it('parses < operator', () => {
      const result = parseUserFilter(col, '<01/05/2026');
      assert.deepEqual(result, { mode: 'date', op: '<', value: '2026-05-01', originalValue: '<01/05/2026' });
    });

    it('parses >= operator', () => {
      const result = parseUserFilter(col, '>=14/04/2026');
      assert.deepEqual(result, { mode: 'date', op: '>=', value: '2026-04-14', originalValue: '>=14/04/2026' });
    });

    it('parses date range with ..', () => {
      const result = parseUserFilter(col, '01/04/2026..15/04/2026');
      assert.deepEqual(result, { mode: 'date', op: 'range', value: ['2026-04-01', '2026-04-15'], originalValue: '01/04/2026..15/04/2026' });
    });

    it('parses ISO date range', () => {
      const result = parseUserFilter(col, '2026-04-01..2026-04-15');
      assert.deepEqual(result, { mode: 'date', op: 'range', value: ['2026-04-01', '2026-04-15'], originalValue: '2026-04-01..2026-04-15' });
    });

    it('returns null for range with invalid dates', () => {
      assert.equal(parseUserFilter(col, 'abc..def'), null);
    });
  });

  describe('enumLabel mode', () => {
    const col = {
      key: 'documentStatus',
      type: 'status',
      filterMode: 'enumLabel',
      enumLabels: { DR: 'Draft', CO: 'Completed', IP: 'In Process' },
    };

    it('matches full label (case-insensitive)', () => {
      const result = parseUserFilter(col, 'completed');
      assert.deepEqual(result, { mode: 'enumLabel', value: ['CO'], originalValue: 'completed' });
    });

    it('matches partial label', () => {
      const result = parseUserFilter(col, 'comp');
      assert.deepEqual(result, { mode: 'enumLabel', value: ['CO'], originalValue: 'comp' });
    });

    it('matches multiple labels that share the substring', () => {
      const result = parseUserFilter(col, 'dra');
      assert.deepEqual(result, { mode: 'enumLabel', value: ['DR'], originalValue: 'dra' });
    });

    it('returns null when no label matches', () => {
      assert.equal(parseUserFilter(col, 'zzz'), null);
    });
  });

  describe('booleanLabel mode', () => {
    const col = {
      key: 'processed',
      type: 'boolean',
      filterMode: 'booleanLabel',
      badgeLabels: { true: 'Complete', false: 'In Process' },
    };

    it('matches generic "yes" → true', () => {
      assert.deepEqual(parseUserFilter(col, 'yes'), { mode: 'booleanLabel', value: true, originalValue: 'yes' });
    });

    it('matches generic "no" → false', () => {
      assert.deepEqual(parseUserFilter(col, 'no'), { mode: 'booleanLabel', value: false, originalValue: 'no' });
    });

    it('matches badge true label', () => {
      assert.deepEqual(parseUserFilter(col, 'comp'), { mode: 'booleanLabel', value: true, originalValue: 'comp' });
    });

    it('matches badge false label (partial)', () => {
      assert.deepEqual(parseUserFilter(col, 'in proc'), { mode: 'booleanLabel', value: false, originalValue: 'in proc' });
    });

    it('returns null when no match', () => {
      assert.equal(parseUserFilter(col, 'unknown'), null);
    });
  });

  describe('numeric mode', () => {
    const col = { key: 'grandTotal', type: 'amount', filterMode: 'numeric' };

    it('parses plain number as equality', () => {
      assert.deepEqual(parseUserFilter(col, '1234.5'), { mode: 'numeric', op: '=', value: 1234.5, originalValue: '1234.5' });
    });

    it('parses localized number (comma thousands separator)', () => {
      assert.deepEqual(parseUserFilter(col, '1,234.5'), { mode: 'numeric', op: '=', value: 1234.5, originalValue: '1,234.5' });
    });

    it('parses > operator', () => {
      assert.deepEqual(parseUserFilter(col, '>1000'), { mode: 'numeric', op: '>', value: 1000, originalValue: '>1000' });
    });

    it('parses < operator', () => {
      assert.deepEqual(parseUserFilter(col, '<5000'), { mode: 'numeric', op: '<', value: 5000, originalValue: '<5000' });
    });

    it('returns null for non-numeric input', () => {
      assert.equal(parseUserFilter(col, 'abc'), null);
    });
  });

  describe('identifier mode (selector)', () => {
    const col = { key: 'businessPartner', type: 'selector', filterMode: 'identifier' };

    it('returns identifier filter', () => {
      assert.deepEqual(parseUserFilter(col, 'datum'), { mode: 'identifier', value: 'datum', originalValue: 'datum' });
    });
  });
});

// ---------------------------------------------------------------------------
// resolveBackendSort
// ---------------------------------------------------------------------------

describe('resolveBackendSort', () => {
  it('uses backendSortKey when explicitly defined', () => {
    const col = { key: 'bp', type: 'selector', backendSortKey: 'bp$_identifier' };
    assert.equal(resolveBackendSort(col, 'asc'), 'bp$_identifier asc');
    assert.equal(resolveBackendSort(col, 'desc'), 'bp$_identifier desc');
  });

  it('infers $\_identifier sort for selector type (no backendSortKey)', () => {
    const col = { key: 'businessPartner', type: 'selector' };
    assert.equal(resolveBackendSort(col, 'asc'), 'businessPartner$_identifier asc');
    assert.equal(resolveBackendSort(col, 'desc'), 'businessPartner$_identifier desc');
  });

  it('uses raw column for string type', () => {
    const col = { key: 'name', type: 'string' };
    assert.equal(resolveBackendSort(col, 'asc'), 'name asc');
  });

  it('uses raw column for date type', () => {
    const col = { key: 'orderDate', type: 'date' };
    assert.equal(resolveBackendSort(col, 'desc'), 'orderDate desc');
  });

  it('uses raw column for amount type', () => {
    const col = { key: 'grandTotal', type: 'amount' };
    assert.equal(resolveBackendSort(col, 'asc'), 'grandTotal asc');
  });

  it('uses raw column for status type (enum backend sort fallback)', () => {
    const col = {
      key: 'documentStatus',
      type: 'status',
      enumLabels: { DR: 'Draft', CO: 'Completed' },
    };
    assert.equal(resolveBackendSort(col, 'asc'), 'documentStatus asc');
  });

  it('uses raw column for boolean type', () => {
    const col = {
      key: 'processed',
      type: 'boolean',
      badgeLabels: { true: 'Complete', false: 'In Process' },
    };
    assert.equal(resolveBackendSort(col, 'desc'), 'processed desc');
  });

  it('handles null col gracefully (raw fallback)', () => {
    assert.equal(resolveBackendSort(null, 'asc'), ' asc');
  });

  it('handles missing type gracefully (raw fallback)', () => {
    const col = { key: 'someField' };
    assert.equal(resolveBackendSort(col, 'asc'), 'someField asc');
  });

  it('does not depend on sample row presence', () => {
    const col = { key: 'businessPartner', type: 'selector' };
    // No sampleRow involved — pure metadata
    const result = resolveBackendSort(col, 'asc');
    assert.equal(result, 'businessPartner$_identifier asc');
  });
});

// ---------------------------------------------------------------------------
// buildBackendFilter
// ---------------------------------------------------------------------------

describe('buildBackendFilter', () => {
  it('returns null for null parsed input', () => {
    assert.equal(buildBackendFilter({ key: 'name' }, null), null);
  });

  it('returns null when col is missing key', () => {
    assert.equal(buildBackendFilter({}, { mode: 'text', value: 'x' }), null);
  });

  describe('text mode', () => {
    it('produces iContains criterion', () => {
      const result = buildBackendFilter({ key: 'name' }, { mode: 'text', value: 'datum' });
      assert.deepEqual(result, [{ fieldName: 'name', operator: 'iContains', value: 'datum' }]);
    });
  });

  describe('identifier mode', () => {
    it('appends $\_identifier with iContains by default', () => {
      const col = { key: 'businessPartner', type: 'selector' };
      const parsed = { mode: 'identifier', value: 'datum' };
      assert.deepEqual(buildBackendFilter(col, parsed), [
        { fieldName: 'businessPartner$_identifier', operator: 'iContains', value: 'datum' },
      ]);
    });

    it('respects explicit backendFilterKey', () => {
      const col = { key: 'bp', backendFilterKey: 'bp$name' };
      const parsed = { mode: 'identifier', value: 'acme' };
      assert.deepEqual(buildBackendFilter(col, parsed), [
        { fieldName: 'bp$name', operator: 'iContains', value: 'acme' },
      ]);
    });
  });

  describe('enumLabel mode', () => {
    const col = { key: 'documentStatus' };

    it('produces equals criterion for single code', () => {
      const parsed = { mode: 'enumLabel', value: ['CO'] };
      assert.deepEqual(buildBackendFilter(col, parsed), [
        { fieldName: 'documentStatus', operator: 'equals', value: 'CO' },
      ]);
    });

    it('produces inSet criterion for multiple codes', () => {
      const parsed = { mode: 'enumLabel', value: ['CO', 'IP'] };
      assert.deepEqual(buildBackendFilter(col, parsed), [
        { fieldName: 'documentStatus', operator: 'inSet', value: 'CO,IP' },
      ]);
    });
  });

  describe('booleanLabel mode', () => {
    const col = { key: 'processed' };

    it('produces equals true criterion', () => {
      assert.deepEqual(buildBackendFilter(col, { mode: 'booleanLabel', value: true }), [
        { fieldName: 'processed', operator: 'equals', value: true },
      ]);
    });

    it('produces equals false criterion', () => {
      assert.deepEqual(buildBackendFilter(col, { mode: 'booleanLabel', value: false }), [
        { fieldName: 'processed', operator: 'equals', value: false },
      ]);
    });
  });

  describe('numeric mode', () => {
    const col = { key: 'grandTotal' };

    it('produces equals criterion', () => {
      assert.deepEqual(buildBackendFilter(col, { mode: 'numeric', op: '=', value: 1234 }), [
        { fieldName: 'grandTotal', operator: 'equals', value: 1234 },
      ]);
    });

    it('produces greaterThan criterion', () => {
      assert.deepEqual(buildBackendFilter(col, { mode: 'numeric', op: '>', value: 1000 }), [
        { fieldName: 'grandTotal', operator: 'greaterThan', value: 1000 },
      ]);
    });

    it('produces lessThan criterion', () => {
      assert.deepEqual(buildBackendFilter(col, { mode: 'numeric', op: '<', value: 5000 }), [
        { fieldName: 'grandTotal', operator: 'lessThan', value: 5000 },
      ]);
    });
  });

  describe('date mode', () => {
    const col = { key: 'orderDate' };

    it('produces full-day range criterion for exact date', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: '=', value: '2026-04-14' }),
        [
          { fieldName: 'orderDate', operator: 'greaterOrEqual', value: '2026-04-14' },
          { fieldName: 'orderDate', operator: 'lessOrEqual', value: '2026-04-14' },
        ],
      );
    });

    it('produces greaterOrEqual + lessOrEqual criteria for year range', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: 'year', value: '2026' }),
        [
          { fieldName: 'orderDate', operator: 'greaterOrEqual', value: '2026-01-01' },
          { fieldName: 'orderDate', operator: 'lessOrEqual', value: '2026-12-31' },
        ],
      );
    });

    it('produces greaterOrEqual on next day for strict >', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: '>', value: '2026-04-14' }),
        [{ fieldName: 'orderDate', operator: 'greaterOrEqual', value: '2026-04-15' }],
      );
    });

    it('produces lessOrEqual on previous day for strict <', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: '<', value: '2026-04-15' }),
        [{ fieldName: 'orderDate', operator: 'lessOrEqual', value: '2026-04-14' }],
      );
    });

    it('produces greaterOrEqual as-is for >=', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: '>=', value: '2026-04-14' }),
        [{ fieldName: 'orderDate', operator: 'greaterOrEqual', value: '2026-04-14' }],
      );
    });

    it('produces lessOrEqual as-is for <=', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: '<=', value: '2026-04-15' }),
        [{ fieldName: 'orderDate', operator: 'lessOrEqual', value: '2026-04-15' }],
      );
    });

    it('produces greaterOrEqual + lessOrEqual for date range', () => {
      assert.deepEqual(
        buildBackendFilter(col, { mode: 'date', op: 'range', value: ['2026-04-01', '2026-04-15'] }),
        [
          { fieldName: 'orderDate', operator: 'greaterOrEqual', value: '2026-04-01' },
          { fieldName: 'orderDate', operator: 'lessOrEqual', value: '2026-04-15' },
        ],
      );
    });

    it('respects explicit backendFilterKey', () => {
      const col2 = { key: 'orderDate', backendFilterKey: 'c_order.dateordered' };
      assert.deepEqual(
        buildBackendFilter(col2, { mode: 'date', op: '=', value: '2026-04-14' }),
        [
          { fieldName: 'c_order.dateordered', operator: 'greaterOrEqual', value: '2026-04-14' },
          { fieldName: 'c_order.dateordered', operator: 'lessOrEqual', value: '2026-04-14' },
        ],
      );
    });
  });
});
