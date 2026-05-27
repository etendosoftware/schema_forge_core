import { GripVertical, Copy, RefreshCw } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { useUI } from '@/i18n';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatCurrency.js';
import { ACCOUNT_TYPE } from '../tokens';
import { AccountLogoAvatar } from '../AccountLogoAvatar.jsx';
import { SyncStatusInline } from '../SyncStatusInline.jsx';
import { ReconcilePill } from '../ReconcilePill.jsx';
import { AccountRowMenu } from '../AccountRowMenu.jsx';

const TYPE_LABEL_KEY = {
  [ACCOUNT_TYPE.BANK]: 'financeAccountsTypeBank',
  [ACCOUNT_TYPE.CASH]: 'financeAccountsTypeCash',
  [ACCOUNT_TYPE.CARD]: 'financeAccountsTypeCard',
};

function chunkIban(iban) {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

export function AccountRow({ account, onOpen, onReconcile }) {
  const ui = useUI();
  const isNegative = Number(account.currentBalance) < 0;
  const typeLabel = ui(TYPE_LABEL_KEY[account.type] ?? 'financeAccountsTypeBank');
  const isCashLike = account.type === ACCOUNT_TYPE.CASH;
  // In T1 the PSD2 column is not yet populated, so anything not explicitly
  // `psd2Connected === true` is treated as offline for bank/card rows.
  const isDisconnected = !isCashLike && account.psd2Connected !== true;

  const copyIban = (e) => {
    e.stopPropagation();
    if (account.iban && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(account.iban);
    }
  };

  return (
    <TableRow
      data-testid={`account-row-${account.id}`}
      className="group relative h-16 cursor-pointer bg-white transition-shadow hover:z-10 hover:bg-white hover:shadow-lg"
      onClick={() => onOpen?.(account)}
    >
      <TableCell className="w-[336px] p-0">
        <div className="flex h-full items-center">
          <div className="flex w-[44px] shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <GripVertical className="h-5 w-5 text-[#828FA3]" aria-hidden="true" />
          </div>
          <AccountLogoAvatar account={account} />
          <div className="flex flex-1 flex-col justify-center gap-1 px-2 py-2">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold leading-5 text-[#121217]">
                {account.name}
              </span>
              {isDisconnected ? (
                <span className="inline-flex h-6 items-center rounded-full bg-[#F5F7F9] px-2 py-1 text-xs font-normal leading-4 text-[#3F3F50]">
                  {ui('financeAccountsBadgeOffline')}
                </span>
              ) : null}
            </div>
            <SyncStatusInline account={account} />
          </div>
        </div>
      </TableCell>

      <TableCell className="w-[340px] px-2 py-2">
        <div className="flex flex-col justify-center">
          <span className="text-sm font-normal leading-5 text-[#121217]">{typeLabel}</span>
          {account.iban ? (
            <span className="inline-flex items-center gap-1 text-xs leading-4 text-[#6C6C89]">
              {chunkIban(account.iban)}
              <button
                type="button"
                onClick={copyIban}
                aria-label={ui('financeAccountsCopyIban')}
                data-testid={`account-row-copy-iban-${account.id}`}
                className="rounded-full p-0.5 text-[#828FA3] opacity-0 transition-opacity hover:bg-[#E8EAEF] group-hover:opacity-100"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span className="text-xs leading-4 text-[#6C6C89]">—</span>
          )}
        </div>
      </TableCell>

      <TableCell className="w-[200px] px-2 text-right">
        <span
          className={cn(
            'text-sm font-semibold leading-5 tabular-nums',
            isNegative ? 'text-[#D50B3E]' : 'text-[#121217]',
          )}
        >
          {formatCurrency(account.currencyIso, account.currentBalance)}
        </span>
      </TableCell>

      <TableCell className="w-[280px] px-2">
        <span
          onClick={(e) => e.stopPropagation()}
          role="presentation"
          className="inline-flex"
        >
          <ReconcilePill
            pendingCount={account.pendingCount}
            onClick={() => onReconcile?.(account)}
          />
        </span>
      </TableCell>

      <TableCell
        className="min-w-[90px] px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label={ui('financeAccountsRowRefresh')}
            data-testid={`account-row-refresh-${account.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#828FA3] hover:bg-[#E8EAEF]"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <AccountRowMenu account={account} onOpen={onOpen} />
        </div>
      </TableCell>
    </TableRow>
  );
}
