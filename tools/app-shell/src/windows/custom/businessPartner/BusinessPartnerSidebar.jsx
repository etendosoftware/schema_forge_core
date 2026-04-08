import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Chart dimensions
const CW = 320;
const CH = 200;
const PX = 32;
const PY = 12;
const PB = 22;

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value);
}

function formatY(v) {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return `${Math.round(v)}`;
}

function MiniKPICard({ label, value, trend, format, accentColor }) {
  const display = format === 'currency' ? formatCurrency(value) : value;
  const hasTrend = trend !== null && trend !== 0;
  const up = trend > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col gap-1">
      <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
      <p className={`text-xl font-bold ${accentColor}`}>{display}</p>
      {hasTrend ? (
        <span className={`flex items-center gap-0.5 text-[11px] font-medium ${up ? 'text-emerald-600' : 'text-destructive'}`}>
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? '+' : ''}{trend.toFixed(1)}%
        </span>
      ) : (
        <span className="h-4" /> /* spacer to keep cards same height */
      )}
    </div>
  );
}

function BPTrendChart({ labels = [], revenue = [], expenses = [] }) {
  const plotW = CW - PX * 2;
  const plotH = CH - PY - PB;

  const allVals = [...revenue, ...expenses];
  const maxVal = Math.max(...allVals, 0);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;

  const toPoint = (v, i, len) => ({
    x: PX + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW),
    y: PY + plotH - ((v - minVal) / range) * plotH,
  });

  const revPts = revenue.map((v, i) => toPoint(v, i, revenue.length));
  const expPts = expenses.map((v, i) => toPoint(v, i, expenses.length));

  const toLine = (pts) => pts.length === 0 ? '' : pts.map((p) => `${p.x},${p.y}`).join(' ');
  const toArea = (pts) => {
    if (pts.length === 0) return '';
    return [
      `M ${pts[0].x},${pts[0].y}`,
      ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
      `L ${pts[pts.length - 1].x},${PY + plotH}`,
      `L ${pts[0].x},${PY + plotH}`,
      'Z',
    ].join(' ');
  };

  const hasData = allVals.some((v) => v > 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-xs font-medium text-foreground">Sales &amp; Purchases</p>
        <p className="text-[11px] text-muted-foreground">Last 6 months</p>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto" role="img" aria-label="Sales and purchases trend">
        <defs>
          <linearGradient id="bp-rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="bp-exp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((frac) => {
          const y = PY + plotH - frac * plotH;
          const val = minVal + frac * range;
          return (
            <g key={frac}>
              <line x1={PX} y1={y} x2={CW - PX} y2={y}
                stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 3" />
              <text x={PX - 4} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="8">
                {formatY(val)}
              </text>
            </g>
          );
        })}

        <path d={toArea(expPts)} fill="url(#bp-exp-grad)" />
        <polyline points={toLine(expPts)} fill="none"
          stroke="hsl(var(--destructive))" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
        {expPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2"
            fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
        ))}

        <path d={toArea(revPts)} fill="url(#bp-rev-grad)" />
        <polyline points={toLine(revPts)} fill="none"
          stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {revPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5"
            fill="hsl(var(--background))" stroke="#10b981" strokeWidth="1.5" />
        ))}

        {labels.map((lbl, i) => {
          const x = PX + (labels.length <= 1 ? plotW / 2 : (i / (labels.length - 1)) * plotW);
          return (
            <text key={i} x={x} y={CH - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
              {lbl}
            </text>
          );
        })}

        {!hasData && (
          <text x={CW / 2} y={PY + plotH / 2 + 4} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
            No invoice data
          </text>
        )}
      </svg>

      <div className="flex items-center gap-4">
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

  const kpiConfig = {
    revenueThisMonth: { label: 'Revenue this month', accent: 'text-emerald-600' },
    expensesThisMonth: { label: 'Expenses this month', accent: 'text-foreground' },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* KPI cards — 2 columns */}
      {kpis === null ? (
        <div className="grid grid-cols-2 gap-2 animate-pulse">
          <div className="h-20 rounded-xl bg-gray-100" />
          <div className="h-20 rounded-xl bg-gray-100" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {kpis.map(kpi => (
            <MiniKPICard
              key={kpi.key}
              label={kpiConfig[kpi.key]?.label ?? kpi.label}
              value={kpi.value}
              trend={kpi.trend || null}
              format={kpi.format}
              accentColor={kpiConfig[kpi.key]?.accent ?? 'text-foreground'}
            />
          ))}
        </div>
      )}

      {/* Trend chart */}
      {trend === null ? (
        <div className="animate-pulse">
          <div className="h-52 rounded-xl bg-gray-100" />
        </div>
      ) : (
        <BPTrendChart
          labels={trend.labels ?? []}
          revenue={trend.revenue ?? []}
          expenses={trend.expenses ?? []}
        />
      )}
    </div>
  );
}
