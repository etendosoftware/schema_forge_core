import { toast } from 'sonner';
import { useUI } from '@/i18n';
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
 * Formats an ISO date string as dd/MM/yyyy.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];

const TRX_TYPE_LABEL = {
  BPD: 'Incoming Payment',
  BPW: 'Outgoing Payment',
};

function getTrxTypeLabel(movement) {
  return movement.typeLabel || TRX_TYPE_LABEL[movement.trxType] || movement.trxType || '—';
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
          <TableRow>
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
            <TableHead className="text-right">{ui('financeAccountMovementsColAmount')}</TableHead>
            <TableHead className="text-right">{ui('financeAccountMovementsColBalance')}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            SKELETON_ROWS.map((n) => (
              <TableRow key={n}>
                {[...Array(10)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no meaningful key
                  <TableCell key={i}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : movements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-16 text-center text-sm text-[#6c6c89]">
                No movements found
              </TableCell>
            </TableRow>
          ) : (
            movements.map((movement) => (
              <TableRow
                key={movement.id}
                className="group cursor-pointer"
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
                <TableCell className="whitespace-nowrap text-sm text-[#3f3f50]">
                  {formatDate(movement.date)}
                </TableCell>

                {/* Document */}
                <TableCell className="whitespace-nowrap text-sm font-medium text-[#121217]">
                  {movement.documentNo}
                </TableCell>

                {/* Contact */}
                <TableCell className="text-sm text-[#3f3f50]">
                  {movement.contact}
                </TableCell>

                {/* Description */}
                <TableCell className="max-w-[200px] truncate text-sm text-[#6c6c89]">
                  {movement.description}
                </TableCell>

                {/* Status badge */}
                <TableCell>
                  <MovementStatusBadge status={movement.paymentStatus} />
                </TableCell>

                {/* Type + posting dot */}
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-[#3f3f50]">{getTrxTypeLabel(movement)}</span>
                    <PostingStatusDot paymentStatus={movement.paymentStatus} />
                  </div>
                </TableCell>

                {/* Amount */}
                <TableCell className="text-right">
                  <MoneyAmount
                    value={movement.amount}
                    currency={movement.currencyIso}
                    tone="auto"
                    className="text-sm font-medium"
                  />
                </TableCell>

                {/* Balance */}
                <TableCell className="text-right">
                  <MoneyAmount
                    value={movement.balance}
                    currency={movement.currencyIso}
                    tone="neutral"
                    className="text-sm text-[#6c6c89]"
                  />
                </TableCell>

                {/* Kebab — stop propagation so row click doesn't fire */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <MovementRowKebab movement={movement} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}
