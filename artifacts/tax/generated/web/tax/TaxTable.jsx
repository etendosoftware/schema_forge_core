import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'rate', column: 'Rate', type: 'number' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name'];

export default function TaxTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
