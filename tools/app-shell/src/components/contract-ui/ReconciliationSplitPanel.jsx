import { useMemo, useState } from 'react';
import { ArrowLeft, MoreVertical, CircleCheckBig, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { DistinctValuesFilter } from '@/components/ui/distinct-values-filter';
import { DateRangePopover } from '@/components/ui/date-range-popover';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { MoneyAmount } from '@/components/ui/money-amount';
import { cn } from '@/lib/utils';
import {
  usePendingStatementLines,
  useCandidateOperations,
  useReconcileGroup,
} from '@/hooks/useReconciliation';

// Amounts that differ by <= this absolute value are treated as balanced.
const RECONCILE_TOLERANCE = 0.01;
const SKELETON_ROWS = [1, 2, 3, 4];
// Stable per-column keys for skeleton cells (avoids array-index keys, Sonar S6479).
const SKELETON_CELL_KEYS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
// Elevation shadow shared by the selected row in both panels.
const ELEVATED_SHADOW =
  'shadow-[0px_10px_15px_-3px_rgba(18,18,23,0.08),0px_4px_6px_-2px_rgba(18,18,23,0.05)]';
const STATUS_CODES = ['pending'];
const DOC_TYPE_CODES = ['receipts', 'payments'];

function presetBounds(presetId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  const from = new Date(today);
  if (presetId === 'today') {
    // from = to = start of today
  } else if (presetId === 'yesterday') {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (presetId === 'last7') {
    from.setDate(from.getDate() - 6);
  } else if (presetId === 'last30') {
    from.setDate(from.getDate() - 29);
  } else if (presetId === 'last12m') {
    from.setMonth(from.getMonth() - 12);
  } else {
    return null;
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function getDateBounds(dateRange) {
  if (!dateRange) return { from: null, to: null };
  if ('presetId' in dateRange) {
    const bounds = presetBounds(dateRange.presetId);
    return bounds ?? { from: null, to: null };
  }
  if ('from' in dateRange && 'to' in dateRange) {
    const from = dateRange.from instanceof Date ? new Date(dateRange.from) : null;
    const to = dateRange.to instanceof Date ? new Date(dateRange.to) : null;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  return { from: null, to: null };
}

function toDateParam(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : undefined;
}

/**
 * Formats an ISO date string in UTC. The backend sends date-only values as UTC
 * midnight, so formatting in UTC avoids a negative-offset timezone shifting the
 * calendar day (same rule used across the financial-account window).
 */
function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(d);
}

/** Formats a signed money value as a `±X,XX €` string for the action bar / footer. */
function formatSigned(amount, currency) {
  const abs = Math.abs(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(abs);
  return (Number(amount) < 0 ? '-' : '+') + formatted;
}

/** Pill badge for line/candidate status. Suggested → blue, reconciled → green, else grey. */
function StatusBadge({ kind }) {
  const ui = useUI();
  const map = {
    suggested: { labelKey: 'financeReconcileBadgeSuggested', cls: 'bg-[#E6EEFF] text-[#1B4FD6]' },
    reconciled: { labelKey: 'financeReconcileBadgeReconciled', cls: 'bg-[#E8F6EE] text-[#1E874C]' },
    pending: { labelKey: 'financeReconcileBadgePending', cls: 'bg-[#F0F1F4] text-[#6C6C89]' },
  };
  const cfg = map[kind] ?? map.pending;
  return (
    <span className={cn('inline-flex h-6 items-center rounded-full px-2 py-0.5 text-xs font-normal', cfg.cls)}>
      {ui(cfg.labelKey)}
    </span>
  );
}

function ToolbarShell({ children, search, onSearchChange, testIdPrefix }) {
  const ui = useUI();
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      {children}
      <div className="flex-1" />
      <input
        type="search"
        placeholder={ui('financeReconcileSearchPlaceholder')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        data-testid={`${testIdPrefix}-search`}
        className="h-9 w-40 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm text-[#121217] placeholder:text-[#8a8aa3] focus:outline-none focus:ring-2 focus:ring-[#121217] focus:ring-offset-1"
      />
    </div>
  );
}

function ReconciliationStatusFilter({ value, onChange, count }) {
  const ui = useUI();
  const pendingLabel = `${ui('financeReconcileFilterStatusPending')} (${count})`;
  return (
    <DistinctValuesFilter
      value={value}
      onChange={onChange}
      codes={STATUS_CODES}
      labelFor={() => pendingLabel}
      allLabel={pendingLabel}
      searchPlaceholder={ui('financeReconcileFilterStatusSearchPlaceholder')}
      popoverWidth="w-56"
    />
  );
}

function ReconciliationDocTypeFilter({ value, onChange }) {
  const ui = useUI();
  const labelFor = (code) => {
    if (code === 'payments') return ui('financeReconcileFilterDocTypePayments');
    return ui('financeReconcileFilterDocTypeReceipts');
  };

  return (
    <DistinctValuesFilter
      value={value}
      onChange={onChange}
      codes={DOC_TYPE_CODES}
      labelFor={labelFor}
      allLabel={ui('financeReconcileFilterDocTypeAll')}
      searchPlaceholder={ui('financeReconcileFilterDocTypeSearchPlaceholder')}
      popoverWidth="w-64"
    />
  );
}

/** Renders skeleton / empty / data rows for either table body. */
function renderRows({ loading, items, colSpan, emptyTitle, emptyHint, renderRow }) {
  if (loading) {
    return SKELETON_ROWS.map((n) => (
      <TableRow key={n}>
        {SKELETON_CELL_KEYS.slice(0, colSpan).map((cellKey) => (
          <TableCell key={cellKey}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  if (items.length === 0) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="py-12">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-[#121217]">{emptyTitle}</p>
            {emptyHint ? <p className="max-w-sm text-sm text-[#6C6C89]">{emptyHint}</p> : null}
          </div>
        </TableCell>
      </TableRow>
    );
  }
  return items.map(renderRow);
}

/**
 * Scrollable table scaffold shared by both panels: a sticky-styled header row
 * (the per-panel columns are passed as `headCells`) and the skeleton/empty/data
 * body produced by {@link renderRows}.
 */
function PanelTable({ headCells, loading, items, renderRow }) {
  const ui = useUI();
  return (
    <div className="flex-1 overflow-y-auto [&>div]:overflow-visible">
      <Table>
        <TableHeader>
          <TableRow className="h-11 border-b border-[#E8EAEF] [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[#121217]">
            {headCells}
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderRows({
            loading,
            items,
            colSpan: 5,
            emptyTitle: ui('financeAccountMovementsEmpty'),
            emptyHint: null,
            renderRow,
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Left panel — pending statement lines with single-select radio rows, status
 * badge and a total footer.
 */
function StatementLinesPanel({
  lines, total, loading, currency, bcpLocale, selectedLineId, onSelectLine, search, onSearchChange,
  status, onStatusChange, dateRange, onDateRangeChange, onBack,
}) {
  const ui = useUI();

  const renderRow = (line) => {
    const selected = line.id === selectedLineId;
    const reconciled = line.status === 'reconciled';
    return (
      <TableRow
        key={line.id}
        data-testid={`recon-line-row-${line.id}`}
        onClick={() => onSelectLine(line)}
        className={cn(
          'group relative h-[62px] cursor-pointer border-b border-[#E8EAEF] bg-white transition-shadow',
          selected
            ? `z-20 ${ELEVATED_SHADOW}`
            : 'hover:z-10 hover:bg-white hover:shadow-lg',
        )}
      >
        <TableCell
          className={cn(
            'h-[62px] w-8 px-0 pl-2 transition-colors',
            selected ? 'bg-[#F5F7F9]' : 'bg-white',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="radio"
            name="recon-statement-line"
            aria-label={ui('financeReconcileColSelect')}
            checked={selected}
            onChange={() => onSelectLine(line)}
            data-testid={`recon-line-radio-${line.id}`}
            className="h-4 w-4 accent-[#121217]"
          />
        </TableCell>
        <TableCell className={cn(
          'h-[62px] w-[108px] px-3 text-sm font-normal text-[#121217] transition-colors',
          selected ? 'bg-[#F5F7F9]' : 'bg-white',
        )}>
          {formatDate(line.date, bcpLocale)}
        </TableCell>
        <TableCell className={cn(
          'h-[62px] px-3 py-2 text-sm text-[#121217] transition-colors',
          selected ? 'bg-[#F5F7F9]' : 'bg-white',
        )}>
          <div className="flex flex-col items-start gap-0.5">
            <span className={cn('w-full truncate leading-5', selected ? 'font-semibold' : 'font-normal')}>
              {line.description || line.partnerName || line.referenceNo || '—'}
            </span>
            <StatusBadge kind={reconciled ? 'reconciled' : 'pending'} />
          </div>
        </TableCell>
        <TableCell className={cn(
          'h-[62px] w-[139px] px-3 text-right align-middle transition-colors',
          selected ? 'bg-[#F5F7F9]' : 'bg-white',
        )}>
          <MoneyAmount value={Number(line.amount) || 0} currency={currency} tone="neutral" className="text-sm font-semibold leading-5 text-[#121217]" />
        </TableCell>
        <TableCell className={cn(
          'h-[62px] w-9 px-0 pr-1 transition-colors',
          selected ? 'bg-[#F5F7F9]' : 'bg-white',
        )}>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] transition-opacity hover:bg-[#EDF0F4]',
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex min-w-[30%] flex-1 flex-col overflow-hidden border-r border-[#E8EAEF]">
      <ToolbarShell
        search={search}
        onSearchChange={onSearchChange}
        testIdPrefix="recon-left"
      >
        <button
          type="button"
          aria-label={ui('financeAccountDetailBack')}
          data-testid="recon-toolbar-back"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground transition-colors hover:bg-[#F5F7F9] hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <ReconciliationStatusFilter value={status} onChange={onStatusChange} count={total} />
        <DateRangePopover
          value={dateRange}
          onChange={onDateRangeChange}
          placeholder={ui('financeReconcileFilterDate')}
        />
      </ToolbarShell>
      <PanelTable
        loading={loading}
        items={lines}
        renderRow={renderRow}
        headCells={(
          <>
            <TableHead className="w-8 px-0 pl-2" />
            <TableHead className="w-[108px] px-3">{ui('financeReconcileColDate')}</TableHead>
            <TableHead className="px-3">{ui('financeReconcileColDescription')}</TableHead>
            <TableHead className="w-[139px] px-3 text-left">{ui('financeReconcileColAmount')}</TableHead>
            <TableHead className="w-9 px-0 pr-1" />
          </>
        )}
      />
      <div className="flex items-center justify-end gap-2 border-t border-[#E8EAEF] px-4 py-3 text-sm font-semibold text-[#121217]">
        {ui('financeReconcileFooterTotal', { amount: formatSigned(total === 0 ? 0 : (Number(lines.reduce((a, l) => a + (Number(l.amount) || 0), 0).toFixed(2))), currency) })}
      </div>
    </div>
  );
}

/** Right panel — candidate operations with multi-select checkbox rows. */
function CandidateOperationsPanel({
  line, candidates, loading, currency, bcpLocale, selectedIds, onToggle, search, onSearchChange,
  docType, onDocTypeChange, dateRange, onDateRangeChange, footer,
}) {
  const ui = useUI();

  if (!line) {
    return (
      <div className="flex min-w-[30%] flex-1 flex-col items-center justify-center px-0 text-center" data-testid="recon-right-empty">
        <div className="flex w-full flex-col items-center gap-1 px-5">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F7F9] text-[#828FA3]">
            <CircleCheckBig className="h-6 w-6" />
          </div>
          <p className="w-full text-[20px] font-semibold leading-7 text-[#121217]">{ui('financeReconcileRightEmptyTitle')}</p>
          <p className="w-full text-xs leading-4 text-[#282833]">{ui('financeReconcileRightEmptyHint')}</p>
        </div>
      </div>
    );
  }

  const renderRow = (cand) => (
    <TableRow
      key={cand.id}
      data-testid={`recon-cand-row-${cand.id}`}
      className={cn(
        'group relative h-[62px] border-b border-[#E8EAEF] bg-white transition-shadow',
        selectedIds.has(cand.id)
          ? `z-10 bg-[#F5F7F9] ${ELEVATED_SHADOW}`
          : 'hover:z-10 hover:bg-white hover:shadow-lg',
      )}
    >
      <TableCell className="h-[62px] w-8 px-0 pl-2">
        <Checkbox
          checked={selectedIds.has(cand.id)}
          onChange={() => onToggle(cand.id)}
          data-testid={`recon-cand-check-${cand.id}`}
        />
      </TableCell>
      <TableCell className="h-[62px] w-[104px] px-3 text-sm font-normal text-[#121217]">
        {formatDate(cand.date, bcpLocale)}
      </TableCell>
      <TableCell className="h-[62px] px-3 py-2 text-sm text-[#121217]">
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex w-full items-center gap-1 overflow-hidden text-sm leading-5">
            <span className="shrink-0 font-normal text-[#121217]">
              {cand.documentNo || '—'}
            </span>
            {cand.partnerName ? (
              <span className="truncate text-xs font-medium leading-4 text-[#6C6C89]">{cand.partnerName}</span>
            ) : null}
          </div>
          <StatusBadge kind={cand.suggested ? 'suggested' : 'pending'} />
        </div>
      </TableCell>
      <TableCell className="h-[62px] w-[121px] px-3 text-right align-middle">
        <MoneyAmount value={Number(cand.pendingBalance) || 0} currency={currency} tone="neutral" className="text-sm font-normal leading-5 text-[#121217]" />
      </TableCell>
      <TableCell className="h-[62px] w-[121px] px-3 text-right align-middle">
        <MoneyAmount value={Number(cand.amount) || 0} currency={currency} tone="neutral" className="text-sm font-semibold leading-5 text-[#121217]" />
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex min-w-[30%] flex-1 flex-col overflow-hidden">
      <ToolbarShell
        search={search}
        onSearchChange={onSearchChange}
        testIdPrefix="recon-right"
      >
        <ReconciliationDocTypeFilter value={docType} onChange={onDocTypeChange} />
        <DateRangePopover
          value={dateRange}
          onChange={onDateRangeChange}
          placeholder={ui('financeReconcileFilterDate')}
        />
      </ToolbarShell>
      <PanelTable
        loading={loading}
        items={candidates}
        renderRow={renderRow}
        headCells={(
          <>
            <TableHead className="w-8 px-0 pl-2" />
            <TableHead className="w-[104px] px-3">{ui('financeReconcileColDate')}</TableHead>
            <TableHead className="px-3">{ui('financeReconcileColInfo')}</TableHead>
            <TableHead className="w-[121px] px-3 text-left">{ui('financeReconcileColPendingBalance')}</TableHead>
            <TableHead className="w-[121px] px-3 text-left">{ui('financeReconcileColAmount')}</TableHead>
          </>
        )}
      />
      {footer}
    </div>
  );
}

/** Bottom action bar with the running totals and the reconcile / placeholder buttons. */
function ReconciliationActionBar({
  currency, selectedSum, remaining, canReconcile, isReconciledLine, reconcileCount, busy,
  onCancel, onReconcile,
}) {
  const ui = useUI();
  return (
    <div className="border-t border-[#E8EAEF] bg-white px-0 pt-2 pb-1">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between px-3 text-sm leading-5">
          <span className="font-medium text-[#121217]">{ui('financeReconcileBarSelected')}</span>
          <span className="font-semibold text-[#1E874C]">{formatSigned(selectedSum, currency)}</span>
        </div>
        <div className="flex items-center justify-between px-3 text-sm leading-5">
          <span className="font-medium text-[#121217]">{ui('financeReconcileBarRemaining')}</span>
          <span className={cn('font-semibold', Math.abs(remaining) <= RECONCILE_TOLERANCE ? 'text-[#1E874C]' : 'text-[#D50B3E]')}>
            {formatSigned(remaining, currency)}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="recon-action-cancel"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] shadow-[0px_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
        >
          <X className="h-4 w-4" />
          {ui('financeReconcileActionCancel')}
        </button>
        <button
          type="button"
          onClick={onReconcile}
          disabled={!canReconcile || busy || isReconciledLine}
          data-testid="recon-action-reconcile"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#121217] px-3 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:bg-[#D1D4DB] disabled:text-white disabled:hover:bg-[#D1D4DB] disabled:hover:text-white"
        >
          <CheckCircle className="h-4 w-4" />
          {isReconciledLine
            ? ui('financeReconcileActionReactivate')
            : ui('financeReconcileActionReconcileCount', { count: reconcileCount })}
        </button>
      </div>
    </div>
  );
}

/**
 * Manual bank reconciliation split panel (T6).
 *
 * Left: pending statement lines (single-select). Right: candidate operations for
 * the selected line (multi-select). Bottom: running totals + reconcile action,
 * enabled only when the selected operations balance the line within tolerance.
 *
 * Composes the backend at /sws/neo/bank-reconciliation — it never reimplements
 * Etendo's reconciliation logic; the POST just hands the grouped ids over.
 *
 * @param {{ accountId: string|null, currency?: string, onBack?: () => void, onReconcileSuccess?: () => void }} props
 */
export function ReconciliationSplitPanel({ accountId, currency = 'EUR', onBack, onReconcileSuccess }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');

  const [leftStatus, setLeftStatus] = useState('pending');
  const [leftDateRange, setLeftDateRange] = useState({ presetId: 'last30' });
  const [leftSearch, setLeftSearch] = useState('');
  const [rightDocType, setRightDocType] = useState(null);
  const [rightDateRange, setRightDateRange] = useState({ presetId: 'last30' });
  const [rightSearch, setRightSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedOpIds, setSelectedOpIds] = useState(() => new Set());

  const leftBounds = useMemo(() => getDateBounds(leftDateRange), [leftDateRange]);
  const rightBounds = useMemo(() => getDateBounds(rightDateRange), [rightDateRange]);

  const { lines, total, loading: linesLoading, reload: reloadLines } =
    usePendingStatementLines(accountId, {
      status: leftStatus || undefined,
      dateFrom: toDateParam(leftBounds.from),
      dateTo: toDateParam(leftBounds.to),
    });
  const { candidates, loading: candLoading } =
    useCandidateOperations(accountId, selectedLine?.id ?? null, rightDocType);
  const { reconcile, loading: reconciling } = useReconcileGroup();

  const selectLine = (line) => {
    setSelectedLine(line);
    setSelectedOpIds(new Set());
  };

  const toggleOp = (id) => {
    setSelectedOpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectedLine(null);
    setSelectedOpIds(new Set());
  };

  const visibleLines = useMemo(() => {
    const q = leftSearch.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) =>
      [l.description, l.partnerName, l.referenceNo].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [lines, leftSearch]);

  const visibleCandidates = useMemo(() => {
    const q = rightSearch.trim().toLowerCase();
    return candidates.filter((c) => {
      if (rightBounds.from || rightBounds.to) {
        const d = new Date(c.date);
        if (rightBounds.from && d < rightBounds.from) return false;
        if (rightBounds.to && d > rightBounds.to) return false;
      }
      if (!q) return true;
      return [c.documentNo, c.partnerName].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [candidates, rightBounds.from, rightBounds.to, rightSearch]);

  const selectedSum = useMemo(
    () => Number(
      candidates
        .filter((c) => selectedOpIds.has(c.id))
        .reduce((acc, c) => acc + (Number(c.amount) || 0), 0)
        .toFixed(2),
    ),
    [candidates, selectedOpIds],
  );

  const lineAmount = Number(selectedLine?.amount) || 0;
  const remaining = Number((lineAmount - selectedSum).toFixed(2));
  const isReconciledLine = selectedLine?.status === 'reconciled';
  const canReconcile =
    !!selectedLine && selectedOpIds.size > 0 && Math.abs(remaining) <= RECONCILE_TOLERANCE && !isReconciledLine;

  const handleReconcile = async () => {
    if (!canReconcile) return;
    try {
      await reconcile({
        financialAccountId: accountId,
        statementLineId: selectedLine.id,
        operationIds: Array.from(selectedOpIds),
      });
      toast.success(ui('financeReconcileToastSuccess'));
      setSelectedLine(null);
      setSelectedOpIds(new Set());
      reloadLines();
      onReconcileSuccess?.();
    } catch (err) {
      toast.error(err?.message || ui('financeReconcileToastError'));
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <StatementLinesPanel
          lines={visibleLines}
          total={total}
          loading={linesLoading}
          currency={currency}
          bcpLocale={bcpLocale}
          selectedLineId={selectedLine?.id ?? null}
          onSelectLine={selectLine}
          status={leftStatus}
          onStatusChange={setLeftStatus}
          dateRange={leftDateRange}
          onDateRangeChange={setLeftDateRange}
          search={leftSearch}
          onSearchChange={setLeftSearch}
          onBack={onBack}
        />
        <CandidateOperationsPanel
          line={selectedLine}
          candidates={visibleCandidates}
          loading={candLoading}
          currency={currency}
          bcpLocale={bcpLocale}
          selectedIds={selectedOpIds}
          onToggle={toggleOp}
          docType={rightDocType}
          onDocTypeChange={setRightDocType}
          dateRange={rightDateRange}
          onDateRangeChange={setRightDateRange}
          search={rightSearch}
          onSearchChange={setRightSearch}
          footer={selectedLine ? (
            <ReconciliationActionBar
              currency={currency}
              selectedSum={selectedSum}
              remaining={remaining}
              canReconcile={canReconcile}
              isReconciledLine={isReconciledLine}
              reconcileCount={selectedOpIds.size}
              busy={reconciling}
              onCancel={cancelSelection}
              onReconcile={handleReconcile}
            />
          ) : null}
        />
      </div>
    </div>
  );
}
