import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Trash2, Plus, Save, SlidersHorizontal, ChevronDown, Check, Bookmark, Loader2 } from 'lucide-react';
import { useUI, useLabel, useLocale, useLocaleSwitch } from '@/i18n';
import { resolveFilterMode, getDisplayText } from '@/lib/gridQuery';
import { useDistinctValues } from '@/hooks/useDistinctValues.js';
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
  text:         ['iContains', 'iNotContains', 'iEquals', 'iNotEqual', 'isNull', 'isNotNull'],
  identifier:   ['iContains', 'iNotContains', 'equals', 'notEqual', 'isNull', 'isNotNull'],
  enumLabel:    ['equals', 'notEqual', 'inSet', 'isNull', 'isNotNull'],
  booleanLabel: ['equals'],
  numeric:      ['equals', 'notEqual', 'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'between', 'isNull', 'isNotNull'],
  date:         ['equals', 'lessThan', 'greaterThan', 'between', 'isNull', 'isNotNull'],
};

// Text-style ops: user types free text (backend filters on `$_identifier`).
const TEXTUAL_IDENT_OPS = new Set(['iContains', 'iNotContains', 'iEquals', 'iNotEqual']);

const OP_LABEL_KEY = {
  iContains: 'opContains',
  iNotContains: 'opNotContains',
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

function makeEmptyRow() {
  return { field: '', operator: '', value: '' };
}

function isFilterableColumn(col) {
  if (!col?.key) return false;
  if (col.type === 'discarded' || col.type === 'system') return false;
  if (col.filterable === false) return false;
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
      ? { rowOperator: value.rowOperator ?? 'and', conditions: cloneConditions(value.conditions) }
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
          if (patch.operator === 'between') next.value = ['', ''];
          else if (NULLISH_OPS.has(patch.operator)) next.value = null;
          else if (Array.isArray(r.value)) next.value = '';
        }
        return next;
      }),
    }));
  }, []);

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
      conditions: cloneConditions(draft.conditions),
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

  return (
    <div className="flex flex-col gap-3 min-w-[560px]">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        {ui('advancedFilterTitle')}
      </div>

      <div className="flex flex-col gap-2">
        {draft.conditions.map((row, idx) => {
          const col = columnByKey[row.field] || null;
          const mode = col ? resolveFilterMode(col) : null;
          const ops = mode ? (OPERATORS_BY_MODE[mode] ?? OPERATORS_BY_MODE.text) : [];
          const opLabels = mode === 'date' ? OP_LABEL_KEY_DATE : OP_LABEL_KEY;
          const showValue = !!row.operator && !NULLISH_OPS.has(row.operator);

          return (
            <div key={idx} className="flex items-start gap-2">
              {/* Connector */}
              <div className="w-16 shrink-0">
                {idx === 0 ? (
                  <div className="h-9 flex items-center text-xs text-muted-foreground px-1">
                    {ui('advancedFilterWhere')}
                  </div>
                ) : (
                  <Select value={draft.rowOperator} onValueChange={setRowOperator}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">{ui('advancedFilterAnd')}</SelectItem>
                      <SelectItem value="or">{ui('advancedFilterOr')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Field */}
              <div className="flex-1 min-w-0">
                <Select
                  value={row.field || undefined}
                  onValueChange={(v) => updateRow(idx, { field: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={ui('advancedFilterSelectField')} />
                  </SelectTrigger>
                  <SelectContent>
                    {filterableColumns.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{columnLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Operator */}
              <div className="flex-1 min-w-0">
                <Select
                  value={row.operator || undefined}
                  onValueChange={(v) => updateRow(idx, { operator: v })}
                  disabled={!col}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={ui('advancedFilterSelectOp')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map((op) => (
                      <SelectItem key={op} value={op}>{ui(opLabels[op])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value */}
              <div className="flex-1 min-w-0">
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
                  />
                )}
              </div>

              {/* Remove row */}
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="h-9 w-9 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Remove condition"
              >
                <Trash2 className="h-4 w-4" />
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
        <Plus className="h-3.5 w-3.5" />
        {ui('advancedFilterAddCondition')}
      </button>

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        {presetsEnabled ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" />
                {ui('filterPresetsButton')}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-auto">
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
                >
                  <span className="flex-1 truncate">{name}</span>
                  {onDeletePreset && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePresetClick(e, name)}
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title={ui('filterPresetDelete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </DropdownMenuItem>
              ))}
              {onSavePreset && (
                <>
                  {presetNames.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={handleSavePresetClick}
                    disabled={!canSavePreset}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
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
            <Save className="h-3.5 w-3.5" />
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
          >
            {ui('advancedFilterClear')}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleApply}
            disabled={!allComplete}
          >
            {ui('advancedFilterApply')}
          </Button>
        </div>
      </div>

      <Dialog
        open={presetDialog.mode !== null}
        onOpenChange={(next) => { if (!next) closePresetDialog(); }}
      >
        <DialogContent className="sm:max-w-md">
          {presetDialog.mode === 'save' && (
            <form onSubmit={handleSaveDialogSubmit}>
              <DialogHeader>
                <DialogTitle>{ui('filterPresetSaveCurrent')}</DialogTitle>
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
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closePresetDialog}>
                  {ui('cancel')}
                </Button>
                <Button type="submit" disabled={!presetNameDraft.trim()}>
                  {ui('save')}
                </Button>
              </DialogFooter>
            </form>
          )}

          {presetDialog.mode === 'overwrite' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {ui('filterPresetOverwriteConfirm', { name: presetDialog.name })}
                </DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closePresetDialog}>
                  {ui('cancel')}
                </Button>
                <Button onClick={handleConfirmOverwrite}>
                  {ui('filterPresetOverwriteAction')}
                </Button>
              </DialogFooter>
            </>
          )}

          {presetDialog.mode === 'delete' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {ui('filterPresetDeleteConfirm', { name: presetDialog.name })}
                </DialogTitle>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={closePresetDialog}>
                  {ui('cancel')}
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete}>
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
  const inputType = mode === 'date' ? 'date' : mode === 'numeric' ? 'number' : 'text';
  return (
      <div className="flex gap-1">
        <Input
            type={inputType}
            value={pair[0] ?? ''}
            onChange={(e) => onChange([e.target.value, pair[1] ?? ''])}
            className="h-9 text-xs"
        />
        <Input
            type={inputType}
            value={pair[1] ?? ''}
            onChange={(e) => onChange([pair[0] ?? '', e.target.value])}
            className="h-9 text-xs"
        />
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
      />
    );
  }

  if (operator === 'between') {
    return betweenOperator(value, mode, onChange);
  }

  if (mode === 'enumLabel') {
    if (operator === 'inSet') {
      return (
        <Input
          type="text"
          value={getJoinedValue(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ui('advancedFilterInSetPlaceholder')}
          className="h-9 text-xs"
        />
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
      />
    );
  }

  if (mode === 'booleanLabel') {
    const trueLabel = resolveBadgeText(col.badgeLabels?.true, locale, ui('yes') ?? 'Yes');
    const falseLabel = resolveBadgeText(col.badgeLabels?.false, locale, ui('no') ?? 'No');
    const selected = value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : undefined;
    return (
      <Select value={selected} onValueChange={(v) => onChange(v === 'true')}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder={ui('advancedFilterSelectValue')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{trueLabel}</SelectItem>
          <SelectItem value="false">{falseLabel}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const inputType = mode === 'date' ? 'date' : mode === 'numeric' ? 'number' : 'text';
  return (
    <Input
      type={inputType}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 text-xs"
    />
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
  const distinct = useDistinctValues(entity, col?.key, {
    enabled: !!(entity && apiBaseUrl && col?.key && open),
    apiBaseUrl,
  });

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
    for (const id of selected) {
      if (!byId.has(id)) byId.set(id, { id, label: inMemoryOptions.get(id)?.label ?? id });
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [distinct.values, distinct.search, inMemoryOptions, selected]);

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

  const selectedLabels = useMemo(() => {
    const byId = new Map(mergedOptions.map((o) => [o.id, o.label]));
    return selected.map((id) => byId.get(id) ?? id);
  }, [mergedOptions, selected]);

  const triggerLabel = selected.length === 0
    ? ui('advancedFilterSelectValue')
    : selected.length === 1
      ? selectedLabels[0]
      : `${selectedLabels[0]} +${selected.length - 1}`;

  const colLabelKey = labelOf(col.column) ?? col.label ?? col.key;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={[
            'h-9 w-full flex items-center justify-between rounded-md border border-input bg-transparent px-3 text-xs',
            selected.length === 0 ? 'text-muted-foreground' : 'text-foreground',
          ].join(' ')}
        >
          <span className="truncate">{triggerLabel}</span>
          {distinct.loading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0 ml-1" />
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="px-3 pt-3 pb-2 text-xs font-normal leading-6" style={{ color: '#6C6C89' }}>
          {ui('advancedFilterSelectorOf', { label: colLabelKey })}
        </div>
        <div className="px-3 pb-2">
          <Input
            autoFocus
            value={distinct.search}
            onChange={(e) => distinct.setSearch(e.target.value)}
            placeholder={ui('search') || 'Search'}
            className="h-8 text-xs"
          />
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
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{opt.label}</span>
              </button>
            );
          })}
          {distinct.loading && mergedOptions.length === 0 && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {distinct.hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-2">
              {distinct.loadingMore && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function resolveEnumOptions(col, dictionary) {
  const rawMap = col.enumLabels && Object.keys(col.enumLabels).length > 0
    ? col.enumLabels
    : Object.fromEntries(
        Object.entries(dictionary?.statuses || {})
          .filter(([code]) => /^[A-Z][A-Z0-9_]*$/.test(code))
          .map(([code, entry]) => [code, entry?.label || code]),
      );
  return Object.keys(rawMap)
    .map((code) => ({
      code,
      label: dictionary?.statuses?.[code]?.label || rawMap[code] || code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function fillFallbackCodes(out, labelMap, seen) {
  if (out.length === 0) {
    for (const c of Object.keys(labelMap)) {
      if (!seen.has(c)) out.push(c);
    }
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

  const labelMap = useMemo(() => {
    if (col.enumLabels && Object.keys(col.enumLabels).length > 0) return { ...col.enumLabels };
    return Object.fromEntries(
      Object.entries(dictionary?.statuses || {})
        .filter(([code]) => /^[A-Z][A-Z0-9_]*$/.test(code))
        .map(([code, entry]) => [code, entry?.label || code]),
    );
  }, [col, dictionary]);

  const labelFor = (code) => dictionary?.statuses?.[code]?.label || labelMap[code] || code;

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
    for (const entry of distinct.values) {
      const c = entry?.id;
      if (c == null || c === '') continue;
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    const q = distinct.search.trim().toLowerCase();
    for (const c of inMemoryCodes) {
      if (seen.has(c)) continue;
      if (q && !labelFor(c).toLowerCase().includes(q) && !String(c).toLowerCase().includes(q)) continue;
      seen.add(c);
      out.push(c);
    }
    if (value && !seen.has(value)) { seen.add(value); out.push(value); }
    // Fallback: for virtual columns with static enumLabels and no dynamic data, use the
    // enumLabels keys directly so the picker is not empty.
    fillFallbackCodes(out, labelMap, seen);
    return out;
  }, [distinct.values, distinct.search, inMemoryCodes, value, labelMap, dictionary]);

  const activeLabel = value ? labelFor(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={[
            'w-full justify-between gap-1.5 h-9 text-xs font-normal rounded-md bg-white',
            value ? 'text-foreground' : 'text-muted-foreground',
          ].join(' ')}
        >
          <span className="truncate">
            {activeLabel || ui('advancedFilterSelectValue')}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {distinct.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <DistinctValuesList
          activeCode={value || null}
          allLabel={null}
          codes={mergedCodes}
          labelFor={labelFor}
          distinct={distinct}
          onSelect={(code) => {
            onChange(code ?? '');
            setOpen(false);
          }}
          searchPlaceholder={ui('searchValues')}
        />
      </PopoverContent>
    </Popover>
  );
}

export default AdvancedFilterBuilder;
