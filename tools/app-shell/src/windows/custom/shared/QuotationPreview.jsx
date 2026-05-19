import { useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useMenuLabel, useUI } from '@/i18n';
import { statusLabel as resolveStatusLabel } from '@/lib/statusBadge.js';
import PdfViewer from './PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import GenericPreviewModal from './GenericPreviewModal.jsx';
import { useQuotationPdf } from './useQuotationPdf.js';
import PreviewActionButtons, { PreviewEmptyPanel } from './PreviewActionButtons.jsx';
import SummaryCard from './preview-cards/SummaryCard.jsx';
import EmailsCard from './preview-cards/EmailsCard.jsx';
import CategorizationCard from './preview-cards/CategorizationCard.jsx';
import RelatedDocumentsCard from './preview-cards/RelatedDocumentsCard.jsx';
import { fetchByCriteria } from '@/components/related-documents';

// ── Quotation related-documents specs ────────────────────────────────────────

const QUOTATION_SPECS = [
  { key: 'sales-order', type: 'sales-order', fetch: (id, token, base) => fetchByCriteria('sales-order', 'header', 'quotation', id, token, base) },
];

// Statuses that mean the quotation is no longer editable

// ── General tab content ───────────────────────────────────────────────────────

function QuotationGeneralTab({ quotation, onSend, token, apiBaseUrl }) {
  const ui = useUI();
  const statusCode = quotation.documentStatus;
  const statusLabel = resolveStatusLabel(statusCode, null, ui);

  return (
    <div className="pb-4">
      <SummaryCard
        currencyCode={quotation['currency$_identifier'] ?? ''}
        grandTotal={quotation.grandTotalAmount}
        contact={quotation.businessPartner$_identifier}
        date={quotation.orderDate}
        statusCode={statusCode}
        statusLabel={statusLabel}
        validUntil={quotation.validUntil || null}
      />

      <EmailsCard onSend={onSend} />

      <CategorizationCard rows={[]} />

      <RelatedDocumentsCard
        documentId={quotation.id}
        token={token}
        apiBaseUrl={apiBaseUrl}
        specs={QUOTATION_SPECS}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuotationPreview({ quotation, token, apiBaseUrl, windowName, onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const modalRef = useRef(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);

  const { pdfUrl, pdfBlob, loading: pdfLoading, error: pdfError } = useQuotationPdf(
    quotation?.id,
    apiBaseUrl,
    token,
  );

  if (!quotation) return null;

  const isDraft = quotation.documentStatus === 'DR';

  const openEmailModal = () => {
    setSendModalClosing(false);
    setShowSendModal(true);
  };
  const closeEmailModal = () => {
    setSendModalClosing(true);
    setTimeout(() => setShowSendModal(false), 300);
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `quotation-${quotation.documentNo || quotation.id}.pdf`;
    a.click();
  };

  // ── Left panel ──────────────────────────────────────────────────────────────

  const leftPanel = (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      {pdfLoading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{ui('quotationPdfGenerating')}</span>
        </div>
      )}
      {pdfError && !pdfLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400" />
          <p className="text-sm text-muted-foreground">{ui('quotationPdfError')}</p>
          <p className="text-xs text-muted-foreground/60">{pdfError}</p>
        </div>
      )}
      {pdfUrl && !pdfLoading && <PdfViewer url={pdfUrl} />}
    </div>
  );

  // ── Attachment config ───────────────────────────────────────────────────────

  const attachmentConfig = !isDraft
    ? {
        storeCondition: true,
        sourceBlob: pdfBlob,
        autoFetch: true,
        documentId: quotation.id,
        specName: 'sales-quotation',
        token,
        apiBaseUrl,
      }
    : {
        storeCondition: false,
        documentId: quotation.id,
        specName: 'sales-quotation',
        token,
        apiBaseUrl,
      };

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs = [
    {
      key: 'general',
      label: ui('quotationPreviewGeneral'),
      content: <QuotationGeneralTab quotation={quotation} onSend={openEmailModal} token={token} apiBaseUrl={apiBaseUrl} />,
    },
    {
      key: 'messages',
      label: ui('quotationPreviewMessages'),
      content: <PreviewEmptyPanel icon="💬" text={ui('quotationPreviewMessages')} />,
    },
    {
      key: 'history',
      label: ui('quotationPreviewHistory'),
      content: <PreviewEmptyPanel icon="🕐" text={ui('quotationPreviewHistory')} />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  const windowLabel = tMenu('Sales Quotation');
  const partnerName = quotation.businessPartner$_identifier;

  const actionButtons = (
    <PreviewActionButtons
      triggerEdit={() => modalRef.current?.triggerEdit?.()}
      onEmail={openEmailModal}
      onDownloadPdf={handleDownloadPdf}
      hasPdf={!!pdfUrl}
      sendLabel={ui('quotationPreviewSend')}
      downloadLabel={ui('quotationPreviewDownloadPdf')}
      editLabel={ui('quotationPreviewEdit')}
    />
  );

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${quotation.documentNo}`}
        subtitle={partnerName ? `${ui('quotationPreviewContact')} ${partnerName}` : undefined}
        leftPanel={leftPanel}
        attachmentConfig={attachmentConfig}
        onClose={onClose}
        onEdit={() => onEdit?.(quotation.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />

      {showSendModal && (
        <SendDocumentModal
          documentType={windowLabel}
          documentNo={quotation.documentNo}
          bpName={partnerName}
          bPartnerId={quotation.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={quotation.id}
          windowName={windowName}
          token={token}
          pdfBlobUrl={pdfUrl}
          isClosing={sendModalClosing}
          onClose={closeEmailModal}
        />
      )}
    </>
  );
}
