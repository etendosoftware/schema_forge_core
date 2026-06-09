import { useRef } from 'react';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import PreviewActionButtons, { PreviewPdfPanel, usePreviewSendModal, makeStaticPreviewTabs } from '../shared/PreviewActionButtons.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { useReturnToVendorPdf } from './useReturnToVendorPdf.js';
import RelatedDocumentsCard from '../shared/preview-cards/RelatedDocumentsCard.jsx';
import { STATUS_BADGE, STATUS_KEYS } from '@/components/related-documents/constants.jsx';
import { MovementSummaryCard } from '../shared/preview-cards/SummaryCard.jsx';

function ReturnToVendorStatsPanel({ shipment, partnerName, movementDate, token, apiBaseUrl, ui }) {
  const docStatus = shipment.documentStatus;
  const statusLabel = ui(STATUS_KEYS[docStatus]) || shipment['documentStatus$_identifier'] || docStatus || '—';
  const statusBadgeClass = STATUS_BADGE[docStatus] || 'bg-gray-50 text-gray-600 border-gray-200';

  const specs = [
    { key: 'sourceReceipts', type: 'goods-receipt', fetch: async () => shipment?.sourceReceipts ?? [] },
    { key: 'returnInvoices', type: 'purchase-invoice', fetch: async () => shipment?.returnInvoices ?? [] },
  ];

  const rows = [
    { label: ui('shipmentPreviewDocNo'), value: shipment.documentNo || '—' },
    { label: ui('shipmentPreviewContact'), value: partnerName },
    { label: ui('shipmentPreviewWarehouse'), value: shipment['warehouse$_identifier'] || '—' },
    { label: ui('shipmentPreviewDate'), value: movementDate },
  ];

  return (
    <div className="pb-4">
      <MovementSummaryCard
        title={ui('shipmentPreviewStatus')}
        rows={rows}
        statusRowLabel={ui('shipmentPreviewStatus')}
        statusLabel={statusLabel}
        statusBadgeClass={statusBadgeClass}
      />
      <RelatedDocumentsCard
        documentId={shipment.id}
        token={token}
        apiBaseUrl={apiBaseUrl}
        specs={specs}
      />
    </div>
  );
}

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
    const a = document.createElement('a');
    const url = URL.createObjectURL(pdfBlob);
    a.href = url;
    a.download = `dev-compra-${shipment.documentNo || 'devolucion'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        <ReturnToVendorStatsPanel
          shipment={shipment}
          partnerName={partnerName}
          movementDate={movementDate}
          token={token}
          apiBaseUrl={apiBaseUrl}
          ui={ui}
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
