import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUI } from '@/i18n';
import { useFinancialAccount } from '@/hooks/useFinancialAccount';
import { useAccountMovements } from '@/hooks/useAccountMovements';
import { AccountDetailHeader } from './AccountDetailHeader';
import { DetailTabs } from './DetailTabs';
import { MovimientosTab } from './MovimientosTab';
import { ReconciliacionTab } from './ReconciliacionTab';
import { ExtractosImportadosTab } from './ExtractosImportadosTab';

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
  const { movements, loading: movementsLoading } = useAccountMovements(recordId);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Page header */}
        <AccountDetailHeader account={account} />

        {/* Tab strip + Export button */}
        <div className="flex items-center justify-between border-b border-[#E8EAEF] px-4">
          <DetailTabs
            value={activeTab}
            onValueChange={setActiveTab}
            movementsCount={movements.length}
            reconciliationCount={account?.pendingCount ?? 0}
            statementsCount={0}
          />
          <button
            type="button"
            onClick={() => toast(ui('financeAccountDetailExportToast'))}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D1D4DB] bg-white px-3 py-2 text-sm font-medium text-[#121217] shadow-[0_1px_2px_rgba(18,18,23,0.05)] hover:bg-[#F5F7F9]"
          >
            <Upload className="h-4 w-4" />
            {ui('financeAccountDetailExport')}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex flex-1 flex-col overflow-auto">
          {activeTab === 'movements' && (
            <MovimientosTab movements={movements} loading={movementsLoading} />
          )}
          {activeTab === 'reconciliation' && <ReconciliacionTab />}
          {activeTab === 'statements' && <ExtractosImportadosTab />}
        </div>
      </div>
    </TooltipProvider>
  );
}
