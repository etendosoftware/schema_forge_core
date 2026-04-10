import { useEffect, useState } from 'react';
import { useUI } from '@/i18n';

function fmt(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MetricCard({ label, value, subtitle, tint = null }) {
  if (tint === 'green') {
    return (
      <div className="rounded-xl bg-emerald-50 p-3">
        <div className="text-xs text-emerald-600 mb-0.5">{label}</div>
        <div className="text-lg font-bold leading-none text-emerald-800">{value}</div>
        {subtitle && <div className="text-xs text-emerald-600 mt-1">{subtitle}</div>}
      </div>
    );
  }
  if (tint === 'amber') {
    return (
      <div className="rounded-xl bg-amber-50 p-3">
        <div className="text-xs text-amber-600 mb-0.5">{label}</div>
        <div className="text-lg font-bold leading-none text-amber-800">{value}</div>
        {subtitle && <div className="text-xs text-amber-600 mt-1">{subtitle}</div>}
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-lg font-bold leading-none text-gray-900">{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function ProgressCard({ total, completed, pct, ui }) {
  const pending = total - completed;
  const isComplete = pct === 100;
  const barColor = isComplete ? 'bg-emerald-500' : 'bg-blue-500';
  const trackColor = isComplete ? 'bg-emerald-200' : 'bg-blue-100';

  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">{ui('assetsDepreciationProgress')}</span>
        <span className="text-xs text-blue-600 font-medium">{completed} / {total}</span>
      </div>
      <div className={`h-1.5 ${trackColor} rounded-full overflow-hidden mb-2`}>
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{ui('assetsPendingCount', { count: pending })}</span>
        <span>{ui('assetsDoneCount', { count: completed })}</span>
      </div>
    </div>
  );
}

function countCompletedLines(lines, depreciatedValue) {
  if (!lines.length || depreciatedValue <= 0) return 0;
  let cumulative = 0;
  let completed = 0;
  for (const line of lines) {
    cumulative += Number(line.amortizationAmount ?? 0);
    if (cumulative <= depreciatedValue) {
      completed++;
    } else {
      break;
    }
  }
  return completed;
}

export default function AssetsSidebar({ data, recordId, token, apiBaseUrl }) {
  const ui = useUI();
  const [lineStats, setLineStats] = useState({ total: 0, completed: 0 });

  const depreciatedValue = Number(data?.depreciatedValue ?? 0);

  useEffect(() => {
    if (!recordId || !apiBaseUrl) return;

    const url = `${apiBaseUrl}/amortizationLine?parentId=${recordId}&_startRow=0&_endRow=500&_sortBy=sEQNoAsset+asc`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json) return;
        const lines = json?.response?.data ?? json?.data ?? json?.rows ?? [];
        const sorted = Array.isArray(lines) ? lines : [];
        const total = sorted.length;
        const completed = countCompletedLines(sorted, depreciatedValue);
        setLineStats({ total, completed });
      })
      .catch(() => {});
  }, [recordId, apiBaseUrl, token, depreciatedValue]);

  const hasData = !!data;
  const assetValue = Number(data?.assetValue ?? 0);
  const depreciatedPlan = Number(data?.depreciatedPlan ?? 0);
  const pct = assetValue > 0 ? Math.min(100, Math.round((depreciatedValue / assetValue) * 100)) : 0;
  const isComplete = pct === 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-gray-200/70 bg-white shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <span className="text-sm font-semibold text-gray-800">{ui('assetsDepreciationSummary')}</span>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-3">
          <MetricCard
            label={ui('assetsCurrentValue')}
            value={hasData ? `€ ${fmt(assetValue)}` : '—'}
            subtitle={ui('assetsBookValue')}
          />
          <MetricCard
            label={ui('assetsPlannedDepreciation')}
            value={hasData ? `€ ${fmt(depreciatedPlan)}` : '—'}
            subtitle={ui('assetsTotalScheduled')}
            tint="green"
          />
          <MetricCard
            label={ui('assetsDepreciated')}
            value={hasData ? `${pct}%` : '—'}
            subtitle={hasData ? (isComplete ? ui('assetsFullyDepreciated') : ui('assetsStillInProgress')) : null}
            tint="amber"
          />
          <ProgressCard
            total={lineStats.total}
            completed={lineStats.completed}
            pct={lineStats.total > 0 ? Math.round((lineStats.completed / lineStats.total) * 100) : 0}
            ui={ui}
          />
        </div>
      </div>
    </div>
  );
}
