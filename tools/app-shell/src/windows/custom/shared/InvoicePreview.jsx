import { useState, useEffect, useRef } from 'react';
import { Edit2, FileText, Check, Loader2, AlertCircle, Mail, Download, Ban, Wallet, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useLocaleSwitch, useMenuLabel, useUI } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import { formatAmount } from '@/lib/formatAmount.js';
import { getLatestInstallmentDueDate } from '@/lib/invoiceDueDate';
import InvoicePaymentModal from './InvoicePaymentModal.jsx';
import PdfViewer from './PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import GenericPreviewModal from './GenericPreviewModal.jsx';
import { useInvoicePreview } from './useInvoicePreview.js';
import { useFiscalStatus } from './useFiscalStatus.js';
import { StatusPill } from '@/windows/custom/fiscal-monitor/FmPrimitives.jsx';
import { getInvoiceFiscalTargets } from './fiscalTargets.js';

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

export default function InvoicePreview({ invoice, token, apiBaseUrl, windowName, specName = 'purchase-invoice', onClose, onEdit, onInvoiceUpdated = null }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const modalRef = useRef(null);
  const p = useInvoicePreview({ invoice, token, apiBaseUrl, specName, onInvoiceUpdated });

  if (!invoice) return null;

  // ── Left panel ─────────────────────────────────────────────────────────────
  // Sales invoices always provide a leftPanel with the generated PDF.
  // For draft invoices, GenericPreviewModal uses it directly (storeCondition=false).
  // For completed invoices, GenericPreviewModal shows the cached file when available,
  // and falls back to this leftPanel while the cache is being populated.

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

  const attachmentConfig = p.isSalesInvoice ? {
    documentId: invoice.id,
    specName,
    storeCondition: p.isCompleted,
    sourceBlob: p.isCompleted ? p.pdfBlob : null,
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
        <StatsPanel
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

// ── Sub-components for tab content ────────────────────────────────────────────

function SectionCard({ title, titleRight, done, noPadding, summary, children }) {
  if (summary) {
    return (
      <div className="mx-4 mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-sm">{title}</span>
          {titleRight ?? (done ? <Check size={15} className="text-green-500" /> : null)}
        </div>
        <div className={noPadding ? '' : 'px-4 py-2'}>{children}</div>
      </div>
    );
  }
  return (
    <div className="mx-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        {titleRight ?? (done ? <Check size={13} className="text-green-500" /> : null)}
      </div>
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${noPadding ? '' : 'px-4 py-2'}`}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, underline }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`text-gray-900 font-medium text-right max-w-[55%] truncate ${underline ? 'underline decoration-gray-400' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function fmtPayDate(raw) {
  return formatCalendarDate(raw, 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatsPanel({ invoice, partnerName, badgeProps, statusLabel: sl, installments, payments, loadingPayments, totalOutstanding, canAddPayment, isDraft, isFullyPaid, specName, apiBaseUrl, token, orgId, profile, onAddPayment, onSend }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const fiscalTargets = getInvoiceFiscalTargets(specName, profile);
  const { sii: siiStatus, tbai: tbaiStatus, verifactu: vfStatus, loading: fiscalLoading } = useFiscalStatus(
    invoice?.id, specName, profile, apiBaseUrl, orgId,
  );
  const [accountingAccount, setAccountingAccount] = useState(null);

  const invoiceDate = invoice.invoiceDate ? formatCalendarDate(invoice.invoiceDate, locale) : '—';
  const latestDueDate = getLatestInstallmentDueDate(installments);
  const dueDate = latestDueDate ? formatCalendarDate(latestDueDate, locale) : '—';

  useEffect(() => {
    if (!invoice?.id || !apiBaseUrl || !token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    fetch(`${apiBaseUrl}/lines?parentId=${invoice.id}&_startRow=0&_endRow=1`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { setAccountingAccount(d?.response?.data?.[0]?.['account$_identifier'] || null); })
      .catch(() => {});
  }, [invoice?.id, apiBaseUrl, token]);

  const currencyCode = installments[0]?.['currency$_identifier'] || '';

  let paymentsTitleRight = null;
  if (canAddPayment) {
    paymentsTitleRight = <button onClick={onAddPayment} className="text-xs font-medium text-gray-900 underline decoration-gray-600 hover:decoration-gray-900 transition-colors">{ui('invoicePreviewAddPayment')}</button>;
  } else if (isFullyPaid) {
    paymentsTitleRight = <Check size={13} className="text-green-500" />;
  }

  let paymentsContent;
  if (loadingPayments) {
    paymentsContent = <p className="text-xs text-gray-400 py-4 text-center">{ui('loading')}</p>;
  } else if (payments.length === 0 && totalOutstanding <= 0) {
    paymentsContent = <p className="text-xs text-gray-400 py-4 text-center">{ui('invoicePreviewNoPaymentsRecorded')}</p>;
  } else {
    paymentsContent = (
      <div className="flex flex-col gap-3 px-3 py-2">
        {payments.map((p) => {
          const acctLabel = p.accountName || (p.documentNo ? `#${p.documentNo}` : '—');
          return (
            <div key={p.id} className="flex items-center justify-between rounded px-2 py-2" style={{ backgroundColor: '#F5F7F9' }}>
              <div className="flex items-center gap-1 min-w-0">
                <Ban size={20} className="shrink-0" style={{ color: '#828FA3' }} />
                <span className="text-sm text-gray-900 truncate">{acctLabel}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm tabular-nums text-gray-900">{currencyCode} {formatAmount(p.amount)}</span>
                <span className="text-xs tabular-nums" style={{ color: '#555B6D' }}>{fmtPayDate(p.paymentDate)}</span>
              </div>
            </div>
          );
        })}
        {totalOutstanding > 0 && (
          <div className="flex items-center justify-between px-3">
            <span className="text-xs" style={{ color: '#8A6100' }}>{ui('invoicePendingPayment')}</span>
            <span className="text-sm tabular-nums" style={{ color: '#8A6100' }}>{currencyCode} {formatAmount(totalOutstanding)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-4">
      <SectionCard
        summary
        title={ui('invoicePreviewTotal')}
        titleRight={
          <span className="font-bold text-base tabular-nums text-gray-900">
            {currencyCode} {formatAmount(invoice.grandTotalAmount)}
          </span>
        }
      >
        <InfoRow label={ui('invoicePreviewContact')} value={partnerName} underline />
        <InfoRow label={ui('invoicePreviewDate')} value={invoiceDate} />
        <InfoRow label={ui('invoicePreviewDueDate')} value={dueDate} underline />
        <div className="flex justify-between items-center py-1.5 text-sm">
          <span className="text-gray-400">{ui('invoicePreviewStatus')}</span>
          <Badge {...badgeProps}>{sl}</Badge>
        </div>
        {fiscalTargets.showSii && (
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-gray-400">{ui('invoicePreview.fiscalStatus.sii')}</span>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={siiStatus ?? 'PE'} />}
          </div>
        )}
        {fiscalTargets.showTbai && (
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-gray-400">{ui('invoicePreview.fiscalStatus.tbai')}</span>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={tbaiStatus ?? 'Pendiente'} />}
          </div>
        )}
        {fiscalTargets.showVerifactu && (
          <div className="flex justify-between items-center py-1.5 text-sm">
            <span className="text-gray-400">{ui('invoicePreview.fiscalStatus.verifactu')}</span>
            {fiscalLoading
              ? <span className="h-5 w-16 bg-gray-100 rounded animate-pulse inline-block" />
              : <StatusPill estado={vfStatus ?? 'PE'} />}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={ui('invoicePreviewPayments')}
        noPadding
        titleRight={paymentsTitleRight}
      >
        {paymentsContent}
      </SectionCard>

      <SectionCard
        title={ui('invoicePreviewEmails')}
        titleRight={
          <button onClick={onSend} className="text-xs font-medium text-gray-900 underline decoration-gray-600 hover:decoration-gray-900 transition-colors">
            {ui('invoicePreviewSendEmail')}
          </button>
        }
      >
        <p className="text-xs text-gray-400 py-2 text-center">{ui('invoicePreviewNoEmailHistory')}</p>
      </SectionCard>

      <SectionCard title={ui('invoicePreviewCategorization')}>
        <InfoRow label={ui('invoicePreviewAccountingAccount')} value={accountingAccount} />
      </SectionCard>
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
