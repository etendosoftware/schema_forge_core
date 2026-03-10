import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'searchKey', column: 'Value', type: 'string' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['name', 'searchKey'];

export default function ProductCategoryTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
