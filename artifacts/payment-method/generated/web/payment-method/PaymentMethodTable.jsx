import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'string' },
];

const filters = ['name'];

export default function PaymentMethodTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
