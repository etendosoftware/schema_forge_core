import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { useBankStatements } from '@/hooks/useBankStatements';
import { useStatementActions } from '@/hooks/useStatementActions';
import { StatementsToolbar } from './StatementsToolbar';
import { StatementsTable } from './StatementsTable';
import { StatementLinesView } from './StatementLinesView';
import { ImportStatementModal } from './ImportStatementModal';
import { ManualStatementModal } from './ManualStatementModal';
import { StatementConfirmDialog } from './StatementConfirmDialog';
import { applyAdvancedFilter } from './statementAdvancedFilter';

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
  const ui = useUI();
  const accountId = account?.id ?? null;
  const currency = account?.currencyIso ?? 'EUR';

  const { statements, loading, reload } = useBankStatements(accountId);
  const { processStatement, reactivateStatement, deleteStatement, busy } = useStatementActions();

  const [selectedStatementId, setSelectedStatementId] = useState(null);
  const [search, setSearch] = useState('');
  // Default to the last 30 days, mirroring the Movements tab, so both tabs of the
  // account open with the same date window instead of "any date".
  const [dateRange, setDateRange] = useState({ presetId: 'last30' });
  // Row selection (checkboxes), same plumbing as the Movements tab.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [status, setStatus] = useState(null);
  const [advancedFilter, setAdvancedFilter] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  // Row actions: the statement being edited and the pending process/delete confirm.
  const [editingStatement, setEditingStatement] = useState(null);
  const [confirm, setConfirm] = useState({ variant: null, statement: null });

  const selectedStatement = statements.find((s) => s.id === selectedStatementId) ?? null;

  const rowActions = useMemo(() => ({
    onEdit: (s) => setEditingStatement(s),
    onProcess: (s) => setConfirm({ variant: 'process', statement: s }),
    onReactivate: (s) => setConfirm({ variant: 'reactivate', statement: s }),
    onDelete: (s) => setConfirm({ variant: 'delete', statement: s }),
  }), []);

  const handleSelectionChange = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeConfirm = () => setConfirm({ variant: null, statement: null });

  // Per-variant wiring for the confirm dialog: the action to run plus its
  // success / error toast keys. Keeps runConfirm free of nested branching.
  const CONFIRM_ACTIONS = {
    delete: {
      run: deleteStatement,
      success: 'financeAccountStatementsDeleteSuccess',
      error: 'financeAccountStatementsDeleteError',
    },
    reactivate: {
      run: reactivateStatement,
      success: 'financeAccountStatementsReactivateSuccess',
      error: 'financeAccountStatementsReactivateError',
    },
    process: {
      run: processStatement,
      success: 'financeAccountStatementsProcessSuccess',
      error: 'financeAccountStatementsProcessError',
    },
  };

  const runConfirm = async () => {
    const { variant, statement } = confirm;
    if (!statement) return;
    const cfg = CONFIRM_ACTIONS[variant] ?? CONFIRM_ACTIONS.process;
    try {
      await cfg.run(statement.id);
      toast.success(ui(cfg.success));
      closeConfirm();
      reload();
    } catch {
      toast.error(ui(cfg.error));
    }
  };

  // NOTE: useMemo must run on every render (Rules of Hooks). Keep it BEFORE
  // the conditional early return for the lines sub-view.
  const filteredStatements = useMemo(() => {
    const { from, to } = getDateBounds(dateRange);
    const q = search.trim().toLowerCase();

    const base = statements.filter((s) => {
      if (status && s.status !== status) return false;
      if (from || to) {
        const d = new Date(s.importDate);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (q) {
        const haystack = [s.fileName, s.name, s.documentNo, s.notes]
          .map((v) => (v ?? '').toLowerCase())
          .join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return applyAdvancedFilter(base, advancedFilter);
  }, [statements, search, dateRange, status, advancedFilter]);

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
        advancedFilter={advancedFilter}
        onAdvancedFilterChange={setAdvancedFilter}
        rows={statements}
        onImportClick={() => setImportOpen(true)}
        onManualClick={() => setManualOpen(true)}
      />

      <div className="flex-1 overflow-y-auto [&>div]:overflow-visible">
        <StatementsTable
          statements={filteredStatements}
          loading={loading}
          currency={currency}
          actions={rowActions}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
        />
      </div>

      <ImportStatementModal
        open={importOpen}
        accountId={accountId}
        accountCurrency={currency}
        onClose={() => setImportOpen(false)}
        onSuccess={reload}
      />

      <ManualStatementModal
        open={manualOpen || !!editingStatement}
        accountId={accountId}
        accountCurrency={currency}
        statement={editingStatement}
        onClose={() => { setManualOpen(false); setEditingStatement(null); }}
        onSuccess={reload}
      />

      <StatementConfirmDialog
        variant={confirm.variant}
        statement={confirm.statement}
        busy={busy}
        onConfirm={runConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
