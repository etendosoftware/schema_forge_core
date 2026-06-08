import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import { PreviewEmptyPanel } from '../shared/PreviewActionButtons.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { InfoRow, PercentBar, MovementSummaryCard } from '../shared/preview-cards/SummaryCard.jsx';
import { STATUS_BADGE, STATUS_KEYS } from '@/components/related-documents/constants.jsx';
import RelatedDocumentsCard from '../shared/preview-cards/RelatedDocumentsCard.jsx';

function ReceiptStatsPanel({ receipt, partnerName, movementDate, token, apiBaseUrl, ui, onOrderClick }) {
  const invoiceStatusPct = Number(receipt.invoiceStatus ?? 0);
  const docStatus = receipt.documentStatus;
  const statusLabel = ui(STATUS_KEYS[docStatus]) || receipt['documentStatus$_identifier'] || docStatus || '—';
  const statusBadgeClass = STATUS_BADGE[docStatus] || 'bg-gray-50 text-gray-600 border-gray-200';
  const purchaseOrderNo = receipt['salesOrder$_identifier'] || null;

  const specs = [
    { key: 'linkedOrders', type: 'order', fetch: async () => receipt?.linkedOrders ?? [] },
    { key: 'linkedInvoices', type: 'invoice', fetch: async () => receipt?.linkedInvoices ?? [] },
    { key: 'linkedReturns', type: 'return-to-vendor', fetch: async () => receipt?.linkedReturns ?? [] },
  ];

  const rows = [
    { label: ui('shipmentPreviewDocNo'), value: receipt.documentNo || '—' },
    { label: ui('goodsReceiptPreview.supplier'), value: partnerName },
    { label: ui('goodsReceiptPreview.warehouse'), value: receipt['warehouse$_identifier'] || '—' },
    { label: ui('goodsReceiptPreview.movementDate'), value: movementDate },
  ];

  return (
    <div className="pb-4">
      <MovementSummaryCard
        title={ui('shipmentPreviewStatus')}
        rows={rows}
        statusRowLabel={ui('shipmentPreviewStatus')}
        statusLabel={statusLabel}
        statusBadgeClass={statusBadgeClass}
      >
        <InfoRow label={ui('goodsReceiptPreview.originOrder')}>
          {purchaseOrderNo ? (
            <button
              type="button"
              onClick={onOrderClick}
              className="text-blue-600 font-medium text-right max-w-[55%] truncate hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              {purchaseOrderNo}
            </button>
          ) : null}
        </InfoRow>
        <InfoRow label={ui('shipmentPreviewInvoiceStatus')}>
          <PercentBar value={invoiceStatusPct} />
        </InfoRow>
      </MovementSummaryCard>

      <RelatedDocumentsCard
        documentId={receipt.id}
        token={token}
        apiBaseUrl={apiBaseUrl}
        specs={specs}
      />
    </div>
  );
}

export default function GoodsReceiptPreview({ receipt, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const navigate = useNavigate();
  const modalRef = useRef(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const openEmailModal = useCallback(() => setShowSendModal(true), []);
  const closeEmailModal = useCallback(() => {
    setSendModalClosing(true);
    setTimeout(() => { setSendModalClosing(false); setShowSendModal(false); }, 280);
  }, []);
  const handleFileChange = useCallback((f) => setPreviewFile(f), []);

  if (!receipt) return null;

  const partnerName = receipt['businessPartner$_identifier'] || '—';
  const movementDate = receipt.movementDate
    ? formatCalendarDate(receipt.movementDate, locale)
    : '—';
  const windowLabel = tMenu('Goods Receipt');
  const purchaseOrderId = receipt.salesOrder || null;

  const isCompleted = receipt.documentStatus === 'CO';

  const actionButtons = (
    <>
      {isCompleted && (
        <Button
          size="sm"
          className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
          onClick={openEmailModal}
        >
          <Mail />
          {ui('invoicePreviewSend')}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
        onClick={() => modalRef.current?.triggerEdit?.()}
      >
        <Edit2 className="text-[#828FA3]" />
        {ui('invoicePreviewEdit')}
      </Button>
    </>
  );

  const tabs = [
    {
      key: 'general',
      label: ui('invoicePreviewGeneral'),
      content: (
        <ReceiptStatsPanel
          receipt={receipt}
          partnerName={partnerName}
          movementDate={movementDate}
          token={token}
          apiBaseUrl={apiBaseUrl}
          ui={ui}
          onOrderClick={purchaseOrderId
            ? () => { onClose?.(); navigate(`/purchase-order/${purchaseOrderId}`); }
            : undefined}
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
  ];

  const attachmentConfig = {
    documentId: receipt.id,
    specName: 'goods-receipt',
    storeCondition: true,
    autoFetch: false,
    token,
    apiBaseUrl,
    onFileChange: handleFileChange,
  };

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${receipt.documentNo}`}
        subtitle={partnerName !== '—' ? `${ui('invoicePreviewClient')} ${partnerName}` : undefined}
        attachmentConfig={attachmentConfig}
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
          windowName="goods-receipt"
          token={token}
          pdfBlobUrl={previewFile?.objectUrl}
          pdfBlobLoading={false}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
