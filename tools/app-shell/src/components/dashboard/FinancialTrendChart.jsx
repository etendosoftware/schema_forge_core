import { useState } from 'react';
import { LineChart, BarChart2, Check } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import {
  formatDashboardAmount,
  formatDashboardAxisTick,
  localeFromUi,
} from '@/lib/dashboardNumberFormat.js';

const CHART_W = 600;
const CHART_H = 220;
const PAD_X = 40;
const PAD_Y = 20;
const PAD_BOTTOM = 30;
const BAR_PAD_X = 20;
const BAR_PAD_Y = 10;
const BAR_PAD_BOTTOM = 28;

export function FinancialTrendChart({ labels = [], values = [], expenseValues = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);
  const [chartType, setChartType] = useState(() => localStorage.getItem('dashboard_chart_type') || 'line');
  const [tooltip, setTooltip] = useState(null);

  const fmt = new Intl.DateTimeFormat(numberLocale, { month: 'short' });
  const localizedLabels = labels.map((_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - (labels.length - 1 - i), 1);
    const s = fmt.format(d);
    return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
  });

  const switchChartType = (type) => {
    setChartType(type);
    localStorage.setItem('dashboard_chart_type', type);
  };

  const normalizedExpenses = values.map((_, idx) => {
    const n = Number(expenseValues?.[idx] ?? 0);
    return Number.isFinite(n) ? n : 0;
  });
  const hasExpenses = normalizedExpenses.some((v) => Math.abs(v) > 0);

  const fmtTooltip = (n) => formatDashboardAmount(n, currencyLabel, numberLocale);

  const growthPct = values.length >= 2 && values[0] > 0
    ? Math.round(((values[values.length - 1] - values[0]) / values[0]) * 100)
    : null;

  const statusLine = growthPct !== null
    ? (growthPct >= 0
        ? ui('financialTrendGrowthUp').replace('{pct}', Math.abs(growthPct))
        : ui('financialTrendGrowthDown').replace('{pct}', Math.abs(growthPct)))
    : null;

  // Line chart geometry
  const allValues = hasExpenses ? [...values, ...normalizedExpenses] : values;
  const maxVal = Math.max(...allValues, 0);
  const minVal = Math.min(...allValues, 0);
  const rangeVal = maxVal - minVal || 1;
  const plotW = CHART_W - PAD_X * 2;
  const plotH = CHART_H - PAD_Y - PAD_BOTTOM;

  const toPoint = (v, i, len) => ({
    x: PAD_X + (i / Math.max(len - 1, 1)) * plotW,
    y: PAD_Y + plotH - ((v - minVal) / rangeVal) * plotH,
  });

  const revPoints = values.map((v, i) => toPoint(v, i, values.length));
  const expPoints = hasExpenses ? normalizedExpenses.map((v, i) => toPoint(v, i, normalizedExpenses.length)) : [];

  const toPolyline = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');
  const toFillPath = (pts) => {
    if (pts.length === 0) return '';
    return [
      `M ${pts[0].x},${pts[0].y}`,
      ...pts.slice(1).map((p) => `L ${p.x},${p.y}`),
      `L ${pts[pts.length - 1].x},${PAD_Y + plotH}`,
      `L ${pts[0].x},${PAD_Y + plotH}`,
      'Z',
    ].join(' ');
  };

  // Bar chart geometry
  const barPlotW = CHART_W - PAD_X - BAR_PAD_X;
  const barPlotH = CHART_H - BAR_PAD_Y - BAR_PAD_BOTTOM;
  const barAllValues = hasExpenses ? [...values, ...normalizedExpenses] : values;
  const barMaxVal = Math.max(...barAllValues, 1);
  const barSlotW = barPlotW / (values.length || 1);
  const barGroupW = barSlotW * 0.72;
  const barInnerGap = hasExpenses ? Math.min(6, barGroupW * 0.14) : 0;
  const barW = hasExpenses ? Math.max((barGroupW - barInnerGap) / 2, 2) : barGroupW;
  const lastIdx = values.length - 1;

  const showTooltip = (x, y, i) =>
    setTooltip({ x, y, label: localizedLabels[i], revenue: values[i], expense: hasExpenses ? normalizedExpenses[i] : null });

  return (
    <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#E8EAEF' }}>
      <div
        className="flex flex-col border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', gap: '4px' }}
      >
        {statusLine && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#1E874C' }}>
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{statusLine}</span>
          </div>
        )}
        <div className="flex items-center justify-between" style={{ minHeight: statusLine ? 'auto' : '32px' }}>
          <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
            {ui('financialTrendTitle')}
          </span>
          <div className="flex items-center gap-3">
            {hasExpenses && (
              <div className="flex items-center gap-3 text-xs" style={{ color: '#828FA3' }}>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#1E874C' }} />
                  {ui('financialTrendIncomeLegend')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#D50B3E' }} />
                  {ui('financialTrendExpensesLegend')}
                </span>
              </div>
            )}
            <div className="flex items-center border rounded-md overflow-hidden" style={{ borderColor: '#E8EAEF' }}>
              <button
                onClick={() => switchChartType('line')}
                className="p-1 transition-colors"
                style={chartType === 'line'
                  ? { backgroundColor: '#121217', color: '#FFFFFF' }
                  : { color: '#6C6C89', backgroundColor: 'transparent' }}
              >
                <LineChart className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => switchChartType('bar')}
                className="p-1 transition-colors"
                style={chartType === 'bar'
                  ? { backgroundColor: '#121217', color: '#FFFFFF' }
                  : { color: '#6C6C89', backgroundColor: 'transparent' }}
              >
                <BarChart2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="p-4">
        {chartType === 'line' ? (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" role="img">
            <defs>
              <linearGradient id="trend-income-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E874C" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#1E874C" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="trend-expense-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const y = PAD_Y + plotH - frac * plotH;
              const val = minVal + frac * rangeVal;
              return (
                <g key={frac}>
                  <line x1={PAD_X} y1={y} x2={CHART_W - PAD_X} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                  <text x={PAD_X - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
                    {formatDashboardAxisTick(val, numberLocale)}
                  </text>
                </g>
              );
            })}

            {hasExpenses && (
              <>
                <path d={toFillPath(expPoints)} fill="url(#trend-expense-gradient)" />
                <polyline points={toPolyline(expPoints)} fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
                {expPoints.map((p, i) => (
                  <g key={i} onMouseEnter={() => showTooltip(p.x, p.y, i)} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
                    <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
                    <circle cx={p.x} cy={p.y} r="2.5" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" />
                  </g>
                ))}
              </>
            )}

            <path d={toFillPath(revPoints)} fill="url(#trend-income-gradient)" />
            <polyline points={toPolyline(revPoints)} fill="none" stroke="#1E874C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {revPoints.map((p, i) => (
              <g key={i} onMouseEnter={() => showTooltip(p.x, p.y, i)} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
                <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
                <circle cx={p.x} cy={p.y} r="3" fill="hsl(var(--background))" stroke="#1E874C" strokeWidth="2" />
              </g>
            ))}

            {localizedLabels.map((m, i) => {
              const x = PAD_X + (i / Math.max(localizedLabels.length - 1, 1)) * plotW;
              return (
                <text key={i} x={x} y={CHART_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{m}</text>
              );
            })}

            {tooltip && (() => {
              const lines = [
                { text: tooltip.label, color: 'hsl(var(--muted-foreground))', size: 9 },
                { text: `${ui('financialTrendIncomeLegend')}: ${fmtTooltip(tooltip.revenue)}`, color: '#1E874C', size: 10 },
                ...(hasExpenses ? [{ text: `${ui('financialTrendExpensesLegend')}: ${fmtTooltip(tooltip.expense)}`, color: 'hsl(var(--destructive))', size: 10 }] : []),
              ];
              const boxW = 170;
              const lineH = 15;
              const boxH = 10 + lines.length * lineH + 4;
              const tipX = Math.min(Math.max(tooltip.x - boxW / 2, PAD_X), CHART_W - PAD_X - boxW);
              const tipY = Math.max(tooltip.y - boxH - 10, PAD_Y);
              return (
                <g pointerEvents="none">
                  <rect x={tipX} y={tipY} width={boxW} height={boxH} rx="5" fill="#1a1a1a" />
                  {lines.map((line, li) => (
                    <text key={li} x={tipX + boxW / 2} y={tipY + 12 + li * lineH} textAnchor="middle" fontSize={line.size} fontWeight={li === 0 ? '400' : '600'} fill={line.color}>
                      {line.text}
                    </text>
                  ))}
                </g>
              );
            })()}
          </svg>
        ) : (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-auto" role="img">
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const y = BAR_PAD_Y + barPlotH - frac * barPlotH;
              const val = frac * barMaxVal;
              return (
                <g key={frac}>
                  <line x1={PAD_X} y1={y} x2={CHART_W - BAR_PAD_X} y2={y} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
                  <text x={PAD_X - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
                    {formatDashboardAxisTick(val, numberLocale)}
                  </text>
                </g>
              );
            })}
            {values.map((v, i) => {
              const expense = hasExpenses ? normalizedExpenses[i] : 0;
              const revenueH = Math.max((Math.max(v, 0) / barMaxVal) * barPlotH, v > 0 ? 3 : 0);
              const expenseH = hasExpenses ? Math.max((Math.max(expense, 0) / barMaxVal) * barPlotH, expense > 0 ? 3 : 0) : 0;
              const groupWidth = hasExpenses ? barW * 2 + barInnerGap : barW;
              const groupX = PAD_X + i * barSlotW + (barSlotW - groupWidth) / 2;
              const labelX = groupX + groupWidth / 2;
              const tipY = hasExpenses ? Math.min(BAR_PAD_Y + barPlotH - revenueH, BAR_PAD_Y + barPlotH - expenseH) : BAR_PAD_Y + barPlotH - revenueH;
              return (
                <g key={i} onMouseEnter={() => setTooltip({ x: labelX, y: tipY, label: localizedLabels[i], revenue: v, expense: hasExpenses ? expense : null })} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }}>
                  <rect x={groupX} y={BAR_PAD_Y + barPlotH - revenueH} width={barW} height={revenueH} rx="3" fill={i === lastIdx ? '#1E874C' : 'rgba(30,135,76,0.35)'} />
                  {hasExpenses && (
                    <rect x={groupX + barW + barInnerGap} y={BAR_PAD_Y + barPlotH - expenseH} width={barW} height={expenseH} rx="3" fill={i === lastIdx ? 'hsl(var(--destructive))' : 'hsl(var(--destructive) / 0.35)'} />
                  )}
                  <text x={labelX} y={CHART_H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">{localizedLabels[i]}</text>
                </g>
              );
            })}
            {tooltip && (() => {
              const lines = [
                { text: tooltip.label, color: 'hsl(var(--muted-foreground))', size: 9 },
                { text: `${ui('financialTrendIncomeLegend')}: ${fmtTooltip(tooltip.revenue)}`, color: '#1E874C', size: 10 },
                ...(hasExpenses ? [{ text: `${ui('financialTrendExpensesLegend')}: ${fmtTooltip(tooltip.expense)}`, color: 'hsl(var(--destructive))', size: 10 }] : []),
              ];
              const boxW = 170;
              const lineH = 15;
              const boxH = 10 + lines.length * lineH + 4;
              const tipX = Math.min(Math.max(tooltip.x - boxW / 2, PAD_X), CHART_W - PAD_X - boxW);
              const tipY = Math.max(tooltip.y - boxH - 8, BAR_PAD_Y);
              return (
                <g pointerEvents="none">
                  <rect x={tipX} y={tipY} width={boxW} height={boxH} rx="5" fill="#1a1a1a" />
                  {lines.map((line, li) => (
                    <text key={li} x={tipX + boxW / 2} y={tipY + 12 + li * lineH} textAnchor="middle" fontSize={line.size} fontWeight={li === 0 ? '400' : '600'} fill={line.color}>
                      {line.text}
                    </text>
                  ))}
                </g>
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}
