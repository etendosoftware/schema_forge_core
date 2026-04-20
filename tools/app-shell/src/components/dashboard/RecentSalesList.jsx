import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

const UUID_RE = /^[0-9A-F]{32}$/i;

function resolveDocumentNumber(inv) {
  return inv.documentNo || inv.document_no || inv.docNo || null;
}

export function RecentSalesList({ invoices = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

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
            {ui('recentSalesTitle')}
          </span>
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
          flex: 1,
          overflowY: 'scroll',
        }}
      >
        {invoices.length === 0 ? (
          <p className="text-sm" style={{ color: '#828FA3', padding: '0 12px' }}>{ui('noInvoicesFound')}</p>
        ) : (
          invoices.map((inv, i) => {
              const target = resolveDashboardNavigation(inv.navigation) || (inv.id ? `/sales-invoice/${inv.id}` : '/sales-invoice');
              const docNum = resolveDocumentNumber(inv);
              return (
                <Link
                  key={inv.id || i}
                  to={target}
                  className="hover:bg-muted/50 transition-colors"
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '4px 8px',
                    width: '100%',
                    height: '32px',
                    borderRadius: '0px',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '0px 16px 0px 8px',
                      height: '24px',
                      borderRadius: '0px',
                      flex: 1,
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
                      {inv.client}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      padding: '0px 8px 0px 0px',
                      height: '24px',
                      borderRadius: '0px',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: '4px 8px',
                        height: '24px',
                        background: '#F5F7F9',
                        borderRadius: '360px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          padding: '0px 2px',
                          height: '16px',
                          borderRadius: '0px',
                        }}
                      >
                        <span
                          style={{
                            height: '16px',
                            fontFamily: 'Inter',
                            fontStyle: 'normal',
                            fontWeight: 400,
                            fontSize: '12px',
                            lineHeight: '16px',
                            color: '#3F3F50',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {docNum || inv.documentNo || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      padding: '0px 8px 0px 0px',
                      height: '24px',
                      borderRadius: '0px',
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
                          height: '24px',
                          fontFamily: 'Inter',
                          fontStyle: 'normal',
                          fontWeight: 400,
                          fontSize: '12px',
                          lineHeight: '24px',
                          color: '#6C6C89',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatDashboardAmount(inv.amount, currencyLabel, numberLocale)}
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
                      borderRadius: '0px',
                      flexShrink: 0,
                    }}
                  >
                    <ChevronRight style={{ width: '24px', height: '24px', color: '#828FA3' }} />
                  </div>
                </Link>
              );
            })
        )}
      </div>
    </div>
  );
}
