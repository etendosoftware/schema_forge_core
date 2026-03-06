import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'symbol', label: 'Symbol', type: 'string' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['name'];

export default function UomTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
