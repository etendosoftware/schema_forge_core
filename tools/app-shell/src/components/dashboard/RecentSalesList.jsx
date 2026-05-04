import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles, Plus } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { useCopilot } from '@/components/CopilotContext';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

const UUID_RE = /^[0-9A-F]{32}$/i;

function resolveDocumentNumber(inv) {
  return inv.documentNo || inv.document_no || inv.docNo || null;
}

export function RecentSalesList({ invoices = [], currencyLabel = '' }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);
  const { open: openCopilot } = useCopilot();

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
      {invoices.length === 0 ? (
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="flex flex-col items-center" style={{ gap: '12px', width: '340px' }}>
            <div className="flex flex-col items-center" style={{ gap: '4px' }}>
              <p style={{ fontSize: '20px', fontWeight: 600, lineHeight: '28px', textAlign: 'center', color: '#121217' }}>
                {ui('recentSalesEmptyTitle')}
              </p>
              <p style={{ fontSize: '12px', fontWeight: 400, lineHeight: '16px', textAlign: 'center', color: '#282833' }}>
                {ui('recentSalesEmptySubtitle')}
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
      ) : (
      <div
        className="dashboard-scroll"
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
          {invoices.map((inv, i) => {
              const target = resolveDashboardNavigation(inv.navigation) || (inv.id ? `/sales-invoice/${inv.id}` : '/sales-invoice');
              const docNum = resolveDocumentNumber(inv);
              return (
                <Link
                  key={inv.id || i}
                  to={target}
                  className="hover:bg-[#F5F7F9] transition-colors"
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
                    <ChevronRight style={{ width: '16px', height: '16px', color: '#828FA3' }} />
                  </div>
                </Link>
              );
            })
        }
      </div>
      )}
    </div>
  );
}
