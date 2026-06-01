import React, { useEffect, useState, useCallback } from 'react';
import { ChevronRight, Box, Plus, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useUI, useLabel } from '@/i18n';
import { EntityForm } from '@/components/contract-ui';
import SelectorInput from '@/components/contract-ui/SelectorInput';
import { AddLineButton } from '@/components/ui/add-line-button';

// ── field definitions ────────────────────────────────────────────────
const CORE_FIELDS = [
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector', required: true, readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', readOnlyLogic: (r) => r['processed'] === 'Y' },
  { key: 'amortizationAmount', column: 'Amortizationamt', type: 'number', required: true, readOnlyLogic: (r) => r['processed'] === 'Y' },
];

const DIMENSION_FIELDS = [
  { key: 'project', column: 'C_Project_ID', type: 'selector', reference: 'Project', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y', hidden: true },
  { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'Costcenter', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'eTADASBpartner', column: 'EM_Etadas_C_Bpartner_ID', type: 'selector', reference: 'BPartner', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'User1', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'User2', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'eTADASSalesRegion', column: 'EM_Etadas_Salesregion_ID', type: 'selector', reference: 'SalesRegion', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'eTADASActivity', column: 'EM_Etadas_C_Activity_ID', type: 'selector', reference: 'Activity', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
  { key: 'eTADASSalesCampaign', column: 'EM_Etadas_Campaign_ID', type: 'selector', reference: 'Campaign', inputMode: 'selector', readOnlyLogic: (r) => r['posted'] === 'Y' },
];

const VISIBLE_DIMENSION_FIELDS = DIMENSION_FIELDS.filter(f => !f.hidden);
const DIM_KEYS = VISIBLE_DIMENSION_FIELDS.map(f => f.key);
const TOTAL_DIMS = VISIBLE_DIMENSION_FIELDS.length;

const DIM_SHORT_LABEL = {
  project: 'Proy.',
  costcenter: 'CC',
  eTADASBpartner: 'Tercero',
  stDimension: 'Dim. 1ª',
  ndDimension: 'Dim. 2ª',
  eTADASSalesRegion: 'Región',
  eTADASActivity: 'Act.',
  eTADASSalesCampaign: 'Camp.',
};

// ── DimensionGrid ────────────────────────────────────────────────────
// Renders DIMENSION_FIELDS directly via SelectorInput so we can control
// the placeholder (empty resolvedLabel → "Seleccionar..." / "Select...").
function DimensionGrid({ fields, data, onChange, onFieldSave, apiBaseUrl, token, catalogs, readOnly }) {
  const t = useLabel();
  return (
    <div
      className="[&_button[role=combobox]]:!bg-white [&_input]:!bg-white [&_input:disabled]:!opacity-100"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}
    >
      {fields.filter(f => !f.hidden).map(f => {
        const label = t(f.column) ?? f.label ?? f.key;
        const value = data?.[f.key] ?? '';
        const displayValue = data?.[`${f.key}$_identifier`] ?? '';
        const selectorUrl = apiBaseUrl ? `${apiBaseUrl}/lines/selectors/${f.column}` : null;
        return (
          <div key={f.key} className="space-y-1.5">
            <label className="text-sm text-foreground font-medium block">{label}</label>
            {readOnly ? (
              <input
                className="flex h-10 w-full rounded-lg border border-[#D1D4DB] bg-white p-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                value={displayValue || value || ''}
                disabled
                readOnly
              />
            ) : (
              <SelectorInput
                entityName="lines"
                field={f}
                value={value}
                displayValue={displayValue}
                onChange={(val, lbl) => {
                  onChange(f.key, val);
                  onChange(`${f.key}$_identifier`, lbl ?? '');
                  onFieldSave?.(f.key, val);
                }}
                catalogs={catalogs}
                resolvedLabel=""
                selectorUrl={selectorUrl}
                token={token}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getIdentifier(line, key) {
  return line[`${key}$_identifier`] ?? (typeof line[key] === 'string' ? line[key] : null) ?? null;
}

function countFilled(line) {
  return DIM_KEYS.filter(k => line[k] != null && line[k] !== '').length;
}

function DimSummary({ line, onClick }) {
  const ui = useUI();
  const filled = DIM_KEYS.map(k => ({ key: k, value: getIdentifier(line, k) })).filter(d => d.value);
  const n = filled.length;

  if (n === 0) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
      >
        <Plus className="h-3 w-3" />
        {ui('amortizationDimensionsEmpty')}
      </button>
    );
  }

  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer max-w-full">
      {filled.slice(0, 2).map(d => (
        <span key={d.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border/40 text-xs font-medium text-foreground whitespace-nowrap">
          <span className="text-muted-foreground">{DIM_SHORT_LABEL[d.key]}</span>
          {d.value}
        </span>
      ))}
      {n > 2 && (
        <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-xs font-semibold text-primary">+{n - 2}</span>
      )}
      <span className="text-xs text-muted-foreground ml-0.5">{n}/{TOTAL_DIMS}</span>
    </button>
  );
}

// ── main component ──────────────────────────────────────────────────
export default function AmortizationLinesTable({
  recordId: recordIdProp,
  data,
  token,
  apiBaseUrl,
  api,
  editing,
  catalogs,
  onCountChange,
}) {
  const ui = useUI();
  const t = useLabel(api?.labelOverrides);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingLineId, setEditingLineId] = useState(null);
  const [pendingEdits, setPendingEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({});
  const recordId = recordIdProp ?? data?.id;

  const fetchLines = useCallback(() => {
    if (!recordId || !apiBaseUrl) return;
    setLoading(true);
    fetch(`${apiBaseUrl}/lines?parentId=${recordId}&_startRow=0&_endRow=500&_sortBy=sEQNoAsset+asc`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const rows = json?.response?.data ?? json?.data ?? json?.rows ?? [];
        const normalized = Array.isArray(rows) ? rows : [];
        setLines(normalized);
        onCountChange?.(normalized.length);
      })
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [recordId, apiBaseUrl, token]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  useEffect(() => {
    if (!recordId) return undefined;
    function onProcess(e) {
      if (String(e?.detail?.recordId) !== String(recordId)) return;
      fetchLines();
    }
    window.addEventListener('neo:processSuccess', onProcess);
    return () => window.removeEventListener('neo:processSuccess', onProcess);
  }, [recordId, fetchLines]);

  function handleChange(lineId, key, value) {
    setPendingEdits(prev => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), [key]: value } }));
  }

  // Per-field save on blur (like Sales Order inline editing)
  async function saveField(lineId, line, fieldKey, value) {
    if (String(line[fieldKey] ?? '') === String(value ?? '')) return;
    try {
      const res = await fetch(`${apiBaseUrl}/lines/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [fieldKey]: value }),
      });
      if (res.ok) fetchLines();
    } catch { /* silencioso */ }
  }

  // Close edit mode when clicking outside the editing row
  useEffect(() => {
    if (!editingLineId) return undefined;
    function handler(e) {
      const row = document.querySelector(`[data-row-id="${editingLineId}"]`);
      if (!row || row.contains(e.target)) return;
      const portals = ['[data-radix-popper-content-wrapper]', '[role="listbox"]'];
      for (const sel of portals) {
        if (e.target.closest?.(sel)) return;
      }
      setTimeout(() => setEditingLineId(null), 0);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingLineId]);

  async function deleteLine(lineId) {
    setDeleting(lineId);
    try {
      const res = await fetch(`${apiBaseUrl}/lines/${lineId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchLines();
    } finally { setDeleting(null); }
  }

  async function addLine() {
    if (!newLine.asset) return;
    setSaving('new');
    try {
      const res = await fetch(`${apiBaseUrl}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...newLine, amortization: recordId }),
      });
      if (res.ok) { setAddingLine(false); setNewLine({}); fetchLines(); }
    } finally { setSaving(null); }
  }

  const processed = data?.processed === 'Y' || data?.processed === true;
  const isReadOnly = !editing || processed;

  return (
    <div className="flex-1 min-w-0">
      <table className="w-full">
        {/* header — matches inlineEditable: sticky top-0 z-20 bg-white */}
        <thead className="sticky top-0 z-20 bg-white">
          <tr className="border-b border-border/40">
            <th className="h-10 w-8 px-2 align-middle" />
            <th className="h-10 px-3 text-left align-middle text-xs leading-4 font-semibold text-text-primary tracking-normal">
              {t('A_Asset_ID')}
            </th>
            <th className="h-10 w-36 px-3 text-right align-middle text-xs leading-4 font-semibold text-text-primary tracking-normal">
              {t('Amortization_Percentage')}
            </th>
            <th className="h-10 w-36 px-3 text-right align-middle text-xs leading-4 font-semibold text-text-primary tracking-normal">
              {t('Amortizationamt')}
            </th>
            <th className="h-10 w-72 px-3 text-left align-middle text-xs leading-4 font-semibold text-text-primary tracking-normal">
              {ui('amortizationDimensionsTitle')}
            </th>
            <th className="h-10 w-20 px-2" />
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-1.5" />
              </td>
            </tr>
          ) : (
            <>
              {lines.map(line => {
                const isExpanded = expandedId === line.id;
                const isEditing = editingLineId === line.id;
                const edits = pendingEdits[line.id] ?? {};
                const lineData = { ...line, ...edits };

                return (
                  <React.Fragment key={line.id}>
                    {/* ── data row ── */}
                    <tr
                      data-row-id={line.id}
                      className={`relative transition-colors h-12 group/row border-b border-border/30 ${isExpanded ? 'bg-primary/5 cursor-pointer' : 'hover:bg-muted/50 cursor-pointer'}`}
                      onClick={() => !isEditing && setExpandedId(isExpanded ? null : line.id)}
                    >
                      {/* chevron */}
                      <td className="px-2 text-center align-middle">
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                      </td>

                      {/* asset */}
                      {isEditing ? (
                        <td className="py-1 px-2 align-middle" onClick={e => e.stopPropagation()}>
                          <SelectorInput
                            entityName="lines"
                            field={CORE_FIELDS[0]}
                            value={lineData.asset ?? ''}
                            displayValue={lineData['asset$_identifier'] ?? ''}
                            onChange={(val, lbl) => {
                              handleChange(line.id, 'asset', val);
                              handleChange(line.id, 'asset$_identifier', lbl ?? '');
                              saveField(line.id, line, 'asset', val);
                            }}
                            catalogs={catalogs}
                            resolvedLabel=""
                            selectorUrl={`${apiBaseUrl}/lines/selectors/A_Asset_ID`}
                            token={token}
                            compact
                          />
                        </td>
                      ) : (
                        <td className="px-3 text-sm font-medium text-foreground align-middle truncate max-w-0">
                          {line['asset$_identifier'] ?? line.asset ?? '—'}
                        </td>
                      )}

                      {/* percentage */}
                      {isEditing ? (
                        <td className="py-1 px-2 align-middle" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            className="h-8 w-full rounded-lg border border-[#D1D4DB] bg-white px-2 text-sm text-right tabular-nums"
                            defaultValue={line.amortizationPercentage ?? ''}
                            onBlur={e => saveField(line.id, line, 'amortizationPercentage', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } else if (e.key === 'Escape') { setEditingLineId(null); } }}
                          />
                        </td>
                      ) : (
                        <td className="px-3 text-sm text-right tabular-nums text-muted-foreground align-middle">
                          {line.amortizationPercentage != null ? Number(line.amortizationPercentage).toFixed(2) : '—'}
                        </td>
                      )}

                      {/* amount */}
                      {isEditing ? (
                        <td className="py-1 px-2 align-middle" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            className="h-8 w-full rounded-lg border border-[#D1D4DB] bg-white px-2 text-sm text-right tabular-nums"
                            defaultValue={line.amortizationAmount ?? ''}
                            onBlur={e => saveField(line.id, line, 'amortizationAmount', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } else if (e.key === 'Escape') { setEditingLineId(null); } }}
                          />
                        </td>
                      ) : (
                        <td className="px-3 text-sm text-right tabular-nums font-semibold text-foreground align-middle">
                          {line.amortizationAmount != null
                            ? `${Number(line.amortizationAmount).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${line['currency$_identifier'] ?? ''}`
                            : '—'}
                        </td>
                      )}

                      {/* dimension summary */}
                      <td className="px-3 align-middle" onClick={e => e.stopPropagation()}>
                        <DimSummary line={line} onClick={() => setExpandedId(isExpanded ? null : line.id)} />
                      </td>

                      {/* quick actions — always pencil + trash on hover */}
                      <td className="relative px-2 align-middle" onClick={e => e.stopPropagation()}>
                        {!isReadOnly && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity z-10">
                            <button
                              onClick={() => setEditingLineId(isEditing ? null : line.id)}
                              className={`h-8 w-8 p-0 flex items-center justify-center rounded-full transition-colors ${isEditing ? 'text-primary hover:bg-primary/10' : 'text-[#828FA3] hover:text-foreground hover:bg-muted/60'}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteLine(line.id)}
                              disabled={deleting === line.id}
                              className="h-8 w-8 p-0 flex items-center justify-center rounded-full text-[#D50B3E] hover:text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              {deleting === line.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ── dimension expand ── */}
                    {isExpanded && (
                      <tr className="border-b border-border/30">
                        <td colSpan={6} className="bg-primary/5 px-10 pb-5 pt-3">
                          <div className="flex items-center gap-2 mb-4">
                            <Box className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{ui('amortizationDimensionsTitle')}</span>
                            <div className="flex-1 h-px bg-border/40" />
                            <span className="text-xs text-muted-foreground">
                              {ui('amortizationDimensionsFilled').replace('{n}', String(countFilled(lineData)))}
                            </span>
                          </div>
                          {line['organization$_identifier'] && (
                            <div className="mb-4 grid grid-cols-4 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">{ui('organization')} *</label>
                                <div className="h-10 flex items-center px-3 rounded-lg border border-[#D1D4DB] bg-white text-sm text-foreground">{line['organization$_identifier']}</div>
                              </div>
                            </div>
                          )}
                          <DimensionGrid
                            fields={DIMENSION_FIELDS} data={lineData}
                            onChange={(k, v) => handleChange(line.id, k, v)}
                            onFieldSave={(k, v) => saveField(line.id, line, k, v)}
                            apiBaseUrl={apiBaseUrl} token={token} catalogs={catalogs} readOnly={isReadOnly} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* ── add line form row ── */}
              {addingLine && (
                <tr className="border-b border-border/30">
                  <td colSpan={6} className="bg-muted/30 px-8 py-4">
                    <EntityForm entity="lines" fields={CORE_FIELDS} data={newLine}
                      onChange={(k, v) => setNewLine(p => ({ ...p, [k]: v }))}
                      catalogs={catalogs} api={api} token={token} apiBaseUrl={apiBaseUrl} readOnly={false} cols={3} />
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => { setAddingLine(false); setNewLine({}); }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-white text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />{ui('cancel')}
                      </button>
                      <button
                        onClick={addLine}
                        disabled={!newLine.asset || saving === 'new'}
                        className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-foreground text-background text-xs font-semibold hover:bg-foreground/80 transition-colors disabled:opacity-50"
                      >
                        {saving === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        {ui('addLine')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>

      {/* ── Add line button ── */}
      {!isReadOnly && !addingLine && (
        <div className="px-2 py-2">
          <AddLineButton onClick={() => setAddingLine(true)} disabled={saving === 'new'} label={ui('addLine')} />
        </div>
      )}
    </div>
  );
}
