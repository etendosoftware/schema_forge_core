import { Link } from 'react-router-dom';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { createDashboardNavigation, resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

export function CollectionsPaymentsCard({ pendingAmounts = {}, currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

  const { toCollect = { count: 0, amount: 0 }, toPay = { count: 0, amount: 0 } } = pendingAmounts;

  const toCollectTarget = resolveDashboardNavigation(
    toCollect.navigation ?? createDashboardNavigation({ type: 'list', window: 'sales-invoice', filter: 'overdue' })
  ) || '/sales-invoice?filter=overdue';

  const toPayTarget = resolveDashboardNavigation(
    toPay.navigation ?? createDashboardNavigation({ type: 'list', window: 'purchase-invoice', filter: 'overdue' })
  ) || '/purchase-invoice?filter=overdue';

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
            {ui('collectionsPaymentsTitle')}
          </span>
        </div>
      </div>
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '12px',
          width: '100%',
          flex: 1,
        }}
      >
        <Link
          to={toCollectTarget}
          className="hover:opacity-80 transition-opacity"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            gap: '8px',
            width: '189.33px',
            height: '60px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '189.33px',
              height: '24px',
            }}
          >
            <span
              style={{
                width: '70px',
                height: '20px',
                fontFamily: 'Inter',
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                color: '#17663A',
              }}
            >
              {ui('toCollectLabel')}
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '4px 8px',
                width: '27px',
                height: '24px',
                background: '#F5F7F9',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  padding: '0px 2px',
                  width: '11px',
                  height: '16px',
                  borderRadius: '0px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '16px',
                    fontFamily: 'Inter',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '16px',
                    color: '#3F3F50',
                  }}
                >
                  {toCollect.count}
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '4px 8px',
              width: 'max-content',
              height: '28px',
              background: '#EEFBF4',
              border: '1px solid #B2EECC',
              borderRadius: '8px',
              flex: 'none',
              order: 1,
              flexGrow: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '0px 4px',
                width: 'max-content',
                height: '20px',
                borderRadius: '0px',
                flex: 'none',
                order: 1,
                flexGrow: 0,
              }}
            >
              <span
                style={{
                  width: 'max-content',
                  height: '20px',
                  fontFamily: 'Inter',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  color: '#17663A',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                  order: 0,
                  flexGrow: 0,
                }}
              >
                {formatDashboardAmount(toCollect.amount, currencyLabel, numberLocale)}
              </span>
            </div>
          </div>
        </Link>
        
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '16px 0px',
            width: '189.33px',
            height: '32px',
          }}
        >
          <div
            style={{
              width: '189.33px',
              height: '0px',
              border: '1px solid #E8EAEF',
            }}
          />
        </div>

        <Link
          to={toPayTarget}
          className="hover:opacity-80 transition-opacity"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            gap: '8px',
            width: '189.33px',
            height: '60px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '189.33px',
              height: '24px',
            }}
          >
            <span
              style={{
                width: '65px',
                height: '20px',
                fontFamily: 'Inter',
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '20px',
                display: 'flex',
                alignItems: 'center',
                color: '#AF0932',
              }}
            >
              {ui('toPayLabel')}
            </span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '4px 8px',
                width: '26px',
                height: '24px',
                background: '#F5F7F9',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  padding: '0px 2px',
                  width: '10px',
                  height: '16px',
                  borderRadius: '0px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '16px',
                    fontFamily: 'Inter',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '16px',
                    color: '#3F3F50',
                  }}
                >
                  {toPay.count}
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '4px 8px',
              width: 'max-content',
              height: '28px',
              background: '#FEF0F4',
              border: '1px solid #FBB1C4',
              borderRadius: '8px',
              flex: 'none',
              order: 1,
              flexGrow: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '0px 4px',
                width: 'max-content',
                height: '20px',
                borderRadius: '0px',
                flex: 'none',
                order: 1,
                flexGrow: 0,
              }}
            >
              <span
                style={{
                  width: 'max-content',
                  height: '20px',
                  fontFamily: 'Inter',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  color: '#D50B3E',
                  whiteSpace: 'nowrap',
                  flex: 'none',
                  order: 0,
                  flexGrow: 0,
                }}
              >
                {formatDashboardAmount(toPay.amount, currencyLabel, numberLocale)}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
