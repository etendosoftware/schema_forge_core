import { useState } from 'react';
import { ChevronRight, TrendingUp, TrendingDown, Check, Minus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, formatDashboardNumber, localeFromUi } from '@/lib/dashboardNumberFormat.js';

function TrendPill({ pct }) {
  if (pct === null || pct === undefined) return null;
  const isUp = pct > 0;
  const isFlat = pct === 0;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
      style={isFlat
        ? { backgroundColor: '#F5F7F9', color: '#6C6C89' }
        : isUp
          ? { backgroundColor: '#EEFBF4', color: '#17663A' }
          : { backgroundColor: '#FEF0F4', color: '#D50B3E' }}
    >
      <Icon className="h-3 w-3" />
      {isUp ? '+' : ''}{pct}%
    </span>
  );
}

export function BestProductsList({ sellers = [], products = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);
  const [viewMode, setViewMode] = useState('quantity');

  const rows = viewMode === 'quantity' ? sellers : products;
  const hasPositiveTrend = rows.some((r) => (r.trendPct ?? 0) > 0);

  return (
    <div className="rounded-xl border overflow-hidden bg-white flex flex-col h-full" style={{ borderColor: '#E8EAEF' }}>
      <div
        className="flex flex-col border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', gap: '4px' }}
      >
        {hasPositiveTrend && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#1E874C' }}>
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{ui('bestProductsTrendPositive')}</span>
          </div>
        )}
        <div className="flex items-center justify-between" style={{ minHeight: hasPositiveTrend ? 'auto' : '32px' }}>
          <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
            {ui('bestProductsTitle')}
          </span>
          <div className="flex items-center rounded-full border overflow-hidden text-xs" style={{ borderColor: '#E8EAEF' }}>
            <button
              type="button"
              onClick={() => setViewMode('quantity')}
              className="px-2.5 py-1 transition-colors font-medium"
              style={viewMode === 'quantity'
                ? { backgroundColor: '#121217', color: '#FFFFFF' }
                : { color: '#6C6C89', backgroundColor: 'transparent' }}
            >
              {ui('bestProductsToggleUnits')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('revenue')}
              className="px-2.5 py-1 transition-colors font-medium"
              style={viewMode === 'revenue'
                ? { backgroundColor: '#121217', color: '#FFFFFF' }
                : { color: '#6C6C89', backgroundColor: 'transparent' }}
            >
              {ui('bestProductsToggleRevenue')}
            </button>
          </div>
        </div>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: '#828FA3' }}>{ui('noDataAvailable')}</p>
        ) : (
          <div className="space-y-0">
            {rows.map((row, i) => {
              const value = viewMode === 'quantity'
                ? formatDashboardNumber(row.qty, numberLocale)
                : formatDashboardAmount(row.amount, currencyLabel, numberLocale);
              return (
                <div key={`${viewMode}-${row.name}-${i}`}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-2.5 px-1">
                    <span className="text-sm truncate min-w-0 flex-1 mr-2" style={{ color: '#3F3F50' }}>{row.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <TrendPill pct={row.trendPct ?? null} />
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums" style={{ color: '#3F3F50', borderColor: '#E8EAEF' }}>
                        {value}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-40" style={{ color: '#6C6C89' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
