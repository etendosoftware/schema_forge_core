import { ChevronRight } from 'lucide-react';
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
const SKELETON_COL_KEYS = ['docno', 'name', 'importdate', 'txdate', 'filename', 'chevron'];

function renderBody({ loading, statements, emptyLabel, renderRow }) {
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
  if (statements.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={6} className="py-16 text-center text-sm text-[#6c6c89]">
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }
  return statements.map(renderRow);
}

/**
 * Table of imported bank statements.
 * Columns mirror the Classic "Imported Bank Statements" tab:
 * Document No. | Document Type | Name | Import Date | Transaction Date | File Name
 *
 * @param {{
 *   statements: Array<object>;
 *   loading: boolean;
 *   onOpenStatement: (id: string) => void;
 * }} props
 */
export function StatementsTable({ statements, loading, onOpenStatement }) {
  const ui = useUI();
  const { locale: appLocale } = useLocaleSwitch();
  const bcpLocale = (appLocale || 'es_ES').replace('_', '-');

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-10 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-[#121217]">
          <TableHead>{ui('financeAccountStatementsColDocumentNo')}</TableHead>
          <TableHead>{ui('financeAccountStatementsColName')}</TableHead>
          <TableHead>{ui('financeAccountStatementsColImportDate')}</TableHead>
          <TableHead>{ui('financeAccountStatementsColTransactionDate')}</TableHead>
          <TableHead>{ui('financeAccountStatementsColFileName')}</TableHead>
          <TableHead className="w-10" aria-hidden="true" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {renderBody({
          loading,
          statements,
          emptyLabel: ui('financeAccountStatementsEmpty'),
          renderRow: (s) => (
            <TableRow
              key={s.id}
              data-testid={`statement-row-${s.id}`}
              className="cursor-pointer bg-white transition-shadow hover:z-10 hover:bg-white hover:shadow-lg"
              onClick={() => onOpenStatement(s.id)}
            >
              <TableCell className="text-sm font-semibold text-[#121217]">
                {s.documentNo || '—'}
              </TableCell>
              <TableCell className="max-w-[240px] truncate text-sm text-[#121217]">
                {s.name || '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-[#6c6c89]">
                {formatDate(s.importDate, bcpLocale)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-[#6c6c89]">
                {formatDate(s.transactionDate, bcpLocale)}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-sm text-[#6c6c89]">
                {s.fileName || '—'}
              </TableCell>
              <TableCell className="w-10 pr-4 text-right text-[#6c6c89]">
                <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
              </TableCell>
            </TableRow>
          ),
        })}
      </TableBody>
    </Table>
  );
}
