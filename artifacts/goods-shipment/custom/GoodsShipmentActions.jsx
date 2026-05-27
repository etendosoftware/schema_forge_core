import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI, useMenuLabel } from '@/i18n';
import ReturnWizard from './ReturnWizard';
import SendDocumentModal, { SendDocumentButton } from '@/components/contract-ui/SendDocumentModal';
import GoodsShipmentConfirmModal from './GoodsShipmentConfirmModal';
import { ConfirmResultModal } from '@/components/contract-ui';
import { generateShipmentPdf, getShipmentPdfLabels } from '@/windows/custom/goods-shipment/useShipmentPdf';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';

export default function GoodsShipmentActions({ data, recordId, token, apiBaseUrl, api }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [returnLines, setReturnLines] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedDocs, setConfirmedDocs] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadingAction, setPdfLoadingAction] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const menuRef = useRef(null);

  const isCompleted = data?.documentStatus === 'CO';
  const ci = data?.completelyInvoiced;
  const isFullyInvoiced = ci === true || ci === 'true' || ci === 'Y';

  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    const handler = () => setShowConfirmModal(true);
    window.addEventListener('goods-shipment:open-confirm-modal', handler);
    return () => window.removeEventListener('goods-shipment:open-confirm-modal', handler);
  }, []);

  const pdfLabels = getShipmentPdfLabels(ui);

  const handlePrint = async () => {
    if (pdfLoading) return;
    setPdfLoading(true); setPdfLoadingAction('print');
    try {
      const blob = await generateShipmentPdf(recordId, apiBaseUrl, token, pdfLabels);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      toast.error(err.message || ui('failedToGeneratePdf'));
    } finally {
      setPdfLoading(false); setPdfLoadingAction(null);
    }
  };

  const handleDownload = async () => {
    if (pdfLoading) return;
    setPdfLoading(true); setPdfLoadingAction('download');
    try {
      const blob = await generateShipmentPdf(recordId, apiBaseUrl, token, pdfLabels);
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `alb-${data?.documentNo || recordId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || ui('failedToGeneratePdf'));
    } finally {
      setPdfLoading(false); setPdfLoadingAction(null);
    }
  };

  useEffect(() => {
    if (!wizardOpen || !recordId || !base) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${recordId}&_startRow=0&_endRow=200`, { headers });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setReturnLines(json?.response?.data || []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [wizardOpen, recordId, base, headers]);

  const handleCreateInvoice = async (linesPayload) => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const body = linesPayload && linesPayload.length > 0 ? { lines: linesPayload } : {};
      const res = await fetch(
        `${base}/goods-shipment/goodsShipment/${recordId}/action/createDraftInvoice`,
        { method: 'POST', headers, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || err?.message || `Failed (${res.status})`);
      }
      const json = await res.json();
      const invoiceId = json?.response?.data?.id;
      const docNo = json?.response?.data?.documentNo || '';

      if (invoiceId) {
        const currentPath = window.location.pathname;
        const basePath = currentPath.replace(/\/goods-shipment\/.*$/, '');
        const invoiceUrl = `${basePath}/sales-invoice/${invoiceId}`;
        toast.custom((t) => (
          <div style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', minWidth: 380 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{`${ui('invoiceRef')}${docNo} ${ui('createdAsDraft')}`}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{ui('reviewBeforeConfirming')}</div>
            </div>
            <button
              onClick={() => { toast.dismiss(t); window.location.href = invoiceUrl; }}
              style={{ border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: '#fff', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', whiteSpace: 'nowrap' }}
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
      setShowInvoicePreview(false);
    }
  };

  return (
    <>
      {isCompleted && !isFullyInvoiced && (
        <button
          type="button"
          onClick={() => setShowInvoicePreview(true)}
          disabled={creatingInvoice}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--color-border-info, #93c5fd)', background: 'var(--color-background-info, #eff6ff)', color: 'var(--color-text-info, #2563eb)', opacity: creatingInvoice ? 0.6 : 1, cursor: creatingInvoice ? 'not-allowed' : 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-info-hover, #dbeafe)'; }}
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

      {isCompleted && (
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          style={{ padding: '4px 12px', borderRadius: '6px', borderWidth: '1px' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
            <path d="M12 15l-3 3 3 3" />
            <path d="M9 18h8" />
          </svg>
          {ui('createReturn')}
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowClone(true)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        style={{ padding: '4px 12px', borderRadius: '6px', borderWidth: '1px' }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        {ui('cloneOrderBtn')}
      </button>

      {isCompleted && <SendDocumentButton onClick={() => setShowSend(true)} />}

      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        style={{ padding: '4px 12px', borderRadius: '6px', borderWidth: '1px', opacity: pdfLoading && pdfLoadingAction === 'print' ? 0.6 : 1 }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
        {ui('print')}
      </button>

      {isCompleted && (
        <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="inline-flex items-center justify-center text-[13px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            style={{ padding: '4px 10px', borderRadius: '6px', borderWidth: '1px' }}
          >
            ⋮
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, minWidth: 170, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); handleDownload(); }}
                disabled={pdfLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', fontSize: 13, color: '#111827', background: 'none', border: 'none', cursor: pdfLoading ? 'not-allowed' : 'pointer', opacity: pdfLoading && pdfLoadingAction === 'download' ? 0.6 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                {pdfLoading && pdfLoadingAction === 'download' ? (
                  <svg style={{ width: 14, height: 14, flexShrink: 0, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                ) : (
                  <svg style={{ width: 14, height: 14, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                )}
                {ui('invoicePreviewDownloadPdf')}
              </button>
            </div>
          )}
        </div>
      )}

      {!isCompleted && showConfirmModal && (
        <GoodsShipmentConfirmModal
          base={base}
          headers={headers}
          recordId={recordId}
          onConfirmed={(docs) => { setShowConfirmModal(false); setConfirmedDocs(docs); }}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {confirmedDocs && createPortal(
        <ConfirmResultModal
          title={ui('shipmentConfirmedTitle')}
          cards={[
            confirmedDocs?.shipment?.id && { icon: '🚚', label: ui('shipmentDoc', { number: confirmedDocs.shipment.documentNo }), color: 'blue', route: `/goods-shipment/${confirmedDocs.shipment.id}`, amount: confirmedDocs.shipment.amount },
            confirmedDocs?.invoice?.id && { icon: '🧾', label: ui('invoiceDoc', { number: confirmedDocs.invoice.documentNo }), color: 'green', route: `/sales-invoice/${confirmedDocs.invoice.id}`, amount: confirmedDocs.invoice.amount },
          ].filter(Boolean)}
          currency={data?.['currency$_identifier'] || ''}
          navigate={navigate}
          ui={ui}
          onClose={() => setConfirmedDocs(null)}
        />,
        document.body,
      )}

      {showInvoicePreview && createPortal(
        <ShipmentInvoicePreview
          shipmentId={recordId}
          shipmentData={data}
          base={base}
          headers={headers}
          loading={creatingInvoice}
          onConfirm={handleCreateInvoice}
          onClose={() => setShowInvoicePreview(false)}
        />,
        document.body,
      )}

      {showClone && createPortal(
        <CloneOrderModal
          recordId={recordId}
          data={data}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          headerEntity="goodsShipment"
          routePrefix="/goods-shipment/"
          onClose={() => setShowClone(false)}
        />,
        document.body,
      )}

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      <ReturnWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        shipmentData={data}
        lines={returnLines}
        token={token}
        apiBaseUrl={apiBaseUrl}
        onSuccess={(returnData) => { setWizardOpen(false); navigate(`/return-material-receipt/${returnData?.id}`); }}
        onError={(msg) => console.error('Return creation failed:', msg)}
      />

      {showSend && createPortal(
        <SendDocumentModal
          documentType={tMenu('Goods Shipment')}
          documentNo={data?.documentNo}
          bpName={data?.['businessPartner$_identifier']}
          bPartnerId={data?.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={recordId}
          windowName="goods-shipment"
          token={token}
          onClose={() => setShowSend(false)}
        />,
        document.body,
      )}
    </>
  );
}

function ShipmentInvoicePreview({ shipmentId, shipmentData, base, headers, loading, onConfirm, onClose }) {
  const ui = useUI();
  const [lines, setLines] = useState([]);
  const [loadingLines, setLoadingLines] = useState(true);
  const [orderLinePrices, setOrderLinePrices] = useState({});
  const [existingDraft, setExistingDraft] = useState(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [lineQuantities, setLineQuantities] = useState({});

  const bpName = shipmentData?.['businessPartner$_identifier'] || '';
  const shipmentNo = shipmentData?.documentNo || '';
  const orderId = shipmentData?.salesOrder;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [linesRes, draftRes] = await Promise.all([
          fetch(`${base}/goods-shipment/goodsShipmentLine?parentId=${shipmentId}&_startRow=0&_endRow=200`, { headers }),
          fetch(`${base}/goods-shipment/goodsShipment/${shipmentId}/action/checkDraftInvoice`, { headers }),
        ]);
        if (!cancelled && linesRes.ok) {
          setLines((await linesRes.json())?.response?.data || []);
        }
        if (!cancelled && draftRes.ok) {
          const draftData = (await draftRes.json())?.response?.data;
          if (draftData?.exists) setExistingDraft(draftData);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingLines(false); }
    })();
    return () => { cancelled = true; };
  }, [shipmentId, base, headers]);

  useEffect(() => {
    if (!orderId || !base) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/sales-order/lines?parentId=${orderId}&_startRow=0&_endRow=200`, { headers });
        if (res.ok && !cancelled) {
          const json = await res.json();
          const olMap = {};
          (json?.response?.data || []).forEach(ol => { olMap[ol.id] = ol; });
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
                {ui('shipmentRef')}{shipmentNo}{bpName ? ` · ${bpName}` : ''}
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>
        </div>

        {existingDraft && !dismissedWarning && (
          <div style={{ padding: '12px 20px', background: '#FAEEDA', borderBottom: '0.5px solid #EF9F27', display: 'flex', gap: 10, flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#633806' }}>{ui('thisShipmentHasDraftInvoice')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <button type="button" onClick={() => { onClose(); const bp = window.location.pathname.replace(/\/goods-shipment\/.*$/, ''); window.location.href = `${bp}/sales-invoice/${existingDraft.id}`; }} style={{ fontSize: 12, color: '#185FA5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>{ui('viewExistingInvoice')}</button>
                <span style={{ color: '#854F0B', fontSize: 12 }}>·</span>
                <button type="button" onClick={() => setDismissedWarning(true)} style={{ fontSize: 12, color: '#854F0B', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>{ui('createAnotherAnyway')}</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {loadingLines ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('loadingShipmentLines')}</p>
          ) : enrichedLines.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '24px 0', textAlign: 'center' }}>{ui('noLinesInThisShipment')}</p>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB' }}>
                <span style={{ flex: 1 }}>{ui('product')}</span>
                <span style={{ width: 70, textAlign: 'right' }}>{ui('qty')}</span>
                <span style={{ width: 80, textAlign: 'right' }}>{ui('price')}</span>
                <span style={{ width: 90, textAlign: 'right' }}>{ui('amount')}</span>
              </div>
              {enrichedLines.map(line => {
                const productName = line['product$_identifier'] || line.id;
                const qtyEdited = line.currentQty !== line.maxQty;
                return (
                  <div key={line.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <span style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</span>
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
                  shipmentLineId: l.id,
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
