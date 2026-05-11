import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BPChartSVGContent } from '@/windows/custom/businessPartner/BusinessPartnerSidebar';
import { useUI, useLocaleSwitch } from '@/i18n';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/lib/formatCurrency';

function KPICard({ label, value, format, color, currencyCode }) {
  const display = format === 'currency' ? formatCurrency(currencyCode ?? 'USD', value) : value;
  return (
    <div className="flex flex-col justify-center gap-2 rounded-lg flex-1 h-16 [filter:drop-shadow(0px_1px_2px_rgba(18,18,23,0.05))]">
      <p className="text-sm font-normal leading-5 text-[#3F3F50]">{label}</p>
      <p className={`text-[30px] font-medium leading-8 ${color}`}>{display}</p>
    </div>
  );
}

const KPI_CONFIG = {
  revenueThisMonth: { labelKey: 'bpRevenueThisMonth', color: 'text-[#17663A]' },
  expensesThisMonth: { labelKey: 'bpExpensesThisMonth', color: 'text-[#AF0932]' },
};

function ChartLegend() {
  const ui = useUI();
  return (
    <div className="flex items-center gap-5">
      <span className="flex items-center gap-2 text-xs font-normal text-[#121217]">
        <span className="inline-block w-[14px] h-1 rounded-sm bg-[#26A95F]" />
        {ui('bpRevenue')}
      </span>
      <span className="flex items-center gap-2 text-xs font-normal text-[#121217]">
        <span className="inline-block w-[14px] h-1 rounded-sm bg-[#F3164E]" />
        {ui('bpExpenses')}
      </span>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
];

function ContactsChart({ labels = [], revenue = [], expenses = [], currencyCode }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState('6M');

  const bcp47 = locale === 'es_ES' ? 'es-ES' : 'en-US';
  const fmt = new Intl.DateTimeFormat(bcp47, { month: 'short' });
  const localizedLabels = labels.map((_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - (labels.length - 1 - i), 1);
    const s = fmt.format(d);
    return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
  });

  const n = PERIOD_OPTIONS.find((p) => p.label === period)?.months ?? 6;
  const sl = (arr) => arr.slice(-n);

  return (
    <div className="flex flex-col gap-2 px-4 pt-2 pb-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-normal text-[#3F3F50]">{ui('bpSalesPurchases')}</p>
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-0.5 text-sm font-medium text-[#121217] underline underline-offset-2"
        >
          {ui('bpLast6Months')}
          <ArrowUpRight size={14} />
        </button>
      </div>

      {/* Legend */}
      <ChartLegend />

      {/* Chart */}
      <BPChartSVGContent
        labels={localizedLabels} revenue={revenue} expenses={expenses}
        CW={320} CH={200} PX={32} PY={12} PB={22}
        fontSize={9} chartId="contacts-mini" orgCurrency={currencyCode ?? 'USD'}
      />

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center justify-between gap-4 pr-8">
                <span>{ui('bpSalesPurchases')}</span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setPeriod(opt.label)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        period === opt.label
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <BPChartSVGContent
            labels={sl(localizedLabels)} revenue={sl(revenue)} expenses={sl(expenses)}
            CW={580} CH={280} PX={48} PY={16} PB={28}
            fontSize={12} chartId="contacts-expanded" orgCurrency={currencyCode ?? 'USD'}
          />
          <ChartLegend />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* eslint-disable react/prop-types */
export default function ContactsSidebar({ recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const currencyCode = useCurrency();
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    if (!recordId || !token || !apiBaseUrl) return;
    setKpis(null);
    setTrend(null);
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${apiBaseUrl}/bp-stats?businessPartnerId=${recordId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setKpis(data?.response?.data ?? []))
      .catch(() => setKpis([]));
    fetch(`${apiBaseUrl}/bp-trend?businessPartnerId=${recordId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setTrend(data?.response?.data ?? { labels: [], revenue: [], expenses: [] }))
      .catch(() => setTrend({ labels: [], revenue: [], expenses: [] }));
  }, [recordId, token, apiBaseUrl]);

  return (
    <div className="flex flex-col">
      {/* Datos */}
      <div className="flex flex-row items-center gap-2 px-4 pt-2 pb-3">
        {kpis === null ? (
          <>
            <div className="h-16 rounded-lg bg-gray-100 animate-pulse flex-1" />
            <div className="h-16 rounded-lg bg-gray-100 animate-pulse flex-1" />
          </>
        ) : (
          kpis.map(kpi => (
            <KPICard
              key={kpi.key}
              label={ui(KPI_CONFIG[kpi.key]?.labelKey) ?? kpi.label}
              value={kpi.value}
              format={kpi.format}
              color={KPI_CONFIG[kpi.key]?.color ?? 'text-foreground'}
              currencyCode={currencyCode}
            />
          ))
        )}
      </div>

      {/* Gráfico */}
      {trend === null ? (
        <div className="px-4 pb-5">
          <div className="h-52 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <ContactsChart
          labels={trend.labels ?? []}
          revenue={trend.revenue ?? []}
          expenses={trend.expenses ?? []}
          currencyCode={currencyCode}
        />
      )}
    </div>
  );
}
