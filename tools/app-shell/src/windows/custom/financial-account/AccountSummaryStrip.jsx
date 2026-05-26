import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import { AccountLogoAvatar } from '@/components/financial-accounts/AccountLogoAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MoneyAmount } from '@/components/ui/money-amount';

/**
 * Horizontal strip shown under the page header.
 * Displays IBAN with copy button + three KPI figures (balance, inflows, outflows).
 *
 * @param {{ account: object|null, totals: { balance: number, inflows: number, outflows: number, currency: string }, loading: boolean }} props
 */
export function AccountSummaryStrip({ account, totals, loading }) {
  const ui = useUI();

  const handleCopyIban = () => {
    if (account?.iban) {
      navigator.clipboard.writeText(account.iban).then(() => {
        toast(account.iban);
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-6 border-b border-[#E8EAEF] px-4 py-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <div className="ml-auto flex gap-8">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-[#E8EAEF] px-4 py-3 md:flex-nowrap">
      {/* Avatar + IBAN */}
      <div className="flex items-center gap-3">
        <AccountLogoAvatar account={account} className="h-10 w-10" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[#6c6c89]">IBAN</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[#3f3f50]">
              {account?.iban ?? '—'}
            </span>
            {account?.iban ? (
              <button
                type="button"
                onClick={handleCopyIban}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[#6c6c89] hover:bg-[#F5F7F9] hover:text-[#3f3f50]"
                aria-label="Copy IBAN"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* KPIs */}
      <div className="flex items-center gap-8">
        {/* Balance */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-[#6c6c89]">{ui('financeAccountDetailKpiBalance')}</span>
          <span className="text-xl font-semibold text-[#121217]">
            <MoneyAmount value={totals.balance} currency={totals.currency} tone="neutral" />
          </span>
        </div>

        {/* Inflows */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-[#26a95f]">{ui('financeAccountDetailKpiInflows')}</span>
          <span className="text-xl font-semibold">
            <MoneyAmount value={totals.inflows} currency={totals.currency} tone="positive" />
          </span>
        </div>

        {/* Outflows */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-[#d50b3e]">{ui('financeAccountDetailKpiOutflows')}</span>
          <span className="text-xl font-semibold">
            <MoneyAmount value={totals.outflows} currency={totals.currency} tone="negative" />
          </span>
        </div>
      </div>
    </div>
  );
}
