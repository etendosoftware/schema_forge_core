import { useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Edit2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useUI, useMenuLabel, useLocaleSwitch } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import GenericPreviewModal from '../shared/GenericPreviewModal.jsx';
import { PreviewPdfPanel } from '../shared/PreviewActionButtons.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import { useShipmentPdf } from './useShipmentPdf.js';
import { STATUS_BADGE, STATUS_KEYS } from '@/components/related-documents/constants.jsx';
import { InfoRow, CardShell, PercentBar } from '../shared/preview-cards/SummaryCard.jsx';
import RelatedDocumentsCard from '../shared/preview-cards/RelatedDocumentsCard.jsx';

function EmptyPanel({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-20">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Tab content components ────────────────────────────────────────────────────

function ShipmentStatsPanel({ shipment, partnerName, movementDate, ui }) {
  const invoiceStatusPct = Number(shipment.invoiceStatus ?? 0);
  const warehouseLabel = shipment['warehouse$_identifier'] || '—';
  const docStatus = shipment.documentStatus;
  const statusLabel = ui(STATUS_KEYS[docStatus]) || shipment['documentStatus$_identifier'] || docStatus || '—';
  const statusBadgeClass = STATUS_BADGE[docStatus] || 'bg-gray-50 text-gray-600 border-gray-200';

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

  // Fetch the full header record once; all 3 specs share 1 HTTP call via the cached promise.
  const shipmentDocSpecs = useMemo(() => {
    let detailPromise = null;
    const getDetail = (id, tok, base) => {
      if (!detailPromise) {
        detailPromise = fetch(`${base}/goodsShipment/${id}`, {
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        })
          .then(r => r.ok ? r.json() : null)
          .then(j => j?.response?.data?.[0] ?? {})
          .catch(() => ({}));
      }
      return detailPromise;
    };
    return [
      { key: 'orders',   type: 'sales-order',            fetch: (id, tok, base) => getDetail(id, tok, base).then(r => r.linkedOrders   ?? []) },
      { key: 'invoices', type: 'sales-invoice',           fetch: (id, tok, base) => getDetail(id, tok, base).then(r => r.linkedInvoices ?? []) },
      { key: 'returns',  type: 'return-material-receipt', fetch: (id, tok, base) => getDetail(id, tok, base).then(r => r.returnReceipts ?? []) },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment?.id]);

  if (!shipment) return null;

  // ── Left panel ──────────────────────────────────────────────────────────────

  const leftPanel = (
    <PreviewPdfPanel
      pdfLoading={pdfLoading}
      pdfError={pdfError}
      pdfUrl={pdfUrl}
      generatingText={ui('shipmentPdfGenerating')}
      errorText={ui('shipmentPdfError')}
    />
  );

  // ── Derived values ──────────────────────────────────────────────────────────

  const partnerName = shipment['businessPartner$_identifier'] || '—';
  const movementDate = shipment.movementDate
    ? formatCalendarDate(shipment.movementDate, locale)
    : '—';
  const windowLabel = tMenu('Goods Shipment');

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
        <div className="pb-4">
          <ShipmentStatsPanel
            shipment={shipment}
            partnerName={partnerName}
            movementDate={movementDate}
            ui={ui}
          />
          <RelatedDocumentsCard
            documentId={shipment.id}
            token={token}
            apiBaseUrl={apiBaseUrl}
            specs={shipmentDocSpecs}
          />
        </div>
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
