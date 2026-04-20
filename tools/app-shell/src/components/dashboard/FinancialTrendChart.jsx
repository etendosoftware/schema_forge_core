import { useState } from 'react';
import { LineChart, BarChart2, Check } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import {
  formatDashboardAmount,
  formatDashboardAxisTick,
  localeFromUi,
} from '@/lib/dashboardNumberFormat.js';

const CHART_W = 869;
const CHART_H = 196;
const PAD_X = 74;
const PAD_Y = 10;
const PAD_BOTTOM = 24;
const BAR_PAD_X = 74;
const BAR_PAD_Y = 10;
const BAR_PAD_BOTTOM = 24;

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

  const growthPct = values.length >= 2 
    ? (values[0] > 0 ? Math.round(((values[values.length - 1] - values[0]) / values[0]) * 100) : 0)
    : 0;

  const statusLine = growthPct >= 0
    ? ui('financialTrendGrowthUp').replace('{pct}', Math.abs(growthPct))
    : ui('financialTrendGrowthDown').replace('{pct}', Math.abs(growthPct));

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
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0px',
        width: '100%',
        height: '100%',
        background: '#FFFFFF',
        border: '1px solid #E8EAEF',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Cabecera estándar del widget */}
      <div
        style={{
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '8px 12px',
          gap: '16px',
          width: '100%',
          height: '48px',
          background: '#F5F7F9',
          borderBottom: '1px solid #E8EAEF',
          flex: 'none',
          order: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '0px',
            gap: '10px',
            width: 'auto',
            height: '16px',
          }}
        >
          <span
            style={{
              height: '16px',
              fontFamily: 'Inter',
              fontStyle: 'normal',
              fontWeight: 500,
              fontSize: '12px',
              lineHeight: '16px',
              color: '#282833',
              whiteSpace: 'nowrap',
            }}
          >
            {ui('financialTrendTitle')}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '8px 16px 20px',
          gap: '8px',
          width: '100%',
          flex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0px 0px 8px',
            gap: '20px',
            width: '100%',
            height: '48px',
            flex: 'none',
            order: 0,
            alignSelf: 'stretch',
            flexGrow: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0px',
              gap: '20px',
              width: 'auto',
              minWidth: '100px',
              height: '20px',
              flex: 'none',
              order: 0,
              flexGrow: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0px',
                gap: '8px',
                width: 'auto',
                height: '20px',
                flex: 'none',
                order: 0,
                flexGrow: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0px',
                  width: '20px',
                  height: '20px',
                  background: '#EEFBF4',
                  borderRadius: '10px',
                  flex: 'none',
                  order: 0,
                  flexGrow: 0,
                }}
              >
                <Check style={{ width: '12.5px', height: '12.5px', color: '#17663A' }} />
              </div>
              <span
                style={{
                  display: 'block',
                  width: '166px',
                  height: '16px',
                  fontFamily: 'Inter',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '16px',
                  color: '#17663A',
                  flex: 'none',
                  order: 1,
                  flexGrow: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {statusLine}
              </span>
            </div>

            {hasExpenses && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '0px',
                  gap: '20px',
                  width: '153px',
                  height: '16px',
                  flex: 'none',
                  order: 1,
                  flexGrow: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '0px',
                    gap: '8px',
                    width: '71px',
                    height: '16px',
                    flex: 'none',
                    order: 0,
                    flexGrow: 0,
                  }}
                >
                  <div
                    style={{
                      width: '14px',
                      height: '4px',
                      background: '#26A95F',
                      flex: 'none',
                      order: 0,
                      flexGrow: 0,
                    }}
                  />
                  <span
                    style={{
                      width: '49px',
                      height: '16px',
                      fontFamily: 'Inter',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      fontSize: '12px',
                      lineHeight: '16px',
                      color: '#121217',
                      flex: 'none',
                      order: 1,
                      flexGrow: 0,
                    }}
                  >
                    {ui('financialTrendIncomeLegend')}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '0px',
                    gap: '8px',
                    width: '62px',
                    height: '16px',
                    flex: 'none',
                    order: 1,
                    flexGrow: 0,
                  }}
                >
                  <div
                    style={{
                      width: '14px',
                      height: '4px',
                      background: '#F3164E',
                      flex: 'none',
                      order: 0,
                      flexGrow: 0,
                    }}
                  />
                  <span
                    style={{
                      width: '40px',
                      height: '16px',
                      fontFamily: 'Inter',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      fontSize: '12px',
                      lineHeight: '16px',
                      color: '#121217',
                      flex: 'none',
                      order: 1,
                      flexGrow: 0,
                    }}
                  >
                    {ui('financialTrendExpensesLegend')}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '4px',
              gap: '4px',
              width: '96px',
              height: '40px',
              background: '#F5F7F9',
              borderRadius: '12px',
              flex: 'none',
              order: 1,
              flexGrow: 0,
            }}
          >
            <button
              onClick={() => switchChartType('line')}
              style={{
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '4px 8px',
                width: '42px',
                height: '32px',
                background: chartType === 'line' ? '#FFFFFF' : 'transparent',
                boxShadow: chartType === 'line' ? '0px 1px 3px rgba(18, 18, 23, 0.1), 0px 1px 2px rgba(18, 18, 23, 0.06)' : 'none',
                borderRadius: '8px',
                flex: 'none',
                order: 0,
                flexGrow: 0,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LineChart style={{ width: '20px', height: '20px', color: '#828FA3' }} />
            </button>
            <button
              onClick={() => switchChartType('bar')}
              style={{
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '4px 8px',
                width: '42px',
                height: '32px',
                background: chartType === 'bar' ? '#FFFFFF' : 'transparent',
                boxShadow: chartType === 'bar' ? '0px 1px 3px rgba(18, 18, 23, 0.1), 0px 1px 2px rgba(18, 18, 23, 0.06)' : 'none',
                borderRadius: '8px',
                flex: 'none',
                order: 1,
                flexGrow: 0,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <BarChart2 style={{ width: '20px', height: '20px', color: '#828FA3' }} />
            </button>
          </div>
        </div>
        {chartType === 'line' ? (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img">
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
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img">
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
