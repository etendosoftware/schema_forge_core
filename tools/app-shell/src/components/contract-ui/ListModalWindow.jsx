import { useCallback, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog.jsx';
import { useAuth } from '@/auth/AuthContext.jsx';
import { useNeoResource, getApiBase } from '@/hooks/useNeoResource.js';
import { useUI, useMenuLabel } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { translateBackendError } from '@/lib/backendErrors.js';
import { toast } from 'sonner';
import { DataTable } from './DataTable.jsx';
import { EntityForm } from './EntityForm.jsx';

/**
 * Generic, contract-driven layout for catalog / master-data windows that present a
 * grid (list) plus a create/edit MODAL, with NO drill-in detail view.
 *
 * It is intentionally backend-agnostic: every behaviour is driven by the props the
 * pipeline emits from `contract.json` (the NEO endpoint via `api`, the grid
 * `columns`, the modal `fields` grouped by `sections`, the searchable `filters`).
 * Any window can opt in with `decisions.json → window.layoutType: "list-modal"`.
 *
 * CRUD follows the generic NEO Headless W convention used by `useEntity`/`DataTable`:
 *   - list   GET    {apiBaseUrl}/{entity}
 *   - create POST   {apiBaseUrl}/{entity}
 *   - update POST   {apiBaseUrl}/{entity}/{id}
 *   - patch  PATCH  {apiBaseUrl}/{entity}/{id}   (inline toggle, handled by DataTable)
 *   - delete DELETE {apiBaseUrl}/{entity}/{id}
 *
 * @param {object}   props
 * @param {string}   props.entity         contract entity name (e.g. "header")
 * @param {string}   props.entityLabel    window/menu label (translated via useMenuLabel)
 * @param {string}   props.windowName
 * @param {string}   [props.breadcrumb]
 * @param {Array}    props.columns        DataTable column descriptors
 * @param {Array}    props.fields         EntityForm field descriptors (grouped by section)
 * @param {Array}    props.sections       ordered [{ key, label? }] for modal grouping
 * @param {string[]} props.filters        column keys used by the local search box
 * @param {object}   props.config         { titleKey, editTitleKey, bannerKey,
 *                                          searchPlaceholderKey, newLabelKey,
 *                                          autoPriorityField, autoPriorityStep }
 * @param {object}   props.api            apiPrediction block (carries baseUrl + selectors)
 */
export function ListModalWindow({
  entity,
  entityLabel,
  breadcrumb,
  columns = [],
  fields = [],
  sections = [],
  filters = [],
  config = {},
  api,
  token: tokenProp,
  apiBaseUrl: apiBaseUrlProp,
}) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const auth = useAuth();
  const token = tokenProp ?? auth?.token;

  const apiBaseUrl = useMemo(
    () => apiBaseUrlProp || (api?.baseUrl ? `${getApiBase()}${api.baseUrl}` : getApiBase()),
    [apiBaseUrlProp, api],
  );

  const label = tMenu(entityLabel) || entityLabel || entity;
  const fullBreadcrumb = breadcrumb
    ? breadcrumb.split(' / ').map(s => tMenu(s.trim())).join(' / ')
    : label;
  useSetPageMeta({ title: label, breadcrumb: fullBreadcrumb });

  // --- List data (generic GET; reload after any mutation) -------------------
  const { data: rows, loading, reload } = useNeoResource({
    path: api?.baseUrl ? `${api.baseUrl}/${entity}` : null,
    mapPayload: (raw) => (Array.isArray(raw) ? raw : (raw?.items ?? raw?.[entity] ?? [])),
    label: `ListModalWindow:${entity}`,
  });
  const allRows = useMemo(() => rows ?? [], [rows]);

  // --- Local search over the configured filter columns ----------------------
  const [searchQuery, setSearchQuery] = useState('');
  const data = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || filters.length === 0) return allRows;
    return allRows.filter(row =>
      filters.some(key => {
        const v = row?.[`${key}$_identifier`] ?? row?.[key];
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [allRows, searchQuery, filters]);

  // --- Create / edit modal --------------------------------------------------
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null); // null = create
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const requiredKeys = useMemo(() => fields.filter(f => f.required).map(f => f.key), [fields]);

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  // Read and translate a backend error message from a failed Response.
  const errorMessage = useCallback(async (res) => {
    let raw = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      raw = json?.error?.message || json?.response?.error?.message || raw;
    } catch { /* non-JSON body */ }
    return translateBackendError(raw, ui) || raw;
  }, [ui]);

  // Suggested value for an auto-incrementing field (e.g. Priority = max + step),
  // computed entirely on the frontend from the loaded list — no backend endpoint.
  const computeAutoValue = useCallback(() => {
    const fieldKey = config?.autoPriorityField;
    if (!fieldKey) return {};
    const step = config?.autoPriorityStep ?? 10;
    const max = allRows.reduce((acc, r) => {
      const v = Number(r?.[fieldKey]);
      return Number.isFinite(v) && v > acc ? v : acc;
    }, 0);
    return { [fieldKey]: max + step };
  }, [config, allRows]);

  const seedDefaults = useCallback(() => {
    const seed = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined) seed[f.key] = f.defaultValue;
    }
    return { ...seed, ...computeAutoValue() };
  }, [fields, computeAutoValue]);

  const openCreate = useCallback(() => {
    setEditingRow(null);
    setFormData(seedDefaults());
    setFormError(null);
    setModalOpen(true);
  }, [seedDefaults]);

  const openEdit = useCallback((row) => {
    setEditingRow(row);
    setFormData({ ...row });
    setFormError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingRow(null);
    setFormData({});
    setFormError(null);
  }, []);

  const handleFieldChange = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (formError) setFormError(null);
  }, [formError]);

  const missingRequired = useMemo(
    () => requiredKeys.filter(k => formData[k] == null || formData[k] === ''),
    [requiredKeys, formData],
  );

  const handleSave = useCallback(async () => {
    if (missingRequired.length > 0) {
      setFormError(ui('requiredFieldsMissing'));
      return;
    }
    setSaving(true);
    setFormError(null);
    // Generic NEO W CRUD: POST {entity} creates, PUT {entity}/{id} updates.
    const url = editingRow
      ? `${apiBaseUrl}/${entity}/${encodeURIComponent(editingRow.id)}`
      : `${apiBaseUrl}/${entity}`;
    try {
      const res = await fetch(url, {
        method: editingRow ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        setFormError(await errorMessage(res));
        return;
      }
      closeModal();
      reload();
    } catch (e) {
      setFormError(e?.message || ui('genericError'));
    } finally {
      setSaving(false);
    }
  }, [missingRequired, editingRow, apiBaseUrl, entity, formData, authHeaders, ui, closeModal, reload, errorMessage]);

  const handleDelete = useCallback(async (row) => {
    try {
      const res = await fetch(`${apiBaseUrl}/${entity}/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res));
        return;
      }
      reload();
    } catch (e) {
      toast.error(e?.message || ui('genericError'));
    }
  }, [apiBaseUrl, entity, authHeaders, ui, reload, errorMessage]);

  const title = editingRow
    ? (config?.editTitleKey ? ui(config.editTitleKey) : ui('edit'))
    : (config?.titleKey ? ui(config.titleKey) : ui('createRecord'));

  return (
    <div className="flex flex-col gap-3 px-1">
      {/* Toolbar: search + New */}
      <div className="flex h-10 items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={config?.searchPlaceholderKey ? ui(config.searchPlaceholderKey) : ui('search')}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" />
          {config?.newLabelKey ? ui(config.newLabelKey) : ui('newRecord')}
        </Button>
      </div>

      {/* Optional banner explaining how the rows are evaluated */}
      {config?.bannerKey && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          {ui(config.bannerKey)}
        </div>
      )}

      {/* Grid — inline `toggle` columns PATCH {entity}/{id} natively via onDataMutated */}
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <DataTable
          entity={entity}
          columns={columns}
          filters={filters}
          data={data}
          selectable={false}
          onNavigate={openEdit}
          onDeleteRow={handleDelete}
          onDataMutated={reload}
          token={token}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {/* Create / edit modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : closeModal())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-1">
            {sections.map((sec) => {
              const sectionFields = fields.filter(f => (f.section || 'general') === sec.key);
              if (sectionFields.length === 0) return null;
              const sectionLabel = sec.label ? ui(sec.label) : null;
              return (
                <div key={sec.key} className="flex flex-col gap-2">
                  {sectionLabel && (
                    <h4 className="text-sm font-semibold text-gray-700">{sectionLabel}</h4>
                  )}
                  <EntityForm
                    entity={entity}
                    fields={sectionFields}
                    data={formData}
                    onChange={handleFieldChange}
                    api={api}
                    token={token}
                    apiBaseUrl={apiBaseUrl}
                    layout="horizontal"
                  />
                </div>
              );
            })}

            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <X size={16} className="mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              {ui('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? ui('saving') : ui('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ListModalWindow;
