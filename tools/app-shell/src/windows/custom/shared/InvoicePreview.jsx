import { useRef, useState, useEffect } from 'react';
import { Edit2, FileText, Loader2, AlertCircle, Mail, Download, Wallet, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useMenuLabel, useUI } from '@/i18n';
import { getLatestInstallmentDueDate } from '@/lib/invoiceDueDate';
import InvoicePaymentModal from './InvoicePaymentModal.jsx';
import PdfViewer from './PdfViewer.jsx';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';
import GenericPreviewModal, { EmptyPanel } from './GenericPreviewModal.jsx';
import { useInvoicePreview } from './useInvoicePreview.js';
import { useFiscalStatus } from './useFiscalStatus.js';
import { StatusPill } from '@/windows/custom/fiscal-monitor/FmPrimitives.jsx';
import { getInvoiceFiscalTargets } from './fiscalTargets.js';
import SummaryCard, { InfoRow } from './preview-cards/SummaryCard.jsx';
import PaymentsCard from './preview-cards/PaymentsCard.jsx';
import EmailsCard from './preview-cards/EmailsCard.jsx';
import CategorizationCard from './preview-cards/CategorizationCard.jsx';

function InvoiceActionButtons({ triggerEdit, onEmail, canSendToSif, onOpenSif, canAddPayment, onAddPayment, isSalesInvoice, onDownloadPdf, hasPdf }) {
  const ui = useUI();
  return (
    <>
      {onEmail && (
        <Button
          size="sm"
          className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
          onClick={onEmail}
        >
          <Mail />
          {ui('invoicePreviewSend')}
        </Button>
      )}

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

function InvoiceGeneralTab({ invoice, partnerName, badgeProps, statusLabel, installments, payments, loadingPayments, totalOutstanding, canAddPayment, isFullyPaid, specName, apiBaseUrl, token, orgId, profile, onAddPayment, onSend }) {
  const ui = useUI();
  const fiscalTargets = getInvoiceFiscalTargets(specName, profile);
  const { sii: siiStatus, tbai: tbaiStatus, verifactu: vfStatus, loading: fiscalLoading } = useFiscalStatus(
    invoice?.id, specName, profile, apiBaseUrl, orgId,
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

      {specName !== 'purchase-invoice' && <EmailsCard onSend={onSend} />}

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

export default function InvoicePreview({ invoice, token, apiBaseUrl, windowName, specName = 'purchase-invoice', onClose, onEdit, onInvoiceUpdated = null }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const modalRef = useRef(null);
  const p = useInvoicePreview({ invoice, token, apiBaseUrl, specName, onInvoiceUpdated });

  if (!invoice) return null;

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
    // ... 353 lines omitted
    {
    // ... 352 lines omitted
    {
    // ... 351 lines omitted
    {
    // ... 350 lines omitted
}
    // ... 349 lines omitted
  }
    // ... 348 lines omitted
}
    // ... 347 lines omitted
function InfoRow({ label, value, underline }) {
    // ... 346 lines omitted
}
    // ... 345 lines omitted
function fmtPayDate(raw) {
    // ... 344 lines omitted
}
    // ... 343 lines omitted
function StatsPanel({ invoice, partnerName, badgeProps, statusLabel: sl, installments, payments, loadingPayments, totalOutstanding, canAddPayment, isDraft, isFullyPaid, specName, apiBaseUrl, token, orgId, profile, onAddPayment, onSend }) {
    // ... 342 lines omitted
  }
    // ... 341 lines omitted
  }
    // ... 340 lines omitted
        }
    // ... 339 lines omitted
          }
    // ... 338 lines omitted
}
// ... 337 more lines (total: 548)
