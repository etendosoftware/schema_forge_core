import { Fragment, useState } from 'react';
import { ArrowUpRight, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

/** Formats an ISO date string using the user's locale. */
function formatDate(isoString, bcpLocale) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];

// Stable cell keys for skeleton rows (same order/length as the header columns).
const SKELETON_COL_KEYS = [
  'expand', 'select', 'date', 'payment', 'contact', 'description',
  'status', 'type', 'glItem', 'amount', 'balance', 'kebab',
];
const COL_COUNT = SKELETON_COL_KEYS.length; // 12

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

function renderBody({ loading, movements, ui, renderRow }) {
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
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={COL_COUNT} className="py-16">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F7F9]">
              <ArrowLeftRight className="h-5 w-5 text-[#828FA3]" />
            </div>
            <p className="text-sm font-medium text-[#121217]">
              {ui('financeAccountMovementsEmpty')}
            </p>
            <p className="max-w-sm text-sm text-[#6C6C89]">
              {ui('financeAccountMovementsEmptyHint')}
            </p>
          </div>
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
 * "More info" panel — read-only accounting dimensions rendered as disabled
 * form fields (label on top + greyed-out bordered box, same look as a read-only
 * field in the document forms), in a 4-column grid with an elevated surface.
 *
 * Shows the dimensions enabled in the chart of accounts (even when empty, like
 * Classic), as read-only fields. The business partner is excluded — it already
 * has its own "Contacto" column.
 */
function DimensionsPanel({ movement, enabledDimensions, ui }) {
  const dims = movement.dimensions || {};
  const visible = enabledDimensions.filter((key) => key !== 'bpartner');

  if (visible.length === 0) {
    return (
      <div className="pl-16 pr-[52px] pb-8 pt-3 text-sm text-[#6C6C89]">
        {ui('financeAccountMovementsNoDimensions')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 pl-16 pr-[52px] pb-8 pt-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-6 text-[#121217]">
            {ui(DIMENSION_LABEL_KEYS[key] ?? key)}
          </span>
          <Input className="items-center" value={dims[key] || ''} disabled readOnly />
        </div>
      ))}
    </div>
  );
}

/**
 * Table of account movements. Each row has a chevron (left) that expands a
 * "more info" panel with the accounting dimensions, plus a selection checkbox.
 *
 * @param {{
 *   movements: Array<object>;
 *   loading: boolean;
 *   enabledDimensions?: string[];
 *   selectedIds: Set<string>;
 *   onSelectionChange: (id: string) => void;
 * }} props
 */
export function MovementsTable({ movements, loading, enabledDimensions = [], selectedIds, onSelectionChange }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const getTrxTypeLabel = useTrxTypeLabel();
  const [expandedId, setExpandedId] = useState(null);
  const hasDimensions = enabledDimensions.length > 0;

  const allSelected = movements.length > 0 && selectedIds.size === movements.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const handleSelectAll = () => {
    if (allSelected) {
      movements.forEach((m) => onSelectionChange(m.id));
    } else {
      movements.filter((m) => !selectedIds.has(m.id)).forEach((m) => onSelectionChange(m.id));
    }
  };

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id));

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
          className={`group relative bg-white transition-shadow ${hasDimensions ? 'cursor-pointer' : ''} ${
            expanded
              ? 'z-20 border-b-0 [&>td]:border-b-0 hover:bg-white'
              : 'hover:z-10 hover:bg-white hover:shadow-lg'
          }`}
          onClick={() => { if (hasDimensions) toggleExpand(movement.id); }}
        >
          {/* Expand chevron (circular button) */}
          <TableCell onClick={(e) => e.stopPropagation()}>
            {hasDimensions ? (
              <button
                type="button"
                aria-label={ui('financeAccountMovementsMoreInfo')}
                aria-expanded={expanded}
                data-testid={`movement-expand-${movement.id}`}
                onClick={() => toggleExpand(movement.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D1D4DB] bg-white text-[#6C6C89] transition-transform hover:bg-[#F5F7F9] hover:text-[#121217]"
                style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            ) : null}
          </TableCell>

          {/* Selection checkbox */}
          <TableCell onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(movement.id)}
              onChange={() => onSelectionChange(movement.id)}
            />
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
          <TableRow
            className="relative z-10 border-b-0 bg-white shadow-lg [&>td]:border-b-0 hover:bg-white"
            data-testid={`movement-moreinfo-${movement.id}`}
          >
            <TableCell colSpan={COL_COUNT} className="p-0">
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
            <TableHead className="w-10">
              <Checkbox checked={allSelected} indeterminate={someSelected} onChange={handleSelectAll} />
            </TableHead>
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
            ui,
            renderRow,
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
