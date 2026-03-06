import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'rate', label: 'Rate', type: 'number' },
  { key: 'isActive', label: 'Is Active', type: 'string' },
];

const filters = ['name'];

export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
