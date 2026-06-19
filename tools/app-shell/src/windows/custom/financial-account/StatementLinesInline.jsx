import { Fragment, useState } from 'react';
import { Link2, Layers } from 'lucide-react';
import { useUI, useLocaleSwitch } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusTag } from '@/components/ui/status-tag';
import { cn } from '@/lib/utils';
import { useBankStatementLines } from '@/hooks/useBankStatementLines';
import { ReconciledTxnsModal } from './ReconciledTxnsModal';
import { getContractGridColumns } from '@/components/financial-accounts/contractColumns';

// Layout for the `mini` variant of the lines table. The DATA columns come from
// the window contract (entity `bankStatementLines`); the synthetic tail (match
// pill, transaction chip, flexible spacer) stays fixed. Grid template built
// dynamically and applied inline (Tailwind can't JIT a dynamic class).
//   <contract columns> · 100 status pill · 120 txn chip
// No trailing spacer: the description column (2fr) absorbs the leftover width.
const MINI_GRID_CLASS = 'grid gap-3';
const MINI_TAIL_TRACKS = '100px 120px';

// Contract field name → width + i18n header + cell renderer. Amount OUT/IN are
// derived from the signed `line.amount`, so dramount/cramount render the split.
const LINE_CELL_RENDERERS = {
  transactionDate: {
    width: '100px',
    labelKey: 'financeAccountStatementLinesColDate',
    render: (line, ctx) => <span className="whitespace-nowrap text-[#121217]">{formatDate(line.date, ctx.bcpLocale)}</span>,
  },
  description: {
    width: 'minmax(220px,2fr)',
    labelKey: 'financeAccountStatementLinesColDescription',
    render: (line) => (
      <span className={cn('truncate', line.description ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.description || ''}>
        {line.description || '—'}
      </span>
    ),
  },
  bpartnername: {
    width: 'minmax(140px,1fr)',
    labelKey: 'financeAccountStatementLinesColBpartner',
    render: (line) => (
      <span className={cn('truncate', line.bpartnerName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.bpartnerName || ''}>
        {line.bpartnerName || '—'}
      </span>
    ),
  },
  businessPartner: {
    width: 'minmax(140px,1fr)',
    labelKey: 'financeAccountStatementLinesColContact',
    render: (line) => (
      <span className={cn('truncate', line.bpartnerFkName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.bpartnerFkName || ''}>
        {line.bpartnerFkName || '—'}
      </span>
    ),
  },
  gLItem: {
    width: 'minmax(140px,1fr)',
    labelKey: 'financeAccountStatementLinesColGlItem',
    render: (line) => (
      <span className={cn('truncate', line.glItemName ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.glItemName || ''}>
        {line.glItemName || '—'}
      </span>
    ),
  },
  referenceNo: {
    width: 'minmax(120px,1fr)',
    labelKey: 'financeAccountStatementLinesColReference',
    render: (line) => (
      <span className={cn('truncate', line.reference ? 'text-[#3F3F50]' : 'text-[#C1C3CC]')} title={line.reference || ''}>
        {line.reference || '—'}
      </span>
    ),
  },
  dramount: {
    width: '110px',
    labelKey: 'financeAccountStatementLinesColDramount',
    render: (line, ctx) => {
      const amount = Number(line.amount) || 0;
      const out = amount < 0 ? -amount : 0;
      return (
        <span className="text-right tabular-nums">
          <AmountCell value={out} sign="−" toneClass="font-semibold text-red-700" currency={ctx.currency} bcpLocale={ctx.bcpLocale} />
        </span>
      );
    },
  },
  cramount: {
    width: '110px',
    labelKey: 'financeAccountStatementLinesColCramount',
    render: (line, ctx) => {
      const amount = Number(line.amount) || 0;
      const inn = amount > 0 ? amount : 0;
      return (
        <span className="text-right tabular-nums">
          <AmountCell value={inn} sign="+" toneClass="font-semibold text-green-700" currency={ctx.currency} bcpLocale={ctx.bcpLocale} />
        </span>
      );
    },
  },
};

const LINE_COLUMNS = getContractGridColumns('bankStatementLines');

const MINI_GRID_TEMPLATE = [
  ...LINE_COLUMNS.map((c) => LINE_CELL_RENDERERS[c.name]?.width ?? 'minmax(140px,1fr)'),
  MINI_TAIL_TRACKS,
].join(' ');
const MINI_GRID_STYLE = { gridTemplateColumns: MINI_GRID_TEMPLATE };

// Stable keys for the skeleton cells (contract columns + match + txn).
const SKELETON_CELL_KEYS = [...LINE_COLUMNS.map((c) => `c_${c.name}`), 'matched', 'txns'];

// kind → (StatusTag tone, i18n key). Reusing the shared StatusTag keeps the
// look consistent with the statement-level status pills above and the rest of
// the app. "Manual" still maps to success because today (pre-T6/T7) the only
// signal we have is "linked / not linked" — we'll widen this when the engine
// distinguishes auto vs manual matches.
const MATCH_TONE = {
  auto:   { tone: 'success', labelKey: 'financeAccountStatementLinesStatusAuto' },
  manual: { tone: 'success', labelKey: 'financeAccountStatementLinesStatusManual' },
  none:   { tone: 'info', labelKey: 'financeAccountStatementLinesStatusUnmatched' },
};

function MatchPill({ kind, ui }) {
  const entry = MATCH_TONE[kind] ?? MATCH_TONE.none;
  return <StatusTag tone={entry.tone} label={ui(entry.labelKey)} />;
}

// "Transacción" cell: shows the reconciled movement(s) of the line. None → "—";
// exactly one → a chip with its payment number; several → a "N transacciones"
// chip. Any chip opens the ReconciledTxnsModal. Built array-first so a future
// 1:N reconciliation needs no UI change.
function TxnChip({ line, ui, onOpen }) {
  const txns = line.txns || [];
  if (txns.length === 0) {
    return <span className="text-[#C1C3CC]">—</span>;
  }
  const multi = txns.length > 1;
  return (
    <button
      type="button"
      data-testid={`statement-line-txn-${line.id}`}
      onClick={() => onOpen(line)}
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
        multi
          ? 'border-[#E8EAEF] bg-[#F5F7F9] font-semibold text-[#121217] hover:bg-[#EBEEF2]'
          : 'border-[#E8EAEF] bg-white text-[#3F3F50] hover:bg-[#F5F7F9] hover:text-[#121217]',
      )}
    >
      {multi ? <Layers className="h-3 w-3 flex-none text-[#6C6C89]" /> : <Link2 className="h-3 w-3 flex-none text-[#6C6C89]" />}
      <span className="truncate">
        {multi ? ui('financeAccountStatementLinesTxnChipMulti', { count: txns.length }) : txns[0].documentNo}
      </span>
    </button>
  );
}

function formatDate(iso, bcpLocale) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // Date-only value sent as UTC midnight — format in UTC so a negative-offset
  // timezone doesn't shift it to the previous day.
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
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
  const [txnLine, setTxnLine] = useState(null);

  return (
    <div className="ml-10 mr-3 rounded-lg border border-[#E8EAEF] bg-white px-4 pb-1">
      {/* Column header — same style as the parent Statements table headers. */}
      <div
        style={MINI_GRID_STYLE}
        className={cn(
          // Same recipe as the parent Statements table header (h-10 items-center) — centered.
          MINI_GRID_CLASS,
          'h-10 items-center border-b border-[#E8EAEF] px-3 text-xs font-semibold leading-4 text-[#121217]',
        )}
      >
        {LINE_COLUMNS.map((col) => (
          <span key={col.name} className="truncate">
            {LINE_CELL_RENDERERS[col.name] ? ui(LINE_CELL_RENDERERS[col.name].labelKey) : col.label}
          </span>
        ))}
        <span className="truncate">{ui('financeAccountStatementLinesColMatched')}</span>
        <span className="truncate">{ui('financeAccountStatementLinesColTransaction')}</span>
      </div>

      {/* Body */}
      {renderBody({ loading, lines, ui, currency, bcpLocale, onOpenTxns: setTxnLine })}

      {txnLine ? (
        <ReconciledTxnsModal line={txnLine} currency={currency} onClose={() => setTxnLine(null)} />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Body renderer extracted to avoid the nested ternary Sonar flagged on the
// previous loading / empty / rows branching.
// ─────────────────────────────────────────────────────────────────────────────
function renderBody({ loading, lines, ui, currency, bcpLocale, onOpenTxns }) {
  if (loading) {
    return [1, 2, 3].map((n) => (
      <div key={n} style={MINI_GRID_STYLE} className={cn(MINI_GRID_CLASS, 'items-center border-b border-[#F0F2F5] px-3 py-2.5')}>
        {SKELETON_CELL_KEYS.map((k) => (
          <Skeleton key={k} className="h-4 w-full" />
        ))}
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
    <LineRow key={line.id} line={line} ui={ui} currency={currency} bcpLocale={bcpLocale} onOpenTxns={onOpenTxns} />
  ));
}

// Single row of the lines table — split out so we can render the amount
// columns with simple if/else branching instead of nested ternaries.
function LineRow({ line, ui, currency, bcpLocale, onOpenTxns }) {
  const matchKind = line.matched ? 'auto' : 'none';
  const cellCtx = { ui, currency, bcpLocale };
  return (
    <div
      data-testid={`statement-line-row-${line.id}`}
      style={MINI_GRID_STYLE}
      className={cn(
        MINI_GRID_CLASS,
        'items-center border-b border-[#F0F2F5] px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-[#FAFBFC]',
      )}
    >
      {/* Contract-driven data columns (decisions.json → contract.json) */}
      {LINE_COLUMNS.map((col) => {
        const renderer = LINE_CELL_RENDERERS[col.name];
        return (
          <Fragment key={col.name}>
            {renderer
              ? renderer.render(line, cellCtx)
              : <span className="truncate text-[#3F3F50]">{line[col.name] ?? '—'}</span>}
          </Fragment>
        );
      })}
      <span><MatchPill kind={matchKind} ui={ui} /></span>
      <span className="min-w-0"><TxnChip line={line} ui={ui} onOpen={onOpenTxns} /></span>
    </div>
  );
}

function AmountCell({ value, sign, toneClass, currency, bcpLocale }) {
  if (value > 0) {
    return <span className={toneClass}>{sign}{formatMoney(value, currency, bcpLocale)}</span>;
  }
  return <span className="text-[#C1C3CC]">—</span>;
}
