import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);
  const [viewMode, setViewMode] = useState('quantity');

  const rows = viewMode === 'quantity' ? sellers : products;
  const hasPositiveTrend = rows.some((r) => (r.trendPct ?? 0) > 0);

  return (
    <div
      className="overflow-hidden bg-white"
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0px',
        width: '100%',
        height: '100%',
        border: '1px solid #E8EAEF',
        borderRadius: '8px',
      }}
    >
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
          alignSelf: 'stretch',
          flexGrow: 0,
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
            {ui('bestProductsTitle')}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px 0px',
          gap: '20px',
          width: '100%',
          height: '48px',
          flex: 'none',
          order: 1,
          alignSelf: 'stretch',
          flexGrow: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', height: '24px' }}>
          {hasPositiveTrend && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#1E874C' }}>
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{ui('bestProductsTrendPositive')}</span>
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
            width: '175.33px',
            height: '40px',
            background: '#F5F7F9',
            borderRadius: '12px',
            flex: 'none',
            order: 1,
            flexGrow: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('quantity')}
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '4px 8px',
              width: '81.33px',
              height: '32px',
              background: viewMode === 'quantity' ? '#FFFFFF' : 'transparent',
              boxShadow: viewMode === 'quantity' ? '0px 1px 3px rgba(18, 18, 23, 0.1), 0px 1px 2px rgba(18, 18, 23, 0.06)' : 'none',
              borderRadius: '8px',
              flex: 'none',
              order: 0,
              flexGrow: 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '0px 4px',
                width: '72px',
                height: '24px',
                flex: 'none',
                order: 1,
                flexGrow: 0,
              }}
            >
              <span
                style={{
                  width: '64px',
                  height: '24px',
                  fontFamily: 'Inter',
                  fontStyle: 'normal',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '24px',
                  color: viewMode === 'quantity' ? '#121217' : '#6C6C89',
                  flex: 'none',
                  order: 0,
                  flexGrow: 0,
                }}
              >
                {ui('bestProductsToggleUnits')}
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('revenue')}
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '4px 8px',
              width: '82px',
              height: '32px',
              background: viewMode === 'revenue' ? '#FFFFFF' : 'transparent',
              boxShadow: viewMode === 'revenue' ? '0px 1px 3px rgba(18, 18, 23, 0.1), 0px 1px 2px rgba(18, 18, 23, 0.06)' : 'none',
              borderRadius: '8px',
              flex: 'none',
              order: 1,
              flexGrow: 0,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '0px 4px',
                width: '66px',
                height: '24px',
                flex: 'none',
                order: 1,
                flexGrow: 0,
              }}
            >
              <span
                style={{
                  width: '58px',
                  height: '24px',
                  fontFamily: 'Inter',
                  fontStyle: 'normal',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '24px',
                  color: viewMode === 'revenue' ? '#121217' : '#6C6C89',
                  flex: 'none',
                  order: 0,
                  flexGrow: 0,
                }}
              >
                {ui('bestProductsToggleRevenue')}
              </span>
            </div>
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '8px 0px',
          gap: '8px',
          width: '100%',
          flex: 'none',
          order: 2,
          alignSelf: 'stretch',
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: '#828FA3', padding: '0 12px' }}>{ui('noDataAvailable')}</p>
        ) : (
          rows.map((row, i) => {
            const value = viewMode === 'quantity'
              ? formatDashboardNumber(row.qty, numberLocale)
              : formatDashboardAmount(row.amount, currencyLabel, numberLocale);
            return (
              <div
                key={`${viewMode}-${row.name}-${i}`}
                onClick={() => row.id && navigate(`/product/${row.id}`)}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '4px 8px',
                  width: '100%',
                  height: '32px',
                  borderRadius: '0px',
                  flex: 'none',
                  order: i,
                  alignSelf: 'stretch',
                  flexGrow: 0,
                  cursor: row.id ? 'pointer' : 'default',
                }}
                className="hover:bg-muted/50 transition-colors"
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0px 16px 0px 8px',
                    height: '24px',
                    borderRadius: '0px',
                    flex: '1 1 0',
                    order: 0,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      height: '24px',
                      fontFamily: 'Inter',
                      fontStyle: 'normal',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: '24px',
                      color: '#121217',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    {row.name}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '0px 8px 0px 0px',
                    height: '24px',
                    flex: 'none',
                    flexGrow: 0,
                  }}
                >
                  <TrendPill pct={row.trendPct ?? null} />
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 400,
                    lineHeight: '24px',
                    color: '#6C6C89',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {value}
                </span>
                <ChevronRight style={{ width: '16px', height: '16px', color: '#C4C9D4', flexShrink: 0, marginLeft: '4px' }} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
