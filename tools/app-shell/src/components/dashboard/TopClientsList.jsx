import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useUI } from '@/i18n';
import { useLocaleSwitch } from '@/i18n';
import { formatDashboardAmount, localeFromUi } from '@/lib/dashboardNumberFormat.js';
import { resolveDashboardNavigation } from '@/lib/dashboardNavigation.js';

async function resolveClientRoute({ client, token, apiBaseUrl }) {
  const directRoute = resolveDashboardNavigation(client?.navigation);
  if (directRoute) return directRoute;
  if (client?.id) return `/contacts/${client.id}`;

  const name = String(client?.name ?? '').trim();
  if (!token || !apiBaseUrl || !name) return '/contacts';

  const criteria = encodeURIComponent(JSON.stringify({
    operator: 'and',
    criteria: [{ fieldName: 'name', operator: 'equals', value: name }],
  }));

  try {
    const res = await fetch(
      `${apiBaseUrl}/contacts/businessPartner?_sortBy=name asc&_startRow=0&_endRow=10&criteria=${criteria}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    if (!res.ok) return '/contacts';
    const json = await res.json();
    const rows = json?.response?.data ?? [];
    const exact = rows.find((r) => String(r?.name ?? '').trim() === name) ?? rows[0] ?? null;
    return exact?.id ? `/contacts/${exact.id}` : '/contacts';
  } catch {
    return '/contacts';
  }
}

export function TopClientsList({ clients = [], currencyLabel = '', token = '', apiBaseUrl = '' }) {
  const ui = useUI();
  const navigate = useNavigate();
  const { locale } = useLocaleSwitch();
  const numberLocale = localeFromUi(locale);

  const handleClick = async (client) => {
    const route = await resolveClientRoute({ client, token, apiBaseUrl });
    navigate(route);
  };

  return (
    <div className="rounded-xl border overflow-hidden bg-white flex flex-col h-full" style={{ borderColor: '#E8EAEF' }}>
      {/* Cabecera */}
      <div
        className="flex items-center border-b"
        style={{ backgroundColor: '#F5F7F9', borderBottomColor: '#E8EAEF', padding: '8px 12px', minHeight: '48px' }}
      >
        <span className="text-xs font-medium uppercase" style={{ color: '#282833', letterSpacing: 0 }}>
          {ui('topClientsTitle')}
        </span>
      </div>

      {/* Info: padding 8px 0, gap 8px, overflow-y scroll */}
      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        {clients.length === 0 ? (
          <p className="text-sm" style={{ color: '#828FA3', padding: '0 12px' }}>{ui('noDataAvailable')}</p>
        ) : (
          clients.map((c, i) => (
            <button
              key={c.name || i}
              type="button"
              onClick={() => handleClick(c)}
              className="hover:bg-muted/50 transition-colors w-full text-left"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '4px 8px', height: '32px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {/* Value: nombre del cliente, padding 0 16px 0 8px, flex-grow */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0 16px 0 8px', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 400, fontSize: '14px', lineHeight: '24px', color: '#121217', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                  {c.name}
                </span>
              </div>

              {/* Keyboard Shortcut: badge con monto */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0 8px 0 0', flexShrink: 0 }}>
                <span style={{ display: 'inline-flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: '0 8px', height: '24px', border: '1px solid #D1D4DB', borderRadius: '360px', fontSize: '12px', fontWeight: 400, lineHeight: '24px', color: '#6C6C89', whiteSpace: 'nowrap' }}>
                  {formatDashboardAmount(c.total, currencyLabel, numberLocale)}
                </span>
              </div>

              {/* Trailing: chevron 24x24, padding 0 4px 0 0 */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', padding: '0 4px 0 0', width: '28px', height: '24px', flexShrink: 0 }}>
                <ChevronRight style={{ width: '24px', height: '24px', color: '#828FA3' }} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
