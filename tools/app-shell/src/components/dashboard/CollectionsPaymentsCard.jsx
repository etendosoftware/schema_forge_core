import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { createDashboardNavigation, resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

export function CollectionsPaymentsCard({ pendingAmounts = {}, currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

  const { toCollect = { count: 0, amount: 0 }, toPay = { count: 0, amount: 0 } } = pendingAmounts;

  const toCollectTarget = resolveDashboardNavigation(
    toCollect.navigation ?? createDashboardNavigation({ type: 'list', window: 'sales-invoice', filter: 'overdue' })
  ) || '/sales-invoice?filter=overdue';

  const toPayTarget = resolveDashboardNavigation(
    toPay.navigation ?? createDashboardNavigation({ type: 'list', window: 'purchase-invoice', filter: 'overdue' })
  ) || '/purchase-invoice?filter=overdue';

  return (
    <div className="rounded-xl border overflow-hidden bg-white flex flex-col h-full" style={{ borderColor: '#E8EAEF' }}>
      <div
        className="flex items-center border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', minHeight: '48px' }}
      >
        <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
          {ui('collectionsPaymentsTitle')}
        </span>
      </div>
      <div className="p-4 space-y-4 flex-1 min-h-0">
        <Link to={toCollectTarget} className="block space-y-1.5 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium" style={{ color: '#17663A' }}>{ui('toCollectLabel')}</p>
            <span className="text-xs tabular-nums" style={{ color: '#828FA3' }}>{toCollect.count}</span>
          </div>
          <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold tabular-nums" style={{ backgroundColor: '#EEFBF4', borderColor: '#B2EECC', color: '#17663A' }}>
            {formatDashboardAmount(toCollect.amount, currencyLabel, numberLocale)}
          </span>
        </Link>
        <Separator />
        <Link to={toPayTarget} className="block space-y-1.5 py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium" style={{ color: '#D50B3E' }}>{ui('toPayLabel')}</p>
            <span className="text-xs tabular-nums" style={{ color: '#828FA3' }}>{toPay.count}</span>
          </div>
          <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-bold tabular-nums" style={{ backgroundColor: '#FEF0F4', borderColor: '#FBB1C4', color: '#D50B3E' }}>
            {formatDashboardAmount(toPay.amount, currencyLabel, numberLocale)}
          </span>
        </Link>
      </div>
    </div>
  );
}
