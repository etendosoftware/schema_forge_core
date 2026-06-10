import { useRef } from 'react';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import PreviewActionButtons, { PreviewPdfPanel, usePreviewSendModal, makeStaticPreviewTabs, ReceiptSendModal } from '../shared/PreviewActionButtons.jsx';
import { useReturnReceiptPdf } from './useReturnReceiptPdf.js';
import ReturnDocStatsPanel from '../shared/preview-cards/ReturnDocStatsPanel.jsx';
import { downloadBlobAsFile } from '../shared/pdfUtils.js';

export default function ReturnMaterialReceiptPreview({ receipt, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const modalRef = useRef(null);

  const sendModal = usePreviewSendModal();

  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = useReturnReceiptPdf(
    receipt?.id ?? null,
    apiBaseUrl,
    token,
  );

  if (!receipt) return null;

  const leftPanel = (
    <PreviewPdfPanel
      pdfLoading={pdfLoading}
      pdfError={pdfError}
      pdfUrl={pdfUrl}
      generatingText={ui('returnReceiptPdfGenerating')}
      errorText={ui('returnReceiptPdfError')}
    />
  );

  const partnerName = receipt['businessPartner$_identifier'] || '—';
  const movementDate = receipt.movementDate
    ? formatCalendarDate(receipt.movementDate, locale)
    : '—';
  const windowLabel = tMenu('Return Material Receipt');

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadBlobAsFile(pdfBlob, `dev-${receipt.documentNo || 'devolucion'}.pdf`);
  };

  const specs = [
    { key: 'sourceShipments', type: 'shipment', fetch: async () => receipt?.sourceShipments ?? [] },
    { key: 'returnInvoices', type: 'sales-invoice', fetch: async () => receipt?.returnInvoices ?? [] },
  ];

  const actionButtons = (
    <PreviewActionButtons
      onEmail={sendModal.openEmailModal}
      onDownloadPdf={handleDownload}
      hasPdf={!!pdfBlob}
      triggerEdit={() => modalRef.current?.triggerEdit?.()}
      sendLabel={ui('invoicePreviewSend')}
      downloadLabel={ui('invoicePreviewDownloadPdf')}
      editLabel={ui('invoicePreviewEdit')}
    />
  );

  const tabs = [
    {
      key: 'general',
      label: ui('invoicePreviewGeneral'),
      content: (
        <ReturnDocStatsPanel
          doc={receipt}
          partnerName={partnerName}
          movementDate={movementDate}
          token={token}
          apiBaseUrl={apiBaseUrl}
          ui={ui}
          specs={specs}
        />
      ),
    },
    ...makeStaticPreviewTabs(ui),
  ];

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${receipt.documentNo}`}
        subtitle={partnerName !== '—' ? `${ui('invoicePreviewClient')} ${partnerName}` : undefined}
        leftPanel={leftPanel}
        onClose={onClose}
        onEdit={() => onEdit?.(receipt.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />
      <ReceiptSendModal
        sendModal={sendModal}
        documentType={windowLabel}
        receipt={receipt}
        partnerName={partnerName}
        apiBaseUrl={apiBaseUrl}
        token={token}
        windowName="return-material-receipt"
        pdfBlobUrl={pdfUrl}
      />
    </>
  );
}
