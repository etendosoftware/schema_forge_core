import { DataTable } from '@/components/contract-ui';

// @sf-generated-start columns:header
const columns = [
  { key: 'searchKey', column: 'Value', type: 'string', label: 'Search Key' },
  { key: 'name', column: 'Name', type: 'string', label: 'Name' },
  { key: 'overduePaymentDaysRule', column: 'NetDays', type: 'number', label: 'Overdue Payment Days Rule' },
  { key: 'default', column: 'IsDefault', type: 'boolean', labels: {"es_ES":"Por defecto","en_US":"Default"}, label: 'Default', badge: true, badgeLabels: {"true":{"es_ES":"Sí","en_US":"Yes"},"false":{"es_ES":"No","en_US":"No"}} },
];
// @sf-generated-end columns:header

const filters = ['searchKey', 'name'];

// @sf-generated-start component:HeaderTable
export default function HeaderTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
// @sf-generated-end component:HeaderTable
