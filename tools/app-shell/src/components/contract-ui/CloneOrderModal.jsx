import { useState, useEffect } from 'react';
import { useUI } from '@/i18n';

function Spinner() {
  return (
    <>
      <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', flexShrink: 0 }}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </>
  );
}

const fmtNum = (v, decimals = 2) =>
  v != null && v !== '' && !isNaN(Number(v))
    ? Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '0';

/**
 * Modal to confirm and execute a clone-order action.
 *
 * Props:
 *  - orderId: string — ID of the order to clone
 *  - data: object — row data (documentNo, businessPartner$_identifier, documentStatus, grandTotalAmount, currency$_identifier)
 *  - apiBaseUrl: string — e.g. "/sws/neo/sales-order"
 *  - headers: object — { Authorization, Content-Type }
 *  - onClose: () => void
 *  - onCloned: (newId: string) => void
 */
export default function CloneOrderModal({
  recordId,
  data,
  apiBaseUrl,
  headers,
  onClose,
  onCloned,
  cloneActionName = 'cloneOrder',
  titleKey = 'cloneOrderConfirmTitle',
  bodyKey = 'cloneOrderConfirmBody',
  actionLabelKey = 'cloneOrderAction',
  errorKey = 'cloneOrderError',
  processingKey = 'soProcessing',
}) {
  const ui = useUI();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [lines,   setLines]   = useState(null);

  const documentNo = data?.documentNo || '';
  const bpName     = data?.['businessPartner$_identifier'] || '';
  const status     = data?.documentStatus;
  const currency   = data?.['currency$_identifier'] || '';
  const total      = Number(data?.grandTotalAmount) || 0;

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/lines?parentId=${recordId}&_startRow=0&_endRow=999`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled) setLines(json?.response?.data ?? []); })
      .catch(() => { if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [recordId, apiBaseUrl, headers]);

  const statusMap = {
    DR: { label: ui('orderStatusDraft'),     bg: '#FEF3C7', color: '#D97706' },
    CO: { label: ui('orderStatusCompleted'), bg: '#DCFCE7', color: '#16A34A' },
    CL: { label: ui('orderStatusClosed'),    bg: '#F3F4F6', color: '#6B7280' },
    VO: { label: ui('orderStatusVoided'),    bg: '#FEE2E2', color: '#DC2626' },
  };
  const badge = statusMap[status] || { label: status, bg: '#F3F4F6', color: '#6B7280' };

  const lineCount   = lines?.length ?? null;
  const productLine = lineCount === null
    ? '…'
    : `${lineCount === 1 ? ui('soLine') : ui('soLines', { count: lineCount })}  ·  ${currency} ${fmtNum(total)}`;

  const handleClone = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${apiBaseUrl}/header/${recordId}/action/${cloneActionName}`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.response?.error?.message || ui(errorKey));
        return;
      }
      const newId = json?.response?.data?.id;
      onClose();
      onCloned(newId);
    } catch {
      setError(ui(errorKey));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...cardStyle, width: 440 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{ui(titleKey)}</span>
          <button type="button" onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Summary card */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F9FAFB' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bpName}
              </span>
              {documentNo && (
                <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {documentNo}
                </span>
              )}
              {status && (
                <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999,
                  background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {badge.label}
                </span>
              )}
            </div>
            <div style={{ padding: '6px 14px 9px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{productLine}</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, padding: '0 2px' }}>{ui(bodyKey)}</p>

          {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading} style={btnSecondary}>
              {ui('cancel')}
            </button>
            <button type="button" onClick={handleClone} disabled={loading}
              style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {loading && <Spinner />}
              {loading ? ui(processingKey) : ui(actionLabelKey)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardStyle = {
  maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnPrimary = {
  padding: '5px 14px', borderRadius: 6, border: 'none',
  background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13, cursor: 'pointer',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const closeBtn = {
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};
