import { ArrowLeftRight, Scale, FileText } from 'lucide-react';
import { useUI } from '@/i18n';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Tab strip for the financial account detail view.
 * TabsContent is rendered by the parent — this component only handles the triggers.
 *
 * @param {{
 *   value: string;
 *   onValueChange: (v: string) => void;
 *   movementsCount: number;
 *   reconciliationCount: number;
 *   statementsCount: number;
 * }} props
 */
export function DetailTabs({ value, onValueChange, movementsCount, reconciliationCount, statementsCount }) {
  const ui = useUI();

  return (
    <Tabs value={value} onValueChange={onValueChange} className="flex-row">
      <TabsList>
        <TabsTrigger value="movements" icon={ArrowLeftRight} badge={movementsCount}>
          {ui('financeAccountDetailTabMovements')}
        </TabsTrigger>
        <TabsTrigger value="reconciliation" icon={Scale} badge={reconciliationCount}>
          {ui('financeAccountDetailTabReconciliation')}
        </TabsTrigger>
        <TabsTrigger value="statements" icon={FileText}>
          {ui('financeAccountDetailTabStatements')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
