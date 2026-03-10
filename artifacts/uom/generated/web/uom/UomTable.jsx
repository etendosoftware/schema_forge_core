import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'symbol', column: 'UOMSymbol', type: 'string' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name'];

export default function UomTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
