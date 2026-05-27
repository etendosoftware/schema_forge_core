import { useRef, useState, useCallback } from 'react';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import PreviewActionButtons, { PreviewPdfPanel, PreviewEmptyPanel } from '../shared/PreviewActionButtons.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { useReturnReceiptPdf } from './useReturnReceiptPdf.js';
import RelatedDocuments from '@generated/return-material-receipt/custom/RelatedDocuments';
import { STATUS_BADGE, STATUS_KEYS } from '@/components/related-documents/constants.jsx';
import { InfoRow, CardShell } from '../shared/preview-cards/SummaryCard.jsx';

function ReturnReceiptStatsPanel({ receipt, partnerName, movementDate, ui }) {
  const warehouseLabel = receipt['warehouse$_identifier'] || '—';
  const docStatus = receipt.documentStatus;
  const statusLabel = ui(STATUS_KEYS[docStatus]) || receipt['documentStatus$_identifier'] || docStatus || '—';
  const statusBadgeClass = STATUS_BADGE[docStatus] || 'bg-gray-50 text-gray-600 border-gray-200';
  const sourceShipmentRef = receipt.sourceShipmentDocNo || null;

  return (
    <div className="pb-4">
      <CardShell>
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-sm">{ui('shipmentPreviewStatus')}</span>
        </div>
        <div className="px-4 py-2">
          <InfoRow label={ui('shipmentPreviewDocNo')} value={receipt.documentNo || '—'} />
          <InfoRow label={ui('shipmentPreviewContact')} value={partnerName} />
          <InfoRow label={ui('shipmentPreviewWarehouse')} value={warehouseLabel} />
          <InfoRow label={ui('shipmentPreviewDate')} value={movementDate} />
          <InfoRow label={ui('shipmentPreviewStatus')}>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </InfoRow>
          {sourceShipmentRef && (
            <InfoRow label={ui('returnReceiptPreviewSourceShipment')} value={sourceShipmentRef} />
          )}
        </div>
      </CardShell>
    </div>
  );
}

export default function ReturnMaterialReceiptPreview({ receipt, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const modalRef = useRef(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);
  const openEmailModal = useCallback(() => setShowSendModal(true), []);
  const closeEmailModal = useCallback(() => {
    setSendModalClosing(true);
    setTimeout(() => { setSendModalClosing(false); setShowSendModal(false); }, 280);
  }, []);

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
    const a = document.createElement('a');
    const url = URL.createObjectURL(pdfBlob);
    a.href = url;
    a.download = `dev-${receipt.documentNo || 'devolucion'}.pdf`;
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
        <ReturnReceiptStatsPanel
          receipt={receipt}
          partnerName={partnerName}
          movementDate={movementDate}
          ui={ui}
        />
      ),
    },
    {
      key: 'messages',
      label: ui('invoicePreviewMessages'),
      content: <PreviewEmptyPanel icon="💬" text={ui('invoicePreviewNoMessagesYet')} />,
    },
    {
      key: 'history',
      label: ui('invoicePreviewHistory'),
      content: <PreviewEmptyPanel icon="🕐" text={ui('invoicePreviewNoActivityRecorded')} />,
    },
    {
      key: 'documents',
      label: ui('shipmentPreviewDocuments'),
      content: (
        <RelatedDocuments
          recordId={receipt.id}
          data={receipt}
          token={token}
          apiBaseUrl={apiBaseUrl}
        />
      ),
    },
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
      {showSendModal && (
        <SendDocumentModal
          documentType={windowLabel}
          documentNo={receipt.documentNo}
          bpName={partnerName}
          bPartnerId={receipt.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={receipt.id}
          windowName="return-material-receipt"
          token={token}
          pdfBlobUrl={pdfUrl}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
