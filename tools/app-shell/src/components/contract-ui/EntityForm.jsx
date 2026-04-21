import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { useLabel, useLocaleSwitch, useMenuLabel, useUI } from '@/i18n';
import { buildUrlWithParams } from '@/lib/buildUrlWithParams.js';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';
import { getCatalogOptions } from '@/lib/selectorCatalog.js';
import { ImageField } from './ImageField.jsx';
import ProductSearchDrawer from './ProductSearchDrawer.jsx';
import { CreateContactContext } from './CreateContactContext.js';

function buildSelectPlaceholder(ui, label) {
  return `${ui('selectLabelPrefix')} ${label}...`;
}

function buildSearchPlaceholder(ui, label) {
  return `${ui('searchLabelPrefix')} ${label}...`;
}

/**
 * Button that opens the ProductSearchDrawer popup for fields with popup: true.
 */
function PopupSearchInput({ field, value, displayValue, onChange, label, selectorUrl, selectorContext, token }) {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const displayText = displayValue || (value ? value : '');
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`field-${field.key}`}
        className="w-full h-10 text-sm rounded-md border border-input bg-background px-3 text-left flex items-center gap-2 hover:border-primary/50 focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        {displayText ? (
          <span className="truncate text-foreground">{displayText}</span>
        ) : (
          <span className="truncate text-muted-foreground">{buildSearchPlaceholder(ui, label)}</span>
        )}
      </button>
      <ProductSearchDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => { onChange(item.id, item.label || item.name); setOpen(false); }}
        selectorUrl={selectorUrl}
        selectorContext={selectorContext}
        token={token}
        title={label}
      />
    </>
  );
}

/**
 * Dropdown selector for FK fields with many options (inputMode: search).
 * Supports both static catalog data (mock) and server-side filtering via API.
 */
function SearchInput({ entityName, field, value, displayValue, onChange, catalogs, resolvedLabel, selectorUrl, selectorContext, token }) {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(displayValue || value || '');
  const [serverResults, setServerResults] = useState(null);
  const [fetching, setFetching] = useState(false);
  // Tracks whether the user is actively typing so the sync effect doesn't fight keystrokes.
  const isEditingRef = useRef(false);
  const debounceRef = useRef(null);

  // Optional "Create contact" capability injected by custom windows via context.
  const createCtx = React.useContext(CreateContactContext);
  const canCreate = !!createCtx && createCtx.fieldKey === field.key;

  React.useEffect(() => {
    // Only sync from outside when the user is NOT actively editing.
    // This prevents the parent state update (triggered by onChange while typing)
    // from immediately reverting the input text.
    if (!isEditingRef.current) {
      setQuery(displayValue || value || '');
    }
  }, [value, displayValue]);

  // When a selectorUrl is configured, always use server search — ignore local catalog.
  // Mock catalog data is only a fallback for when no server is available (e.g. mock mode).
  const catalogOptions = selectorUrl ? null : catalogs?.[field.reference];

  // If we have an initial value but no label yet (and no catalog), try to fetch the single record
  React.useEffect(() => {
    if (!value || displayValue || isEditingRef.current) return;
    // Try local catalog
    const localOptions = getCatalogOptions(catalogs, entityName, field);
    const local = localOptions.find(opt => opt.id === value);
    if (local) { setQuery(local.name || value); return; }
    // Try server selector with ?id=
    if (!selectorUrl || !token) return;
    fetch(buildUrlWithParams(selectorUrl, { ...selectorContext, id: value }), {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const match = (data?.items || []).find(i => i.id === value);
        if (match) {
          setQuery(match.label || match.name || value);
          // Don't auto-select here, just set display text to avoid loop
        }
      })
      .catch(() => { });
  }, [value, displayValue, selectorUrl, selectorContext, token, catalogs, entityName, field]);

  // Server-side search triggered on typing or on focus (empty query = load initial options).
  const triggerServerSearch = (searchQuery) => {
    if (catalogOptions || !selectorUrl || !token) return;

    // Build params: include q only when the user has typed enough to filter
    const params = { ...selectorContext };
    if (searchQuery && searchQuery.length >= 2) params.q = searchQuery.trim();

    setFetching(true);
    fetch(buildUrlWithParams(selectorUrl, params), {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setServerResults((data.items || []).map(item => ({
            id: item.id,
            name: item.label || item.name || item.id,
            ...item
          })));
        }
      })
      .catch(() => { })
      .finally(() => setFetching(false));
  };

  // Local fallback: filter the pre-loaded catalog (used when selectorUrl not available)
  const localOptions = getCatalogOptions(catalogs, entityName, field);
  const filtered = useMemo(() => {
    // Server results take priority when available
    if (serverResults !== null) return serverResults.slice(0, 20);
    // When a real API selector is configured, don't show mock locals — wait for user to type
    if (selectorUrl) return [];
    if (!query || query.length === 0) return localOptions.slice(0, 10);
    const q = query.toLowerCase();
    return localOptions.filter(opt => opt.name.toLowerCase().includes(q)).slice(0, 10);
  }, [serverResults, query, localOptions, selectorUrl]);

  const handleSelect = (opt) => {
    isEditingRef.current = false; // Finished editing
    setQuery(opt.name);
    setOpen(false);
    
    // Pass full record as 3rd arg so auxiliary fields (like M_PriceList_ID) can be mapped
    // by the parent Form (if the schema defines mapped column suffixes).
    onChange(opt.id, opt.name, opt);
  };

  const handleClear = () => {
    isEditingRef.current = false;
    setQuery('');
    setServerResults(null);
    setOpen(false);
    onChange('', '');
  };

  // If field is mandatory but value is empty, or if we have a value, don't show clear unless value exists
  const hasSelection = value != null && value !== '';

  const createBtn = canCreate ? (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-blue-50 border-b border-border/40 transition-colors"
      style={{ color: '#202452' }}
      onMouseDown={e => { e.preventDefault(); setOpen(false); createCtx.onOpen(query, handleSelect); }}
    >
      + {ui('createContact')}
    </button>
  ) : null;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={field.key}
          name={field.key}
          data-testid={`field-${field.key}`}
          type="text"
          placeholder={buildSearchPlaceholder(ui, resolvedLabel)}
          value={query}
          onChange={(e) => {
            isEditingRef.current = true;
            const newQuery = e.target.value;
            setQuery(newQuery);
            if (!open) setOpen(true);
            
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              triggerServerSearch(newQuery);
            }, 300);
          }}
          onFocus={() => {
            setOpen(true);
            // Always load options on focus when none are cached yet (covers empty/cleared field)
            if (!catalogOptions && !serverResults) {
              triggerServerSearch(query);
            }
          }}
          onBlur={() => {
            // Delay closing so click events on dropdown items can fire first
            isEditingRef.current = false;
            setTimeout(() => setOpen(false), 200);
          }}
          className="pl-8 pr-8 focus:ring-2 focus:ring-primary focus:outline-none"
          required={field.required}
          autoComplete="off"
        />
        {hasSelection && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className="absolute right-2 top-2 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            tabIndex={-1}
            aria-label={ui('clear')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && (canCreate || filtered.length > 0) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {createBtn}
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              data-testid={`option-${opt.id}`}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
              onMouseDown={() => handleSelect(opt)}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
      {open && query.length > 0 && fetching && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg">
          <div className="px-3 py-2 text-xs text-muted-foreground">{ui('searching')}</div>
        </div>
      )}
      {open && query.length > 0 && !fetching && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {createBtn}
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {ui('noResultsFor')} &ldquo;{query}&rdquo;
          </div>
        </div>
      )}
      {open && !query && !fetching && canCreate && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg">
          {createBtn}
        </div>
      )}
    </div>
  );
}

const SELECTOR_PAGE = 50;

/**
 * Dropdown selector for FK fields with few options (inputMode: selector).
 * Fetches options from the server with lazy pagination triggered by scrolling.
 * Falls back to catalog when no selectorUrl is provided.
 */
function SelectorInput({ entityName, field, value, displayValue, onChange, catalogs, resolvedLabel, selectorUrl, selectorContext, token }) {
  const ui = useUI();
  const catalogOptions = getCatalogOptions(catalogs, entityName, field);
  const [serverOptions, setServerOptions] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);

  const fetchPage = useCallback((offset) => {
    if (!selectorUrl || !token || loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    const url = buildUrlWithParams(selectorUrl, {
      ...selectorContext,
      limit: SELECTOR_PAGE,
      offset,
    });
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const items = data?.items ?? data?.response?.data ?? (Array.isArray(data) ? data : null);
        if (items) {
          const mapped = items.map(i => ({ id: i.id, name: i.label ?? i.name ?? i.id }));
          setServerOptions(prev => offset === 0 ? mapped : [...(prev ?? []), ...mapped]);
          offsetRef.current = offset + items.length;
          if (items.length < SELECTOR_PAGE) { setHasMore(false); hasMoreRef.current = false; }
        }
        loadingRef.current = false;
      })
      .catch(() => { loadingRef.current = false; });
  }, [selectorUrl, selectorContext, token]);

  // Load first page when selectorUrl/token available
  useEffect(() => {
    if (!selectorUrl || !token) return;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setServerOptions(null);
    fetchPage(0);
  }, [selectorUrl, token, fetchPage]);

  // Callback ref: fires when SelectContent mounts (dropdown opens) — attaches scroll listener
  const contentCallbackRef = useCallback((node) => {
    if (!node || !selectorUrl) return;
    // Radix renders [data-radix-select-viewport] as the actual scrollable element
    const viewport = node.querySelector('[data-radix-select-viewport]') ?? node;
    viewport.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      if (scrollHeight - scrollTop - clientHeight < 100) fetchPage(offsetRef.current);
    }, { passive: true });
  }, [fetchPage, selectorUrl]);

  const baseOptions = serverOptions ?? catalogOptions;
  // Whether the current value is among the (possibly filtered) server options.
  const hasValue = value && baseOptions.some(opt => opt.id === value);

  return (
    <Select
      value={value || '__empty__'}
      onValueChange={(val) => {
        if (val === '__empty__') {
          onChange('', '', null);
          return;
        }
        const opt = baseOptions.find(o => o.id === val);
        onChange(val, opt?.name, opt);
      }}
      required={field.required}
    >
      <SelectTrigger id={field.key} data-testid={`field-${field.key}`} className="focus:ring-2 focus:ring-primary">
        <SelectValue placeholder={buildSelectPlaceholder(ui, resolvedLabel)} />
      </SelectTrigger>
      <SelectContent ref={contentCallbackRef}>
        {!field.required && <SelectItem value="__empty__">&nbsp;</SelectItem>}
        {/* When the current value is not among the filtered options (e.g. a purchase price list
            on a sales invoice), render a hidden item so Radix can display the current label in
            the trigger — but the user cannot re-select it from the dropdown. */}
        {!hasValue && value && displayValue && (
          <SelectItem
            key={`__current__${value}`}
            value={value}
            style={{ display: 'none', height: 0, padding: 0, overflow: 'hidden' }}
            aria-hidden="true"
          >
            {displayValue}
          </SelectItem>
        )}
        {baseOptions.map(opt => (
          <SelectItem key={opt.id} value={opt.id} data-testid={`option-${field.key}-${opt.id}`}>{opt.name}</SelectItem>
        ))}
        {hasMore && selectorUrl && (
          <div className="py-1 text-center text-xs text-muted-foreground select-none pointer-events-none">{ui('loading')}</div>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Dependent Select for FK fields that require a parent context.
 * Re-fetches options whenever the parent value changes.
 */
function DependentSelect({ field, value, displayValue, onChange, catalogs, formData, resolvedLabel, selectorUrl, selectorContext, token }) {
  const ui = useUI();
  const [dynamicOptions, setDynamicOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const parentKey = field.dependsOn?.field;
  const parentValue = formData?.[parentKey];

  React.useEffect(() => {
    if (!parentValue || !selectorUrl || !token) {
      setDynamicOptions([]);
      return;
    }

    setLoading(true);
    const url = buildUrlWithParams(selectorUrl, {
      ...selectorContext,
      [field.dependsOn?.filterKey]: parentValue,
    });
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.items) {
          const items = data.items.map(i => ({ id: i.id, name: i.label || i.name || i.id, ...i }));
          setDynamicOptions(items);
          // Auto-select first option if current value is empty or not in the new options
          // (e.g., BP changed → old address no longer valid)
          const currentValid = value && items.some(i => i.id === value);
          if (!currentValid && items.length > 0) {
            onChange(items[0].id, items[0].name);
          }
        }
      })
      .catch(() => {
        setLoading(false);
        setDynamicOptions([]);
      });
  }, [parentValue, selectorUrl, selectorContext, token, field.dependsOn?.filterKey]);

  // If the current value isn't in options (real data from existing record), add it
  const hasValue = value && dynamicOptions.some(opt => opt.id === value);
  const options = (!hasValue && value && displayValue)
    ? [...dynamicOptions, { id: value, name: displayValue }]
    : dynamicOptions;

  // Auto-clear dependent field if parent is cleared
  React.useEffect(() => {
    if (!parentValue && value) {
      onChange('', '');
    }
  }, [parentValue, value]);

  return (
    <Select
      value={value || '__empty__'}
      onValueChange={(val) => {
        if (val === '__empty__') {
          onChange('', '', null);
          return;
        }
        const opt = options.find(o => o.id === val);
        onChange(val, opt?.name, opt);
      }}
      required={field.required}
      disabled={(!parentValue && !value) || loading}
    >
      <SelectTrigger id={field.key} data-testid={`field-${field.key}`} className="focus:ring-2 focus:ring-primary">
        <SelectValue
          placeholder={loading ? ui('loading') : (parentValue ? buildSelectPlaceholder(ui, resolvedLabel) : ui('selectParentFirst'))}
        />
      </SelectTrigger>
      <SelectContent>
        {!field.required && <SelectItem value="__empty__">&nbsp;</SelectItem>}
        {options.map(opt => (
          <SelectItem key={opt.id} value={opt.id} data-testid={`option-${field.key}-${opt.id}`}>{opt.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Form field that opens a ProductSearchDrawer for lookup-enabled search fields.
 */
function LookupFormField({ field, value, displayValue, selectorUrl, selectorContext, token, resolvedLabel, onChange }) {
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const display = displayValue || value || '';
  return (
    <>
      <button
        type="button"
        data-testid={`field-${field.key}`}
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm text-left hover:border-primary/50 focus:ring-2 focus:ring-primary focus:outline-none transition-colors"
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        {display ? (
          <span className="flex-1 truncate text-foreground">{display}</span>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{buildSearchPlaceholder(ui, resolvedLabel)}</span>
        )}
      </button>
      <ProductSearchDrawer
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => {
          onChange(item.id, item.label || item.name || item._identifier || '', item);
          setOpen(false);
        }}
        selectorUrl={selectorUrl}
        selectorContext={selectorContext}
        token={token}
        title={resolvedLabel}
      />
    </>
  );
}

/**
 * Generic Entity Form component.
 * Layouts: 'horizontal' (grid-based edit form) | 'vertical' (stack-based sidebar)
 * 
 * Props:
 *  - fields: Array<{ key, label, type, required, reference, inputMode, dependsOn }>
 *  - data: object with current field values
 *  - onChange: (fieldKey, value) => void
 *  - catalogs: Record<string, Array<{ id, name, ... }>> for FK reference data
 *  - displayLogic: { readOnly: { fieldName: bool }, visibility: { fieldName: bool } }
 */
export function EntityForm({ entity, fields = [], data, onChange, catalogs, layout, cols, section, excludeFields = [], displayLogic, api, token, apiBaseUrl, selectorContext = {}, readOnly: formReadOnly = false, onFieldBlur, savingField = null, labelOverrides }) {
  const t = useLabel(labelOverrides ?? api?.labelOverrides);
  const tMenu = useMenuLabel();
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const effectiveSelectorContext = useMemo(() => selectorContext ?? {}, [selectorContext]);
  const visibleBaseFields = fields.filter(f => !excludeFields.includes(f.key));
  let displayFields;
  if (section) {
    // When filtering by section, include all fields (editable + readOnly) for that section
    displayFields = visibleBaseFields.filter(f => f.section === section);
  } else if (layout === 'horizontal') {
    displayFields = visibleBaseFields.filter(f => !f.readOnly);
  } else {
    displayFields = visibleBaseFields;
  }

  // Apply visibility from evaluate-display (hide fields where visibility === false).
  // Only honor the evaluate-display result if the field itself declares a displayLogic
  // in its contract definition. Fields without displayLogic have a static visibility
  // decision that evaluate-display must not override (prevents AD displayLogic bugs
  // from incorrectly hiding fields like businessPartner).
  // Fields with a function-based displayLogic are handled entirely client-side (second
  // filter below) and must NOT be removed here — the server result is irrelevant for them.
  if (displayLogic?.visibility && Object.keys(displayLogic.visibility).length > 0) {
    displayFields = displayFields.filter(f =>
      typeof f.displayLogic === 'function' || !f.displayLogic || displayLogic.visibility[f.key] !== false
    );
  }

  // Apply function-based displayLogic evaluated client-side against current data.
  // This mirrors the readOnlyLogic pattern and handles fields like customer/vendor
  // tabs where visibility depends on a sibling checkbox value (no server round-trip needed).
  displayFields = displayFields.filter(f =>
    typeof f.displayLogic !== 'function' || !!f.displayLogic(data ?? {})
  );

  if (displayFields.length === 0) return null;

  const gridClass = cols
    ? 'grid'
    : (layout === 'horizontal'
      ? 'grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3'
      : 'grid grid-cols-2 gap-3 md:grid-cols-3');
  const gridStyle = cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 } : undefined;

  // If there's an image field, pin it to the right — rest of fields render in a 3-col grid on the left
  const imageField = displayFields.find(f => f.type === 'image');
  const fieldsToRender = imageField ? displayFields.filter(f => f.type !== 'image') : displayFields;

  const renderField = (f) => {
    // Resolution order: per-window AD_Field label (most specific) → global locale by column → camelCase key
    const label = t(f.column) ?? f.label ?? f.key;
    // Field is read-only if statically declared, dynamically set by evaluate-display, or readOnlyLogic evaluates to true
    const isReadOnly = formReadOnly
      || f.readOnly
      || displayLogic?.readOnly?.[f.key] === true
      || (typeof f.readOnlyLogic === 'function' && !!f.readOnlyLogic(data ?? {}));
    const rawDisplayValue = resolveIdentifier(data, f.key) ?? data?.[f.key] ?? '';
    // Strip floating-point noise (e.g. 243.20999999999998 → 243.21) for read-only number fields.
    // toFixed(10) preserves up to 10 significant decimal places while eliminating IEEE 754 drift.
    const displayValue = f.type === 'number' && isReadOnly && Number.isFinite(Number(rawDisplayValue))
      ? parseFloat(Number(rawDisplayValue).toFixed(10))
      : rawDisplayValue;
    // Shared read-only rendering for FK-style fields (dependent, selector, search)
    const renderReadOnlyFk = () => (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={f.key} className="text-sm text-muted-foreground font-medium">
          {label}
        </Label>
        <Input value={resolveIdentifier(data, f.key) || data?.[f.key] || ''} disabled className="bg-muted/50" />
      </div>
    );
    if (f.type === 'checkbox') {
      return (
        <div key={f.key} className="flex items-center gap-2 pt-6">
          <button
            type="button"
            role="checkbox"
            aria-checked={!!data?.[f.key]}
            disabled={isReadOnly}
            id={f.key}
            data-testid={`field-${f.key}`}
            onClick={() => !isReadOnly && onChange?.(f.key, !data?.[f.key], f.column)}
            className={[
              'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !!data?.[f.key]
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent',
            ].join(' ')}
          >
            {!!data?.[f.key] && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium cursor-pointer">
            {label}
          </Label>
        </div>
      );
    }
    if (f.type === 'dependent') {
      if (isReadOnly) return renderReadOnlyFk();
      return (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
            {label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </Label>
          <DependentSelect
            field={f}
            value={data?.[f.key] ?? ''}
            displayValue={data?.[f.key + '$_identifier']}
            onChange={(val, label) => {
              onChange?.(f.key, val, f.column);
              if (label) onChange?.(f.key + '$_identifier', label);
            }}
            catalogs={catalogs}
            formData={data}
            resolvedLabel={label}
            selectorUrl={apiBaseUrl ? `${apiBaseUrl}/${entity}/selectors/${f.column}` : null}
            selectorContext={effectiveSelectorContext}
            token={token}
          />
        </div>
      );
    }
    if (f.type === 'selector') {
      if (isReadOnly) return renderReadOnlyFk();
      return (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
            {label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </Label>
          <SelectorInput
            entityName={entity}
            field={f}
            value={data?.[f.key] ?? ''}
            displayValue={resolveIdentifier(data, f.key)}
            onChange={(val, label, auxData) => {
              onChange?.(f.key, val, f.column);
              if (label) onChange?.(f.key + '$_identifier', label);
              if (auxData) {
                for (const [suffix, auxVal] of Object.entries(auxData)) {
                  if (suffix === '_aux' && auxVal && typeof auxVal === 'object') {
                    for (const [auxSuffix, auxSuffixVal] of Object.entries(auxVal)) {
                      onChange?.(f.key + auxSuffix, auxSuffixVal);
                    }
                  } else {
                    onChange?.(f.key + suffix, auxVal);
                  }
                }
              }
            }}
            catalogs={catalogs}
            resolvedLabel={label}
            selectorUrl={(() => {
              if (!apiBaseUrl) return null;
              // Always compute from apiBaseUrl so the full server path is included.
              // Append query params from api.selectors entry if present (e.g. ?isSOTrx=Y).
              const entry = api?.selectors?.find(s => s.entity === entity && s.field === f.key);
              const base = `${apiBaseUrl}/${entity}/selectors/${f.column}`;
              return entry?.url?.includes('?') ? `${base}?${entry.url.split('?')[1]}` : base;
            })()}
            selectorContext={effectiveSelectorContext}
            token={token}
          />
        </div>
      );
    }
    if (f.type === 'search') {
      if (isReadOnly) return renderReadOnlyFk();
      // Use the URL from api.selectors when it carries explicit context params (e.g. ?isSOTrx=Y).
      // Always compute the selector URL from apiBaseUrl so it contains the full server path
      // (e.g. https://server/etendo/sws/neo/...). When the api.selectors entry carries
      // context filter params (e.g. ?isCustomer=Y, ?isVendor=Y), append them to the
      // computed base URL instead of using the entry URL as-is (which would be a relative
      // path that breaks on servers where the app context differs from the API context).
      const apiSelectorEntry = api?.selectors?.find(s => s.entity === entity && s.field === f.key);
      const selectorUrl = apiBaseUrl ? (() => {
        const base = `${apiBaseUrl}/${entity}/selectors/${f.column}`;
        if (apiSelectorEntry?.url?.includes('?')) {
          return `${base}?${apiSelectorEntry.url.split('?')[1]}`;
        }
        return base;
      })() : null;
      const searchOnChange = (val, lbl, auxData) => {
        onChange?.(f.key, val, f.column);
        if (lbl) onChange?.(f.key + '$_identifier', lbl);
        if (auxData) {
          const isGross = auxData.isTaxIncluded !== false;
          for (const [suffix, auxVal] of Object.entries(auxData)) {
            // Price from the document's price list. Mapping depends on price list type:
            //   - Gross list (isTaxIncluded=true): standardPrice is the gross price → grossUnitPrice
            //   - Net list   (isTaxIncluded=false): standardPrice is the net price   → unitPrice
            if (suffix === 'standardPrice' && auxVal != null) {
              if (isGross) {
                onChange?.('grossUnitPrice', auxVal);
              } else {
                onChange?.('unitPrice', auxVal);
              }
            } else if (suffix === '_aux' && auxVal && typeof auxVal === 'object') {
              for (const [auxSuffix, auxSuffixVal] of Object.entries(auxVal)) {
                onChange?.(f.key + auxSuffix, auxSuffixVal);
              }
            } else {
              onChange?.(f.key + suffix, auxVal);
            }
          }
        }
      };
      // Popup fields open a full ProductSearchDrawer instead of inline dropdown
      if (f.popup) {
        return (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-sm text-foreground font-medium">
              {label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
            </Label>
            <PopupSearchInput
              field={f}
              value={data?.[f.key] ?? ''}
              displayValue={data?.[f.key + '$_identifier']}
              onChange={(val, lbl) => {
                onChange?.(f.key, val, f.column);
                if (lbl) onChange?.(f.key + '$_identifier', lbl);
              }}
              label={label}
              selectorUrl={selectorUrl}
              selectorContext={effectiveSelectorContext}
              token={token}
            />
          </div>
        );
      }
      // Lookup fields open a full ProductSearchDrawer instead of inline dropdown
      if (f.lookup) {
        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
              {label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
            </Label>
            <LookupFormField
              field={f}
              value={data?.[f.key] ?? ''}
              displayValue={data?.[f.key + '$_identifier']}
              selectorUrl={selectorUrl}
              selectorContext={effectiveSelectorContext}
              token={token}
              resolvedLabel={label}
              onChange={searchOnChange}
            />
          </div>
        );
      }
      return (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
            {label}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </Label>
          <SearchInput
            entityName={entity}
            field={f}
            value={data?.[f.key] ?? ''}
            displayValue={data?.[f.key + '$_identifier']}
            onChange={searchOnChange}
            catalogs={catalogs}
            resolvedLabel={label}
            selectorUrl={selectorUrl}
            selectorContext={effectiveSelectorContext}
            token={token}
          />
        </div>
      );
    }
    if (f.type === 'select' && f.options?.length) {
      const selectValue = f.valueType === 'boolean'
        ? (data?.[f.key] === true || data?.[f.key] === 'Y' || data?.[f.key] === 'true'
          ? 'true'
          : (data?.[f.key] === false || data?.[f.key] === 'N' || data?.[f.key] === 'false'
            ? 'false'
            : ''))
        : (data?.[f.key] ?? '');
      return (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
            {label}{f.required && !isReadOnly ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </Label>
          <Select
            value={selectValue || '__empty__'}
            onValueChange={(val) => {
              if (val === '__empty__') {
                onChange?.(f.key, '', f.column);
                return;
              }
              onChange?.(f.key, f.valueType === 'boolean' ? val === 'true' : val, f.column);
            }}
            disabled={isReadOnly}
            required={f.required}
          >
            <SelectTrigger id={f.key} data-testid={`field-${f.key}`} className="focus:ring-2 focus:ring-primary">
              <SelectValue placeholder={buildSelectPlaceholder(ui, label)} />
            </SelectTrigger>
            <SelectContent>
              {!f.required && <SelectItem value="__empty__">&nbsp;</SelectItem>}
              {f.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{tMenu(opt.label)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (f.type === 'textarea') {
      return (
        <div key={f.key} className="space-y-1.5 h-full flex flex-col">
          <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
            {label}{f.required && !isReadOnly ? <span className="text-red-500 ml-0.5">*</span> : ''}
          </Label>
          <textarea
            id={f.key}
            name={f.key}
            data-testid={`field-${f.key}`}
            rows={4}
            value={isReadOnly ? displayValue : (data?.[f.key] ?? '')}
            onChange={(e) => onChange?.(f.key, e.target.value, f.column)}
            onBlur={() => onFieldBlur?.(f.key)}
            disabled={isReadOnly}
            className={[
              'flex w-full rounded-md border border-input px-3 py-2 text-sm shadow-sm',
              'placeholder:text-muted-foreground resize-none flex-1 min-h-[96px]',
              'focus:outline-none focus:ring-2 focus:ring-primary',
              isReadOnly ? 'bg-muted/50 cursor-default' : 'bg-background',
            ].join(' ')}
          />
        </div>
      );
    }
    const inputType = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
    return (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={f.key} className="text-sm text-foreground font-medium">
          {label}{f.required && !isReadOnly ? <span className="text-red-500 ml-0.5">*</span> : ''}
        </Label>
        <Input
          id={f.key}
          name={f.key}
          data-testid={`field-${f.key}`}
          type={inputType}
          value={isReadOnly ? displayValue : (data?.[f.key] ?? '')}
          onChange={(e) => onChange?.(f.key, e.target.value, f.column)}
          onBlur={() => onFieldBlur?.(f.key)}
          className={isReadOnly ? 'bg-muted/50' : 'focus:ring-2 focus:ring-primary focus:outline-none'}
          required={f.required && !isReadOnly}
          disabled={isReadOnly || savingField === f.key}
        />
      </div>
    );
  };

  if (imageField) {
    const imgLabel = imageField.label ?? t(imageField.column) ?? imageField.key;
    const imgReadOnly = formReadOnly
      || imageField.readOnly
      || displayLogic?.readOnly?.[imageField.key] === true
      || (typeof imageField.readOnlyLogic === 'function' && !!imageField.readOnlyLogic(data ?? {}));
    return (
      <div className="flex gap-6 items-start">
        <div className={`flex-1 min-w-0 ${gridClass}`} style={gridStyle}>
          {fieldsToRender.map(renderField)}
        </div>
        <div className="shrink-0 w-56">
          <Label className="text-sm text-foreground font-medium block mb-1.5">{imgLabel}</Label>
          <ImageField
            imageId={data?.[imageField.key] ?? ''}
            onChange={(newId) => onChange?.(imageField.key, newId, imageField.column)}
            token={token}
            apiBaseUrl={apiBaseUrl}
            readOnly={imgReadOnly}
            fieldKey={imageField.key}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={gridClass} style={gridStyle}>
      {displayFields.map(renderField)}
    </div>
  );
}
