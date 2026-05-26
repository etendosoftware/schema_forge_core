import { useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { SyncStatusInline } from '@/components/financial-accounts/SyncStatusInline';
import { AccountRowMenu } from '@/components/financial-accounts/AccountRowMenu';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Page header for the financial account detail view.
 * Sets the global breadcrumb via useSetPageMeta and renders the account name,
 * sync indicator, and the account kebab menu.
 *
 * @param {{ account: object|null, loading: boolean }} props
 */
export function AccountDetailHeader({ account, loading }) {
  const ui = useUI();
  const accountName = account?.name ?? '';

  useSetPageMeta(
    {
      title: accountName,
      breadcrumb: `${ui('financeMenuLabel')} / ${ui('financeAccountsPageTitle')} / ${accountName}`,
    },
    [accountName],
  );

  return (
    <div className="flex flex-col gap-0.5 border-b border-[#E8EAEF] px-4 py-3">
      {/* Breadcrumb */}
      <span className="text-xs text-[#6c6c89]">
        {ui('financeMenuLabel')}
        {' / '}
        {ui('financeAccountsPageTitle')}
        {accountName ? ` / ${accountName}` : ''}
      </span>

      {/* Title row */}
      <div className="flex items-center gap-3">
        {loading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <h1 className="text-2xl font-semibold text-[#121217]">{accountName}</h1>
        )}

        {account ? (
          <>
            <SyncStatusInline account={account} />
            <div className="ml-auto">
              <AccountRowMenu account={account} onOpen={null} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
