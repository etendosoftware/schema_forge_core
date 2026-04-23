import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { AddLineButton } from '@/components/ui/add-line-button.jsx';
import { X, MoreVertical, Check, Save, List, Printer, Send, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog.jsx';
import { useEntity } from '@/hooks/useEntity';
import { useCatalogs } from '@/hooks/useCatalogs';
import { useDisplayLogic } from '@/hooks/useDisplayLogic';
import { useCallout } from '@/hooks/useCallout';
import { useMenuLabel, useUI, useLocale } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useFavorites } from '@/components/layout/FavoritesContext';
import { SummaryBar } from './SummaryBar.jsx';
import { resolveIdentifier } from '@/lib/resolveIdentifier.js';
import { getCatalogOptions } from '@/lib/selectorCatalog.js';
import { formatAmount } from '@/lib/formatAmount.js';
import { getStatusBadgeProps, getStatusDotColor, getStatusPillClass, statusLabel } from '@/lib/statusBadge.js';

/**
 * Evaluate a simple Etendo display-logic expression (@Field@='Value') against record data.
 * Returns true (visible) if the expression cannot be parsed or if the field is missing from data.
 */
function evalDisplayLogicRaw(expr, data) {
  if (!expr) return true;
  const clauses = [...expr.matchAll(/@(\w+)@\s*(!?=)\s*'([^']*)'/g)];
  if (clauses.length === 0) return true;
  return clauses.every(([, fieldRef, op, expected]) => {
    const key = fieldRef[0].toLowerCase() + fieldRef.slice(1);
    if (!(key in (data || {}))) return true; // field absent → default visible
    const rawVal = data[key];
    // Normalize boolean API values to Etendo string equivalents (true→'Y', false→'N')
    const actual = typeof rawVal === 'boolean' ? (rawVal ? 'Y' : 'N') : String(rawVal ?? '');
    return op === '=' ? actual === expected : actual !== expected;
  });
}
import { cn } from '@/lib/utils.js';
import DocumentPrintDrawer from './DocumentPrintDrawer.jsx';
import { toast } from 'sonner';

/**
 * Collapsible section that hides itself entirely when children render as null.
 */
function CollapsibleSection({ title, children }) {
  const ref = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    // Check for actual form fields — wrapper divs always render even when
    // EntityForm returns null, so we must look for real input elements.
    if (ref.current) {
      const hasFields = ref.current.querySelector(
        'input, select, textarea, [role="combobox"], [role="spinbutton"]'
      ) !== null;
      setEmpty(!hasFields);
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
  formFooter = null,
  draftMode = null,
  headerContent = null,
  customTabs = [],
  documentPreview,
  notesField,
  extraActions = [],
  menuActions = [],
  customMenuContent = null,
  hideDeleteWhenComplete = false,
  hidePrint = false,
  hideSaveStatuses = [],
  hideMoreMenu = false,
  hideMoreDetails = false,
  noHeaderBorder = false,
  hideTopBar = false,
  CustomLines = null,
  customLinesLabel = 'Invoices',
  sidePanel = null,
  sidePanelStyle = null,
  afterTotals = null,
  bottomSection = null,
  topbarExtra = null,
  topbarRight = null,
  statusFieldLabel = null,
  statusEnumLabels = null,
  salesTheme = false,
  sidebarContent = null,
  othersLabel = null,
  primaryTabs = null,
  contentBg = 'bg-white',
  lockWhenProcessed = true,
  addLineGuard = null,
  showDetailFooterTotals = undefined,
  onAfterSave,
  onAfterCreate,
  labelOverrides,
}) {
  const hook = useEntity(entity, detailEntity, { token, apiBaseUrl });
  const LinesEmptyState = bottomSection?.linesEmptyState ?? null;
  const DetailExtraActions = bottomSection?.detailExtraActions ?? null;
  // Static hooks for up to 4 secondary tabs (React rules forbid dynamic hook calls)
  const secondaryHook0 = useEntity(entity, (secondaryTabs[0]?.isFormTab || secondaryTabs[0]?.Panel) ? null : (secondaryTabs[0]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook1 = useEntity(entity, (secondaryTabs[1]?.isFormTab || secondaryTabs[1]?.Panel) ? null : (secondaryTabs[1]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook2 = useEntity(entity, (secondaryTabs[2]?.isFormTab || secondaryTabs[2]?.Panel) ? null : (secondaryTabs[2]?.key ?? null), { token, apiBaseUrl });
  const secondaryHook3 = useEntity(entity, (secondaryTabs[3]?.isFormTab || secondaryTabs[3]?.Panel) ? null : (secondaryTabs[3]?.key ?? null), { token, apiBaseUrl });
  const secondaryHooks = [secondaryHook0, secondaryHook1, secondaryHook2, secondaryHook3];
  const parentRecordId = hook.selected?.id ?? recordId ?? hook.editing?.id ?? null;
  const selectorContextByEntity = useMemo(() => {
    const headerData = hook.editing || hook.selected;
    const priceListId = headerData?.priceList ?? null;

    // Derive isSOTrx from window category so NEO's validation filter resolves
    // @isSOTrx@ in M_PriceList.issopricelist = @isSOTrx@, showing only sales or
    // purchase price lists depending on the document type.
    const category = api?.window?.category;
    const isSOTrx = category === 'sales' ? 'Y' : category === 'purchases' ? 'N' : null;

    // Derive isCustomer/isVendor from window category so the BusinessPartner selector
    // shows only customers (sales) or vendors (purchases).
    const isCustomer = category === 'sales' ? 'Y' : null;
    const isVendor = category === 'purchases' ? 'Y' : null;

    const next = {};
    // Primary entity (header): inject isSOTrx, isCustomer, isVendor
    if (entity) {
      next[entity] = {
        ...(isSOTrx ? { isSOTrx } : {}),
        ...(isCustomer ? { isCustomer } : {}),
        ...(isVendor ? { isVendor } : {}),
      };
    }
    if (!parentRecordId) return next;
    if (detailEntity) {
      // DateInvoiced is required by the C_Tax validationRule:
      // VALIDFROM <= COALESCE(@DateInvoiced@, @DateOrdered@)
      // Without it, COALESCE(null,null)=null → VALIDFROM<=null is always FALSE → no taxes returned.
      const invoiceDate = headerData?.invoiceDate ?? headerData?.orderDate ?? null;
      next[detailEntity] = {
        parentId: parentRecordId,
        ...(isSOTrx ? { isSOTrx, IsSOTrx: isSOTrx } : {}),
        ...(priceListId ? { priceList: priceListId } : {}),
        ...(invoiceDate ? { DateInvoiced: invoiceDate } : {}),
      };
    }
    for (const tab of secondaryTabs) {
      if (tab?.key) {
        next[tab.key] = { parentId: parentRecordId };
      }
    }
    return next;
  }, [entity, detailEntity, parentRecordId, secondaryTabs, hook.editing, hook.selected, api]);
  const { catalogs, catalogsLoaded } = useCatalogs(api, token, apiBaseUrl, staticCatalogs, selectorContextByEntity);
  const displayLogic = useDisplayLogic(entity, hook.editing, { token, apiBaseUrl });
  const { calloutResult, calloutLoading, executeCallout } = useCallout(entity, { token, apiBaseUrl });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const embedded = searchParams.get('embedded') === '1';
  const tMenu = useMenuLabel();
  const ui = useUI();
  const dictionary = useLocale();
  const [addingLine, setAddingLine] = useState(false);
  const [addingSecondaryLine, setAddingSecondaryLine] = useState({});
  const [customModalState, setCustomModalState] = useState({ key: null, rowId: null });
  const [activeTab, setActiveTab] = useState(0);

  // Document-level read-only: when processed===true, the entire record (including lines) is read-only.
  const _headerData = hook.selected ?? hook.editing;
  const isProcessed = _headerData?.processed === true || _headerData?.processed === 'Y';
  const isDraftModeCompleted = Boolean(
    draftMode?.enabled && (
      isProcessed || _headerData?.documentStatus === 'CO'
    )
  );
  const isDocumentReadOnly = lockWhenProcessed && isProcessed;
  const [showPrint, setShowPrint] = useState(false);
  // showNotes state removed — notes panel is always visible in side-by-side layout
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const handledOpenAddLineRef = useRef(false);
  const handledOpenSecondaryLineRef = useRef(false);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClick = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreMenu]);
  const [directFetched, setDirectFetched] = useState(false);
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedChildRows, setSelectedChildRows] = useState([]);
  const [deletingChildren, setDeletingChildren] = useState(false);
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
  const [secondaryDeleteConfirm, setSecondaryDeleteConfirm] = useState(null);

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
  // Guard: fire default callouts only once per new-record session
  const defaultCalloutsTriggeredRef = useRef(false);
  // Cache for tax rates fetched from the selector (keyed by tax ID).
  // Avoids repeated API calls when the same tax appears on multiple lines.
  const taxRateCacheRef = useRef({});

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

  // Auto-open add-line form after header auto-save navigation (openAddLine flag in route state).
  useEffect(() => {
    if (!location.state?.openAddLine || isNew || !hook.editing) {
      handledOpenAddLineRef.current = false;
      return;
    }
    if (handledOpenAddLineRef.current) return;
    handledOpenAddLineRef.current = true;
    setAddingLine(true);
    setEditingChild(null);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.openAddLine, isNew, hook.editing, navigate, location.pathname]);

  // Save header first (if new), then open add-line form.
  const handleAddLineClick = useCallback(async () => {
    if (isNew) {
      const saved = await hook.handleSave();
      if (!saved?.id) return;
      navigate(`/${windowName}/${saved.id}`, { replace: true, state: { openAddLine: true } });
      return;
    }
    setAddingLine(prev => !prev);
    setEditingChild(null);
  }, [isNew, hook.handleSave, navigate, windowName]);

  const handleSecondaryAddLineToggle = useCallback(async (tabKey) => {
    const targetTab = secondaryTabs.find(st => st.key === tabKey);
    if (!targetTab) return;
    if (isNew && targetTab.requireSavedRecord) {
      const saved = await hook.handleSave();
      if (!saved?.id) return;
      navigate(`/${windowName}/${saved.id}`, {
        replace: true,
        state: { openSecondaryTab: tabKey, openAddSecondaryLine: true },
      });
      return;
    }
    setAddingSecondaryLine(prev => ({ ...prev, [tabKey]: !prev[tabKey] }));
    setSelectedSecondaryLine(null);
  }, [secondaryTabs, isNew, hook.handleSave, navigate, windowName]);

  // Resolve $_identifier for default FK values.
  // NOTE: Mandatory defaults are now handled by the backend (NeoDefaultsService).
  // The frontend only ensures that if a value exists (from a default or callout),
  // we resolve its $_identifier from the catalogs so it displays correctly.
  useEffect(() => {
    if (!isNew || !hook.editing || !catalogsLoaded || !api?.selectors) return;
    for (const sel of api.selectors) {
      const val = hook.editing[sel.field];
      if (!val) continue;
      // Value is set but no identifier — resolve it from loaded catalog
      if (hook.editing[sel.field + '$_identifier']) continue;
      const options = getCatalogOptions(catalogs, sel.entity, sel);
      if (!Array.isArray(options) || options.length === 0) continue;
      const match = options.find(o => o.id === val);
      if (match) {
        hook.handleChange(sel.field + '$_identifier', match.label || match.name || match._identifier);
      }
    }
  }, [isNew, hook.editing, catalogsLoaded, catalogs, api]);

  // After defaults load for a new record, fire callouts for non-dependent selector fields
  // so the callout chain runs (e.g. businessPartner → priceList, paymentTerms).
  // This mirrors what classic Etendo does when opening a blank document.
  useEffect(() => {
    if (!isNew) { defaultCalloutsTriggeredRef.current = false; return; }
    if (defaultCalloutsTriggeredRef.current) return;
    if (!hook.editing || !api?.selectors) return;
    // Wait until defaults have actually arrived (editing is non-empty)
    const hasDefaults = Object.values(hook.editing).some(v => v != null && v !== '');
    if (!hasDefaults) return;

    defaultCalloutsTriggeredRef.current = true;

    // Trigger callouts for primary (non-dependent) selector fields that have default values.
    // 'dependent' selectors (e.g. partnerAddress) are derived by other callouts — skip them.
    const triggers = (api.selectors || [])
      .filter(s => s.entity === entity && s.inputMode !== 'dependent' && hook.editing[s.field]);

    // Stagger calls by (i * executeCallout.debounceMs + buffer) so each result settles
    // before the next callout fires. The backend is idempotent: returns {} for fields
    // with no registered callout, so it is safe to call for every selector field.
    const STAGGER_MS = 400; // > useCallout debounce (300ms)
    const editingSnapshot = { ...hook.editing };
    triggers.forEach(({ field }, i) => {
      setTimeout(() => {
        const value = editingSnapshot[field];
        if (value) executeCallout(field, value, editingSnapshot);
      }, i * STAGGER_MS);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, hook.editing, api, entity]);

  useEffect(() => {
    setDirectFetched(false);
  }, [recordId]);

  useEffect(() => {
    if (isNew || !recordId) return;
    if (currentItem && (!hook.selected || String(hook.selected.id) !== String(recordId))) {
      hook.handleSelect(currentItem);
      setDirectFetched(false);
      return;
    }
    if (!currentItem && !hook.loading && !directFetched) {
      setDirectFetched(true);
      hook.fetchById(recordId);
    }
  }, [currentItem, directFetched, hook.fetchById, hook.handleSelect, hook.loading, hook.selected, isNew, recordId]);

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
        } else if (entry.value && api?.selectors) {
          // Callout returned an ID without _identifier — resolve from loaded catalogs
          const sel = api.selectors.find(s => s.field === key);
          if (sel) {
            const options = getCatalogOptions(catalogs, sel.entity, sel);
            const match = Array.isArray(options) && options.find(o => o.id === entry.value);
            if (match) {
              hook.handleChange(key + '$_identifier', match.label || match.name || match._identifier);
            }
          }
        }
      }
    }
    if (combos) {
      for (const [key, combo] of Object.entries(combos)) {
        let selectedVal = combo.selected;
        let selectedLabel = combo._identifier;
        // Auto-select first entry if no explicit selection (e.g., BP address combo)
        if (selectedVal == null && Array.isArray(combo.entries) && combo.entries.length > 0) {
          selectedVal = combo.entries[0].id;
          selectedLabel = combo.entries[0].identifier || combo.entries[0]._identifier;
        }
        if (selectedVal != null) {
          appliedFields.add(key);
          hook.handleChange(key, selectedVal);
          if (selectedLabel) {
            hook.handleChange(key + '$_identifier', selectedLabel);
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
      // For callouts that compute unit price from qty (e.g., SL_Order_Amt for tax-included
      // price lists): substitute orderedQuantity = 1 when empty so the callout can compute
      // the unit price correctly. qty=0 causes grossAmount=0 → netUnitPrice=0, which is
      // meaningless for unit price display. qty=1 gives the correct per-unit calculation.
      // This only affects the callout context — the actual form value is unchanged.
      const formStateForCallout = { ...formState };
      if (!Number(formStateForCallout.orderedQuantity)) {
        formStateForCallout.orderedQuantity = 1;
      }
      const payload = {
        field,
        value,
        formState: formStateForCallout,
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
      // Resolve missing $_identifier from loaded catalogs for FK fields returned by callout
      // (e.g., callout sets uOM='100' but server omits the display name)
      if (api?.selectors) {
        for (const key of Object.keys(result)) {
          if (key.includes('$_identifier')) continue;
          if (result[key + '$_identifier']) continue;
          const selConfig = api.selectors.find(s => s.field === key && s.entity === detailEntity);
          if (!selConfig) continue;
          const opts = getCatalogOptions(catalogs, detailEntity, selConfig);
          const match = opts.find(o => o.id === result[key]);
          if (match) result[key + '$_identifier'] = match.label || match.name || match._identifier || '';
        }
      }
      // Last resort: check snapshot for a display hint passed by the selector item.
      // Pattern: field='product', result key='uOM' → look for rowValues['product_uOM'] = "Unit"
      for (const key of Object.keys(result)) {
        if (key.includes('$_identifier')) continue;
        if (result[key + '$_identifier']) continue;
        const hint = rowValues[field + '_' + key];
        if (hint && typeof hint === 'string') result[key + '$_identifier'] = hint;
      }
      // Tax-included price lists: SL_Order_Product sets grossUnitPrice (price with tax) but
      // omits netUnitPrice (net price). Fetch the real tax rate from the Etendo DAL REST API
      // so the backend receives a valid netUnitPrice instead of null/0 at save time.
      if (result.grossUnitPrice != null && result.netUnitPrice == null) {
        // Derive net price from gross using taxFactor from existing saved lines.
        // Avoids DAL fetch which may not be available in all environments.
        const taxId = result.tax;
        let taxFactor = null;
        if (taxId) {
          const ref = (hook.children || []).find(l =>
            l.tax === taxId &&
            parseFloat(String(l.grossAmount ?? '')) > 0 &&
            parseFloat(String(l.lineNetAmount ?? '')) > 0
          );
          if (ref) {
            taxFactor = parseFloat(String(ref.grossAmount)) / parseFloat(String(ref.lineNetAmount));
          }
        }
        const gross = Number(result.grossUnitPrice);
        result.netUnitPrice = taxFactor != null && taxFactor > 1
          ? parseFloat((gross / taxFactor).toFixed(6))
          : gross;
      }
      // netUnitPrice is kept as a fallback for the cascade guard below.
      // PriceActual will be derived by SL_Order_Amt from Gross_Unit_Price, not set here.
      // SL_Invoice_Product / SL_Order_Product callouts reset quantity fields to 0 as a
      // classic Etendo "clear-for-entry" signal. Discard any qty=0 update when the row
      // already has a positive value so the user's default (or entered) quantity is kept.
      for (const qtyKey of ['invoicedQuantity', 'orderedQuantity', 'movementQuantity']) {
        if (result[qtyKey] === 0 && Number(rowValues[qtyKey]) > 0) delete result[qtyKey];
      }
      // Fallback: when callout returns no lineNetAmount (e.g. SL_Invoice_Amt throws
      // PriceAdjustment exception for products without standard cost), compute qty × price.
      // Covers both the inline add-row (DataTable) and the sidebar detail form (DetailView).
      // Also covers the product-selection case: SL_Invoice_Product returns 'priceActual' (OBDal
      // property name), not 'unitPrice' (Schema Forge key), so result.unitPrice is null. But the
      // selector item mapping already put unitPrice into rowValues before the callout fired.
      if (result.lineNetAmount == null && (field === 'invoicedQuantity' || field === 'unitPrice' || field === 'product')) {
        const qty   = field === 'invoicedQuantity' ? (parseFloat(value) || 0)
                    : (parseFloat(String(rowValues.invoicedQuantity ?? '')) || 0);
        const price = field === 'unitPrice'        ? (parseFloat(value) || 0)
                    : (parseFloat(String(rowValues.unitPrice ?? '')) || 0);
        if (qty > 0 && price > 0) result.lineNetAmount = String(qty * price);
      }
      // Compute grossAmount in real-time by deriving the tax factor from already-available data.
      // No external fetch: tax rate is inferred from saved line values (grossAmount/lineNetAmount).
      //   - Sidebar: rowValues holds the persisted line → taxFactor always available after first save.
      //   - Add-row: looks for another saved line in hook.children with the same tax.
      // Compute grossAmount in real-time. Also resolves tax$_identifier from existing lines.
      // Condition: callout didn't set grossAmount OR set it to 0 (SL_Invoice_Amt returns 0
      // for net price lists — only computes it for gross price lists in classic Etendo).
      if (result.grossAmount == null || Number(result.grossAmount) === 0) {
        // Use qty × price for qty/price changes (avoids stale callout lineNetAmount).
        // For product-field changes: unitPrice was already injected into rowValues by the selector
        // item mapping before the callout ran, so we can compute lineNet from rowValues directly.
        let lineNet;
        if (field === 'invoicedQuantity' || field === 'unitPrice') {
          const qty   = parseFloat(field === 'invoicedQuantity' ? value : rowValues.invoicedQuantity) || 0;
          const price = parseFloat(field === 'unitPrice'        ? value : rowValues.unitPrice)        || 0;
          lineNet = qty > 0 && price > 0 ? qty * price : 0;
        } else if (field === 'product') {
          const qty   = parseFloat(String(rowValues.invoicedQuantity ?? '')) || 0;
          const price = parseFloat(String(rowValues.unitPrice ?? '')) || 0;
          lineNet = qty > 0 && price > 0 ? qty * price : 0;
        } else {
          lineNet = parseFloat(String(result.lineNetAmount ?? rowValues.lineNetAmount ?? '')) || 0;
        }

        if (lineNet > 0) {
          const effectiveTaxId = result.tax ?? rowValues.tax;

          let taxFactor = null;

          // 0. Tax rate injected by backend when callout sets a 'tax' field.
          //    Covers the first-line-of-a-fresh-document case where no saved lines exist.
          const calloutTaxRate = parseFloat(String(result.taxRate ?? ''));
          if (!isNaN(calloutTaxRate)) {
            taxFactor = 1 + calloutTaxRate / 100;
            if (effectiveTaxId) taxRateCacheRef.current[effectiveTaxId] = calloutTaxRate;
          }

          // 1. Tax rate from selector item aux data (if NEO selector returns 'rate' field).
          //    When InlineSearchCombo selects a tax, handleFieldChange stores it as rowValues['tax_rate'].
          if (taxFactor === null) {
            const taxRateFromCtx = parseFloat(String(rowValues['tax_rate'] ?? ''));
            if (!isNaN(taxRateFromCtx) && taxRateFromCtx >= 0) {
              taxFactor = 1 + taxRateFromCtx / 100;
            }
          }

          // 2. Derive taxFactor from the current row's saved values (sidebar case).
          if (taxFactor === null) {
            const savedGross = parseFloat(String(rowValues.grossAmount ?? '')) || 0;
            const savedNet   = parseFloat(String(rowValues.lineNetAmount ?? '')) || 0;
            if (savedGross > 0 && savedNet > 0) {
              taxFactor = savedGross / savedNet;
            }
          }

          // 3. Find any saved line with the same tax that has both amounts (add-row case).
          if (taxFactor === null && effectiveTaxId) {
            const ref = (hook.children || []).find(l =>
              l.tax === effectiveTaxId &&
              parseFloat(String(l.grossAmount ?? '')) > 0 &&
              parseFloat(String(l.lineNetAmount ?? '')) > 0
            );
            if (ref) {
              taxFactor = parseFloat(String(ref.grossAmount)) / parseFloat(String(ref.lineNetAmount));
            }
          }

          // 4. Cached rate from a previous callout for the same tax (e.g., user changes qty
          //    after already selecting the product — source 0 already cached the rate).
          if (taxFactor === null && effectiveTaxId) {
            const cachedRate = taxRateCacheRef.current[effectiveTaxId];
            if (cachedRate != null) {
              taxFactor = 1 + cachedRate / 100;
            }
          }

          if (taxFactor !== null) {
            result.grossAmount = parseFloat((lineNet * taxFactor).toFixed(2));
          }

          // Resolve tax$_identifier from existing lines if callout didn't include it.
          if (!result['tax$_identifier'] && effectiveTaxId) {
            const ref = (hook.children || []).find(l => l.tax === effectiveTaxId && l['tax$_identifier']);
            if (ref) result['tax$_identifier'] = ref['tax$_identifier'];
          }
        }
      }
      applyUpdates?.(result);

      // Cascade to SL_Order_Amt when a price-setting callout (e.g. SL_Order_Product) returned
      // unitPrice or grossUnitPrice but did not compute lineNetAmount.
      // This mirrors classic browser behaviour: detecting a price field change auto-fires
      // SL_Order_Amt to compute lineNetAmount = unitPrice * qty (and, for gross-price lists,
      // to derive the correct net unitPrice from grossUnitPrice).
      const priceUpdated = result.unitPrice != null || result.grossUnitPrice != null;
      // Cascade when lineNetAmount is absent or 0 — a zero could mean qty=0 was used internally.
      const amountNotComputed = result.lineNetAmount == null || Number(result.lineNetAmount) === 0;
      if (priceUpdated && amountNotComputed) {
        try {
          // Merge first callout result into the form state so SL_Order_Amt sees the
          // freshly set tax, grossUnitPrice, etc.
          const cascadeState = { ...formStateForCallout };
          for (const [k, v] of Object.entries(result)) {
            if (!k.includes('$_identifier')) cascadeState[k] = v;
          }
          // For tax-inclusive price lists: trigger SL_Order_Amt via Gross_Unit_Price so
          // it derives PriceActual (net) and lineNetAmount correctly.
          // For regular price lists: trigger via PriceActual as usual.
          // The callout endpoint resolves by DB column name, not by the SFField API key.
          const grossUnitPriceColumn = (addLineFields?.entry ?? []).find(
            f => f.key === 'grossUnitPrice'
          )?.column ?? 'inpgrossUnitPrice';
          const unitPriceColumn = (addLineFields?.entry ?? []).find(
            f => f.key === 'unitPrice'
          )?.column ?? 'PriceActual';
          const useGross = result.grossUnitPrice != null;
          const cascadeField = useGross ? grossUnitPriceColumn : unitPriceColumn;
          const cascadeValue = useGross
            ? result.grossUnitPrice
            : (result.netUnitPrice ?? result.unitPrice ?? result.grossUnitPrice);
          // SL_Order_Amt needs grossListPrice to compute lineNetAmount for tax-inclusive lists.
          // If it's missing or 0, seed it with grossUnitPrice so the callout has a valid base.
          if (useGross && (cascadeState.grossListPrice == null || Number(cascadeState.grossListPrice) === 0)) {
            cascadeState.grossListPrice = result.grossUnitPrice;
          }
          const cascadePayload = {
            field: cascadeField,
            value: String(cascadeValue ?? ''),
            formState: cascadeState,
            ...(Object.keys(auxiliaryValues).length > 0 ? { auxiliaryValues } : {}),
          };
          const cascadeRes = await fetch(`${apiBaseUrl}/${detailEntity}/callout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(cascadePayload),
          });
          if (cascadeRes.ok) {
            const cascadeData = await cascadeRes.json();
            const cascadeResult = {};
            if (cascadeData.updates) {
              for (const [k, entry] of Object.entries(cascadeData.updates)) {
                cascadeResult[k] = entry.value;
                if (entry._identifier) cascadeResult[k + '$_identifier'] = entry._identifier;
              }
            }
            if (cascadeData.combos) {
              for (const [k, combo] of Object.entries(cascadeData.combos)) {
                if (combo.selected != null) cascadeResult[k] = combo.selected;
              }
            }
            // Same guard: don't let the cascade zero out a quantity the user already set.
            for (const qtyKey of ['invoicedQuantity', 'orderedQuantity', 'movementQuantity']) {
              if (cascadeResult[qtyKey] === 0 && Number(rowValues[qtyKey]) > 0) delete cascadeResult[qtyKey];
            }
            // Ensure unitPrice = net after cascade for tax-included price lists.
            // If SL_Order_Amt did not echo back unitPrice, apply it explicitly so
            // PriceActual is saved as the correct net value (not the gross selector price).
            if (result.grossUnitPrice != null && result.netUnitPrice != null
                && cascadeResult.unitPrice == null) {
              cascadeResult.unitPrice = result.netUnitPrice;
            }
            if (Object.keys(cascadeResult).length > 0) applyUpdates?.(cascadeResult);
          }
        } catch {
          // Cascade is best-effort — first callout result was already applied above
        }
      }
    } catch {
      // Callout is best-effort
    }
  }, [token, apiBaseUrl, detailEntity, hook.editing, hook.selected, catalogs, api, addLineFields]);

  const data = hook.editing || currentItem || {};
  // Guard that controls whether "+ Add Lines" is shown.
  // When addLineGuard is provided, it receives the current record data and must return true to allow.
  const canAddLines = addLineGuard ? addLineGuard(data) : true;
  const windowTitle = breadcrumb
    ? tMenu(breadcrumb.split(' / ').at(-1).trim()) || breadcrumb.split(' / ').at(-1).trim()
    : tMenu(windowName) || windowName || '';
  const { toggleFavorite, isFavorite } = useFavorites();
  const favKey = windowName || windowTitle;
  const favActive = isFavorite(favKey);

  const title = isNew
    ? ui('newRecord')
    : `${resolveIdentifier(data, titleField) || data._identifier || data.id || ''}`;
  const fullBreadcrumb = breadcrumb
    ? `${breadcrumb.split(' / ').map(s => tMenu(s.trim())).join(' / ')}${title ? ` / ${title}` : ''}`
    : windowTitle;

  useSetPageMeta({
    title: title || windowTitle,
    breadcrumb: fullBreadcrumb,
    onAddToFavorites: favKey ? () => toggleFavorite(favKey, entityLabel || breadcrumb?.split(' / ').at(-1).trim() || windowName) : undefined,
    isFavorite: favActive,
  }, [favActive, title]);

  const allEntryFields = addLineFields.entry ?? [];
  const hiddenEntryDefaults = addLineFields.hidden ?? [];
  const editableChildFields = allEntryFields.filter(f => f.type === 'number' || f.type === 'amount');

  const [panelCounts, setPanelCounts] = useState({});
  useEffect(() => { setPanelCounts({}); }, [parentRecordId]);

  // Build tabs: child entity lines + secondary tabs + "Others" tab for non-principal header fields
  const tabs = [];
  secondaryTabs.forEach((st, i) => {
    const childCount = st.Panel ? (panelCounts[st.key] ?? null) : (!st.isFormTab ? (secondaryHooks[i]?.children?.length ?? null) : null);
    tabs.push({ key: st.key, label: st.label, count: childCount });
  });
  if (DetailTable) {
    const linesTab = { key: 'lines', label: detailLabel || detailEntity || 'Lines', count: hook.children?.length || 0 };
    if (typeof detailTabIndex === 'number' && detailTabIndex >= 0 && detailTabIndex <= tabs.length) {
      tabs.splice(detailTabIndex, 0, linesTab);
    } else {
      tabs.unshift(linesTab);
    }
  } else if (CustomLines) {
    tabs.unshift({ key: 'customLines', label: customLinesLabel });
  }

  // When primaryTabs is in use, skip auto-adding Others (handled by a primary tab)
  const [showOthers, setShowOthers] = useState(primaryTabs ? false : null);
  const [activePrimaryTab, setActivePrimaryTab] = useState(primaryTabs?.[0]?.key ?? 'general');
  const [notesFocused, setNotesFocused] = useState(false);
  const othersRef = useRef(null);

  useEffect(() => {
    if (showOthers === null && othersRef.current) {
      // Check if the hidden probe rendered any DOM content
      setShowOthers(othersRef.current.childElementCount > 0);
    }
  });

  if (showOthers === true) {
    tabs.push({ key: 'others', label: othersLabel || ui('others') });
  }

  useEffect(() => {
    const targetTabKey = location.state?.openSecondaryTab;
    if (!targetTabKey || isNew || !hook.editing) {
      handledOpenSecondaryLineRef.current = false;
      return;
    }
    if (handledOpenSecondaryLineRef.current) return;
    handledOpenSecondaryLineRef.current = true;
    const nextTabIndex = tabs.findIndex(tab => tab.key === targetTabKey);
    if (nextTabIndex >= 0) {
      setActiveTab(nextTabIndex);
    }
    if (location.state?.openAddSecondaryLine) {
      setAddingSecondaryLine(prev => ({ ...prev, [targetTabKey]: true }));
      setSelectedSecondaryLine(null);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.openSecondaryTab, location.state?.openAddSecondaryLine, isNew, hook.editing, navigate, location.pathname, tabs]);

  if (hook.loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {ui('loading')}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="detail-view">
      {/* Content card with rounded top-left corner */}
      <div className={`flex-1 flex flex-col ${contentBg} rounded-tl-2xl overflow-hidden min-h-0`}>
        {/* Action bar: Cancel + status | actions + save */}
        {embedded ? (
          statusField && data[statusField] ? (
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[13px] font-medium ${getStatusPillClass(data[statusField])}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(data[statusField])}`} />
                {statusFieldLabel || ui('documentStatus')}
                <span style={{ opacity: 0.4 }}>&middot;</span>
                <span className="font-semibold">{statusEnumLabels?.[data[statusField]] || statusLabel(data[statusField])}</span>
              </span>
            </div>
          ) : null
        ) : (
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
              {ui('cancel')}
            </Button>
            {statusField && data[statusField] != null && (() => {
              const _s = data[statusField];
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[13px] font-medium ${getStatusPillClass(_s)}`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(_s)}`} />
                  {statusFieldLabel || ui('documentStatus')}
                  <span style={{ opacity: 0.4 }}>&middot;</span>
                  <span className="font-semibold">{statusEnumLabels?.[_s] || statusLabel(_s, dictionary)}</span>
                </span>
              );
            })()}
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
            {topbarExtra && (() => {
              const TopbarExtraComponent = topbarExtra;
              return <TopbarExtraComponent data={data} recordId={data?.id || recordId} token={token} apiBaseUrl={apiBaseUrl} api={api} onProcess={hook.handleProcess} />;
            })()}
          </div>

            <div className="flex items-center gap-2">
              {/* Topbar right slot (e.g. payment status badge) */}
              {topbarRight && (() => {
                const TopbarRightComponent = topbarRight;
                return <TopbarRightComponent data={data} recordId={data?.id || recordId} token={token} apiBaseUrl={apiBaseUrl} api={api} onProcess={hook.handleProcess} />;
              })()}
              {/* Send / Print document — uses DocumentPrintDrawer */}
              {documentPreview && !isNew && recordId && (
                <button
                  onClick={() => setShowPrint(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  title={ui('sendPreview')}
                  data-testid="action-document-preview"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
              {/* Print document — shown when documentPreview is not provided */}
              {!documentPreview && !hidePrint && !isNew && recordId && (
                <button
                  onClick={() => setShowPrint(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                  title={ui('print')}
                >
                  <Printer className="h-4 w-4" />
                </button>
              )}
              {/* Delete record — hidden when hideDeleteWhenComplete and status matches */}
              {!isNew && recordId && !(hideDeleteWhenComplete && statusField && data?.[statusField] && data[statusField] !== 'DR' && data[statusField] !== 'RPAP') && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title={ui('delete')}
                  data-testid="action-delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              {/* More actions */}
              {!hideMoreMenu && <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(v => !v)}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {showMoreMenu && (() => {
                  const resolvedActions = typeof menuActions === 'function'
                    ? menuActions({ data, status: data?.[statusField] })
                    : menuActions;
                  const visibleActions = resolvedActions.filter(a => a.visible !== false);
                  if (visibleActions.length === 0 && !customMenuContent) return null;
                  return (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 bg-white py-1 min-w-[160px]"
                      style={{ border: '0.5px solid hsl(var(--border))', borderRadius: '8px' }}
                    >
                      {visibleActions.map((action, i) => (
                        <button
                          key={action.key || i}
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (action.columnName) {
                              hook.handleProcess?.({ columnName: action.columnName, name: action.key });
                            } else if (action.onClick) {
                              action.onClick();
                            }
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${action.destructive
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-foreground hover:bg-secondary'
                            }`}
                        >
                          {action.label}
                        </button>
                      ))}
                      {customMenuContent && (() => {
                        const CustomMenuContent = customMenuContent;
                        return <CustomMenuContent
                          data={data}
                          recordId={data?.id || recordId}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          onClose={() => setShowMoreMenu(false)}
                          onRefresh={() => hook.fetchById?.(data?.id || recordId)}
                        />;
                      })()}
                    </div>
                  );
                })()}
              </div>}
              {/* Extra action buttons from page */}
              {(typeof extraActions === 'function' ? extraActions({ data, children: hook.children }) : extraActions).map((action, i) => (
                action.visible !== false && (
                  <Button
                    key={action.key || i}
                    variant="outline"
                    size="sm"
                    className={action.className || ''}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </Button>
                )
              ))}
              {/* Process buttons — only shown for existing records, evaluated locally or by server visibility */}
              {!isNew && processes
                .filter(p => p.displayLogicRaw
                  ? evalDisplayLogicRaw(p.displayLogicRaw, data)
                  : displayLogic?.visibility?.[p.name] !== false)
                .filter(p => !p.requiresLines || hook.children.length > 0)
                .map(p => {
                  const isPrimary = p.style === 'positive';
                  const btnClass = salesTheme
                    ? (p.style === 'destructive'
                      ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : isPrimary
                        ? 'bg-amber-400 text-black hover:bg-amber-500 border-transparent font-medium'
                        : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')
                    : (p.style === 'destructive'
                      ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : isPrimary
                        ? ''
                        : '');
                  return (
                    <Button
                      key={p.name}
                      variant={isPrimary ? 'default' : 'outline'}
                      size="sm"
                      className={btnClass}
                      onClick={() => hook.handleProcess?.(p)}
                    >
                      {tMenu(p.label)}
                    </Button>
                  );
                })}

              {!hideSaveStatuses.includes(_headerData?.documentStatus) && !isDraftModeCompleted && (draftMode?.enabled ? (
                <>
                  <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" data-testid="action-save-draft" onClick={async () => {
                    const saved = await hook.handleSave(data);
                    if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
                  }}>
                    <Save className="h-3.5 w-3.5" />
                    {ui('save')}
                  </Button>
                  <Button size="sm" className="gap-1.5" data-testid="action-save" onClick={async () => {
                    const saved = await hook.handleSaveAndProcess(draftMode);
                    if (saved) {
                      if (isNew && onAfterCreate) await onAfterCreate(saved, { token, apiBaseUrl });
                      if (onAfterSave) {
                        navigate(`/${windowName}`, { replace: true, state: { savedRecord: saved } });
                      } else if (saved.id && isNew) {
                        navigate(`/${windowName}/${saved.id}`, { replace: true });
                      }
                    }
                  }}>
                    <Check className="h-3.5 w-3.5" />
                    {ui(draftMode.label) || draftMode.label || ui('process')}
                  </Button>
                </>
              ) : isNew ? (<>
                <Button size="sm" className="gap-1.5" data-testid="action-save" disabled={isDocumentReadOnly} onClick={async () => {
                  const saved = await hook.handleSave(data);
                  if (saved?.id && isNew) navigate(`/${windowName}/${saved.id}`, { replace: true });
                }}>
                  <Save className="h-3.5 w-3.5" />
                  {ui('save')}
                </Button>
                {!isProcessed && hook.children.length > 0 && (
                <Button size="sm" className="gap-1.5" data-testid="action-save" onClick={async () => {
                  const saved = await hook.handleSaveAndProcess(draftMode);
                  if (saved) {
                    if (isNew && onAfterCreate) await onAfterCreate(saved, { token, apiBaseUrl });
                    if (onAfterSave) {
                      navigate(`/${windowName}`, { replace: true, state: { savedRecord: saved } });
                    } else if (saved.id && isNew) {
                      navigate(`/${windowName}/${saved.id}`, { replace: true });
                    }
                  }
                }}>
                  <Check className="h-3.5 w-3.5" />
                  {ui(draftMode.label) || tMenu(draftMode.label) || ui('process')}
                </Button>
                )}
              </>
            ) : (
              <Button size="sm" className="gap-1.5" data-testid="action-save" disabled={isDocumentReadOnly} onClick={async () => {
                const saved = await hook.handleSave(data);
                if (saved) {
                  if (isNew && onAfterCreate) await onAfterCreate(saved, { token, apiBaseUrl });
                  if (onAfterSave) {
                    navigate(`/${windowName}`, { replace: true, state: { savedRecord: saved } });
                  } else if (saved.id && isNew) {
                    navigate(`/${windowName}/${saved.id}`, { replace: true });
                  }
                }
              }}>
                <Check className="h-3.5 w-3.5" />
                {ui('save')}
              </Button>
            ))}
          </div>
        </div>
        )}

        {/* Primary tab bar (General / Additional Info / etc.) */}
        {primaryTabs && (
          <div className="flex items-center gap-1 px-6 py-2 shrink-0">
            {primaryTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActivePrimaryTab(tab.key)}
                className={[
                  'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors border',
                  activePrimaryTab === tab.key
                    ? 'bg-white border-gray-200 shadow-sm text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {tMenu(tab.label)}
                {activePrimaryTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content + optional sidebarContent (full-height independent column) */}
        <div className="flex-1 flex overflow-hidden">
        {/* Non-general primary tab: show Panel fullscreen */}
        {primaryTabs && activePrimaryTab !== 'general' ? (() => {
          const activeTab = primaryTabs.find(t => t.key === activePrimaryTab);
          return activeTab?.Panel ? (
            <div className={`flex-1 overflow-auto pb-6 min-w-0 ${sidePanel || sidebarContent ? 'pl-6 pr-2' : 'px-6'}`}>
              <activeTab.Panel entity={entity} data={data} token={token} apiBaseUrl={apiBaseUrl} catalogs={catalogs} api={api} editing={hook.editing} onChange={handleChangeWithCallout} />
            </div>
          ) : null;
        })() : null}
        <div className={`flex-1 overflow-auto pb-6 min-w-0 ${sidePanel || sidebarContent ? 'pl-6 pr-2' : 'px-6'}${primaryTabs && activePrimaryTab !== 'general' ? ' hidden' : ''}`}>
          {typeof headerContent === 'function' ? headerContent(data) : headerContent}
          <div className={`${sidePanel ? 'flex items-start gap-0' : ''}`}>
          <div className={`${sidePanel ? 'flex-1 min-w-0' : 'max-w-full'} space-y-2`}>
            {/* Principal + collapsed fields wrapped in a card */}
            <div className={`${noHeaderBorder ? '' : ' rounded-2xl border border-gray-200/70 bg-white shadow-sm'}${embedded ? ' pointer-events-none' : ''}`}>
              <div className="p-6">
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
                  selectorContext={selectorContextByEntity[entity]}
                  labelOverrides={labelOverrides}
                />
              </div>

              {/* Collapsible secondary header fields (hidden if no collapsed fields or sidebarContent) */}
              {!hideMoreDetails && !sidebarContent && (
                <CollapsibleSection title={ui('moreDetails')}>
                  <div className={`px-6 pb-6${embedded ? ' pointer-events-none' : ''}`}>
                    <Form
                      entity={entity}
                      data={data}
                      onChange={handleChangeWithCallout}
                      catalogs={catalogs}
                      layout="horizontal"
                      section="collapsed"
                      excludeFields={notesField ? [notesField] : []}
                      displayLogic={displayLogic}
                      api={api}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      selectorContext={selectorContextByEntity[entity]}
                      labelOverrides={labelOverrides}
                    />
                  </div>
                </CollapsibleSection>
              )}
            </div>

            {/* Form footer: inline content below form, above tabs (e.g. BillingPreferencesForm) */}
            {formFooter && (
              <div className={embedded ? 'pointer-events-none' : ''}>
                {React.createElement(formFooter, { data, entity, onChange: handleChangeWithCallout, catalogs, api, token, apiBaseUrl })}
              </div>
            )}

            {/* Tabs: child entities + Others */}
            {tabs.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between border-b border-border/50">
                  <div className="flex items-center gap-0">
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
                        {tMenu(tab.label)}
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
                </div>

                {/* Tab content: Lines */}
                {tabs[activeTab]?.key === 'lines' && DetailTable && (
                  hook.childrenLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                      <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : hook.children.length === 0 && !addingLine && LinesEmptyState && hook.editing && !isDocumentReadOnly ? (
                    <LinesEmptyState
                      data={data}
                      onAddLine={handleAddLineClick}
                      canAddLine={canAddLines}
                      recordId={data?.id || recordId}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      onRefresh={() => hook.fetchChildren?.(data?.id || recordId)}
                    />
                  ) : (
                  <div className={`pt-3 flex items-start gap-4${embedded ? ' pointer-events-none' : ''}`}>
                    {/* Table + add button */}
                    <div className="flex-1 min-w-0">
                      {/* Bulk delete bar */}
                      {(api?.crud?.[detailEntity]?.delete ?? true) && !isDocumentReadOnly && selectedChildRows.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg bg-muted/60 border border-border/40">
                          <span className="text-sm font-medium text-foreground">
                            {ui('selected', { count: selectedChildRows.length })}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={deletingChildren}
                              onClick={async () => {
                                if (!window.confirm(ui('deleteConfirmMessage'))) return;
                                setDeletingChildren(true);
                                try {
                                  const results = await Promise.allSettled(
                                    selectedChildRows.map(row => {
                                      const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', row.id)
                                        || `${apiBaseUrl}/${detailEntity}/${row.id}`;
                                      return fetch(childUrl, {
                                        method: 'DELETE',
                                        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                      }).then(res => ({ res, row }));
                                    })
                                  );
                                  let deleted = 0;
                                  for (const result of results) {
                                    if (result.status === 'fulfilled' && result.value.res.ok) {
                                      hook.handleDeleteChild(result.value.row.id);
                                      if (selectedLine?.id === result.value.row.id) setSelectedLine(null);
                                      deleted++;
                                    }
                                  }
                                  setSelectedChildRows([]);
                                  if (deleted > 0) toast.success(ui('recordsDeleted', { count: deleted }));
                                  const failed = results.length - deleted;
                                  if (failed > 0) toast.error(ui('recordsCouldNotBeDeleted', { count: failed }));
                                } catch (err) {
                                  toast.error(err.message || ui('networkError'));
                                } finally {
                                  setDeletingChildren(false);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingChildren ? ui('loading') : ui('delete')}
                            </button>
                            <button
                              onClick={() => setSelectedChildRows([])}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent transition-colors text-muted-foreground"
                            >
                              {ui('clear')}
                            </button>
                          </div>
                        </div>
                      )}
                      <DetailTable
                        data={hook.children}
                        entity={detailEntity}
                        token={token}
                        apiBaseUrl={apiBaseUrl}
                        onRowClick={DetailForm ? (row) => setSelectedLine(row) : undefined}
                        selectedRowId={selectedLine?.id}
                        onSelectionChange={setSelectedChildRows}
                        showFooterTotals={showDetailFooterTotals ?? !summary.some(f => f.type === 'amount')}
                        selectorContext={selectorContextByEntity[detailEntity]}
                        onDeleteRow={(api?.crud?.[detailEntity]?.delete ?? true) && !isDocumentReadOnly ? async (row) => {
                          if (!window.confirm(ui('deleteConfirmMessage'))) return;
                          try {
                            const childUrl = api?.crud?.[detailEntity]?.detailUrl?.replace('{id}', row.id)
                              || `${apiBaseUrl}/${detailEntity}/${row.id}`;
                            const res = await fetch(childUrl, {
                              method: 'DELETE',
                              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            });
                            if (res.ok) {
                              hook.handleDeleteChild(row.id);
                              if (selectedLine?.id === row.id) setSelectedLine(null);
                              toast.success(ui('recordDeleted'));
                            } else {
                              toast.error(await extractErrorMessage(res));
                            }
                          } catch (err) {
                            toast.error(err.message || ui('networkError'));
                          }
                        } : undefined}
                        addRow={{
                          active: addingLine,
                          fields: allEntryFields,
                          onAdd: async (lineData) => {
                            // Send all values: entry fields + callout-derived values (tax, prices, uOM, etc.).
                            // handleAddChild filters out internal keys (_identifier, _aux, CURSOR_FIELD, etc.)
                            // Also include hidden entry defaults (e.g., fields with predefined values).
                            for (const hiddenField of hiddenEntryDefaults) {
                              if (!(hiddenField.key in lineData)) {
                                lineData[hiddenField.key] = hiddenField.fromParent
                                  ? _headerData?.[hiddenField.fromParent]
                                  : hiddenField.value;
                              }
                            }
                            // Always recompute lineNetAmount = qty × unitPrice before POST.
                            {
                              const qty   = parseFloat(String(lineData.invoicedQuantity ?? '')) || 0;
                              const price = parseFloat(String(lineData.unitPrice        ?? '')) || 0;
                              if (qty > 0 && price > 0) lineData.lineNetAmount = qty * price;
                            }
                            // Compute grossAmount if not already set correctly (0 counts as not set).
                            if (!lineData.grossAmount || Number(lineData.grossAmount) === 0) {
                              const qty     = parseFloat(String(lineData.invoicedQuantity ?? '')) || 0;
                              const price   = parseFloat(String(lineData.unitPrice        ?? '')) || 0;
                              const taxId   = lineData.tax;
                              const lineNet = qty > 0 && price > 0 ? qty * price : 0;
                              if (lineNet > 0 && taxId) {
                                let taxFactor = null;
                                // 1. Tax rate from selector aux (tax_rate stored by handleFieldChange).
                                const txRate = parseFloat(String(lineData['tax_rate'] ?? ''));
                                if (!isNaN(txRate) && txRate >= 0) taxFactor = 1 + txRate / 100;
                                // 2. From existing saved lines with same tax.
                                if (taxFactor === null) {
                                  const ref = (hook.children || []).find(l =>
                                    l.tax === taxId &&
                                    parseFloat(String(l.grossAmount ?? '')) > 0 &&
                                    parseFloat(String(l.lineNetAmount ?? '')) > 0
                                  );
                                  if (ref) taxFactor = parseFloat(String(ref.grossAmount)) / parseFloat(String(ref.lineNetAmount));
                                }
                                if (taxFactor !== null) {
                                  lineData.grossAmount = parseFloat((lineNet * taxFactor).toFixed(2));
                                }
                              }
                            }
                            return hook.handleAddChild?.(lineData);
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
                              {savingChild ? ui('loading') : ui('save')}
                            </button>
                            <button
                              onClick={() => setEditingChild(null)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                            >
                              {ui('cancel')}
                            </button>
                            <button
                              disabled={savingChild}
                              onClick={async () => {
                                if (!window.confirm(ui('deleteConfirmMessage'))) return;
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
                              {ui('delete')}
                            </button>
                          </div>
                        </div>
                      )}

                      {hook.editing && !isDocumentReadOnly && (allEntryFields.length > 0 || DetailExtraActions) && canAddLines && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '0.5px solid var(--color-border-tertiary, #e5e7eb)', padding: '10px 16px' }}>
                          {allEntryFields.length > 0 && (
                            <AddLineButton
                              onClick={handleAddLineClick}
                              label={ui('addLine')}
                            />
                          )}
                          {DetailExtraActions && (
                            <DetailExtraActions data={data} recordId={data?.id || recordId} token={token} apiBaseUrl={apiBaseUrl} onRefresh={() => hook.fetchChildren?.(data?.id || recordId)} />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right sidebar: line detail form */}
                    {DetailForm && (selectedLine || isClosingLine) && (
                      <div className={`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden ${isClosingLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">{ui('entityDetail', { label: tMenu(detailLabel || 'Line') })}</span>
                          <button
                            onClick={closeLine}
                            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <DetailForm
                          data={lineEdits ?? selectedLine}
                          readOnly={!hook.editing || isProcessed}
                          onChange={(key, val, column) => {
                            setLineEdits(prev => ({ ...(prev ?? selectedLine), [key]: val }));
                            if (column) setLineEditColumns(prev => ({ ...prev, [key]: column }));
                            handleLineFieldChange(
                              key, val,
                              { ...(lineEdits ?? selectedLine ?? {}), [key]: val },
                              (updates) => setLineEdits(prev => ({ ...(prev ?? selectedLine), ...updates })),
                            );
                          }}
                                entity={detailEntity}
                                catalogs={catalogs}
                                token={token}
                                apiBaseUrl={apiBaseUrl}
                                selectorContext={selectorContextByEntity[detailEntity]}
                                labelOverrides={labelOverrides}
                              />
                        {hook.editing && (lineEdits || selectedLine?.id) && (
                          <div className="flex gap-2 mt-4">
                            {lineEdits && !isDocumentReadOnly && (
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
                                        // NEO Headless PATCH expects camelCase API keys, not DB column names.
                                        // Always use k (the API key) as the field name.
                                        // Convert numeric strings to numbers for BigDecimal compatibility.
                                        // Only strip when the value is already in standard format (no commas).
                                        // Comma removal is skipped to avoid locale corruption (e.g. Spanish "10,50" = 10.5).
                                        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                                          fieldValues[k] = parseFloat(v);
                                        } else {
                                          fieldValues[k] = v;
                                        }
                                      }
                                      const res = await fetch(childUrl, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                        body: JSON.stringify(fieldValues),
                                      });
                                      if (res.ok) {
                                        setLineEdits(null);
                                        setLineEditColumns({});
                                        toast.success('Record saved');
                                        // Always refresh from persisted record — backend may recompute
                                        // derived fields (lineNetAmount, discounts) on save.
                                        try {
                                          const freshRes = await fetch(childUrl, {
                                            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                          });
                                          if (freshRes.ok) {
                                            const freshJson = await freshRes.json();
                                            const freshLine = freshJson?.response?.data?.[0] ?? freshJson;
                                            if (freshLine?.id) {
                                              hook.handleUpdateChild(selectedLine.id, freshLine);
                                              setSelectedLine(prev => ({ ...prev, ...freshLine }));
                                            }
                                          } else {
                                            hook.handleUpdateChild(selectedLine.id, fieldValues);
                                            setSelectedLine(prev => ({ ...prev, ...fieldValues }));
                                          }
                                        } catch (_) {
                                          hook.handleUpdateChild(selectedLine.id, fieldValues);
                                          setSelectedLine(prev => ({ ...prev, ...fieldValues }));
                                        }
                                      } else {
                                        toast.error(await extractErrorMessage(res));
                                      }
                                    } catch (err) {
                                      toast.error(err.message || 'Network error');
                                    } finally { setSavingLine(false); }
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {savingLine ? ui('loading') : ui('save')}
                                </button>
                                <button
                                  onClick={() => setLineEdits(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                                >
                                  {ui('discard')}
                                </button>
                              </>
                            )}
                            {(api?.crud?.[detailEntity]?.delete ?? true) && selectedLine?.id && !isDocumentReadOnly && (
                              <button
                                disabled={savingLine}
                                onClick={async () => {
                                  if (!window.confirm(ui('deleteConfirmMessage'))) return;
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
                                {ui('delete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )
                )}

                {/* Tab content: CustomLines (replaces standard lines table) */}
                {tabs[activeTab]?.key === 'customLines' && CustomLines && (
                  <div className={`pt-3${embedded ? ' pointer-events-none' : ''}`}>
                    <CustomLines
                      recordId={data?.id || recordId}
                      data={data}
                      status={data?.[statusField]}
                      token={token}
                      apiBaseUrl={apiBaseUrl}
                      api={api}
                      editing={hook.editing}
                      onRefresh={() => hook.fetchChildren?.(data?.id || recordId)}
                    />
                  </div>
                )}

                {/* Tab content: secondary child entity tabs (or form-only tabs) */}
                {secondaryTabs.map((st, stIdx) => tabs[activeTab]?.key === st.key && (
                  <div key={st.key} className={`pt-3 flex flex-col gap-3${embedded ? ' pointer-events-none' : ''}`}>
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
                          labelOverrides={labelOverrides}
                        />
                      </div>
                    ) : st.Panel ? (
                      <div className="flex-1 min-w-0">
                        <st.Panel
                          parentId={data?.id}
                          token={token}
                          apiBaseUrl={apiBaseUrl}
                          onCount={(n) => setPanelCounts(prev => ({ ...prev, [st.key]: n }))}
                        />
                      </div>
                    ) : (
                    <>
                    <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <st.Table
                        data={secondaryHooks[stIdx]?.children ?? []}
                        entity={st.key}
                        selectorContext={selectorContextByEntity[st.key]}
                        onRowClick={st.customAddModal
                          ? (row) => setCustomModalState({ key: st.key, rowId: row.id })
                          : st.Form
                            ? (row) => { setSelectedSecondaryLine({ ...row, _tabKey: st.key }); setSecondaryLineEdits(null); }
                            : undefined}
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
                    </div>
                    {st.Form && !st.Panel && (selectedSecondaryLine?._tabKey === st.key || isClosingSecondaryLine) && (
                      <div className={`w-[48rem] shrink-0 border-l border-border pl-4 self-stretch overflow-hidden ${isClosingSecondaryLine ? 'sidebar-slide-out' : 'sidebar-slide-in'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">{ui('entityDetail', { label: tMenu(st.label) })}</span>
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
                          excludeFields={st.key === 'contact' ? ['active'] : []}
                          labelOverrides={labelOverrides}
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
                                        // NEO Headless PATCH expects camelCase API keys, not DB column names.
                                        // Always use k (the API key) as the field name.
                                        // Convert numeric strings to numbers for BigDecimal compatibility.
                                        // Only strip when the value is already in standard format (no commas).
                                        // Comma removal is skipped to avoid locale corruption (e.g. Spanish "10,50" = 10.5).
                                        if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) {
                                          fieldValues[k] = parseFloat(v);
                                        } else {
                                          fieldValues[k] = v;
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
                                  {savingSecondaryLine ? ui('loading') : ui('save')}
                                </button>
                                <button
                                  onClick={() => setSecondaryLineEdits(null)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-accent"
                                >
                                  {ui('discard')}
                                </button>
                              </>
                            )}
                            {(api?.crud?.[st.key]?.delete ?? true) && selectedSecondaryLine?.id && (
                              <button
                                disabled={savingSecondaryLine}
                                onClick={() => setSecondaryDeleteConfirm({
                                  tabKey: st.key,
                                  tabIndex: stIdx,
                                  id: selectedSecondaryLine.id,
                                })}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 ml-auto"
                              >
                                <Trash2 className="h-4 w-4" />
                                {ui('delete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                    {(st.addLineFields?.entry?.length > 0 || st.customAddModal) && hook.editing && (
                      <AddLineButton
                        onClick={() => {
                          if (st.customAddModal) {
                            setCustomModalState({ key: st.key, rowId: null });
                          } else {
                            void handleSecondaryAddLineToggle(st.key);
                          }
                        }}
                        label={ui('addEntity', { label: tMenu(st.label) })}
                      />
                    )}
                    </>
                    )}
                    </div>
                ))}

                {/* Tab content: Others (secondary header fields) */}
                {tabs[activeTab]?.key === 'others' && (
                  <div className={`pt-5${embedded ? ' pointer-events-none' : ''}`}>
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
                      selectorContext={selectorContextByEntity[entity]}
                      labelOverrides={labelOverrides}
                    />
                  </div>
                )}

              </div>
            )}

            {/* Hidden probe: detect if Others form has content (outside tabs block so it fires even when tabs is empty) */}
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

            {/* Bottom section: custom (two-column) or default (totals + footer) */}
            {bottomSection ? (() => {
              const BottomComponent = bottomSection;
              return (
                <BottomComponent
                  recordId={data?.id || recordId}
                  data={data}
                  token={token}
                  apiBaseUrl={apiBaseUrl}
                  api={api}
                  summary={summary}
                  notesField={notesField}
                  onFieldChange={handleChangeWithCallout}
                  notesFocused={notesFocused}
                  setNotesFocused={setNotesFocused}
                />
              );
            })() : (
              <>
                {/* Totals block: Subtotal / Tax / Total */}
                {(() => {
                  const subtotalField = summary.find(f => f.type === 'amount' && (f.key.toLowerCase().includes('summed') || f.key.toLowerCase().includes('totallines') || f.key.toLowerCase().includes('lineamount')));
                  const totalField = summary.find(f => f.type === 'amount' && (f.key.toLowerCase().includes('grand') || (f.key.toLowerCase().includes('total') && !f.key.toLowerCase().includes('line'))));
                  if (!subtotalField && !totalField) return null;
                  const subtotal = subtotalField ? data[subtotalField.key] : null;
                  const total = totalField ? data[totalField.key] : null;
                  const taxes = (subtotal != null && total != null) ? total - subtotal : null;
                  const currency = data['currency$_identifier'];
                  return (
                    <div className="mt-1 flex justify-end">
                      <div className="w-64 text-sm" style={{ borderTopWidth: '0.5px' }}>
                        {subtotal != null && (
                          <div className="flex justify-between py-1.5 px-2">
                            <span className="text-muted-foreground">{ui('subtotal')}</span>
                            <span className="tabular-nums">{formatAmount(subtotal, currency)}</span>
                          </div>
                        )}
                        {taxes != null && taxes !== 0 && (
                          <div className="flex justify-between py-1.5 px-2">
                            <span className="text-muted-foreground">{ui('tax')}</span>
                            <span className="tabular-nums">{formatAmount(taxes, currency)}</span>
                          </div>
                        )}
                        {total != null && (
                          <div className="flex justify-between py-1.5 px-2 border-t border-border/40 font-semibold" style={{ borderTopWidth: '0.5px' }}>
                            <span>{ui('total')}</span>
                            <span className="tabular-nums">{formatAmount(total, currency)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* After-totals slot (e.g. payment footer) */}
                {afterTotals && (() => {
                  const AfterTotalsComponent = afterTotals;
                  return <AfterTotalsComponent recordId={data?.id || recordId} data={data} token={token} apiBaseUrl={apiBaseUrl} api={api} />;
                })()}

                {/* Footer: Related Docs + Notes */}
                {(customTabs.length > 0 || !!notesField) && (
                  <div className="mt-1 bg-muted/20 border-t border-border/40" style={{ borderTopWidth: '0.5px' }}>
                    {customTabs.length > 0 && (
                      <div className={`flex items-start gap-3 px-4 py-2.5 border-b border-border/30${embedded ? ' pointer-events-none' : ''}`} style={{ borderBottomWidth: '0.5px' }}>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-0.5 shrink-0 w-24">{ui('docs')}</span>
                        <div className="flex-1">
                          {customTabs.map(ct => {
                            const TabComponent = ct.Component;
                            return (
                              <TabComponent
                                key={ct.key}
                                recordId={data?.id || recordId}
                                data={data}
                                token={token}
                                apiBaseUrl={apiBaseUrl}
                                api={api}
                                layout="chips"
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {notesField && (
                      <div className={`flex items-start gap-3 px-4 py-2.5${embedded ? ' pointer-events-none' : ''}`}>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1.5 shrink-0 w-24">{ui('notes')}</span>
                        <div className={`flex-1 flex flex-col border border-border/40 rounded bg-white transition-all py-1.5`} style={{ borderWidth: '0.5px' }}>
                          {notesFocused ? (
                            <textarea
                              value={data[notesField] || ''}
                              onChange={(e) => handleChangeWithCallout(notesField, e.target.value)}
                              onBlur={() => setNotesFocused(false)}
                              placeholder={ui('description')}
                              rows={3}
                              autoFocus
                              className="w-full text-xs bg-transparent px-2 py-0.5 resize-none focus:outline-none placeholder:text-muted-foreground/40"
                            />
                          ) : (
                            <div
                              tabIndex={0}
                              role="textbox"
                              onClick={() => setNotesFocused(true)}
                              onFocus={() => setNotesFocused(true)}
                              className="w-full text-xs px-2 py-0.5 cursor-text min-h-[1.5rem] whitespace-pre-wrap break-words text-foreground/80"
                            >
                              {data[notesField] || <span className="text-muted-foreground/40">{ui('description')}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {sidePanel && (
            <div
              className="w-[280px] shrink-0 self-stretch pl-0 pr-3"
              style={sidePanelStyle}
            >
              {typeof sidePanel === 'function'
                ? React.createElement(sidePanel, { recordId: data?.id || recordId, data, token, apiBaseUrl, api })
                : sidePanel}
            </div>
          )}
          </div>
        </div>
        {sidebarContent && (
          <div className="w-96 shrink-0 overflow-y-auto pt-0 pl-0 pr-4 pb-5">
            {typeof sidebarContent === 'function' ? sidebarContent(data) : sidebarContent}
          </div>
        )}
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
            <DialogTitle>{ui('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {ui('deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">{ui('cancel')}</Button>
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
              {ui('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(secondaryDeleteConfirm)} onOpenChange={(open) => { if (!open) setSecondaryDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {ui('deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">{ui('cancel')}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!secondaryDeleteConfirm) return;
                setSavingSecondaryLine(true);
                try {
                  const secUrl = `${apiBaseUrl}/${secondaryDeleteConfirm.tabKey}/${secondaryDeleteConfirm.id}`;
                  const res = await fetch(secUrl, {
                    method: 'DELETE',
                    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                  });
                  if (res.ok) {
                    secondaryHooks[secondaryDeleteConfirm.tabIndex]?.handleDeleteChild(secondaryDeleteConfirm.id);
                    toast.success('Record deleted');
                    setSecondaryDeleteConfirm(null);
                    closeSecondaryLine();
                  } else {
                    toast.error(await extractErrorMessage(res));
                  }
                } catch (err) {
                  toast.error(err.message || 'Network error');
                } finally {
                  setSavingSecondaryLine(false);
                }
              }}
            >
              {ui('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {secondaryTabs.map((st, idx) => {
        if (!st.customAddModal) return null;
        const CustomModal = st.customAddModal;
        return (
          <CustomModal
            key={st.key}
            open={customModalState.key === st.key}
            onClose={() => setCustomModalState({ key: null, rowId: null })}
            onSaved={() => {
              secondaryHooks[idx]?.handleSelect(hook.selected ?? hook.editing);
              setCustomModalState({ key: null, rowId: null });
            }}
            rowId={customModalState.key === st.key ? customModalState.rowId : null}
            bpId={parentRecordId}
            apiBase={apiBaseUrl}
            token={token}
            selectorContext={selectorContextByEntity[st.key] ?? {}}
          />
        );
      })}
    </div>
  );
}
