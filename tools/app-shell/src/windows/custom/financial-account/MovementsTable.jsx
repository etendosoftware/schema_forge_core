import { toast } from 'sonner';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Checkbox } from '@/components/ui/checkbox';
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
 *
 * @param {string} isoString
 * @param {string} bcpLocale - BCP-47 locale, e.g. "es-ES", "en-US"
 * @returns {string}
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
  'select', 'date', 'document', 'contact', 'description',
  'status', 'type', 'amount', 'balance', 'kebab',
];

/**
 * Decides what to render inside the table body: skeleton rows while loading,
 * an empty-state message when there are no movements, or the actual rows.
 * Extracted to avoid a nested ternary (Sonar S3358).
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
        <TableCell colSpan={10} className="py-16 text-center text-sm text-[#6c6c89]">
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
    movement.trxType ||
    '—';
}

/**
 * Table of account movements.
 *
 * @param {{
 *   movements: Array<object>;
 *   loading: boolean;
 *   selectedIds: Set<string>;
 *   onSelectionChange: (id: string) => void;
 * }} props
 */
export function MovementsTable({ movements, loading, selectedIds, onSelectionChange }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const getTrxTypeLabel = useTrxTypeLabel();
  const allSelected = movements.length > 0 && selectedIds.size === movements.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      movements.forEach((m) => onSelectionChange(m.id));
    } else {
      movements
        .filter((m) => !selectedIds.has(m.id))
        .forEach((m) => onSelectionChange(m.id));
    }
  };

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-[#121217]">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>{ui('financeAccountMovementsColDate')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColDocument')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColContact')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColDescription')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColStatus')}</TableHead>
            <TableHead>{ui('financeAccountMovementsColType')}</TableHead>
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
            renderRow: (movement) => (
              <TableRow
                key={movement.id}
                className="group relative cursor-pointer bg-white transition-shadow hover:z-10 hover:bg-white hover:shadow-lg"
                onClick={() => toast(ui('financeAccountMovementsRowViewDetailToast'))}
              >
                {/* Checkbox — stop propagation so row click doesn't also toggle */}
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

                {/* Document */}
                <TableCell className="whitespace-nowrap text-sm font-semibold leading-5 text-[#121217]">
                  {movement.documentNo}
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
            ),
          })}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
