import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { DateField } from '../ui/date-field.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.jsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip.jsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.jsx';
import { Trash2, Plus, Save, SlidersHorizontal, ChevronDown, Check, Bookmark, Loader2 } from 'lucide-react';
import { useUI, useLabel, useLocale, useLocaleSwitch } from '../../i18n/index.js';
import { resolveFilterMode, getDisplayText } from '../../lib/gridQuery.js';
import { useDistinctValues } from '../../hooks/useDistinctValues.js';
import { compareStatusCodes } from '../../lib/statusBadge.js';
import { DistinctValuesList } from './DistinctValuesList.jsx';

/**
 * AdvancedFilterBuilder — popover body for the list-view funnel.
 *
 * Renders a stack of condition rows (Donde / Y-O + field + operator + value),
 * manages a draft state internally, and promotes the draft to the parent only
 * when the user clicks "Aplicar". Draft persists while the popover is open so
 * changes aren't lost if the user adds multiple rows before applying.
 */

const OPERATORS_BY_MODE = {
  text:         ['iContains', 'iNotContains', 'iStartsWith', 'iEquals', 'iNotEqual', 'isNull', 'isNotNull'],
  identifier:   ['iContains', 'iNotContains', 'iStartsWith', 'equals', 'notEqual', 'isNull', 'isNotNull'],
  // `inSet` ("Is any of") is deliberately absent: enum values are now picked
  // through a multi-select checkbox popover, so "Is" with several values IS
  // "is any of". The old operator asked the user to hand-type internal CODES
  // (never the visible labels) into a free-text field with an unexplained
  // comma separator — unusable for a column whose codes are i18n keys
  // (ETP-4956). The evaluators still understand `inSet`, so filter presets
  // saved before this change keep working.
  enumLabel:    ['equals', 'notEqual', 'isNull', 'isNotNull'],
  booleanLabel: ['equals'],
  numeric:      ['equals', 'notEqual', 'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'between', 'isNull', 'isNotNull'],
  date:         ['equals', 'lessThan', 'greaterThan', 'between', 'isNull', 'isNotNull'],
};

// Text-style ops: user types free text (backend filters on `$_identifier`).
const TEXTUAL_IDENT_OPS = new Set(['iContains', 'iNotContains', 'iStartsWith', 'iEquals', 'iNotEqual']);

const OP_LABEL_KEY = {
  iContains: 'opContains',
  iNotContains: 'opNotContains',
  iStartsWith: 'opStartsWith',
  iEquals: 'opIs',
  iNotEqual: 'opIsNot',
  equals: 'opIs',
  notEqual: 'opIsNot',
  greaterThan: 'opGreaterThan',
  greaterOrEqual: 'opGreaterOrEqual',
  lessThan: 'opLessThan',
  lessOrEqual: 'opLessOrEqual',
  between: 'opBetween',
  inSet: 'opInSet',
  isNull: 'opIsEmpty',
  isNotNull: 'opIsNotEmpty',
};

// Date-specific relabeling — "greaterThan" reads as "Después de" not "Mayor que".
const OP_LABEL_KEY_DATE = {
  ...OP_LABEL_KEY,
  greaterThan: 'opAfter',
  lessThan: 'opBefore',
};

const NULLISH_OPS = new Set(['isNull', 'isNotNull']);

/**
 * Classifies the value "shape" a given operator/mode pair expects, so an
 * operator change (ETP-5008) can tell whether the previous value can be
 * meaningfully reused by the new operator's widget, or must be cleared.
 *
 * - 'nullish': isNull/isNotNull — no value at all.
 * - 'pair':    between — a two-element [from, to] array.
 * - 'inSet':   the enumLabel `inSet` operator's free-text, comma-joined
 *              string (ValueInput's plain <Input>, distinct from the
 *              single-code picker the other enumLabel operators use).
 * - 'array':   identifier mode's discrete ops (equals/notEqual) — rendered
 *              by IdentifierMultiPicker, whose value is an array of ids.
 * - 'scalar':  everything else — a single string/number/boolean/date value
 *              bound to one Input/Select/DateField/DistinctEnumPicker.
 *
 * Two operators only share a value when `getValueShape` returns the same
 * shape for both — e.g. switching identifier 'equals' <-> 'notEqual' keeps
 * the picked ids (both 'array'), but switching enumLabel 'inSet' -> 'equals'
 * clears ('inSet' vs 'scalar'): the DistinctEnumPicker expects one real code,
 * not the raw comma-joined text the inSet input left behind.
 */
function getValueShape(operator, mode) {
  if (NULLISH_OPS.has(operator)) return 'nullish';
  if (operator === 'between') return 'pair';
  if (operator === 'inSet') return 'inSet';
  if (mode === 'identifier' && !TEXTUAL_IDENT_OPS.has(operator)) return 'array';
  return 'scalar';
}

function emptyValueForShape(shape) {
  if (shape === 'pair') return ['', ''];
  if (shape === 'nullish') return null;
  if (shape === 'array') return [];
  return '';
}

/**
 * Resolves the operator list offered for a given column.
 *
 * `isNull` / `isNotNull` ("Es vacío" / "No es vacío") are dropped for any
 * `required` column: a mandatory field can never legitimately be empty, so
 * offering those operators only sets the user up for a filter that can never
 * match a row. This applies to every column, in every window — required-ness
 * is a property of the field, not of a particular filter mode.
 *
 * `currentOperator` (ETP-4956 + ETP-5008): the row's own operator is always
 * kept in the list even when it is not one of the operators normally offered
 * for this column/mode — e.g. `inSet` was retired from `enumLabel` (ETP-4956,
 * "is any of" is now done via the multi-select picker instead), but a filter
 * PRESET saved before that change still carries `operator: 'inSet'`. Without
 * this, Radix's Select can't find a matching item for the current value and
 * renders the trigger blank instead of the operator's real label, even though
 * `ValueInput` still renders a perfectly editable widget for it. This never
 * re-exposes the retired operator as a fresh choice: as soon as the row's
 * operator changes away from it, the next render's list no longer includes it.
 */
function getOperatorsForColumn(col, mode, currentOperator) {
  const base = mode ? (OPERATORS_BY_MODE[mode] ?? OPERATORS_BY_MODE.text) : [];
  const filtered = col?.required ? base.filter((op) => !NULLISH_OPS.has(op)) : base;
  if (currentOperator && !filtered.includes(currentOperator)) {
    return [...filtered, currentOperator];
  }
  return filtered;
}

function makeEmptyRow() {
  return { field: '', operator: '', value: '', _rowKey: crypto.randomUUID() };
}

// External values (e.g. loaded from a saved preset) don't carry a `_rowKey`,
// so mint one on load — gives each condition row a stable React key that
// survives row removal, instead of the array index (see IdentifierMultiPicker
// precedent in OcrLinesReviewModal.jsx for the same pattern).
function ensureRowKeys(conditions) {
  return conditions.map((c) => (c._rowKey ? c : { ...c, _rowKey: crypto.randomUUID() }));
}

function isFilterableColumn(col) {
  if (!col?.key) return false;
  if (col.type === 'discarded' || col.type === 'system') return false;
  if (col.filterable === false) return false;
  // A `type: 'custom'` column with no `column` (AD field) and no explicit
  // `backendFilterKey` is a purely client-rendered, synthetic cell (e.g. a
  // composite "identifier & name" avatar cell, or a computed badge) — there
  // is no real backend property to send a filter criteria against. Offering
  // it in the filter field list shows the raw internal `key` as its label
  // (columnLabel has nothing else to fall back to) and silently filters
  // nothing when applied. Opt back in explicitly with `filterable: true` if a
  // custom column genuinely maps to a queryable backend field via a custom
  // `buildCriteria`.
  if (col.type === 'custom' && !col.column && !col.backendFilterKey && col.filterable !== true) {
    return false;
  }
  return true;
}

function isRowComplete(row, col) {
  if (!row.field || !row.operator || !col) return false;
  if (NULLISH_OPS.has(row.operator)) return true;
  if (row.operator === 'between') {
    return Array.isArray(row.value)
      && row.value[0] !== '' && row.value[0] != null
      && row.value[1] !== '' && row.value[1] != null;
  }
  if (Array.isArray(row.value)) {
    return row.value.some((v) => v !== '' && v != null);
  }
  return row.value !== '' && row.value != null;
}

function isRowStarted(row) {
  if (row.field || row.operator) return true;
  if (Array.isArray(row.value)) return row.value.some((v) => v !== '' && v != null);
  return row.value !== '' && row.value != null;
}

function cloneConditions(conditions) {
  return conditions.map((c) => ({
    ...c,
    value: Array.isArray(c.value) ? [...c.value] : c.value,
  }));
}

/**
 * Collapses a human-typed number to canonical dot-decimal.
 *
 * The numeric editors accept a locale decimal comma (an es-ES user reads
 * "1.646,49 €" in the grid and types it back verbatim), but every downstream
 * consumer expects a dot: `coerceNumeric` in gridQuery.js strips commas as
 * THOUSANDS separators, so emitting "1646,49" raw would silently query 164649.
 * Normalizing here, once, at the point the draft is promoted, keeps both the
 * backend criteria path and the client-side evaluators on canonical input.
 *
 * With both separators present the LAST one is the decimal ("1.646,49",
 * "1,646.49"); with a single separator it is the decimal unless the trailing
 * group is exactly three digits, which reads as a thousands group.
 */
export function normalizeDecimalInput(raw) {
  if (typeof raw !== 'string') return raw;
  const s = raw.trim().replace(/\s/g, '');
  if (s === '' || !/[.,]/.test(s)) return s;
  if (!/^[+-]?[\d.,]+$/.test(s)) return raw.trim();

  const sign = /^[+-]/.test(s) ? s[0] : '';
  const body = sign ? s.slice(1) : s;
  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');

  let decimalAt;
  if (lastDot !== -1 && lastComma !== -1) {
    decimalAt = Math.max(lastDot, lastComma);
  } else {
    const only = lastDot !== -1 ? lastDot : lastComma;
    decimalAt = /^\d{3}$/.test(body.slice(only + 1)) ? -1 : only;
  }

  const intPart = (decimalAt === -1 ? body : body.slice(0, decimalAt)).replace(/[.,]/g, '');
  const fracPart = decimalAt === -1 ? '' : body.slice(decimalAt + 1).replace(/[.,]/g, '');
  return `${sign}${intPart}${fracPart ? `.${fracPart}` : ''}`;
}

/**
 * Sanitizes one condition's value at apply time.
 *
 * - Text values are trimmed: a stray leading/trailing space silently returned
 *   zero rows, because no operator trimmed and the backend `iContains` matched
 *   the space literally (ETP-4956). Trimming happens HERE and not in the
 *   input's onChange, which would stop the user typing spaces between words.
 * - Numeric values are normalized to dot-decimal (see normalizeDecimalInput).
 */
function sanitizeValue(value, mode) {
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, mode));
  if (typeof value !== 'string') return value;
  return mode === 'numeric' ? normalizeDecimalInput(value) : value.trim();
}

function sanitizeConditions(conditions, columnByKey) {
  return conditions.map((c) => {
    const col = columnByKey[c.field];
    const mode = col ? resolveFilterMode(col) : null;
    return { ...c, value: sanitizeValue(c.value, mode) };
  });
}

export function AdvancedFilterBuilder({
  entity = null,
  apiBaseUrl = null,
  columns = [],
  rows = [],
  value = null,
  onApply,
  onClear,
  onClose,
  presets = null,
  onApplyPreset = null,
  onSavePreset = null,
  onDeletePreset = null,
  hasActiveFilter = false,
  labelOverrides = null,
}) {
  const ui = useUI();
  const labelOf = useLabel(labelOverrides);
  const dictionary = useLocale();

  const filterableColumns = useMemo(
    () => columns.filter(isFilterableColumn),
    [columns],
  );
  const columnByKey = useMemo(
    () => Object.fromEntries(filterableColumns.map((c) => [c.key, c])),
    [filterableColumns],
  );

  const initialDraft = useMemo(() => (
    value?.conditions?.length
      ? { rowOperator: value.rowOperator ?? 'and', conditions: ensureRowKeys(cloneConditions(value.conditions)) }
      : { rowOperator: 'and', conditions: [makeEmptyRow()] }
  ), [value]);

  const [draft, setDraft] = useState(initialDraft);

  // Re-seed the draft when the applied value changes (e.g. cleared externally).
  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const setRowOperator = useCallback((op) => {
    setDraft((prev) => ({ ...prev, rowOperator: op }));
  }, []);

  const updateRow = useCallback((idx, patch) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, 'field') && patch.field !== r.field) {
          next.operator = '';
          next.value = '';
        } else if (Object.prototype.hasOwnProperty.call(patch, 'operator') && patch.operator !== r.operator) {
          // ETP-5008: clear the value whenever the new operator's widget can't
          // meaningfully reuse the old value's shape (e.g. inSet's joined
          // free-text string surviving into a single-code picker). Same-shape
          // switches (e.g. identifier 'equals' <-> 'notEqual') keep the value.
          const col = columnByKey[r.field] || null;
          const mode = col ? resolveFilterMode(col) : null;
          const oldShape = getValueShape(r.operator, mode);
          const newShape = getValueShape(patch.operator, mode);
          if (oldShape !== newShape) {
            next.value = emptyValueForShape(newShape);
          }
        }
        return next;
      }),
    }));
  }, [columnByKey]);

  const removeRow = useCallback((idx) => {
    setDraft((prev) => {
      const next = prev.conditions.filter((_, i) => i !== idx);
      return { ...prev, conditions: next.length ? next : [makeEmptyRow()] };
    });
  }, []);

  const addRow = useCallback(() => {
    setDraft((prev) => ({ ...prev, conditions: [...prev.conditions, makeEmptyRow()] }));
  }, []);

  const columnLabel = useCallback((col) => labelOf(col.column) ?? col.label ?? col.key, [labelOf]);

  const allComplete = draft.conditions.every((r) => isRowComplete(r, columnByKey[r.field]));
  const anyStarted = draft.conditions.some(isRowStarted);
  const hasAppliedFilter = !!value?.conditions?.length;

  const handleApply = () => {
    if (!allComplete) return;
    onApply?.({
      rowOperator: draft.rowOperator,
      conditions: sanitizeConditions(cloneConditions(draft.conditions), columnByKey),
    });
    onClose?.();
  };

  const handleClear = () => {
    setDraft({ rowOperator: 'and', conditions: [makeEmptyRow()] });
    if (hasAppliedFilter) onClear?.();
  };

  const presetsEnabled = !!(presets && (onApplyPreset || onSavePreset || onDeletePreset));
  const presetNames = useMemo(
    () => (presets ? Object.keys(presets).sort((a, b) => a.localeCompare(b)) : []),
    [presets],
  );

  // Dialog state for save / overwrite-confirm / delete-confirm. The native
  // prompt/confirm equivalents were replaced with in-app modals so the browser
  // chrome never appears.
  const [presetDialog, setPresetDialog] = useState({ mode: null, name: '' });
  const [presetNameDraft, setPresetNameDraft] = useState('');

  const closePresetDialog = useCallback(() => {
    setPresetDialog({ mode: null, name: '' });
    setPresetNameDraft('');
  }, []);

  const handleSavePresetClick = () => {
    if (!onSavePreset) return;
    setPresetNameDraft('');
    setPresetDialog({ mode: 'save', name: '' });
  };

  const handleSaveDialogSubmit = (e) => {
    e?.preventDefault?.();
    const name = presetNameDraft.trim();
    if (!name) return;
    if (presets && Object.prototype.hasOwnProperty.call(presets, name)) {
      setPresetDialog({ mode: 'overwrite', name });
      return;
    }
    onSavePreset?.(name);
    closePresetDialog();
  };

  const handleConfirmOverwrite = () => {
    if (presetDialog.name) onSavePreset?.(presetDialog.name);
    closePresetDialog();
  };

  const handleDeletePresetClick = (e, name) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDeletePreset) return;
    setPresetDialog({ mode: 'delete', name });
  };

  const handleConfirmDelete = () => {
    if (presetDialog.name) onDeletePreset?.(presetDialog.name);
    closePresetDialog();
  };

  const handleApplyPresetClick = (name) => {
    onApplyPreset?.(name);
    onClose?.();
  };

  const canSavePreset = hasActiveFilter || anyStarted;
  const hasBetween = draft.conditions.some((c) => c.operator === 'between');

  return (
    <div className={`flex w-max max-w-[min(90vw,60rem)] flex-col gap-3 ${hasBetween ? 'min-w-[38rem]' : 'min-w-[32rem]'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" data-testid="SlidersHorizontal__4eedf1" />
        {ui('advancedFilterTitle')}
      </div>
      <div className="flex flex-col gap-2">
        {draft.conditions.map((row, idx) => {
          const col = columnByKey[row.field] || null;
          const mode = col ? resolveFilterMode(col) : null;
          const ops = getOperatorsForColumn(col, mode, row.operator);
          const opLabels = mode === 'date' ? OP_LABEL_KEY_DATE : OP_LABEL_KEY;
          const showValue = !!row.operator && !NULLISH_OPS.has(row.operator);
          const isBetween = row.operator === 'between';

          return (
            <div key={row._rowKey} className="flex items-start gap-2">
              {/* Connector */}
              <div className="w-16 shrink-0">
                {idx === 0 ? (
                  <div className="h-9 flex items-center text-xs text-muted-foreground px-1">
                    {ui('advancedFilterWhere')}
                  </div>
                ) : (
                  <Select
                    value={draft.rowOperator}
                    onValueChange={setRowOperator}
                    data-testid="Select__4eedf1">
                    <SelectTrigger className="h-9 text-xs" data-testid="SelectTrigger__4eedf1">
                      <SelectValue data-testid="SelectValue__4eedf1" />
                    </SelectTrigger>
                    <SelectContent data-testid="SelectContent__4eedf1">
                      <SelectItem value="and" data-testid="SelectItem__4eedf1">{ui('advancedFilterAnd')}</SelectItem>
                      <SelectItem value="or" data-testid="SelectItem__4eedf1">{ui('advancedFilterOr')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Field — content-sized (w-fit): hugs the selected column/placeholder
                  up to max-w, floored by min-w, never grabs free space (no gap) */}
              <div className="w-fit min-w-[12rem] max-w-[22rem]">
                <Select
                  value={row.field || undefined}
                  onValueChange={(v) => updateRow(idx, { field: v })}
                  data-testid="Select__4eedf1">
                  <SelectTrigger className="h-9 text-xs" data-testid="SelectTrigger__4eedf1">
                    <SelectValue
                      placeholder={ui('advancedFilterSelectField')}
                      data-testid="SelectValue__4eedf1" />
                  </SelectTrigger>
                  <SelectContent data-testid="SelectContent__4eedf1">
                    {filterableColumns.map((c) => (
                      <SelectItem key={c.key} value={c.key} data-testid="SelectItem__4eedf1">{columnLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Operator — content-sized (w-fit): hugs the operator/placeholder
                  up to max-w, floored by min-w, never grabs free space (no gap) */}
              <div className="w-fit min-w-[12rem] max-w-[18rem]">
                <Select
                  value={row.operator || undefined}
                  onValueChange={(v) => updateRow(idx, { operator: v })}
                  disabled={!col}
                  data-testid="Select__4eedf1">
                  <SelectTrigger className="h-9 text-xs" data-testid="SelectTrigger__4eedf1">
                    <SelectValue
                      placeholder={ui('advancedFilterSelectOp')}
                      data-testid="SelectValue__4eedf1" />
                  </SelectTrigger>
                  <SelectContent data-testid="SelectContent__4eedf1">
                    {ops.map((op) => (
                      <SelectItem key={op} value={op} data-testid="SelectItem__4eedf1">{ui(opLabels[op])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Value */}
              <div className={isBetween ? 'flex-[2] min-w-0' : 'flex-1 min-w-0'}>
                {showValue && col && (
                  <ValueInput
                    col={col}
                    mode={mode}
                    operator={row.operator}
                    value={row.value}
                    onChange={(v) => updateRow(idx, { value: v })}
                    ui={ui}
                    dictionary={dictionary}
                    rows={rows}
                    entity={entity}
                    apiBaseUrl={apiBaseUrl}
                    labelOverrides={labelOverrides}
                    data-testid="ValueInput__4eedf1" />
                )}
              </div>
              {/* Remove row */}
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="h-9 w-9 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Remove condition"
              >
                <Trash2 className="h-4 w-4" data-testid="Trash2__4eedf1" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="self-start flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" data-testid="Plus__4eedf1" />
        {ui('advancedFilterAddCondition')}
      </button>
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        {presetsEnabled ? (
          <DropdownMenu data-testid="DropdownMenu__4eedf1">
            <DropdownMenuTrigger asChild data-testid="DropdownMenuTrigger__4eedf1">
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" data-testid="Bookmark__4eedf1" />
                {ui('filterPresetsButton')}
                <ChevronDown className="h-3 w-3" data-testid="ChevronDown__4eedf1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 max-h-80 overflow-auto"
              data-testid="DropdownMenuContent__4eedf1">
              {presetNames.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {ui('filterPresetsEmpty')}
                </div>
              )}
              {presetNames.map((name) => (
                <DropdownMenuItem
                  key={name}
                  onClick={() => handleApplyPresetClick(name)}
                  className="flex items-center gap-2"
                  data-testid="DropdownMenuItem__4eedf1">
                  <span className="flex-1 truncate">{name}</span>
                  {onDeletePreset && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePresetClick(e, name)}
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title={ui('filterPresetDelete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" data-testid="Trash2__4eedf1" />
                    </button>
                  )}
                </DropdownMenuItem>
              ))}
              {onSavePreset && (
                <>
                  {presetNames.length > 0 && <DropdownMenuSeparator data-testid="DropdownMenuSeparator__4eedf1" />}
                  <DropdownMenuItem
                    onClick={handleSavePresetClick}
                    disabled={!canSavePreset}
                    className="flex items-center gap-2"
                    data-testid="DropdownMenuItem__4eedf1">
                    <Plus className="h-3.5 w-3.5" data-testid="Plus__4eedf1" />
                    <span className="flex-1">{ui('filterPresetSaveCurrent')}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            disabled
            title={ui('advancedFilterSaveComingSoon')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 cursor-not-allowed"
          >
            <Save className="h-3.5 w-3.5" data-testid="Save__4eedf1" />
            {ui('advancedFilterSave')}
          </button>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleClear}
            disabled={!anyStarted && !hasAppliedFilter}
            data-testid="Button__4eedf1">
            {ui('advancedFilterClear')}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleApply}
            disabled={!allComplete}
            data-testid="Button__4eedf1">
            {ui('advancedFilterApply')}
          </Button>
        </div>
      </div>
      <Dialog
        open={presetDialog.mode !== null}
        onOpenChange={(next) => { if (!next) closePresetDialog(); }}
        data-testid="Dialog__4eedf1">
        <DialogContent className="sm:max-w-md" data-testid="DialogContent__4eedf1">
          {presetDialog.mode === 'save' && (
            <form onSubmit={handleSaveDialogSubmit}>
              <DialogHeader data-testid="DialogHeader__4eedf1">
                <DialogTitle data-testid="DialogTitle__4eedf1">{ui('filterPresetSaveCurrent')}</DialogTitle>
              </DialogHeader>
              <div className="py-3">
                <label className="text-sm text-muted-foreground">
                  {ui('filterPresetPromptName')}
                </label>
                <Input
                  autoFocus
                  value={presetNameDraft}
                  onChange={(e) => setPresetNameDraft(e.target.value)}
                  className="mt-2"
                  data-testid="Input__4eedf1" />
              </div>
              <DialogFooter data-testid="DialogFooter__4eedf1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePresetDialog}
                  data-testid="Button__4eedf1">
                  {ui('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!presetNameDraft.trim()}
                  data-testid="Button__4eedf1">
                  {ui('save')}
                </Button>
              </DialogFooter>
            </form>
          )}

          {presetDialog.mode === 'overwrite' && (
            <>
              <DialogHeader data-testid="DialogHeader__4eedf1">
                <DialogTitle data-testid="DialogTitle__4eedf1">
                  {ui('filterPresetOverwriteConfirm', { name: presetDialog.name })}
                </DialogTitle>
              </DialogHeader>
              <DialogFooter data-testid="DialogFooter__4eedf1">
                <Button
                  variant="outline"
                  onClick={closePresetDialog}
                  data-testid="Button__4eedf1">
                  {ui('cancel')}
                </Button>
                <Button onClick={handleConfirmOverwrite} data-testid="Button__4eedf1">
                  {ui('filterPresetOverwriteAction')}
                </Button>
              </DialogFooter>
            </>
          )}

          {presetDialog.mode === 'delete' && (
            <>
              <DialogHeader data-testid="DialogHeader__4eedf1">
                <DialogTitle data-testid="DialogTitle__4eedf1">
                  {ui('filterPresetDeleteConfirm', { name: presetDialog.name })}
                </DialogTitle>
              </DialogHeader>
              <DialogFooter data-testid="DialogFooter__4eedf1">
                <Button
                  variant="outline"
                  onClick={closePresetDialog}
                  data-testid="Button__4eedf1">
                  {ui('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  data-testid="Button__4eedf1">
                  {ui('delete')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function betweenOperator(value, mode, onChange) {
  const pair = Array.isArray(value) ? value : ['', ''];
  if (mode === 'date') {
    return (
      <div className="flex gap-1">
        <DateField
          value={pair[0] ?? ''}
          onChange={(iso) => onChange([iso, pair[1] ?? ''])}
          className="h-9 text-xs flex-1 min-w-0"
          data-testid="AdvancedFilterBuilder__DateField__from" />
        <DateField
          value={pair[1] ?? ''}
          onChange={(iso) => onChange([pair[0] ?? '', iso])}
          className="h-9 text-xs flex-1 min-w-0"
          data-testid="AdvancedFilterBuilder__DateField__to" />
      </div>
    );
  }
  // `type="text"` + inputMode="decimal", NOT type="number": the grid renders
  // amounts with a locale decimal comma ("1.646,49 €") and a number input
  // refuses that character in most browsers, so the user could only ever type
  // the value back in a format they never see (ETP-4956). handleApply
  // normalizes to dot-decimal before the value leaves the builder.
  // Passed as a plain attribute rather than a spread: React omits an
  // `undefined` attribute, and keeping `data-testid` last matches every other
  // element in this file (a spread placed after it could also override it).
  const numericInputMode = mode === 'numeric' ? 'decimal' : undefined;
  return (
    <div className="flex gap-1">
      <Input
        type="text"
        inputMode={numericInputMode}
        value={pair[0] ?? ''}
        onChange={(e) => onChange([e.target.value, pair[1] ?? ''])}
        className="h-9 text-xs"
        data-testid="Input__4eedf1" />
      <Input
        type="text"
        inputMode={numericInputMode}
        value={pair[1] ?? ''}
        onChange={(e) => onChange([pair[0] ?? '', e.target.value])}
        className="h-9 text-xs"
        data-testid="Input__4eedf1" />
    </div>
  );
}

function getJoinedValue(value) {
  return Array.isArray(value) ? value.join(',') : (value ?? '');
}

// badgeLabels may be a plain string or a per-locale object { es_ES, en_US }.
// Resolve to the active locale's string so it can be rendered (mirrors
// createBadgeLabelResolver in DataTable.jsx).
function resolveBadgeText(raw, locale, fallback) {
  if (raw && typeof raw === 'object') return raw[locale] ?? raw.en_US ?? fallback;
  return raw ?? fallback;
}

function ValueInput({ col, mode, operator, value, onChange, ui, dictionary, rows, entity, apiBaseUrl, labelOverrides }) {
  const { locale } = useLocaleSwitch();
  if (mode === 'identifier' && !TEXTUAL_IDENT_OPS.has(operator)) {
    return (
      <IdentifierMultiPicker
        col={col}
        entity={entity}
        apiBaseUrl={apiBaseUrl}
        rows={rows}
        value={value}
        onChange={onChange}
        ui={ui}
        labelOverrides={labelOverrides}
        data-testid="IdentifierMultiPicker__4eedf1" />
    );
  }

  if (operator === 'between') {
    return betweenOperator(value, mode, onChange);
  }

  if (mode === 'enumLabel') {
    // `inSet` was retired from the enum operator list (see OPERATORS_BY_MODE),
    // so this branch is only reached by a filter PRESET saved before that
    // change. Kept so such a preset stays editable instead of rendering an
    // empty value cell.
    if (operator === 'inSet') {
      // ETP-5008: the placeholder ("Comma-separated values") is longer than
      // the field, so it truncates visually with no way to read the full
      // text. Wrap it in the shared Tooltip primitive (see sidebar.jsx for
      // the same Provider/Trigger/Content pattern) so hovering (or
      // focusing, via Radix's built-in focus handling) reveals it in full.
      const placeholder = ui('advancedFilterInSetPlaceholder');
      return (
        <TooltipProvider data-testid="TooltipProvider__4eedf1">
          <Tooltip data-testid="Tooltip__4eedf1">
            <TooltipTrigger asChild data-testid="TooltipTrigger__4eedf1">
              <Input
                type="text"
                value={getJoinedValue(value)}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="h-9 text-xs"
                data-testid="Input__4eedf1" />
            </TooltipTrigger>
            <TooltipContent data-testid="TooltipContent__4eedf1">
              {placeholder}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <DistinctEnumPicker
        col={col}
        entity={entity}
        apiBaseUrl={apiBaseUrl}
        rows={rows}
        value={value}
        onChange={onChange}
        ui={ui}
        dictionary={dictionary}
        data-testid="DistinctEnumPicker__4eedf1" />
    );
  }

  if (mode === 'booleanLabel') {
    const trueLabel = resolveBadgeText(col.badgeLabels?.true, locale, ui('yes') ?? 'Yes');
    const falseLabel = resolveBadgeText(col.badgeLabels?.false, locale, ui('no') ?? 'No');
    const selected = value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : undefined;
    return (
      <Select
        value={selected}
        onValueChange={(v) => onChange(v === 'true')}
        data-testid="Select__4eedf1">
        <SelectTrigger className="h-9 text-xs" data-testid="SelectTrigger__4eedf1">
          <SelectValue
            placeholder={ui('advancedFilterSelectValue')}
            data-testid="SelectValue__4eedf1" />
        </SelectTrigger>
        <SelectContent data-testid="SelectContent__4eedf1">
          <SelectItem value="true" data-testid="SelectItem__4eedf1">{trueLabel}</SelectItem>
          <SelectItem value="false" data-testid="SelectItem__4eedf1">{falseLabel}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (mode === 'date') {
    return (
      <DateField
        value={value ?? ''}
        onChange={onChange}
        className="h-9 text-xs"
        data-testid="AdvancedFilterBuilder__DateField" />
    );
  }

  // See betweenOperator for why numeric uses text + inputMode="decimal".
  return (
    <Input
      type="text"
      inputMode={mode === 'numeric' ? 'decimal' : undefined}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 text-xs"
      data-testid="Input__4eedf1" />
  );
}

function IdentifierMultiPicker({ col, entity, apiBaseUrl, rows, value, onChange, ui, labelOverrides = null }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : [];
  const sentinelRef = useRef(null);
  const labelOf = useLabel(labelOverrides);

  // Pulls {id, _identifier} pairs from the list GET's `_distinct` branch so
  // the picker shows all values in the filterable universe, not only those on
  // currently-loaded rows. Falls back silently to in-memory rows when the
  // backend is unavailable (entity / apiBaseUrl missing).
  //
  // ETP-4770: also fetch eagerly when re-editing an existing condition (i.e.
  // `selected` is already populated on mount), not only once the popover is
  // opened. `rows` is the grid's CURRENT rows, already filtered by the very
  // condition being edited — for "equals" it only contains the selected
  // value(s) (no other option to pick from until the backend fetch lands),
  // and for "notEqual" it EXCLUDES the selected value(s) (no in-memory label
  // for them at all, so the closed trigger falls back to showing the raw
  // id). Gating solely on `open` meant the trigger rendered with an
  // incomplete/wrong label before the user ever touched the picker, and a
  // remount (popover reopen) reset `distinct.values` back to `[]`. Fetching
  // whenever there is a pre-existing selection makes the picker resolve
  // full labels and full searchable options independent of the grid.
  const willFetch = !!(entity && apiBaseUrl && col?.key);
  const distinct = useDistinctValues(entity, col?.key, {
    enabled: !!(willFetch && (open || selected.length > 0)),
    apiBaseUrl,
  });

  // ETP-4770: tracks whether the FIRST distinct fetch for this mount has
  // ever completed (settled), independent of the exact instant `distinct.
  // loading` flips — see the `pending` derivation below for why this is
  // needed in addition to `distinct.loading` and not a replacement for it.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (willFetch && !distinct.loading) setSettled(true);
  }, [willFetch, distinct.loading]);

  // In-memory seed: use the grid's $_identifier labels so the list shows
  // something usable before the backend fetch resolves. The backend will
  // overwrite or extend these once distinct.values arrive.
  const inMemoryOptions = useMemo(() => {
    const byId = new Map();
    for (const row of rows || []) {
      const id = row?.[col.key];
      if (id == null || id === '') continue;
      const idStr = String(id);
      if (byId.has(idStr)) continue;
      const label = row[`${col.key}$_identifier`] ?? getDisplayText(row, col) ?? idStr;
      byId.set(idStr, { id: idStr, label: String(label) });
    }
    return byId;
  }, [rows, col]);

  // Merge order: backend (canonical, paginated) → in-memory fill-ins → any
  // selected IDs whose labels we still don't know (fallback to id as label).
  const mergedOptions = useMemo(() => {
    const byId = new Map();
    for (const entry of distinct.values) {
      const id = entry?.id;
      if (id == null || id === '') continue;
      const idStr = String(id);
      const label = entry._identifier || inMemoryOptions.get(idStr)?.label || idStr;
      byId.set(idStr, { id: idStr, label: String(label) });
    }
    // Fill in values we already had in memory but the backend hasn't returned
    // yet (only when the local search box is empty — otherwise they'd violate
    // the server-side filter).
    if (!distinct.search.trim()) {
      for (const [id, opt] of inMemoryOptions) {
        if (!byId.has(id)) byId.set(id, opt);
      }
    }
    // ETP-4770: a selected id absent from both sources above is either
    // (a) genuinely unresolvable (backend unavailable, or settled without
    // ever finding it — e.g. paginated past it) or (b) still in flight —
    // the very common "notEqual" case, where the grid excludes the
    // selected row so `inMemoryOptions` never has it, and the eager
    // distinct fetch (see `enabled` above) hasn't resolved yet. Only (a)
    // may fall back to showing the raw id; (b) must render a loading
    // placeholder instead — the raw id must never be visible to the user,
    // not even for a single frame.
    for (const id of selected) {
      if (byId.has(id)) continue;
      const knownLabel = inMemoryOptions.get(id)?.label;
      if (knownLabel != null) {
        byId.set(id, { id, label: knownLabel, pending: false });
        continue;
      }
      const pending = willFetch && (distinct.loading || !settled);
      byId.set(id, { id, label: pending ? '' : id, pending });
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [distinct.values, distinct.search, inMemoryOptions, selected, willFetch, settled]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !distinct.hasMore || distinct.loadingMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) distinct.loadMore();
    }, { root: node.parentElement, rootMargin: '32px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [distinct.hasMore, distinct.loadingMore, distinct.loadMore, mergedOptions.length]);

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((v) => v !== id)
      : [...selected, id];
    onChange(next);
  };

  // ETP-4770: carries `pending` alongside the label so the trigger can
  // render a loading placeholder instead of ever falling back to the raw id.
  const selectedLabels = useMemo(() => {
    const byId = new Map(mergedOptions.map((o) => [o.id, o]));
    return selected.map((id) => byId.get(id) ?? { id, label: id, pending: false });
  }, [mergedOptions, selected]);

  const firstSelected = selectedLabels[0];
  const triggerLabel = selected.length === 0
    ? ui('advancedFilterSelectValue')
    : (
      <span className="inline-flex items-center gap-1 truncate">
        {firstSelected?.pending
          ? <Loader2 className="h-3 w-3 animate-spin" data-testid="Loader2__4eedf1" />
          : <span className="truncate">{firstSelected?.label}</span>}
        {selected.length > 1 && <span>{`+${selected.length - 1}`}</span>}
      </span>
    );

  const colLabelKey = labelOf(col.column) ?? col.label ?? col.key;

  return (
    <Popover open={open} onOpenChange={setOpen} data-testid="Popover__4eedf1">
      <PopoverTrigger asChild data-testid="PopoverTrigger__4eedf1">
        <button
          type="button"
          className={[
            'h-9 w-full flex items-center justify-between rounded-md border border-input bg-transparent px-3 text-xs',
            selected.length === 0 ? 'text-muted-foreground' : 'text-foreground',
          ].join(' ')}
        >
          <span className="truncate">{triggerLabel}</span>
          {/* ETP-4770: the pending-label spinner inside `triggerLabel` already
             covers "loading" when a selected value's name isn't known yet —
             suppress this generic one then, or the two render side by side. */}
          {distinct.loading && !firstSelected?.pending && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0 ml-1"
              data-testid="Loader2__4eedf1" />
          )}
          <ChevronDown
            className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1"
            data-testid="ChevronDown__4eedf1" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" data-testid="PopoverContent__4eedf1">
        <div className="px-3 pt-3 pb-2 text-xs font-normal leading-6" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {ui('advancedFilterSelectorOf', { label: colLabelKey })}
        </div>
        <div className="px-3 pb-2">
          <Input
            autoFocus
            value={distinct.search}
            onChange={(e) => distinct.setSearch(e.target.value)}
            placeholder={ui('search') || 'Search'}
            className="h-8 text-xs"
            data-testid="Input__4eedf1" />
        </div>
        <div className="max-h-60 overflow-auto pb-2">
          {mergedOptions.length === 0 && !distinct.loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">—</div>
          )}
          {mergedOptions.map((opt) => {
            const isSelected = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-muted/50 transition-colors"
              >
                <span
                  className={[
                    'h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0',
                    isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input',
                  ].join(' ')}
                >
                  {isSelected && <Check className="h-3 w-3" data-testid="Check__4eedf1" />}
                </span>
                <span className="flex-1 truncate">
                  {opt.pending
                    ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" data-testid="Loader2__4eedf1" />
                    : opt.label}
                </span>
              </button>
            );
          })}
          {distinct.loading && mergedOptions.length === 0 && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" data-testid="Loader2__4eedf1" />
            </div>
          )}
          {distinct.hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-2">
              {distinct.loadingMore && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  data-testid="Loader2__4eedf1" />
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const STATUS_COLUMN_TYPE = 'status';

/**
 * ETP-4913 — document-status pickers must always render in the fixed
 * business-flow order (Draft -> Confirmed -> Completed), independent of which
 * of the two merge sources (the uncached backend distinct fetch vs. the
 * in-memory grid rows) happened to arrive first. Mirrors ListFilterBar's
 * `mergedStatusCodes`, which sorts the exact same way, so the "All statuses"
 * pill and this picker never disagree for the same column.
 *
 * Deliberately scoped to `type: 'status'` columns — the same set ListFilterBar
 * discovers via `columns.find(c => c.type === 'status')`. Every OTHER enumLabel
 * column already has a deterministic and INTENTIONAL order that
 * compareStatusCodes would scramble: the backend's `order by <code> asc` for
 * business enums (accountType A,E,L,M,O,R would become M,A,E,L,O,R because 'M'
 * sits in the In-process bucket), or the enumLabels insertion order for virtual
 * columns filled by fillFallbackCodes (a severity list vencida/proxima/aldia
 * would be alphabetized into reverse severity). Do not widen this gate.
 */
function orderCodesForColumn(codes, col) {
  if (col?.type !== STATUS_COLUMN_TYPE) return codes;
  return codes.slice().sort(compareStatusCodes);
}

/**
 * Seeds the option list from the column's declared enum codes when no dynamic
 * source produced anything — a virtual column with static `enumLabels` and no
 * backend distinct endpoint would otherwise render an empty picker.
 *
 * The gate stays "only when there is no data": injecting every declared code
 * unconditionally surfaces options that cannot match a single row (see the
 * caller's note on the BF movement type). What made the dropdown collapse to a
 * single option was not this gate but the ORDER of the caller's merge — the
 * already-selected value was folded in first and counted as data. Fixed there.
 *
 * Two further constraints, both from ETP-5119:
 *
 *   1. `ownEnumLabels` is the column's OWN `enumLabels`, never the global status
 *      dictionary the caller falls back to for LABELLING. Translating a code the
 *      backend sent is one thing; ENUMERATING every docstatus in the system as
 *      pickable options is another. Sales Quotation declares no enumLabels, so
 *      seeding from the global map offered Temporal / No confirmado / En curso /
 *      Reservado — statuses that window can never hold. When a column declares
 *      no codes there is no trustworthy static set, and an empty list is the
 *      correct answer.
 *   2. It honours the active search. The gate used to be `out.length === 0`
 *      alone, so a term matching nothing ("4", "rrr") emptied the data-derived
 *      list and then had the whole catalogue poured back in — making the search
 *      box look inert and, again, surfacing foreign statuses.
 *
 * `query` is the lowercased, trimmed search term ('' when the box is empty).
 */
function fillFallbackCodes(out, ownEnumLabels, seen, query, labelFor) {
  if (out.length > 0 || !ownEnumLabels) return;
  for (const c of Object.keys(ownEnumLabels)) {
    if (seen.has(c)) continue;
    if (query
      && !String(labelFor(c)).toLowerCase().includes(query)
      && !String(c).toLowerCase().includes(query)) continue;
    seen.add(c);
    out.push(c);
  }
}

/**
 * Popover picker for enum columns in the advanced filter builder.
 *
 * Mirrors the status dropdown's UX: in-memory rows seed the list for instant
 * feedback, the backend distinct endpoint fills in values that live on
 * unloaded pages, and the user can scroll / search within the popover.
 *
 * Falls back silently to the in-memory set when `entity` is not provided.
 */
function DistinctEnumPicker({ col, entity, apiBaseUrl, rows, value, onChange, ui, dictionary }) {
  const [open, setOpen] = useState(false);

  // Multi-select: the value is an array of codes. Scalars are still accepted on
  // the way in so a filter preset saved before ETP-4956 (or a caller that only
  // ever sets one code) keeps working.
  const selected = useMemo(() => {
    if (Array.isArray(value)) return value.map(String);
    return value == null || value === '' ? [] : [String(value)];
  }, [value]);

  // True when the column ships its own closed catalogue of codes — see
  // fillFallbackCodes for why that distinction decides the merge policy.
  const hasDeclaredLabels = !!(col.enumLabels && Object.keys(col.enumLabels).length > 0);

  const labelMap = useMemo(() => {
    if (hasDeclaredLabels) return { ...col.enumLabels };
    return Object.fromEntries(
      Object.entries(dictionary?.statuses || {})
        .filter(([code]) => /^[A-Z][A-Z0-9_]*$/.test(code))
        .map(([code, entry]) => [code, entry?.label || code]),
    );
  }, [col, dictionary, hasDeclaredLabels]);

  // The column's own enumLabels (labelMap) win over the global status dictionary
  // so a code colliding with an unrelated global status keeps the column's label.
  // enumLabels values may be i18n keys, so run them through ui() (literal labels
  // pass through unchanged), mirroring ListFilterBar's labelForStatus.
  //
  // NOTE: this deliberately does NOT delegate to statusLabel() the way
  // ListFilterBar's labelForStatus does (ETP-4696). statusLabel() only honours
  // an enumLabels entry that is an i18n KEY; a literal label returns null there
  // and falls through to a hardcoded code->key MAP, yielding the RAW CODE for
  // anything outside it. ListFilterBar gets away with it because docstatus
  // enumLabels are always keys ('docStatusCl'...), but this picker also serves
  // columns whose enumLabels are literals — docBaseType (44 AD names),
  // 'GENERIC' -> 'Use Generic Account No.', 'E' -> 'Error', sales-quotation's
  // ui('quotationStatus.CO') — which would all regress to raw codes (ETP-4913).
  const labelFor = (code) => {
    const declared = labelMap[code];
    if (declared != null) return (ui && ui(declared)) || declared;
    return dictionary?.statuses?.[code]?.label || code;
  };

  const inMemoryCodes = useMemo(() => {
    const seen = new Set();
    for (const r of rows || []) {
      const v = r?.[col.key];
      if (v !== null && v !== undefined && v !== '') seen.add(v);
    }
    return Array.from(seen);
  }, [rows, col]);

  const distinct = useDistinctValues(entity, col.key, {
    enabled: !!(entity && apiBaseUrl && open),
    apiBaseUrl,
  });

  const mergedCodes = useMemo(() => {
    const seen = new Set();
    const out = [];
    // Boolean-valued columns surface the same value in two shapes: the distinct
    // endpoint returns the string "true"/"false" while in-memory rows hold the
    // boolean true/false. Normalize to a single canonical string so they collapse
    // to one option instead of rendering duplicate labels (the enumLabels keys are
    // strings too, so labelFor still resolves the canonical form).
    const canon = (c) => (typeof c === 'boolean' ? String(c) : c);
    const add = (code) => {
      if (code == null || code === '') return;
      const c = canon(code);
      if (seen.has(c)) return;
      seen.add(c);
      out.push(c);
    };
    for (const entry of distinct.values) add(entry?.id);
    const q = distinct.search.trim().toLowerCase();
    for (const c of inMemoryCodes) {
      const cc = canon(c);
      if (seen.has(cc)) continue;
      if (q && !labelFor(cc).toLowerCase().includes(q) && !String(cc).toLowerCase().includes(q)) continue;
      add(c);
    }
    // Decide the enumLabels fallback from the DATA ONLY — before folding in the
    // current selection. That ordering is the ETP-4956 fix: `selected` used to
    // be added first, so re-opening a filter that already had a value found a
    // non-empty list, skipped the fallback, and offered the user nothing but
    // the option they had already picked.
    //
    // Deliberately still gated on "no data produced anything": a declared code
    // that no loaded row uses must NOT be injected. Movements declare labels
    // for BPD/BPW/BF so a bank-fee row renders its name instead of a raw code,
    // but the quick TypeFilter only offers BPD/BPW — unioning the catalogue
    // unconditionally put a "Comisión bancaria" option in front of users whose
    // account has no such movement, and filtering by it could only ever
    // return zero rows.
    fillFallbackCodes(out, hasDeclaredLabels ? labelMap : null, seen, q, labelFor);
    for (const code of selected) add(code);
    return out;
  }, [distinct.values, distinct.search, inMemoryCodes, selected, labelMap, hasDeclaredLabels, dictionary]);

  // Status columns get the fixed business-flow order; every other enum column
  // keeps the merge order untouched. See orderCodesForColumn (ETP-4913).
  const orderedCodes = useMemo(
    () => orderCodesForColumn(mergedCodes, col),
    [mergedCodes, col],
  );

  // "Borrador +2" — same trigger shape IdentifierMultiPicker already uses, so
  // the enum and identifier multi-pickers read identically.
  const activeLabel = selected.length === 0
    ? null
    : `${labelFor(selected[0])}${selected.length > 1 ? ` +${selected.length - 1}` : ''}`;

  const toggle = (code) => {
    if (code == null) {
      onChange([]);
      return;
    }
    const key = String(code);
    onChange(selected.includes(key)
      ? selected.filter((v) => v !== key)
      : [...selected, key]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} data-testid="Popover__4eedf1">
      <PopoverTrigger asChild data-testid="PopoverTrigger__4eedf1">
        <Button
          variant="outline"
          size="sm"
          className={[
            'w-full justify-between gap-1.5 h-9 text-xs font-normal rounded-md bg-card',
            selected.length > 0 ? 'text-foreground' : 'text-muted-foreground',
          ].join(' ')}
          data-testid="Button__4eedf1">
          <span className="truncate">
            {activeLabel || ui('advancedFilterSelectValue')}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {distinct.loading && <Loader2
              className="h-3.5 w-3.5 animate-spin text-muted-foreground"
              data-testid="Loader2__4eedf1" />}
            <ChevronDown className="h-3.5 w-3.5" data-testid="ChevronDown__4eedf1" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" data-testid="PopoverContent__4eedf1">
        {/* Multi-select: the popover stays OPEN so several codes can be ticked
            in one pass, mirroring IdentifierMultiPicker. */}
        <DistinctValuesList
          activeCodes={selected}
          allLabel={null}
          codes={orderedCodes}
          labelFor={labelFor}
          distinct={distinct}
          onSelect={toggle}
          searchPlaceholder={ui('searchValues')}
          emptyLabel={ui('noResults')}
          data-testid="DistinctValuesList__4eedf1" />
      </PopoverContent>
    </Popover>
  );
}

export default AdvancedFilterBuilder;
