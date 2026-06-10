import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { ConfirmResultModal } from '@/components/contract-ui/ConfirmResultModal';
import ConfirmInOutModal from '@/components/contract-ui/ConfirmInOutModal';
import CreateInvoiceConfirmModal from '@/components/contract-ui/CreateInvoiceConfirmModal';
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
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [result, setResult] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const base = useMemo(() => (apiBaseUrl || '').replace(/\/[^/]+$/, ''), [apiBaseUrl]);

  const status = data?.documentStatus;
  const currency = data?.['currency$_identifier'] || '';
  const confirmDisabled = typeof data?.linesCount === 'number' && data.linesCount === 0;
  const hasReturnInvoice = Array.isArray(data?.returnInvoices)
    ? data.returnInvoices.some(inv => inv.documentStatus === 'CO')
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

  const handleCreateReturnInvoice = useCallback(async () => {
    if (creatingInvoice) return;
    setCreatingInvoice(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/returnMaterialReceipt/${data?.id || recordId}/action/createReturnInvoice`,
        { method: 'POST', headers, body: JSON.stringify({}) },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.response?.message || err?.message || `Error (${res.status})`);
      }
      const invData = (await res.json())?.response?.data;
      setResult(buildInvoiceResult(
        { id: invData?.id ?? null, documentNo: invData?.documentNo || '', amount: invData?.grandTotalAmount ?? null },
        ui,
      ));
    } catch (err) {
      toast.error(err.message || ui('couldNotCreateReturnInvoice'));
    } finally {
      setCreatingInvoice(false);
    }
  }, [data, recordId, apiBaseUrl, headers, ui, creatingInvoice]);

  if (status !== 'DR' && status !== 'CO') return null;

  return (
    <>
      {status === 'DR' && (
        <button type="button" data-testid="action-confirm-with-credit"
          onClick={() => !confirmDisabled && setShowModal(true)}
          disabled={confirmDisabled}
          style={{ fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 8, background: confirmDisabled ? '#9ca3af' : '#18181b', color: '#fff', border: 'none', cursor: confirmDisabled ? 'not-allowed' : 'pointer', lineHeight: 1.4, opacity: confirmDisabled ? 0.6 : 1 }}>
          {ui('processReceipt')}
        </button>
      )}
      {status === 'CO' && !hasReturnInvoice && (
        <button type="button" data-testid="action-create-return-invoice" onClick={() => setShowModal(true)}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {ui('createReturnInvoice')}
        </button>
      )}
      <PrintButton onClick={handlePrint} loading={pdfLoading} ui={ui} />

      {/* DR: confirm receipt (+ optional return invoice) */}
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
            if (invoice?.id) {
              setResult(buildInvoiceResult(invoice, ui));
            } else {
              window.location.reload();
            }
          }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* CO: create return invoice for already-confirmed receipt */}
      {showModal && status === 'CO' && createPortal(
        <CreateInvoiceConfirmModal
          data={data}
          loading={creatingInvoice}
          onConfirm={() => { setShowModal(false); handleCreateReturnInvoice(); }}
          onClose={() => setShowModal(false)}
        />,
        document.body,
      )}

      {result && createPortal(
        <ConfirmResultModal
          title={result.title}
          docs={result.docs}
          currency={currency}
          navigate={navigate}
          primary={result.docs.length > 0 ? ui('soViewInvoice') : undefined}
          onClose={() => setResult(null)}
        />,
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
