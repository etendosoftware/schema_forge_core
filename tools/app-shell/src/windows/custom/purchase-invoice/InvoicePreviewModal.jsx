import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Edit2, FileText, Image, Plus, Check, Trash2, Loader2, AlertCircle, Send, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useMenuLabel, useUI } from '@/i18n';
import { formatAmount } from '@/lib/formatAmount.js';
import { getStatusBadgeProps, statusLabel } from '@/lib/statusBadge.js';
import InvoicePaymentModal from '../shared/InvoicePaymentModal.jsx';
import { useInvoicePdf } from '../shared/useInvoicePdf.js';
import SendDocumentModal from '@/components/contract-ui/SendDocumentModal.jsx';

const ACCEPTED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
};
const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',');

/**
 * InvoicePreviewModal — Holded-style preview popup for a purchase or sales invoice.
 *
 * Layout:
 *   Top bar: title, action buttons, tab switcher (General | Messages | History)
 *   Body: 50% document drop zone | 50% sidebar (content driven by active top tab)
 *
 * General tab sidebar:
 *   Total section    → invoice header fields (total in card header, contact/date/status in body)
 *   Payments section → registered payment rows + Add payment
 *   Files section    → placeholder
 *
 * Animation: fade + slide-up on open, reverse on close.
 *
 * @param specName — "purchase-invoice" | "sales-invoice" (defaults to "purchase-invoice")
 */
export default function InvoicePreviewModal({ invoice, token, apiBaseUrl, windowName, specName = 'purchase-invoice', onClose, onEdit }) {
  const ui = useUI();
  const tMenu = useMenuLabel();
  const [activeTab, setActiveTab] = useState('general');

  // For sales-invoice: auto-render invoice PDF instead of the drop zone
  const isSalesInvoice = specName === 'sales-invoice';
  const { pdfUrl, loading: pdfLoading, error: pdfError } = useInvoicePdf(
    isSalesInvoice ? invoice?.id : null,
    isSalesInvoice ? apiBaseUrl : null,
    token,
  );
  const [installments, setInstallments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalClosing, setSendModalClosing] = useState(false);
  const displayInvoice = invoice;
  const previewLoading = pdfLoading;
  const previewError = pdfError;

  // Animation state: 'opening' → 'open' → 'closing' → 'closingUp'
  const [animState, setAnimState] = useState('opening');

  // Document drop zone state — { name, url, kind: 'pdf'|'image' }
  const [docFile, setDocFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const topTabs = [
    { key: 'general', label: ui('invoicePreviewGeneral') },
    { key: 'messages', label: ui('invoicePreviewMessages') },
    { key: 'history', label: ui('invoicePreviewHistory') },
  ];

  // Release blob URL on unmount or when replaced
  useEffect(() => {
    return () => { if (docFile?.url) URL.revokeObjectURL(docFile.url); };
  }, [docFile]);

  const loadFile = useCallback((file) => {
    const kind = file ? ACCEPTED_TYPES[file.type] : null;
    if (!kind) return;
    if (docFile?.url) URL.revokeObjectURL(docFile.url);
    setDocFile({ name: file.name, url: URL.createObjectURL(file), kind });
  }, [docFile]);

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    loadFile(e.dataTransfer.files[0]);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  }

  function handleFileChange(e) {
    loadFile(e.target.files[0]);
    e.target.value = '';
  }

  function removeFile() {
    if (docFile?.url) URL.revokeObjectURL(docFile.url);
    setDocFile(null);
  }

  // Trigger open animation on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimState('open'));
    return () => cancelAnimationFrame(t);
  }, []);

  // Close with exit animation (slide right)
  function handleClose() {
    setAnimState('closing');
    setTimeout(onClose, 280);
  }

  // Open the email modal: slide InvoicePreviewModal out to the right first, then show email modal
  function openEmailModal() {
    setAnimState('sliding-out-right');
    setTimeout(() => setShowSendModal(true), 280);
  }

  // Close the email modal: animate it out (slide up); InvoicePreviewModal stays closed
  function closeEmailModal() {
    setSendModalClosing(true);
    setTimeout(() => {
      setSendModalClosing(false);
      setShowSendModal(false);
      onClose();
    }, 280);
  }

  // Close with upward animation, then navigate to edit view
  function handleEdit() {
    setAnimState('closingUp');
    setTimeout(() => onEdit?.(displayInvoice.id), 280);
  }

  // Parallel fetch: installment schedules (paymentPlan) + registered payments (invoicePayments)
  const fetchPayments = useCallback(() => {
    if (!invoice?.id || !token) return;
    setLoadingPayments(true);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    Promise.all([
      fetch(`${apiBaseUrl}/paymentPlan?parentId=${invoice.id}`, { headers })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => d?.response?.data ?? d?.data ?? [])
        .catch(() => []),
      fetch(`${apiBaseUrl}/header/${invoice.id}/action/invoicePayments`, {
        method: 'POST', headers, body: '{}',
      })
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => d?.response?.data ?? [])
        .catch(() => []),
    ])
      .then(([sched, pays]) => { setInstallments(sched); setPayments(pays); })
      .catch(() => { setInstallments([]); setPayments([]); })
      .finally(() => setLoadingPayments(false));
  }, [invoice?.id, apiBaseUrl, token]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  if (!invoice) return null;

  const status = displayInvoice.documentStatus;
  const badgeProps = getStatusBadgeProps(status);
  const label = statusLabel(status, null, ui);
  const partnerName = displayInvoice.businessPartner$_identifier || displayInvoice.businessPartner || '—';

  // paymentDetails records use `amount` (applied amount)
  // Derive totals from installment schedule data (more accurate than paymentDetails sum)
  const grandTotal = Number(displayInvoice.grandTotalAmount ?? 0);
  const totalOutstanding = installments.length > 0
    ? installments.reduce((s, i) => s + Math.max(0, Number(i.outstandingAmount ?? 0)), 0)
    : grandTotal;

  // "Add payment" is only available when invoice is Completed (CO) with outstanding balance
  const isDraft = status === 'DR' || status === 'draft';
  const isFullyPaid = totalOutstanding <= 0 && installments.length > 0;
  const isCompleted = status === 'CO' || status === 'complete' || status === 'completed';
  const canAddPayment = isCompleted && !isFullyPaid;

  // Animation classes
  const backdropClass = animState === 'opening'
    ? 'opacity-0'
    : (animState === 'closing' || animState === 'sliding-out-right')
      ? 'opacity-0 transition-opacity duration-[280ms]'
      : 'opacity-100 transition-opacity duration-[280ms]';

  const cardClass = animState === 'opening'
    ? 'translate-x-full'
    : (animState === 'closing' || animState === 'sliding-out-right')
      ? 'translate-x-full transition-transform duration-[280ms]'
      : animState === 'closingUp'
        ? 'opacity-0 translate-x-full transition-all duration-[280ms]'
        : 'translate-x-0 transition-transform duration-[280ms]';

  // Download the generated PDF blob
  function handleDownloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `invoice-${displayInvoice.documentNo || 'document'}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <>
      {/* Backdrop — hidden when SendDocumentModal is open to avoid overlap,
          but kept mounted so the pdfUrl blob remains alive */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 ${backdropClass}`}
        style={showSendModal ? { display: 'none' } : undefined}
        onClick={handleClose}
      >
        {/* Side panel — slides in from the right (wider for better PDF view) */}
        <div
          className={`absolute right-0 bottom-0 bg-white shadow-2xl overflow-hidden flex flex-col ${cardClass}`}
          style={{ top: 8, width: '56vw', height: 'calc(100% - 8px)', borderTopLeftRadius: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Body — two panels (no top bar) ── */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel: flex-1 — PDF preview (sales invoice) or document drop zone (purchase invoice) */}
            <div className="flex-1 bg-gray-50 flex flex-col min-h-0 border-r border-gray-200">
              {/* ── Sales Invoice: auto-rendered PDF ── */}
              {isSalesInvoice ? (
                <div className="flex flex-col h-full min-h-0">
                  {previewLoading && (
                    <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">{ui('invoicePdfGenerating')}</span>
                    </div>
                  )}
                  {previewError && !previewLoading && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-400" />
                      <p className="text-sm text-muted-foreground">
                        {ui('invoicePdfError')}
                      </p>
                      <p className="text-xs text-muted-foreground/60">{previewError}</p>
                    </div>
                  )}
                  {pdfUrl && !previewLoading && (
                    <iframe
                      src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                      className="w-full h-full border-0"
                      title={ui('piPreviewSalesInvoicePdfTitle')}
                    />
                  )}
                </div>
              ) : docFile ? (
                /* ── Document preview ── */
                <div className="flex flex-col h-full min-h-0">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {docFile.kind === 'image'
                        ? <Image size={14} className="text-blue-500 shrink-0" />
                        : <FileText size={14} className="text-red-500 shrink-0" />
                      }
                      <span className="text-xs text-gray-600 truncate">{docFile.name}</span>
                    </div>
                    <button
                      onClick={removeFile}
                      className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded transition-colors shrink-0"
                      title={ui('piPreviewDeleteDocumentTitle')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Preview area */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {docFile.kind === 'image' ? (
                      <div className="w-full h-full overflow-auto flex items-center justify-center bg-gray-50 p-4">
                        <img
                          src={docFile.url}
                          alt={docFile.name}
                          className="max-w-full max-h-full object-contain rounded shadow"
                        />
                      </div>
                    ) : (
                      /* iframe with #toolbar=0 hides Chrome's PDF viewer toolbar */
                      <iframe
                        src={`${docFile.url}#toolbar=0&navpanes=0&scrollbar=1`}
                        className="w-full h-full border-0"
                        title={ui('pdfPreview')}
                      />
                    )}
                  </div>
                </div>
              ) : (
                /* ── Drop zone ── */
                <div className="flex flex-1 items-center justify-center p-8">
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-full max-h-[420px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-gray-400 bg-gray-100'
                        : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100/60'
                    }`}
                  >
                    {/* Document illustration */}
                    <div className="relative">
                      <div className="w-16 h-20 bg-white rounded-lg border border-gray-200 flex items-center justify-center shadow-sm">
                        <Upload size={20} className="text-gray-400" />
                      </div>
                    </div>
                    {isDragOver ? (
                      <p className="text-sm font-medium text-gray-700">{ui('invoicePreviewDropFileHere')}</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600 mt-1">{ui('invoicePreviewUploadYourDocument')}</p>
                        <button
                          className="px-4 py-2 text-sm font-medium text-gray-900 bg-transparent border border-gray-900 rounded-lg hover:bg-gray-900 hover:text-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        >
                          {ui('invoicePreviewClickHereToUploadYourFile')}
                        </button>
                        <p className="text-xs text-gray-400">{ui('invoicePreviewAcceptedDocumentTypes')}</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_ATTR}
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              )}
              {/* End of purchase-invoice drop zone (ternary close) */}
              </div>


            {/* Right panel: fixed width — header + tabs + content */}
            <div className="w-[380px] shrink-0 flex flex-col relative">
              {/* ── Close button (top-right) ── */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 z-10 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={ui('invoicePreviewClose')}
              >
                <X size={16} />
              </button>

              {/* ── Header section: title + action buttons ── */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-200 shrink-0">
                {/* Title + client row */}
                <div className="pr-8 mb-3">
                  <span className="font-bold text-gray-900 text-lg leading-tight block">
                    {tMenu(specName === 'purchase-invoice' ? 'Purchase Invoice' : 'Sales Invoice')} {displayInvoice.documentNo}
                  </span>
                  {partnerName && partnerName !== '—' && (
                    <span className="text-xs text-gray-500 mt-0.5 block">
                      {ui('invoicePreviewClient')} {partnerName}
                    </span>
                  )}
                </div>

                {/* Action buttons row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Enviar */}
                  <Button size="sm" className="gap-1.5 text-xs h-8 bg-gray-900 hover:bg-gray-800 text-white" onClick={openEmailModal}>
                    <Send size={12} />
                    {ui('invoicePreviewSend')}
                  </Button>

                  {/* Add Payment */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8 border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={!canAddPayment}
                    onClick={canAddPayment ? () => setShowPaymentModal(true) : undefined}
                  >
                    <Plus size={12} />
                    {ui('invoicePreviewAddPayment')}
                  </Button>

                  {/* Descargar PDF — sales invoice only */}
                  {isSalesInvoice && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs h-8 border-gray-300 text-gray-700"
                      onClick={handleDownloadPdf}
                      disabled={!pdfUrl}
                    >
                      <Download size={12} />
                      {ui('invoicePreviewDownloadPdf')}
                    </Button>
                  )}

                  {/* Edit */}
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-gray-300 text-gray-700" onClick={handleEdit}>
                    <Edit2 size={12} />
                    {ui('invoicePreviewEdit')}
                  </Button>

                  {/* More options */}
                  <button className="p-1.5 h-8 w-8 flex items-center justify-center text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                  </button>
                </div>
              </div>

              {/* ── Tab switcher ── */}
              <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 shrink-0">
                {topTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      activeTab === tab.key
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab content ── */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'general' && (
                  <StatsPanel
                    invoice={displayInvoice}
                    partnerName={partnerName}
                    badgeProps={badgeProps}
                    statusLabel={label}
                    installments={installments}
                    payments={payments}
                    loadingPayments={loadingPayments}
                    totalOutstanding={totalOutstanding}
                    canAddPayment={canAddPayment}
                    isDraft={isDraft}
                    isFullyPaid={isFullyPaid}
                    specName={specName}
                    apiBaseUrl={apiBaseUrl}
                    token={token}
                    onAddPayment={() => setShowPaymentModal(true)}
                    onSend={openEmailModal}
                  />
                )}
                {activeTab === 'messages' && (
                  <EmptyPanel icon="💬" text={ui('invoicePreviewNoMessagesYet')} />
                )}
                {activeTab === 'history' && (
                  <EmptyPanel icon="🕐" text={ui('invoicePreviewNoActivityRecorded')} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <InvoicePaymentModal
          invoiceId={displayInvoice.id}
          invoiceData={displayInvoice}
          specName={specName}
          token={token}
          apiBaseUrl={apiBaseUrl}
          onClose={() => {
            setShowPaymentModal(false);
            fetchPayments();
          }}
        />
      )}

      {/* Send email modal — rendered on top to preserve pdfUrl blob.
          Appears with slide-down animation; closes with slide-up via closeEmailModal. */}
      {showSendModal && (
        <SendDocumentModal
          documentType={tMenu(specName === 'purchase-invoice' ? 'Purchase Invoice' : 'Sales Invoice')}
          documentNo={displayInvoice.documentNo}
          bpName={partnerName}
          bpEmail={displayInvoice.bpEmail || displayInvoice.partnerEmail || ''}
          documentId={displayInvoice.id}
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

// ── Stats panel: Total + Payments + Files sections ──

/**
 * SectionCard — two variants:
 *   summary=true  → title bold INSIDE the card with border-bottom (used for Total)
 *   summary=false → title uppercase gray ABOVE the card, titleRight as dark underlined link
 */
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

function InfoRow({ label, value, link, underline }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      {(link || underline)
        ? <span className="text-gray-900 font-medium text-right max-w-[55%] truncate underline decoration-gray-400">{value ?? '—'}</span>
        : <span className="text-gray-900 font-medium text-right max-w-[55%] truncate">{value ?? '—'}</span>
      }
    </div>
  );
}

function fmtPayDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PAID_STATUSES = new Set(['RPR', 'RPPC', 'RDNC', 'PPM']);

function StatsPanel({ invoice, partnerName, badgeProps, statusLabel: sl, installments, payments, loadingPayments, totalOutstanding, canAddPayment, isDraft, isFullyPaid, specName, apiBaseUrl, token, onAddPayment, onSend }) {
  const ui = useUI();
  const [accountingAccount, setAccountingAccount] = useState(null);

  const invoiceDate = invoice.invoiceDate
    ? new Date(invoice.invoiceDate).toLocaleDateString('en-GB')
    : '—';

  const dueDate = invoice.dueDate
    ? new Date(invoice.dueDate).toLocaleDateString('en-GB')
    : '—';

  const payPrefix = specName === 'purchase-invoice' ? 'payment-out' : 'payment-in';

  useEffect(() => {
    if (!invoice?.id || !apiBaseUrl || !token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    fetch(`${apiBaseUrl}/lines?parentId=${invoice.id}&_startRow=0&_endRow=1`, { headers })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const lines = d?.response?.data ?? [];
        const name = lines[0]?.['account$_identifier'] || null;
        setAccountingAccount(name);
      })
      .catch(() => {});
  }, [invoice?.id, apiBaseUrl, token]);

  const currencyCode = installments[0]?.['currency$_identifier'] || '';

  return (
    <div className="pb-4">
      {/* Total — summary variant: title bold inside card */}
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
      </SectionCard>

      {/* Payments — title above card, dark underline titleRight */}
      <SectionCard
        title={ui('invoicePreviewPayments')}
        noPadding
        titleRight={
          canAddPayment ? (
            <button
              onClick={onAddPayment}
              className="text-xs font-medium text-gray-900 underline decoration-gray-600 hover:decoration-gray-900 transition-colors"
            >
              {ui('invoicePreviewAddPayment')}
            </button>
          ) : isFullyPaid ? (
            <Check size={13} className="text-green-500" />
          ) : null
        }
      >
        {loadingPayments ? (
          <p className="text-xs text-gray-400 py-4 text-center">{ui('loading')}</p>
        ) : payments.length === 0 && totalOutstanding > 0 ? (
          /* Pending installment — amber row */
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-amber-600">{ui('invoicePendingPayment')}</span>
            <span className="text-sm font-semibold tabular-nums text-amber-600">
              {currencyCode} {formatAmount(totalOutstanding)}
            </span>
          </div>
        ) : payments.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">{ui('invoicePreviewNoPaymentsRecorded')}</p>
        ) : (
          <div className="overflow-y-auto divide-y divide-gray-100" style={{ maxHeight: '180px' }}>
            {payments.map((p) => {
              const isPaid = PAID_STATUSES.has(p.status);
              const acctLabel = [p.accountName, p.accountCurrency].filter(Boolean).join(' · ');

              return (
                <div key={p.id} className="px-4 py-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold tabular-nums ${isPaid ? 'text-gray-900' : 'text-amber-600'}`}>
                        {currencyCode} {formatAmount(p.amount)}
                      </span>
                      <span className={`text-xs font-medium ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                        {isPaid ? ui('statusPaid') : ui('statusPending')}
                      </span>
                      <span className="text-xs text-gray-400 tabular-nums">{fmtPayDate(p.paymentDate)}</span>
                    </div>
                    <button
                      onClick={() => { window.location.href = `/${payPrefix}/${p.id}`; }}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 underline shrink-0 ml-2"
                    >
                      {ui('viewArrow')}
                    </button>
                  </div>
                  {(p.documentNo || acctLabel) && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {[p.documentNo ? `#${p.documentNo}` : null, acctLabel].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Emails — title above card */}
      <SectionCard
        title={ui('invoicePreviewEmails')}
        titleRight={
          <button
            onClick={onSend}
            className="text-xs font-medium text-gray-900 underline decoration-gray-600 hover:decoration-gray-900 transition-colors"
          >
            {ui('invoicePreviewSendEmail')}
          </button>
        }
      >
        <p className="text-xs text-gray-400 py-2 text-center">{ui('invoicePreviewNoEmailHistory')}</p>
      </SectionCard>

      {/* Categorización — title above card */}
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
