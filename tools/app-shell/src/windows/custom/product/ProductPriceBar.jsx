import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCatalogOptions } from '@/lib/selectorCatalog.js';
import { useUI } from '@schema-forge/app-shell-core';
import { useCurrency } from '@schema-forge/app-shell-core';
import { formatCurrency } from '@/lib/formatCurrency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (['true', 'y', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'n', 'no', '0'].includes(normalized)) return false;
  return null;
}

function getSalesFlagFromOption(option) {
  if (!option || typeof option !== 'object') return null;
  for (const [key, value] of Object.entries(option)) {
    if (!key.toLowerCase().includes('salespricelist')) continue;
    const parsed = parseBoolean(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function getSalesFlagFromRow(row) {
  return parseBoolean(row?.['priceListVersion$salesPriceList']);
}

async function extractErrorMessage(res) {
  try {
    const data = await res.json();
    if (data?.error?.message) return data.error.message;
    if (data?.response?.error?.message) return data.response.error.message;
    if (typeof data?.response?.error === 'string') return data.response.error;
    const validationErrors = data?.response?.errors;
    if (validationErrors && typeof validationErrors === 'object') {
      const messages = Object.entries(validationErrors)
        .map(([field, detail]) => {
          if (typeof detail === 'string') return `${field}: ${detail}`;
          if (detail?.errorMessage) return `${field}: ${detail.errorMessage}`;
          if (detail?.message) return `${field}: ${detail.message}`;
          return null;
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(' | ');
    }
    if (data?.message) return data.message;
  } catch {
    // Ignore non-JSON responses.
  }
  return `Error ${res.status}`;
}

function toFiniteNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractReferenceId(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === 'object') {
    const objectId = value.id ?? value.value ?? value.key ?? null;
    return extractReferenceId(objectId);
  }
  return null;
}

function sanitizeDefaults(defaults) {
  const clean = {};
  if (!defaults || typeof defaults !== 'object') return clean;

  for (const [key, rawValue] of Object.entries(defaults)) {
    if (rawValue == null) continue;
    if (key === 'id') continue;

    if (typeof rawValue === 'object') {
      const refId = extractReferenceId(rawValue);
      if (refId != null) clean[key] = refId;
      continue;
    }

    clean[key] = rawValue;
  }

  return clean;
}

function looksLikeEtendoId(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[0-9]+$/.test(trimmed) || /^[0-9A-Fa-f]{32}$/.test(trimmed);
}

function resolveOptionId(options, candidate) {
  const normalizedCandidate = extractReferenceId(candidate);
  if (!normalizedCandidate) return null;
  if (!Array.isArray(options) || options.length === 0) return null;

  const byId = options.find(opt => extractReferenceId(opt?.id) === normalizedCandidate);
  if (byId) return extractReferenceId(byId.id);

  const byName = options.find(opt => {
    const name = typeof opt?.name === 'string' ? opt.name.trim() : null;
    return name && name === normalizedCandidate;
  });
  if (byName) return extractReferenceId(byName.id);

  if (looksLikeEtendoId(normalizedCandidate)) return null;
  return null;
}

const PRICE_TABLE_TONES = {
  sales: {
    shell: 'border-blue-200 bg-blue-50/70',
    badge: 'bg-blue-100 text-blue-700',
    listPrice: 'text-blue-700',
  },
  purchase: {
    shell: 'border-emerald-200 bg-emerald-50/70',
    badge: 'bg-emerald-100 text-emerald-700',
    listPrice: 'text-emerald-700',
  },
  neutral: {
    shell: 'border-gray-200 bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
    listPrice: 'text-gray-900',
  },
};

function PriceTable({ title, rows, variant = 'neutral' }) {
  const ui = useUI();
  const orgCurrency = useCurrency() ?? 'USD';
  const isEmpty = !rows || rows.length === 0;
  const tone = PRICE_TABLE_TONES[variant] ?? PRICE_TABLE_TONES.neutral;

  return (
    <div className={`rounded-2xl border p-3 ${tone.shell}`}>
      <div className="flex items-center justify-between px-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{title}</span>
          {!isEmpty && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
              {rows.length} {rows.length === 1 ? ui('priceSingleList') : ui('priceMultiList')}
            </span>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-xs text-gray-400">
          {ui('priceNoLists')}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-36" />
              <col className="w-36" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{ui('name')}</th>
                <th className="w-36 text-right px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{ui('priceColUnitPrice')}</th>
                <th className="w-36 text-right px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{ui('priceColListPrice')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const unitPrice = Number(row.standardPrice) || 0;
                const listPrice = Number(row.listPrice) || 0;
                const name = row['priceListVersion$_identifier'] || row['priceList$_identifier'] || 'Unknown';
                return (
                  <tr key={row.id} className={`${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 truncate">{name}</td>
                    <td className="w-36 px-4 py-3 text-sm text-gray-500 text-right">{formatCurrency(orgCurrency, unitPrice)}</td>
                    <td className={`w-36 px-4 py-3 text-sm font-bold text-right ${tone.listPrice}`}>{formatCurrency(orgCurrency, listPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function PricingDialog({
  open,
  onOpenChange,
  priceRows,
  apiBaseUrl,
  token,
  onSaved,
  selectorOptions = [],
  selectorColumn = 'M_PriceList_Version_ID',
  productId,
}) {
  const ui = useUI();
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingSale, setPendingSale] = useState(null);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [stagedAdds, setStagedAdds] = useState([]);
  const [stagedDeletes, setStagedDeletes] = useState([]);
  const [lazyOptions, setLazyOptions] = useState([]);
  const [lazyLoading, setLazyLoading] = useState(false);

  useEffect(() => {
    if (open && Array.isArray(priceRows)) {
      const initial = {};
      for (const row of priceRows) {
        initial[row.id] = {
          standardPrice: String(row.standardPrice ?? ''),
          listPrice: String(row.listPrice ?? ''),
        };
      }
      setDrafts(initial);
      setPendingSale(null);
      setPendingPurchase(null);
      setStagedAdds([]);
      setStagedDeletes([]);
    }
  }, [open, priceRows]);

  // Catalogs are not eagerly loaded (see useCatalogs). Fetch price list version
  // options lazily when the dialog opens so the add-row dropdown is populated.
  useEffect(() => {
    if (!open) return undefined;
    if (Array.isArray(selectorOptions) && selectorOptions.length > 0) return undefined;
    if (!apiBaseUrl || !token) return undefined;

    let aborted = false;
    setLazyLoading(true);
    fetch(`${apiBaseUrl}/price/selectors/${selectorColumn}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(payload => {
        if (aborted) return;
        const options = (payload?.items ?? []).map(item => ({
          id: item.id,
          name: item.label || item.name || item.id,
          ...item,
        }));
        setLazyOptions(options);
      })
      .catch(() => {
        if (!aborted) setLazyOptions([]);
      })
      .finally(() => {
        if (!aborted) setLazyLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [open, selectorOptions, apiBaseUrl, token, selectorColumn]);

  const effectiveSelectorOptions = useMemo(() => (
    Array.isArray(selectorOptions) && selectorOptions.length > 0 ? selectorOptions : lazyOptions
  ), [selectorOptions, lazyOptions]);

  const saleOptions = useMemo(() => {
    if (!Array.isArray(effectiveSelectorOptions) || effectiveSelectorOptions.length === 0) return [];
    const filtered = effectiveSelectorOptions.filter(opt => getSalesFlagFromOption(opt) === true);
    return filtered.length > 0 ? filtered : effectiveSelectorOptions;
  }, [effectiveSelectorOptions]);

  const purchaseOptions = useMemo(() => {
    if (!Array.isArray(effectiveSelectorOptions) || effectiveSelectorOptions.length === 0) return [];
    const filtered = effectiveSelectorOptions.filter(opt => getSalesFlagFromOption(opt) === false);
    return filtered.length > 0 ? filtered : effectiveSelectorOptions;
  }, [effectiveSelectorOptions]);

  const handleAddRow = (pending, clearPending, options, variant) => {
    if (!pending?.plvId) {
      toast.error('Select a price list version first.');
      return;
    }
    const existsInCurrent = (priceRows ?? []).some(row => String(row.priceListVersion) === String(pending.plvId));
    const existsInStaged = stagedAdds.some(row => String(row.priceListVersion) === String(pending.plvId));
    if (existsInCurrent || existsInStaged) {
      toast.error('This price list version is already present.');
      return;
    }

    const selected = options.find(opt => String(extractReferenceId(opt.id)) === String(pending.plvId));
    const label = selected?.name || selected?.label || pending.plvId;
    const isSales = variant === 'sales';

    const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setStagedAdds(prev => ([
      ...prev,
      {
        id: newId,
        isNewRow: true,
        priceListVersion: pending.plvId,
        'priceListVersion$_identifier': label,
        'priceListVersion$salesPriceList': isSales,
        standardPrice: pending.stdPrice || '0',
        listPrice: pending.listPrice || '0',
      },
    ]));
    setDrafts(prev => ({
      ...prev,
      [newId]: {
        standardPrice: String(pending.stdPrice || '0'),
        listPrice: String(pending.listPrice || '0'),
      },
    }));

    clearPending(null);
  };

  const handleDeleteRow = (rowId) => {
    if (String(rowId).startsWith('new-')) {
      setStagedAdds(prev => prev.filter(row => row.id !== rowId));
      setDrafts(prev => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
      return;
    }
    setStagedDeletes(prev => (prev.includes(rowId) ? prev : [...prev, rowId]));
  };

  const effectiveRows = useMemo(() => {
    const baseRows = (priceRows ?? []).filter(row => !stagedDeletes.includes(row.id));
    return [...baseRows, ...stagedAdds];
  }, [priceRows, stagedDeletes, stagedAdds]);

  const saleRows = useMemo(() => {
    if (!Array.isArray(effectiveRows)) return [];
    return effectiveRows.filter(r => getSalesFlagFromRow(r) === true);
  }, [effectiveRows]);

  const purchaseRows = useMemo(() => {
    if (!Array.isArray(effectiveRows)) return [];
    return effectiveRows.filter(r => getSalesFlagFromRow(r) === false);
  }, [effectiveRows]);

  const updateDraft = (id, field, value) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const hasDraftChanges = useMemo(() => {
    return Array.isArray(priceRows) && priceRows.some(row => {
      if (stagedDeletes.includes(row.id)) return false;
      const draft = drafts[row.id];
      if (!draft) return false;
      return draft.standardPrice !== String(row.standardPrice ?? '')
        || draft.listPrice !== String(row.listPrice ?? '');
    });
  }, [drafts, priceRows, stagedDeletes]);

  const hasPendingDraft = Boolean(pendingSale || pendingPurchase);
  const hasUnsavedChanges = hasDraftChanges || stagedAdds.length > 0 || stagedDeletes.length > 0 || hasPendingDraft;

  const handleSave = async () => {
    if (!Array.isArray(priceRows)) return;
    if (pendingSale || pendingPurchase) {
      toast.info('There are unfinished new rows. Complete or cancel them before saving.');
      return false;
    }

    setSaving(true);
    try {
      for (const rowId of stagedDeletes) {
        const res = await fetch(`${apiBaseUrl}/price/${rowId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await extractErrorMessage(res));
      }

      for (const row of stagedAdds) {
        const draft = drafts[row.id] ?? {
          standardPrice: String(row.standardPrice ?? '0'),
          listPrice: String(row.listPrice ?? '0'),
        };
        const res = await fetch(`${apiBaseUrl}/price`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            parentId: productId,
            product: productId,
            priceListVersion: row.priceListVersion,
            standardPrice: draft.standardPrice || '0',
            listPrice: draft.listPrice || '0',
            priceLimit: draft.listPrice || '0',
          }),
        });
        if (!res.ok) throw new Error(await extractErrorMessage(res));
      }

      const changedRows = priceRows.filter(row => {
        if (stagedDeletes.includes(row.id)) return false;
        const draft = drafts[row.id];
        if (!draft) return false;
        return draft.standardPrice !== String(row.standardPrice ?? '')
          || draft.listPrice !== String(row.listPrice ?? '');
      });

      for (const row of changedRows) {
        const draft = drafts[row.id];
        const res = await fetch(`${apiBaseUrl}/price/${row.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            standardPrice: draft.standardPrice,
            listPrice: draft.listPrice,
          }),
        });
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res));
        }
      }

      toast.success(ui('pricingUpdated'));
      if (onSaved) await onSaved();
      setStagedAdds([]);
      setStagedDeletes([]);
      setPendingSale(null);
      setPendingPurchase(null);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Unable to save pricing.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRequestClose = (open) => {
    if (!open && hasUnsavedChanges) {
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(open);
  };

  const handleDiscard = () => {
    setShowCloseConfirm(false);
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    setShowCloseConfirm(false);
    const saved = await handleSave();
    if (saved) {
      onOpenChange(false);
    }
  };

  const renderSection = (title, rows, pending, setPending, options, variant = 'neutral') => {
    const showTable = rows.length > 0 || pending;
    const tone = variant === 'sales'
      ? {
        shell: 'border-blue-200 bg-blue-50/70',
        badge: 'bg-blue-100 text-blue-700',
        focus: 'focus:ring-blue-500',
        pending: 'border-t border-blue-100 bg-blue-50/30',
      }
      : {
        shell: 'border-emerald-200 bg-emerald-50/70',
        badge: 'bg-emerald-100 text-emerald-700',
        focus: 'focus:ring-emerald-500',
        pending: 'border-t border-emerald-100 bg-emerald-50/30',
      };

    return (
      <div className={`flex-1 min-w-0 rounded-2xl border p-3 ${tone.shell}`}>
        <div className="flex items-center justify-between px-2 pb-3">
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold text-gray-800">{title}</div>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
              {(rows.length + (pending ? 1 : 0))} {rows.length + (pending ? 1 : 0) === 1 ? ui('priceSingleList') : ui('priceMultiList')}
            </span>
          </div>
          {!pending && (
            <button
              type="button"
              onClick={() => setPending({ plvId: '', stdPrice: '', listPrice: '' })}
              className="w-6 h-6 flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors font-medium shrink-0 text-sm"
            >
              +
            </button>
          )}
        </div>

        {!showTable && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-xs text-gray-400">
            {ui('priceNoLists')}
          </div>
        )}

        {showTable && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-14" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="w-full text-left px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{ui('priceColName')}</th>
                  <th className="whitespace-nowrap text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{ui('priceColUnitPrice')}</th>
                  <th className="whitespace-nowrap text-right px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{ui('priceColListPrice')}</th>
                  <th className="w-14" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const draft = drafts[row.id] ?? {
                    standardPrice: String(row.standardPrice ?? ''),
                    listPrice: String(row.listPrice ?? ''),
                  };
                  return (
                    <tr key={row.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-700 truncate">
                        {row['priceListVersion$_identifier'] || 'Unknown'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={draft.standardPrice}
                          onChange={e => updateDraft(row.id, 'standardPrice', e.target.value)}
                          className={`w-28 text-right text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 ${tone.focus}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={draft.listPrice}
                          onChange={e => updateDraft(row.id, 'listPrice', e.target.value)}
                          className={`w-28 text-right text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 ${tone.focus}`}
                        />
                      </td>
                      <td className="w-14 px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          title={ui('priceRemove')}
                          className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors disabled:opacity-40"
                        >
                          <span className="text-[11px] leading-none">✕</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {pending && (
                  <tr className={tone.pending}>
                    <td className="px-2 py-1.5">
                      <select
                        value={pending.plvId}
                        onChange={e => setPending(p => ({ ...p, plvId: e.target.value }))}
                        disabled={lazyLoading && options.length === 0}
                        className={`w-full text-sm border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 ${tone.focus} disabled:opacity-60`}
                        autoFocus
                      >
                        <option value="">
                          {lazyLoading && options.length === 0
                            ? ui('loadingPricing')
                            : ui('priceSelectVersion')}
                        </option>
                        {options.map(opt => {
                          const id = extractReferenceId(opt.id);
                          return (
                            <option key={id} value={id}>
                              {opt.name || opt.label || id}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={pending.stdPrice}
                        onChange={e => setPending(p => ({ ...p, stdPrice: e.target.value }))}
                        placeholder={ui('priceZeroPlaceholder')}
                        className={`w-28 text-right text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 ${tone.focus}`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={pending.listPrice}
                        onChange={e => setPending(p => ({ ...p, listPrice: e.target.value }))}
                        placeholder={ui('priceZeroPlaceholder')}
                        className={`w-28 text-right text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 ${tone.focus}`}
                      />
                    </td>
                    <td className="w-14 px-1 py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setPending(null)}
                          title={ui('cancel')}
                          className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 transition-colors text-xs"
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRow(pending, setPending, options, variant)}
                          disabled={!pending.plvId}
                          title={ui('add')}
                          className="w-6 h-6 flex items-center justify-center rounded border border-transparent bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-40 text-xs"
                        >
                          ✓
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleRequestClose}>
      <DialogContent className="max-w-5xl w-full">
        <div className="relative">
          <DialogHeader>
            <DialogTitle className="text-lg">{ui('managePricing')}</DialogTitle>
            <DialogDescription className="mt-1">
              {ui('managePricingDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 pt-2 max-h-[60vh] overflow-y-auto items-start">
            {renderSection(ui('priceSalesLists'), saleRows, pendingSale, setPendingSale, saleOptions, 'sales')}
            {renderSection(ui('pricePurchaseLists'), purchaseRows, pendingPurchase, setPendingPurchase, purchaseOptions, 'purchase')}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 mt-1">
            <button
              type="button"
              onClick={() => handleRequestClose(false)}
              disabled={saving}
              className="text-xs px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {ui('cancel')}
            </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasUnsavedChanges}
                className="text-xs px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {ui('saveChanges')}
            </button>
          </div>

          {showCloseConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/75 backdrop-blur-[2px]">
              <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-5 max-w-xs w-full mx-4">
                <div className="text-sm font-semibold text-gray-900 mb-1">{ui('unsavedChanges')}</div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  {ui('unsavedChangesDesc')}
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={saving}
                    className="text-xs px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    {ui('discardChanges')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndClose}
                    disabled={saving}
                    className="text-xs px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving && <Loader2 size={11} className="animate-spin" />}
                    {ui('saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductPriceBar({ data, token, apiBaseUrl, catalogs, api }) {
  const ui = useUI();
  const recordId = data?.id;
  const [priceRows, setPriceRows] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create-flow drafts (used only when no rows exist yet). Each side maps
  // to its own M_ProductPrice row (sales vs purchase price list version).
  const [saleStandardDraft, setSaleStandardDraft] = useState('');
  const [saleListDraft, setSaleListDraft] = useState('');
  const [purchaseStandardDraft, setPurchaseStandardDraft] = useState('');
  const [purchaseListDraft, setPurchaseListDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const priceSelector = useMemo(() => (
    api?.selectors?.find(sel => sel.entity === 'price' && (sel.field === 'priceListVersion' || sel.column === 'M_PriceList_Version_ID'))
  ), [api]);

  const selectorOptions = useMemo(() => (
    priceSelector ? getCatalogOptions(catalogs, 'price', priceSelector) : []
  ), [catalogs, priceSelector]);

  const refreshPrices = useCallback(async () => {
    if (!recordId || !token) {
      setPriceRows([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/price?parentId=${recordId}&_startRow=0&_endRow=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      setPriceRows(payload?.response?.data ?? []);
    } catch {
      setPriceRows([]);
    } finally {
      setLoading(false);
    }
  }, [recordId, token, apiBaseUrl]);

  useEffect(() => {
    refreshPrices();
  }, [refreshPrices]);

  const hasRows = Array.isArray(priceRows) && priceRows.length > 0;
  const displaySaleRows = hasRows ? priceRows.filter(r => getSalesFlagFromRow(r) === true) : [];
  const displayPurchaseRows = hasRows ? priceRows.filter(r => getSalesFlagFromRow(r) === false) : [];

  const resolveCreateDefaults = useCallback(async () => {
    const empty = {
      salesPriceListVersion: null,
      salesPriceList: null,
      purchasePriceListVersion: null,
      purchasePriceList: null,
    };
    if (!token || !apiBaseUrl) return empty;

    const defaultUrl = recordId
      ? `${apiBaseUrl}/price/defaults?parentId=${recordId}`
      : `${apiBaseUrl}/price/defaults`;

    let defaultPlv = null;
    let defaultPl = null;

    try {
      const defaultsRes = await fetch(defaultUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (defaultsRes.ok) {
        const defaultsPayload = await defaultsRes.json();
        const defaults = sanitizeDefaults(defaultsPayload?.defaults ?? {});
        defaultPlv = extractReferenceId(
          defaults.priceListVersion
          ?? defaults.M_PriceList_Version_ID
          ?? defaults.priceListVersionId
        );
        defaultPl = extractReferenceId(
          defaults.priceList
          ?? defaults.M_PriceList_ID
          ?? defaults.priceListId
        );
      }
    } catch {
      // Continue with selector fallback.
    }

    const findInOptions = (options, isSales) => {
      if (!Array.isArray(options) || options.length === 0) return null;
      const match = options.find(opt => getSalesFlagFromOption(opt) === isSales);
      return extractReferenceId(match?.id);
    };

    let salesPriceListVersion = findInOptions(selectorOptions, true);
    let purchasePriceListVersion = findInOptions(selectorOptions, false);
    let salesPriceList = null;
    let purchasePriceList = null;

    // If the /defaults endpoint returned a PLV, route it to the matching side.
    if (defaultPlv) {
      const normalized = resolveOptionId(selectorOptions, defaultPlv) ?? defaultPlv;
      const matched = (selectorOptions ?? []).find(opt => extractReferenceId(opt.id) === normalized);
      const flag = getSalesFlagFromOption(matched);
      if (flag === true) {
        salesPriceListVersion = salesPriceListVersion ?? normalized;
        salesPriceList = defaultPl;
      } else if (flag === false) {
        purchasePriceListVersion = purchasePriceListVersion ?? normalized;
        purchasePriceList = defaultPl;
      }
    }

    // Last-chance fallback: fetch the selector endpoint directly.
    if (!salesPriceListVersion || !purchasePriceListVersion) {
      const selectorColumn = priceSelector?.column ?? 'M_PriceList_Version_ID';
      try {
        const selectorRes = await fetch(`${apiBaseUrl}/price/selectors/${selectorColumn}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (selectorRes.ok) {
          const selectorPayload = await selectorRes.json();
          const options = (selectorPayload?.items ?? []).map(item => ({
            id: item.id,
            name: item.label || item.name || item.id,
            ...item,
          }));
          salesPriceListVersion = salesPriceListVersion ?? findInOptions(options, true);
          purchasePriceListVersion = purchasePriceListVersion ?? findInOptions(options, false);
        }
      } catch {
        // Keep nulls and let the create flow surface a clear error.
      }
    }

    return {
      salesPriceListVersion,
      salesPriceList,
      purchasePriceListVersion,
      purchasePriceList,
    };
  }, [recordId, token, apiBaseUrl, selectorOptions, priceSelector]);

  const handleOpenDialog = () => {
    if (hasRows) {
      setDialogOpen(true);
    } else {
      setSaleStandardDraft('');
      setSaleListDraft('');
      setPurchaseStandardDraft('');
      setPurchaseListDraft('');
      setCreating(true);
    }
  };

  const handleDialogSaved = async () => {
    await refreshPrices();
    setDialogOpen(false);
  };

  const cancelCreate = () => setCreating(false);

  const saveCreate = async () => {
    if (!recordId) {
      toast.info(ui('saveProductFirstPricing'));
      return;
    }

    const saleStandard = toFiniteNumber(saleStandardDraft);
    const saleList = toFiniteNumber(saleListDraft);
    const purchaseStandard = toFiniteNumber(purchaseStandardDraft);
    const purchaseList = toFiniteNumber(purchaseListDraft);

    const hasSaleRow = saleStandard !== null || saleList !== null;
    const hasPurchaseRow = purchaseStandard !== null || purchaseList !== null;

    if (!hasSaleRow && !hasPurchaseRow) {
      toast.info(ui('enterAtLeastOneValueCreatePricing'));
      return;
    }

    setSaving(true);
    let savedSuccessfully = false;
    try {
      const {
        salesPriceListVersion,
        salesPriceList,
        purchasePriceListVersion,
        purchasePriceList,
      } = await resolveCreateDefaults();

      if (hasSaleRow && !salesPriceListVersion) {
        throw new Error(ui('unableToSavePricing'));
      }
      if (hasPurchaseRow && !purchasePriceListVersion) {
        throw new Error(ui('unableToSavePricing'));
      }

      const organizationId = extractReferenceId(data?.organization);
      const clientId = extractReferenceId(data?.client);

      const postRow = async ({ priceListVersion, priceList, standard, list }) => {
        // Within a single row, when only one column is provided, fall back
        // to the other to keep standardPrice / listPrice / priceLimit consistent.
        const standardValue = standard ?? list ?? 0;
        const listValue = list ?? standard ?? 0;
        const limitValue = listValue;

        const payload = {
          parentId: recordId,
          product: recordId,
          priceListVersion,
          standardPrice: String(standardValue),
          listPrice: String(listValue),
          priceLimit: String(limitValue),
        };
        if (priceList) payload.priceList = priceList;
        if (organizationId) payload.organization = organizationId;
        if (clientId) payload.client = clientId;

        const res = await fetch(`${apiBaseUrl}/price`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(await extractErrorMessage(res));
        }
      };

      if (hasSaleRow) {
        await postRow({
          priceListVersion: salesPriceListVersion,
          priceList: salesPriceList,
          standard: saleStandard,
          list: saleList,
        });
      }

      if (hasPurchaseRow) {
        await postRow({
          priceListVersion: purchasePriceListVersion,
          priceList: purchasePriceList,
          standard: purchaseStandard,
          list: purchaseList,
        });
      }

      toast.success(ui('pricingCreatedUsingDefaultValues'));
      await refreshPrices();
      savedSuccessfully = true;
    } catch (err) {
      toast.error(err?.message || ui('unableToSavePricing'));
    } finally {
      setSaving(false);
      if (savedSuccessfully) {
        setCreating(false);
      }
    }
  };

  const handleCreateKeyDown = (e) => {
    if (e.key === 'Escape') cancelCreate();
    if (e.key === 'Enter') saveCreate();
  };

  const renderPricingBody = () => {
    if (loading) {
      return (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          {ui('loadingPricing')}
        </div>
      );
    }
    if (creating && !hasRows) {
      return (
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
            <div className="text-sm font-semibold text-gray-800 mb-1">{ui('priceSalesPrice')}</div>
            <p className="text-xs text-gray-400 mb-3">{ui('priceSalesDescription')}</p>
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-gray-500">
                <div className="mb-1 uppercase tracking-wide font-semibold">{ui('priceColUnitPrice')}</div>
                <input
                  type="number"
                  step="0.01"
                  value={saleStandardDraft}
                  onChange={e => setSaleStandardDraft(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder={ui('priceZeroPlaceholder')}
                  className="w-full text-xl font-bold text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </label>
              <label className="flex-1 text-xs text-gray-500">
                <div className="mb-1 uppercase tracking-wide font-semibold">{ui('priceColListPrice')}</div>
                <input
                  type="number"
                  step="0.01"
                  value={saleListDraft}
                  onChange={e => setSaleListDraft(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder={ui('priceZeroPlaceholder')}
                  className="w-full text-xl font-bold text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>
          </div>
          <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="text-sm font-semibold text-gray-800 mb-1">{ui('pricePurchasePrice')}</div>
            <p className="text-xs text-gray-400 mb-3">{ui('pricePurchaseDescription')}</p>
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-gray-500">
                <div className="mb-1 uppercase tracking-wide font-semibold">{ui('priceColUnitPrice')}</div>
                <input
                  type="number"
                  step="0.01"
                  value={purchaseStandardDraft}
                  onChange={e => setPurchaseStandardDraft(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder={ui('priceZeroPlaceholder')}
                  className="w-full text-xl font-bold text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
              <label className="flex-1 text-xs text-gray-500">
                <div className="mb-1 uppercase tracking-wide font-semibold">{ui('priceColListPrice')}</div>
                <input
                  type="number"
                  step="0.01"
                  value={purchaseListDraft}
                  onChange={e => setPurchaseListDraft(e.target.value)}
                  onKeyDown={handleCreateKeyDown}
                  placeholder={ui('priceZeroPlaceholder')}
                  className="w-full text-xl font-bold text-gray-900 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
            </div>
          </div>
        </div>
      );
    }
    if (!hasRows) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-400">
          {ui('noPricingConfigured')}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 items-start">
        <PriceTable title={ui('priceSalesLists')} rows={displaySaleRows} variant="sales" />
        <PriceTable title={ui('pricePurchaseLists')} rows={displayPurchaseRows} variant="purchase" />
      </div>
    );
  };

  if (!recordId) {
    return (
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm p-5 mb-2">
        <div className="text-sm font-semibold text-gray-800">{ui('pricing')}</div>
        <div className="text-sm text-gray-500 mt-1">
          {ui('saveProductFirstPricing')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm pt-2 pb-5 px-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-base font-semibold text-gray-800">{ui('pricing')}</div>
          <div className="text-sm text-gray-400 mt-0.5">
            {ui('configureMainSaleAndPurchasePrice')}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {creating ? (
            <>
              <button
                onClick={cancelCreate}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {ui('cancel')}
              </button>
              <button
                onClick={saveCreate}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors flex items-center gap-1.5"
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                {ui('savePricing')}
              </button>
            </>
          ) : (
            <button
              onClick={handleOpenDialog}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              {hasRows ? ui('editPricing') : ui('setPricing')}
            </button>
          )}
        </div>
      </div>

      {renderPricingBody()}

      <PricingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        priceRows={priceRows}
        apiBaseUrl={apiBaseUrl}
        token={token}
        onSaved={handleDialogSaved}
        selectorOptions={selectorOptions}
        selectorColumn={priceSelector?.column ?? 'M_PriceList_Version_ID'}
        productId={recordId}
      />
    </div>
  );
}
