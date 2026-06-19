import { Check, Ban } from 'lucide-react';
import { useUI } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import { formatAmount } from '@/lib/formatAmount.js';

function SectionCard({ title, titleRight, noPadding, children }) {
  return (
    <div className="mx-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        {titleRight}
      </div>
      <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden${noPadding ? '' : ' px-4 py-2'}`}>
        {children}
      </div>
    </div>
  );
}

function fmtPayDate(raw) {
  return formatCalendarDate(raw, 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * PaymentsCard — payment history + outstanding amount row.
 *
 * Props:
 *   payments        array   — each: { id, amount, paymentDate, accountName?, documentNo? }
 *   currencyCode    string
 *   totalOutstanding number
 *   canAddPayment   boolean
 *   isFullyPaid     boolean
 *   loading         boolean
 *   onAddPayment    function
 */
export default function PaymentsCard({
  payments = [],
  currencyCode = '',
  totalOutstanding = 0,
  canAddPayment = false,
  isFullyPaid = false,
  loading = false,
  onAddPayment,
}) {
  const ui = useUI();

  let titleRight = null;
  if (canAddPayment) {
    titleRight = (
      <button
        onClick={onAddPayment}
        className="text-xs font-medium text-gray-900 underline decoration-gray-600 hover:decoration-gray-900 transition-colors"
      >
        {ui('previewCardAddPayment')}
      </button>
    );
  } else if (isFullyPaid) {
    titleRight = <Check size={13} className="text-green-500" data-testid="Check__c6fe34" />;
  }

  let content;
  if (loading) {
    content = <p className="text-xs text-gray-400 py-4 text-center">{ui('loading')}</p>;
  } else if (payments.length === 0 && totalOutstanding <= 0) {
    content = <p className="text-xs text-gray-400 py-4 text-center">{ui('previewCardNoPaymentsRecorded')}</p>;
  } else {
    content = (
      <div className="flex flex-col gap-3 px-3 py-2">
        {payments.map((p) => {
          const acctLabel = p.accountName || (p.documentNo ? `#${p.documentNo}` : '—');
          return (
            <div
              key={p.id}
              className="flex items-center justify-between rounded px-2 py-2"
              style={{ backgroundColor: '#F5F7F9' }}
            >
              <div className="flex items-center gap-1 min-w-0">
                <Ban
                  size={20}
                  className="shrink-0"
                  style={{ color: '#828FA3' }}
                  data-testid="Ban__c6fe34" />
                <span className="text-sm text-gray-900 truncate">{acctLabel}</span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm tabular-nums text-gray-900">
                  {currencyCode} {formatAmount(p.amount)}
                </span>
                <span className="text-xs tabular-nums" style={{ color: '#555B6D' }}>
                  {fmtPayDate(p.paymentDate)}
                </span>
              </div>
            </div>
          );
        })}
        {totalOutstanding > 0 && (
          <div className="flex items-center justify-between px-3">
            <span className="text-xs" style={{ color: '#8A6100' }}>
              {ui('invoicePendingPayment')}
            </span>
            <span className="text-sm tabular-nums" style={{ color: '#8A6100' }}>
              {currencyCode} {formatAmount(totalOutstanding)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <SectionCard
      title={ui('previewCardPayments')}
      titleRight={titleRight}
      noPadding
      data-testid="SectionCard__c6fe34">
      {content}
    </SectionCard>
  );
}
