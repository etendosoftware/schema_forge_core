import { useUI, useLocaleSwitch } from '@/i18n';
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

function formatDate(isoString, bcpLocale) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(bcpLocale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

const SKELETON_ROWS = [1, 2, 3, 4, 5];
const SKELETON_COL_KEYS = ['lineno', 'date', 'description', 'reference', 'bpartner', 'amount', 'matched'];

function renderBody({ loading, lines, emptyLabel, renderRow }) {
  if (loading) {
    return SKELETON_ROWS.map((n) => (
      <TableRow key={n}>
        {SKELETON_COL_KEYS.map((k) => (
          <TableCell key={k}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  if (lines.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="py-16 text-center text-sm text-[#6c6c89]">
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }
  return lines.map(renderRow);
}

/**
 * @param {{ lines: Array<object>; loading: boolean; currency?: string }} props
 */
export function StatementLinesTable({ lines, loading, currency = 'EUR' }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-[#121217]">
          <TableHead>{ui('financeAccountStatementLinesColLineNo')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColDate')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColDescription')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColReference')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColBpartner')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColAmount')}</TableHead>
          <TableHead>{ui('financeAccountStatementLinesColMatched')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {renderBody({
          loading,
          lines,
          emptyLabel: ui('financeAccountStatementLinesEmpty'),
          renderRow: (line) => (
            <TableRow
              key={line.id}
              data-testid={`statement-line-row-${line.id}`}
              className="bg-white"
            >
              <TableCell className="text-sm text-[#6c6c89]">{line.lineNo}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-[#121217]">
                {formatDate(line.date, bcpLocale)}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-sm text-[#121217]">
                {line.description || '—'}
              </TableCell>
              <TableCell className="text-sm text-[#121217]">{line.reference || '—'}</TableCell>
              <TableCell className="text-sm text-[#121217]">{line.bpartnerName || '—'}</TableCell>
              <TableCell className="text-right">
                <MoneyAmount
                  value={line.amount}
                  currency={currency}
                  tone="auto"
                  className="text-sm font-semibold"
                />
              </TableCell>
              <TableCell>
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: line.matched ? '#26A95F' : '#D1D4DB' }}
                  aria-label={line.matched ? ui('financeAccountStatementLinesMatchedYes') : ui('financeAccountStatementLinesMatchedNo')}
                />
              </TableCell>
            </TableRow>
          ),
        })}
      </TableBody>
    </Table>
  );
}
