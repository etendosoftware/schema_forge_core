import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import ConfirmDocumentModal, { Spinner, btnPrimaryStyle, btnSecondaryStyle, overlayStyle, cardStyle, closeBtnStyle } from '@/components/contract-ui/ConfirmDocumentModal';
import { PoConfirmResultModal } from '@generated/purchase-order/custom/PurchaseOrderActions';

// ── InvoiceStatusPill ─────────────────────────────────────────────────────────

function InvoiceStatusPill({ label, value }) {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  const pct = Math.round(n);
  const full = pct >= 100;
  const partial = pct > 0 && !full;
  const bg    = full ? '#d1fae5' : partial ? '#fef3c7' : '#f3f4f6';
  const color = full ? '#065f46' : partial ? '#92400e' : '#374151';
  const dot   = full ? '#10b981' : partial ? '#f59e0b' : '#9ca3af';

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
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedDocs, setConfirmedDocs] = useState(null);
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
        throw new Error(err?.response?.message || err?.message || `Error (${res.status})`);
      }
      const invData = (await res.json())?.response?.data;
      setConfirmedDocs({ invoice: { id: invData?.id ?? null, documentNo: invData?.documentNo || '' } });
    } catch (err) {
      toast.error(err.message || ui('failedToCreateInvoice'));
    } finally {
      setCreatingInvoice(false);
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
          onClick={handleCreateInvoice}
          disabled={creatingInvoice}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border-info, #93c5fd)', background: 'var(--color-background-info, #eff6ff)', color: 'var(--color-text-info, #2563eb)', opacity: creatingInvoice ? 0.6 : 1, cursor: creatingInvoice ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-background-info, #eff6ff)'; }}
        >
          {creatingInvoice ? (
            <Spinner />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          )}
          {ui('createInvoiceBtn')}
        </button>
      )}

      {showConfirm && (
        <ConfirmDocumentModal
          base={base}
          headers={headers}
          recordId={recordId}
          specName="goods-receipt"
          entityName="goodsReceipt"
          invoiceAction="createPurchaseInvoice"
          defaultCreateInvoice={false}
          titleKey="goodsReceipt.confirmModal.title"
          subtitleKey="goodsReceipt.confirmModal.subtitle"
          cardTitleKey="goodsReceipt.confirmModal.createInvoiceTitle"
          cardSubtitleKey="goodsReceipt.confirmModal.createInvoiceDesc"
          confirmBtnKey="goodsReceipt.confirmModal.confirmBtn"
          onConfirmed={(docs) => { setShowConfirm(false); setConfirmedDocs(docs); }}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {confirmedDocs && createPortal(
        <PoConfirmResultModal
          docs={confirmedDocs}
          ui={ui}
          navigate={navigate}
          currency={data?.['currency$_identifier'] || ''}
          title={ui('goodsReceipt.confirmModal.confirmedTitle')}
          onClose={() => { setConfirmedDocs(null); window.location.reload(); }}
        />,
        document.body,
      )}
    </>
  );
}
