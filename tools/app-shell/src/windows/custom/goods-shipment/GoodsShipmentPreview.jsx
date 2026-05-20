import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Edit2, Loader2, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import PdfViewer from '../shared/PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { useShipmentPdf } from './useShipmentPdf.js';
import RelatedDocuments from '@generated/goods-shipment/custom/RelatedDocuments';
import { STATUS_BADGE, STATUS_KEYS } from '@/components/related-documents/constants.jsx';
import { InfoRow, CardShell, PercentBar } from '../shared/preview-cards/SummaryCard.jsx';

function EmptyPanel({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-20">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function ShipmentStatsPanel({ shipment, partnerName, movementDate, ui, onOrderClick }) {
  const invoiceStatusPct = Number(shipment.invoiceStatus ?? 0);
  const warehouseLabel = shipment['warehouse$_identifier'] || '—';
  const docStatus = shipment.documentStatus;
  const statusLabel = ui(STATUS_KEYS[docStatus]) || shipment['documentStatus$_identifier'] || docStatus || '—';
  const statusBadgeClass = STATUS_BADGE[docStatus] || 'bg-gray-50 text-gray-600 border-gray-200';
  const salesOrderNo = shipment['salesOrder$_identifier']?.split(' ')[0] || null;

  return (
    <div className="pb-4">
      <CardShell>
        <div className="px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-sm">{ui('shipmentPreviewStatus')}</span>
        </div>
        <div className="px-4 py-2">
          <InfoRow label={ui('shipmentPreviewDocNo')} value={shipment.documentNo || '—'} />
          <InfoRow label={ui('shipmentPreviewContact')} value={partnerName} />
          <InfoRow label={ui('shipmentPreviewWarehouse')} value={warehouseLabel} />
          <InfoRow label={ui('shipmentPreviewDate')} value={movementDate} />
          <InfoRow label={ui('shipmentPreviewStatus')}>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
              {statusLabel}
            </span>
          </InfoRow>
          <InfoRow label={ui('shipmentPreviewSalesOrder')}>
            {salesOrderNo ? (
              <button
                type="button"
                onClick={onOrderClick}
                className="text-blue-600 font-medium text-right max-w-[55%] truncate hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                {salesOrderNo}
              </button>
            ) : null}
          </InfoRow>
          <InfoRow label={ui('shipmentPreviewInvoiceStatus')}>
            <PercentBar value={invoiceStatusPct} />
          </InfoRow>
        </div>
      </CardShell>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoodsShipmentPreview({ shipment, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const { locale } = useLocaleSwitch();
  const navigate = useNavigate();
  const modalRef = useRef(null);

  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);
  const openEmailModal = useCallback(() => setShowSendModal(true), []);
  const closeEmailModal = useCallback(() => {
    setSendModalClosing(true);
    setTimeout(() => { setSendModalClosing(false); setShowSendModal(false); }, 280);
  }, []);

  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = useShipmentPdf(
    shipment?.id ?? null,
    apiBaseUrl,
    token,
  );

  if (!shipment) return null;

  // ── Left panel ──────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      {pdfLoading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{ui('shipmentPdfGenerating')}</span>
        </div>
      )}
      {pdfError && !pdfLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400" />
          <p className="text-sm text-muted-foreground">{ui('shipmentPdfError')}</p>
          <p className="text-xs text-muted-foreground/60">{pdfError}</p>
        </div>
      )}
      {pdfUrl && !pdfLoading && <PdfViewer url={pdfUrl} />}
    </div>
  );

  // ── Derived values ──────────────────────────────────────────────────────────

  const partnerName = shipment['businessPartner$_identifier'] || '—';
  const movementDate = shipment.movementDate
    ? formatCalendarDate(shipment.movementDate, locale)
    : '—';
  const windowLabel = tMenu('Goods Shipment');
  const salesOrderId = shipment.salesOrder || null;

  // ── Action buttons ──────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!pdfBlob) return;
    const a = document.createElement('a');
    const url = URL.createObjectURL(pdfBlob);
    a.href = url;
    a.download = `alb-${shipment.documentNo || 'albaran'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const actionButtons = (
    <>
      <Button
        size="sm"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
        onClick={openEmailModal}
      >
        <Mail />
        {ui('invoicePreviewSend')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:size-5"
        disabled={!pdfBlob}
        onClick={pdfBlob ? handleDownload : undefined}
      >
        <Download className="text-[#828FA3]" />
        {ui('invoicePreviewDownloadPdf')}
      </Button>
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

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs = [
    {
      key: 'general',
      label: ui('invoicePreviewGeneral'),
      content: (
        <ShipmentStatsPanel
          shipment={shipment}
          partnerName={partnerName}
          movementDate={movementDate}
          ui={ui}
          onOrderClick={salesOrderId ? () => { onClose?.(); navigate(`/sales-order/${salesOrderId}`); } : undefined}
        />
      ),
    },
    {
      key: 'messages',
      label: ui('invoicePreviewMessages'),
      content: <EmptyPanel icon="💬" text={ui('invoicePreviewNoMessagesYet')} />,
    },
    {
      key: 'history',
      label: ui('invoicePreviewHistory'),
      content: <EmptyPanel icon="🕐" text={ui('invoicePreviewNoActivityRecorded')} />,
    },
    {
      key: 'documents',
      label: ui('shipmentPreviewDocuments'),
      content: (
        <RelatedDocuments
          recordId={shipment.id}
          data={shipment}
          token={token}
          apiBaseUrl={apiBaseUrl}
        />
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${shipment.documentNo}`}
        subtitle={partnerName !== '—' ? `${ui('invoicePreviewClient')} ${partnerName}` : undefined}
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
          windowName="goods-shipment"
          token={token}
          pdfBlobUrl={pdfUrl}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
