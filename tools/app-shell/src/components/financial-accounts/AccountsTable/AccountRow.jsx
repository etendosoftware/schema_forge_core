import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useUI } from '@/i18n';
import { ReconcilePill } from '../ReconcilePill.jsx';
import { AccountRowMenu } from '../AccountRowMenu.jsx';
import { ACCOUNT_COLUMNS, ACCOUNT_CELL_RENDERERS } from './accountColumns.jsx';

export function AccountRow({ account, onOpen, onReconcile, onEdit, onArchive, onPsd2Action }) {
  const ui = useUI();
  const cellCtx = { ui };

  return (
    <TableRow
      data-testid={`account-row-${account.id}`}
      className="group relative h-16 cursor-pointer bg-white transition-shadow hover:z-10 hover:bg-white hover:shadow-lg"
      onClick={() => onOpen?.(account)}
    >
      {/* Contract-driven data columns (decisions.json → contract.json) */}
      {ACCOUNT_COLUMNS.map((col) => {
        const renderer = ACCOUNT_CELL_RENDERERS[col.name];
        return (
          <Fragment key={col.name} data-testid="Fragment__90174f">
            {renderer
              ? renderer.renderCell(account, cellCtx)
              : <TableCell className="px-2 text-sm text-[#121217]" data-testid="TableCell__90174f">{account[col.name] ?? '—'}</TableCell>}
          </Fragment>
        );
      })}
      <TableCell className="w-[280px] px-2" data-testid="TableCell__90174f">
        <span
          onClick={(e) => e.stopPropagation()}
          role="presentation"
          className="inline-flex"
        >
          <ReconcilePill
            pendingCount={account.pendingCount}
            onClick={() => onReconcile?.(account)}
            data-testid="ReconcilePill__90174f" />
        </span>
      </TableCell>
      <TableCell
        className="min-w-[90px] px-2"
        onClick={(e) => e.stopPropagation()}
        data-testid="TableCell__90174f">
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label={ui('financeAccountsRowRefresh')}
            data-testid={`account-row-refresh-${account.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] hover:bg-[#E8EAEF]"
          >
            <RefreshCw className="h-5 w-5" data-testid="RefreshCw__90174f" />
          </button>
          <AccountRowMenu
            account={account}
            onOpen={onOpen}
            onEdit={onEdit}
            onArchive={onArchive}
            onPsd2Action={onPsd2Action}
            data-testid="AccountRowMenu__90174f" />
        </div>
      </TableCell>
    </TableRow>
  );
}
