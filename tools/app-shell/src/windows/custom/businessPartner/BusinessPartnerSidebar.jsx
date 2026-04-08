import { useState, useEffect } from 'react';
import { DollarSign, CreditCard } from 'lucide-react';
import { KPICard } from '@/components/contract-ui/KPIHeader';

const ICON_MAP = { DollarSign, CreditCard };

// Chart dimensions (viewBox units; SVG scales to container width)
const CW = 320;
const CH = 160;
const PX = 32; // horizontal padding (for Y-axis labels)
const PY = 12; // top padding
const PB = 22; // bottom padding (for X-axis labels)

function formatY(v) {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return `${Math.round(v)}`;
}

function BPTrendChart({ labels = [], revenue = [], expenses = [] }) {
  const plotW = CW - PX * 2;
  const plotH = CH - PY - PB;

  const allVals = [...revenue, ...expenses];
  const maxVal = Math.max(...allVals, 0);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const toPoint = (v, i, len) => ({
    x: PX + (len === 1 ? plotW / 2 : (i / (len - 1)) * plotW),
    y: PY + plotH - ((v - minVal) / range) * plotH,
  });

  const revPts = revenue.map((v, i) => toPoint(v, i, revenue.length));
  const expPts = expenses.map((v, i) => toPoint(v, i, expenses.length));

  const toLine = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const toArea = (pts) => [
    `M ${pts[0].x},${pts[0].y}`,
    ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
    `L ${pts[pts.length - 1].x},${PY + plotH}`,
    `L ${pts[0].x},${PY + plotH}`,
    'Z',
  ].join(' ');

  const hasData = allVals.some((v) => v > 0);

  return (
    <div>
      <p className="text-xs font-medium text-foreground mb-1">Sales &amp; Purchases</p>
      <p className="text-[11px] text-muted-foreground mb-2">Last 6 months</p>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto" role="img" aria-label="Sales and purchases trend">
        <defs>
          <linearGradient id="bp-rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="bp-exp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y-axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const y = PY + plotH - frac * plotH;
          const val = minVal + frac * range;
          return (
            <g key={frac}>
              <line x1={PX} y1={y} x2={CW - PX} y2={y}
                stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 3" />
              <text x={PX - 4} y={y + 3} textAnchor="end"
                className="fill-muted-foreground" fontSize="8">
                {formatY(val)}
              </text>
            </g>
          );
        })}

        {/* Expense area + line */}
        <path d={toArea(expPts)} fill="url(#bp-exp-grad)" />
        <polyline points={toLine(expPts)} fill="none"
          stroke="hsl(var(--destructive))" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
        {expPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2"
            fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
        ))}

        {/* Revenue area + line */}
        <path d={toArea(revPts)} fill="url(#bp-rev-grad)" />
        <polyline points={toLine(revPts)} fill="none"
          stroke="#10b981" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {revPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5"
            fill="hsl(var(--background))" stroke="#10b981" strokeWidth="1.5" />
        ))}

        {/* X-axis labels */}
        {labels.map((lbl, i) => {
          const x = PX + (labels.length === 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
          return (
            <text key={i} x={x} y={CH - 4} textAnchor="middle"
              className="fill-muted-foreground" fontSize="9">
              {lbl}
            </text>
          );
        })}

        {/* Empty state message */}
        {!hasData && (
          <text x={CW / 2} y={PY + plotH / 2 + 4} textAnchor="middle"
            className="fill-muted-foreground" fontSize="10">
            No invoice data
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Revenue
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Expenses
        </span>
      </div>
    </div>
  );
}

export default function BusinessPartnerSidebar({ recordId, token, apiBaseUrl }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState(null);

  // Fetch KPI stats on mount / recordId change
  useEffect(() => {
    if (!recordId || !token || !apiBaseUrl) return;
    setKpis(null);
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${apiBaseUrl}/bp-stats?businessPartnerId=${recordId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setKpis(data?.response?.data ?? []))
      .catch(() => setKpis([]));
  }, [recordId, token, apiBaseUrl]);

  // Fetch trend data lazily when Chart tab is first opened
  useEffect(() => {
    if (activeTab !== 'chart' || !recordId || !token || !apiBaseUrl || trend !== null) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${apiBaseUrl}/bp-trend?businessPartnerId=${recordId}`, { headers })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setTrend(data?.response?.data ?? { labels: [], revenue: [], expenses: [] }))
      .catch(() => setTrend({ labels: [], revenue: [], expenses: [] }));
  }, [activeTab, recordId, token, apiBaseUrl, trend]);

  // Reset trend when record changes
  useEffect(() => { setTrend(null); }, [recordId]);

  const tabs = ['Overview', 'Chart'];

  return (
    <div className="flex flex-col gap-3">
      {/* Tab switcher */}
      <div className="flex items-center gap-1.5">
        {tabs.map(tab => {
          const key = tab.toLowerCase();
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={[
                'px-3 py-1 text-xs rounded-md border transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium border-primary/30'
                  : 'text-muted-foreground border-border hover:text-foreground',
              ].join(' ')}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        kpis === null ? (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-24 rounded-xl bg-gray-100" />
            <div className="h-24 rounded-xl bg-gray-100" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {kpis.map(kpi => (
              <KPICard
                key={kpi.key}
                kpiKey={kpi.key}
                label={kpi.label}
                value={kpi.value}
                format={kpi.format}
                trend={kpi.trend || null}
                previousValue={kpi.previousValue || null}
                icon={ICON_MAP[kpi.icon]}
              />
            ))}
          </div>
        )
      )}

      {/* Chart tab */}
      {activeTab === 'chart' && (
        trend === null ? (
          <div className="animate-pulse">
            <div className="h-6 w-32 rounded bg-gray-100 mb-2" />
            <div className="h-40 rounded-xl bg-gray-100" />
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card p-3">
            <BPTrendChart
              labels={trend.labels ?? []}
              revenue={trend.revenue ?? []}
              expenses={trend.expenses ?? []}
            />
          </div>
        )
      )}
    </div>
  );
}
