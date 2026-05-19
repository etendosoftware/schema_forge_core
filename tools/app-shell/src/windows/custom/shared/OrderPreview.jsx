import { useState, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useMenuLabel, useUI } from '@/i18n';
import { statusLabel as resolveStatusLabel } from '@/lib/statusBadge.js';
import PdfViewer from './PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import GenericPreviewModal from './GenericPreviewModal.jsx';
import { useOrderPdf } from './useOrderPdf.js';
import { usePurchaseOrderPdf } from './usePurchaseOrderPdf.js';
import PreviewActionButtons, { PreviewEmptyPanel } from './PreviewActionButtons.jsx';
import SummaryCard from './preview-cards/SummaryCard.jsx';
import EmailsCard from './preview-cards/EmailsCard.jsx';
import CategorizationCard from './preview-cards/CategorizationCard.jsx';
import RelatedDocumentsCard from './preview-cards/RelatedDocumentsCard.jsx';
import { fetchByCriteria, fetchChild, fetchById } from '@/components/related-documents';

// ── SO related-documents helpers ─────────────────────────────────────────────

const SO_SPECS = [
  { key: 'shipment',      type: 'shipment',      fetch: (id, token, base) => fetchByCriteria('goods-shipment', 'goodsShipment', 'salesOrder', id, token, base) },
  { key: 'sales-invoice', type: 'sales-invoice', fetch: (id, token, base) => fetchByCriteria('sales-invoice',  'header',        'salesOrder', id, token, base) },
];

async function fetchPaymentsIn(orderId, token, apiBaseUrl) {
  const plans = await fetchChild('sales-order', 'paymentPlan', orderId, token, apiBaseUrl);
  if (plans.length === 0) return [];
  const detailResults = await Promise.all(
    plans.map(plan => fetchChild('sales-order', 'paymentDetails', plan.id, token, apiBaseUrl))
  );
  const seen = new Set();
  const paymentIds = detailResults.flat()
    .filter(d => d.payment && !seen.has(d.payment))
    .map(d => { seen.add(d.payment); return d.payment; });
  if (paymentIds.length === 0) return [];
  const results = await Promise.all(
    paymentIds.map(id => fetchById('payment-in', 'finPayment', id, token, apiBaseUrl))
  );
  return results.filter(Boolean).map(doc => ({ type: 'payment-in', doc }));
}

// ── General tab content ───────────────────────────────────────────────────────

function OrderGeneralTab({ order, specName, token, apiBaseUrl }) {
  const ui = useUI();
  const isSalesOrder = specName === 'sales-order';

  const statusCode = order.documentStatus;
  const statusLabel = resolveStatusLabel(statusCode, null, ui);

  const invoicePercent = order.invoiceStatus != null ? Number(order.invoiceStatus) : null;
  let deliveryPercent;
  if (isSalesOrder) {
    deliveryPercent = order.deliveryStatus != null ? Number(order.deliveryStatus) : null;
  } else {
    deliveryPercent = order.deliveryStatusPurchase != null ? Number(order.deliveryStatusPurchase) : null;
  }

  return (
    <div className="pb-4">
      <SummaryCard
        currencyCode={order['currency$_identifier'] ?? ''}
        grandTotal={order.grandTotalAmount}
        contact={order.businessPartner$_identifier}
        date={order.orderDate}
        statusCode={statusCode}
        statusLabel={statusLabel}
        invoicePercent={invoicePercent}
        deliveryPercent={deliveryPercent != null ? deliveryPercent : undefined}
      />

      <EmailsCard onSend={undefined} />

      <CategorizationCard rows={[]} />

      {isSalesOrder && (
        <RelatedDocumentsCard
          documentId={order.id}
          token={token}
          apiBaseUrl={apiBaseUrl}
          specs={SO_SPECS}
          fetchExtra={fetchPaymentsIn}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrderPreview({ order, token, apiBaseUrl, windowName, specName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const modalRef = useRef(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);

  const isSalesOrder = specName === 'sales-order';
  const isDraft = order?.documentStatus === 'DR';

  const soResult = useOrderPdf(isSalesOrder ? order?.id : null, apiBaseUrl, token);
  const poResult = usePurchaseOrderPdf(!isSalesOrder ? order?.id : null, apiBaseUrl, token);
  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = isSalesOrder ? soResult : poResult;

  if (!order) return null;

  const pdfGeneratingKey = isSalesOrder ? 'orderPdfGenerating' : 'purchaseOrderPdfGenerating';
  const pdfErrorKey      = isSalesOrder ? 'orderPdfError'      : 'purchaseOrderPdfError';

  // ── Left panel ──────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      {pdfLoading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{ui(pdfGeneratingKey)}</span>
        </div>
      )}
      {pdfError && !pdfLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400" />
          <p className="text-sm text-muted-foreground">{ui(pdfErrorKey)}</p>
          <p className="text-xs text-muted-foreground/60">{pdfError}</p>
        </div>
      )}
      {pdfUrl && !pdfLoading && <PdfViewer url={pdfUrl} />}
    </div>
  );

  // ── Attachment config ───────────────────────────────────────────────────────

  const attachmentConfig = !isDraft
    ? { storeCondition: true, sourceBlob: pdfBlob, autoFetch: true, documentId: order.id, specName, token, apiBaseUrl }
    : { storeCondition: false, documentId: order.id, specName, token, apiBaseUrl };

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs = [
    {
      key: 'general',
      label: ui('orderPreviewGeneral'),
      content: <OrderGeneralTab order={order} specName={specName} token={token} apiBaseUrl={apiBaseUrl} />,
    },
    {
      key: 'messages',
      label: ui('orderPreviewMessages'),
      content: <PreviewEmptyPanel icon="💬" text={ui('orderPreviewMessages')} />,
    },
    {
      key: 'history',
      label: ui('orderPreviewHistory'),
      content: <PreviewEmptyPanel icon="🕐" text={ui('orderPreviewHistory')} />,
    },
  ];

  // ── Email modal helpers ─────────────────────────────────────────────────────

  const openEmailModal = () => {
    setSendModalClosing(false);
    setShowSendModal(true);
  };
  const closeEmailModal = () => {
    setSendModalClosing(true);
    setTimeout(() => { setShowSendModal(false); setSendModalClosing(false); }, 300);
  };

  const handleDownloadPdf = () => {
    if (!pdfBlob) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${order.documentNo || 'order'}.pdf`;
    a.click();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const windowLabel = tMenu(specName === 'purchase-order' ? 'Purchase Order' : 'Sales Order');

  const actionButtons = (
    <PreviewActionButtons
      triggerEdit={() => modalRef.current?.triggerEdit?.()}
      onEmail={openEmailModal}
      onDownloadPdf={handleDownloadPdf}
      hasPdf={!!pdfUrl}
      sendLabel={ui('orderPreviewSend')}
      downloadLabel={ui('orderPreviewDownloadPdf')}
      editLabel={ui('orderPreviewEdit')}
    />
  );

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${order.documentNo}`}
        subtitle={order.businessPartner$_identifier
          ? `${ui('orderPreviewContact')} ${order.businessPartner$_identifier}`
          : undefined}
        leftPanel={leftPanel}
        attachmentConfig={attachmentConfig}
        onClose={onClose}
        onEdit={() => onEdit?.(order.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />

      {showSendModal && (
        <SendDocumentModal
          documentType={windowLabel}
          documentNo={order.documentNo}
          bpName={order.businessPartner$_identifier}
          bPartnerId={order.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={order.id}
          windowName={specName}
          token={token}
          pdfBlobUrl={pdfUrl}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
