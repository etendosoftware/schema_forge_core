import { List } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusTag } from '@/components/ui/status-tag';
import { cn } from '@/lib/utils';
import { useBankStatementLines } from '@/hooks/useBankStatementLines';

// Grid for the `mini` variant of the lines table.
//   100        · date (fixed)
//   minmax(220, 1fr) · description (capped at 1fr so it doesn't dominate)
//   minmax(140, 1fr) · contact      (capped at 1fr — same fraction)
//   120        · withdrawal (out)
//   120        · deposit (in)
//   110        · status pill
//   minmax(0, 1fr)  · trailing flexible spacer — absorbs leftover width on
//                    wide viewports so the data columns stay close to each other.
const MINI_GRID =
  'grid grid-cols-[100px_minmax(220px,1fr)_minmax(140px,1fr)_120px_120px_110px_minmax(0,1fr)] gap-3';

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
        <span>{ui('financeAccountStatementLinesColDramount')}</span>
        <span>{ui('financeAccountStatementLinesColCramount')}</span>
        <span>{ui('financeAccountStatementLinesColMatched')}</span>
        <span aria-hidden="true" />
      </div>

      {/* Body */}
      {loading ? (
        [1, 2, 3].map((n) => (
          <div key={n} className={cn(MINI_GRID, 'border-b border-[#F0F2F5] px-3 py-2.5')}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
            <span aria-hidden="true" />
          </div>
        ))
      ) : lines.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-[#6C6C89]" role="row">
          {ui('financeAccountStatementLinesEmpty')}
        </div>
      ) : (
        lines.map((line) => {
          const amount = Number(line.amount) || 0;
          const isDebit = amount < 0;
          const out = isDebit ? -amount : 0;
          const inn = !isDebit && amount > 0 ? amount : 0;
          const matchKind = line.matched ? 'auto' : 'none';
          return (
            <div
              key={line.id}
              data-testid={`statement-line-row-${line.id}`}
              className={cn(
                MINI_GRID,
                'border-b border-[#F0F2F5] px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-[#FAFBFC]',
              )}
            >
              <span className="whitespace-nowrap text-[#121217]">{formatDate(line.date, bcpLocale)}</span>
              <span className="truncate font-medium text-[#121217]">{line.description || '—'}</span>
              <span className="truncate text-[#3F3F50]">{line.bpartnerName || ''}</span>
              <span className="text-right tabular-nums">
                {out > 0
                  ? <span className="font-semibold text-red-700">−{formatMoney(out, currency, bcpLocale)}</span>
                  : <span className="text-[#C1C3CC]">—</span>}
              </span>
              <span className="text-right tabular-nums">
                {inn > 0
                  ? <span className="font-semibold text-green-700">+{formatMoney(inn, currency, bcpLocale)}</span>
                  : <span className="text-[#C1C3CC]">—</span>}
              </span>
              <span><MatchPill kind={matchKind} ui={ui} /></span>
              <span aria-hidden="true" />
            </div>
          );
        })
      )}

    </div>
  );
}
