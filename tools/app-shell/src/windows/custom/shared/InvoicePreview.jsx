import { useRef } from 'react';
import { Edit2, FileText, Loader2, AlertCircle, Mail, Download, Wallet, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useMenuLabel, useUI, useLocaleSwitch } from '@/i18n';
import { getLatestInstallmentDueDate } from '@/lib/invoiceDueDate';
import InvoicePaymentModal from './InvoicePaymentModal.jsx';
import PdfViewer from './PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import GenericPreviewModal from './GenericPreviewModal.jsx';
import { useInvoicePreview } from './useInvoicePreview.js';
import { useFiscalStatus } from './useFiscalStatus.js';
import { StatusPill } from '@/windows/custom/fiscal-monitor/FmPrimitives.jsx';
import { getInvoiceFiscalTargets } from './fiscalTargets.js';
import SummaryCard, { InfoRow } from './preview-cards/SummaryCard.jsx';
import PaymentsCard from './preview-cards/PaymentsCard.jsx';
import EmailsCard from './preview-cards/EmailsCard.jsx';
import CategorizationCard from './preview-cards/CategorizationCard.jsx';
import { useState, useEffect } from 'react';

/**
 * InvoicePreview — wires useInvoicePreview data into GenericPreviewModal.
 *
 * File persistence (drop zone + PDF caching) is delegated to GenericPreviewModal
 * via attachmentConfig. The left panel is:
 *   - sales invoice, draft:     PDF viewer (regenerated on every open)
 *   - sales invoice, completed: managed by GenericPreviewModal (cached via ETGO_PREVIEW_FILE)
 *   - purchase invoice:         managed by GenericPreviewModal (drop zone → persisted)
 */
function InvoiceActionButtons({ triggerEdit, onEmail, canSendToSif, onOpenSif, canAddPayment, onAddPayment, isSalesInvoice, onDownloadPdf, hasPdf }) {
  const ui = useUI();
  return (
    <>
      <Button
        size="sm"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
        onClick={onEmail}
      >
        <Mail />
        {ui('invoicePreviewSend')}
      </Button>

      {canSendToSif && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
          onClick={onOpenSif}
        >
          <FileText className="text-[#828FA3]" />
          {ui('sendToSif')}
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:size-5"
        disabled={!canAddPayment}
        onClick={canAddPayment ? onAddPayment : undefined}
      >
        <Wallet className="text-[#828FA3]" />
        {ui('invoicePreviewAddPayment')}
      </Button>

      {isSalesInvoice && (
        <Button
          size="sm"
          variant="outline"
          className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
          onClick={onDownloadPdf}
          disabled={!hasPdf}
        >
          <Download className="text-[#828FA3]" />
          {ui('invoicePreviewDownloadPdf')}
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
        onClick={triggerEdit}
      >
        <Edit2 className="text-[#828FA3]" />
        {ui('invoicePreviewEdit')}
      </Button>

      <button
        type="button"
        className="w-8 h-8 flex items-center justify-center bg-white border border-[#D1D4DB] shadow-sm rounded-lg hover:bg-gray-50 transition-colors"
      >
        <MoreVertical size={20} className="text-[#828FA3]" />
      </button>
    </>
  );
}

// ── General tab content ───────────────────────────────────────────────────────

function InvoiceGeneralTab({ invoice, partnerName, badgeProps, statusLabel, installments, payments, loadingPayments, totalOutstanding, canAddPayment, isFullyPaid, specName, apiBaseUrl, token, orgId, profile, onAddPayment, onSend }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const fiscalTargets = getInvoiceFiscalTargets(specName, profile);
  const { sii: siiStatus, tbai: tbaiStatus, verifactu: vfStatus, loading: fiscalLoading } = useFiscalStatus(
    invoice?.id, specName, profile, apiBaseUrl, token, orgId,
  );
  const [accountingAccount, setAccountingAccount] = useState(null);

  const latestDueDate = getLatestInstallmentDueDate(installments);
  const currencyCode = installments[0]?.['currency$_identifier'] || invoice?.['currency$_identifier'] || '';

  useEffect(() => {
    if (!invoice?.id || !apiBaseUrl || !token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    fetch(`${apiBaseUrl}/lines?parentId=${invoice.id}&_startRow=0&_endRow=1`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { setAccountingAccount(d?.response?.data?.[0]?.['account$_identifier'] || null); })
      .catch(() => {});
  }, [invoice?.id, apiBaseUrl, token]);

  return (
    <div className="pb-4">
      <SummaryCard
        currencyCode={currencyCode}
        grandTotal={invoice?.grandTotalAmount}
        contact={partnerName}
        date={invoice?.invoiceDate}
        dueDate={latestDueDate ?? null}
        statusCode={invoice?.documentStatus}
        statusLabel={statusLabel}
      >
        {fiscalTargets.showSii && (
          <InfoRow label={ui('invoicePreview.fiscalStatus.sii')}>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={siiStatus ?? 'PE'} />}
          </InfoRow>
        )}
        {fiscalTargets.showTbai && (
          <InfoRow label={ui('invoicePreview.fiscalStatus.tbai')}>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={tbaiStatus ?? 'Pendiente'} />}
          </InfoRow>
        )}
        {fiscalTargets.showVerifactu && (
          <InfoRow label={ui('invoicePreview.fiscalStatus.verifactu')}>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={vfStatus ?? 'PE'} />}
          </InfoRow>
        )}
      </SummaryCard>

      <PaymentsCard
        payments={payments}
        currencyCode={currencyCode}
        totalOutstanding={totalOutstanding}
        canAddPayment={canAddPayment}
        isFullyPaid={isFullyPaid}
        loading={loadingPayments}
        onAddPayment={onAddPayment}
      />

      <EmailsCard onSend={onSend} />

      <CategorizationCard
        rows={[{ label: ui('invoicePreviewAccountingAccount'), value: accountingAccount }]}
      />
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

// ── Main component ────────────────────────────────────────────────────────────

export default function InvoicePreview({ invoice, token, apiBaseUrl, windowName, specName = 'purchase-invoice', onClose, onEdit, onInvoiceUpdated = null }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const modalRef = useRef(null);
  const p = useInvoicePreview({ invoice, token, apiBaseUrl, specName, onInvoiceUpdated });

  if (!invoice) return null;

  // ── Left panel ─────────────────────────────────────────────────────────────

  const leftPanel = p.isSalesInvoice ? (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden">
      {p.pdfLoading && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{ui('invoicePdfGenerating')}</span>
        </div>
      )}
      {p.pdfError && !p.pdfLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <AlertCircle className="h-8 w-8 text-amber-400" />
          <p className="text-sm text-muted-foreground">{ui('invoicePdfError')}</p>
          <p className="text-xs text-muted-foreground/60">{p.pdfError}</p>
        </div>
      )}
      {p.pdfUrl && !p.pdfLoading && <PdfViewer url={p.pdfUrl} />}
    </div>
  ) : null;

  // ── Attachment config ──────────────────────────────────────────────────────

  const isDraft = invoice?.documentStatus === 'DR';
  const attachmentConfig = p.isSalesInvoice ? {
    documentId: invoice.id,
    specName,
    storeCondition: !isDraft,
    sourceBlob: !isDraft ? p.pdfBlob : null,
    autoFetch: true,
    token,
    apiBaseUrl,
  } : {
    documentId: invoice.id,
    specName,
    storeCondition: true,
    autoFetch: false,
    token,
    apiBaseUrl,
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    {
      key: 'general',
      label: ui('invoicePreviewGeneral'),
      content: (
        <InvoiceGeneralTab
          invoice={p.displayInvoice}
          partnerName={p.partnerName}
          badgeProps={p.badgeProps}
          statusLabel={p.statusLabel}
          installments={p.installments}
          payments={p.payments}
          loadingPayments={p.loadingPayments}
          totalOutstanding={p.totalOutstanding}
          canAddPayment={p.canAddPayment}
          isDraft={p.isDraft}
          isFullyPaid={p.isFullyPaid}
          specName={specName}
          apiBaseUrl={apiBaseUrl}
          token={token}
          orgId={p.orgId}
          profile={p.profile}
          onAddPayment={() => p.setShowPaymentModal(true)}
          onSend={p.openEmailModal}
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
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  const windowLabel = tMenu(specName === 'purchase-invoice' ? 'Purchase Invoice' : 'Sales Invoice');

  const actionButtons = (
    <InvoiceActionButtons
      triggerEdit={() => modalRef.current?.triggerEdit?.()}
      onEmail={p.openEmailModal}
      canSendToSif={p.canSendToSif}
      onOpenSif={() => p.setShowSifModal(true)}
      canAddPayment={p.canAddPayment}
      onAddPayment={() => p.setShowPaymentModal(true)}
      isSalesInvoice={p.isSalesInvoice}
      onDownloadPdf={p.handleDownloadPdf}
      hasPdf={!!p.pdfUrl}
    />
  );

  return (
    <>
      <GenericPreviewModal
        ref={modalRef}
        title={`${windowLabel} ${p.displayInvoice?.documentNo}`}
        subtitle={p.partnerName !== '—' ? `${ui('invoicePreviewClient')} ${p.partnerName}` : undefined}
        leftPanel={leftPanel}
        attachmentConfig={attachmentConfig}
        onClose={onClose}
        onEdit={() => onEdit?.(p.displayInvoice?.id)}
        tabs={tabs}
        actionButtons={actionButtons}
      />

      {p.showPaymentModal && (
        <InvoicePaymentModal
          invoiceId={p.displayInvoice?.id}
          invoiceData={p.displayInvoice}
          specName={specName}
          apiBaseUrl={apiBaseUrl}
          onClose={() => {
            p.setShowPaymentModal(false);
            p.fetchPayments();
          }}
        />
      )}

      {p.showSifModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sif-modal-title"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', minWidth: '320px', maxWidth: '480px', width: '100%' }}>
            <h3 id="sif-modal-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              {ui('sendToSifTitle')}
            </h3>
            {p.sifPhase === 'confirm' && (
              <>
                <p style={{ fontSize: '14px', color: '#374151', marginBottom: '20px' }}>{ui(p.sifBodyKey)}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" onClick={p.closeSifModal} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', background: '#fff' }}>
                    {ui('cancel')}
                  </button>
                  <button type="button" onClick={p.handleSendToSif} style={{ padding: '8px 16px', borderRadius: '8px', background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer' }}>
                    {ui('sendToSifConfirm')}
                  </button>
                </div>
              </>
            )}
            {p.sifPhase === 'sending' && (
              <p style={{ fontSize: '14px', color: '#6b7280' }}>{ui('sendToSifSending')}</p>
            )}
            {p.sifPhase === 'results' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {p.sifResults.sii && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span style={{ color: p.sifResults.sii.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>{p.sifResults.sii.ok ? '✓' : '✗'}</span>
                      <span>{p.sifResults.sii.ok ? ui('sendToSifSuccessSii') : (p.sifResults.sii.error || ui('sendToSifErrorSii'))}</span>
                    </div>
                  )}
                  {p.sifResults.tbai && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                      <span style={{ color: p.sifResults.tbai.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>{p.sifResults.tbai.ok ? '✓' : '✗'}</span>
                      <span>{p.sifResults.tbai.ok ? ui('sendToSifSuccessTbai') : (p.sifResults.tbai.error || ui('sendToSifErrorTbai'))}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={p.closeSifModal} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', background: '#fff' }}>
                    {ui('close')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {p.showSendModal && (
        <SendDocumentModal
          documentType={windowLabel}
          documentNo={p.displayInvoice?.documentNo}
          bpName={p.partnerName}
          bPartnerId={p.displayInvoice?.businessPartner}
          apiBaseUrl={apiBaseUrl}
          documentId={p.displayInvoice?.id}
          windowName={specName}
          token={token}
          pdfBlobUrl={p.pdfUrl}
          isClosing={p.sendModalClosing}
          onClose={p.closeEmailModal}
        />
      )}
    </>
  );
}
