import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, TrendingUp, TrendingDown, Check, Minus, Sparkles, Plus } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { useCopilot } from '@/components/CopilotContext';
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

const BTN_SHADOW = '0px 1px 3px rgba(18, 18, 23, 0.1), 0px 1px 2px rgba(18, 18, 23, 0.06)';

function ViewToggle({ viewMode, onToggle, ui }) {
  const isQty = viewMode === 'quantity';
  const isRev = viewMode === 'revenue';
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '4px', gap: '4px', width: '175.33px', height: '40px', background: '#F5F7F9', borderRadius: '12px', flex: 'none', order: 1, flexGrow: 0 }}>
      <button type="button" onClick={() => onToggle('quantity')} style={{ boxSizing: 'border-box', display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: '4px 8px', width: '81.33px', height: '32px', background: isQty ? '#FFFFFF' : 'transparent', boxShadow: isQty ? BTN_SHADOW : 'none', borderRadius: '8px', flex: 'none', order: 0, flexGrow: 0, border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0px 4px', width: '72px', height: '24px', flex: 'none', order: 1, flexGrow: 0 }}>
          <span style={{ width: '64px', height: '24px', fontFamily: 'Inter', fontStyle: 'normal', fontWeight: 500, fontSize: '14px', lineHeight: '24px', color: isQty ? '#121217' : '#6C6C89', flex: 'none', order: 0, flexGrow: 0 }}>
            {ui('bestProductsToggleUnits')}
          </span>
        </div>
      </button>
      <button type="button" onClick={() => onToggle('revenue')} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: '4px 8px', width: '82px', height: '32px', background: isRev ? '#FFFFFF' : 'transparent', boxShadow: isRev ? BTN_SHADOW : 'none', borderRadius: '8px', flex: 'none', order: 1, flexGrow: 0, border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0px 4px', width: '66px', height: '24px', flex: 'none', order: 1, flexGrow: 0 }}>
          <span style={{ width: '58px', height: '24px', fontFamily: 'Inter', fontStyle: 'normal', fontWeight: 500, fontSize: '14px', lineHeight: '24px', color: isRev ? '#121217' : '#6C6C89', flex: 'none', order: 0, flexGrow: 0 }}>
            {ui('bestProductsToggleRevenue')}
          </span>
        </div>
      </button>
    </div>
  );
}

export function BestProductsList({ sellers = [], products = [], currencyLabel = '' }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);
  const { open: openCopilot } = useCopilot();
  const [viewMode, setViewMode] = useState('quantity');

  const hasNoData = sellers.length === 0 && products.length === 0;
  const rows = viewMode === 'quantity' ? sellers : products;
  const hasPositiveTrend = rows.some((r) => (r.trendPct ?? 0) > 0);
  const hasNegativeTrend = !hasPositiveTrend && rows.some((r) => (r.trendPct ?? 0) < 0);

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

      {hasNoData ? (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="flex flex-col items-center" style={{ gap: '12px', width: '340px' }}>
            <div className="flex flex-col items-center" style={{ gap: '4px' }}>
              <p style={{ fontSize: '20px', fontWeight: 600, lineHeight: '28px', textAlign: 'center', color: '#121217' }}>
                {ui('bestProductsEmptyTitle')}
              </p>
              <p style={{ fontSize: '12px', fontWeight: 400, lineHeight: '16px', textAlign: 'center', color: '#282833' }}>
                {ui('bestProductsEmptySubtitle')}
              </p>
            </div>
            <div className="flex flex-row items-center" style={{ gap: '12px' }}>
              <button
                type="button"
                onClick={openCopilot}
                className="flex items-center justify-center"
                style={{ padding: '4px 8px', height: '32px', background: '#FFFFFF', border: '1px solid #D1D4DB', boxShadow: '0px 1px 2px rgba(18,18,23,0.05)', borderRadius: '8px', gap: '4px', cursor: 'pointer' }}
              >
                <Sparkles style={{ width: '20px', height: '20px', color: '#828FA3' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '24px', color: '#121217' }}>
                  {ui('createWithCopilot')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/sales-invoice/new')}
                className="flex items-center justify-center"
                style={{ padding: '4px 8px', height: '32px', background: '#121217', borderRadius: '8px', gap: '4px', cursor: 'pointer', border: 'none' }}
              >
                <Plus style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.9)' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, lineHeight: '24px', color: '#FFFFFF' }}>
                  {ui('newSale')}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (<>
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
            <div className="flex items-center gap-2 text-xs" style={{ color: '#1E874C' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '20px', height: '20px', background: '#EEFBF4', borderRadius: '10px', flexShrink: 0 }}>
                <Check style={{ width: '12.5px', height: '12.5px', color: '#17663A' }} />
              </div>
              <span>{ui('bestProductsTrendPositive')}</span>
            </div>
          )}
          {hasNegativeTrend && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#D50B3E' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '20px', height: '20px', background: '#FEF0F4', borderRadius: '10px', flexShrink: 0 }}>
                <TrendingDown style={{ width: '12.5px', height: '12.5px', color: '#D50B3E' }} />
              </div>
              <span>{ui('bestProductsTrendNegative')}</span>
            </div>
          )}
        </div>
        
        <ViewToggle viewMode={viewMode} onToggle={setViewMode} ui={ui} />
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    padding: '0px 8px 0px 0px',
                    height: '24px',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '0px 8px',
                      height: '24px',
                      border: '1px solid #D1D4DB',
                      borderRadius: '360px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 400,
                        lineHeight: '24px',
                        color: '#6C6C89',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {value}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    padding: '0px 4px 0px 0px',
                    width: '28px',
                    height: '24px',
                    flexShrink: 0,
                  }}
                >
                  <ChevronRight style={{ width: '16px', height: '16px', color: '#828FA3' }} />
                </div>
              </div>
            );
          })
        )}
      </div>
      </>)}
    </div>
  );
}
