import { useState, useEffect, useRef, useMemo } from 'react';
import { DataTable } from '@/components/contract-ui';
import { useLocale } from '@/i18n';
import { Tag } from '@/components/ui/tag';

const filters = ['searchKey', 'name'];

function TypeBadge({ row, t }) {
  const isCust = row.customer === true || row.customer === 'Y';
  const isVend = row.vendor === true || row.vendor === 'Y';
  if (isCust && isVend) {
    return (
      <span className="inline-flex items-center gap-1">
        <Tag variant="blue" label={t('Customer')} />
        <Tag variant="green" label={t('Vendor')} />
      </span>
    );
  }
  if (isCust) return <Tag variant="blue" label={t('Customer')} />;
  if (isVend) return <Tag variant="green" label={t('Vendor')} />;
  return '—';
}

export default function ContactsTable({ data = [], token, apiBaseUrl, ...rest }) {
  const dictionary = useLocale();
  const gl = dictionary?.genericLabels || {};
  const t = (key) => gl[key] || key;

  const columns = useMemo(() => [
    { key: 'name', column: 'Name', type: 'string', label: t('commercialName') },
    { key: '__type', type: 'string', label: t('typeColumn'), render: (row) => <TypeBadge row={row} t={t} /> },
    { key: '__location', type: 'string', label: t('locationColumn'), render: (row) => row.__location ?? '—' },
    { key: 'etgoWeb', column: 'EM_Etgo_Web', type: 'string', label: t('webColumn'), render: (row) => row.etgoWeb ?? '—' },
    { key: 'etgoEmail', column: 'EM_Etgo_Email', type: 'string', label: t('emailColumn'), render: (row) => row.etgoEmail ?? '—' },
    { key: 'etgoPhone', column: 'EM_Etgo_Phone', type: 'string', label: t('phoneColumn'), render: (row) => row.etgoPhone ?? '—' },
  ], [gl]);
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
    fetch(`${apiBaseUrl}/locationAddress?_startRow=0&_endRow=9999`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((locData) => {
      const locByBP = {};
      for (const rec of (locData?.response?.data ?? [])) {
        if (!locByBP[rec.businessPartner]) {
          locByBP[rec.businessPartner] = rec['locationAddress$_identifier'] ?? rec.name ?? '';
        }
      }
      setEnrichedData(data.map((row) => ({
        ...row,
        __location: locByBP[row.id] ?? null,
      })));
    }).catch(() => setEnrichedData(data));
  }, [data, token, apiBaseUrl]);

  return <DataTable columns={columns} filters={filters} data={enrichedData} {...rest} />;
}
