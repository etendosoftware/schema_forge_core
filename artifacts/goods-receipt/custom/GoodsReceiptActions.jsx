import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useUI, useMenuLabel } from '@/i18n';

// ── InvoiceStatusPill (3-state) ───────────────────────────────────────────────

function InvoiceStatusPill({ label, value }) {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  const pct = Math.round(n);
  const full = pct >= 100;
  const partial = pct > 0 && !full;
  const bg = full ? '#d1fae5' : partial ? '#fef3c7' : '#f3f4f6';
  const color = full ? '#065f46' : partial ? '#92400e' : '#374151';
  const dot = full ? '#10b981' : partial ? '#f59e0b' : '#9ca3af';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-medium"
      style={{ padding: '4px 12px', borderRadius: '6px', backgroundColor: bg, color }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />
      {label}
      <span style={{ opacity: 0.4 }}>&middot;</span>
      <span className="font-semibold tabular-nums">{pct}%</span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoodsReceiptActions({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const isCompleted = data?.documentStatus === 'CO';
  const invoicePct = parseFloat(data?.invoiceStatus ?? 0);
  const isFullyInvoiced = invoicePct >= 100;

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  useEffect(() => {
    const handler = () => setShowConfirm(true);
    window.addEventListener('goods-receipt:open-confirm-modal', handler);
    return () => window.removeEventListener('goods-receipt:open-confirm-modal', handler);
  }, []);

  const handleCreateInvoice = async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch(
        `${base}/goods-receipt/goodsReceipt/${recordId}/action/createPurchaseInvoice`,
        { method: 'POST', headers, body: JSON.stringify({}) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || `Error (${res.status})`);
      }
      const json = await res.json();
      const invoiceId = json?.response?.data?.id;
      const docNo = json?.response?.data?.documentNo || '';
      if (invoiceId) {
        const basePath = window.location.pathname.replace(/\/goods-receipt\/.*$/, '');
        const invoiceUrl = `${basePath}/purchase-invoice/${invoiceId}`;
        toast.custom((t) => (
          <div style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', minWidth: 380 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{`${ui('invoiceRef')}${docNo} ${ui('createdAsDraft')}`}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{ui('reviewBeforeConfirming')}</div>
            </div>
            <button
              onClick={() => { toast.dismiss(t); window.location.href = invoiceUrl; }}
              style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#fff', background: 'rgba(255,255,255,0.15)', cursor: 'pointer' }}
            >
              {ui('viewInvoice')}
            </button>
          </div>
        ), { duration: 10000 });
      } else {
        toast.success(ui('invoiceCreatedAsDraftToast'));
      }
    } catch (err) {
      toast.error(err.message || ui('failedToCreateInvoice'));
    } finally {
      setCreatingInvoice(false);
      setShowCreateInvoice(false);
    }
  };

  return (
    <>
      {isCompleted && (
        <InvoiceStatusPill label={ui('goodsReceipt.topbar.invoiceStatus')} value={data.invoiceStatus} />
      )}

      {isCompleted && !isFullyInvoiced && (
        <button
          type="button"
          onClick={() => setShowCreateInvoice(true)}
          disabled={creatingInvoice}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border-info, #93c5fd)', background: 'var(--color-background-info, #eff6ff)', color: 'var(--color-text-info, #2563eb)', opacity: creatingInvoice ? 0.6 : 1, cursor: creatingInvoice ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-background-info, #eff6ff)'; }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {ui('createInvoiceBtn')}
        </button>
      )}

      {showConfirm && createPortal(
        <GoodsReceiptConfirmModal
          receiptId={recordId}
          data={data}
          base={base}
          headers={headers}
          onClose={() => setShowConfirm(false)}
          onConfirmed={() => { setShowConfirm(false); window.location.reload(); }}
        />,
        document.body,
      )}

      {showCreateInvoice && createPortal(
        <CreateInvoiceModal
          onClose={() => setShowCreateInvoice(false)}
          onConfirm={handleCreateInvoice}
          loading={creatingInvoice}
          ui={ui}
        />,
        document.body,
      )}
    </>
  );
}

// ── GoodsReceiptConfirmModal ──────────────────────────────────────────────────

function GoodsReceiptConfirmModal({ receiptId, data, base, headers, onClose, onConfirmed }) {
  const ui = useUI();
  const [createInvoice, setCreateInvoice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const documentNo = data?.documentNo || data?.orderReference || '';
  const bpName = data?.['businessPartner$_identifier'] || '';

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const processRes = await fetch(
        `${base}/goods-receipt/goodsReceipt/${receiptId}/action/documentAction`,
        { method: 'POST', headers, body: JSON.stringify({ docAction: 'CO' }) },
      );
      if (!processRes.ok) {
        const e = await processRes.json().catch(() => null);
        throw new Error(e?.response?.message || `Error (${processRes.status})`);
      }

      if (createInvoice) {
        const invRes = await fetch(
          `${base}/goods-receipt/goodsReceipt/${receiptId}/action/createPurchaseInvoice`,
          { method: 'POST', headers, body: JSON.stringify({}) },
        );
        if (!invRes.ok) {
          const e = await invRes.json().catch(() => null);
          throw new Error(ui('poOrderConfirmedInvoiceError') + ' ' + (e?.response?.message || `Error (${invRes.status})`));
        }
        const json = await invRes.json();
        const invoiceId = json?.response?.data?.id;
        const docNo = json?.response?.data?.documentNo || '';
        if (invoiceId) {
          const basePath = window.location.pathname.replace(/\/goods-receipt\/.*$/, '');
          toast.custom((t) => (
            <div style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', minWidth: 380 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{`${ui('invoiceRef')}${docNo} ${ui('createdAsDraft')}`}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{ui('reviewBeforeConfirming')}</div>
              </div>
              <button
                onClick={() => { toast.dismiss(t); window.location.href = `${window.location.pathname.replace(/\/goods-receipt\/.*$/, '')}/purchase-invoice/${invoiceId}`; }}
                style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#fff', background: 'rgba(255,255,255,0.15)', cursor: 'pointer' }}
              >
                {ui('viewInvoice')}
              </button>
            </div>
          ), { duration: 10000 });
        }
      }

      onConfirmed();
    } catch (e) {
      setError(e.message || ui('poErrorOccurred'));
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB', overflow: 'hidden' }}>

        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{ui('goodsReceipt.confirmModal.title')}</div>
          <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>

        {(documentNo || bpName) && (
          <div style={{ padding: '12px 20px 0' }}>
            <div style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
              {bpName && <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{bpName}</div>}
              {documentNo && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{documentNo}</div>}
            </div>
          </div>
        )}

        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 8 }}>{ui('goodsReceipt.confirmModal.subtitle')}</div>
          <div
            onClick={() => setCreateInvoice(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: createInvoice ? '11px 13px' : '12px 14px', borderRadius: 8, cursor: 'pointer', border: createInvoice ? '2px solid #3B82F6' : '1px solid #E5E7EB', background: createInvoice ? '#EFF6FF' : '#fff', transition: 'border-color 0.15s, background 0.15s' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>🧾</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: createInvoice ? '#2563EB' : '#111827' }}>{ui('goodsReceipt.confirmModal.createInvoiceTitle')}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{ui('goodsReceipt.confirmModal.createInvoiceDesc')}</div>
            </div>
            <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: createInvoice ? 'none' : '1.5px solid #D1D5DB', background: createInvoice ? '#3B82F6' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
              {createInvoice && <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 4 7.5 10 1" /></svg>}
            </div>
          </div>
        </div>

        {error && <div style={{ padding: '8px 20px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading} style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading && <svg style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /><style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style></svg>}
            {loading ? ui('poProcessing') : ui('goodsReceipt.confirmModal.confirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CreateInvoiceModal (from completed state) ─────────────────────────────────

function CreateInvoiceModal({ onClose, onConfirm, loading, ui }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 380, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{ui('createInvoiceBtn')}</div>
          <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
        </div>
        <div style={{ padding: '16px 20px', fontSize: 13, color: '#6B7280' }}>{ui('goodsReceipt.confirmModal.createInvoiceDesc')}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? ui('creating') : ui('createInvoiceBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
