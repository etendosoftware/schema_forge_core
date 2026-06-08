import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { ConfirmResultModal } from '@/components/contract-ui/ConfirmResultModal';
import ConfirmInOutModal from '@/components/contract-ui/ConfirmInOutModal';
import CloneButton from '@/windows/custom/shared/CloneButton';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import { generateReturnReceiptPdf, getReturnReceiptPdfLabels } from './useReturnReceiptPdf';

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 50,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(20,26,38,.45)',
};

const cardStyle = {
  width: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff',
  boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '0.5px solid #E5E7EB',
};

const btnPrimary = {
  padding: '5px 14px', borderRadius: 6, border: 'none',
  background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};

const btnSecondary = {
  fontSize: 12, padding: '7px 14px', borderRadius: 6,
  border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
};

const closeBtn = {
  fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 4,
  background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
};

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

function buildInvoiceResult(inv, ui) {
  return {
    title: ui('rmrInvoiceCreatedTitle'),
    docs: inv.id ? [{
      type: 'facturaVenta',
      num: inv.documentNo,
      amount: inv.amount ?? inv.grandTotal,
      route: `/sales-invoice/${inv.id}`,
    }] : [],
  };
}

async function fetchCreateInvoice(apiBaseUrl, id, headers, ui) {
  const res = await fetch(`${apiBaseUrl}/returnMaterialReceipt/${id}/action/createReturnInvoice`, {
    method: 'POST', headers, body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(ui('couldNotCreateReturnInvoice'));
  const body = await res.json();
  const inv = body?.response?.data;
  return { id: inv?.id || null, documentNo: inv?.documentNo || '', grandTotal: inv?.grandTotal ?? null };
}


function COInvoiceModal({ busy, data, onConfirm, onClose, ui }) {
  return (
    <div onClick={() => !busy && onClose()} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={cardStyle}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{ui('createReturnInvoice')}</div>
          <button type="button" onClick={onClose} style={closeBtn}>&times;</button>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <div style={{ background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 10, padding: '14px 16px' }}>
            {data?.['businessPartner$_identifier'] && (
              <div style={{ fontSize: 11, color: '#185FA5' }}>{data['businessPartner$_identifier']}</div>
            )}
            {data?.documentNo && (
              <div style={{ fontSize: 22, fontWeight: 500, color: '#042C53', lineHeight: 1, marginTop: 4 }}>#{data.documentNo}</div>
            )}
          </div>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          <p style={{ fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{ui('rmrCreateInvoiceConfirmDesc')}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '0.5px solid #E5E7EB' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.5 : 1 }}>{ui('cancel')}</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy && <Spinner />}
            {busy ? ui('creating') : ui('createReturnInvoice')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);

  const status = data?.documentStatus;
  const currency = data?.['currency$_identifier'] || '';
  const hasReturnInvoice = Array.isArray(data?.returnInvoices)
    ? data.returnInvoices.length > 0
    : data?.hasReturnInvoice === true;
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);
  const pdfLabels = getReturnReceiptPdfLabels(ui);

  const handlePrint = useCallback(async () => {
    setPdfLoading(true);
    try {
      const blob = await generateReturnReceiptPdf(data?.id || recordId, apiBaseUrl, token, pdfLabels);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      toast.error(err.message || ui('failedToGeneratePdf'));
    } finally {
      setPdfLoading(false);
    }
  }, [data, recordId, apiBaseUrl, token, pdfLabels, ui]);

  const handleCreateConfirmed = useCallback(async () => {
    setBusy(true);
    try {
      const inv = await fetchCreateInvoice(apiBaseUrl, data?.id || recordId, headers, ui);
      setShowModal(false);
      setResult(buildInvoiceResult(inv, ui));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }, [data, recordId, apiBaseUrl, headers, ui]);

  if (status !== 'DR' && status !== 'CO') return null;

  return (
    <>
      {status === 'DR' && (
        <button type="button" data-testid="action-confirm-with-credit" onClick={() => setShowModal(true)}
          style={{ fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 8, background: '#18181b', color: '#fff', border: 'none', cursor: 'pointer', lineHeight: 1.4 }}>
          {ui('processReceipt')}
        </button>
      )}
      {status === 'CO' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!hasReturnInvoice && (
            <button type="button" data-testid="action-create-return-invoice" onClick={() => setShowModal(true)}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {ui('createReturnInvoice')}
            </button>
          )}
          <CloneButton onClick={() => setCloneOpen(true)} title={ui('cloneOrderBtn')} />
        </div>
      )}
      <PrintButton onClick={handlePrint} loading={pdfLoading} ui={ui} />

      {showModal && status === 'DR' && (
        <ConfirmInOutModal
          base={base}
          headers={headers}
          recordId={data?.id || recordId}
          specName="return-material-receipt"
          entityName="returnMaterialReceipt"
          invoiceAction="createReturnInvoice"
          defaultCreateInvoice={true}
          title={ui('returnReceipt.confirmModal.title')}
          docInfo={{ bpName: data?.['businessPartner$_identifier'], documentNo: data?.documentNo }}
          infoRowPre={ui('returnReceipt.confirmModal.infoRowPre')}
          infoRowBold={ui('returnReceipt.confirmModal.infoRowBold')}
          infoRowPost={ui('returnReceipt.confirmModal.infoRowPost')}
          cardTitle={ui('createReturnInvoice')}
          cardDesc={ui('createReturnInvoiceDescription')}
          confirmLabel={ui('processReceipt')}
          confirmWithInvoiceLabel={ui('returnReceipt.confirmModal.confirmWithInvoice')}
          processingLabel={ui('processing')}
          cancelLabel={ui('cancel')}
          onConfirmed={({ invoice }) => {
            setShowModal(false);
            setResult(invoice?.id
              ? buildInvoiceResult(invoice, ui)
              : { title: ui('receiptConfirmed'), docs: [] });
          }}
          onClose={() => setShowModal(false)}
        />
      )}
      {showModal && status === 'CO' && createPortal(
        <COInvoiceModal busy={busy} data={data} onConfirm={handleCreateConfirmed} onClose={() => setShowModal(false)} ui={ui} />,
        document.body,
      )}
      {result && createPortal(
        <ConfirmResultModal title={result.title} docs={result.docs} currency={currency}
          navigate={navigate} onClose={() => setResult(null)} />,
        document.body,
      )}
      {cloneOpen && createPortal(
        <CloneOrderModal recordId={data?.id || recordId} data={data} apiBaseUrl={apiBaseUrl}
          headers={headers} headerEntity="returnMaterialReceipt" routePrefix="/return-material-receipt/"
          onClose={() => setCloneOpen(false)} />,
        document.body,
      )}
    </>
  );
}

function PrintButton({ onClick, loading, ui }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      style={{ padding: '4px 12px', borderRadius: '6px', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
      </svg>
      {ui('print')}
    </button>
  );
}
