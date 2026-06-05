import { useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusTag } from '@/components/ui/status-tag';
import { cn } from '@/lib/utils';
import { StatementLinesInline } from './StatementLinesInline';

// ─────────────────────────────────────────────────────────────────────────────
// Layout — grid (NOT <table>) so the expanded accordion row can span all cols.
//   28        · chevron
//   110       · doc nº
//   1fr       · name (caps at 1fr instead of 2fr so it doesn't eat the row)
//   130       · import date
//   130       · transaction date
//   90        · lines (numeric right-aligned in the cells)
//   130       · total amount
//   150       · status pill
//   minmax(32, 1fr) · trailing flexible spacer — absorbs the leftover width on
//                     wide viewports so the data columns stay close to the name
// ─────────────────────────────────────────────────────────────────────────────
const GRID =
  'grid grid-cols-[28px_110px_minmax(220px,1fr)_130px_130px_90px_130px_150px_minmax(32px,1fr)] gap-4';

// Stable keys for the 9 skeleton cells (kept in lockstep with the grid above)
// so we don't rely on the array index — Sonar/React lint flag that as unstable.
const SKELETON_CELL_KEYS = [
  'chev', 'docno', 'name', 'imp', 'trx', 'lines', 'total', 'status', 'spacer',
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
  PENDING: 'neutral',
  PARTIAL: 'warning',
  RECONCILED: 'success',
};

const STATUS_TO_LABEL_KEY = {
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
 * }} props
 */
export function StatementsTable({ statements, loading, currency = 'EUR' }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const [openId, setOpenId] = useState(null);
  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

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
        <span>{ui('financeAccountStatementsColDocumentNo')}</span>
        <span>{ui('financeAccountStatementsColName')}</span>
        <span>{ui('financeAccountStatementsColImportDate')}</span>
        <span>{ui('financeAccountStatementsColTransactionDate')}</span>
        <span>{ui('financeAccountStatementsColLines')}</span>
        <span>{ui('financeAccountStatementsColTotalAmount')}</span>
        <span>{ui('financeAccountStatementsColStatus')}</span>
        <span aria-hidden="true" />
      </div>

      {/* Body */}
      {renderBody({ loading, statements, ui, currency, bcpLocale, openId, toggle })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body renderer extracted to avoid the nested ternary Sonar flagged on the
// previous loading / empty / rows branching.
// ─────────────────────────────────────────────────────────────────────────────
function renderBody({ loading, statements, ui, currency, bcpLocale, openId, toggle }) {
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
      />
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────
function StatementRow({ statement: s, currency, bcpLocale, ui, open, onToggle }) {
  const rangeName = s.periodFrom || s.periodTo
    ? formatRange(s.periodFrom, s.periodTo, bcpLocale)
    : (s.name || '—');

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
        <span
          role="button"
          aria-label={open ? ui('financeAccountStatementsCollapseAria') : ui('financeAccountStatementsExpandAria')}
          aria-expanded={open}
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#6C6C89] transition-transform hover:bg-[#EDEFF3] hover:text-[#121217]"
          style={{ transform: open ? 'rotate(90deg)' : undefined }}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap font-semibold text-[#121217]">{s.documentNo || '—'}</span>
        <span className="truncate text-[#121217]">{rangeName}</span>
        <span className="whitespace-nowrap text-[#121217]">{formatDate(s.importDate, bcpLocale)}</span>
        <span className="whitespace-nowrap text-[#121217]">{formatDate(s.transactionDate, bcpLocale)}</span>
        <span className="text-right tabular-nums text-[#121217]">{s.lineCount ?? 0}</span>
        <span className="text-right tabular-nums font-semibold text-[#121217]">
          {formatMoney(s.totalAmount, currency, bcpLocale)}
        </span>
        <span>
          <StatusPill
            status={s.status}
            matched={s.matchedCount ?? 0}
            total={s.lineCount ?? 0}
            ui={ui}
          />
        </span>
        <span aria-hidden="true" />
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
