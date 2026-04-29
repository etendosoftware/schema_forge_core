import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '@/i18n';
import CreateRejectReasonModal from './CreateRejectReasonModal';

/**
 * Reject confirmation for Sales Quotation in Under Evaluation (UE).
 *
 * The user must pick (or create) a rejection reason from the C_Reject_Reason
 * FK list. The reason picker is a search-typeahead modelled after the
 * `businessPartner` search in EntityForm — typing filters the loaded options,
 * and a "+ Crear razón" button opens an inline sub-modal that creates a new
 * RejectReason via the dedicated NEO action endpoint and preselects it.
 *
 * On confirm we POST to the dedicated NEO action endpoint; the Java handler
 * is the one in com.etendoerp.go that flips DocStatus to CJ and persists
 * the chosen rejectReason.
 */
export default function RejectQuotationModal({
  quotationId,
  data,
  token,
  apiBaseUrl,
  onClose,
}) {
  const ui = useUI();
  const [reasons, setReasons] = useState([]);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [selected, setSelected] = useState(null); // { id, name } | null
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isEditingRef = useRef(false);
  const blurTimeoutRef = useRef(null);

  const entityUrl = `${apiBaseUrl}/quotation`;
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  // The selector URL mirrors the one EntityForm builds for the rejectReason
  // field (see tools/app-shell/src/components/contract-ui/EntityForm.jsx:626).
  const reasonsUrl = `${apiBaseUrl}/quotation/selectors/C_Reject_Reason_ID`;

  useEffect(() => {
    let cancelled = false;
    setLoadingReasons(true);
    fetch(`${reasonsUrl}?limit=200&offset=0`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled) return;
        const items =
          payload?.items
          ?? payload?.response?.data
          ?? (Array.isArray(payload) ? payload : []);
        const mapped = items
          .map((i) => ({ id: i.id, name: i.label ?? i.name ?? i.id }))
          .filter((i) => i.id);
        setReasons(mapped);
        setLoadingReasons(false);
      })
      .catch(() => {
        if (cancelled) return;
        setReasons([]);
        setLoadingReasons(false);
      });
    return () => { cancelled = true; };
  }, [reasonsUrl, headers]);

  const documentNo = data?.documentNo || '';

  const filteredReasons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reasons;
    return reasons.filter((r) => (r.name || '').toLowerCase().includes(q));
  }, [reasons, query]);

  const handleSelect = (reason) => {
    isEditingRef.current = false;
    setSelected(reason);
    setQuery(reason.name);
    setOpen(false);
  };

  const handleClear = () => {
    isEditingRef.current = false;
    setSelected(null);
    setQuery('');
    setOpen(false);
  };

  const handleOpenCreate = () => {
    setOpen(false);
    setShowCreate(true);
  };

  const handleCreated = (created) => {
    setShowCreate(false);
    // Append the new reason to the cached list and preselect it so the user
    // sees the chosen value immediately.
    setReasons((prev) => {
      if (prev.some((r) => r.id === created.id)) return prev;
      return [...prev, created].sort((a, b) =>
        (a.name || '').localeCompare(b.name || ''));
    });
    handleSelect(created);
  };

  const handleConfirm = async () => {
    if (loading || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${entityUrl}/${quotationId}/action/rejectQuotation`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ rejectReason: selected.id }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.response?.message || err?.message || `Error (${res.status})`,
        );
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setError(`${ui('rejectQuotationError')}${err.message || ''}`);
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={cardStyle}>

        <div style={{ padding: '14px 16px 0', position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label={ui('cancel')}
            disabled={loading}
          >
            &times;
          </button>
          <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 8 }}>
            {ui('quotationDocumentLabel')} #{documentNo}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>
            {ui('rejectQuotationTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5, marginBottom: 14 }}>
            {ui('rejectQuotationDesc')}
          </div>
        </div>

        <div style={{ padding: '0 16px 14px', position: 'relative' }}>
          <label htmlFor="reject-reason-search"
            style={{ display: 'block', fontSize: 11, color: '#374151', fontWeight: 500, marginBottom: 6 }}>
            {ui('rejectReasonLabel')}
          </label>

          <div style={{ position: 'relative' }}>
            <svg style={searchIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="reject-reason-search"
              type="text"
              value={query}
              onChange={(e) => {
                isEditingRef.current = true;
                setQuery(e.target.value);
                setSelected(null);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                isEditingRef.current = false;
                blurTimeoutRef.current = setTimeout(() => setOpen(false), 200);
              }}
              placeholder={loadingReasons ? `${ui('loading')}…` : ui('rejectReasonSearchPlaceholder')}
              disabled={loading || loadingReasons}
              style={inputStyle}
              autoComplete="off"
            />
            {selected && !loading && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
                style={clearBtnStyle}
                aria-label={ui('clear')}
              >
                ×
              </button>
            )}
          </div>

          {open && (
            <div style={dropdownStyle}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleOpenCreate(); }}
                style={createOptionStyle}
                disabled={loading}
              >
                + {ui('createRejectReason')}
              </button>
              {filteredReasons.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={() => handleSelect(r)}
                  style={optionStyle}
                  disabled={loading}
                >
                  {r.name}
                </button>
              ))}
              {filteredReasons.length === 0 && !loadingReasons && query.length > 0 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#9CA3AF' }}>
                  {ui('rejectReasonNoResults')}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: '8px 16px', fontSize: 12, color: '#DC2626',
            background: '#FEF2F2', borderTop: '0.5px solid #FECACA',
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '12px 16px', borderTop: '0.5px solid #E5E7EB',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {ui('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !selected}
            style={{
              ...btnPrimary,
              opacity: loading || !selected ? 0.6 : 1,
              cursor: loading || !selected ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading && (
              <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {loading ? ui('soProcessing') : ui('rejectQuotationConfirm')}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {showCreate && createPortal(
        <CreateRejectReasonModal
          // When something is already selected, `query` mirrors that
          // selection's name. Opening the create sub-modal at that point
          // means "I want a fresh reason, not a copy of the chosen one",
          // so we seed it blank. When only typed text exists (no selection),
          // pre-filling with that text matches the contact-create pattern.
          initialName={selected ? '' : query}
          quotationId={quotationId}
          apiBaseUrl={apiBaseUrl}
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />,
        document.body,
      )}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardStyle = {
  width: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  overflow: 'visible', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const closeBtnStyle = {
  position: 'absolute', top: 10, right: 12,
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};

const inputStyle = {
  width: '100%', fontSize: 13, color: '#111827',
  border: '1px solid #D1D5DB', borderRadius: 6, padding: '7px 10px 7px 30px',
  background: '#FFFFFF',
  outline: 'none',
};

const searchIconStyle = {
  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
  width: 14, height: 14, color: '#9CA3AF', pointerEvents: 'none',
};

const clearBtnStyle = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
  width: 20, height: 20, borderRadius: '50%',
  border: 'none', background: 'transparent', color: '#9CA3AF',
  cursor: 'pointer', fontSize: 16, lineHeight: 1,
};

const dropdownStyle = {
  position: 'absolute', left: 16, right: 16, top: '100%', marginTop: -6, zIndex: 51,
  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  maxHeight: 220, overflowY: 'auto',
};

const createOptionStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 12px', fontSize: 13, fontWeight: 500,
  color: '#202452', background: 'transparent',
  border: 'none', borderBottom: '1px solid #E5E7EB',
  cursor: 'pointer',
};

const optionStyle = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '8px 12px', fontSize: 13, color: '#111827',
  background: 'transparent', border: 'none', cursor: 'pointer',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280',
};

const btnPrimary = {
  fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 6,
  border: 'none', background: '#DC2626', color: '#fff',
};
