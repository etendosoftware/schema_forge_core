import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusTag } from '@/components/ui/status-tag';
import { cn } from '@/lib/utils';
import { StatementLinesInline } from './StatementLinesInline';
import { StatementRowKebab } from './StatementRowKebab';

// ─────────────────────────────────────────────────────────────────────────────
// Layout — grid (NOT <table>) so the expanded accordion row can span all cols.
//   28        · chevron
//   36        · selection checkbox
//   110       · doc nº
//   1fr       · name
//   0.8fr     · file name
//   1fr       · notes
//   120       · import date
//   120       · transaction date
//   80        · lines (numeric right-aligned in the cells)
//   120       · total amount
//   140       · status pill
//   minmax(40, auto) · trailing cell for the per-row kebab
// ─────────────────────────────────────────────────────────────────────────────
const GRID =
  'grid grid-cols-[28px_36px_110px_minmax(160px,1fr)_minmax(120px,0.8fr)_minmax(120px,1fr)_120px_120px_80px_110px_110px_140px_minmax(40px,auto)] gap-4';

// Stable keys for the skeleton cells (kept in lockstep with the grid above) so
// we don't rely on the array index — Sonar/React lint flag that as unstable.
const SKELETON_CELL_KEYS = [
  'chev', 'select', 'docno', 'name', 'file', 'notes', 'imp', 'trx', 'lines', 'out', 'in', 'status', 'spacer',
];

// ─────────────────────────────────────────────────────────────────────────────
// Date / money formatting
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

function formatMoney(amount, currency, bcpLocale) {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(bcpLocale, {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status pill — uses the shared StatusTag component so the chrome (radius,
// padding, font) matches every other status tag across the app (ETP-3835).
// Status → tone mapping:
//   PENDING    → neutral (no lines reconciled yet)
//   PARTIAL    → warning (some lines reconciled)
//   RECONCILED → success (all lines reconciled)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_TO_TONE = {
  DRAFT: 'neutral',
  PENDING: 'neutral',
  PARTIAL: 'warning',
  RECONCILED: 'success',
};

const STATUS_TO_LABEL_KEY = {
  DRAFT:      'financeAccountStatementsStatusDraft',
  PENDING:    'financeAccountStatementsStatusPending',
  PARTIAL:    'financeAccountStatementsStatusPartial',
  RECONCILED: 'financeAccountStatementsStatusReconciled',
};

function StatusPill({ status, matched, total, ui }) {
  const tone = STATUS_TO_TONE[status] ?? 'neutral';
  const base = ui(STATUS_TO_LABEL_KEY[status] ?? STATUS_TO_LABEL_KEY.PENDING);
  const label = status === 'PARTIAL' ? `${base} ${matched}/${total}` : base;
  return <StatusTag tone={tone} label={label} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Imported Statements list with inline accordion (Opción C). Each row reveals
 * a card with the statement's lines.
 *
 * @param {{
 *   statements: Array<object>;
 *   loading: boolean;
 *   currency?: string;
 *   actions?: { onEdit: Function, onProcess: Function, onReactivate: Function, onDelete: Function };
 *   selectedIds?: Set<string>;
 *   onSelectionChange?: (id: string) => void;
 * }} props
 */
export function StatementsTable({
  statements, loading, currency = 'EUR', actions = null,
  selectedIds = new Set(), onSelectionChange = () => {},
}) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const [openId, setOpenId] = useState(null);
  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  // Selection over the currently rendered rows, mirroring the Movements tab.
  const allSelected = statements.length > 0 && statements.every((s) => selectedIds.has(s.id));
  const someSelected = statements.some((s) => selectedIds.has(s.id)) && !allSelected;
  const handleSelectAll = () => {
    if (allSelected) {
      statements.forEach((s) => onSelectionChange(s.id));
    } else {
      statements.filter((s) => !selectedIds.has(s.id)).forEach((s) => onSelectionChange(s.id));
    }
  };

  return (
    <div role="table" className="w-full">
      {/* Header — same style as MovementsTable headers (xs / semibold / #121217). */}
      <div
        role="row"
        className={cn(
          GRID,
          'h-10 items-center border-b border-[#E8EAEF] px-4 text-xs font-semibold leading-4 text-[#121217]',
        )}
      >
        <span aria-hidden="true" />
        <span>
          <Checkbox checked={allSelected} indeterminate={someSelected} onChange={handleSelectAll} />
        </span>
        <span>{ui('financeAccountStatementsColDocumentNo')}</span>
        <span>{ui('financeAccountStatementsColName')}</span>
        <span>{ui('financeAccountStatementsColFileName')}</span>
        <span>{ui('financeAccountStatementsColNotes')}</span>
        <span>{ui('financeAccountStatementsColImportDate')}</span>
        <span>{ui('financeAccountStatementsColTransactionDate')}</span>
        <span>{ui('financeAccountStatementsColLines')}</span>
        <span>{ui('financeAccountStatementsColOut')}</span>
        <span>{ui('financeAccountStatementsColIn')}</span>
        <span>{ui('financeAccountStatementsColStatus')}</span>
        <span aria-hidden="true" />
      </div>

      {/* Body */}
      {renderBody({
        loading, statements, ui, currency, bcpLocale, openId, toggle, actions,
        selectedIds, onSelectionChange,
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body renderer extracted to avoid the nested ternary Sonar flagged on the
// previous loading / empty / rows branching.
// ─────────────────────────────────────────────────────────────────────────────
function renderBody({
  loading, statements, ui, currency, bcpLocale, openId, toggle, actions,
  selectedIds, onSelectionChange,
}) {
  if (loading) {
    return [1, 2, 3, 4, 5].map((n) => (
      <div key={n} role="row" className={cn(GRID, 'border-b border-[#F0F2F5] px-4 py-3')}>
        {SKELETON_CELL_KEYS.map((k) => (
          <Skeleton key={k} className="h-4 w-full" />
        ))}
      </div>
    ));
  }
  if (statements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F7F9]">
          <FileText className="h-5 w-5 text-[#828FA3]" />
        </div>
        <p className="text-sm font-medium text-[#121217]">
          {ui('financeAccountStatementsEmpty')}
        </p>
        <p className="max-w-sm text-sm text-[#6C6C89]">
          {ui('financeAccountStatementsEmptyHint')}
        </p>
      </div>
    );
  }
  return statements.map((s) => {
    const open = openId === s.id;
    return (
      <StatementRow
        key={s.id}
        statement={s}
        currency={currency}
        bcpLocale={bcpLocale}
        ui={ui}
        open={open}
        onToggle={() => toggle(s.id)}
        actions={actions}
        selected={selectedIds.has(s.id)}
        onSelectionChange={onSelectionChange}
      />
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────
function StatementRow({
  statement: s, currency, bcpLocale, ui, open, onToggle, actions, selected, onSelectionChange,
}) {
  // The "Nombre" column shows the statement's own name. Manually-created and
  // most imported statements carry a meaningful name; only fall back to the
  // line date range (and finally an em dash) when no name is set.
  const displayName = s.name
    || (s.periodFrom || s.periodTo
      ? formatRange(s.periodFrom, s.periodTo, bcpLocale)
      : '—');

  return (
    <>
      <div
        role="row"
        data-testid={`statement-row-${s.id}`}
        className={cn(
          GRID,
          'group relative cursor-pointer items-center bg-white px-4 py-3 text-sm transition-shadow',
          open ? 'bg-[#F5F7F9]' : 'hover:z-10 hover:bg-white hover:shadow-lg',
        )}
        onClick={onToggle}
      >
        <button
          type="button"
          aria-label={open ? ui('financeAccountStatementsCollapseAria') : ui('financeAccountStatementsExpandAria')}
          aria-expanded={open}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D1D4DB] bg-white text-[#6C6C89] transition-transform hover:bg-[#F5F7F9] hover:text-[#121217]"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onChange={() => onSelectionChange(s.id)} />
        </span>
        <span className="whitespace-nowrap font-semibold text-[#121217]">{s.documentNo || '—'}</span>
        <span className="truncate text-[#121217]">{displayName}</span>
        <span className={cn('truncate', s.fileName ? 'text-[#121217]' : 'text-[#A8AAB8]')} title={s.fileName || ''}>
          {s.fileName || '—'}
        </span>
        <span className={cn('truncate', s.notes ? 'text-[#121217]' : 'text-[#A8AAB8]')} title={s.notes || ''}>
          {s.notes || '—'}
        </span>
        <span className="whitespace-nowrap text-[#121217]">{formatDate(s.importDate, bcpLocale)}</span>
        <span className="whitespace-nowrap text-[#121217]">{formatDate(s.transactionDate, bcpLocale)}</span>
        <span className="text-right tabular-nums text-[#121217]">{s.lineCount ?? 0}</span>
        <span className={cn('text-right tabular-nums font-semibold', Number(s.totalOut) > 0 ? 'text-[#D50B3E]' : 'text-[#A8AAB8]')}>
          {Number(s.totalOut) > 0 ? `−${formatMoney(s.totalOut, currency, bcpLocale)}` : '—'}
        </span>
        <span className={cn('text-right tabular-nums font-semibold', Number(s.totalIn) > 0 ? 'text-[#17663A]' : 'text-[#A8AAB8]')}>
          {Number(s.totalIn) > 0 ? `+${formatMoney(s.totalIn, currency, bcpLocale)}` : '—'}
        </span>
        <span>
          <StatusPill
            status={s.status}
            matched={s.matchedCount ?? 0}
            total={s.lineCount ?? 0}
            ui={ui}
          />
        </span>
        <span className="flex items-center justify-end">
          {actions ? (
            <StatementRowKebab
              statement={s}
              onEdit={actions.onEdit}
              onProcess={actions.onProcess}
              onReactivate={actions.onReactivate}
              onDelete={actions.onDelete}
            />
          ) : null}
        </span>
      </div>

      {open ? (
        <div className="border-b border-[#E8EAEF] bg-[#F8F9FB] px-4 pb-4">
          <StatementLinesInline
            statementId={s.id}
            currency={currency}
          />
        </div>
      ) : (
        <div className="border-b border-[#F0F2F5]" aria-hidden="true" />
      )}
    </>
  );
}

function formatRange(fromIso, toIso, bcpLocale) {
  const f = formatDate(fromIso, bcpLocale);
  const t = formatDate(toIso, bcpLocale);
  if (f === '—' && t === '—') return '—';
  if (f === t) return f;
  return `${f} ${'–'} ${t}`;
}
