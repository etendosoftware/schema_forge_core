import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ConfirmResultModal } from '@/components/contract-ui/ConfirmResultModal';
import ConfirmInOutModal from '@/components/contract-ui/ConfirmInOutModal';
import CreateInvoiceConfirmModal from '@/components/contract-ui/CreateInvoiceConfirmModal';
import { generateReturnReceiptPdf, getReturnReceiptPdfLabels } from './useReturnReceiptPdf';
import { useConfirmWithCredit } from '../shared/useConfirmWithCredit';
import PrintButton from '../shared/PrintButton';

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const navigate = useNavigate();
  const {
    ui, status, currency, confirmDisabled, hasReturnInvoice,
    headers, base, pdfLoading, showModal, setShowModal,
    creatingInvoice, result, setResult,
    handlePrint, handleCreateReturnInvoice, buildInvoiceResultFromConfirm,
  } = useConfirmWithCredit({
    data, recordId, token, apiBaseUrl,
    entitySegment: 'returnMaterialReceipt',
    invoiceRoute: '/sales-invoice/',
    invoiceType: 'facturaVenta',
    invoiceCreatedTitleKey: 'rmrInvoiceCreatedTitle',
    generatePdfFn: generateReturnReceiptPdf,
    getPdfLabelsFn: getReturnReceiptPdfLabels,
  });

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
      <PrintButton onClick={handlePrint} loading={pdfLoading} />

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
            const r = buildInvoiceResultFromConfirm(invoice);
            if (r) setResult(r); else window.location.reload();
          }}
          onClose={() => setShowModal(false)}
        />
      )}

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
