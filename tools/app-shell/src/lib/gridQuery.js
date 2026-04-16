/**
 * gridQuery.js — Display-aware grid filtering and sorting utilities.
 *
 * Three coordinated responsibilities:
 *   1. Display text resolution  — what the user actually sees in a cell
 *   2. Input parsing            — interpret user-typed input per column type
 *   3. Backend query generation — translate parsed input to NEO Headless params
 *
 * Column metadata shape (all fields optional unless noted):
 * {
 *   key: string,               // column field name (required)
 *   type: 'string' | 'date' | 'selector' | 'status' | 'boolean' | 'number' | 'amount',
 *
 *   // Filter config
 *   filterMode: 'text' | 'date' | 'identifier' | 'enumLabel' | 'booleanLabel' | 'numeric',
 *   backendFilterKey: string,  // explicit backend field for filtering (e.g. 'bp$_identifier')
 *   enumLabels: { [rawCode]: displayLabel },
 *   badgeLabels: { true: string, false: string },
 *
 *   // Sort config
 *   sortMode: 'raw' | 'identifier' | 'enumLabel' | 'booleanLabel',
 *   backendSortKey: string,    // explicit backend field for sorting (overrides sortMode)
 *   enumOrder: string[],       // optional explicit raw-code order for enum label sort
 * }
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DATE_SEPARATOR_RE = /[/\-.]/;

/**
 * Shift a yyyy-mm-dd date string by N days and return a new yyyy-mm-dd string.
 */
function shiftDate(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Try to parse a locale date string (dd/mm/yyyy, yyyy-mm-dd, etc.) to a
 * yyyy-mm-dd string.  Returns null when the input cannot be parsed.
 */
function parseDateString(input) {
  const trimmed = input.trim();

  // ISO yyyy-mm-dd (or ISO datetime prefix)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy  or  yyyy/mm/dd
  const parts = trimmed.split(DATE_SEPARATOR_RE);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (!Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(c)) {
      if (c > 999) {
        // dd/mm/yyyy — most common locale format
        const dd = String(a).padStart(2, '0');
        const mm = String(b).padStart(2, '0');
        return `${c}-${mm}-${dd}`;
      }
      if (a > 999) {
        // yyyy/mm/dd
        const mm = String(b).padStart(2, '0');
        const dd = String(c).padStart(2, '0');
        return `${a}-${mm}-${dd}`;
      }
    }
  }

  return null;
}

/**
 * Extract a numeric comparison from an operator-prefixed string.
 * Returns { op, value } where op is '=', '>', '<', '>=', '<=' or null for plain.
 */
function parseNumericExpression(input) {
  const trimmed = input.trim();
  const match = /^(>=|<=|>|<|=)\s*(.+)$/.exec(trimmed);
  if (match) return { op: match[1], value: Number.parseFloat(match[2].replaceAll(',', '')) };
  const plain = Number.parseFloat(trimmed.replaceAll(',', ''));
  if (!Number.isNaN(plain)) return { op: '=', value: plain };
  return null;
}

/**
 * Invert an enumLabels map to allow lookup by visible label.
 * Returns a Map of normalizedLabel → rawCode.
 */
function invertEnumLabels(enumLabels) {
  const map = new Map();
  if (!enumLabels || typeof enumLabels !== 'object') return map;
  for (const [raw, label] of Object.entries(enumLabels)) {
    map.set(String(label).toLowerCase(), raw);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * getDisplayText(row, col)
 *
 * Return the exact user-facing textual representation for a cell.
 * This is what you see in the grid — used for local (fallback) filtering,
 * export, and QA debugging.
 *
 * @param {object} row   - full data row from the API
 * @param {object} col   - column metadata (see file header)
 * @returns {string}
 */
export function getDisplayText(row, col) {
  if (!row || !col?.key) return '';
  return resolveDisplayValue(row, col);
}

function resolveDisplayValue(row, col) {
  const key = col.key;
  const raw = row[key];

  const selectorText = trySelectorText(row, key, raw, col);
  if (selectorText !== null) return selectorText;

  const enumText = tryEnumText(raw, col);
  if (enumText !== null) return enumText;

  const boolText = tryBooleanText(raw, col);
  if (boolText !== null) return boolText;

  return raw == null ? '' : String(raw);
}

function trySelectorText(row, key, raw, col) {
  if (col.type !== 'selector' && col.filterMode !== 'identifier') return null;
  const identifier = row[`${key}$_identifier`];
  if (identifier != null) return String(identifier);
  if (raw && typeof raw === 'object' && raw.name) return String(raw.name);
  return null;
}

function tryEnumText(raw, col) {
  if ((col.type !== 'status' && col.filterMode !== 'enumLabel') || !col.enumLabels) return null;
  const label = col.enumLabels[raw];
  return label == null ? null : String(label);
}

function tryBooleanText(raw, col) {
  if ((col.type !== 'boolean' && col.filterMode !== 'booleanLabel') || !col.badgeLabels) return null;
  const boolKey = raw === true || raw === 'true' || raw === 'Y' ? 'true' : 'false';
  const label = col.badgeLabels[boolKey];
  return label == null ? null : String(label);
}

/**
 * parseUserFilter(col, input)
 *
 * Interpret user-typed input according to column type and return a parsed
 * filter descriptor.  The descriptor is opaque but can be passed to
 * buildBackendFilter().
 *
 * Returns null when the input is empty or cannot be interpreted.
 *
 * @param {object}      col   - column metadata
 * @param {string}      input - raw user input
 * @returns {ParsedFilter|null}
 *
 * ParsedFilter shape:
 * { mode, value, op? }
 * where mode matches the filterMode used.
 */
export function parseUserFilter(col, input) {
  if (input === null || String(input).trim() === '') return null;
  const trimmed = String(input).trim();
  const mode = col.filterMode ?? inferFilterMode(col.type);
  const parsed = parseByMode(mode, trimmed, col);
  if (parsed) {
    parsed.originalValue = input;
  }
  return parsed;
}

function parseByMode(mode, trimmed, col) {
  switch (mode) {
    case 'date':        return parseDateFilter(trimmed);
    case 'enumLabel':   return parseEnumLabelFilter(trimmed, col);
    case 'booleanLabel': return parseBooleanLabelFilter(trimmed, col);
    case 'numeric':     return parseNumericFilter(trimmed);
    case 'identifier':  return { mode: 'identifier', value: trimmed };
    default:            return { mode: 'text', value: trimmed };
  }
}

function parseDateFilter(trimmed) {
  // Range: "01/04/2026..15/04/2026"
  const rangeMatch = /^(.+?)\.\.(.+)$/.exec(trimmed);
  if (rangeMatch) {
    const from = parseDateString(rangeMatch[1].trim());
    const to = parseDateString(rangeMatch[2].trim());
    if (from && to) return { mode: 'date', op: 'range', value: [from, to] };
  }

  const opMatch = /^(>=|<=|>|<|=)\s*(.+)$/.exec(trimmed);
  if (opMatch) {
    const parsed = parseDateString(opMatch[2]);
    return parsed ? { mode: 'date', op: opMatch[1], value: parsed } : null;
  }
  if (/^\d{4}$/.test(trimmed)) return { mode: 'date', op: 'year', value: trimmed };
  const parsed = parseDateString(trimmed);
  return parsed ? { mode: 'date', op: '=', value: parsed } : null;
}

function parseEnumLabelFilter(trimmed, col) {
  const invertedMap = invertEnumLabels(col.enumLabels);
  const lower = trimmed.toLowerCase();
  const matches = [];
  for (const [normalizedLabel, rawCode] of invertedMap) {
    if (normalizedLabel.includes(lower)) matches.push(rawCode);
  }
  return matches.length === 0 ? null : { mode: 'enumLabel', value: matches };
}

const GENERIC_TRUE = new Set(['true', 'yes', 'si', 'sí', '1', 'y']);
const GENERIC_FALSE = new Set(['false', 'no', '0', 'n']);

function parseBooleanLabelFilter(trimmed, col) {
  const lower = trimmed.toLowerCase();
  if (GENERIC_TRUE.has(lower)) return { mode: 'booleanLabel', value: true };
  if (GENERIC_FALSE.has(lower)) return { mode: 'booleanLabel', value: false };
  if (!col.badgeLabels) return null;
  const trueLabel = String(col.badgeLabels.true ?? '').toLowerCase();
  const falseLabel = String(col.badgeLabels.false ?? '').toLowerCase();
  if (trueLabel?.includes(lower)) return { mode: 'booleanLabel', value: true };
  if (falseLabel?.includes(lower)) return { mode: 'booleanLabel', value: false };
  return null;
}

function parseNumericFilter(trimmed) {
  const numeric = parseNumericExpression(trimmed);
  return numeric ? { mode: 'numeric', op: numeric.op, value: numeric.value } : null;
}

/**
 * resolveBackendSort(col, direction)
 *
 * Return the `_sortBy` value for the column — ready to be appended to the
 * NEO Headless query string as `_sortBy=<result>`.
 *
 * Does NOT depend on sample rows.  Column metadata is the single source of truth.
 *
 * @param {object}           col       - column metadata (key is required)
 * @param {'asc'|'desc'}     direction - sort direction
 * @returns {string}                   - e.g. 'businessPartner$_identifier asc'
 */
export function resolveBackendSort(col, direction) {
  const dir = direction === 'desc' ? 'desc' : 'asc';
  const key = col?.key ?? '';

  // Explicit override always wins
  if (col?.backendSortKey) return `${col.backendSortKey} ${dir}`;

  const sortMode = col?.sortMode ?? inferSortMode(col?.type, col);

  switch (sortMode) {
    case 'identifier':
      // FK / selector: sort by the companion identifier field
      return `${key}$_identifier ${dir}`;

    case 'enumLabel':
    case 'booleanLabel':
      // Best effort: sort by raw column on backend; Stage 6 will add client-side resort
      return `${key} ${dir}`;

    default:
      // 'raw' and everything else: sort by raw column
      return `${key} ${dir}`;
  }
}

/**
 * buildBackendFilter(col, parsed)
 *
 * Transform a ParsedFilter (from parseUserFilter) into an array of SmartClient
 * criteria objects understood by Etendo's DataSourceServlet / AdvancedQueryBuilder.
 *
 * Returns null when the parsed input is null or cannot produce a valid filter.
 *
 * @param {object}        col    - column metadata
 * @param {ParsedFilter}  parsed - result from parseUserFilter
 * @returns {Array<{fieldName:string, operator:string, value:*}>|null}
 */
export function buildBackendFilter(col, parsed) {
  if (!parsed || !col?.key) return null;

  const COMPARISON_OP = {
    '=': 'equals',
    '>': 'greaterThan',
    '<': 'lessThan',
    '>=': 'greaterOrEqual',
    '<=': 'lessOrEqual',
  };

  switch (parsed.mode) {
    case 'date': {
      const field = col.backendFilterKey ?? col.key;
      if (parsed.op === 'year') {
        return [
          { fieldName: field, operator: 'greaterOrEqual', value: `${parsed.value}-01-01` },
          { fieldName: field, operator: 'lessOrEqual', value: `${parsed.value}-12-31` },
        ];
      }
      // All date comparisons use day-level ranges because backend stores datetime.
      // "< date" means "before that day" → lessOrEqual on previous day
      // "> date" means "after that day"  → greaterOrEqual on next day
      // "= date" means "that exact day"  → greaterOrEqual + lessOrEqual
      // "<= date" and ">= date" include the boundary day
      if (parsed.op === 'range') {
        return [
          { fieldName: field, operator: 'greaterOrEqual', value: parsed.value[0] },
          { fieldName: field, operator: 'lessOrEqual', value: parsed.value[1] },
        ];
      }
      if (parsed.op === '=') {
        return [
          { fieldName: field, operator: 'greaterOrEqual', value: parsed.value },
          { fieldName: field, operator: 'lessOrEqual', value: parsed.value },
        ];
      }
      if (parsed.op === '<') {
        return [{ fieldName: field, operator: 'lessOrEqual', value: shiftDate(parsed.value, -1) }];
      }
      if (parsed.op === '>') {
        return [{ fieldName: field, operator: 'greaterOrEqual', value: shiftDate(parsed.value, 1) }];
      }
      return [{ fieldName: field, operator: COMPARISON_OP[parsed.op], value: parsed.value }];
    }

    case 'enumLabel': {
      const field = col.backendFilterKey ?? col.key;
      if (parsed.value.length === 1) {
        return [{ fieldName: field, operator: 'equals', value: parsed.value[0] }];
      }
      return [{ fieldName: field, operator: 'inSet', value: parsed.value.join(',') }];
    }

    case 'booleanLabel': {
      const field = col.backendFilterKey ?? col.key;
      return [{ fieldName: field, operator: 'equals', value: parsed.value }];
    }

    case 'numeric': {
      const field = col.backendFilterKey ?? col.key;
      return [{ fieldName: field, operator: COMPARISON_OP[parsed.op] ?? 'equals', value: parsed.value }];
    }

    case 'identifier': {
      const field = col.backendFilterKey ?? `${col.key}$_identifier`;
      return [{ fieldName: field, operator: 'iContains', value: parsed.value }];
    }

    case 'text':
    default: {
      const field = col.backendFilterKey ?? col.key;
      return [{ fieldName: field, operator: 'iContains', value: parsed.value }];
    }
  }
}

// ---------------------------------------------------------------------------
// Private inference helpers
// ---------------------------------------------------------------------------

function inferFilterMode(type) {
  switch (type) {
    case 'date':     return 'date';
    case 'selector': return 'identifier';
    case 'status':   return 'enumLabel';
    case 'boolean':  return 'booleanLabel';
    case 'number':
    case 'amount':   return 'numeric';
    default:         return 'text';
  }
}

function inferSortMode(type, col) {
  if (col?.enumLabels) return 'enumLabel';
  if (col?.badgeLabels) return 'booleanLabel';
  switch (type) {
    case 'selector': return 'identifier';
    case 'status':   return 'enumLabel';
    case 'boolean':  return 'booleanLabel';
    default:         return 'raw';
  }
}
