import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { X, MoreVertical, Check, Save, List, Search, Sparkles, Plus, Bell, Mic, Printer, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useCatalogs } from '@/hooks/useCatalogs';
import { useDisplayLogic } from '@/hooks/useDisplayLogic';
import { useCallout } from '@/hooks/useCallout';
import { useMenuLabel } from '@/i18n';
import { SummaryBar } from './SummaryBar.jsx';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';
import { formatAmount } from '@/lib/formatAmount.js';
import { getStatusBadgeProps, statusLabel } from '@/lib/statusBadge.js';
import { cn } from '@/lib/utils.js';
import LocaleSwitcher from '@/components/LocaleSwitcher.jsx';
import DocumentPrintDrawer from './DocumentPrintDrawer.jsx';

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
  processes = [],
  addLineFields = { entry: [], derived: [] },
  catalogs: staticCatalogs,
  api,
  entityLabel,
  detailLabel,
  titleField = 'documentNo',
  windowName,
  recordId,
  token,
  apiBaseUrl,
  breadcrumb,
  secondaryTabs = [],
  draftMode = null,
}) {
  const hook = useEntity(entity, detailEntity, { token, apiBaseUrl });
  // Static hooks for up to 4 secondary tabs (React rules forbid dynamic hook calls)
  const secondaryHook0 = useEntity(entity, secondaryTabs[0]?.key ?? null, { token, apiBaseUrl });
  const secondaryHook1 = useEntity(entity, secondaryTabs[1]?.key ?? null, { token, apiBaseUrl });
  const secondaryHook2 = useEntity(entity, secondaryTabs[2]?.key ?? null, { token, apiBaseUrl });
  const secondaryHook3 = useEntity(entity, secondaryTabs[3]?.key ?? null, { token, apiBaseUrl });
  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3];
  const { catalogs, catalogsLoaded } = useCatalogs(api, token, apiBaseUrl, staticCatalogs);
  const displayLogic = useDisplayLogic(entity, hook.editing, { token, apiBaseUrl });
  const { calloutResult, calloutLoading, executeCallout } = useCallout(entity, { token, apiBaseUrl });
  const navigate = useNavigate();
  const tMenu = useMenuLabel();
  const [addingLine, setAddingLine] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showPrint, setShowPrint] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [directFetched, setDirectFetched] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [isClosingLine, setIsClosingLine] = useState(false);

  const closeLine = useCallback(() => {
    setIsClosingLine(true);
    setTimeout(() => {
      setSelectedLine(null);
      setIsClosingLine(false);
    }, 250);
  }, []);

  const [selectedSecondaryLine, setSelectedSecondaryLine] = useState(null);
  const [isClosingSecondaryLine, setIsClosingSecondaryLine] = useState(false);

  const closeSecondaryLine = useCallback(() => {
    setIsClosingSecondaryLine(true);
    setTimeout(() => {
      setSelectedSecondaryLine(null);
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

  // Resolve $_identifier for default FK values and auto-select first option for
  // mandatory combo selectors (inputMode: "selector") that have no value.
  // This matches classic Etendo behavior: TableDir combos pre-select the first record
  // when the field is mandatory, while search fields don't (they require user input).
  useEffect(() => {
    if (!isNew || !hook.editing || !catalogsLoaded || !api?.selectors) return;
    for (const sel of api.selectors) {
      const val = hook.editing[sel.field];
      const options = catalogs[sel.reference];
      if (!Array.isArray(options) || options.length === 0) continue;

      if (val) {
        // Has a value — resolve its identifier if missing
        if (!hook.editing[sel.field + '$_identifier']) {
          const match = options.find(o => o.id === val);
          if (match) {
            hook.handleChange(sel.field + '$_identifier', match.label || match.name || match._identifier);
          }
        }
      } else if (sel.inputMode === 'selector') {
        // Combo/dropdown with no value — auto-select first option (Etendo TableDir behavior).
        // Only for editable fields; search/dependent fields require explicit user selection.
        const first = options[0];
        if (first) {
          hook.handleChange(sel.field, first.id);
          hook.handleChange(sel.field + '$_identifier', first.label || first.name || first._identifier);
        }
      }
    }
  }, [isNew, hook.editing, catalogsLoaded, catalogs, api]);

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

  // Build tabs: child entity lines + secondary tabs + "Others" tab for non-principal header fields
  const tabs = [];
  if (DetailTable) {
    tabs.push({ key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 });
  }
  for (const st of secondaryTabs) {
    tabs.push({ key: st.key, label: st.label });
  }
  // Always add "Others" tab for secondary header fields
  tabs.push({ key: 'others', label: 'Others' });

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
            {/* Delete record */}
            {!isNew && recordId && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Delete"
                data-testid="action-delete"
              >
                <Trash2 className="h-4 w-4" />
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

            {draftMode?.enabled ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" data-testid="action-save-draft" onClick={async () => {
                  const saved = await hook.handleSave(data);
                  if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
                }}>
                  <Save className="h-3.5 w-3.5" />
                  Save draft
                </Button>
                <Button size="sm" className="gap-1.5" data-testid="action-save" onClick={async () => {
                  const saved = await hook.handleSaveAndProcess(draftMode);
                  if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
                }}>
                  <Check className="h-3.5 w-3.5" />
                  Save &amp; {draftMode.label || 'Process'}
                </Button>
              </>
            ) : (
              <Button size="sm" className="gap-1.5" data-testid="action-save" onClick={async () => {
                const saved = await hook.handleSave(data);
                if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
              }}>
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
            )}
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
                        addRow={{
                          active: addingLine,
                          fields: allEntryFields,
                          onAdd: (lineData) => {
                            // Send all values: entry fields + callout-derived values (tax, prices, uOM, etc.).
                            // handleAddChild filters out internal keys (_identifier, _aux, CURSOR_FIELD, etc.)
                            hook.handleAddChild?.(lineData);
                          },
                          onCancel: () => setAddingLine(false),
                          catalogs,
                          onFieldChange: handleLineFieldChange,
                        }}
                      />
                      <button
                        onClick={() => setAddingLine(!addingLine)}
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
                          data={selectedLine}
                          readOnly={true}
                          entity={detailEntity}
                          catalogs={catalogs}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Tab content: secondary child entity tabs */}
                {secondaryTabs.map((st, stIdx) => tabs[activeTab]?.key === st.key && (
                  <div key={st.key} className="pt-3 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <st.Table
                        data={secondaryHooks[stIdx]?.children ?? []}
                        entity={st.key}
                        onRowClick={st.Form ? (row) => setSelectedSecondaryLine({ ...row, _tabKey: st.key }) : undefined}
                        selectedRowId={selectedSecondaryLine?._tabKey === st.key ? selectedSecondaryLine?.id : undefined}
                      />
                    </div>
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
                          data={selectedSecondaryLine}
                          readOnly={true}
                          entity={st.key}
                          catalogs={catalogs}
                        />
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

            {/* Footer totals (only when summary has amount fields) */}
            {DetailTable && summary.some(f => f.type === 'amount') && (
              <div className="flex justify-end pt-2 border-t border-border/50">
                <div className="w-72 space-y-1.5">
                  {summary.filter(f => f.type === 'amount').map(f => {
                    const label = f.label ?? f.key.replace(/([A-Z])/g, ' $1').trim();
                    const val = data[f.key];
                    return (
                      <div key={f.key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium tabular-nums">
                          {val == null ? '\u2014' : formatAmount(val, data['currency$_identifier'])}
                        </span>
                      </div>
                    );
                  })}
                  {(() => {
                    const totalField = summary.find(
                      f => f.type === 'amount' && (f.key.toLowerCase().includes('grand') || f.key.toLowerCase().includes('total'))
                    );
                    if (!totalField) return null;
                    const val = data[totalField.key];
                    return (
                      <div className="flex justify-between text-base font-bold pt-1.5 border-t border-border/50">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {val == null ? '\u2014' : formatAmount(val, data['currency$_identifier'])}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
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
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              data-testid="action-delete-confirm"
              onClick={async () => {
                setShowDeleteConfirm(false);
                await hook.handleDelete();
                navigate(`/${windowName}`);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
