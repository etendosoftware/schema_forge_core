import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useUI } from '@/i18n';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';

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
  const [confirmedDocs,  setConfirmedDocs]  = useState(null);
  const [confirmedTitle, setConfirmedTitle] = useState(null); // null = "PO confirmed", string = custom title
  const [showClone,      setShowClone]      = useState(false);

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

        const receipts   = receiptRes.ok ? ((await receiptRes.json())?.response?.data ?? []) : [];
        const orderLines = linesRes.ok   ? ((await linesRes.json())?.response?.data  ?? []) : [];
        const invoices   = invoiceRes.ok ? ((await invoiceRes.json())?.response?.data ?? []) : [];

        if (!cancelled) setFetched({ receipts, invoices, orderLines });
      } catch {
        if (!cancelled) setFetched({ receipts: [], invoices: [], orderLines: [] });
      }
    })();

    return () => { cancelled = true; };
  }, [isCompleted, recordId, base, headers, apiBaseUrl]);

  const confirmedPanel = confirmedDocs
    ? createPortal(
        <PoConfirmResultModal
          docs={confirmedDocs}
          title={confirmedTitle}
          onClose={() => { setConfirmedDocs(null); setConfirmedTitle(null); }}
          navigate={navigate}
          ui={ui}
          currency={data?.['currency$_identifier'] || ''}
        />,
        document.body,
      )
    : null;

  const cloneButton = (
    <button type="button" onClick={() => setShowClone(true)} style={btnCloneStyle}>
      <CopyIcon />{ui('cloneOrderBtn')}
    </button>
  );

  const clonePortal = showClone ? createPortal(
    <CloneModal
      orderId={recordId}
      data={data}
      apiBaseUrl={apiBaseUrl}
      headers={headers}
      onClose={() => setShowClone(false)}
      onCloned={(newId) => navigate(`/purchase-order/${newId}`)}
    />,
    document.body,
  ) : null;

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

        {cloneButton}

        <SendDocumentButton onClick={() => setShowSend(true)} />

        {clonePortal}
        {showConfirm && createPortal(
          <ConfirmModal
            orderId={recordId}
            data={data}
            apiBaseUrl={apiBaseUrl}
            headers={headers}
            onClose={() => setShowConfirm(false)}
            onConfirmed={(docs) => { setShowConfirm(false); setConfirmedDocs(docs); }}
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
        {confirmedPanel}
      </>
    );
  }

  // ── COMPLETED ──────────────────────────────────────────────────────────────
  if (isCompleted) {
    if (!fetched) {
      return <>{confirmedPanel}<span style={{ fontSize: 12, color: '#9CA3AF', padding: '4px 8px' }}>…</span></>;
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

    const needsReceipt = qtyPending > 0 && receiptsDraft.length === 0;
    const needsInvoice = totalPending > 0 && !invoiceDraft;

    let buttonLabel = null;
    if      (needsReceipt && needsInvoice) buttonLabel = ui('poManageReceiptAndInvoice');
    else if (needsReceipt)                 buttonLabel = ui('poManageReceipt');
    else if (needsInvoice)                 buttonLabel = ui('poManageInvoice');

    const derived = {
      receiptsComplete, invoicesComplete,
      qtyOrdered, qtyDelivered, qtyPending,
      totalOrder, totalInvoiced, totalPending,
      needsReceipt, needsInvoice,
    };

    return (
      <>
        {buttonLabel && (
          <button type="button" onClick={() => setShowActions(true)} style={btnPrimaryStyle}>
            {buttonLabel}
          </button>
        )}

        {cloneButton}

        <SendDocumentButton onClick={() => setShowSend(true)} />

        {clonePortal}
        {showActions && createPortal(
          <CreateDocsModal
            orderId={recordId}
            data={data}
            base={base}
            headers={headers}
            currency={currency}
            derived={derived}
            onClose={() => setShowActions(false)}
            onCreated={(docs) => { setShowActions(false); setConfirmedTitle(ui('soDocsCreatedTitle')); setConfirmedDocs(docs); }}
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
        {confirmedPanel}
      </>
    );
  }

  return (
    <>
      {cloneButton}
      {clonePortal}
      {confirmedPanel}
    </>
  );
}

// ── ConfirmModal ───────────────────────────────────────────────────────────────

function ConfirmModal({ orderId, data, apiBaseUrl, headers, onClose, onConfirmed }) {
  const ui      = useUI();
  const [createReceipt, setCreateReceipt] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const [freshData,     setFreshData]     = useState(null);
  const [lineCount,     setLineCount]     = useState(null);

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
          const json = await recRes.json();
          const rec = json?.response?.data?.[0] ?? json;
          if (!cancelled) setFreshData(rec);
        }
        if (linesRes.ok) {
          const json = await linesRes.json();
          if (!cancelled) setLineCount(json?.response?.data?.length ?? 0);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [orderId, orderUrl, apiBaseUrl, headers]);

  const d          = freshData || data || {};
  const documentNo = d.documentNo || '';
  const bpName     = d['businessPartner$_identifier'] || '';
  const grandTotal = Number(d.grandTotalAmount ?? d.grandTotal ?? 0) || 0;
  const totalLines = d.summedLineAmount ?? d.totalLines ?? grandTotal;
  const currency   = d['currency$_identifier'] || '';

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: Confirm the order (always)
      const processRes = await fetch(
        `${orderUrl}/${orderId}/action/documentAction`,
        { method: 'POST', headers, body: JSON.stringify({ docAction: 'CO' }) },
      );
      if (!processRes.ok) {
        const e = await processRes.json().catch(() => null);
        throw new Error(e?.response?.message || e?.message || `Error (${processRes.status})`);
      }
      window.dispatchEvent(new CustomEvent('purchase-order:document-created'));

      const result = {};

      // Step 2: Create goods receipt if checked
      if (createReceipt) {
        const res = await fetch(`${orderUrl}/${orderId}/action/createGoodsReceipt`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error(e?.response?.message || e?.message || `Error (${res.status})`);
        }
        const doc = (await res.json())?.response?.data;
        const docObj = Array.isArray(doc) ? doc[0] : doc;
        result.receipt = {
          id:         docObj?.id ?? null,
          documentNo: docObj?.documentNo ?? '',
          amount:     docObj?.grandTotalAmount ?? null,
        };
      }

      // Step 3: Create purchase invoice if checked
      if (createInvoice) {
        const res = await fetch(`${orderUrl}/${orderId}/action/createPurchaseInvoice`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error(ui('poOrderConfirmedInvoiceError') + ' ' + (e?.response?.message || e?.message || `Error (${res.status})`));
        }
        const doc = (await res.json())?.response?.data;
        const docObj = Array.isArray(doc) ? doc[0] : doc;
        result.invoice = {
          id:         docObj?.id ?? null,
          documentNo: docObj?.documentNo ?? '',
          amount:     docObj?.grandTotalAmount ?? null,
        };
      }

      onConfirmed(result);
    } catch (e) {
      setError(e.message || ui('poErrorOccurred'));
      setLoading(false);
    }
  };

  const primaryLabel = (() => {
    if (createReceipt && createInvoice) return ui('poConfirmActionBoth');
    if (createReceipt)                  return ui('poConfirmActionReceipt');
    if (createInvoice)                  return ui('poConfirmActionInvoice');
    return ui('soConfirmActionOnly');
  })();

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 460 }}>

        {/* Title row */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {ui('poConfirmTitle', { number: documentNo })}
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {/* Blue summary card */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px' }}>
            {bpName && (
              <div style={{ fontSize: 11, color: '#185FA5' }}>
                {bpName}
              </div>
            )}
            <div style={{ fontSize: 28, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4, marginBottom: 6 }}>
              {grandTotal > 0 ? `${fmtNum(grandTotal)}${currency ? ` ${currency}` : ''}` : '0,00'}
            </div>
            <div style={{ fontSize: 11, color: '#185FA5', marginBottom: 10 }}>
              {lineCount != null ? (lineCount === 1 ? ui('soLine') : ui('soLines', { count: lineCount })) : '…'}
              {' '}<span style={{ color: '#85B7EB' }}>·</span>{' '}
              {ui('soSubtotal')}{' '}
              <span style={{ fontWeight: 500, color: '#042C53' }}>
                {fmtNum(totalLines)}{currency ? ` ${currency}` : ''}
              </span>
            </div>
            <div style={{ borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>🔒</span>
              <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>
                {ui('poConfirmWarning')}
              </span>
            </div>
          </div>
        </div>

        {/* Checkboxes — both optional, both can be selected simultaneously */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 2 }}>
            {ui('soGenerateDocs')}
          </div>
          <PoCheckboxCard
            checked={createReceipt}
            onChange={() => setCreateReceipt(v => !v)}
            icon="📦"
            title={ui('poCreateReceiptTitle')}
            subtitle={ui('poCreateReceiptCheckDesc')}
          />
          <PoCheckboxCard
            checked={createInvoice}
            onChange={() => setCreateInvoice(v => !v)}
            icon="🧾"
            title={ui('soCreateInvoiceTitle')}
            subtitle={ui('poCreateInvoiceCheckDesc')}
          />
        </div>

        {error && (
          <div style={{ padding: '8px 20px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading}
            style={{ ...btnSecondary, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{ ...btnPrimaryStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading && <Spinner />}
            {loading ? ui('poProcessing') : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PoCheckboxCard ─────────────────────────────────────────────────────────────

function PoCheckboxCard({ checked, onChange, icon, title, subtitle }) {
  return (
    <div
      onClick={onChange}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: checked ? '11px 13px' : '12px 14px', borderRadius: 8, cursor: 'pointer',
        border: checked ? '2px solid #3B82F6' : '1px solid #E5E7EB',
        background: checked ? '#EFF6FF' : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: checked ? '#2563EB' : '#111827' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: checked ? 'none' : '1.5px solid #D1D5DB',
        background: checked ? '#3B82F6' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}>
        {checked && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 4 7.5 10 1" />
          </svg>
        )}
      </div>
    </div>
  );
}

// ── CreateDocsModal (CO orders — create docs without re-confirming) ────────────

function CreateDocsModal({ orderId, data, base, headers, currency, derived, onClose, onCreated }) {
  const ui = useUI();
  const {
    needsReceipt, needsInvoice,
    qtyOrdered, qtyDelivered, qtyPending,
    totalOrder, totalInvoiced, totalPending,
  } = derived;

  const [createReceipt, setCreateReceipt] = useState(false);
  const [createInvoice, setCreateInvoice] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  const d          = data || {};
  const documentNo = d.documentNo || '';
  const bpName     = d['businessPartner$_identifier'] || '';
  const grandTotal = Number(d.grandTotalAmount) || 0;

  // Contextual subtitles: show pending qty/amount so the user knows what's outstanding
  const receiptSubtitle = qtyOrdered > 0
    ? (qtyDelivered > 0
        ? ui('poQtyReceivedOf', { received: fmtNum(qtyDelivered, 0), total: fmtNum(qtyOrdered, 0), pending: fmtNum(qtyPending, 0) })
        : `${fmtNum(qtyPending, 0)} ${ui('poPendingReceipt')}`)
    : ui('poCreateReceiptCheckDesc');

  const invoiceSubtitle = totalOrder > 0
    ? (totalInvoiced > 0
        ? ui('poAmountInvoicedOf', { invoiced: `${fmtNum(totalInvoiced)}${currency ? ` ${currency}` : ''}`, pending: `${fmtNum(totalPending)}${currency ? ` ${currency}` : ''}` })
        : `${fmtNum(totalPending)}${currency ? ` ${currency}` : ''} ${ui('poPendingInvoice')}`)
    : ui('poCreateInvoiceCheckDesc');

  const handleCreate = async () => {
    if (loading || (!createReceipt && !createInvoice)) return;
    setLoading(true);
    setError(null);
    try {
      const result = {};

      if (createReceipt) {
        const res = await fetch(`${base}/purchase-order/header/${orderId}/action/createGoodsReceipt`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error(e?.response?.message || `Error (${res.status})`);
        }
        const doc = (await res.json())?.response?.data;
        const docObj = Array.isArray(doc) ? doc[0] : doc;
        result.receipt = { id: docObj?.id ?? null, documentNo: docObj?.documentNo ?? '', amount: docObj?.grandTotalAmount ?? null };
      }

      if (createInvoice) {
        const res = await fetch(`${base}/purchase-order/header/${orderId}/action/createPurchaseInvoice`,
          { method: 'POST', headers, body: JSON.stringify({}) });
        if (!res.ok) {
          const e = await res.json().catch(() => null);
          throw new Error(e?.response?.message || `Error (${res.status})`);
        }
        const doc = (await res.json())?.response?.data;
        const docObj = Array.isArray(doc) ? doc[0] : doc;
        result.invoice = { id: docObj?.id ?? null, documentNo: docObj?.documentNo ?? '', amount: docObj?.grandTotalAmount ?? null };
      }

      window.dispatchEvent(new CustomEvent('purchase-order:document-created'));
      onCreated(result);
    } catch (e) {
      setError(e.message || ui('poErrorOccurred'));
      setLoading(false);
    }
  };

  const canCreate = createReceipt || createInvoice;

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 460 }}>

        {/* Title row */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {ui('soManageDocsTitle')}
          </div>
          <button type="button" onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {/* Blue summary card — no warning since order is already confirmed */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px' }}>
            {bpName && (
              <div style={{ fontSize: 11, color: '#185FA5' }}>
                {bpName}
              </div>
            )}
            <div style={{ fontSize: 28, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4 }}>
              {grandTotal > 0 ? `${fmtNum(grandTotal)}${currency ? ` ${currency}` : ''}` : '0,00'}
            </div>
          </div>
        </div>

        {/* Only show checkboxes for pending actions; subtitle shows outstanding qty/amount */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 2 }}>
            {ui('soGenerateDocs')}
          </div>
          {needsReceipt && (
            <PoCheckboxCard
              checked={createReceipt}
              onChange={() => setCreateReceipt(v => !v)}
              icon="📦"
              title={ui('poCreateReceiptTitle')}
              subtitle={receiptSubtitle}
            />
          )}
          {needsInvoice && (
            <PoCheckboxCard
              checked={createInvoice}
              onChange={() => setCreateInvoice(v => !v)}
              icon="🧾"
              title={ui('soCreateInvoiceTitle')}
              subtitle={invoiceSubtitle}
            />
          )}
        </div>

        {error && (
          <div style={{ padding: '8px 20px', fontSize: 12, color: '#DC2626', background: '#FEF2F2', borderTop: '0.5px solid #FECACA' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ ...btnSecondary, opacity: loading ? 0.5 : 1 }}>
            {ui('cancel')}
          </button>
          <button type="button" onClick={handleCreate} disabled={loading || !canCreate}
            style={{ ...btnPrimaryStyle, opacity: (loading || !canCreate) ? 0.6 : 1, cursor: (loading || !canCreate) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading && <Spinner />}
            {loading ? ui('poProcessing') : ui('soCreateDocsBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PoConfirmResultModal ───────────────────────────────────────────────────────
// Shown after confirm or create docs. Displays created docs as clickable cards.
// Cases: no docs (only confirmed), receipt only, invoice only, or both.

function PoConfirmResultModal({ docs, onClose, navigate, ui, currency, title }) {
  const { receipt, invoice } = docs;
  const hasDocs = Boolean(receipt?.id || invoice?.id);

  return (
    <div style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 400 }}>

        {/* Check + title */}
        <div style={{ padding: '28px 24px 20px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px',
            background: '#ECFDF5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {title || ui('poConfirmedTitle')}
          </div>
          {hasDocs && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5, lineHeight: 1.4 }}>
              {ui('soConfirmedSubtitle')}
            </div>
          )}
        </div>

        {/* Doc cards */}
        {hasDocs && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {receipt?.id && (
              <PoResultDocCard
                icon="📦"
                label={ui('poReceiptDoc', { number: receipt.documentNo })}
                amount={receipt.amount}
                currency={currency}
                color="blue"
                ui={ui}
                onClick={() => { onClose(); navigate(`/goods-receipt/${receipt.id}`); }}
              />
            )}
            {invoice?.id && (
              <PoResultDocCard
                icon="🧾"
                label={ui('poPurchaseInvoiceDoc', { number: invoice.documentNo })}
                amount={invoice.amount}
                currency={currency}
                color="green"
                ui={ui}
                onClick={() => { onClose(); navigate(`/purchase-invoice/${invoice.id}`); }}
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={() => { onClose(); window.location.reload(); }} style={btnSecondary}>
            {ui('soClose')}
          </button>
        </div>
      </div>
    </div>
  );
}

function PoResultDocCard({ icon, label, amount, currency, color, ui, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isBlue  = color === 'blue';
  const accent  = isBlue ? '#185FA5' : '#059669';
  const bg      = isBlue ? '#EFF6FF' : '#ECFDF5';
  const border  = isBlue ? '#BFDBFE' : '#A7F3D0';
  const hoverBg = isBlue ? '#DBEAFE' : '#D1FAE5';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${border}`,
        background: hovered ? hoverBg : bg,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: accent }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          {amount != null && Number(amount) !== 0 && (
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {fmtNum(amount)}{currency ? ` ${currency}` : ''}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
            background: '#FEF3C7', color: '#92400E',
          }}>
            {ui('statusDraft')}
          </span>
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" style={{ flexShrink: 0 }}>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  );
}

// ── CopyIcon ───────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ── CloneModal ─────────────────────────────────────────────────────────────────

function CloneModal({ orderId, data, apiBaseUrl, headers, onClose, onCloned }) {
  const ui = useUI();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [lines,   setLines]   = useState(null); // null = loading

  const documentNo = data?.documentNo || '';
  const bpName     = data?.['businessPartner$_identifier'] || '';
  const status     = data?.documentStatus;
  const currency   = data?.['currency$_identifier'] || '';
  const total      = Number(data?.grandTotalAmount) || 0;

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/lines?parentId=${orderId}&_startRow=0&_endRow=999`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled) setLines(json?.response?.data ?? []); })
      .catch(() => { if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [orderId, apiBaseUrl, headers]);

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
      const res  = await fetch(`${apiBaseUrl}/header/${orderId}/action/cloneOrder`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.response?.error?.message || ui('cloneOrderError'));
        return;
      }
      const newId = json?.response?.data?.id;
      onClose();
      onCloned(newId);
    } catch {
      setError(ui('cloneOrderError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={{ ...cardStyle, width: 440 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{ui('cloneOrderConfirmTitle')}</span>
          <button type="button" onClick={onClose} style={closeBtn}>×</button>
        </div>

        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary card */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            {/* Row 1: contact · docNo · badge */}
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
            {/* Row 2: products + total */}
            <div style={{ padding: '6px 14px 9px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{productLine}</span>
            </div>
          </div>

          {/* Explanatory text — same horizontal inset as card content */}
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, padding: '0 2px' }}>{ui('cloneOrderConfirmBody')}</p>

          {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading} style={btnSecondary}>
              {ui('cancel')}
            </button>
            <button type="button" onClick={handleClone} disabled={loading}
              style={{ ...btnPrimaryStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading && <Spinner />}
              {loading ? ui('poProcessing') : ui('cloneOrderAction')}
            </button>
          </div>
        </div>
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

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const btnCloneStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#374151', cursor: 'pointer',
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
