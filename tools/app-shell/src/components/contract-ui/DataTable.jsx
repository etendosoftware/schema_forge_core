import React, { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Search, Inbox, X, ChevronDown, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLabel, useUI, useLocale, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { buildUrlWithParams } from '@/lib/buildUrlWithParams.js';
import { getCatalogOptions } from '@/lib/selectorCatalog.js';
import { getStatusDotColor, getStatusGridPillClass, getStatusPillClass, statusLabel } from '@/lib/statusBadge.js';
import { StatusTag } from '@/components/ui/status-tag';
import { Tag } from '@/components/ui/tag';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';
import { resolveColumnLabel } from '@/lib/resolveColumnLabel.js';
import { formatAmount } from '@/lib/formatAmount.js';
import { applyCalloutUpdates } from '@/lib/applyCalloutUpdates.js';
import ProductSearchDrawer from './ProductSearchDrawer.jsx';
import InternalConsumptionProductSearchDrawer from './InternalConsumptionProductSearchDrawer.jsx';

/**
 * Compact inline combobox for search-type FK fields in rapid line entry.
 * Text input with filtered dropdown — lightweight alternative to full SearchInput.
 */
function InlineSearchCombo({ field, value, options, onChange, onKeyDown, placeholder, inputRef, selectorUrl, selectorContext, token, displayLabel }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const [serverResults, setServerResults] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const displayLabelRef = useRef(displayLabel);
  displayLabelRef.current = displayLabel;
  const displayValue = options.find(o => o.id === value);

  // Server-side search with debounce
  const fetchTimer = useRef(null);
  const fetchServerResults = useCallback((q) => {
    if (!selectorUrl || !token) { setServerResults(null); return; }
    clearTimeout(fetchTimer.current);
    const trimmed = (q || '').trim();
    const queryParams = trimmed ? { ...selectorContext, q: trimmed } : { ...selectorContext };
    fetchTimer.current = setTimeout(() => {
      fetch(buildUrlWithParams(selectorUrl, queryParams), {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.items) setServerResults(data.items.map(it => ({ id: it.id, name: it.label || it.name, ...it })));
        })
        .catch(() => {});
    }, 300);
  }, [selectorUrl, selectorContext, token]);

  const filtered = useMemo(() => {
    if (serverResults) return serverResults.slice(0, 20);
    if (!query) return options.slice(0, 15);
    const q = query.toLowerCase();
    return options.filter(o => {
      const name = o.name || o.label || o._identifier || '';
      return name.toLowerCase().includes(q);
    }).slice(0, 15);
  }, [query, options, serverResults]);

  const handleSelect = (opt) => {
    setQuery(opt.name || opt.label || opt._identifier || '');
    onChange(opt.id, opt.name || opt.label || opt._identifier || '', opt);
    setOpen(false);
    setServerResults(null);
  };

  // Sync display when value is set externally.
  // If the value is found in static options, use that label.
  // Otherwise fall back to displayLabel (e.g. locator/warehouse name set by auto-fill).
  useEffect(() => {
    if (displayValue) {
      setQuery(displayValue.name || displayValue.label || displayValue._identifier || '');
    } else if (displayLabelRef.current) {
      setQuery(displayLabelRef.current);
    }
  }, [value]);

  const updateDropdownDirection = useCallback(() => {
    if (!rootRef.current || typeof window === 'undefined') {
      return;
    }
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUp(spaceBelow < 220 && spaceAbove > spaceBelow);

    const shouldOpenUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, (shouldOpenUp ? spaceAbove : spaceBelow) - 12);
    const style = shouldOpenUp
      ? {
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          bottom: window.innerHeight - rect.top + 4,
          maxHeight,
          zIndex: 1000,
        }
      : {
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          top: rect.bottom + 4,
          maxHeight,
          zIndex: 1000,
        };
    setDropdownStyle(style);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownDirection();
    const onReflow = () => updateDropdownDirection();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, updateDropdownDirection]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setServerResults(null);
          fetchServerResults(e.target.value);
          // Clear ID when typing (user is searching, not committed yet)
          if (value) onChange('', '');
        }}
        onFocus={() => {
          updateDropdownDirection();
          setOpen(true);
          fetchServerResults(query);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          // Let Enter/Escape propagate to the row handler only if dropdown is closed
          if (e.key === 'Enter' && open && filtered.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            handleSelect(filtered[0]);
            return;
          }
          onKeyDown?.(e);
        }}
        placeholder={placeholder}
        className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 pr-6 focus:ring-2 focus:ring-primary focus:outline-none"
      />
      <button
        type="button"
        className="absolute right-1 top-1.5 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const nextOpen = !open;
          if (nextOpen) {
            updateDropdownDirection();
          }
          setOpen(nextOpen);
          if (nextOpen) {
            fetchServerResults(query);
          }
        }}
        aria-label={`Toggle ${placeholder} options`}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && filtered.length > 0 && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="bg-white border rounded-md shadow-lg overflow-auto"
          style={dropdownStyle}
          data-open-up={openUp ? 'true' : 'false'}
          data-inline-add-portal="true"
        >
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 cursor-pointer whitespace-nowrap"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
            >
              {opt.name || opt.label || opt._identifier || opt.id}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}


function isTruthyBoolean(value) {
  return value === true || value === 'Y' || value === 'true';
}

function isFalsyBoolean(value) {
  return value === false || value === 'N' || value === 'false';
}

/**
 * Loading skeleton that mimics a table layout.
 */
function TableSkeleton({ columns }) {
  return (
    <div className="space-y-2">
      {/* Header skeleton */}
      <div className="flex gap-3 px-2">
        {columns.map(col => (
          <Skeleton key={col.key} className="h-4 flex-1" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-2">
          {columns.map(col => (
            <Skeleton key={col.key} className="h-8 flex-1" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state shown when the table has no data (or all rows are filtered out).
 */
function EmptyState({ hasFilter, totalCount }) {
  const ui = useUI();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Inbox className="h-10 w-10 mb-3 opacity-40" />
      {hasFilter ? (
        <>
          <p className="text-sm font-medium">{ui('noMatchingRecords')}</p>
          <p className="text-xs mt-1">{ui('adjustFilters')}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">{ui('noRecordsYet')}</p>
          <p className="text-xs mt-1">{ui('createNewRecord')}</p>
        </>
      )}
    </div>
  );
}

const NUMERIC_FIELD_TYPES = new Set(['number', 'integer', 'decimal', 'quantity', 'amount']);

/**
 * Inline editable row rendered at the bottom of the table for rapid line entry.
 * Controlled by the `addRow` prop on DataTable.
 */
const InlineAddRow = forwardRef(function InlineAddRow({ columns, fields, onAdd, onCancel, data, catalogs, onFieldChange, selectable, hasDeleteColumn, hasCloneColumn, token, apiBaseUrl, entity, selectorContext }, ref) {
  const t = useLabel();
  const fieldMap = useMemo(() => {
    const map = {};
    for (const f of fields) map[f.key] = f;
    return map;
  }, [fields]);

  // Auto-compute lineNo default
  const defaultLineNo = useMemo(() => {
    const nums = (data || []).map(r => Number(r.lineNo) || 0);
    return (nums.length > 0 ? Math.max(...nums) : 0) + 10;
  }, [data]);

  const buildEmpty = useCallback(() => {
    const empty = {};
    for (const f of fields) {
      if (f.key === 'lineNo') {
        empty[f.key] = defaultLineNo;
      } else if (f.defaultValue !== undefined) {
        empty[f.key] = f.defaultValue;
      } else {
        empty[f.key] = '';
      }
    }
    return empty;
  }, [fields, defaultLineNo]);

  const [values, setValues] = useState(buildEmpty);
  const [isSaving, setIsSaving] = useState(false);
  const firstInputRef = useRef(null);
  const rowRef = useRef(null);
  const touchedFieldsRef = useRef(new Set());
  const inflightRef = useRef(null);

  // Reset values when fields or data change
  useEffect(() => {
    setValues(buildEmpty());
    touchedFieldsRef.current = new Set();
  }, [buildEmpty]);

  // Auto-focus first input when row appears
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const submitLine = useCallback(({ closeAfterSave = false } = {}) => {
    // Dedupe concurrent submits: outside-click + parent flushPendingLines can fire
    // in the same tick; both callers must observe the same outcome.
    if (inflightRef.current) return inflightRef.current;
    setIsSaving(true);
    const run = (async () => {
      try {
        // Coerce numeric field values to JS numbers right before submission.
        // This catches race conditions where async callouts may have overwritten
        // user-typed values with strings.
        const coercedValues = { ...values };
        for (const f of fields) {
          if (NUMERIC_FIELD_TYPES.has(f.type) && coercedValues[f.key] !== '' && coercedValues[f.key] != null) {
            const raw = String(coercedValues[f.key]);
            const parsed = f.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
            if (!isNaN(parsed)) coercedValues[f.key] = parsed;
          }
        }
        const result = await onAdd(coercedValues);
        if (result === false || result == null) {
          return false;
        }
        if (closeAfterSave) {
          onCancel();
          return true;
        }
        // Reset for next rapid entry — recompute lineNo
        const nums = [...(data || []).map(r => Number(r.lineNo) || 0), Number(values.lineNo) || 0];
        const nextLineNo = Math.max(...nums) + 10;
        const next = {};
        for (const f of fields) {
          if (f.key === 'lineNo') {
            next[f.key] = nextLineNo;
          } else if (f.defaultValue !== undefined) {
            next[f.key] = f.defaultValue;
          } else {
            next[f.key] = '';
          }
        }
        // Clear any $_identifier companion values
        for (const key of Object.keys(values)) {
          if (key.includes('$_identifier') && !(key in next)) {
            next[key] = '';
          }
        }
        setValues(next);
        touchedFieldsRef.current = new Set();
        // Re-focus first input for rapid entry
        setTimeout(() => firstInputRef.current?.focus(), 0);
        return true;
      } finally {
        inflightRef.current = null;
        setIsSaving(false);
      }
    })();
    inflightRef.current = run;
    return run;
  }, [data, fields, onAdd, onCancel, values]);

  // Enter → confirm without closing (rapid entry). Outside-click / parent flush close.
  const handleConfirm = useCallback(() => submitLine({ closeAfterSave: false }), [submitLine]);

  // Expose imperative flush for parent (e.g. auto-commit pending line on header Save).
  // If no field has been touched, silently cancel. Otherwise confirm and return success.
  useImperativeHandle(ref, () => ({
    flush: async ({ closeAfterSave = true } = {}) => {
      if (inflightRef.current) {
        return (await inflightRef.current) !== false;
      }
      if (touchedFieldsRef.current.size === 0) {
        onCancel();
        return true;
      }
      const ok = await submitLine({ closeAfterSave });
      return ok !== false;
    },
  }), [onCancel, submitLine]);

  // Auto-commit when the user clicks outside the row (mirrors the green-check behavior).
  // Skips clicks inside the row itself, inside any open dialog/drawer (role="dialog"),
  // and inside whitelisted portals (combo dropdown marked with data-inline-add-portal).
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rowRef.current && rowRef.current.contains(target)) return;
      if (target instanceof Element) {
        if (target.closest('[role="dialog"]')) return;
        if (target.closest('[data-inline-add-portal="true"]')) return;
      }
      // If a dialog/drawer is currently open anywhere, defer — clicks belong to it.
      if (document.querySelector('[role="dialog"]')) return;
      if (inflightRef.current) return;
      if (touchedFieldsRef.current.size === 0) {
        onCancel();
      } else {
        void submitLine({ closeAfterSave: true });
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [onCancel, submitLine]);

  // Wrap handleChange to also notify parent (for callout triggering)
  const handleFieldChange = useCallback((key, val, selectedItem) => {
    touchedFieldsRef.current.add(key);
    // Build a snapshot of current + new values for the callout formState
    const snapshot = { ...values, [key]: val };
    handleChange(key, val);
    // Store _aux data from selector items as auxiliaryValues (e.g., product_UOM, product_PSTD)
    if (selectedItem?._aux) {
      for (const [suffix, auxVal] of Object.entries(selectedItem._aux)) {
        snapshot[key + suffix] = auxVal;
        handleChange(key + suffix, auxVal);
      }
    }
    // Also fire top-level display fields from selectedItem (mirrors EntityForm behavior).
    // Skips structural/object fields; fires e.g. product_uOM = "Unit" for identifier resolution.
    if (selectedItem && typeof selectedItem === 'object') {
      for (const [topField, topVal] of Object.entries(selectedItem)) {
        if (topField === 'id' || topField === '_aux' || topField === 'label'
            || topField === 'name' || topField === 'searchKey'
            || typeof topVal === 'object' || topVal === null) continue;
        // Price from the document's price list. Mapping depends on price list type:
        //   - Gross list (isTaxIncluded=true): standardPrice is the gross price → grossUnitPrice
        //   - Net list   (isTaxIncluded=false): standardPrice is the net price   → unitPrice
        // Mark the target field as touched so the callout does not overwrite it (some callouts
        // look up the price themselves and may return a different value from another price list).
        if (topField === 'standardPrice' && topVal != null) {
          const isGross = selectedItem?.isTaxIncluded !== false;
          if (isGross) {
            snapshot['grossUnitPrice'] = topVal;
            handleChange('grossUnitPrice', topVal);
            snapshot['grossListPrice'] = topVal;
            handleChange('grossListPrice', topVal);
            touchedFieldsRef.current.add('grossUnitPrice');
            touchedFieldsRef.current.add('grossListPrice');
          } else {
            snapshot['unitPrice'] = topVal;
            handleChange('unitPrice', topVal);
            snapshot['listPrice'] = topVal;
            handleChange('listPrice', topVal);
            touchedFieldsRef.current.add('unitPrice');
            touchedFieldsRef.current.add('listPrice');
          }
          continue;
        }
        const ctxKey = `${key}_${topField}`;
        if (!(ctxKey in snapshot)) {
          // Keep display hints only in the callout snapshot.
          // Persisting these transient keys in row state can leak them into POST payloads.
          snapshot[ctxKey] = topVal;
        }
      }
    }
    // Notify parent for callout execution — pass computed snapshot (not stale React state)
    onFieldChange?.(key, val, snapshot, (updates, forceFields = new Set()) => {
      setValues((prev) => applyCalloutUpdates(prev, updates, forceFields, key, touchedFieldsRef.current));
    });
  }, [handleChange, onFieldChange, values]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  let firstInputAssigned = false;

  return (
    <TableRow ref={rowRef} className="bg-blue-50/50 border-t-2 border-primary/20">
      {/* Saving spinner — aligned with selection checkbox column (empty when idle). */}
      {selectable && (
        <TableCell className="w-10 px-1">
          <div className="flex items-center justify-center h-7">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving line" />}
          </div>
        </TableCell>
      )}
      {columns.map(col => {
        const field = fieldMap[col.key];
        const fieldLabel = field ? (t(field.column) ?? field.label ?? field.key) : (t(col.column) ?? col.label ?? col.key);
        if (!field) {
          // Show callout-derived values if available, otherwise dash.
          // Prefer $_identifier (human-readable) over raw ID for FK fields.
          const rawVal = values[col.key];
          const identVal = values[col.key + '$_identifier'];
          const isNumericDerived = NUMERIC_FIELD_TYPES.has(col.type);
          const displayVal = identVal || rawVal;
          return (
            <TableCell key={col.key} className={`text-muted-foreground text-sm${isNumericDerived ? ' text-right tabular-nums' : ''}`}>
              {displayVal != null && displayVal !== '' ? displayVal : '—'}
            </TableCell>
          );
        }
        const isFirst = !firstInputAssigned;
        if (isFirst) firstInputAssigned = true;

        // Lookup fields: click to open search modal (no inline combo)
        if (field.type === 'search' && field.lookup) {
          const selectorUrl = apiBaseUrl ? `${apiBaseUrl}/${entity}/selectors/${field.column}` : null;
          const displayLabel = values[field.key + '$_identifier'] || '';
          const isInternalConsumptionProduct = entity === 'internalConsumptionLine' && field.key === 'product';
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <LookupField
                value={displayLabel}
                placeholder={fieldLabel}
                selectorUrl={selectorUrl}
                selectorContext={selectorContext}
                token={token}
                inputRef={isFirst ? firstInputRef : undefined}
                onSelect={(item) => {
                  touchedFieldsRef.current.add(field.key);
                  handleChange(field.key + '$_identifier', item.label || item.name || item._identifier);
                  handleFieldChange(field.key, item.id, item);

                  if (isInternalConsumptionProduct) {
                    // _aux._LOC holds the M_Locator_ID UUID (from storageBin.id out-field).
                    // item.warehouse holds the warehouse name (from storageBin.warehouse grid field).
                    const locatorId = item._aux?._LOC;
                    const locatorLabel = item.warehouse || item['warehouse$_identifier'] || item.storageBin;
                    if (locatorId) {
                      handleChange('storageBin$_identifier', locatorLabel || locatorId);
                      // Internal Consumption auto-fill should not trigger a second line callout,
                      // otherwise backend-side locator callouts may override user-entered quantity.
                      handleChange('storageBin', locatorId);
                    }
                  }
                }}
                onKeyDown={handleKeyDown}
                title={isInternalConsumptionProduct ? 'Product + Warehouse' : fieldLabel}
                useInternalConsumptionDrawer={isInternalConsumptionProduct}
              />
            </TableCell>
          );
        }

        // Search fields render as compact combobox (text input + filtered dropdown)
        if (field.type === 'search') {
          const options = getCatalogOptions(catalogs, entity, field);
          const selectorUrl = apiBaseUrl ? `${apiBaseUrl}/${entity}/selectors/${field.column}` : null;
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <InlineSearchCombo
                field={field}
                value={values[field.key] ?? ''}
                displayLabel={values[field.key + '$_identifier'] || ''}
                options={options}
                inputRef={isFirst ? firstInputRef : undefined}
                placeholder={fieldLabel}
                onChange={(id, label, selectedItem) => {
                  touchedFieldsRef.current.add(field.key);
                  handleChange(field.key + '$_identifier', label);
                  handleFieldChange(field.key, id, selectedItem);
                }}
                onKeyDown={handleKeyDown}
                selectorUrl={selectorUrl}
                selectorContext={selectorContext}
                token={token}
              />
            </TableCell>
          );
        }

        // Select fields with inline static options array
        if (field.type === 'select' && field.options?.length) {
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <select
                ref={isFirst ? firstInputRef : undefined}
                value={values[field.key] ?? ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="" disabled hidden>{field.label ?? field.key}</option>
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </TableCell>
          );
        }

        // Selector fields render as native <select> dropdowns (few options).
        // When catalog options are not pre-loaded, fall back to InlineSearchCombo
        // which loads options dynamically from the selector URL.
        if (field.type === 'selector') {
          const options = getCatalogOptions(catalogs, entity, field);
          if (options.length === 0) {
            const selectorUrl = apiBaseUrl ? `${apiBaseUrl}/${entity}/selectors/${field.column}` : null;
            if (!selectorUrl) return <TableCell key={col.key} className="py-1 px-2" />;
            return (
              <TableCell key={col.key} className="py-1 px-2">
                <InlineSearchCombo
                  field={{ ...field, type: 'search' }}
                  value={values[field.key] ?? ''}
                  displayLabel={values[field.key + '$_identifier'] || ''}
                  options={[]}
                  inputRef={isFirst ? firstInputRef : undefined}
                  placeholder={fieldLabel}
                  onChange={(id, label, selectedItem) => {
                    touchedFieldsRef.current.add(field.key);
                    handleChange(field.key + '$_identifier', label);
                    handleFieldChange(field.key, id, selectedItem);
                  }}
                  onKeyDown={handleKeyDown}
                  selectorUrl={selectorUrl}
                  selectorContext={selectorContext}
                  token={token}
                />
              </TableCell>
            );
          }
          return (
            <TableCell key={col.key} className="py-1 px-2">
              <select
                ref={isFirst ? firstInputRef : undefined}
                value={values[field.key] ?? ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const opt = options.find(o => o.id === selectedId);
                  touchedFieldsRef.current.add(field.key);
                  if (opt) {
                    handleChange(field.key + '$_identifier', opt.name || opt.label || opt._identifier || '');
                  }
                  handleFieldChange(field.key, selectedId, opt);
                }}
                onKeyDown={handleKeyDown}
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="" disabled hidden>{fieldLabel}</option>
                {options.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name || opt.label || opt._identifier || opt.id}</option>
                ))}
              </select>
            </TableCell>
          );
        }

        const isNumeric = NUMERIC_FIELD_TYPES.has(field.type);
        return (
          <TableCell key={col.key} className="py-1 px-2">
            <input
              ref={isFirst ? firstInputRef : undefined}
              type={isNumeric ? 'number' : 'text'}
              inputMode={field.inputMode}
              value={values[field.key] ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (isNumeric && raw !== '' && raw !== '-') {
                  const parsed = field.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw);
                  handleFieldChange(field.key, isNaN(parsed) ? raw : parsed);
                } else {
                  handleFieldChange(field.key, raw);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={fieldLabel}
              required={field.required}
              className={`w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:ring-2 focus:ring-primary focus:outline-none${isNumeric ? ' text-right tabular-nums' : ''}`}
            />
          </TableCell>
        );
      })}
      {hasDeleteColumn && <TableCell className="w-10" />}
      {hasCloneColumn && <TableCell className="w-10" />}
    </TableRow>
  );
});

/**
 * Inline field that shows selected value and opens modal on click/focus.
 */
function LookupField({ value, placeholder, selectorUrl, selectorContext, token, onSelect, onKeyDown, inputRef, title, useInternalConsumptionDrawer = false }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  // Forward ref so parent can focus this field
  useEffect(() => {
    if (inputRef) inputRef.current = btnRef.current;
  }, [inputRef]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
          else if (onKeyDown) onKeyDown(e);
        }}
        className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-left flex items-center gap-2 hover:border-primary/50 focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {value ? (
          <span className="truncate text-foreground">{value}</span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        )}
      </button>
      {useInternalConsumptionDrawer ? (
        <InternalConsumptionProductSearchDrawer
          open={open}
          onClose={() => setOpen(false)}
          onSelect={(item) => { onSelect(item); setOpen(false); }}
          selectorUrl={selectorUrl}
          selectorContext={selectorContext}
          token={token}
          title={title ? `Search ${title}` : undefined}
        />
      ) : (
        <ProductSearchDrawer
          open={open}
          onClose={() => setOpen(false)}
          onSelect={(item) => { onSelect(item); setOpen(false); }}
          selectorUrl={selectorUrl}
          selectorContext={selectorContext}
          token={token}
          title={title ? `Search ${title}` : undefined}
        />
      )}
    </>
  );
}

/**
 * Small button that opens the ProductSearchDrawer for lookup-enabled fields.
 */
function LookupButton({ selectorUrl, selectorContext, token, onSelect, title }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 w-8 flex items-center justify-center rounded border border-input hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={`Search ${title || ''}`}
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      <ProductSearchDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => { onSelect(item); setOpen(false); }}
        selectorUrl={selectorUrl}
        selectorContext={selectorContext}
        token={token}
        title={title ? `Search ${title}` : undefined}
      />
    </>
  );
}

/**
 * Generic data table driven by column/filter declarations.
 *
 * Props:
 *  - columns: Array<{ key, label, type }>  (type can be 'string' | 'amount' | 'status')
 *  - filters: string[] of column keys that are searchable
 *  - data: array of row objects
 *  - onRowSelect: (row) => void
 *  - onNavigate: (row) => void — when provided, clicking a row calls onNavigate instead of onRowSelect
 *  - selectedId: string | number
 *  - compact: boolean (reserved for narrower layout)
 *  - loading: boolean (shows skeleton when true)
 *  - addRow: { active, fields, onAdd, onCancel, catalogs, onFieldChange } — inline add row config
 *  - onDeleteRow: (row) => void — when provided, renders a per-row delete button (trash icon)
 *      that appears on row hover and on keyboard focus. Invoked with the row object; click
 *      propagation is stopped so it does not trigger row selection or navigation.
 */
export function DataTable({
  entity,
  columns = [],
  filters = [],
  data = [],
  onRowSelect,
  onNavigate,
  onRowClick,
  selectedRowId,
  selectedId,
  compact,
  loading,
  addRow,
  selectable = true,
  isRowSelectable,
  onSelectionChange,
  sortColumn,
  sortDirection,
  onSort,
  onColumnsReady,
  token,
  apiBaseUrl,
  showFooterTotals = true,
  selectorContext,
  onDataMutated,
  labelOverrides,
  onDeleteRow,
  onCloneRow,
  onFilterChange,
  onClearAllFilters,
  columnFilters = {},
  rowFilter,
}) {
  const t = useLabel(labelOverrides);
  const tMenu = useMenuLabel();
  const ui = useUI();
  const dictionary = useLocale();
  const { locale } = useLocaleSwitch();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale.replace('_', '-'), { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [locale]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [optimisticToggles, setOptimisticToggles] = useState({});
  const [savingToggles, setSavingToggles] = useState({});
  const [deletingRows, setDeletingRows] = useState({});

  useEffect(() => {
    setOptimisticToggles({});
    setSavingToggles({});
    setDeletingRows({});
  }, [data]);

  // Report columns to parent (e.g., ListView sort popover)
  useEffect(() => {
    if (onColumnsReady && columns.length > 0) {
      onColumnsReady(columns);
    }
  }, [columns, onColumnsReady]);

  const hasColumnFilter = useMemo(() => Object.values(columnFilters).some(v => v), [columnFilters]);
  const hasActiveFilter = searchQuery.length > 0 || hasColumnFilter;

  const filteredData = useMemo(() => {
    let result = data;

    // If onFilterChange is provided, column filters/sort are handled by the backend;
    // skip local search + column filter loops. Otherwise apply them client-side.
    if (!onFilterChange) {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        result = result.filter(row =>
          filters.some(key => {
            const val = resolveIdentifier(row, key);
            return String(val ?? '').toLowerCase().includes(q);
          })
        );
      }
    }

    // Row-level predicate (e.g. numeric conditions like outstandingAmount > 0)
    // is always applied locally — the backend cannot evaluate arbitrary JS predicates.
    if (rowFilter) result = result.filter(rowFilter);
    return result;
  }, [data, filters, searchQuery, onFilterChange, rowFilter]);

  const amountColumns = useMemo(
    () => columns.filter(col => col.type === 'amount'),
    [columns]
  );

  const internalConsumptionWarehouseByLocator = useMemo(() => {
    if (entity !== 'internalConsumptionLine') return new Map();
    const fields = addRow?.fields || [];
    const catalogs = addRow?.catalogs;
    const storageBinField = fields.find(f => f.key === 'storageBin');
    if (!storageBinField || !catalogs) return new Map();
    const options = getCatalogOptions(catalogs, entity, storageBinField);
    const map = new Map();
    for (const opt of options) {
      if (!opt?.id) continue;
      map.set(String(opt.id), opt.name || opt.label || opt._identifier || String(opt.id));
    }
    return map;
  }, [entity, addRow?.fields, addRow?.catalogs]);

  const totals = useMemo(() => {
    if (amountColumns.length === 0) return null;
    const sums = {};
    for (const col of amountColumns) {
      sums[col.key] = filteredData.reduce((sum, row) => sum + (Number(row[col.key]) || 0), 0);
    }
    return sums;
  }, [filteredData, amountColumns]);

  const handleInlineToggle = useCallback(async (row, col, checked) => {
    const toggleKey = `${row.id}:${col.key}`;
    if (!apiBaseUrl || !entity || !row?.id || !token) {
      toast.error('Inline toggle is not available in this context');
      return;
    }

    setOptimisticToggles(prev => ({ ...prev, [toggleKey]: checked }));
    setSavingToggles(prev => ({ ...prev, [toggleKey]: true }));

    try {
      const res = await fetch(`${apiBaseUrl}/${entity}/${row.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [col.key]: checked }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }

      onDataMutated?.();
    } catch (error) {
      setOptimisticToggles(prev => {
        const next = { ...prev };
        delete next[toggleKey];
        return next;
      });
      toast.error(error?.message || 'Failed to update record');
    } finally {
      setSavingToggles(prev => {
        const next = { ...prev };
        delete next[toggleKey];
        return next;
      });
    }
  }, [apiBaseUrl, entity, onDataMutated, token]);

  const renderCellValue = (row, col) => {
    // Custom render function takes priority
    if (typeof col.render === 'function') return col.render(row, { entity, token, apiBaseUrl });
    const toggleKey = `${row.id}:${col.key}`;
    const rawValue = Object.prototype.hasOwnProperty.call(optimisticToggles, toggleKey)
      ? optimisticToggles[toggleKey]
      : row[col.key];
    let display = resolveIdentifier(row, col.key);
    if (entity === 'internalConsumptionLine' && col.key === 'storageBin') {
      const locatorId = row?.storageBin;
      if (locatorId != null) {
        const warehouseLabel = internalConsumptionWarehouseByLocator.get(String(locatorId));
        if (warehouseLabel) display = warehouseLabel;
      }
    }
    if (col === columns[0] && col.type === 'string') {
      const pill = col.pill;
      const pillLabel = pill && pill.when(row) ? pill.label : null;
      return (
        <span className="inline-flex items-center gap-2">
          <span>{display}</span>
          {pillLabel && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${pill.className || 'bg-gray-50 text-gray-600 border-gray-200'}`} style={{ borderWidth: '0.5px' }}>
              {pillLabel}
            </span>
          )}
        </span>
      );
    }
    if (col.type === 'enum') {
      const raw = rawValue;
      const label = tMenu(col.enumLabels?.[raw] ?? raw);
      if (col.display === 'dot') {
        const dotColor = getStatusDotColor(raw);
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            {label}
          </span>
        );
      }
      if (col.enumVariants) {
        const variant = col.enumVariants[raw] ?? 'neutral';
        return <Tag variant={variant} label={label} />;
      }
      return <span>{label}</span>;
    }
    if (col.type === 'status') {
      const raw = row[col.key];
      const label = statusLabel(raw, dictionary);
      if (col.display === 'dot') {
        const dotColor = getStatusDotColor(raw);
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            {label}
          </span>
        );
      }
      return <StatusTag status={raw} label={label} />;
    }
    if (col.type === 'percent') {
      const val = Number(row[col.key]);
      const pct = isNaN(val) ? 0 : val;
      const color = pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200';
      const textColor = pct >= 100 ? 'text-emerald-700' : pct > 0 ? 'text-amber-700' : 'text-slate-400';
      return (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className={`text-xs tabular-nums ${textColor}`}>{pct}%</span>
        </div>
      );
    }
    if (col.type === 'boolean') {
      const val = rawValue;
      if (col.toggle) {
        const checked = isTruthyBoolean(val);
        const disabled = !!savingToggles[toggleKey] || (!isTruthyBoolean(val) && !isFalsyBoolean(val));
        return (
          <div
            className="flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={checked}
              disabled={disabled}
              onCheckedChange={(nextChecked) => {
                void handleInlineToggle(row, col, nextChecked);
              }}
              aria-label={resolveColumnLabel(col, locale, t)}
            />
          </div>
        );
      }
      if (col.badge) {
        const resolveBadgeLabel = (raw, fallback) => {
          if (raw && typeof raw === 'object') return raw[locale] ?? raw.en_US ?? fallback;
          return raw ?? fallback;
        };
        const trueLabel  = resolveBadgeLabel(col.badgeLabels?.true,  ui('statusComplete'));
        const falseLabel = resolveBadgeLabel(col.badgeLabels?.false, ui('statusInProcess'));
        if (!col.badgeColors) {
          const trueVariant = col.badgeVariants?.true ?? 'green';
          const falseVariant = col.badgeVariants?.false ?? 'neutral';
          if (isTruthyBoolean(val)) return <Tag variant={trueVariant} label={trueLabel} />;
          if (isFalsyBoolean(val)) return <Tag variant={falseVariant} label={falseLabel} />;
        } else {
          const trueColor  = col.badgeColors.true  ?? 'bg-emerald-100 text-emerald-800';
          const falseColor = col.badgeColors.false ?? 'bg-amber-100 text-amber-700';
          if (isTruthyBoolean(val)) return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trueColor}`}>
              {trueLabel}
            </span>
          );
          if (isFalsyBoolean(val)) return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${falseColor}`}>
              {falseLabel}
            </span>
          );
        }
      }
      if (isTruthyBoolean(val)) return <span className="text-emerald-600">{ui('yes')}</span>;
      if (isFalsyBoolean(val)) return <span className="text-slate-400">{ui('no')}</span>;
      return <span className="text-slate-300">&mdash;</span>;
    }
    if (col.type === 'date') {
      const raw = row[col.key];
      // Parse date-only strings (yyyy-MM-dd) as local to avoid timezone shift
      const parsed = raw ? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00') : new Date(raw)) : null;
      const formatted = parsed && !isNaN(parsed) ? dateFormatter.format(parsed) : '\u2014';
      return <span>{formatted}</span>;
    }
    if (col.type === 'amount') {
      return <span className="tabular-nums">{formatAmount(row[col.key], row['currency$_identifier'])}</span>;
    }
    // Truncate long display values
    const val = display;
    if (typeof val === 'string' && val.length > 30) {
      return <span className="block max-w-[200px] truncate" title={val}>{val}</span>;
    }
    return val;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <TableSkeleton columns={columns.length > 0 ? columns : [{ key: '_1' }, { key: '_2' }, { key: '_3' }]} />
      </div>
    );
  }

  const allSelected = filteredData.length > 0 && selectedRows.size === filteredData.length;
  const someSelected = selectedRows.size > 0 && !allSelected;

  const selectableData = isRowSelectable ? filteredData.filter(isRowSelectable) : filteredData;

  const toggleAll = (e) => {
    e.stopPropagation();
    if (allSelected) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(selectableData.map(r => r.id));
      setSelectedRows(allIds);
      onSelectionChange?.(selectableData);
    }
  };

  const toggleRow = (e, row) => {
    e.stopPropagation();
    if (isRowSelectable && !isRowSelectable(row)) return;
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      onSelectionChange?.(filteredData.filter(r => next.has(r.id)));
      return next;
    });
  };

  const colSpan = columns.length + (selectable ? 1 : 0) + (onDeleteRow ? 1 : 0) + (onCloneRow ? 1 : 0);

  return (
    <div className="space-y-0">
      <div className="overflow-x-auto overflow-y-visible">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/40">
              {selectable && (
                <TableHead className="w-10 px-3 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </TableHead>
              )}
              {columns.map(col => {
                const colLabel = resolveColumnLabel(col, locale, t);
                const isSorted = sortColumn === col.key;
                return (
                  <TableHead key={col.key} className="align-middle">
                    {onSort ? (
                        <button
                          type="button"
                          className="text-xs leading-4 font-semibold text-text-primary tracking-normal cursor-pointer select-none transition-colors bg-transparent border-0 p-0 text-left"
                          onClick={() => onSort(col.key)}
                        >
                          {colLabel}
                          {isSorted && (
                            <span className="ml-1 text-primary/70">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs leading-4 font-semibold text-text-primary tracking-normal">
                          {colLabel}
                          {isSorted && (
                            <span className="ml-1 text-primary/70">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
                          )}
                        </span>
                      )}
                  </TableHead>
                );
              })}
              {onDeleteRow && <TableHead className="w-10 px-2" />}
              {onCloneRow && <TableHead className="w-10 px-2" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 && !addRow?.active ? (
              <TableRow data-empty-state="">
                <TableCell colSpan={colSpan} className="p-0">
                  <EmptyState hasFilter={hasActiveFilter} totalCount={data.length} />
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, idx) => {
                const isChecked = selectedRows.has(row.id);
                const isSelectedLine = selectedRowId != null && row.id === selectedRowId;
                return (
                  <TableRow
                    key={row.id ?? idx}
                    data-testid={`row-${row.id ?? idx}`}
                    onClick={() => {
                      if (onRowClick) onRowClick(row);
                      else if (onNavigate) onNavigate(row);
                      else onRowSelect?.(row);
                    }}
                    className={[
                      'transition-colors h-12 group/row',
                      (onRowClick || onNavigate) ? 'cursor-pointer' : 'cursor-default',
                      isChecked ? 'bg-primary/5' : '',
                      selectedId != null && row.id === selectedId ? 'bg-primary/10' : '',
                      isSelectedLine ? 'bg-slate-200/90 ring-1 ring-slate-300' : '',
                      isSelectedLine ? 'hover:bg-slate-300/80' : (onRowClick || onNavigate) ? 'hover:bg-muted/50' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {selectable && (() => {
                      const rowDisabled = isRowSelectable && !isRowSelectable(row);
                      return (
                        <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={rowDisabled}
                            onChange={(e) => toggleRow(e, row)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            style={rowDisabled ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                          />
                        </TableCell>
                      );
                    })()}
                    {columns.map(col => (
                      <TableCell key={col.key} className={['text-sm', NUMERIC_FIELD_TYPES.has(col.type) ? 'text-right tabular-nums' : ''].filter(Boolean).join(' ')}>
                        {renderCellValue(row, col)}
                      </TableCell>
                    ))}
                    {onDeleteRow && (
                      <TableCell className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={!!deletingRows[row.id]}
                          onClick={async () => {
                            const deleteKey = row.id;
                            setDeletingRows(prev => ({ ...prev, [deleteKey]: true }));
                            try {
                              await onDeleteRow(row);
                            } finally {
                              setDeletingRows(prev => {
                                const next = { ...prev };
                                delete next[deleteKey];
                                return next;
                              });
                            }
                          }}
                          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title={ui('deleteRowTooltip')}
                          aria-label={ui('deleteRowTooltip')}
                        >
                          {deletingRows[row.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                      </TableCell>
                    )}
                    {onCloneRow && (
                      <TableCell className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group/clonebtn flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => onCloneRow(row)}
                            className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 flex items-center justify-center rounded border border-border bg-white text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
                            style={{ width: 26, height: 26 }}
                            aria-label={ui('cloneOrderBtn')}
                          >
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover/clonebtn:opacity-100 pointer-events-none transition-opacity z-10">
                            {ui('cloneOrderBtn')}
                          </div>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
            {addRow?.active && (
              <InlineAddRow
                ref={addRow.ref}
                columns={columns}
                fields={addRow.fields}
                onAdd={addRow.onAdd}
                onCancel={addRow.onCancel}
                data={data}
                catalogs={addRow.catalogs}
                onFieldChange={addRow.onFieldChange}
                  selectable={selectable}
                  hasDeleteColumn={!!onDeleteRow}
                  hasCloneColumn={!!onCloneRow}
                  token={token}
                  apiBaseUrl={apiBaseUrl}
                  entity={entity}
                  selectorContext={selectorContext}
                />
              )}
          </TableBody>
          {totals && showFooterTotals && (
            <TableFooter>
              <TableRow className="font-medium">
                {selectable && <TableCell />}
                {columns.map((col, idx) => (
                  <TableCell key={col.key} className={col.type === 'amount' ? 'tabular-nums text-right font-semibold' : ''}>
                    {col.type === 'amount'
                      ? formatAmount(totals[col.key], filteredData[0]?.['currency$_identifier'])
                      : ''}
                  </TableCell>
                ))}
                {onDeleteRow && <TableCell />}
                {onCloneRow && <TableCell />}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      {addRow?.active && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {ui('inlineAddHint')}
        </p>
      )}
    </div>
  );
}
