import { useState, useMemo } from 'react';
import { useBankStatements } from '@/hooks/useBankStatements';
import { StatementsToolbar } from './StatementsToolbar';
import { StatementsTable } from './StatementsTable';
import { StatementLinesView } from './StatementLinesView';
import { UploadStatementDialog } from './UploadStatementDialog';

function presetBounds(presetId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  const from = new Date(today);
  if (presetId === 'today') {
    /* from = to = start of today */
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

/**
 * Imported Statements tab for the Financial Account detail view.
 *
 * State machine:
 *   selectedStatementId == null  → list view
 *   selectedStatementId != null  → lines sub-view (← button clears it)
 *
 * @param {{ account: object }} props
 */
export function ImportedStatementsTab({ account }) {
  const accountId = account?.id ?? null;
  const currency = account?.currencyIso ?? 'EUR';

  const { statements, loading, reload } = useBankStatements(accountId);

  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [status, setStatus] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const selectedStatement = statements.find((s) => s.id === selectedStatementId) ?? null;

  // NOTE: useMemo must run on every render (Rules of Hooks). Keep it BEFORE
  // the conditional early return for the lines sub-view.
  const filteredStatements = useMemo(() => {
    const { from, to } = getDateBounds(dateRange);
    const q = search.trim().toLowerCase();

    return statements.filter((s) => {
      if (status && s.status !== status) return false;
      if (from || to) {
        const d = new Date(s.importDate);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (q) {
        const haystack = [s.fileName, s.name, s.documentNo]
          .map((v) => (v ?? '').toLowerCase())
          .join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [statements, search, dateRange, status]);

  if (selectedStatementId) {
    return (
      <StatementLinesView
        statementId={selectedStatementId}
        statementName={selectedStatement?.fileName ?? selectedStatement?.name ?? ''}
        currency={currency}
        onBack={() => setSelectedStatementId(null)}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <StatementsToolbar
        search={search}
        onSearchChange={setSearch}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        status={status}
        onStatusChange={setStatus}
        onImportClick={() => setImportOpen(true)}
      />

      <div className="flex-1 overflow-y-auto [&>div]:overflow-visible">
        <StatementsTable
          statements={filteredStatements}
          loading={loading}
          currency={currency}
        />
      </div>

      <UploadStatementDialog
        open={importOpen}
        accountId={accountId}
        onClose={() => setImportOpen(false)}
        onSuccess={reload}
      />
    </div>
  );
}
