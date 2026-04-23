import { useState, useEffect, useMemo } from 'react';
import { useUI } from '@/i18n';

export default function SendToEvaluationModal({
  quotationId,
  data,
  token,
  apiBaseUrl,
  onClose,
}) {
  const ui = useUI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [freshData, setFreshData] = useState(null);
  const [lineCount, setLineCount] = useState(null);

  const entityUrl = `${apiBaseUrl}/quotation`;
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const fmtNum = (v) =>
    v != null && v !== ''
      ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '-';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recRes, linesRes] = await Promise.all([
          fetch(`${entityUrl}/${quotationId}`, { headers }),
          fetch(`${apiBaseUrl}/quotationLine?parentId=${quotationId}&_startRow=0&_endRow=999`, { headers }),
        ]);
        if (cancelled) return;
        if (recRes.ok) {
          const recJson = await recRes.json();
          const rec = recJson?.response?.data?.[0] ?? recJson;
          setFreshData(rec);
        }
        if (linesRes.ok) {
          const linesJson = await linesRes.json();
          setLineCount(linesJson?.response?.data?.length ?? 0);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [quotationId, entityUrl, apiBaseUrl, headers]);

  const d = freshData || data || {};
  const documentNo = d.documentNo || '';
  const bpName = d['businessPartner$_identifier'] || '';
  const grandTotal = d.grandTotalAmount ?? d.grandTotal ?? '';
  const totalLines = d.summedLineAmount ?? d.totalLines ?? grandTotal;
  const currency = d['currency$_identifier'] || '';

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${entityUrl}/${quotationId}/action/DocAction`,
        { method: 'POST', headers, body: JSON.stringify({ fieldValues: {} }) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || err?.message || `Error (${res.status})`);
      }
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err.message || ui('soErrorOccurred'));
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={cardStyle}>

        <div style={{ padding: '14px 16px 0', position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 12,
              fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
              background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
            }}
          >
            &times;
          </button>
          <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 8 }}>
            Quotation #{documentNo}
          </div>
          <div style={{
            background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10,
            padding: '14px 16px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: '#185FA5' }}>
              {bpName}
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4, marginBottom: 6 }}>
              {fmtNum(grandTotal)} {currency}
            </div>
            <div style={{ fontSize: 11, color: '#185FA5' }}>
              {lineCount != null ? ui('soLines', { count: lineCount }) : '...'} <span style={{ color: '#85B7EB' }}>·</span> {ui('soSubtotal')} <span style={{ fontWeight: 500, color: '#042C53' }}>{fmtNum(totalLines)} {currency}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 14px', borderBottom: '0.5px solid #E5E7EB' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>
            {ui('sqSendToEvalTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            {ui('sqSendToEvalDesc')}
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{
              ...btnPrimary,
              opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {loading && (
              <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            )}
            {loading ? ui('soProcessing') : ui('sqSendToEvalConfirm')}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
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
  width: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const btnPrimary = {
  fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 6,
  border: 'none', background: '#185FA5', color: '#fff', cursor: 'pointer',
};
