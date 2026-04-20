import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

const UUID_RE = /^[0-9A-F]{32}$/i;

function resolveDocumentNumber(inv) {
  if (inv.documentNo) return inv.documentNo;
  const id = String(inv.id || '');
  if (!id || UUID_RE.test(id)) return null;
  return id.startsWith('SO-') || id.startsWith('SI-') ? id : `SO-${id}`;
}

export function RecentSalesList({ invoices = [], currencyLabel = '' }) {
  const ui = useUI();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

  return (
    <div className="rounded-xl border overflow-hidden bg-white flex flex-col h-full" style={{ borderColor: '#E8EAEF' }}>
      <div
        className="flex items-center border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', minHeight: '48px' }}
      >
        <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
          {ui('recentSalesTitle')}
        </span>
      </div>
      <div style={{ padding: '8px 0px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
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
                  className="group w-full text-left hover:bg-muted/50 transition-colors"
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0px 16px 0px 8px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 400, fontSize: '14px', lineHeight: '24px', color: '#121217', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                      {inv.client}
                    </span>
                  </div>
                  {docNum && (
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0px 8px 0px 0px', flexShrink: 0 }}>
                      <span style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', padding: '4px 8px', height: '24px', background: '#F5F7F9', borderRadius: '360px', fontSize: '12px', fontWeight: 400, lineHeight: '16px', color: '#3F3F50', whiteSpace: 'nowrap' }}>
                        {docNum}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0px 8px 0px 0px', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: '0px 8px', height: '24px', border: '1px solid #D1D4DB', borderRadius: '360px', fontSize: '12px', fontWeight: 400, lineHeight: '24px', color: '#6C6C89', whiteSpace: 'nowrap' }}>
                      {formatDashboardAmount(inv.amount, currencyLabel, numberLocale)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0px 4px 0px 0px', width: '28px', height: '24px', flexShrink: 0 }}>
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
