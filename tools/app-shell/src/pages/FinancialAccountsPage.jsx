import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useUI } from '@/i18n';
import { useFinancialAccounts } from '@/hooks/useFinancialAccounts.js';
import {
  AccountsSidebar,
  AccountsToolbar,
  AccountsTable,
} from '@/components/financial-accounts';
import { NewAccountWizard } from '@/windows/custom/financial-account/NewAccountWizard.jsx';
import { EditAccountModal } from '@/windows/custom/financial-account/EditAccountModal.jsx';
import { ArchiveAccountDialog } from '@/windows/custom/financial-account/ArchiveAccountDialog.jsx';

function filterAccounts(accounts, typeFilter, search) {
  if (!Array.isArray(accounts)) return [];
  const needle = (search ?? '').trim().toLowerCase();
  return accounts.filter((account) => {
    if (typeFilter && account.type !== typeFilter) return false;
    if (!needle) return true;
    return [account.name, account.iban, account.currencyIso]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(needle));
  });
}

export default function FinancialAccountsPage() {
  const ui = useUI();
  const navigate = useNavigate();
  const { accounts, summary, loading, error, reload } = useFinancialAccounts();
  const [typeFilter, setTypeFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);

  useSetPageMeta({
    title: ui('financeAccountsPageTitle'),
    breadcrumb: `${ui('financeMenuLabel')} / ${ui('financeAccountsPageTitle')}`,
    recordCount: accounts.length,
  }, [accounts.length]);

  const visibleAccounts = useMemo(
    () => filterAccounts(accounts, typeFilter, search),
    [accounts, typeFilter, search],
  );

  const handleOpenAccount = (account) => {
    navigate(`/financial-account/${account.id}`);
  };

  const handleReconcile = () => {
    toast(ui('financeAccountsReconcileToast'));
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-[#E8EAEF] p-2">
        <AccountsToolbar
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          search={search}
          onSearchChange={setSearch}
          onNewAccount={() => setWizardOpen(true)}
        />
      </div>

      <div
        className="flex flex-1 overflow-hidden"
        data-testid="cuentas-card"
      >
        <AccountsSidebar summary={summary} loading={loading} />

        <div className="w-px self-stretch bg-[#E8EAEF]" aria-hidden="true" />

        <div className="flex flex-1 flex-col overflow-hidden">
          <AccountsTable
            accounts={visibleAccounts}
            loading={loading}
            error={error}
            onOpen={handleOpenAccount}
            onReconcile={handleReconcile}
            onEdit={setEditAccount}
            onArchive={setArchiveTarget}
            onRetry={reload}
          />
        </div>
      </div>

      <NewAccountWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={reload}
      />
      <EditAccountModal
        open={!!editAccount}
        account={editAccount}
        onClose={() => setEditAccount(null)}
        onSaved={reload}
      />
      <ArchiveAccountDialog
        open={!!archiveTarget}
        account={archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onArchived={reload}
      />
    </div>
  );
}
