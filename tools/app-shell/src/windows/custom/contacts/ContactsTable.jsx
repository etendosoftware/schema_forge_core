import { useState, useEffect, useRef } from 'react';
import { DataTable } from '@/components/contract-ui';
import { useLocale } from '@/i18n';

const filters = ['searchKey', 'name'];

function TypeBadge({ row }) {
  const dictionary = useLocale();
  const gl = dictionary?.genericLabels || {};
  const t = (key) => gl[key] || key;
  const isCust = row.customer === true || row.customer === 'Y';
  const isVend = row.vendor === true || row.vendor === 'Y';
  if (isCust && isVend) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{t('Customer')}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">{t('Vendor')}</span>
      </span>
    );
  }
  if (isCust) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{t('Customer')}</span>;
  }
  if (isVend) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">{t('Vendor')}</span>;
  }
  return '—';
}

const columns = [
  { key: 'name', column: 'Name', type: 'string', labels: { en_US: 'Commercial Name', es_ES: 'Nombre comercial' } },
  { key: '__type', type: 'string', labels: { en_US: 'Type', es_ES: 'Tipo' }, render: (row) => <TypeBadge row={row} /> },
  { key: '__location', type: 'string', labels: { en_US: 'Location', es_ES: 'Ubicación' }, render: (row) => row.__location ?? '—' },
  { key: '__phone', type: 'string', labels: { en_US: 'Phone', es_ES: 'Teléfono' }, render: (row) => row.__phone ?? '—' },
  { key: '__email', type: 'string', labels: { en_US: 'Email', es_ES: 'Correo electrónico' }, render: (row) => row.__email ?? '—' },
];

export default function ContactsTable({ data = [], token, apiBaseUrl, ...rest }) {
  const [enrichedData, setEnrichedData] = useState(data);
  const lastDataRef = useRef(null);

  useEffect(() => {
    if (!token || !apiBaseUrl || !data.length) {
      setEnrichedData(data);
      return;
    }
    if (lastDataRef.current === data) return;
    lastDataRef.current = data;

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${apiBaseUrl}/locationAddress?_startRow=0&_endRow=9999`, { headers })
        .then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiBaseUrl}/contact?_startRow=0&_endRow=9999`, { headers })
        .then((r) => (r.ok ? r.json() : null)),
    ]).then(([locData, contactData]) => {
      const locByBP = {};
      for (const rec of (locData?.response?.data ?? [])) {
        if (!locByBP[rec.businessPartner]) {
          locByBP[rec.businessPartner] = rec['locationAddress$_identifier'] ?? rec.name ?? '';
        }
      }
      const emailByBP = {};
      const phoneByBP = {};
      for (const rec of (contactData?.response?.data ?? [])) {
        if (!emailByBP[rec.businessPartner] && rec.email) {
          emailByBP[rec.businessPartner] = rec.email;
        }
        if (!phoneByBP[rec.businessPartner] && rec.phone) {
          phoneByBP[rec.businessPartner] = rec.phone;
        }
      }
      setEnrichedData(data.map((row) => ({
        ...row,
        __location: locByBP[row.id] ?? null,
        __email: emailByBP[row.id] ?? null,
        __phone: phoneByBP[row.id] ?? null,
      })));
    }).catch(() => setEnrichedData(data));
  }, [data, token, apiBaseUrl]);

  return <DataTable columns={columns} filters={filters} data={enrichedData} {...rest} />;
}
