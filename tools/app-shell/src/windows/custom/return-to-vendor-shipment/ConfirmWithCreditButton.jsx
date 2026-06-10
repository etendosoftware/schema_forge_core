import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ConfirmResultModal } from '@/components/contract-ui/ConfirmResultModal';
import ConfirmInOutModal from '@/components/contract-ui/ConfirmInOutModal';
import CreateInvoiceConfirmModal from '@/components/contract-ui/CreateInvoiceConfirmModal';
import CloneOrderModal from '@/components/contract-ui/CloneOrderModal';
import { generateReturnToVendorPdf, getReturnToVendorPdfLabels } from './useReturnToVendorPdf';
import { useConfirmWithCredit } from '../shared/useConfirmWithCredit';
import PrintButton from '../shared/PrintButton';

export default function ConfirmWithCreditButton({ data, recordId, token, apiBaseUrl }) {
  const navigate = useNavigate();
  const {
    ui, status, currency, confirmDisabled, hasReturnInvoice,
    headers, base, pdfLoading, showModal, setShowModal,
    creatingInvoice, result, setResult,
    cloneTargets, setCloneTargets,
    handlePrint, handleCreateReturnInvoice, buildInvoiceResultFromConfirm,
  } = useConfirmWithCredit({
    data, recordId, token, apiBaseUrl,
    entitySegment: 'returnToVendorShipment',
    invoiceRoute: '/purchase-invoice/',
    invoiceType: 'facturaCompra',
    invoiceCreatedTitleKey: 'returnToVendor.invoiceCreatedTitle',
    generatePdfFn: generateReturnToVendorPdf,
    getPdfLabelsFn: getReturnToVendorPdfLabels,
  });

  if (status !== 'DR' && status !== 'CO') return null;

  return (
    <>
      {status === 'DR' && (
        <button type="button" data-testid="action-confirm-with-credit"
          onClick={() => !confirmDisabled && setShowModal(true)}
          disabled={confirmDisabled}
          style={{ fontSize: 14, fontWeight: 500, padding: '8px 18px', borderRadius: 8, background: confirmDisabled ? '#9ca3af' : '#18181b', color: '#fff', border: 'none', cursor: confirmDisabled ? 'not-allowed' : 'pointer', lineHeight: 1.4, opacity: confirmDisabled ? 0.6 : 1 }}>
          {ui('confirmReturn')}
        </button>
      )}
      {status === 'CO' && !hasReturnInvoice && (
        <button type="button" data-testid="action-create-return-invoice" onClick={() => setShowModal(true)}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: '#fff', fontWeight: 500, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {ui('createReturnInvoice')}
        </button>
      )}
      <CloneButton onClick={() => setCloneTargets([data])} label={ui('quickAction.clone')} />
      <PrintButton onClick={handlePrint} loading={pdfLoading} />

      {cloneTargets && createPortal(
        <CloneOrderModal
          records={cloneTargets}
          apiBaseUrl={apiBaseUrl}
          headers={headers}
          headerEntity="returnToVendorShipment"
          routePrefix="/return-to-vendor-shipment/"
          onClose={() => setCloneTargets(null)}
        />,
        document.body,
      )}

      {showModal && status === 'DR' && (
        <ConfirmInOutModal
          base={base}
          headers={headers}
          recordId={data?.id || recordId}
          specName="return-to-vendor-shipment"
          entityName="returnToVendorShipment"
          invoiceAction="createReturnInvoice"
          defaultCreateInvoice={true}
          title={ui('returnToVendor.confirmModal.title')}
          docInfo={{ bpName: data?.['businessPartner$_identifier'], documentNo: data?.documentNo }}
          infoRowPre={ui('returnToVendor.confirmModal.infoRowPre')}
          infoRowBold={ui('returnToVendor.confirmModal.infoRowBold')}
          infoRowPost={ui('returnToVendor.confirmModal.infoRowPost')}
          cardTitle={ui('createReturnInvoice')}
          cardDesc={ui('createReturnInvoiceDescription')}
          confirmLabel={ui('confirmReturn')}
          confirmWithInvoiceLabel={ui('returnToVendor.confirmModal.confirmWithInvoice')}
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

function CloneButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} data-testid="action-clone"
      style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #D1D5DB', background: 'transparent', color: '#6B7280', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
      {label}
    </button>
  );
}
