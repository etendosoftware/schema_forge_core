import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { MoneyAmount } from '@/components/ui/money-amount';
import { MovementStatusBadge } from './MovementStatusBadge';
import { PostingStatusDot } from './PostingStatusDot';
import { MovementRowKebab } from './MovementRowKebab';

/**
 * Formats an ISO date string using the user's locale.
 * es_ES → "06/05/2026", en_US → "5/6/2026".
 */
function formatDate(isoString, bcpLocale) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];

// Stable cell keys for skeleton rows (same order/length as the real header columns).
const SKELETON_COL_KEYS = [
  'expand', 'date', 'payment', 'contact', 'description',
  'status', 'type', 'glItem', 'amount', 'balance', 'kebab',
];

// Accounting dimension key → i18n label key, for the "more info" panel.
const DIMENSION_LABEL_KEYS = {
  organization: 'financeAccountMovementsDimOrganization',
  bpartner: 'financeAccountMovementsDimBpartner',
  project: 'financeAccountMovementsDimProject',
  costcenter: 'financeAccountMovementsDimCostcenter',
  activity: 'financeAccountMovementsDimActivity',
  campaign: 'financeAccountMovementsDimCampaign',
  salesregion: 'financeAccountMovementsDimSalesregion',
  user1: 'financeAccountMovementsDimUser1',
  user2: 'financeAccountMovementsDimUser2',
};

/**
 * Decides what to render inside the table body: skeleton rows while loading,
 * an empty-state message when there are no movements, or the actual rows.
 */
function renderBody({ loading, movements, emptyLabel, renderRow }) {
  if (loading) {
    return SKELETON_ROWS.map((n) => (
      <TableRow key={n}>
        {SKELETON_COL_KEYS.map((colKey) => (
          <TableCell key={colKey}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  if (movements.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="py-16 text-center text-sm text-[#6c6c89]">
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }
  return movements.map(renderRow);
}

function useTrxTypeLabel() {
  const ui = useUI();
  return (movement) =>
    movement.typeLabel ||
    (movement.trxType === 'BPD' ? ui('financeAccountMovementsTypeBPD') : null) ||
    (movement.trxType === 'BPW' ? ui('financeAccountMovementsTypeBPW') : null) ||
    (movement.trxType === 'BF' ? ui('financeAccountMovementsTypeBF') : null) ||
    movement.trxType ||
    '—';
}

/**
 * "More info" panel: the accounting dimensions enabled in the chart of accounts
 * (organization, project, etc.), rendered as a label/value grid under the row.
 */
function DimensionsPanel({ movement, enabledDimensions, ui }) {
  const dims = movement.dimensions || {};
  // Show only dimensions enabled in the chart of accounts that have a value on
  // this transaction. The business partner is excluded here because it already
  // has its own "Contacto" column in the row above.
  const visible = enabledDimensions.filter((key) => key !== 'bpartner' && dims[key]);

  if (visible.length === 0) {
    return (
      <div className="px-2 py-3 text-sm text-[#6C6C89]">
        {ui('financeAccountMovementsNoDimensions')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 px-2 py-3 sm:grid-cols-4">
      {visible.map((key) => (
        <div key={key} className="flex flex-col">
          <span className="text-[10.5px] font-semibold uppercase tracking-[.04em] text-[#6C6C89]">
            {ui(DIMENSION_LABEL_KEYS[key] ?? key)}
          </span>
          <span className="text-sm text-[#121217]">{dims[key]}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Table of account movements. Each row expands (chevron on the left) into a
 * "more info" panel showing the accounting dimensions enabled for the client.
 *
 * @param {{
 *   movements: Array<object>;
 *   loading: boolean;
 *   enabledDimensions?: string[];
 * }} props
 */
export function MovementsTable({ movements, loading, enabledDimensions = [] }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const getTrxTypeLabel = useTrxTypeLabel();
  const [expandedId, setExpandedId] = useState(null);
  const hasDimensions = enabledDimensions.length > 0;

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

  // Navigate to the related payment window (payment-in for received payments,
  // payment-out for made payments). No-op when the movement has no payment.
  const openPayment = (movement) => {
    if (!movement.paymentId) return;
    const win = movement.paymentIsReceipt === 'Y' ? 'payment-in' : 'payment-out';
    navigate(`/${win}/${movement.paymentId}`);
  };

  const renderRow = (movement) => {
    const expanded = expandedId === movement.id;
    return (
      <Fragment key={movement.id}>
        <TableRow
          data-testid={`movement-row-${movement.id}`}
          className="group relative cursor-pointer bg-white transition-shadow hover:z-10 hover:bg-white hover:shadow-lg"
          onClick={() => toast(ui('financeAccountMovementsRowViewDetailToast'))}
        >
          {/* Expand chevron (replaces the old selection checkbox) */}
          <TableCell onClick={(e) => e.stopPropagation()}>
            {hasDimensions ? (
              <button
                type="button"
                aria-label={ui('financeAccountMovementsMoreInfo')}
                aria-expanded={expanded}
                data-testid={`movement-expand-${movement.id}`}
                onClick={() => toggleExpand(movement.id)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#6C6C89] transition-transform hover:bg-[#EDEFF3] hover:text-[#121217]"
                style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}
          </TableCell>

          {/* Date */}
          <TableCell className="whitespace-nowrap text-sm leading-5 text-[#121217]">
            {formatDate(movement.date, bcpLocale)}
          </TableCell>

          {/* Payment — links to the payment-in / payment-out window */}
          <TableCell className="whitespace-nowrap text-sm font-semibold leading-5">
            {movement.paymentId ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openPayment(movement); }}
                className="inline-flex items-center gap-1 text-[#121217] underline decoration-[#d1d4db] underline-offset-4 hover:decoration-[#121217]"
              >
                {movement.documentNo}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            ) : (
              <span className="text-[#121217]">{movement.documentNo}</span>
            )}
          </TableCell>

          {/* Contact */}
          <TableCell className="text-sm leading-5 text-[#121217]">
            {movement.contact}
          </TableCell>

          {/* Description */}
          <TableCell className="max-w-[200px] truncate text-sm text-[#121217]">
            {movement.description}
          </TableCell>

          {/* Status badge */}
          <TableCell>
            <MovementStatusBadge status={movement.paymentStatus} />
          </TableCell>

          {/* Type + posting dot */}
          <TableCell>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm leading-5 text-[#121217]">{getTrxTypeLabel(movement)}</span>
              <PostingStatusDot paymentStatus={movement.paymentStatus} />
            </div>
          </TableCell>

          {/* G/L Item */}
          <TableCell className="max-w-[180px] truncate text-sm text-[#121217]">
            {movement.glItem || '—'}
          </TableCell>

          {/* Amount */}
          <TableCell className="text-right">
            <MoneyAmount
              value={movement.amount}
              currency={movement.currencyIso}
              tone="auto"
              className="text-sm font-semibold leading-5"
            />
          </TableCell>

          {/* Balance */}
          <TableCell className="text-right">
            <MoneyAmount
              value={movement.balance}
              currency={movement.currencyIso}
              tone="neutral"
              className="text-sm font-semibold text-[#121217]"
            />
          </TableCell>

          {/* Kebab — visible on row hover */}
          <TableCell onClick={(e) => e.stopPropagation()}>
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <MovementRowKebab movement={movement} />
            </div>
          </TableCell>
        </TableRow>

        {expanded ? (
          <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC]" data-testid={`movement-moreinfo-${movement.id}`}>
            <TableCell />
            <TableCell colSpan={10} className="py-0">
              <DimensionsPanel movement={movement} enabledDimensions={enabledDimensions} ui={ui} />
            </TableCell>
          </TableRow>
        ) : null}
      </Fragment>
    );
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-[#121217]">
            <TableHead className="w-10" />
            <TableHead>{ui('financeAccountMovementsColDate')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColDocument')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColContact')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColDescription')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColStatus')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColType')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColGlItem')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColAmount')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColBalance')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderBody({
            loading,
            movements,
            emptyLabel: ui('financeAccountMovementsEmpty'),
            renderRow,
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
