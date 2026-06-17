import { useMemo, useState } from 'react';
import { Scale, Sparkles, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.cls)}>
      {ui(cfg.labelKey)}
    </span>
  );
}

/** Toolbar shared by both panels: a status/docType chip, a date chip and a search box. */
function PanelToolbar({ leadLabel, search, onSearchChange, testIdPrefix }) {
  const ui = useUI();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#E8EAEF] px-3 py-2">
      <span className="inline-flex h-9 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217]">
        {leadLabel}
      </span>
      <span className="inline-flex h-9 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm text-[#6C6C89]">
        {ui('financeReconcileFilterDate')}
      </span>
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

/** Renders skeleton / empty / data rows for either table body. */
function renderRows({ loading, items, colSpan, emptyTitle, emptyHint, renderRow }) {
  if (loading) {
    return SKELETON_ROWS.map((n) => (
      <TableRow key={n}>
        {Array.from({ length: colSpan }).map((_, i) => (
          <TableCell key={i}>
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
 * Left panel — pending statement lines with single-select radio rows, status
 * badge and a total footer.
 */
function StatementLinesPanel({
  lines, total, loading, currency, bcpLocale, selectedLineId, onSelectLine, search, onSearchChange,
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
        className={cn('cursor-pointer', selected ? 'bg-[#F5F7F9]' : 'hover:bg-[#FAFBFC]')}
      >
        <TableCell className="w-9" onClick={(e) => e.stopPropagation()}>
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
        <TableCell className="whitespace-nowrap text-sm text-[#121217]">
          {formatDate(line.date, bcpLocale)}
        </TableCell>
        <TableCell className="text-sm text-[#121217]">
          <div className="flex flex-col gap-1">
            <span className="truncate">{line.description || '—'}</span>
            <StatusBadge kind={reconciled ? 'reconciled' : 'pending'} />
          </div>
        </TableCell>
        <TableCell className="text-right">
          <MoneyAmount value={Number(line.amount) || 0} currency={currency} tone="auto" className="text-sm font-semibold" />
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex min-w-[30%] flex-1 flex-col overflow-hidden border-r border-[#E8EAEF]">
      <PanelToolbar
        leadLabel={`${ui('financeReconcileFilterStatusPending')} (${total})`}
        search={search}
        onSearchChange={onSearchChange}
        testIdPrefix="recon-left"
      />
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[#121217]">
              <TableHead className="w-9" />
              <TableHead>{ui('financeReconcileColDate')}</TableHead>
              <TableHead>{ui('financeReconcileColDescription')}</TableHead>
              <TableHead className="text-right">{ui('financeReconcileColAmount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRows({
              loading,
              items: lines,
              colSpan: 4,
              emptyTitle: ui('financeAccountMovementsEmpty'),
              emptyHint: null,
              renderRow,
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-[#E8EAEF] px-4 py-3 text-sm font-semibold text-[#121217]">
        {ui('financeReconcileFooterTotal', { amount: formatSigned(total === 0 ? 0 : (Number(lines.reduce((a, l) => a + (Number(l.amount) || 0), 0).toFixed(2))), currency) })}
      </div>
    </div>
  );
}

/** Header banner above the candidates table showing the selected line metadata. */
function SelectedLineHeader({ line, currency, bcpLocale }) {
  const amount = Number(line.amount) || 0;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E8EAEF] bg-[#F8F9FB] px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[#121217]">{line.description || '—'}</div>
        <div className="mt-0.5 text-xs text-[#6C6C89]">{formatDate(line.date, bcpLocale)}</div>
      </div>
      <MoneyAmount value={amount} currency={currency} tone="auto" className="whitespace-nowrap text-lg font-bold tabular-nums" />
    </div>
  );
}

/** Right panel — candidate operations with multi-select checkbox rows. */
function CandidateOperationsPanel({
  line, candidates, loading, currency, bcpLocale, selectedIds, onToggle, search, onSearchChange,
}) {
  const ui = useUI();

  if (!line) {
    return (
      <div className="flex min-w-[30%] flex-1 flex-col items-center justify-center gap-2 py-24 text-center" data-testid="recon-right-empty">
        <Scale className="h-10 w-10 text-[#D1D4DB]" />
        <p className="text-sm font-medium text-[#121217]">{ui('financeReconcileRightEmptyTitle')}</p>
        <p className="max-w-xs text-sm text-[#6C6C89]">{ui('financeReconcileRightEmptyHint')}</p>
      </div>
    );
  }

  const renderRow = (cand) => (
    <TableRow key={cand.id} data-testid={`recon-cand-row-${cand.id}`} className="hover:bg-[#FAFBFC]">
      <TableCell className="w-9">
        <Checkbox
          checked={selectedIds.has(cand.id)}
          onChange={() => onToggle(cand.id)}
          data-testid={`recon-cand-check-${cand.id}`}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-[#121217]">{formatDate(cand.date, bcpLocale)}</TableCell>
      <TableCell className="text-sm text-[#121217]">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{cand.documentNo || '—'}</span>
          <span className="text-xs text-[#6C6C89]">{cand.partnerName || '—'}</span>
          <StatusBadge kind={cand.suggested ? 'suggested' : 'pending'} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <MoneyAmount value={Number(cand.pendingBalance) || 0} currency={currency} tone="neutral" className="text-sm" />
      </TableCell>
      <TableCell className="text-right">
        <MoneyAmount value={Number(cand.amount) || 0} currency={currency} tone="auto" className="text-sm font-semibold" />
      </TableCell>
    </TableRow>
  );

  return (
    <div className="flex min-w-[30%] flex-1 flex-col overflow-hidden">
      <SelectedLineHeader line={line} currency={currency} bcpLocale={bcpLocale} />
      <PanelToolbar
        leadLabel={ui('financeReconcileFilterDocTypeAll')}
        search={search}
        onSearchChange={onSearchChange}
        testIdPrefix="recon-right"
      />
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[#121217]">
              <TableHead className="w-9" />
              <TableHead>{ui('financeReconcileColDate')}</TableHead>
              <TableHead>{ui('financeReconcileColInfo')}</TableHead>
              <TableHead className="text-right">{ui('financeReconcileColPendingBalance')}</TableHead>
              <TableHead className="text-right">{ui('financeReconcileColAmount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRows({
              loading,
              items: candidates,
              colSpan: 5,
              emptyTitle: ui('financeAccountMovementsEmpty'),
              emptyHint: null,
              renderRow,
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Bottom action bar with the running totals and the reconcile / placeholder buttons. */
function ReconciliationActionBar({
  currency, selectedSum, remaining, canReconcile, isReconciledLine, reconcileCount, busy,
  onCancel, onTransfer, onNewDoc, onReconcile,
}) {
  const ui = useUI();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EAEF] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <span className="text-[#6C6C89]">
          {ui('financeReconcileBarSelected')}:{' '}
          <span className="font-semibold text-[#121217]">{formatSigned(selectedSum, currency)}</span>
        </span>
        <span className="text-[#6C6C89]">
          {ui('financeReconcileBarRemaining')}:{' '}
          <span className={cn('font-semibold', Math.abs(remaining) <= RECONCILE_TOLERANCE ? 'text-[#1E874C]' : 'text-[#d50b3e]')}>
            {formatSigned(remaining, currency)}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="recon-action-cancel"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
        >
          <X className="h-4 w-4" />
          {ui('financeReconcileActionCancel')}
        </button>
        <button
          type="button"
          onClick={onTransfer}
          data-testid="recon-action-transfer"
          className="inline-flex h-9 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
        >
          {ui('financeReconcileActionTransfer')}
        </button>
        <button
          type="button"
          onClick={onNewDoc}
          data-testid="recon-action-newdoc"
          className="inline-flex h-9 items-center rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
        >
          {ui('financeReconcileActionNewDoc')}
        </button>
        <button
          type="button"
          onClick={onReconcile}
          disabled={!canReconcile || busy || isReconciledLine}
          data-testid="recon-action-reconcile"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#121217] px-3 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:cursor-not-allowed disabled:bg-[#D1D4DB] disabled:text-white disabled:hover:bg-[#D1D4DB] disabled:hover:text-white"
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
 * @param {{ accountId: string|null, currency?: string, onReconcileSuccess?: () => void }} props
 */
export function ReconciliationSplitPanel({ accountId, currency = 'EUR', onReconcileSuccess }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');

  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState(null);
  const [selectedOpIds, setSelectedOpIds] = useState(() => new Set());

  const { lines, total, loading: linesLoading, reload: reloadLines } =
    usePendingStatementLines(accountId, { q: leftSearch || undefined });
  const { candidates, loading: candLoading } =
    useCandidateOperations(accountId, selectedLine?.id ?? null);
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

  const cancelSelection = () => setSelectedOpIds(new Set());

  const visibleCandidates = useMemo(() => {
    const q = rightSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.documentNo, c.partnerName].some((v) => (v || '').toLowerCase().includes(q)),
    );
  }, [candidates, rightSearch]);

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

  const comingSoon = () => toast(ui('financeReconcileToastComingSoon'));

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
      {/* Top bar with the disabled Automatch button (enabled in T7). */}
      <div className="flex items-center justify-end border-b border-[#E8EAEF] px-3 py-2">
        <button
          type="button"
          disabled
          data-testid="recon-automatch"
          className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-[#D1D4DB] bg-[#F5F7F9] px-3 text-sm font-medium text-[#A8AAB8]"
        >
          <Sparkles className="h-4 w-4" />
          {ui('financeReconcileActionAutomatch')}
        </button>
      </div>

      {/* Split body. */}
      <div className="flex flex-1 overflow-hidden">
        <StatementLinesPanel
          lines={lines}
          total={total}
          loading={linesLoading}
          currency={currency}
          bcpLocale={bcpLocale}
          selectedLineId={selectedLine?.id ?? null}
          onSelectLine={selectLine}
          search={leftSearch}
          onSearchChange={setLeftSearch}
        />
        <CandidateOperationsPanel
          line={selectedLine}
          candidates={visibleCandidates}
          loading={candLoading}
          currency={currency}
          bcpLocale={bcpLocale}
          selectedIds={selectedOpIds}
          onToggle={toggleOp}
          search={rightSearch}
          onSearchChange={setRightSearch}
        />
      </div>

      {/* Action bar — only meaningful once a line is selected. */}
      {selectedLine ? (
        <ReconciliationActionBar
          currency={currency}
          selectedSum={selectedSum}
          remaining={remaining}
          canReconcile={canReconcile}
          isReconciledLine={isReconciledLine}
          reconcileCount={selectedOpIds.size}
          busy={reconciling}
          onCancel={cancelSelection}
          onTransfer={comingSoon}
          onNewDoc={comingSoon}
          onReconcile={handleReconcile}
        />
      ) : null}
    </div>
  );
}
