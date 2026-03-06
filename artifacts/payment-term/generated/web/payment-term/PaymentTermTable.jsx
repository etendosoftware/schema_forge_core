import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'searchKey', label: 'Search Key', type: 'string' },
  { key: 'netDays', label: 'Net Days', type: 'number' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['name', 'searchKey'];

export default function PaymentTermTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
