import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { X, MoreVertical, Check, Save, List, Search, Sparkles, Plus, Bell, Mic, Printer, Trash2 } from 'lucide-react';
import { useEntity } from '@/hooks/useEntity';
import { useCatalogs } from '@/hooks/useCatalogs';
import { useDisplayLogic } from '@/hooks/useDisplayLogic';
import { useCallout } from '@/hooks/useCallout';
import { useMenuLabel } from '@/i18n';
import { SummaryBar } from './SummaryBar.jsx';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';
import { getCatalogOptions } from '@/lib/selectorCatalog.js';
import { formatAmount } from '@/lib/formatAmount.js';
import { getStatusBadgeProps, statusLabel } from '@/lib/statusBadge.js';
import { cn } from '@/lib/utils.js';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import DocumentPrintDrawer from './DocumentPrintDrawer.jsx';
import { toast } from 'sonner';

/**
 * Collapsible section that hides itself entirely when children render as null.
 */
function CollapsibleSection({ title, children }) {
  const ref = useRef(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    // Check if the rendered children produced any DOM nodes
    if (ref.current && ref.current.childElementCount === 0) {
      setEmpty(true);
    } else {
      setEmpty(false);
    }
  });

  if (empty) return <div ref={ref} className="hidden">{children}</div>;

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground py-1 select-none list-none flex items-center gap-1">
        <svg className="h-4 w-4 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        {title}
      </summary>
      <div className="pt-2" ref={ref}>
        {children}
      </div>
    </details>
  );
}

/**
 * Full-page detail view for a single entity record.
 * Two-zone layout: gray top bar + white content card with rounded corner.
 */
export function DetailView({
  entity,
  detailEntity,
  Form,
  DetailTable,
  DetailForm,
  summary = [],
  statusField,
  extraBadges = [],
  processes = [],
  addLineFields = { entry: [], derived: [] },
  catalogs: staticCatalogs,
  api,
  entityLabel,
  detailLabel,
  detailTabIndex,
  titleField = 'documentNo',
  windowName,
  recordId,
  token,
  apiBaseUrl,
  breadcrumb,
  secondaryTabs = [],
  customTabs = [],
}) {
  const hook = useEntity(entity, detailEntity, { token, apiBaseUrl });
  // Static hooks for up to 4 secondary tabs (React rules forbid dynamic hook calls)
  const secondaryHook0 = useEntity(entity, secondaryTabs[0]?.isFormTab ? null : (secondaryTabs[0]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook1 = useEntity(entity, secondaryTabs[1]?.isFormTab ? null : (secondaryTabs[1]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook2 = useEntity(entity, secondaryTabs[2]?.isFormTab ? null : (secondaryTabs[2]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook3 = useEntity(entity, secondaryTabs[3]?.isFormTab ? null : (secondaryTabs[3]?.key ?? null), { token, apiBaseUrl });
  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3];
  const parentRecordId = hook.selected?.id ?? recordId ?? hook.editing?.id ?? null;
  const selectorContextByEntity = useMemo(() => {
    if (!parentRecordId) return {};

    const next = {};
    if (detailEntity) {
      next[detailEntity] = { parentId: parentRecordId };
    }
    for (const tab of secondaryTabs) {
      if (tab?.key) {
        next[tab.key] = { parentId: parentRecordId };
      }
    }
    return next;
  }, [detailEntity, parentRecordId, secondaryTabs]);
  const catalogs = useCatalogs(api, token, apiBaseUrl, staticCatalogs, selectorContextByEntity);
  const displayLogic = useDisplayLogic(entity, hook.editing, { token, apiBaseUrl });
  const { calloutResult, calloutLoading, executeCallout } = useCallout(entity, { token, apiBaseUrl });
  const navigate = useNavigate();
  const tMenu = useMenuLabel();
  const [addingLine, setAddingLine] = useState(false);
  const [addingSecondaryLine, setAddingSecondaryLine] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [showPrint, setShowPrint] = useState(false);
  const [directFetched, setDirectFetched] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [lineEdits, setLineEdits] = useState(null);
  const [lineEditColumns, setLineEditColumns] = useState({});
  const [savingLine, setSavingLine] = useState(false);
  const [isClosingLine, setIsClosingLine] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [savingChild, setSavingChild] = useState(false);

  const closeLine = useCallback(() => {
    setIsClosingLine(true);
    setTimeout(() => {
      setSelectedLine(null);
      setLineEdits(null);
      setLineEditColumns({});
      setIsClosingLine(false);
    }, 250);
  }, []);

  const [selectedSecondaryLine, setSelectedSecondaryLine] = useState(null);
  const [secondaryLineEdits, setSecondaryLineEdits] = useState(null);
  const [secondaryLineEditColumns, setSecondaryLineEditColumns] = useState({});
  const [savingSecondaryLine, setSavingSecondaryLine] = useState(false);
  const [isClosingSecondaryLine, setIsClosingSecondaryLine] = useState(false);

  const extractErrorMessage = useCallback(async (res) => {
    try {
      const data = await res.json();
      const err = data?.response?.error;
      if (err?.message) return err.message;
      if (typeof err === 'string') return err;
      if (data?.message) return data.message;
    } catch {
      // Ignore non-JSON error bodies.
    }
    return `Error ${res.status}`;
  }, []);

  const closeSecondaryLine = useCallback(() => {
    setIsClosingSecondaryLine(true);
    setTimeout(() => {
      setSelectedSecondaryLine(null);
      setSecondaryLineEdits(null);
      setSecondaryLineEditColumns({});
      setIsClosingSecondaryLine(false);
    }, 250);
  }, []);

  // Track fields whose values were set by a callout response to avoid re-triggering
  const calloutAppliedRef = useRef(new Set());

  const isNew = recordId === 'new';
  const currentItem = useMemo(() => {
    if (isNew) return null;
    return hook.items.find(item => String(item.id) === String(recordId)) || null;
  }, [hook.items, recordId, isNew]);

  useEffect(() => {
    if (isNew && !hook.editing) {
      hook.handleNew();
    }
  }, [isNew, hook.editing, hook.handleNew]);

  // Resolve $_identifier for default FK values using already-loaded catalogs.
  // If a default ID isn't in the selector options (e.g., generic preference doesn't match
  // this window's filtered list), clear it — the callout will set the correct value later.
  useEffect(() => {
    if (!isNew || !hook.editing || !catalogs || !api?.selectors) return;
    for (const sel of api.selectors) {
      const val = hook.editing[sel.field];
      if (!val || hook.editing[sel.field + '$_identifier']) continue;
      const options = getCatalogOptions(catalogs, sel.entity, sel);
      if (!Array.isArray(options) || options.length === 0) continue;
      const match = options.find(o => o.id === val);
      if (match) {
        hook.handleChange(sel.field + '$_identifier', match.label || match.name || match._identifier);
      } else {
        // Default ID not in filtered options — clear it to avoid showing a raw UUID
        hook.handleChange(sel.field, '');
      }
    }
  }, [isNew, hook.editing, catalogs, api]);

  useEffect(() => {
    if (isNew) return;
    if (currentItem && (!hook.selected || String(hook.selected.id) !== String(recordId))) {
      hook.handleSelect(currentItem);
      setDirectFetched(false);
    } else if (!currentItem && !hook.loading && recordId && !directFetched) {
      setDirectFetched(true);
      hook.fetchById(recordId);
    }
  }, [currentItem, recordId, hook.selected, hook.handleSelect]);

  // Reset selected line when the parent record changes
  useEffect(() => {
    setSelectedLine(null);
  }, [hook.selected?.id]);

  // Sync all secondary hooks with the selected parent record
  useEffect(() => {
    if (!hook.selected?.id) return;
    secondaryHooks.forEach((sh, i) => {
      if (secondaryTabs[i]) sh.handleSelect(hook.selected);
    });
  }, [hook.selected?.id]);

  // Apply callout results to the form when they arrive
  useEffect(() => {
    if (!calloutResult) return;
    const { updates, combos } = calloutResult;
    const appliedFields = new Set();

    if (updates) {
      for (const [key, entry] of Object.entries(updates)) {
        // Skip empty callout values if the field already has a non-empty value
        // (e.g., callout clears warehouse but defaults already set it)
        const currentVal = data[key];
        if ((entry.value === '' || entry.value == null) && currentVal && currentVal !== '') {
          continue;
        }
        appliedFields.add(key);
        hook.handleChange(key, entry.value);
        if (entry._identifier) {
          hook.handleChange(key + '$_identifier', entry._identifier);
        }
      }
    }
    if (combos) {
      for (const [key, combo] of Object.entries(combos)) {
        if (combo.selected != null) {
          appliedFields.add(key);
          hook.handleChange(key, combo.selected);
          if (combo._identifier) {
            hook.handleChange(key + '$_identifier', combo._identifier);
          }
        }
      }
    }

    // Mark these fields so the next onChange doesn't re-trigger callout
    calloutAppliedRef.current = appliedFields;
  }, [calloutResult]);

  // Wrapped onChange that triggers callout for user-initiated FK changes
  const handleChangeWithCallout = useCallback((field, value) => {
    hook.handleChange(field, value);

    // Skip companion/auxiliary fields — they don't have callouts
    if (field.includes('$_identifier') || /^[a-zA-Z]+_[A-Z]{2,4}$/.test(field)) return;

    // If this field was just set by a callout response, don't re-trigger
    if (calloutAppliedRef.current.has(field)) {
      calloutAppliedRef.current.delete(field);
      return;
    }

    // Only trigger callout for meaningful value changes (not empty/typing artifacts).
    // Skip partial search text — only trigger when value looks like an Etendo ID
    // (32-char hex UUID or legacy numeric ID), not user-typed search strings.
    if (!value || value === '') return;
    if (!/^[0-9A-Fa-f]{32}$/.test(value) && !/^\d+$/.test(value)) return;

    // Trigger callout — the backend returns empty if no callout is registered
    executeCallout(field, value, hook.editing);
  }, [hook.handleChange, hook.editing, executeCallout]);

  // Execute callout for child entity (line-level) fields and apply results via callback.
  // Merges parent header data into formState so callouts have full context (e.g., priceList).
  const handleLineFieldChange = useCallback(async (field, value, rowValues, applyUpdates) => {
    if (!field || !value || value === '' || !token || !apiBaseUrl || !detailEntity) return;
    if (field.includes('$_identifier') || /^[a-zA-Z]+_[A-Z]{2,4}$/.test(field)) return;
    try {
      // Build formState: line row values + parent header fields for context
      const headerData = hook.editing || hook.selected || {};
      const formState = { ...rowValues };
      // Include header fields that callouts typically need (priceList, businessPartner, org, etc.)
      for (const [k, v] of Object.entries(headerData)) {
        if (!(k in formState) && v != null && v !== '') {
          formState[k] = v;
        }
      }
      // Extract auxiliary values (e.g., product_PSTD, product_UOM from selector _aux)
      const auxiliaryValues = {};
      for (const [k, v] of Object.entries(formState)) {
        if (/^[a-zA-Z]+_[A-Z]{2,4}$/.test(k) && v != null && v !== '') {
          auxiliaryValues[k] = String(v);
        }
      }
      const payload = {
        field,
        value,
        formState,
        ...(Object.keys(auxiliaryValues).length > 0 ? { auxiliaryValues } : {}),
      };
      const res = await fetch(`${apiBaseUrl}/${detailEntity}/callout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const calloutData = await res.json();
      const result = {};
      if (calloutData.updates) {
        for (const [k, entry] of Object.entries(calloutData.updates)) {
          result[k] = entry.value;
          if (entry._identifier) result[k + '$_identifier'] = entry._identifier;
        }
      }
      if (calloutData.combos) {
        for (const [k, combo] of Object.entries(calloutData.combos)) {
          if (combo.selected != null) {
            result[k] = combo.selected;
            if (combo._identifier) result[k + '$_identifier'] = combo._identifier;
          }
        }
      }
      if (Object.keys(result).length > 0) applyUpdates?.(result);
    } catch {
      // Callout is best-effort
    }
  }, [token, apiBaseUrl, detailEntity, hook.editing, hook.selected]);

  const data = hook.editing || currentItem || {};
  const title = isNew
    ? `New ${entityLabel || entity}`
    : `${resolveIdentifier(data, titleField) || data._identifier || data.id || ''}`;

  const allEntryFields = addLineFields.entry ?? [];
  const hiddenEntryDefaults = addLineFields.hidden ?? [];
  const editableChildFields = allEntryFields.filter(f => f.type === 'number' || f.type === 'amount');

  // Build tabs: child entity lines + secondary tabs + "Others" tab for non-principal header fields
  const tabs = [];
  secondaryTabs.forEach((st, i) => {
    const childCount = !st.isFormTab ? (secondaryHooks[i]?.children?.length ?? null) : null;
    tabs.push({ key: st.key, label: st.label, count: childCount });
  });
  if (DetailTable) {
    const linesTab = { key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 };
    if (typeof detailTabIndex === 'number' && detailTabIndex >= 0 && detailTabIndex <= tabs.length) {
      tabs.splice(detailTabIndex, 0, linesTab);
    } else {
      tabs.unshift(linesTab);
    }
  }
  // "Others" tab is added dynamically via othersRef after first render
  const [showOthers, setShowOthers] = useState(null); // null = unknown, true/false after mount
  const othersRef = useRef(null);

  useEffect(() => {
    if (showOthers === null && othersRef.current) {
      // Check if the hidden probe rendered any DOM content
      setShowOthers(othersRef.current.childElementCount > 0);
    }
  });

  if (showOthers === true) {
    tabs.push({ key: 'others', label: 'Others' });
  }

  if (hook.loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="detail-view">
      {/* Top bar area (gray background, inherited from parent) */}
      <div className="px-6 pt-3 pb-3">
        {/* Row: Title + Global search + action icons */}
        <div className="flex items-center gap-4">
          {/* Left: title + breadcrumb */}
          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{title}</h1>
              <button className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
            {breadcrumb && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {breadcrumb}{title ? ` / ${title}` : ''}
              </p>
            )}
          </div>

          {/* Center: global search */}
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search clients, orders, invoices..."
                readOnly
                tabIndex={-1}
                className="w-full h-9 rounded-lg border border-border/50 bg-white/60 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors cursor-default"
              />
              <Mic className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
            </div>
          </div>

          {/* Right: action icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Sparkles className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </button>
            <button className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      {/* White content card with rounded top-left corner */}
      <div className="flex-1 flex flex-col bg-white rounded-tl-2xl overflow-hidden min-h-0">
        {/* Action bar: Cancel + status | actions + save */}
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="action-cancel"
              onClick={() => navigate(`/${windowName}`)}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            {statusField && data[statusField] && (
              <Badge
                {...getStatusBadgeProps(data[statusField])}
                className={cn('ml-1', getStatusBadgeProps(data[statusField]).className)}
              >
                {statusLabel(data[statusField])}
              </Badge>
            )}
            {extraBadges.map(b => {
              const when = b.when !== undefined ? b.when : true;
              const show = when ? !!data[b.key] : !data[b.key];
              if (!show) return null;
              if (b.hideWhenStatus?.includes(data[statusField])) return null;
              const cls = b.style === 'warning'
                ? 'ml-1 border-amber-300 bg-amber-50 text-amber-700'
                : 'ml-1 bg-blue-600 hover:bg-blue-700 border-transparent text-white';
              const variant = b.style === 'warning' ? 'outline' : 'default';
              return (
                <Badge key={`${b.key}-${when}`} variant={variant} className={cls}>
                  {b.label}
                </Badge>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Print document */}
            {!isNew && recordId && (
              <button
                onClick={() => setShowPrint(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                title="Print"
              >
                <Printer className="h-4 w-4" />
              </button>
            )}
            {/* More actions */}
            <button className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
            {/* Process buttons */}
            {processes.map(p => {
              const btnClass = p.style === 'destructive'
                ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
              return (
                <Button
                  key={p.name}
                  variant="outline"
                  size="sm"
                  className={btnClass}
                  onClick={() => hook.handleProcess?.(p)}
                >
                  {p.label}
                </Button>
              );
            })}

            <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" data-testid="action-save-draft" onClick={async () => {
              const saved = await hook.handleSave(data);
              if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
            }}>
              <Save className="h-3.5 w-3.5" />
              Save draft
            </Button>
            <Button size="sm" className="gap-1.5" data-testid="action-save" onClick={async () => {
              const saved = await hook.handleSave(data);
              if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
            }}>
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="max-w-full space-y-6">
            {/* Principal header fields (horizontal row) */}
            {/* Visibility logic is intentionally not applied here: principal fields must always
                be visible (shown as readOnly when needed). Only readOnly state is propagated. */}
            <div>
              <Form
                entity={entity}
                data={data}
                onChange={handleChangeWithCallout}
                catalogs={catalogs}
                layout="horizontal"
                section="principal"
                displayLogic={{ readOnly: displayLogic?.readOnly ?? {}, visibility: {} }}
                api={api}
                token={token}
                apiBaseUrl={apiBaseUrl}
              />
            </div>

            {/* Collapsible secondary header fields (hidden if no collapsed fields) */}
            <CollapsibleSection title="More details">
              <Form
                entity={entity}
                data={data}
                onChange={handleChangeWithCallout}
                catalogs={catalogs}
                layout="horizontal"
                section="collapsed"
                displayLogic={displayLogic}
                api={api}
                token={token}
                apiBaseUrl={apiBaseUrl}
              />
            </CollapsibleSection>

            {/* Tabs: child entities + Others */}
            {tabs.length > 0 && (
              <div>
                <div className="flex items-center gap-0 border-b border-border/50">
                  {tabs.map((tab, idx) => (
                    <button
                      key={tab.key}
                      onClick={() => { setActiveTab(idx); setSelectedLine(null); setSelectedSecondaryLine(null); }}
                      className={[
                        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                        activeTab === idx
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      <List className="h-4 w-4" />
                      {tab.label}
                      {tab.count != null && (
                        <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 text-xs rounded-full bg-muted text-muted-foreground">
                          {tab.count}
                        </span>
                      )}
                      {activeTab === idx && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content: Lines */}
                {tabs[activeTab]?.key === 'lines' && DetailTable && (
                  <div className="pt-3 flex items-start gap-4">
                    {/* Table + add button */}
                    <div className="flex-1 min-w-0">
                      <DetailTable
                        data={hook.children}
                        entity={detailEntity}
                        token={token}
                        apiBaseUrl={apiBaseUrl}
                        onRowClick={DetailForm ? (row) => setSelectedLine(row) : undefined}
                        selectedRowId={selectedLine?.id}
                        showFooterTotals={!summary.some(f => f.type === 'amount')}
                        addRow={{
                          active: addingLine,
                          fields: allEntryFields,
                          onAdd: async (lineData) => {
                            // Only send entry field keys to the API — exclude callout-derived values
                            const entryKeys = new Set(allEntryFields.map(f => f.key));
                            const filtered = {};
                            for (const [k, v] of Object.entries(lineData)) {
                              if (entryKeys.has(k)) filtered[k] = v;
                            }
                            for (const hiddenField of hiddenEntryDefaults) {
                              if (!(hiddenField.key in filtered)) {
                                filtered[hiddenField.key] = hiddenField.value;
                              }
                            }
                            return hook.handleAddChild?.(filtered);
                          },
                          onCancel: () => setAddingLine(false),
                          catalogs,
                          onFieldChange: handleLineFieldChange,
                        }}
                      />

                      {/* Inline edit form for selected child row (when no DetailForm) */}
                      {!DetailForm && editingChild && editableChildFields.length > 0 && (
                        <div className="mt-3 p-4 border rounded-lg bg-muted/20">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
                            {editableChildFields.map(f => (
                              <div key={f.key} className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-muted-foreground">{f.label || f.key}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingChild[f.key] ?? ''}
                                  onChange={e => setEditingChild(prev => ({ ...prev, [f.key]: e.target.value }))}
                                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={savingChild}
                              onClick={async () => {
                                setSavingChild(true);
                                try {
                                  const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', editingChild.id)
                                    || `${apiBaseUrl}/${detailEntity}/${editingChild.id}`;
                                  const fieldValues = {};
                                  for (const f of editableChildFields) {
                                    fieldValues[f.column] = editingChild[f.key];
                                  }
                                  const res = await fetch(childUrl, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                    body: JSON.stringify({ fieldValues }),
                                  });
                                  if (res.ok) {
                                    hook.handleUpdateChild(editingChild.id, editableChildFields.reduce((acc, f) => ({ ...acc, [f.key]: editingChild[f.key] }), {}));
                                    setEditingChild(null);
                                  }
                                } finally { setSavingChild(false); }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                              {savingChild ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingChild(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={savingChild}
                              onClick={async () => {
                                if (!window.confirm('Delete this record?')) return;
                                setSavingChild(true);
                                try {
                                  const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', editingChild.id)
                                    || `${apiBaseUrl}/${detailEntity}/${editingChild.id}`;
                                  const res = await fetch(childUrl, {
                                    method: 'DELETE',
                                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                  });
                                  if (res.ok) { hook.handleDeleteChild(editingChild.id); setEditingChild(null); }
                                } finally { setSavingChild(false); }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => { setAddingLine(!addingLine); setEditingChild(null); }}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium"
                      >
                        + Add {detailLabel || 'line'}
                      </button>
                    </div>

                    {/* Right sidebar: line detail form */}
                    {DetailForm && (selectedLine || isClosingLine) && (
                      <div className={`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden ${isClosingLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">{detailLabel || 'Line'} Detail</span>
                          <button
                            onClick={closeLine}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <DetailForm
                          data={lineEdits ?? selectedLine}
                          readOnly={!hook.editing}
                          onChange={(key, val, column) => {
                            setLineEdits(prev => ({ ...(prev ?? selectedLine), [key]: val }));
                            if (column) setLineEditColumns(prev => ({ ...prev, [key]: column }));
                          }}
                          entity={detailEntity}
                          catalogs={catalogs}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          selectorContext={selectorContextByEntity[detailEntity]}
                        />
                        {hook.editing && (lineEdits || selectedLine?.id) && (
                          <div className="flex gap-2 mt-4">
                            {lineEdits && (
                              <>
                                <button
                                  disabled={savingLine}
                                  onClick={async () => {
                                    setSavingLine(true);
                                    try {
                                      const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', selectedLine.id)
                                        || `${apiBaseUrl}/${detailEntity}/${selectedLine.id}`;
                                      const fieldValues = {};
                                      for (const [k, v] of Object.entries(lineEdits)) {
                                        if (k.endsWith('$_identifier')) continue;
                                        const colName = lineEditColumns[k] || k;
                                        // Convert numeric strings to numbers for BigDecimal compatibility.
                                        // Only strip when the value is already in standard format (no commas).
                                        // Comma removal is skipped to avoid locale corruption (e.g. Spanish "10,50" = 10.5).
                                        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                                          fieldValues[colName] = parseFloat(v);
                                        } else {
                                          fieldValues[colName] = v;
                                        }
                                      }
                                      const res = await fetch(childUrl, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                        body: JSON.stringify(fieldValues),
                                      });
                                      if (res.ok) {
                                        hook.handleUpdateChild(selectedLine.id, lineEdits);
                                        setSelectedLine(prev => ({ ...prev, ...lineEdits }));
                                        setLineEdits(null);
                                        setLineEditColumns({});
                                        toast.success('Record saved');
                                      } else {
                                        toast.error(await extractErrorMessage(res));
                                      }
                                    } catch (err) {
                                      toast.error(err.message || 'Network error');
                                    } finally { setSavingLine(false); }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {savingLine ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setLineEdits(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                                >
                                  Discard
                                </button>
                              </>
                            )}
                            {(api?.crud?.[detailEntity]?.delete ?? true) && selectedLine?.id && (
                              <button
                                disabled={savingLine}
                                onClick={async () => {
                                  if (!window.confirm('Delete this record?')) return;
                                  setSavingLine(true);
                                  try {
                                    const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', selectedLine.id)
                                      || `${apiBaseUrl}/${detailEntity}/${selectedLine.id}`;
                                    const res = await fetch(childUrl, {
                                      method: 'DELETE',
                                      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                    });
                                    if (res.ok) {
                                      hook.handleDeleteChild(selectedLine.id);
                                      toast.success('Record deleted');
                                      closeLine();
                                    } else {
                                      toast.error(await extractErrorMessage(res));
                                    }
                                  } catch (err) {
                                    toast.error(err.message || 'Network error');
                                  } finally { setSavingLine(false); }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab content: secondary child entity tabs (or form-only tabs) */}
                {secondaryTabs.map((st, stIdx) => tabs[activeTab]?.key === st.key && (
                  <div key={st.key} className="pt-3 flex items-start gap-4">
                    {st.isFormTab ? (
                      <div className="flex-1 min-w-0">
                        <st.Form
                          data={data ?? {}}
                          readOnly={!hook.editing}
                          onChange={(key, val, column) => {
                            setSecondaryLineEdits(prev => ({ ...(prev ?? {}), [key]: val }));
                            if (column) setSecondaryLineEditColumns(prev => ({ ...prev, [key]: column }));
                          }}
                          entity={st.key}
                          catalogs={catalogs}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          selectorContext={selectorContextByEntity[st.key]}
                        />
                      </div>
                    ) : (
                    <div className="flex-1 min-w-0">
                      <st.Table
                        data={secondaryHooks[stIdx]?.children ?? []}
                        entity={st.key}
                        selectorContext={selectorContextByEntity[st.key]}
                        onRowClick={st.Form ? (row) => { setSelectedSecondaryLine({ ...row, _tabKey: st.key }); setSecondaryLineEdits(null); } : undefined}
                        selectedRowId={selectedSecondaryLine?._tabKey === st.key ? selectedSecondaryLine?.id : undefined}
                        addRow={st.addLineFields?.entry?.length > 0 ? {
                          active: addingSecondaryLine[st.key] ?? false,
                          fields: st.addLineFields.entry,
                          onAdd: async (lineData) => {
                            const entryKeys = new Set(st.addLineFields.entry.map(f => f.key));
                            const filtered = {};
                            for (const [k, v] of Object.entries(lineData)) {
                              if (entryKeys.has(k)) filtered[k] = v;
                            }
                            const result = await secondaryHooks[stIdx]?.handleAddChild?.(filtered);
                            if (result) setAddingSecondaryLine(prev => ({ ...prev, [st.key]: false }));
                            return result;
                          },
                          onCancel: () => setAddingSecondaryLine(prev => ({ ...prev, [st.key]: false })),
                          catalogs,
                        } : undefined}
                      />
                      {st.addLineFields?.entry?.length > 0 && hook.editing && (
                        <button
                          onClick={() => { setAddingSecondaryLine(prev => ({ ...prev, [st.key]: !prev[st.key] })); setSelectedSecondaryLine(null); }}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium"
                        >
                          + Add {st.label}
                        </button>
                      )}
                    </div>
                    )}
                    {st.Form && (selectedSecondaryLine?._tabKey === st.key || isClosingSecondaryLine) && (
                      <div className={`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden ${isClosingSecondaryLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">{st.label} Detail</span>
                          <button
                            onClick={closeSecondaryLine}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <st.Form
                          data={secondaryLineEdits ?? selectedSecondaryLine}
                          readOnly={!hook.editing}
                          onChange={(key, val, column) => {
                            setSecondaryLineEdits(prev => ({ ...(prev ?? selectedSecondaryLine), [key]: val }));
                            if (column) setSecondaryLineEditColumns(prev => ({ ...prev, [key]: column }));
                          }}
                          entity={st.key}
                          catalogs={catalogs}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          selectorContext={selectorContextByEntity[st.key]}
                        />
                        {hook.editing && (secondaryLineEdits || selectedSecondaryLine?.id) && (
                          <div className="flex gap-2 mt-4">
                            {secondaryLineEdits && (
                              <>
                                <button
                                  disabled={savingSecondaryLine}
                                  onClick={async () => {
                                    setSavingSecondaryLine(true);
                                    try {
                                      const secUrl = `${apiBaseUrl}/${st.key}/${selectedSecondaryLine.id}`;
                                      const fieldValues = {};
                                      for (const [k, v] of Object.entries(secondaryLineEdits)) {
                                        if (k.endsWith('$_identifier')) continue;
                                        const colName = secondaryLineEditColumns[k] || k;
                                        // Convert numeric strings to numbers for BigDecimal compatibility.
                                        // Only strip when the value is already in standard format (no commas).
                                        // Comma removal is skipped to avoid locale corruption (e.g. Spanish "10,50" = 10.5).
                                        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                                          fieldValues[colName] = parseFloat(v);
                                        } else {
                                          fieldValues[colName] = v;
                                        }
                                      }
                                      const res = await fetch(secUrl, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                        body: JSON.stringify(fieldValues),
                                      });
                                      if (res.ok) {
                                        setSelectedSecondaryLine(prev => ({ ...prev, ...secondaryLineEdits }));
                                        setSecondaryLineEdits(null);
                                        setSecondaryLineEditColumns({});
                                        toast.success('Record saved');
                                      } else {
                                        toast.error(await extractErrorMessage(res));
                                      }
                                    } catch (err) {
                                      toast.error(err.message || 'Network error');
                                    } finally { setSavingSecondaryLine(false); }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {savingSecondaryLine ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setSecondaryLineEdits(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                                >
                                  Discard
                                </button>
                              </>
                            )}
                            {(api?.crud?.[st.key]?.delete ?? true) && selectedSecondaryLine?.id && (
                              <button
                                disabled={savingSecondaryLine}
                                onClick={async () => {
                                  if (!window.confirm('Delete this record?')) return;
                                  setSavingSecondaryLine(true);
                                  try {
                                    const secUrl = `${apiBaseUrl}/${st.key}/${selectedSecondaryLine.id}`;
                                    const res = await fetch(secUrl, {
                                      method: 'DELETE',
                                      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                    });
                                    if (res.ok) {
                                      secondaryHooks[stIdx]?.handleDeleteChild(selectedSecondaryLine.id);
                                      toast.success('Record deleted');
                                      closeSecondaryLine();
                                    } else {
                                      toast.error(await extractErrorMessage(res));
                                    }
                                  } catch (err) {
                                    toast.error(err.message || 'Network error');
                                  } finally { setSavingSecondaryLine(false); }
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                ))}

                {/* Tab content: Others (secondary header fields) */}
                {tabs[activeTab]?.key === 'others' && (
                  <div className="pt-5">
                    <Form
                      entity={entity}
                      data={data}
                      onChange={handleChangeWithCallout}
                      catalogs={catalogs}
                      layout="horizontal"
                      section="other"
                      displayLogic={displayLogic}
                      api={api}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                    />
                  </div>
                )}

                {/* Hidden probe: detect if Others form has content */}
                {showOthers === null && (
                  <div ref={othersRef} className="hidden">
                    <Form
                      entity={entity}
                      data={data}
                      onChange={() => {}}
                      catalogs={catalogs}
                      section="other"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Simple entity (no child): full form only */}
            {!DetailTable && (
              <>
                {summary.length > 0 && (
                  <div className="mt-1">
                    <SummaryBar fields={summary} data={data} />
                  </div>
                )}
              </>
            )}

            {/* Collapsible Related Documents (below lines, before totals) */}
            {customTabs.length > 0 && customTabs.map(ct => {
              const TabComponent = ct.Component;
              return (
                <details key={ct.key} className="group mt-6 border border-border/40 rounded-lg bg-muted/20">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-3 select-none list-none flex items-center gap-2">
                    <svg className="h-4 w-4 transition-transform group-open:rotate-90 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    {ct.label}
                  </summary>
                  <div className="px-4 pb-4">
                    <TabComponent
                      recordId={data?.id || recordId}
                      data={data}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      api={api}
                    />
                  </div>
                </details>
              );
            })}

            {/* Footer totals: Subtotal, Taxes, Total */}
            {DetailTable && summary.some(f => f.type === 'amount') && (() => {
              const subtotalField = summary.find(f => f.type === 'amount' && (f.key.toLowerCase().includes('summed') || f.key.toLowerCase().includes('totallines') || f.key.toLowerCase().includes('lineamount')));
              const totalField = summary.find(f => f.type === 'amount' && (f.key.toLowerCase().includes('grand') || (f.key.toLowerCase().includes('total') && !f.key.toLowerCase().includes('line'))));
              const subtotal = subtotalField ? data[subtotalField.key] : null;
              const total = totalField ? data[totalField.key] : null;
              const taxes = (subtotal != null && total != null) ? total - subtotal : null;
              const currency = data['currency$_identifier'];
              return (
                <div className="flex justify-end pt-2 border-t border-border/50">
                  <div className="w-72 space-y-1.5">
                    {subtotal != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium tabular-nums">{formatAmount(subtotal, currency)}</span>
                      </div>
                    )}
                    {taxes != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxes</span>
                        <span className="font-medium tabular-nums">{formatAmount(taxes, currency)}</span>
                      </div>
                    )}
                    {total != null && (
                      <div className="flex justify-between text-base font-bold pt-1.5 border-t border-border/50">
                        <span>Total</span>
                        <span className="tabular-nums">{formatAmount(total, currency)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <DocumentPrintDrawer
        open={showPrint}
        onClose={() => setShowPrint(false)}
        windowName={windowName}
        documentIds={recordId ? [recordId] : []}
        token={token}
      />
    </div>
  );
}
