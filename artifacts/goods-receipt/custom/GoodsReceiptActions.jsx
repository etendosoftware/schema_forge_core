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

// ── ReceiptInvoicePreview ─────────────────────────────────────────────────────

function ReceiptInvoicePreview({ receiptId, receiptData, base, headers, loading, onConfirm, onClose }) {
  const ui = useUI();
  const [lines, setLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);

  const bpName = receiptData?.['businessPartner$_identifier'] || '';
  const receiptNo = receiptData?.documentNo || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${base}/goods-receipt/goodsReceiptLine?parentId=${receiptId}&_startRow=0&_endRow=200`,
          { headers },
        );
        if (!cancelled && res.ok) {
          setLines((await res.json())?.response?.data || []);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingLines(false); }
    })();
    return () => { cancelled = true; };
  }, [receiptId, base, headers]);

  const fmtNum = (v) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB' }}>

        <div style={{ padding: '14px 16px', background: '#F4F5F7', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{ui('createInvoiceBtn')}</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                {receiptNo}{bpName ? ` · ${bpName}` : ''}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {loadingLines ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('loadingLines')}</p>
          ) : lines.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('noLinesInThisReceipt')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB' }}>
                <span style={{ flex: 1 }}>{ui('product')}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{ui('qty')}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{ui('price')}</span>
              </div>
              {lines.map(line => (
                <div key={line.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {line['product$_identifier'] || line.id}
                  </span>
                  <span style={{ width: 80, fontSize: 13, color: '#374151', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(line.movementQuantity)}
                  </span>
                  <span style={{ width: 80, fontSize: 12, color: '#6B7280', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {line.unitPrice != null ? fmtNum(line.unitPrice) : '—'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, background: '#F5F5F5', borderTop: '1px solid #E5E5E5', padding: '10px 16px', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>
            {ui('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={lines.length === 0 || loading}
            style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: (lines.length === 0 || loading) ? 'not-allowed' : 'pointer', opacity: (lines.length === 0 || loading) ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading && <Spinner />}
            {loading ? ui('creating') : ui('createInvoiceBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoodsReceiptActions({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
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
      setShowInvoicePreview(false);
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
          onClick={() => setShowInvoicePreview(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border-info, #93c5fd)', background: 'var(--color-background-info, #eff6ff)', color: 'var(--color-text-info, #2563eb)', cursor: 'pointer' }}
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
          docInfo={{ bpName: data?.['businessPartner$_identifier'], documentNo: data?.documentNo }}
          onConfirmed={(docs) => { setShowConfirm(false); setConfirmedDocs(docs); }}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {showInvoicePreview && createPortal(
        <ReceiptInvoicePreview
          receiptId={recordId}
          receiptData={data}
          base={base}
          headers={headers}
          loading={creatingInvoice}
          onConfirm={handleCreateInvoice}
          onClose={() => setShowInvoicePreview(false)}
        />,
        document.body,
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
