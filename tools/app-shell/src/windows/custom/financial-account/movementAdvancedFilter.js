// Advanced ("by conditions") filter for the Movements tab — reuses the generic
// AdvancedFilterBuilder from contract-ui, but filters the in-memory movements
// array CLIENT-SIDE (the builder only emits the condition tree, it has no
// evaluator of its own).
//
// Filter object shape (emitted by AdvancedFilterBuilder):
//   { rowOperator: 'and' | 'or', conditions: [{ field, operator, value }] }

import { MOVEMENT_STATUS_CONFIG } from './movementStatusConfig';

/**
 * The user-facing status families (5), de-duplicated from the 8 backend codes.
 * Each family keeps the i18n key so the enum dropdown shows one entry per family.
 */
const STATUS_FAMILY_KEYS = (() => {
  const seen = new Map();
  for (const cfg of Object.values(MOVEMENT_STATUS_CONFIG)) {
    if (!seen.has(cfg.labelKey)) seen.set(cfg.labelKey, cfg.labelKey);
  }
  return [...seen.keys()];
})();

/**
 * Derives the user-facing status label key for a movement's raw payment status.
 */
export function movementStatusLabelKey(paymentStatus) {
  return MOVEMENT_STATUS_CONFIG[paymentStatus]?.labelKey ?? null;
}

/**
 * Builds the filterable column metadata for the AdvancedFilterBuilder, with
 * labels/enum labels resolved through the provided `ui` translator.
 *
 * Status is filtered over a derived `statusFamily` field (the label key) so the
 * dropdown shows one option per family instead of all 8 raw codes.
 */
export function buildMovementFilterColumns(ui) {
  const trxTypeLabels = {
    BPD: ui('financeAccountMovementsTypeBPD'),
    BPW: ui('financeAccountMovementsTypeBPW'),
    BF: ui('financeAccountMovementsTypeBF'),
  };
  const statusLabels = Object.fromEntries(
    STATUS_FAMILY_KEYS.map((key) => [key, ui(key)]),
  );

  return [
    { key: 'date',         label: ui('financeAccountMovementsColDate'),        type: 'date' },
    { key: 'documentNo',   label: ui('financeAccountMovementsColDocument'),    type: 'string' },
    // 'selector' → identifier mode: a checkbox multi-picker listing the contacts
    // present in the movements, so the user can filter by one or several.
    { key: 'contact',      label: ui('financeAccountMovementsColContact'),     type: 'selector' },
    { key: 'description',  label: ui('financeAccountMovementsColDescription'), type: 'string' },
    { key: 'statusFamily', label: ui('financeAccountMovementsColStatus'),      type: 'enum', enumLabels: statusLabels },
    { key: 'trxType',      label: ui('financeAccountMovementsColType'),        type: 'enum', enumLabels: trxTypeLabels },
    { key: 'glItem',       label: ui('financeAccountMovementsColGlItem'),      type: 'string' },
    { key: 'amount',       label: ui('financeAccountMovementsColAmount'),      type: 'number' },
    { key: 'balance',      label: ui('financeAccountMovementsColBalance'),     type: 'number' },
  ];
}

/** Adds the derived `statusFamily` field used by the status filter column. */
function withDerivedFields(movement) {
  return { ...movement, statusFamily: movementStatusLabelKey(movement.paymentStatus) };
}

const lc = (v) => (v == null ? '' : String(v).toLowerCase());
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/** Numeric comparison with the shared "both sides must be numbers" guard. */
const numCmp = (test) => (raw, value) => {
  const a = num(raw);
  const b = num(value);
  return a != null && b != null && test(a, b);
};

/** Normalizes an `inSet` value (array, or comma-separated string) to an array. */
const toSet = (value) => (Array.isArray(value)
  ? value
  : String(value ?? '').split(',').map((s) => s.trim()));

/**
 * Operator → predicate dispatch table. Each handler receives
 * `(raw, value, field)` and returns whether the row matches. Keeping them as
 * separate functions (instead of one big switch) keeps each one simple.
 */
const OPERATORS = {
  iContains:    (raw, value) => lc(raw).includes(lc(value)),
  iNotContains: (raw, value) => !lc(raw).includes(lc(value)),
  iEquals:      (raw, value) => lc(raw) === lc(value),
  iNotEqual:    (raw, value) => lc(raw) !== lc(value),
  isNull:       (raw) => raw == null || raw === '',
  isNotNull:    (raw) => raw != null && raw !== '',
  equals:       (raw, value) => (Array.isArray(value)
    ? value.map(lc).includes(lc(raw))
    : lc(raw) === lc(value)),
  notEqual:     (raw, value) => (Array.isArray(value)
    ? !value.map(lc).includes(lc(raw))
    : lc(raw) !== lc(value)),
  inSet:        (raw, value) => toSet(value).map(lc).includes(lc(raw)),
  greaterThan:    numCmp((a, b) => a > b),
  greaterOrEqual: numCmp((a, b) => a >= b),
  lessThan:       numCmp((a, b) => a < b),
  lessOrEqual:    numCmp((a, b) => a <= b),
  between: (raw, value, field) => {
    const [a, b] = Array.isArray(value) ? value : [];
    const isDate = field === 'date';
    const r = isDate ? Date.parse(raw) : num(raw);
    const lo = isDate ? Date.parse(a) : num(a);
    const hi = isDate ? Date.parse(b) : num(b);
    return r != null && !Number.isNaN(r) && r >= lo && r <= hi;
  },
};

/** Evaluates a single condition against a (derived) movement row. */
function matchesCondition(row, { field, operator, value }) {
  const handler = OPERATORS[operator];
  // Unknown / incomplete operator → don't filter out.
  return handler ? handler(row[field], value, field) : true;
}

/**
 * Filters the movements array against an advanced-filter value object.
 * `and` → every condition must match; `or` → at least one. A null/empty filter
 * returns the input unchanged.
 */
export function applyAdvancedFilter(movements, filter) {
  if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return movements;
  }
  const complete = filter.conditions.filter((c) => c && c.field && c.operator);
  if (complete.length === 0) return movements;

  const isOr = filter.rowOperator === 'or';
  return movements.filter((m) => {
    const row = withDerivedFields(m);
    return isOr
      ? complete.some((c) => matchesCondition(row, c))
      : complete.every((c) => matchesCondition(row, c));
  });
}
