import { FileText } from 'lucide-react';
import { useUI } from '@/i18n';

export function ImportedStatementsTab() {
  const ui = useUI();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
      <FileText className="h-10 w-10 text-[#D1D4DB]" />
      <p className="text-sm text-[#6c6c89]">{ui('financeAccountDetailTabStatementsComingSoon')}</p>
    </div>
  );
}
