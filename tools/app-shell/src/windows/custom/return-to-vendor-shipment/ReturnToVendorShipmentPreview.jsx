import { useRef } from 'react';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import PreviewActionButtons, { PreviewPdfPanel, usePreviewSendModal, makeStaticPreviewTabs } from '../shared/PreviewActionButtons.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { useReturnToVendorPdf } from './useReturnToVendorPdf.js';
import ReturnDocStatsPanel from '../shared/preview-cards/ReturnDocStatsPanel.jsx';
import { downloadBlobAsFile } from '../shared/pdfUtils.js';

export default function ReturnToVendorShipmentPreview({ shipment, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const modalRef = useRef(null);

  const { showSendModal, sendModalClosing, openEmailModal, closeEmailModal } = usePreviewSendModal();

  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = useReturnToVendorPdf(
    shipment?.id ?? null,
    apiBaseUrl,
    token,
  );

  if (!shipment) return null;

  const leftPanel = (
    <PreviewPdfPanel
      pdfLoading={pdfLoading}
      pdfError={pdfError}
      pdfUrl={pdfUrl}
      generatingText={ui('returnToVendorPdfGenerating')}
      errorText={ui('returnToVendorPdfError')}
    />
  );

  const partnerName = shipment['businessPartner$_identifier'] || '—';
  const movementDate = shipment.movementDate
    ? formatCalendarDate(shipment.movementDate, locale)
    : '—';
  const windowLabel = tMenu('Return to Vendor Shipment');

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadBlobAsFile(pdfBlob, `dev-compra-${shipment.documentNo || 'devolucion'}.pdf`);
  };

  const specs = [
    { key: 'sourceReceipts', type: 'goods-receipt', fetch: async () => shipment?.sourceReceipts ?? [] },
    { key: 'returnInvoices', type: 'purchase-invoice', fetch: async () => shipment?.returnInvoices ?? [] },
  ];

  const actionButtons = (
    <PreviewActionButtons
      onEmail={openEmailModal}
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
          doc={shipment}
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
        title={`${windowLabel} ${shipment.documentNo}`}
        subtitle={partnerName !== '—' ? `${ui('returnToVendorPreviewVendor')} ${partnerName}` : undefined}
        leftPanel={leftPanel}
        onClose={onClose}
        onEdit={() => onEdit?.(shipment.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />
      {showSendModal && (
        <SendDocumentModal
          documentType={windowLabel}
          documentNo={shipment.documentNo}
          bpName={partnerName}
          bPartnerId={shipment.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={shipment.id}
          windowName="return-to-vendor-shipment"
          token={token}
          pdfBlobUrl={pdfUrl}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
