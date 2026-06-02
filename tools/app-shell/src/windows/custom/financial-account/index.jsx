import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUI } from '@/i18n';
import { useSetPageMeta } from '@/components/layout/PageMetaContext';
import { useFinancialAccount } from '@/hooks/useFinancialAccount';
import { useAccountMovements } from '@/hooks/useAccountMovements';
import { useBankStatements } from '@/hooks/useBankStatements';
import { DetailTabs } from './DetailTabs';
import { MovementsTab } from './MovementsTab';
import { ReconciliationTab } from './ReconciliationTab';
import { ImportedStatementsTab } from './ImportedStatementsTab';
import { downloadMovementsCsv } from './movementsCsvExport';

/**
 * Financial Account detail view.
 * Rendered by WindowLoader when navigating to /financial-account/{recordId}.
 *
 * @param {{ recordId: string }} props
 */
export default function FinancialAccountWindow({ recordId }) {
  const ui = useUI();
  const [activeTab, setActiveTab] = useState('movements');
  const { account } = useFinancialAccount(recordId);
  const { movements, totals, enabledDimensions, loading: movementsLoading, reload: reloadMovements } = useAccountMovements(recordId);
  const { statements } = useBankStatements(recordId);
  const movementsTabRef = useRef(null);

  const handleExport = () => {
    if (activeTab !== 'movements') {
      toast(ui('financeAccountDetailExportToast'));
      return;
    }
    const rows = movementsTabRef.current?.getFilteredMovements() ?? movements;
    if (!rows || rows.length === 0) {
      toast.error(ui('financeAccountDetailExportEmpty'));
      return;
    }
    const safeName = (account?.name ?? 'movements').replace(/[^\w.-]+/g, '_');
    downloadMovementsCsv(rows, `${safeName}_movements`);
    toast.success(ui('financeAccountDetailExportDone'));
  };

  const accountName = account?.name ?? '';
  useSetPageMeta(
    {
      title: accountName,
      breadcrumb: `${ui('financeMenuLabel')} / ${ui('financeAccountsPageTitle')} / ${accountName}`,
    },
    [accountName],
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">

        {/* Tab strip + Export button */}
        <div className="flex items-center justify-between border-b border-[#E8EAEF] pl-0 pr-2">
          <DetailTabs
            value={activeTab}
            onValueChange={setActiveTab}
            movementsCount={movements.length}
            reconciliationCount={account?.pendingCount ?? 0}
            statementsCount={statements.length}
          />
          <button
            type="button"
            data-testid="financial-account-export"
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#D1D4DB] bg-white px-3 text-sm font-medium leading-6 text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
          >
            <Upload className="h-6 w-6 text-[#828FA3]" />
            <span className="px-1">{ui('financeAccountDetailExport')}</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="flex flex-1 flex-col overflow-auto">
          {activeTab === 'movements' && (
            <MovementsTab
              ref={movementsTabRef}
              account={account}
              totals={totals}
              movements={movements}
              enabledDimensions={enabledDimensions}
              loading={movementsLoading}
              onReload={reloadMovements}
            />
          )}
          {activeTab === 'reconciliation' && <ReconciliationTab />}
          {activeTab === 'statements' && <ImportedStatementsTab account={account} />}
        </div>
      </div>
    </TooltipProvider>
  );
}
