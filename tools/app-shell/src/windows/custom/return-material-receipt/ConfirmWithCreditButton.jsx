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

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
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

  if (status !== 'DR' && status !== 'CO') return null;

  const sharedModalProps = {
    base,
    headers,
    recordId: data?.id || recordId,
    specName: 'return-material-receipt',
    entityName: 'returnMaterialReceipt',
    invoiceAction: 'createReturnInvoice',
    docInfo: { bpName: data?.['businessPartner$_identifier'], documentNo: data?.documentNo },
    cardTitle: ui('createReturnInvoice'),
    cardDesc: ui('createReturnInvoiceDescription'),
    confirmWithInvoiceLabel: ui('returnReceipt.confirmModal.confirmWithInvoice'),
    processingLabel: ui('processing'),
    cancelLabel: ui('cancel'),
    onClose: () => setShowModal(false),
  };

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
          {...sharedModalProps}
          defaultCreateInvoice={true}
          title={ui('returnReceipt.confirmModal.title')}
          infoRowPre={ui('returnReceipt.confirmModal.infoRowPre')}
          infoRowBold={ui('returnReceipt.confirmModal.infoRowBold')}
          infoRowPost={ui('returnReceipt.confirmModal.infoRowPost')}
          confirmLabel={ui('processReceipt')}
          onConfirmed={({ invoice }) => {
            setShowModal(false);
            if (invoice?.id) {
              setResult(buildInvoiceResult(invoice, ui));
            } else {
              window.location.reload();
            }
          }}
        />
      )}

      {showModal && status === 'CO' && (
        <ConfirmInOutModal
          {...sharedModalProps}
          skipDocumentAction={true}
          title={ui('createReturnInvoice')}
          confirmLabel={ui('createReturnInvoice')}
          onConfirmed={({ invoice }) => {
            setShowModal(false);
            setResult(buildInvoiceResult(invoice, ui));
          }}
        />
      )}

      {result && createPortal(
        <ConfirmResultModal title={result.title} docs={result.docs} currency={currency}
          navigate={navigate} onClose={() => { setResult(null); window.location.reload(); }} />,
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
