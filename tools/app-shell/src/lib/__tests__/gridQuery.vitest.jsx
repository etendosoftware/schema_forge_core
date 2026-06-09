import {
  getDisplayText,
  parseUserFilter,
  resolveBackendSort,
  buildBackendFilter,
  resolveFilterMode,
  buildAdvancedFilterCriteria,
} from '../gridQuery.js';

// ---------------------------------------------------------------------------
// getDisplayText
// ---------------------------------------------------------------------------

describe('getDisplayText', () => {
  it('returns $_identifier for selector columns', () => {
    const row = { bp: 'uuid-1', 'bp$_identifier': 'Acme Corp' };
    const col = { key: 'bp', type: 'selector' };
    expect(getDisplayText(row, col)).toBe('Acme Corp');
  });

  it('returns row[key].name as fallback for object-shaped data', () => {
    const row = { bp: { id: '1', name: 'Acme' } };
    const col = { key: 'bp', type: 'selector' };
    expect(getDisplayText(row, col)).toBe('Acme');
  });

  it('returns raw value when no identifier found', () => {
    const row = { bp: 'some-uuid' };
    const col = { key: 'bp', type: 'selector' };
    expect(getDisplayText(row, col)).toBe('some-uuid');
  });

  it('maps enum labels for status columns', () => {
    const col = { key: 'status', type: 'status', enumLabels: { DR: 'Draft', CO: 'Completed' } };
    expect(getDisplayText({ status: 'DR' }, col)).toBe('Draft');
    expect(getDisplayText({ status: 'CO' }, col)).toBe('Completed');
  });

  it('returns raw code when enum label not found', () => {
    const col = { key: 'status', type: 'status', enumLabels: { DR: 'Draft' } };
    expect(getDisplayText({ status: 'XX' }, col)).toBe('XX');
  });

  it('maps boolean badge labels (plain strings)', () => {
    const col = { key: 'active', type: 'boolean', badgeLabels: { true: 'Yes', false: 'No' } };
    expect(getDisplayText({ active: true }, col)).toBe('Yes');
    expect(getDisplayText({ active: false }, col)).toBe('No');
    expect(getDisplayText({ active: 'Y' }, col)).toBe('Yes');
  });

  it('maps boolean badge labels (multilingual objects) — picks es_ES or en_US', () => {
    const col = {
      key: 'fullyDepreciated', type: 'boolean',
      badgeLabels: {
        true: { es_ES: 'Totalmente depreciado', en_US: 'Fully deprecated' },
        false: { es_ES: 'En progreso', en_US: 'In progress' },
      },
    };
    // tryBooleanText should not return "[object Object]"
    const result = getDisplayText({ fullyDepreciated: true }, col);
    expect(result).toBe('Totalmente depreciado');
    expect(getDisplayText({ fullyDepreciated: false }, col)).toBe('En progreso');
  });

  it('returns empty string for null row or col', () => {
    expect(getDisplayText(null, { key: 'x' })).toBe('');
    expect(getDisplayText({ x: 1 }, null)).toBe('');
    expect(getDisplayText({ x: 1 }, {})).toBe('');
  });

  it('returns empty string for null values', () => {
    expect(getDisplayText({ name: null }, { key: 'name' })).toBe('');
    expect(getDisplayText({ name: undefined }, { key: 'name' })).toBe('');
  });

  it('coerces numbers to string', () => {
    expect(getDisplayText({ amount: 42 }, { key: 'amount' })).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// resolveFilterMode
// ---------------------------------------------------------------------------

describe('resolveFilterMode', () => {
  it('returns text for null col', () => {
    expect(resolveFilterMode(null)).toBe('text');
  });

  it('respects explicit filterMode', () => {
    expect(resolveFilterMode({ key: 'x', filterMode: 'numeric' })).toBe('numeric');
  });

  it('infers identifier for selector type', () => {
    expect(resolveFilterMode({ key: 'bp', type: 'selector' })).toBe('identifier');
  });

  it('infers date for date type', () => {
    expect(resolveFilterMode({ key: 'd', type: 'date' })).toBe('date');
  });

  it('infers enumLabel for status type', () => {
    expect(resolveFilterMode({ key: 's', type: 'status' })).toBe('enumLabel');
  });

  it('infers booleanLabel for boolean type', () => {
    expect(resolveFilterMode({ key: 'b', type: 'boolean' })).toBe('booleanLabel');
  });

  it('infers numeric for number and amount types', () => {
    expect(resolveFilterMode({ key: 'n', type: 'number' })).toBe('numeric');
    expect(resolveFilterMode({ key: 'a', type: 'amount' })).toBe('numeric');
  });

  it('infers identifier for column names ending in _ID', () => {
    expect(resolveFilterMode({ key: 'bp', column: 'C_BPartner_ID' })).toBe('identifier');
  });

  it('defaults to text for unknown type', () => {
    expect(resolveFilterMode({ key: 'x' })).toBe('text');
    expect(resolveFilterMode({ key: 'x', type: 'string' })).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// parseUserFilter
// ---------------------------------------------------------------------------

describe('parseUserFilter', () => {
  it('returns null for empty/null input', () => {
    expect(parseUserFilter({ key: 'x' }, '')).toBeNull();
    expect(parseUserFilter({ key: 'x' }, null)).toBeNull();
    expect(parseUserFilter({ key: 'x' }, '   ')).toBeNull();
  });

  it('parses text mode', () => {
    const result = parseUserFilter({ key: 'name', type: 'string' }, 'hello');
    expect(result).toEqual({ mode: 'text', value: 'hello', originalValue: 'hello' });
  });

  it('parses date with dd/mm/yyyy', () => {
    const col = { key: 'd', type: 'date' };
    const result = parseUserFilter(col, '14/04/2026');
    expect(result).toEqual({ mode: 'date', op: '=', value: '2026-04-14', originalValue: '14/04/2026' });
  });

  it('parses date range with ..', () => {
    const col = { key: 'd', type: 'date' };
    const result = parseUserFilter(col, '2026-01-01..2026-12-31');
    expect(result).toEqual({
      mode: 'date', op: 'range', value: ['2026-01-01', '2026-12-31'],
      originalValue: '2026-01-01..2026-12-31',
    });
  });

  it('parses year-only date', () => {
    const col = { key: 'd', type: 'date' };
    expect(parseUserFilter(col, '2026')).toEqual({
      mode: 'date', op: 'year', value: '2026', originalValue: '2026',
    });
  });

  it('parses date with operators', () => {
    const col = { key: 'd', type: 'date' };
    expect(parseUserFilter(col, '>=2026-04-01').op).toBe('>=');
    expect(parseUserFilter(col, '<2026-04-01').op).toBe('<');
  });

  it('returns null for invalid date range', () => {
    const col = { key: 'd', type: 'date' };
    expect(parseUserFilter(col, 'abc..def')).toBeNull();
  });

  it('parses enum label matching', () => {
    const col = { key: 's', type: 'status', enumLabels: { DR: 'Draft', CO: 'Completed' } };
    expect(parseUserFilter(col, 'draft')).toEqual({
      mode: 'enumLabel', value: ['DR'], originalValue: 'draft',
    });
  });

  it('parses enum direct code', () => {
    const col = { key: 's', type: 'status', enumLabels: { DR: 'Draft', CO: 'Completed' } };
    expect(parseUserFilter(col, 'DR')).toEqual({
      mode: 'enumLabel', value: ['DR'], originalValue: 'DR',
    });
  });

  it('returns null when no enum label matches', () => {
    const col = { key: 's', type: 'status', enumLabels: { DR: 'Draft' } };
    expect(parseUserFilter(col, 'zzz')).toBeNull();
  });

  it('parses boolean labels', () => {
    const col = { key: 'b', type: 'boolean', badgeLabels: { true: 'Active', false: 'Inactive' } };
    expect(parseUserFilter(col, 'yes').value).toBe(true);
    expect(parseUserFilter(col, 'no').value).toBe(false);
    expect(parseUserFilter(col, 'act').value).toBe(true);
    expect(parseUserFilter(col, 'inact').value).toBe(false);
    expect(parseUserFilter(col, 'unknown')).toBeNull();
  });

  it('parses numeric with operators', () => {
    const col = { key: 'n', type: 'amount' };
    expect(parseUserFilter(col, '>1000')).toEqual({
      mode: 'numeric', op: '>', value: 1000, originalValue: '>1000',
    });
    expect(parseUserFilter(col, '1,234.5')).toEqual({
      mode: 'numeric', op: '=', value: 1234.5, originalValue: '1,234.5',
    });
    expect(parseUserFilter(col, 'abc')).toBeNull();
  });

  it('parses identifier mode', () => {
    const col = { key: 'bp', type: 'selector' };
    expect(parseUserFilter(col, 'acme')).toEqual({
      mode: 'identifier', value: 'acme', originalValue: 'acme',
    });
  });
});

// ---------------------------------------------------------------------------
// resolveBackendSort
// ---------------------------------------------------------------------------

describe('resolveBackendSort', () => {
  it('uses minus-prefix for identifier desc', () => {
    const col = { key: 'bp', type: 'selector' };
    expect(resolveBackendSort(col, 'desc')).toBe('-bp$_identifier');
    expect(resolveBackendSort(col, 'asc')).toBe('bp$_identifier');
  });

  it('respects explicit backendSortKey', () => {
    const col = { key: 'bp', backendSortKey: 'custom$_identifier' };
    expect(resolveBackendSort(col, 'asc')).toBe('custom$_identifier');
    expect(resolveBackendSort(col, 'desc')).toBe('-custom$_identifier');
  });

  it('uses space suffix for raw sort', () => {
    expect(resolveBackendSort({ key: 'name', type: 'string' }, 'asc')).toBe('name asc');
    expect(resolveBackendSort({ key: 'name', type: 'string' }, 'desc')).toBe('name desc');
  });

  it('uses space suffix for date and amount', () => {
    expect(resolveBackendSort({ key: 'orderDate', type: 'date' }, 'desc')).toBe('orderDate desc');
    expect(resolveBackendSort({ key: 'total', type: 'amount' }, 'asc')).toBe('total asc');
  });

  it('handles null col gracefully', () => {
    expect(resolveBackendSort(null, 'asc')).toBe(' asc');
  });
});

// ---------------------------------------------------------------------------
// buildBackendFilter
// ---------------------------------------------------------------------------

describe('buildBackendFilter', () => {
  it('returns null for null parsed or missing key', () => {
    expect(buildBackendFilter({ key: 'x' }, null)).toBeNull();
    expect(buildBackendFilter({}, { mode: 'text', value: 'y' })).toBeNull();
  });

  it('builds text iContains', () => {
    expect(buildBackendFilter({ key: 'name' }, { mode: 'text', value: 'abc' })).toEqual([
      { fieldName: 'name', operator: 'iContains', value: 'abc' },
    ]);
  });

  it('builds identifier iContains with $_identifier suffix', () => {
    expect(buildBackendFilter({ key: 'bp', type: 'selector' }, { mode: 'identifier', value: 'acme' })).toEqual([
      { fieldName: 'bp$_identifier', operator: 'iContains', value: 'acme' },
    ]);
  });

  it('builds identifier with explicit backendFilterKey', () => {
    expect(buildBackendFilter({ key: 'bp', backendFilterKey: 'bp$name' }, { mode: 'identifier', value: 'x' })).toEqual([
      { fieldName: 'bp$name', operator: 'iContains', value: 'x' },
    ]);
  });

  it('builds enumLabel equals for single code', () => {
    expect(buildBackendFilter({ key: 's' }, { mode: 'enumLabel', value: ['DR'] })).toEqual([
      { fieldName: 's', operator: 'equals', value: 'DR' },
    ]);
  });

  it('builds enumLabel inSet for multiple codes', () => {
    expect(buildBackendFilter({ key: 's' }, { mode: 'enumLabel', value: ['DR', 'CO'] })).toEqual([
      { fieldName: 's', operator: 'inSet', value: 'DR,CO' },
    ]);
  });

  it('builds booleanLabel equals', () => {
    expect(buildBackendFilter({ key: 'b' }, { mode: 'booleanLabel', value: true })).toEqual([
      { fieldName: 'b', operator: 'equals', value: true },
    ]);
  });

  it('builds numeric with various operators', () => {
    expect(buildBackendFilter({ key: 'n' }, { mode: 'numeric', op: '>', value: 100 })).toEqual([
      { fieldName: 'n', operator: 'greaterThan', value: 100 },
    ]);
    expect(buildBackendFilter({ key: 'n' }, { mode: 'numeric', op: '<=', value: 50 })).toEqual([
      { fieldName: 'n', operator: 'lessOrEqual', value: 50 },
    ]);
  });

  it('builds date exact as day range', () => {
    expect(buildBackendFilter({ key: 'd' }, { mode: 'date', op: '=', value: '2026-04-14' })).toEqual([
      { fieldName: 'd', operator: 'greaterOrEqual', value: '2026-04-14' },
      { fieldName: 'd', operator: 'lessOrEqual', value: '2026-04-14' },
    ]);
  });

  it('builds date year range', () => {
    expect(buildBackendFilter({ key: 'd' }, { mode: 'date', op: 'year', value: '2026' })).toEqual([
      { fieldName: 'd', operator: 'greaterOrEqual', value: '2026-01-01' },
      { fieldName: 'd', operator: 'lessOrEqual', value: '2026-12-31' },
    ]);
  });

  it('builds date range with ..', () => {
    expect(buildBackendFilter({ key: 'd' }, { mode: 'date', op: 'range', value: ['2026-01-01', '2026-12-31'] })).toEqual([
      { fieldName: 'd', operator: 'greaterOrEqual', value: '2026-01-01' },
      { fieldName: 'd', operator: 'lessOrEqual', value: '2026-12-31' },
    ]);
  });

  it('shifts date for strict > and <', () => {
    expect(buildBackendFilter({ key: 'd' }, { mode: 'date', op: '>', value: '2026-04-14' })).toEqual([
      { fieldName: 'd', operator: 'greaterOrEqual', value: '2026-04-15' },
    ]);
    expect(buildBackendFilter({ key: 'd' }, { mode: 'date', op: '<', value: '2026-04-15' })).toEqual([
      { fieldName: 'd', operator: 'lessOrEqual', value: '2026-04-14' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildAdvancedFilterCriteria
// ---------------------------------------------------------------------------

describe('buildAdvancedFilterCriteria', () => {
  const columns = [
    { key: 'name', type: 'string' },
    { key: 'amount', type: 'amount' },
    { key: 'bp', type: 'selector' },
  ];

  it('returns null for empty conditions', () => {
    expect(buildAdvancedFilterCriteria({ conditions: [] }, columns)).toBeNull();
    expect(buildAdvancedFilterCriteria(null, columns)).toBeNull();
  });

  it('builds AND criteria flat', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: 'iContains', value: 'test' },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([
      { fieldName: 'name', operator: 'iContains', value: 'test' },
    ]);
  });

  it('wraps OR conditions in AdvancedCriteria', () => {
    const filter = {
      rowOperator: 'or',
      conditions: [
        { field: 'name', operator: 'iContains', value: 'a' },
        { field: 'name', operator: 'iContains', value: 'b' },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toHaveLength(1);
    expect(result[0]._constructor).toBe('AdvancedCriteria');
    expect(result[0].operator).toBe('or');
    expect(result[0].criteria).toHaveLength(2);
  });

  it('skips unknown columns', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'unknown', operator: 'iContains', value: 'x' },
      ],
    };
    expect(buildAdvancedFilterCriteria(filter, columns)).toBeNull();
  });

  it('handles isNull operator', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: 'isNull', value: null },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([{ fieldName: 'name', operator: 'isNull' }]);
  });

  it('handles between operator', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'amount', operator: 'between', value: ['100', '500'] },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([
      { fieldName: 'amount', operator: 'greaterOrEqual', value: 100 },
      { fieldName: 'amount', operator: 'lessOrEqual', value: 500 },
    ]);
  });

  it('handles inSet operator', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: 'inSet', value: ['a', 'b', 'c'] },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([
      { fieldName: 'name', operator: 'inSet', value: 'a,b,c' },
    ]);
  });

  it('handles multi-value array with OR composition', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: 'equals', value: ['x', 'y'] },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toHaveLength(1);
    expect(result[0]._constructor).toBe('AdvancedCriteria');
    expect(result[0].operator).toBe('or');
  });

  it('returns null when operator is missing', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'name', operator: null, value: 'x' },
      ],
    };
    expect(buildAdvancedFilterCriteria(filter, columns)).toBeNull();
  });

  it('uses identifier field for textual ops on selector columns', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'bp', operator: 'iContains', value: 'acme' },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([
      { fieldName: 'bp$_identifier', operator: 'iContains', value: 'acme' },
    ]);
  });

  it('uses raw key for discrete ops on selector columns', () => {
    const filter = {
      rowOperator: 'and',
      conditions: [
        { field: 'bp', operator: 'equals', value: 'uuid-1' },
      ],
    };
    const result = buildAdvancedFilterCriteria(filter, columns);
    expect(result).toEqual([
      { fieldName: 'bp', operator: 'equals', value: 'uuid-1' },
    ]);
  });
});