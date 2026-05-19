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

// ── Shared sub-components ─────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-900 font-medium text-right max-w-[55%] truncate">{value ?? '—'}</span>
    </div>
  );
}

function InfoLinkRow({ label, value, onClick }) {
  if (!value) return <InfoRow label={label} value={null} />;
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <button
        type="button"
        onClick={onClick}
        className="text-blue-600 font-medium text-right max-w-[55%] truncate hover:underline bg-transparent border-none p-0 cursor-pointer"
      >
        {value}
      </button>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="mx-4 mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-bold text-gray-900 text-sm">{title}</span>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

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

  const barColor = invoiceStatusPct >= 100
    ? '#10b981'
    : invoiceStatusPct > 0
      ? '#f59e0b'
      : '#d1d5db';

  return (
    <div className="pb-4">
      <SectionCard title={ui('shipmentPreviewStatus')}>
        <InfoRow label={ui('shipmentPreviewDocNo')} value={shipment.documentNo || '—'} />
        <InfoRow label={ui('shipmentPreviewContact')} value={partnerName} />
        <InfoRow label={ui('shipmentPreviewWarehouse')} value={warehouseLabel} />
        <InfoRow label={ui('shipmentPreviewDate')} value={movementDate} />
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-gray-400">{ui('shipmentPreviewStatus')}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
            {statusLabel}
          </span>
        </div>
        <InfoLinkRow
          label={ui('shipmentPreviewSalesOrder')}
          value={salesOrderNo}
          onClick={onOrderClick}
        />
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-gray-400">{ui('shipmentPreviewInvoiceStatus')}</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${invoiceStatusPct}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="text-gray-900 font-medium text-xs tabular-nums">
              {invoiceStatusPct}%
            </span>
          </div>
        </div>
      </SectionCard>
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
