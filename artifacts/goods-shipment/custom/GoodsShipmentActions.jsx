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
  const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [returnLines, setReturnLines] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadingAction, setPdfLoadingAction] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const menuRef = useRef(null);

  const isCompleted = data?.documentStatus === 'CO';
  const isFullyInvoiced = data?.invoiceStatus >= 100;
  const hasReturn = Array.isArray(data?.returnReceipts) && data.returnReceipts.length > 0;

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

  const handleCreateInvoice = async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch(
        `${base}/goods-shipment/goodsShipment/${recordId}/action/createDraftInvoice`,
        { method: 'POST', headers, body: JSON.stringify({}) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || err?.message || `Failed (${res.status})`);
      }
      const json = await res.json();
      const invoiceId = json?.response?.data?.id;
      const docNo = json?.response?.data?.documentNo || '';
      setInvoiceResult({
        invoice: {
          id: invoiceId || null,
          documentNo: docNo,
          amount: json?.response?.data?.grandTotalAmount ?? null,
        },
      });
    } catch (err) {
      toast.error(err.message || ui('failedToCreateInvoice'));
    } finally {
      setCreatingInvoice(false);
    }
  };

  return (
    <>
      {isCompleted && !isFullyInvoiced && (
        <button
          type="button"
          onClick={() => setShowInvoiceConfirm(true)}
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

      {isCompleted && !hasReturn && (
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
          data={data}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {showInvoiceConfirm && createPortal(
        <CreateInvoiceConfirmModal
          data={data}
          recordId={recordId}
          base={base}
          headers={headers}
          loading={creatingInvoice}
          onConfirm={() => { setShowInvoiceConfirm(false); handleCreateInvoice(); }}
          onClose={() => setShowInvoiceConfirm(false)}
        />,
        document.body,
      )}

      {invoiceResult && createPortal(
        <ConfirmResultModal
          docs={invoiceResult}
          ui={ui}
          navigate={navigate}
          currency={data?.['currency$_identifier'] || ''}
          title={ui('soInvoiceCreated')}
          onClose={() => setInvoiceResult(null)}
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
        onSuccess={(returnData) => {
          setWizardOpen(false);
          if (returnData?.id) {
            navigate(`/return-material-receipt/${returnData.id}`);
          } else {
            window.location.reload();
          }
        }}
        onError={(msg) => toast.error(msg)}
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

function CreateInvoiceConfirmModal({ data, recordId, base, headers, loading, onConfirm, onClose }) {
  const ui = useUI();
  const [checked, setChecked] = useState(true);
  const [pendingQty, setPendingQty] = useState(null);

  const documentNo  = data?.documentNo || '';
  const bpName      = data?.['businessPartner$_identifier'] || '';
  // M_InOut has no grandTotalAmount — fall back to the linked order's total
  const linkedOrder = Array.isArray(data?.linkedOrders) ? data.linkedOrders[0] : null;
  const currency    = linkedOrder?.['currency$_identifier'] || data?.['currency$_identifier'] || '';
  const grandTotal  = Number(linkedOrder?.grandTotalAmount ?? data?.grandTotalAmount ?? 0);

  const fmtNum = (v, dec = 2) =>
    v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '-';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${base}/goods-shipment/goodsShipment/${recordId}/action/pendingInvoiceLines`,
          { headers },
        );
        if (!res.ok || cancelled) return;
        const lines = (await res.json())?.response?.data || [];
        const total = lines.reduce((sum, l) => sum + Number(l.pendingQty || 0), 0);
        if (!cancelled) setPendingQty(total);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [recordId, base, headers]);

  const subtitle = pendingQty != null
    ? ui('soAmountPendingInvoice', { pending: `${fmtNum(pendingQty, 0)} ${ui('units')}` })
    : ui('soCreateInvoiceCheckDesc');

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, width: 460 }}>

        {/* Title row */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
            {ui('soManageDocsTitle')}
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* Blue summary card */}
        <div style={{ padding: '14px 20px' }}>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px' }}>
            {bpName && <div style={{ fontSize: 11, color: '#185FA5' }}>{bpName}</div>}
            <div style={{ fontSize: 28, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4 }}>
              {grandTotal > 0 ? `${fmtNum(grandTotal)}${currency ? ` ${currency}` : ''}` : documentNo}
            </div>
          </div>
        </div>

        {/* Invoice checkbox card */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 2 }}>
            {ui('soGenerateDocs')}
          </div>
          <InvoiceCheckboxCard
            checked={checked}
            onChange={() => setChecked(v => !v)}
            subtitle={subtitle}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={loading} style={{ ...btnSecondary, opacity: loading ? 0.5 : 1 }}>
            {ui('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !checked}
            style={{ ...btnPrimary, opacity: (loading || !checked) ? 0.6 : 1, cursor: (loading || !checked) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loading && <Spinner />}
            {loading ? ui('soProcessing') : ui('soCreateDocsBtn')}
          </button>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
}

function InvoiceCheckboxCard({ checked, onChange, subtitle }) {
  const ui = useUI();
  return (
    <div
      onClick={onChange}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: checked ? '11px 13px' : '12px 14px', borderRadius: 8,
        cursor: 'pointer',
        border: checked ? '2px solid #3B82F6' : '1px solid #E5E7EB',
        background: checked ? '#EFF6FF' : '#fff',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🧾</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: checked ? '#2563EB' : '#111827' }}>
          {ui('soCreateInvoiceTitle')}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: checked ? 'none' : '1.5px solid #D1D5DB',
        background: checked ? '#3B82F6' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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

function Spinner() {
  return (
    <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

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

const closeBtnStyle = {
  position: 'absolute', top: 10, right: 12,
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const btnPrimary = {
  fontSize: 12, fontWeight: 500, padding: '7px 16px', borderRadius: 6,
  border: 'none', background: '#185FA5', color: '#fff', cursor: 'pointer',
};

