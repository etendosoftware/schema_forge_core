import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';
import { FileText, Check, Package } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CRITERIA = (field, value) =>
  encodeURIComponent(JSON.stringify([{ fieldName: field, operator: 'equals', value }]));

const fmtNum = (v, decimals = 2) =>
  v != null && v !== '' && !isNaN(Number(v))
    ? Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : '0';

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

// ── Main component ─────────────────────────────────────────────────────────────

export default function PurchaseOrderActions({ data, recordId, token, apiBaseUrl, onProcess }) {
  const navigate = useNavigate();
  const ui = useUI();
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [showSend,      setShowSend]      = useState(false);
  const [showActions,   setShowActions]   = useState(false);
  const [actionsScroll, setActionsScroll] = useState(null); // 'receipt'|'invoice'|null
  const [fetched,       setFetched]       = useState(null);

  const status      = data?.documentStatus;
  const isDraft     = status === 'DR';
  const isCompleted = status === 'CO';

  const base    = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  // PurchaseOrderDraftChips (topbarExtra) dispatches this event when a grouped chip is clicked
  useEffect(() => {
    const handler = (e) => {
      setActionsScroll(e.detail?.scrollTo ?? null);
      setShowActions(true);
    };
    window.addEventListener('purchase-order:open-actions-modal', handler);
    return () => window.removeEventListener('purchase-order:open-actions-modal', handler);
  }, []);

  useEffect(() => {
    if (!isCompleted || !recordId) return;
    let cancelled = false;

    (async () => {
      try {
        const [receiptRes, linesRes, invoiceRes] = await Promise.all([
          fetch(`${base}/goods-receipt/goodsReceipt?criteria=${CRITERIA('salesOrder', recordId)}&_limit=50`, { headers }),
          fetch(`${apiBaseUrl}/lines?parentId=${recordId}&_startRow=0&_endRow=999`, { headers }),
          fetch(`${base}/purchase-invoice/header?criteria=${CRITERIA('salesOrder', recordId)}&_limit=50`, { headers }),
        ]);
        if (cancelled) return;

        const receipts   = receiptRes.ok   ? ((await receiptRes.json())?.response?.data   ?? []) : [];
        const orderLines = linesRes.ok     ? ((await linesRes.json())?.response?.data      ?? []) : [];
        const invoices   = invoiceRes.ok   ? ((await invoiceRes.json())?.response?.data    ?? []) : [];

        if (!cancelled) setFetched({ receipts, invoices, orderLines });
      } catch {
        if (!cancelled) setFetched({ receipts: [], invoices: [], orderLines: [] });
      }
    })();

    return () => { cancelled = true; };
  }, [isCompleted, recordId, base, headers, apiBaseUrl]);

  // ── DRAFT ──────────────────────────────────────────────────────────────────
  if (isDraft) {
    return (
      <>
        <button type="button" onClick={() => setShowConfirm(true)} style={btnPrimaryStyle}>
          {ui('poConfirmBtn')}
        </button>

        {/* Delete icon */}
        <button
          type="button"
          aria-label={ui('delete')}
          style={{ ...iconBtnStyle, color: '#ef4444', borderColor: '#fecaca' }}
          onClick={() => onProcess?.('delete')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>

        <SendDocumentButton onClick={() => setShowSend(true)} />

        {showConfirm && createPortal(
          <ConfirmModal
            orderId={recordId}
            data={data}
            apiBaseUrl={apiBaseUrl}
            base={base}
            headers={headers}
            onClose={() => setShowConfirm(false)}
          />,
          document.body,
        )}
        {showSend && createPortal(
          <SendDocumentModal
            documentType="PurchaseOrder"
            documentNo={data?.documentNo}
            bpName={data?.['businessPartner$_identifier']}
            bpEmail={data?.['userContact$_identifier']}
            documentId={recordId}
            windowName="purchase-order"
            token={token}
            onClose={() => setShowSend(false)}
          />,
          document.body,
        )}
      </>
    );
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (isCompleted) {
    if (!fetched) {
      return <span style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 8px' }}>…</span>;
    }

    const { receipts, invoices, orderLines } = fetched;

    const receiptsDraft    = receipts.filter(r => r.documentStatus === 'DR');
    const receiptsComplete = receipts.filter(r => r.documentStatus === 'CO');
    const invoiceDraft     = invoices.find(i => i.documentStatus === 'DR') ?? null;
    const invoicesComplete = invoices.filter(i => i.documentStatus === 'CO');

    const qtyOrdered   = orderLines.reduce((s, l) => s + (Number(l.orderedQuantity)   || 0), 0);
    const qtyDelivered = orderLines.reduce((s, l) => s + (Number(l.deliveredQuantity) || 0), 0);
    const qtyPending   = Math.max(0, qtyOrdered - qtyDelivered);

    const totalOrder    = Number(data?.grandTotalAmount) || 0;
    const totalInvoiced = invoicesComplete.reduce((s, i) => s + (Number(i.grandTotalAmount) || 0), 0);
    const totalPending  = Math.max(0, totalOrder - totalInvoiced);

    const currency = data?.['currency$_identifier'] || '';

    // Pending action = there is qty/amount pending AND no draft covering that action
    // (if there is a draft, the chip in topbar already covers it — Gestionar button doesn't include it)
    const needsReceipt  = qtyPending > 0 && receiptsDraft.length === 0;
    const needsInvoice  = totalPending > 0 && !invoiceDraft;

    let buttonLabel = null;
    if      (needsReceipt && needsInvoice) buttonLabel = ui('poManageReceiptAndInvoice');
    else if (needsReceipt)                 buttonLabel = ui('poManageReceipt');
    else if (needsInvoice)                 buttonLabel = ui('poManageInvoice');

    const openModal = (scrollTo = null) => {
      setActionsScroll(scrollTo);
      setShowActions(true);
    };

    const derived = {
      receiptsComplete, invoicesComplete,
      qtyOrdered, qtyDelivered, qtyPending,
      totalOrder, totalInvoiced, totalPending,
      needsReceipt, needsInvoice,
    };

    return (
      <>
        {/* Main action button — only shown when action is still pending */}
        {buttonLabel && (
          <button type="button" onClick={() => openModal(null)} style={btnPrimaryStyle}>
            {buttonLabel}
          </button>
        )}

        <SendDocumentButton onClick={() => setShowSend(true)} />

        {showActions && createPortal(
          <ActionsModal
            orderId={recordId}
            data={data}
            base={base}
            headers={headers}
            currency={currency}
            derived={derived}
            scrollTo={actionsScroll}
            onClose={() => setShowActions(false)}
          />,
          document.body,
        )}
        {showSend && createPortal(
          <SendDocumentModal
            documentType="PurchaseOrder"
            documentNo={data?.documentNo}
            bpName={data?.['businessPartner$_identifier']}
            bpEmail={data?.['userContact$_identifier']}
            documentId={recordId}
            windowName="purchase-order"
            token={token}
            onClose={() => setShowSend(false)}
          />,
          document.body,
        )}
      </>
    );
  }

  return null;
}

// ── ConfirmModal ───────────────────────────────────────────────────────────────

function ConfirmModal({ orderId, data, apiBaseUrl, base, headers, onClose }) {
  const navigate = useNavigate();
  const ui       = useUI();
  const [selected, setSelected] = useState('confirm');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [lineCount, setLineCount] = useState(null);
  const [freshData, setFreshData] = useState(null);
  const [needsReload, setNeedsReload] = useState(false);

  const orderUrl = `${apiBaseUrl}/header`;

  // Fetch fresh record + line count on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [recRes, linesRes] = await Promise.all([
          fetch(`${orderUrl}/${orderId}`, { headers }),
          fetch(`${apiBaseUrl}/lines?parentId=${orderId}&_startRow=0&_endRow=999`, { headers }),
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
  }, [orderId, orderUrl, apiBaseUrl, headers]);

  const CONFIRM_OPTIONS = [
    { value: 'confirm',  icon: <Check size={16} />,   title: ui('poConfirmOnly'),           subtitle: ui('poConfirmOnlyDesc') },
    { value: 'receipt',  icon: <Package size={16} />,  title: ui('poConfirmWithReceipt'),    subtitle: ui('poConfirmWithReceiptDesc') },
    { value: 'invoice',  icon: <FileText size={16} />, title: ui('poConfirmWithInvoice'),    subtitle: ui('poConfirmWithInvoiceDesc') },
  ];

  const d          = freshData || data || {};
  const documentNo = d.documentNo || '';
  const bpName     = d['businessPartner$_identifier'] || '';
  const grandTotal = d.grandTotalAmount ?? d.grandTotal ?? '';
  const totalLines = d.summedLineAmount ?? d.totalLines ?? grandTotal;
  const currency   = d['currency$_identifier'] || '';

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Confirm the order
      const processRes = await fetch(
        `${orderUrl}/${orderId}/action/documentAction`,
        { method: 'POST', headers, body: JSON.stringify({ docAction: 'CO' }) },
      );
      if (!processRes.ok) {
        const e = await processRes.json().catch(() => null);
        throw new Error(e?.response?.message || e?.message || `Error (${processRes.status})`);
      }
      setNeedsReload(true);
      window.dispatchEvent(new CustomEvent('purchase-order:document-created'));

      if (selected === 'receipt') {
        const res = await fetch(`${orderUrl}/${orderId}/action/createGoodsReceipt`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error((e?.response?.message || e?.message || `Error (${res.status})`));
        }
        const doc = (await res.json())?.response?.data;
        const receiptId = doc?.id ?? doc?.[0]?.id ?? null;
        onClose();
        const basePath = window.location.pathname.replace(/\/purchase-order\/.*$/, '');
        if (receiptId) navigate(`${basePath}/goods-receipt/${receiptId}`);
        else { window.location.reload(); }

      } else if (selected === 'invoice') {
        const res = await fetch(`${orderUrl}/${orderId}/action/createPurchaseInvoice`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error(ui('poOrderConfirmedInvoiceError') + (e?.response?.message || e?.message || `Error (${res.status})`));
        }
        const doc = (await res.json())?.response?.data;
        const invoiceId = doc?.id ?? doc?.[0]?.id ?? null;
        onClose();
        const basePath = window.location.pathname.replace(/\/purchase-order\/.*$/, '');
        if (invoiceId) navigate(`${basePath}/purchase-invoice/${invoiceId}`);
        else { window.location.reload(); }

      } else {
        onClose();
        window.location.reload();
      }
    } catch (e) {
      setError(e.message || ui('poErrorOccurred'));
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (needsReload) window.location.reload();
  };

  return (
    <div onClick={handleClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={cardStyle}>

        {/* Header — blue card */}
        <div style={{ padding: '14px 16px 0', position: 'relative' }}>
          <button type="button" onClick={handleClose} style={{ ...closeBtn, position: 'absolute', top: 10, right: 12 }}>&times;</button>
          <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 8 }}>
            {ui('poConfirmTitle', { number: documentNo })}
          </div>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#185FA5' }}>{bpName}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4, marginBottom: 6 }}>
              {fmtNum(grandTotal)}{currency ? ` ${currency}` : ''}
            </div>
            <div style={{ fontSize: 11, color: '#185FA5' }}>
              {lineCount != null ? ui('soLines', { count: lineCount }) : '...'}
              {' '}<span style={{ color: '#85B7EB' }}>·</span>{' '}
              {ui('soSubtotal')}{' '}
              <span style={{ fontWeight: 500, color: '#042C53' }}>
                {fmtNum(totalLines)}{currency ? ` ${currency}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '0.5px solid #E5E7EB' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 2 }}>
            {ui('soWhatToDo')}
          </div>
          {CONFIRM_OPTIONS.map(opt => (
            <OptionCard
              key={opt.value}
              selected={selected === opt.value}
              onClick={() => setSelected(opt.value)}
              icon={opt.icon}
              title={opt.title}
              subtitle={opt.subtitle}
            />
          ))}
        </div>

        {/* Warning */}
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{
            borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A',
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>🔒</span>
            <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
              {ui('poConfirmWarning')}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}>
          <button type="button" onClick={handleClose} disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{ ...btnPrimaryLg, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading && <Spinner />}
            {loading ? ui('poProcessing') : ui('poConfirmAction')}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
}

// ── ActionsModal (CO orders — Gestionar) ──────────────────────────────────────

function ActionsModal({ orderId, data, base, headers, currency, derived, scrollTo, onClose }) {
  const navigate = useNavigate();
  const ui       = useUI();
  const [loading, setLoading] = useState(null);
  const [error,   setError]   = useState(null);
  const receiptRef = useRef(null);
  const invRef     = useRef(null);

  const {
    receiptsComplete, invoicesComplete,
    qtyOrdered, qtyDelivered, qtyPending,
    totalOrder, totalInvoiced, totalPending,
    needsReceipt, needsInvoice,
  } = derived;

  const d          = data || {};
  const documentNo = d.documentNo || '';
  const bpName     = d['businessPartner$_identifier'] || '';
  const grandTotal = Number(d.grandTotalAmount) || 0;

  // Scroll to section after render
  useEffect(() => {
    if (!scrollTo) return;
    const ref = scrollTo === 'receipt' ? receiptRef.current : invRef.current;
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [scrollTo]);

  const createDoc = async (type) => {
    if (loading) return;
    setLoading(type);
    setError(null);
    try {
      const url = type === 'receipt'
        ? `${base}/purchase-order/header/${orderId}/action/createGoodsReceipt`
        : `${base}/purchase-order/header/${orderId}/action/createPurchaseInvoice`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({}) });
      if (!res.ok) {
        const e = await res.json().catch(() => null);
        throw new Error(e?.response?.message || `Error (${res.status})`);
      }
      const doc = (await res.json())?.response?.data;
      const docId = doc?.id ?? doc?.[0]?.id ?? null;
      window.dispatchEvent(new CustomEvent('purchase-order:document-created'));
      onClose();
      const basePath = window.location.pathname.replace(/\/purchase-order\/.*$/, '');
      if (type === 'receipt') navigate(`${basePath}/goods-receipt/${docId}`);
      else navigate(`${basePath}/purchase-invoice/${docId}`);
    } catch (e) {
      setError(e.message || ui('poErrorOccurred'));
      setLoading(null);
    }
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={cardStyle}>

        {/* Header */}
        <div style={{ padding: '14px 16px 0', position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ ...closeBtn, position: 'absolute', top: 10, right: 12 }}>&times;</button>
          <div style={{ fontSize: 10, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 8 }}>
            Purchase Order #{documentNo}
          </div>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#185FA5' }}>{bpName}</div>
            <div style={{ fontSize: 26, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4, marginBottom: 4 }}>
              {fmtNum(grandTotal)}{currency ? ` ${currency}` : ''}
            </div>
          </div>
        </div>

        {/* Sections where action is available (draft covers → not shown here) */}
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '0.5px solid #E5E7EB', overflowY: 'auto' }}>
          {needsReceipt && (
            <div ref={receiptRef}>
              <DocSection
                icon="📦"
                title={ui('poReceiptSection')}
                statusText={qtyOrdered > 0
                  ? (qtyDelivered > 0
                    ? ui('poQtyReceivedOf', { received: fmtNum(qtyDelivered, 0), total: fmtNum(qtyOrdered, 0), pending: fmtNum(qtyPending, 0) })
                    : `${fmtNum(qtyPending, 0)} ${ui('poPendingReceipt')}`)
                  : null}
                createLabel={ui('poCreateReceipt')}
                creating={loading === 'receipt'}
                onCreateClick={() => createDoc('receipt')}
              />
            </div>
          )}
          {needsInvoice && (
            <div ref={invRef}>
              <DocSection
                icon="🧾"
                title={ui('poInvoiceSection')}
                statusText={totalOrder > 0
                  ? (totalInvoiced > 0
                    ? ui('poAmountInvoicedOf', { invoiced: `${fmtNum(totalInvoiced)}${currency ? ` ${currency}` : ''}`, pending: `${fmtNum(totalPending)}${currency ? ` ${currency}` : ''}` })
                    : `${fmtNum(totalPending)}${currency ? ` ${currency}` : ''} ${ui('poPendingInvoice')}`)
                  : null}
                createLabel={ui('poCreateInvoice')}
                creating={loading === 'invoice'}
                onCreateClick={() => createDoc('invoice')}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA', flexShrink: 0 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>{ui('cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ── DocSection ─────────────────────────────────────────────────────────────────

function DocSection({ icon, title, statusText, createLabel, creating, onCreateClick }) {
  const ui = useUI();
  return (
    <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ marginBottom: statusText ? 6 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{icon} {title}</span>
      </div>
      {statusText && (
        <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5, marginBottom: 8 }}>
          {statusText}
        </div>
      )}
      <button type="button" onClick={onCreateClick} disabled={creating}
        style={{
          fontSize: 12, fontWeight: 500, color: '#185FA5',
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '6px 12px',
          cursor: creating ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          opacity: creating ? 0.6 : 1,
        }}>
        {creating ? ui('poCreating') : createLabel}
      </button>
    </div>
  );
}

// ── OptionCard ─────────────────────────────────────────────────────────────────

function OptionCard({ selected, onClick, icon, title, subtitle }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: selected ? '2px solid #3B82F6' : '0.5px solid #E5E7EB',
        borderRadius: 8, padding: selected ? '11px 13px' : '12px 14px',
        cursor: 'pointer',
        background: selected ? '#EFF6FF' : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 6, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: selected ? '#fff' : '#F3F4F6',
        color: selected ? '#2563EB' : '#6B7280',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: selected ? '#2563EB' : '#111827' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: selected ? 'none' : '1.5px solid #D1D5DB',
        background: selected ? '#3B82F6' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.3)',
};

const cardStyle = {
  width: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnPrimaryStyle = {
  padding: '5px 14px', borderRadius: 6, border: 'none',
  background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
};

const btnPrimaryLg = {
  fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 6,
  border: 'none', background: '#185FA5', color: '#fff', cursor: 'pointer',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const iconBtnStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 6,
  border: '1px solid var(--color-border, #e5e7eb)',
  background: 'transparent', color: 'var(--color-muted-foreground, #6b7280)',
  cursor: 'pointer',
};

const closeBtn = {
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};
