import { Check, ArrowUp, ArrowDown } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardCompact, localeFromUi } from '@/lib/dashboardNumberFormat.js';

export function FinancialSummaryCard({ kpis = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

  function getMetricValueTypography(value) {
    const length = String(value ?? '').length;

    if (length >= 12) {
      return { fontSize: '20px', lineHeight: '24px' };
    }

    if (length >= 10) {
      return { fontSize: '24px', lineHeight: '28px' };
    }

    return { fontSize: '30px', lineHeight: '32px' };
  }

  const revenue  = kpis.find((k) => k.key === 'revenueThisMonth');
  const expenses = kpis.find((k) => k.key === 'expensesThisMonth');
  const profit   = kpis.find((k) => k.key === 'netProfit');

  const metrics = [
    {
      key: 'revenueThisMonth',
      kpi: revenue,
      labelKey: 'financialSummaryIncome',
      valueWidth: '156px',
      badgeWidth: '142px',
      wrapWidth: '110px',
      labelWidth: '106px',
    },
    {
      key: 'expensesThisMonth',
      kpi: expenses,
      labelKey: 'financialSummaryExpenses',
      valueWidth: '142px',
      badgeWidth: '142px',
      wrapWidth: '110px',
      labelWidth: '106px',
    },
    {
      key: 'netProfit',
      kpi: profit,
      labelKey: 'financialSummaryProfit',
      valueWidth: '147px',
      badgeWidth: '147px',
      wrapWidth: '115px',
      labelWidth: '111px',
    },
  ];

  return (
    <div
      className="flex flex-col items-start overflow-hidden bg-white"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        minWidth: 0,
        padding: '0px',
        border: '1px solid #E8EAEF',
        borderRadius: '8px',
      }}
    >
      <div
        className="flex flex-row items-center justify-between self-stretch border-b"
        style={{
          boxSizing: 'border-box',
          width: '100%',
          height: '48px',
          padding: '8px 12px',
          gap: '16px',
          backgroundColor: '#F5F7F9',
          borderBottom: '1px solid #E8EAEF',
        }}
      >
        <div
          className="flex flex-row items-center"
          style={{
            height: '16px',
            padding: '0px',
            gap: '10px',
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
            {ui('financialSummaryTitle')}
          </span>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col items-start justify-center"
        style={{
          width: '100%',
          height: '186px',
          padding: '12px 16px 20px',
          gap: '4px',
        }}
      >
        <div
          className="flex flex-row items-center justify-center"
          style={{
            width: '284px',
            height: '20px',
            padding: '0px',
            gap: '8px',
          }}
        >
          <div
            className="flex flex-row items-center justify-center"
            style={{
              width: '20px',
              height: '20px',
              padding: '0px',
              backgroundColor: '#EEFBF4',
              borderRadius: '10px',
            }}
          >
            <Check style={{ width: '12.5px', height: '12.5px', color: '#17663A' }} />
          </div>
          <span
            style={{
              flex: 'none',
              order: 1,
              flexGrow: 0,
              width: '256px',
              height: '16px',
              fontFamily: 'Inter',
              fontStyle: 'normal',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '16px',
              color: '#17663A',
              whiteSpace: 'nowrap',
            }}
          >
            {ui('financialSummaryPositive')}
          </span>
        </div>

        <div
          className="flex flex-col items-start lg:flex-row lg:items-center"
          style={{
            width: '100%',
            height: '130px',
            padding: '0px',
            gap: '20px',
          }}
        >
          {metrics.map(({ key, kpi, labelKey, valueWidth, badgeWidth, wrapWidth, labelWidth }) => {
            const trend = kpi?.trend ?? 0;
            const trendPositive = trend >= 0;
            const pct = Math.abs(trend).toFixed(0);
            const trendLabel = ui(trendPositive ? 'yoyUp' : 'yoyDown')
              .replace('{pct}', pct)
              .replace(/^[↑↓]\s*/, '');
            const TrendIcon = trendPositive ? ArrowUp : ArrowDown;
            const formattedValue = kpi ? formatDashboardCompact(kpi.value, { currencyLabel, locale: numberLocale }) : '—';
            const valueTypography = getMetricValueTypography(formattedValue);
            const badgeStyle = trendPositive
              ? { backgroundColor: '#EEFBF4', color: '#17663A' }
              : { backgroundColor: '#FEF0F4', color: '#D50B3E' };

            return (
              <div
                key={key}
                className="flex flex-col justify-center items-start self-stretch"
                style={{
                  width: '200px',
                  height: '130px',
                  padding: '0px',
                  gap: '8px',
                  filter: 'drop-shadow(0px 1px 2px rgba(18, 18, 23, 0.05))',
                  borderRadius: '8px',
                  alignSelf: 'stretch',
                  flexGrow: 1,
                  flexShrink: 0,
                }}
              >
                <div className="flex flex-row items-start self-stretch" style={{ width: '100%', height: '24px' }}>
                  <div className="flex flex-row items-center" style={{ gap: '6px', width: '165px', height: '24px' }}>
                    <span
                      className="flex items-center"
                      style={{ width: '165px', height: '20px', fontSize: '14px', fontWeight: 400, lineHeight: '20px', color: '#3F3F50' }}
                    >
                      {ui(labelKey)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-start self-stretch" style={{ width: '100%', height: '64px' }}>
                  <div className="flex flex-col items-start" style={{ width: valueWidth, height: '64px' }}>
                    <div className="flex flex-col items-start" style={{ gap: '8px', width: valueWidth, height: '64px' }}>
                      <span
                        className="flex items-center"
                        style={{
                          width: valueWidth,
                          height: '32px',
                          ...valueTypography,
                          fontWeight: 500,
                          color: '#121217',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'clip',
                        }}
                      >
                        {formattedValue}
                      </span>
                      <span
                        className="inline-flex items-center"
                        style={{
                          width: badgeWidth,
                          height: '24px',
                          padding: '4px 8px',
                          borderRadius: '360px',
                          ...badgeStyle,
                        }}
                      >
                        <TrendIcon style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                        <span
                          className="inline-flex items-start"
                          style={{
                            padding: '0px 2px',
                            width: wrapWidth,
                            height: '16px',
                            borderRadius: '0px',
                          }}
                        >
                          <span
                            style={{
                              width: labelWidth,
                              height: '16px',
                              fontFamily: 'Inter',
                              fontStyle: 'normal',
                              fontWeight: 400,
                              fontSize: '12px',
                              lineHeight: '16px',
                              color: badgeStyle.color,
                              flex: 'none',
                              order: 0,
                              flexGrow: 0,
                            }}
                          >
                            {trendLabel}
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
