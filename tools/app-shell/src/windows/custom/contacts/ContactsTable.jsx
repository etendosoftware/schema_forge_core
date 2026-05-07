import { useMemo } from 'react';
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

export default function ContactsTable({ data = [], ...rest }) {
  const dictionary = useLocale();
  const gl = dictionary?.genericLabels || {};
  const t = (key) => gl[key] || key;

  const columns = useMemo(() => [
    { key: 'name', column: 'Name', type: 'string', label: t('commercialName') },
    { key: 'etgoFirstname', column: 'EM_Etgo_Firstname', type: 'string', label: t('firstNameColumn'), render: (row) => row.etgoFirstname ?? '—' },
    { key: 'etgoLastname', column: 'EM_Etgo_Lastname', type: 'string', label: t('lastNameColumn'), render: (row) => row.etgoLastname ?? '—' },
    { key: '__type', type: 'string', label: t('typeColumn'), sortable: false, filterable: false, render: (row) => <TypeBadge row={row} t={t} /> },
    { key: 'eTGOLocation', column: 'EM_Etgo_Location', type: 'string', label: t('locationColumn'), render: (row) => row.eTGOLocation ?? '—' },
    { key: 'etgoWeb', column: 'EM_Etgo_Web', type: 'string', label: t('webColumn'), render: (row) => row.etgoWeb ?? '—' },
    { key: 'etgoEmail', column: 'EM_Etgo_Email', type: 'string', label: t('emailColumn'), render: (row) => row.etgoEmail ?? '—' },
    { key: 'etgoPhone', column: 'EM_Etgo_Phone', type: 'string', label: t('phoneColumn'), render: (row) => row.etgoPhone ?? '—' },
  ], [gl]);

  return <DataTable columns={columns} filters={filters} data={data} {...rest} />;
}
