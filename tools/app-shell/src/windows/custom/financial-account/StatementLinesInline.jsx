import { List } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusTag } from '@/components/ui/status-tag';
import { cn } from '@/lib/utils';
import { useBankStatementLines } from '@/hooks/useBankStatementLines';

// Grid for the `mini` variant of the lines table.
//   100        · date (fixed)
//   minmax(160, 1fr) · description
//   minmax(120, 1fr) · contact name (free text)
//   minmax(120, 1fr) · contact (business partner FK)
//   minmax(120, 1fr) · G/L item (concepto contable)
//   110        · withdrawal (out)
//   110        · deposit (in)
//   100        · status pill
//   minmax(0, 1fr)  · trailing flexible spacer — absorbs leftover width on
//                    wide viewports so the data columns stay close to each other.
const MINI_GRID =
  'grid grid-cols-[100px_minmax(160px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_110px_110px_100px_minmax(0,1fr)] gap-3';

// Stable keys for the skeleton cells of each loading row (matches MINI_GRID).
const SKELETON_CELL_KEYS = ['date', 'desc', 'bpname', 'contact', 'glitem', 'out', 'in', 'matched'];

// kind → (StatusTag tone, i18n key). Reusing the shared StatusTag keeps the
// look consistent with the statement-level status pills above and the rest of
// the app. "Manual" still maps to success because today (pre-T6/T7) the only
// signal we have is "linked / not linked" — we'll widen this when the engine
// distinguishes auto vs manual matches.
const MATCH_TONE = {
  auto:   { tone: 'success', labelKey: 'financeAccountStatementLinesStatusAuto' },
  manual: { tone: 'success', labelKey: 'financeAccountStatementLinesStatusManual' },
  none:   { tone: 'neutral', labelKey: 'financeAccountStatementLinesStatusUnmatched' },
};

function MatchPill({ kind, ui }) {
  const entry = MATCH_TONE[kind] ?? MATCH_TONE.none;
  return <StatusTag tone={entry.tone} label={ui(entry.labelKey)} />;
}

function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}

function formatMoney(amount, currency, bcpLocale) {
  try {
    return new Intl.NumberFormat(bcpLocale, {
      style: 'currency', currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

/**
 * "mini" variant of the lines table rendered inside an expanded accordion row
 * of {@link StatementsTable}. Layout matches the approved Option C handoff:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │ [list] Líneas del extracto (N)   [filter] [link] actions │
 *   ├───────────────────────────────────────────────────────────┤
 *   │ Nº · Fecha · Descripción · Contraparte · Salida · Entrada · Estado │
 *   ├───────────────────────────────────────────────────────────┤
 *   │ Mostrando N de N líneas.        Abrir extracto completo ↗ │
 *   └───────────────────────────────────────────────────────────┘
 *
 * Reconciliation actions ("Conciliar todas", per-line approve) are placeholders
 * until T6/T7 — the buttons render disabled with a coming-soon tooltip.
 */
export function StatementLinesInline({ statementId, currency = 'EUR' }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');
  const { lines, loading } = useBankStatementLines(statementId);

  return (
    <div className="mt-2 ml-10 mr-3 rounded-lg border border-[#E8EAEF] bg-white px-4 pt-3.5 pb-1">
      {/* Head */}
      <div className="mb-1.5 flex items-center border-b border-[#E8EAEF] pb-2.5">
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#121217]">
          <List className="h-3.5 w-3.5 text-[#6C6C89]" />
          {ui('financeAccountStatementsInlineTitle')}
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F5F7F9] px-1.5 text-[11px] font-medium text-[#6C6C89]">
            {lines.length}
          </span>
        </div>
      </div>

      {/* Column header — same style as the parent Statements table headers. */}
      <div
        className={cn(
          MINI_GRID,
          'h-10 items-center border-b border-[#E8EAEF] px-3 text-xs font-semibold leading-4 text-[#121217]',
        )}
      >
        <span>{ui('financeAccountStatementLinesColDate')}</span>
        <span>{ui('financeAccountStatementLinesColDescription')}</span>
        <span>{ui('financeAccountStatementLinesColBpartner')}</span>
        <span>{ui('financeAccountStatementLinesColContact')}</span>
        <span>{ui('financeAccountStatementLinesColGlItem')}</span>
        <span>{ui('financeAccountStatementLinesColDramount')}</span>
        <span>{ui('financeAccountStatementLinesColCramount')}</span>
        <span>{ui('financeAccountStatementLinesColMatched')}</span>
        <span aria-hidden="true" />
      </div>

      {/* Body */}
      {renderBody({ loading, lines, ui, currency, bcpLocale })}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body renderer extracted to avoid the nested ternary Sonar flagged on the
// previous loading / empty / rows branching.
// ─────────────────────────────────────────────────────────────────────────────
function renderBody({ loading, lines, ui, currency, bcpLocale }) {
  if (loading) {
    return [1, 2, 3].map((n) => (
      <div key={n} className={cn(MINI_GRID, 'border-b border-[#F0F2F5] px-3 py-2.5')}>
        {SKELETON_CELL_KEYS.map((k) => (
          <Skeleton key={k} className="h-4 w-full" />
        ))}
        <span aria-hidden="true" />
      </div>
    ));
  }
  if (lines.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-[#6C6C89]" role="row">
        {ui('financeAccountStatementLinesEmpty')}
      </div>
    );
  }
  return lines.map((line) => (
    <LineRow key={line.id} line={line} ui={ui} currency={currency} bcpLocale={bcpLocale} />
  ));
}

// Single row of the lines table — split out so we can render the amount
// columns with simple if/else branching instead of nested ternaries.
function LineRow({ line, ui, currency, bcpLocale }) {
  const amount = Number(line.amount) || 0;
  const isDebit = amount < 0;
  const out = isDebit ? -amount : 0;
  const inn = !isDebit && amount > 0 ? amount : 0;
  const matchKind = line.matched ? 'auto' : 'none';
  return (
    <div
      data-testid={`statement-line-row-${line.id}`}
      className={cn(
        MINI_GRID,
        'border-b border-[#F0F2F5] px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-[#FAFBFC]',
      )}
    >
      <span className="whitespace-nowrap text-[#121217]">{formatDate(line.date, bcpLocale)}</span>
      <span className="truncate font-medium text-[#121217]">{line.description || '—'}</span>
      <span className={cn('truncate', line.bpartnerName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.bpartnerName || ''}>
        {line.bpartnerName || '—'}
      </span>
      <span className={cn('truncate', line.bpartnerFkName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.bpartnerFkName || ''}>
        {line.bpartnerFkName || '—'}
      </span>
      <span className={cn('truncate', line.glItemName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.glItemName || ''}>
        {line.glItemName || '—'}
      </span>
      <span className="text-right tabular-nums">
        <AmountCell value={out} sign="−" toneClass="font-semibold text-red-700" currency={currency} bcpLocale={bcpLocale} />
      </span>
      <span className="text-right tabular-nums">
        <AmountCell value={inn} sign="+" toneClass="font-semibold text-green-700" currency={currency} bcpLocale={bcpLocale} />
      </span>
      <span><MatchPill kind={matchKind} ui={ui} /></span>
      <span aria-hidden="true" />
    </div>
  );
}

function AmountCell({ value, sign, toneClass, currency, bcpLocale }) {
  if (value > 0) {
    return <span className={toneClass}>{sign}{formatMoney(value, currency, bcpLocale)}</span>;
  }
  return <span className="text-[#C1C3CC]">—</span>;
}
