import { useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { SyncStatusInline } from '@/components/financial-accounts/SyncStatusInline';
import { AccountRowMenu } from '@/components/financial-accounts/AccountRowMenu';

/**
 * Page header for the financial account detail view.
 * Sets the global breadcrumb/title via useSetPageMeta (topbar only).
 * Renders sync status and the account kebab menu.
 *
 * @param {{ account: object|null }} props
 */
export function AccountDetailHeader({ account }) {
  const ui = useUI();
  const accountName = account?.name ?? '';

  useSetPageMeta(
    {
      title: accountName,
      breadcrumb: `${ui('financeMenuLabel')} / ${ui('financeAccountsPageTitle')} / ${accountName}`,
    },
    [accountName],
  );

  if (!account) return null;

  return (
    <div className="flex items-center gap-3 border-b border-[#E8EAEF] px-4 py-2">
      <SyncStatusInline account={account} />
      <div className="ml-auto">
        <AccountRowMenu account={account} onOpen={null} />
      </div>
    </div>
  );
}
