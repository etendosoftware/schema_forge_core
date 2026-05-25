import { Badge } from '@/components/ui/badge.jsx';
import { useLocaleSwitch, useUI } from '@/i18n';
import { formatCalendarDate } from '@/lib/dateOnly';
import { formatAmount } from '@/lib/formatAmount.js';
import { getStatusBadgeProps } from '@/lib/statusBadge.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function CardShell({ children }) {
  return (
    <div className="mx-4 mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
      {children}
    </div>
  );
}

function CardHeader({ title, amount }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <span className="font-bold text-gray-900 text-sm">{title}</span>
      <span className="font-bold text-base tabular-nums text-gray-900">{amount}</span>
    </div>
  );
}

export function InfoRow({ label, value, underline, children }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      {children ?? (
        <span className={`text-gray-900 font-medium text-right max-w-[55%] truncate${underline ? ' underline decoration-gray-400' : ''}`}>
          {value ?? '—'}
        </span>
      )}
    </div>
  );
}

export function PercentBar({ value }) {
  const pct = isNaN(Number(value)) ? 0 : Math.min(Number(value), 100);
  let trackColor;
  if (pct >= 100) trackColor = 'bg-emerald-500';
  else if (pct > 0) trackColor = 'bg-amber-400';
  else trackColor = 'bg-slate-200';
  let textColor;
  if (pct >= 100) textColor = 'text-emerald-700';
  else if (pct > 0) textColor = 'text-amber-700';
  else textColor = 'text-slate-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${trackColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs tabular-nums ${textColor}`}>{pct}%</span>
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

/**
 * SummaryCard — top card shown in all preview right panels.
 *
 * Props:
 *   currencyCode   string   — e.g. "EUR"
 *   grandTotal     number
 *   contact        string   — business partner name
 *   date           string   — ISO date string or formatted string
 *   statusCode     string   — raw doc status code (e.g. "CO", "DR")
 *   statusLabel    string   — human-readable label (e.g. "Completado")
 *   validUntil     string?  — ISO date, shown only when truthy (quotations)
 *   dueDate        string?  — ISO date, shown between Date and Status when provided (invoices)
 *   invoicePercent number?  — 0-100, shows "X%" row when provided (orders)
 *   deliveryPercent number? — 0-100, shows "X%" row when provided (orders)
 *   children       node?    — extra InfoRow(s) appended after standard rows
 */
export default function SummaryCard({
  currencyCode = '',
  grandTotal,
  contact,
  date,
  statusCode,
  statusLabel,
  validUntil,
  dueDate,
  invoicePercent,
  deliveryPercent,
  children,
}) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();

  const formattedDate = date ? formatCalendarDate(date, locale) : '—';
  const formattedValidUntil = validUntil ? formatCalendarDate(validUntil, locale) : null;
  const formattedDueDate = dueDate ? formatCalendarDate(dueDate, locale) : null;
  const amountStr = `${currencyCode} ${formatAmount(grandTotal ?? 0)}`;

  return (
    <CardShell>
      <CardHeader title={ui('previewCardTotal')} amount={amountStr} />
      <div className="px-4 py-2">
        <InfoRow label={ui('previewCardContact')} value={contact} />
        <InfoRow label={ui('previewCardDate')} value={formattedDate} />
        {formattedValidUntil && (
          <InfoRow label={ui('previewCardValidUntil')} value={formattedValidUntil} />
        )}
        {formattedDueDate && (
          <InfoRow label={ui('previewCardDueDate')} value={formattedDueDate} underline />
        )}
        <InfoRow label={ui('previewCardStatus')}>
          <Badge {...getStatusBadgeProps(statusCode)}>{statusLabel ?? statusCode}</Badge>
        </InfoRow>
        {invoicePercent != null && (
          <InfoRow label={ui('previewCardInvoicePercent')}>
            <PercentBar value={invoicePercent} />
          </InfoRow>
        )}
        {deliveryPercent != null && (
          <InfoRow label={ui('previewCardDeliveryPercent')}>
            <PercentBar value={deliveryPercent} />
          </InfoRow>
        )}
        {children}
      </div>
    </CardShell>
  );
}
