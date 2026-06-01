import { useUI } from '@/i18n';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/lib/formatCurrency';

function MetricCard({ label, value, subtitle, tint = null }) {
  const tints = {
    green: { bg: 'bg-emerald-50', text: 'text-emerald-800', labelCls: 'text-emerald-600', sub: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-800', labelCls: 'text-amber-600', sub: 'text-amber-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-800', labelCls: 'text-blue-600', sub: 'text-blue-500' },
    gray: { bg: 'bg-white border border-gray-100', text: 'text-gray-900', labelCls: 'text-gray-500', sub: 'text-gray-400' },
  };
  const c = tints[tint] || tints.gray;
  return (
    <div className={`rounded-xl ${c.bg} p-3`}>
      <div className={`text-xs ${c.labelCls} mb-0.5`}>{label}</div>
      <div className={`text-lg font-bold leading-none ${c.text}`}>{value}</div>
      {subtitle && <div className={`text-xs ${c.sub} mt-1`}>{subtitle}</div>}
    </div>
  );
}

export default function HeaderSidebar({ data }) {
  const ui = useUI();
  const orgCurrency = useCurrency() ?? 'USD';

  const hasData = !!data;
  const totalAmortization = Number(data?.totalAmortization ?? 0);
  const currencyCode = data?.['currency$_identifier'] || orgCurrency;
  const isProcessed = data?.processed === 'Y' || data?.processed === true;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="pb-3">
          <span className="text-sm font-semibold text-gray-800">{ui('amortizationSummary')}</span>
        </div>
        <div className="flex flex-col gap-3">
          <MetricCard
            label={ui('totalAmortization')}
            value={hasData ? formatCurrency(currencyCode, totalAmortization) : '—'}
            subtitle={ui('amortizationTotalPlanned')}
            tint="blue"
          />
          <MetricCard
            label={ui('amortizationStatus')}
            value={hasData ? (isProcessed ? ui('statusProcessed') : ui('statusDraft')) : '—'}
            tint={isProcessed ? 'green' : 'amber'}
          />
        </div>
      </div>
    </div>
  );
}
