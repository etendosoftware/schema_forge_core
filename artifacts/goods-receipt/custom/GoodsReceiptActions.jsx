import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI, useMenuLabel } from '@/i18n';
import ConfirmDocumentModal from '@/components/contract-ui/ConfirmDocumentModal';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal';
import { ConfirmResultModal } from '@/components/contract-ui';
import { usePreviewAttachment } from '@/windows/custom/shared/usePreviewAttachment.js';
import PurchaseReturnWizard from './PurchaseReturnWizard';

// ── ReceiptInvoicePreview ─────────────────────────────────────────────────────

function ReceiptInvoicePreview({ receiptId, receiptData, base, headers, loading, onConfirm, onClose }) {
  const ui = useUI();
  const [lines, setLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [orderLinePrices, setOrderLinePrices] = useState({});
  const [lineQuantities, setLineQuantities] = useState({});

  const bpName = receiptData?.['businessPartner$_identifier'] || '';
  const receiptNo = receiptData?.documentNo || '';
  const orderId = receiptData?.salesOrder;

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

  useEffect(() => {
    if (!orderId || !base) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${base}/purchase-order/lines?parentId=${orderId}&_startRow=0&_endRow=200`,
          { headers },
        );
        if (res.ok && !cancelled) {
          const olMap = {};
          ((await res.json())?.response?.data || []).forEach(ol => { olMap[ol.id] = ol; });
          setOrderLinePrices(olMap);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [orderId, base, headers]);

  const enrichedLines = useMemo(() =>
    lines.map(l => {
      const ol = orderLinePrices[l.salesOrderLine] || {};
      const unitPrice = Number(ol.unitPrice) || 0;
      const maxQty = Number(l.movementQuantity) || 0;
      const currentQty = lineQuantities[l.id] ?? maxQty;
      return { ...l, unitPrice, maxQty, currentQty, lineTotal: unitPrice * currentQty };
    }),
    [lines, orderLinePrices, lineQuantities],
  );

  useEffect(() => {
    if (lines.length > 0 && Object.keys(lineQuantities).length === 0) {
      const defaults = {};
      lines.forEach(l => { defaults[l.id] = Number(l.movementQuantity) || 0; });
      setLineQuantities(defaults);
    }
  }, [lines]);

  const total = useMemo(() => enrichedLines.reduce((sum, l) => sum + l.lineTotal, 0), [enrichedLines]);

  const fmtNum = (v) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div onClick={e => e.stopPropagation()} style={{ width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB' }}>

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
          ) : enrichedLines.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('noLinesInThisReceipt')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB' }}>
                <span style={{ flex: 1 }}>{ui('product')}</span>
                <span style={{ width: 70, textAlign: 'right' }}>{ui('qty')}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{ui('price')}</span>
                <span style={{ width: 90, textAlign: 'right' }}>{ui('amount')}</span>
              </div>
              {enrichedLines.map(line => {
                const qtyEdited = line.currentQty !== line.maxQty;
                return (
                  <div key={line.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <span style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {line['product$_identifier'] || line.id}
                    </span>
                    <span style={{ width: 70, textAlign: 'right' }}>
                      <input
                        type="number"
                        min={1}
                        max={line.maxQty}
                        value={line.currentQty}
                        onChange={e => {
                          const v = Math.max(1, Math.min(line.maxQty, Number(e.target.value) || 1));
                          setLineQuantities(prev => ({ ...prev, [line.id]: v }));
                        }}
                        style={{
                          width: 56, fontSize: 12, padding: '2px 4px', borderRadius: 4, textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums', outline: 'none',
                          border: qtyEdited ? '1px solid #f59e0b' : '0.5px solid #d1d5db',
                          background: qtyEdited ? '#fffbeb' : '#fff',
                        }}
                      />
                    </span>
                    <span style={{ width: 80, fontSize: 12, color: '#6B7280', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {fmtNum(line.unitPrice)}
                    </span>
                    <span style={{ width: 90, fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 500 }}>
                      {fmtNum(line.lineTotal)}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F5F5F5', borderTop: '1px solid #E5E5E5', padding: '10px 16px', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {enrichedLines.length > 0 && (
              <>
                {enrichedLines.length} {ui('line')}{enrichedLines.length !== 1 ? 's' : ''}
                {' · '}<span style={{ fontWeight: 500, color: '#378ADD' }}>{ui('total')}: {fmtNum(total)}</span>
              </>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>
              {ui('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                const payload = enrichedLines.map(l => ({
                  receiptLineId: l.id,
                  quantity: String(l.currentQty),
                }));
                onConfirm(payload);
              }}
              disabled={enrichedLines.length === 0 || loading}
              style={{ fontSize: 13, fontWeight: 500, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#18181b', color: '#fff', cursor: (enrichedLines.length === 0 || loading) ? 'not-allowed' : 'pointer', opacity: (enrichedLines.length === 0 || loading) ? 0.4 : 1 }}
            >
              {loading ? ui('creating') : ui('createInvoiceBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoodsReceiptActions({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [returnLines, setReturnLines] = useState([]);
  const [returnedDoc, setReturnedDoc] = useState(null);
  const [isCloneHovered, setIsCloneHovered] = useState(false);
  const [confirmedDocs, setConfirmedDocs] = useState(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const isCompleted = data?.documentStatus === 'CO';
  const isFullyInvoiced = (parseFloat(data?.invoiceStatus ?? 0)) >= 100;

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const downloadLinkRef = useRef(null);

  const previewAttachment = usePreviewAttachment({
    documentId: recordId,
    specName: 'goods-receipt',
    storeCondition: isCompleted,
    token,
    apiBaseUrl,
  });
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  useEffect(() => {
    const handler = () => setShowConfirm(true);
    window.addEventListener('goods-receipt:open-confirm-modal', handler);
    return () => window.removeEventListener('goods-receipt:open-confirm-modal', handler);
  }, []);

  useEffect(() => {
    const handler = () => downloadLinkRef.current?.click();
    window.addEventListener('goods-receipt:download-pdf', handler);
    return () => window.removeEventListener('goods-receipt:download-pdf', handler);
  }, []);

  useEffect(() => {
    if (!wizardOpen || !recordId || !base) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${base}/goods-receipt/goodsReceiptLine?parentId=${recordId}&_startRow=0&_endRow=200`,
          { headers },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setReturnLines(json?.response?.data || []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [wizardOpen, recordId, base, headers]);

  const handleCreateInvoice = async (lines) => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch(
        `${base}/goods-receipt/goodsReceipt/${recordId}/action/createPurchaseInvoice`,
        { method: 'POST', headers, body: JSON.stringify({ lines: lines || [] }) },
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

  const sqBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, width: 36, borderRadius: 6, border: '1px solid #D1D4DB', background: '#FFFFFF', color: '#64748B', cursor: 'pointer', boxShadow: '0px 1px 2px 0px #1212170D', flexShrink: 0 };
  const textBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', flexShrink: 0 };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowClone(true)}
        title={ui('cloneOrderBtn')}
        style={{ ...sqBtn, background: isCloneHovered ? '#F1F5F9' : '#FFFFFF' }}
        onMouseEnter={() => setIsCloneHovered(true)}
        onMouseLeave={() => setIsCloneHovered(false)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      {isCompleted && (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          style={{ ...textBtn, border: '1px solid #D1D4DB', background: '#FFFFFF', color: '#64748B' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
            <path d="M12 15l-3 3 3 3" />
            <path d="M9 18h8" />
          </svg>
          {ui('createReturn')}
        </button>
      )}

      {isCompleted && !isFullyInvoiced && (
        <button
          type="button"
          onClick={() => setShowInvoicePreview(true)}
          style={{ ...textBtn, border: '1px solid var(--color-border-info, #93c5fd)', background: 'var(--color-background-info, #eff6ff)', color: 'var(--color-text-info, #2563eb)' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-background-info, #eff6ff)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
        <ConfirmResultModal
          title={ui('goodsReceipt.confirmModal.confirmedTitle')}
          cards={[
            confirmedDocs?.invoice?.id && { icon: '🧾', label: ui('poPurchaseInvoiceDoc', { number: confirmedDocs.invoice.documentNo }), color: 'green', route: `/purchase-invoice/${confirmedDocs.invoice.id}`, amount: confirmedDocs.invoice.amount },
          ].filter(Boolean)}
          currency={data?.['currency$_identifier'] || ''}
          navigate={navigate}
          ui={ui}
          onClose={() => setConfirmedDocs(null)}
        />,
        document.body,
      )}

      {returnedDoc && createPortal(
        <ConfirmResultModal
          title={ui('purchaseReturnCreatedTitle')}
          cards={[{ icon: '📦', label: ui('purchaseReturnDocLabel', { number: returnedDoc.documentNo }), color: 'blue', route: `/return-to-vendor-shipment/${returnedDoc.id}` }]}
          currency=""
          navigate={navigate}
          ui={ui}
          onClose={() => setReturnedDoc(null)}
        />,
        document.body,
      )}

      {isCompleted && previewAttachment.storedFile && (
        <a
          ref={downloadLinkRef}
          href={previewAttachment.storedFile.objectUrl}
          download={previewAttachment.storedFile.fileName}
          title={previewAttachment.storedFile.fileName}
          style={{ ...sqBtn, textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      )}

      {isCompleted && (
        <button
          type="button"
          onClick={() => setShowSend(true)}
          title={ui('quickAction.email')}
          style={sqBtn}
          onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </button>
      )}

      {showSend && createPortal(
        <SendDocumentModal
          documentType={tMenu('Goods Receipt')}
          documentNo={data?.documentNo}
          bpName={data?.['businessPartner$_identifier']}
          bPartnerId={data?.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={recordId}
          windowName="goods-receipt"
          token={token}
          pdfBlobUrl={previewAttachment.storedFile?.objectUrl}
          pdfBlobLoading={false}
          onClose={() => setShowSend(false)}
        />,
        document.body,
      )}

      <PurchaseReturnWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        receiptData={data}
        lines={returnLines}
        base={base}
        headers={headers}
        onSuccess={(result) => { setWizardOpen(false); setReturnedDoc(result); }}
        onError={(msg) => toast.error(msg)}
      />

      {showClone && createPortal(
        <CloneReceiptModal
          receiptId={recordId}
          data={data}
          base={base}
          headers={headers}
          onClose={() => setShowClone(false)}
          onCloned={(newId) => { setShowClone(false); navigate(`/goods-receipt/${newId}`); }}
        />,
        document.body,
      )}
    </>
  );
}

// ── CloneReceiptModal ─────────────────────────────────────────────────────────

function CloneReceiptModal({ receiptId, data, base, headers, onClose, onCloned }) {
  const ui = useUI();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lines, setLines] = useState(null);

  const documentNo = data?.documentNo || '';
  const bpName = data?.['businessPartner$_identifier'] || '';
  const status = data?.documentStatus;

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}/goods-receipt/goodsReceiptLine?parentId=${receiptId}&_startRow=0&_endRow=999`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (!cancelled) setLines(json?.response?.data ?? []); })
      .catch(() => { if (!cancelled) setLines([]); });
    return () => { cancelled = true; };
  }, [receiptId, base, headers]);

  const statusMap = {
    DR: { label: ui('orderStatusDraft'), bg: '#FEF3C7', color: '#D97706' },
    CO: { label: ui('orderStatusCompleted'), bg: '#DCFCE7', color: '#16A34A' },
  };
  const badge = statusMap[status] || { label: status, bg: '#F3F4F6', color: '#6B7280' };
  const lineCount = lines?.length ?? null;
  const lineLabel = lineCount === null ? '…' : lineCount === 1 ? ui('soLine') : ui('soLines', { count: lineCount });

  const handleClone = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/goods-receipt/goodsReceipt/${receiptId}/action/cloneRecord`, { method: 'POST', headers });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.response?.error?.message || ui('cloneReceiptError'));
        return;
      }
      onCloned(json?.response?.data?.id);
    } catch {
      setError(ui('cloneReceiptError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
      <div style={{ width: 440, borderRadius: 12, backgroundColor: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{ui('cloneReceiptConfirmTitle')}</span>
          <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>&times;</button>
        </div>

        <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F9FAFB' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bpName}</span>
              {documentNo && <span style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>{documentNo}</span>}
              {status && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: badge.bg, color: badge.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{badge.label}</span>}
            </div>
            <div style={{ padding: '6px 14px 9px', background: '#F9FAFB', borderTop: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{lineLabel}</span>
            </div>
          </div>

          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, padding: '0 2px' }}>{ui('cloneReceiptConfirmBody')}</p>
          {error && <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer' }}>{ui('cancel')}</button>
            <button type="button" onClick={handleClone} disabled={loading} style={{ fontSize: 13, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {loading ? ui('creating') : ui('cloneReceiptAction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
